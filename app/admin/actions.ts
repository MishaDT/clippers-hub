"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { hashPassword } from "@/lib/auth";
import { parseJson, stringify } from "@/lib/json";
import { CampaignReservationError, releaseSubmissionReservation, restoreSubmissionReservation } from "@/lib/campaign-reservations";
import { adminTransactionTransition } from "@/lib/transaction-rules";
import { parseRubToCents } from "@/lib/money";
import { notificationGroup, notify } from "@/lib/notifications";
import { appendOwnershipEvidence } from "@/lib/ownership-evidence";
import { syncViews } from "@/lib/social-sync";
import { boundedInteger } from "@/lib/numbers";
import { safeHttpsUrl } from "@/lib/safe-https-url";

const roles = ["ADMIN", "CLIENT", "WORKER", "BOTH"] as const;
const ranks = ["BRONZE", "SILVER", "GOLD", "DIAMOND", "LEGENDARY"] as const;
const kycStatuses = ["NONE", "PENDING", "VERIFIED"] as const;
const txStatuses = ["PENDING", "COMPLETED", "FAILED", "REVERSED"] as const;

export async function adminRecheckIntegrationsAction() {
  const admin = await requireAdmin();
  const result = await syncViews();
  await logAdmin(admin.id, "ADMIN_INTEGRATIONS_RECHECK", "SocialAccount", "all", {
    synced: result.synced,
    apiSynced: result.apiSynced,
    skipped: result.skipped,
    released: result.released,
    revocationsCompleted: result.revocationsCompleted
  });
  revalidatePath("/admin/integrations");
  redirect("/admin/integrations?rechecked=1");
}

function clean(value: FormDataEntryValue | null, fallback = "") {
  return String(value ?? fallback).trim();
}

async function logAdmin(adminId: string, action: string, entity: string, entityId: string, metadata: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: { userId: adminId, action, entity, entityId, metadata: stringify(metadata) }
  });
}

export async function adminCreateUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const email = clean(formData.get("email")).toLowerCase();
  const name = clean(formData.get("name"), "New user");
  const handleBase = clean(formData.get("handle"), email.split("@")[0] || "user").replace(/[^a-z0-9_]/gi, "").toLowerCase().slice(0, 16);
  const roleInput = clean(formData.get("role"), "WORKER");
  const role = roles.includes(roleInput as (typeof roles)[number]) ? roleInput : "WORKER";
  if (!email.includes("@") || !handleBase) redirect("/admin/users?error=create");

  const password = randomBytes(18).toString("base64url");
  const user = await prisma.user.create({
    data: {
      email,
      name,
      handle: `${handleBase}${Math.floor(Math.random() * 900 + 100)}`,
      passwordHash: await hashPassword(password),
      role: role as "ADMIN" | "CLIENT" | "WORKER" | "BOTH",
      referralCode: `${handleBase}${Math.floor(Math.random() * 9000 + 1000)}`.toUpperCase().slice(0, 12)
    }
  });
  await logAdmin(admin.id, "ADMIN_USER_CREATE", "User", user.id, { email, role });
  revalidatePath("/admin/users");
  redirect(`/admin/users/${user.id}?created=1`);
}

export async function adminUpdateUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = clean(formData.get("userId"));
  const roleInput = clean(formData.get("role"));
  const rankInput = clean(formData.get("rank"));
  const kycInput = clean(formData.get("kycStatus"));
  const trustScore = boundedInteger(formData.get("trustScore"), { min: 0, max: 100, fallback: 100 });
  if (!userId) redirect("/admin/users");

  const data = {
    role: (roles.includes(roleInput as (typeof roles)[number]) ? roleInput : "WORKER") as "ADMIN" | "CLIENT" | "WORKER" | "BOTH",
    rank: (ranks.includes(rankInput as (typeof ranks)[number]) ? rankInput : "BRONZE") as "BRONZE" | "SILVER" | "GOLD" | "DIAMOND" | "LEGENDARY",
    kycStatus: (kycStatuses.includes(kycInput as (typeof kycStatuses)[number]) ? kycInput : "NONE") as "NONE" | "PENDING" | "VERIFIED",
    trustScore
  };

  await prisma.user.update({ where: { id: userId }, data });
  await logAdmin(admin.id, "ADMIN_USER_UPDATE", "User", userId, data);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users/${userId}?saved=1`);
}

export async function adminAdjustBalanceAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = clean(formData.get("userId"));
  const amountCents = parseRubToCents(formData.get("amount"));
  const direction = clean(formData.get("direction"), "plus");
  const reason = clean(formData.get("reason"), "admin adjustment").slice(0, 180);
  if (!userId || amountCents <= 0) redirect(`/admin/users/${userId || ""}?error=amount`);
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { isDemo: true } });
  if (!target) redirect("/admin/users?error=missing_user");

  const signed = direction === "minus" ? -amountCents : amountCents;
  try {
    await prisma.$transaction(async (db) => {
      const changed = signed < 0
        ? await db.user.updateMany({
            where: { id: userId, balanceCents: { gte: amountCents } },
            data: { balanceCents: { decrement: amountCents } }
          })
        : await db.user.updateMany({
            where: { id: userId },
            data: { balanceCents: { increment: amountCents } }
          });
      if (changed.count !== 1) throw new Error("INSUFFICIENT_BALANCE");
      await db.transaction.create({
        data: {
          userId,
          amountCents: signed,
          feeCents: 0,
          netCents: signed,
          type: "ADJUSTMENT",
          status: "COMPLETED",
          isDemo: target.isDemo,
          provider: "admin",
          providerData: stringify({ reason, adminId: admin.id })
        }
      });
      await db.auditLog.create({
        data: { userId: admin.id, action: "ADMIN_BALANCE_ADJUST", entity: "User", entityId: userId, metadata: stringify({ amountCents: signed, reason }) }
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      redirect(`/admin/users/${userId}?error=insufficient_balance`);
    }
    throw error;
  }
  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users/${userId}?balance=1`);
}

export async function adminUpdateTransactionAction(formData: FormData) {
  const admin = await requireAdmin();
  const transactionId = clean(formData.get("transactionId"));
  const statusInput = clean(formData.get("status"));
  const status = txStatuses.includes(statusInput as (typeof txStatuses)[number]) ? statusInput : "PENDING";
  const externalReference = clean(formData.get("externalReference")).slice(0, 120);
  const receiptInput = clean(formData.get("receiptUrl")).slice(0, 500);
  let receiptUrl = "";
  if (receiptInput) {
    receiptUrl = safeHttpsUrl(receiptInput) || "";
    if (!receiptUrl) redirect("/admin/finance?error=receipt_url");
  }
  if (status === "COMPLETED" && externalReference.length < 3) {
    redirect("/admin/finance?error=transfer_reference");
  }
  if (status === "COMPLETED" && !receiptUrl) {
    redirect("/admin/finance?error=receipt_required");
  }
  const tx = await prisma.$transaction(async (db) => {
    const current = await db.transaction.findUniqueOrThrow({ where: { id: transactionId } });
    const transition = adminTransactionTransition({
      type: current.type,
      currentStatus: current.status,
      nextStatus: status
    });
    if (!transition) return null;
    const existingData = parseJson<Record<string, unknown>>(current.providerData, {});
    const claimed = await db.transaction.updateMany({
      where: { id: transactionId, status: "PENDING", type: "WITHDRAWAL" },
      data: {
        status: transition.nextStatus,
        providerData: stringify({
          ...existingData,
          processedAt: new Date().toISOString(),
          processedBy: admin.id,
          ...(status === "COMPLETED" ? { externalReference, receiptUrl: receiptUrl || undefined } : {})
        })
      }
    });
    if (!claimed.count) return null;
    if (transition.refundBalance) {
      await db.user.update({
        where: { id: current.userId },
        data: { balanceCents: { increment: current.amountCents } }
      });
    }
    const updated = await db.transaction.findUniqueOrThrow({ where: { id: transactionId } });
    return updated;
  });
  if (!tx) redirect("/admin/finance?error=invalid_transition");
  await logAdmin(admin.id, "ADMIN_TRANSACTION_UPDATE", "Transaction", transactionId, {
    status,
    userId: tx.userId,
    externalReference: status === "COMPLETED" ? externalReference : undefined,
    hasReceipt: Boolean(receiptUrl)
  });
  revalidatePath("/admin/finance");
  revalidatePath("/admin/referrals");
  revalidatePath("/referrals");
  revalidatePath(`/admin/users/${tx.userId}`);
  redirect(`/admin/finance?updated=1`);
}

export async function adminSetCampaignEridAction(formData: FormData) {
  const admin = await requireAdmin();
  const campaignId = clean(formData.get("campaignId"));
  const erid = clean(formData.get("erid")).slice(0, 120);
  if (!/^[A-Za-z0-9._:-]{6,120}$/.test(erid)) redirect("/admin/content?error=erid");
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true, isAdvertising: true, erid: true } });
  if (!campaign?.isAdvertising) redirect("/admin/content?error=not_advertising");
  await prisma.$transaction([
    prisma.campaign.update({ where: { id: campaignId }, data: { erid } }),
    prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "CAMPAIGN_ERID_SET",
        entity: "Campaign",
        entityId: campaignId,
        metadata: stringify({ previous: campaign.erid || null, erid })
      }
    })
  ]);
  revalidatePath("/admin/content");
  revalidatePath(`/campaigns/${campaignId}`);
  redirect("/admin/content?erid=updated");
}

export async function adminModerateSubmissionAction(formData: FormData) {
  const admin = await requireAdmin();
  const submissionId = clean(formData.get("submissionId"));
  const decision = clean(formData.get("decision"));
  const note = clean(formData.get("note")).slice(0, 180);
  if (!submissionId) redirect("/admin/security");

  const current = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { status: true }
  });
  if (!current) redirect("/admin/security?error=submission");
  const status = decision === "approve"
    ? current.status === "REJECTED" ? "VERIFIED" : current.status
    : "REJECTED";
  try {
    await prisma.$transaction(async (db) => {
      if (decision === "approve") {
        if (current.status === "REJECTED") {
          await restoreSubmissionReservation(db, submissionId);
        }
      } else {
        await releaseSubmissionReservation(db, submissionId);
      }
      if (decision === "approve") {
        const riskCheck = await db.videoCheck.findFirst({
          where: { submissionId, checkType: "METRICS_RISK" },
          orderBy: { updatedAt: "desc" },
          select: { id: true }
        });
        if (riskCheck) {
          await db.videoCheck.update({
            where: { id: riskCheck.id },
            data: {
              status: "PASSED",
              score: 5,
              resultJson: stringify({
                adminDecision: "PASSED",
                note,
                decidedAt: new Date().toISOString(),
                adminId: admin.id
              })
            }
          });
        }
      }
      await db.submission.update({
      where: { id: submissionId },
      data: {
        status,
        fraudScore: decision === "approve" ? 20 : 95,
        verifiedAt: decision === "approve" ? new Date() : null
      }
      });
      await db.auditLog.create({
      data: {
        userId: admin.id,
        action: decision === "approve" ? "ADMIN_SUBMISSION_APPROVE" : "ADMIN_SUBMISSION_REJECT",
        entity: "Submission",
        entityId: submissionId,
        metadata: stringify({ note })
      }
      });
    });
  } catch (error) {
    if (error instanceof CampaignReservationError) {
      redirect(`/admin/security?error=${error.code === "NO_SLOTS" ? "no_slot_for_restore" : "no_budget_for_restore"}`);
    }
    throw error;
  }
  revalidatePath("/admin/security");
  revalidatePath("/admin/content");
  redirect("/admin/security?moderated=1");
}

export async function adminResolveDisputeAction(formData: FormData) {
  const admin = await requireAdmin();
  const disputeId = clean(formData.get("disputeId"));
  const decision = clean(formData.get("decision"));
  const resolution = clean(formData.get("resolution")).slice(0, 1000);
  if (!disputeId || !["accept", "reject"].includes(decision) || resolution.length < 10) {
    redirect("/admin/disputes?error=resolution");
  }

  const dispute = await prisma.disputeCase.findUnique({
    where: { id: disputeId },
    include: {
      user: { select: { id: true } },
      submission: {
        include: {
          worker: { select: { id: true } },
          campaign: { select: { id: true, ownerId: true, title: true, deadline: true, status: true } }
        }
      }
    }
  });
  if (!dispute || dispute.status !== "OPEN") redirect("/admin/disputes");

  try {
    await prisma.$transaction(async (db) => {
      const openedByWorker = dispute.userId === dispute.submission.workerId;
      const pendingEarning = await db.transaction.findFirst({
        where: { submissionId: dispute.submissionId, type: "EARNING", status: "PENDING" }
      });

      if (decision === "accept" && openedByWorker) {
        if (!pendingEarning && dispute.submission.status === "REJECTED") {
          await restoreSubmissionReservation(db, dispute.submissionId);
        }
        await db.submission.update({
          where: { id: dispute.submissionId },
          data: {
            status: pendingEarning ? "SETTLING" : "VERIFIED",
            fraudScore: Math.min(dispute.submission.fraudScore, 35),
            verifiedAt: new Date()
          }
        });
      } else if (decision === "accept" && !openedByWorker) {
        if (pendingEarning) {
          const reversed = await db.transaction.updateMany({
            where: { id: pendingEarning.id, status: "PENDING" },
            data: { status: "REVERSED" }
          });
          if (reversed.count) {
            const holdReleased = await db.user.updateMany({
              where: {
                id: dispute.submission.workerId,
                holdBalanceCents: { gte: pendingEarning.netCents }
              },
              data: { holdBalanceCents: { decrement: pendingEarning.netCents } }
            });
            if (!holdReleased.count) throw new Error("HOLD_BALANCE_INVARIANT");
            await db.campaign.update({
              where: { id: dispute.submission.campaignId },
              data: {
                remainingBudgetCents: { increment: pendingEarning.amountCents },
                status: dispute.submission.campaign.deadline.getTime() > Date.now() ? "ACTIVE" : dispute.submission.campaign.status
              }
            });
          }
        } else {
          await releaseSubmissionReservation(db, dispute.submissionId);
        }
        await db.submission.update({
          where: { id: dispute.submissionId },
          data: { status: "REJECTED", fraudScore: Math.max(dispute.submission.fraudScore, 70) }
        });
      }
      await db.disputeCase.update({
        where: { id: disputeId },
        data: {
          status: decision === "accept" ? "RESOLVED_ACCEPTED" : "RESOLVED_REJECTED",
          resolution,
          resolvedById: admin.id,
          resolvedAt: new Date(),
          openKey: null
        }
      });
      await db.auditLog.create({
        data: {
          userId: admin.id,
          action: decision === "accept" ? "DISPUTE_ACCEPTED" : "DISPUTE_REJECTED",
          entity: "DisputeCase",
          entityId: disputeId,
          metadata: stringify({ submissionId: dispute.submissionId, resolution })
        }
      });
    });
  } catch (error) {
    if (error instanceof CampaignReservationError) {
      redirect(`/admin/disputes?error=${error.code === "NO_SLOTS" ? "no_slot_for_restore" : "no_budget_for_restore"}`);
    }
    throw error;
  }

  const recipients = new Set([
    dispute.user.id,
    dispute.submission.worker.id,
    dispute.submission.campaign.ownerId
  ]);
  recipients.delete(admin.id);
  await Promise.all([...recipients].map((userId) => notify({
    userId,
    groupKey: notificationGroup("dispute-result", disputeId),
    title: decision === "accept" ? "Апелляция удовлетворена" : "Апелляция отклонена",
    body: resolution,
    priority: "HIGH",
    kind: "DISPUTE",
    href: `/campaigns/${dispute.submission.campaign.id}`
  })));

  revalidatePath("/admin/disputes");
  revalidatePath(`/campaigns/${dispute.submission.campaign.id}`);
  redirect("/admin/disputes?resolved=1");
}

export async function adminUpdateVideoCheckAction(formData: FormData) {
  const admin = await requireAdmin();
  const checkId = clean(formData.get("checkId"));
  const decision = clean(formData.get("decision"), "NEEDS_REVIEW");
  const note = clean(formData.get("note")).slice(0, 180);
  if (!checkId) redirect("/admin/security");

  const status = decision === "PASSED" ? "PASSED" : decision === "FAILED" ? "FAILED" : "NEEDS_REVIEW";
  const score = status === "PASSED" ? 5 : status === "FAILED" ? 95 : 55;
  const check = await prisma.videoCheck.update({
    where: { id: checkId },
    data: {
      status,
      score,
      resultJson: stringify({ adminDecision: status, note, decidedAt: new Date().toISOString(), adminId: admin.id })
    },
    include: { submission: true }
  });

  try {
    await prisma.$transaction(async (db) => {
      if (status === "PASSED" && check.submission.status === "REJECTED") {
        await restoreSubmissionReservation(db, check.submissionId);
      } else if (status === "FAILED") {
        await releaseSubmissionReservation(db, check.submissionId);
      }
      await db.submission.update({
      where: { id: check.submissionId },
      data: {
        fraudScore: status === "PASSED" ? Math.min(check.submission.fraudScore, 25) : Math.max(check.submission.fraudScore, score),
        status: status === "FAILED" ? "REJECTED" : check.submission.status === "REJECTED" && status === "PASSED" ? "VERIFIED" : check.submission.status,
        visualProofConfirmedAt: check.checkType === "WATERMARK" && status === "PASSED" ? new Date() : check.submission.visualProofConfirmedAt
      }
      });
      if (check.checkType === "OWNERSHIP" || check.checkType === "WATERMARK") {
        await appendOwnershipEvidence(db, {
          submissionId: check.submissionId,
          socialAccountId: check.submission.socialAccountId,
          method: check.checkType === "WATERMARK" ? "SIGNED_VISUAL_QR" : "MANUAL_REVIEW",
          status,
          platformPostId: check.submission.platformPostId,
          source: "ADMIN_REVIEW",
          moderatorId: admin.id,
          details: { note, checkId }
        });
      }
      await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "ADMIN_VIDEO_CHECK_UPDATE",
        entity: "VideoCheck",
        entityId: checkId,
        metadata: stringify({ status, score, note, submissionId: check.submissionId })
      }
      });
    });
  } catch (error) {
    if (error instanceof CampaignReservationError) {
      redirect(`/admin/security?error=${error.code === "NO_SLOTS" ? "no_slot_for_restore" : "no_budget_for_restore"}`);
    }
    throw error;
  }

  revalidatePath("/admin/security");
  revalidatePath("/admin/content");
  redirect("/admin/security?video_check=1");
}

export async function adminDeleteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = clean(formData.get("userId"));
  const confirmation = clean(formData.get("confirmation")).toUpperCase();
  if (!userId || confirmation !== "DELETE") redirect(`/admin/users/${userId}?error=delete_confirm`);
  if (userId === admin.id) redirect(`/admin/users/${userId}?error=self_delete`);

  await logAdmin(admin.id, "ADMIN_USER_DELETE", "User", userId, {});
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  redirect("/admin/users?deleted=1");
}

export async function adminResolveModerationAction(formData: FormData) {
  const admin = await requireAdmin();
  const caseId = clean(formData.get("caseId"));
  const decision = clean(formData.get("decision"));
  const note = clean(formData.get("note")).slice(0, 300);
  const moderationCase = await prisma.moderationCase.findUniqueOrThrow({ where: { id: caseId } });
  const now = new Date();
  const userUpdate =
    decision === "restrict7" ? { accountStatus: "RESTRICTED" as const, restrictedUntil: new Date(now.getTime() + 7 * 86400000), restrictionReason: note || moderationCase.category }
    : decision === "restrict30" ? { accountStatus: "RESTRICTED" as const, restrictedUntil: new Date(now.getTime() + 30 * 86400000), restrictionReason: note || moderationCase.category }
    : decision === "freeze" ? { accountStatus: "FROZEN" as const, restrictedUntil: null, restrictionReason: note || moderationCase.category }
    : decision === "ban" ? { accountStatus: "BANNED" as const, restrictedUntil: null, restrictionReason: note || moderationCase.category }
    : null;

  await prisma.$transaction(async (tx) => {
    if (userUpdate && moderationCase.authorId) {
      await tx.user.update({ where: { id: moderationCase.authorId }, data: userUpdate });
    }
    if (decision === "remove" && moderationCase.contentType === "CAMPAIGN" && moderationCase.entityId) {
      await tx.campaign.updateMany({ where: { id: moderationCase.entityId }, data: { status: "PAUSED", moderationStatus: "REMOVED" } });
    }
    await tx.moderationCase.update({
      where: { id: caseId },
      data: {
        status: decision === "approve" ? "APPROVED" : decision === "dismiss" ? "DISMISSED" : "ACTIONED",
        reviewerId: admin.id,
        resolution: `${decision}${note ? `: ${note}` : ""}`,
        reviewedAt: now
      }
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "ADMIN_MODERATION_DECISION",
        entity: "ModerationCase",
        entityId: caseId,
        metadata: stringify({ decision, note, authorId: moderationCase.authorId })
      }
    });
  });
  revalidatePath("/admin/moderation");
  if (moderationCase.authorId) revalidatePath(`/admin/users/${moderationCase.authorId}`);
  redirect("/admin/moderation?saved=1");
}

// Manual result verification for platforms with no metrics API (TikTok / Instagram): a
// moderator records the real view count from the public post. This records a manual ownership
// PASS and, once the goal is reached, moves the clip to THRESHOLD_MET so the next sync mints
// the payout through the reserved budget (same safe path as auto-tracked clips).
export async function adminVerifyResultAction(formData: FormData) {
  const admin = await requireAdmin();
  const submissionId = clean(formData.get("submissionId"));
  const views = Math.max(0, Math.round(Number(clean(formData.get("views"), "0")) || 0));
  if (!submissionId) redirect("/admin/moderation?error=submission");

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { campaign: { select: { viewThreshold: true } } }
  });
  if (!submission) redirect("/admin/moderation?error=submission");
  if (submission.status === "PAID") redirect("/admin/moderation?error=already_paid");

  const nextViews = Math.max(submission.currentViews, views);
  const reached = nextViews >= submission.campaign.viewThreshold;
  const nextStatus = reached && ["ACCEPTED", "POSTED", "VERIFIED"].includes(submission.status)
    ? "THRESHOLD_MET"
    : submission.status;

  await prisma.$transaction(async (db) => {
    const proof = stringify({ reason: "manual_admin_verification", verifiedViews: views, by: admin.id, at: new Date().toISOString() });
    const existing = await db.videoCheck.findFirst({ where: { submissionId, checkType: "OWNERSHIP" }, select: { id: true } });
    if (existing) {
      await db.videoCheck.update({ where: { id: existing.id }, data: { status: "PASS", score: 100, resultJson: proof } });
    } else {
      await db.videoCheck.create({ data: { submissionId, checkType: "OWNERSHIP", status: "PASS", score: 100, resultJson: proof } });
    }
    await db.submission.update({
      where: { id: submissionId },
      data: {
        currentViews: nextViews,
        peakViews: Math.max(nextViews, submission.peakViews),
        status: nextStatus,
        verifiedAt: submission.verifiedAt ?? new Date(),
        lastSyncedAt: new Date()
      }
    });
  });

  await logAdmin(admin.id, "VERIFY_RESULT", "Submission", submissionId, { views: nextViews, status: nextStatus, platform: submission.platform });
  await notify({
    userId: submission.workerId,
    groupKey: notificationGroup("manual-verify", `${submissionId}:${nextViews}`),
    title: "Просмотры подтверждены вручную",
    body: `Модератор подтвердил ${nextViews.toLocaleString("ru-RU")} просмотров по вашей публикации.`,
    kind: "SUBMISSION",
    href: `/campaigns/${submission.campaignId}`
  });
  revalidatePath("/admin/moderation");
  redirect("/admin/moderation?verified=1");
}
