"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";
import { canManageClient, canWork, destroySession, getCurrentUser, requireUser } from "@/lib/auth";
import { validateChatMessage } from "@/lib/chat-safety";
import { extractPlatformPostId, validatePublicMediaUrl } from "@/lib/content-safety";
import { scoreSubmissionFraud } from "@/lib/fraud";
import { checkOwnership, platformIsVerifiable } from "@/lib/antifraud";
import { stringify } from "@/lib/json";
import { canEndorse } from "@/lib/leagues";
import { parseRubToCents } from "@/lib/money";
import { createPaymentIntent } from "@/lib/payments";
import { syncMockViews } from "@/lib/social-sync";
import { notifyModerators } from "@/lib/video-checks";

function safeCheckoutUrl(url: string | undefined) {
  if (!url) return "/wallet?deposit=ok";
  if (url.startsWith("/")) return url;
  try {
    const host = new URL(url).hostname;
    if (host.endsWith("stripe.com") || host.endsWith("checkout.stripe.com") || host.endsWith("yookassa.ru") || host.endsWith("yoomoney.ru")) return url;
  } catch {}
  return "/wallet?deposit=blocked";
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) await trackEvent({ userId: user.id, type: "LOGOUT", path: "/profile" });
  await destroySession();
  redirect("/login");
}

export async function unlinkOAuthAccountAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("oauthAccountId") || "");
  if (!id) redirect("/profile?error=oauth");

  await prisma.oAuthAccount.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/profile");
  redirect("/profile?settings=account");
}

export async function deleteAccountAction(formData: FormData) {
  const user = await requireUser();
  const confirmation = String(formData.get("confirmation") || "").trim().toUpperCase();
  if (confirmation !== "УДАЛИТЬ" && confirmation !== "DELETE") redirect("/profile?error=delete_confirm");

  await prisma.auditLog.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await destroySession();
  redirect("/?account=deleted");
}

export async function switchRoleAction(formData: FormData) {
  const user = await requireUser();
  const nextRole = String(formData.get("role"));
  if (!["CLIENT", "WORKER", "BOTH"].includes(nextRole)) redirect("/profile");
  await prisma.user.update({ where: { id: user.id }, data: { role: nextRole as "CLIENT" | "WORKER" | "BOTH" } });
  revalidatePath("/profile");
  redirect("/profile");
}

export async function createCampaignAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageClient(user.role)) redirect("/profile?error=role");

  const budget = parseRubToCents(formData.get("budget"));
  const cpm = parseRubToCents(formData.get("cpm"));
  const platforms = formData.getAll("platforms").map(String).filter((item) => ["TIKTOK", "YOUTUBE", "INSTAGRAM", "VK"].includes(item));
  const deadlineDays = Math.max(1, Number(formData.get("deadlineDays") || 7));
  const sourcePlatform = String(formData.get("sourcePlatform") || "TWITCH");
  const visibility = String(formData.get("visibility") || "PUBLIC");
  const cleanSourcePlatform = (["YOUTUBE", "TIKTOK", "INSTAGRAM", "VK", "TWITCH"].includes(sourcePlatform) ? sourcePlatform : "TWITCH") as "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "VK" | "TWITCH";
  const sourceUrlCheck = validatePublicMediaUrl(String(formData.get("sourceUrl") || ""), cleanSourcePlatform);
  if (!sourceUrlCheck.ok) redirect(`/campaigns/new?error=source_url&reason=${encodeURIComponent(sourceUrlCheck.reasons[0] || "bad_url")}`);
  const trackingPrefix = `ch_${String(formData.get("trackingPrefix") || "CPV").replace(/[^a-z0-9_]/gi, "").toUpperCase().slice(0, 8)}_${Math.floor(Math.random() * 90 + 10)}`;

  const campaign = await prisma.campaign.create({
    data: {
      ownerId: user.id,
      title: String(formData.get("title") || "Новая CPV-кампания"),
      description: String(formData.get("description") || ""),
      sourceUrl: sourceUrlCheck.normalizedUrl,
      sourcePlatform: cleanSourcePlatform,
      allowedPlatformsJson: stringify(platforms.length ? platforms : ["TIKTOK", "YOUTUBE", "INSTAGRAM", "VK"]),
      rulesJson: stringify({
        requiredTags: String(formData.get("requiredTags") || "").split(",").map((item) => item.trim()).filter(Boolean),
        bans: String(formData.get("bans") || "").split(",").map((item) => item.trim()).filter(Boolean),
        watermarkBonus: formData.get("watermarkBonus") === "on",
        watermarkAsset: "/watermark/reelpay-watermark.svg",
        safety: {
          sourceUrlChecked: true,
          sourcePlatform: cleanSourcePlatform,
          checkedAt: new Date().toISOString()
        }
      }),
      cpmRateCents: cpm || 4500,
      viewThreshold: Number(formData.get("viewThreshold") || 10000),
      totalBudgetCents: budget || 5000000,
      remainingBudgetCents: budget || 5000000,
      status: "ACTIVE",
      visibility: (["PUBLIC", "FEATURED", "PRIVATE_INVITE"].includes(visibility) ? visibility : "PUBLIC") as "PUBLIC",
      trackingPrefix,
      deadline: new Date(Date.now() + deadlineDays * 86400000),
      language: String(formData.get("language") || "ru"),
      niche: String(formData.get("niche") || "Gaming"),
      metricsJson: stringify({ views: 0, roi: 0, fillRate: 0 })
    }
  });

  await prisma.transaction.create({
    data: {
      userId: user.id,
      amountCents: campaign.totalBudgetCents,
      feeCents: 0,
      netCents: campaign.totalBudgetCents,
      type: "DEPOSIT",
      status: "PENDING",
      providerData: stringify({ reservedForCampaign: campaign.id })
    }
  });

  revalidatePath("/campaigns");
  revalidatePath("/profile");
  redirect(`/campaigns/${campaign.id}`);
}

export async function joinCampaignAction(formData: FormData) {
  const user = await requireUser();
  if (!canWork(user.role)) redirect("/profile?error=role");
  const campaignId = String(formData.get("campaignId"));
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });

  const existing = await prisma.submission.findFirst({ where: { campaignId, workerId: user.id } });
  if (existing) redirect("/upload");

  const trackingCode = `${campaign.trackingPrefix}_${user.handle.toUpperCase().slice(0, 4)}_${Math.floor(Math.random() * 900 + 100)}`;
  const submission = await prisma.submission.create({
    data: {
      campaignId,
      workerId: user.id,
      postUrl: "https://example.com/post-link-waiting",
      platform: "TIKTOK",
      platformPostId: `draft_${Date.now()}`,
      trackingCode,
      status: "ACCEPTED",
      fraudScore: 0
    }
  });
  await prisma.chatThread.create({
    data: {
      campaignId,
      submissionId: submission.id,
      clientId: campaign.ownerId,
      workerId: user.id,
      messages: {
        create: {
          senderId: user.id,
          type: "SYSTEM",
          body: "Исполнитель взял заказ. Здесь можно уточнить детали и прислать вопросы по ролику."
        }
      }
    }
  });
  revalidatePath("/upload");
  revalidatePath("/profile");
  redirect("/upload");
}

export async function sendChatMessageAction(formData: FormData) {
  const user = await requireUser();
  const threadId = String(formData.get("threadId") || "");
  const checked = validateChatMessage(String(formData.get("body") || ""));
  if (!threadId || !checked.ok) return { ok: false, error: checked.reasons[0] || "bad_message" };

  const thread = await prisma.chatThread.findFirst({
    where: {
      id: threadId,
      OR: [{ clientId: user.id }, { workerId: user.id }]
    },
    select: { id: true, campaignId: true }
  });
  if (!thread) return { ok: false, error: "Чат не найден или у вас нет доступа" };

  await prisma.chatMessage.create({
    data: {
      threadId,
      senderId: user.id,
      type: "TEXT",
      body: checked.body,
      metadataJson: stringify({ urls: checked.urls })
    }
  });
  await prisma.chatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
  revalidatePath(`/campaigns/${thread.campaignId}`);
  revalidatePath("/chats");
  return { ok: true };
}

export async function submitClipAction(formData: FormData) {
  const user = await requireUser();
  const submissionId = String(formData.get("submissionId"));
  const postUrl = String(formData.get("postUrl") || "").trim();
  const platformInput = String(formData.get("platform") || "TIKTOK");
  const platform = (["TIKTOK", "YOUTUBE", "INSTAGRAM", "VK"].includes(platformInput) ? platformInput : "TIKTOK") as "TIKTOK" | "YOUTUBE" | "INSTAGRAM" | "VK";
  const watermarkConfirmed = formData.get("watermarkConfirmed") === "on";

  const [submission, duplicate, recentSubmissions] = await Promise.all([
    prisma.submission.findFirstOrThrow({ where: { id: submissionId, workerId: user.id }, include: { campaign: true } }),
    prisma.submission.findFirst({ where: { postUrl, NOT: { id: submissionId } }, select: { id: true } }),
    prisma.submission.findMany({ where: { workerId: user.id }, orderBy: { createdAt: "desc" }, take: 20 })
  ]);

  const campaignRules = safeJson<{ watermarkBonus?: boolean }>(submission.campaign.rulesJson, {});
  const allowedPlatforms = safeJson<string[]>(submission.campaign.allowedPlatformsJson, ["TIKTOK", "YOUTUBE", "INSTAGRAM", "VK"]);
  const fraud = scoreSubmissionFraud({
    postUrl,
    platform,
    user,
    duplicateUrl: Boolean(duplicate),
    recentSubmissions,
    watermarkRequired: Boolean(campaignRules.watermarkBonus),
    watermarkConfirmed
  });
  const reasons = [...fraud.reasons];
  let fraudScore = fraud.score;
  if (!allowedPlatforms.includes(platform)) {
    fraudScore += 35;
    reasons.push("Площадка не разрешена заказчиком");
  }
  fraudScore = Math.min(95, fraudScore);
  const status = fraudScore >= 75 ? "REJECTED" : "POSTED";

  const updatedSubmission = await prisma.submission.update({
    where: { id: submissionId, workerId: user.id },
    data: {
      postUrl,
      platform,
      platformPostId: extractPlatformPostId(postUrl),
      status,
      fraudScore,
      verifiedAt: status === "POSTED" ? new Date() : null,
      viewVelocityJson: stringify([{ at: new Date().toISOString(), event: "submitted", fraudScore, reasons, watermarkConfirmed }])
    }
  });

  // Best-effort instant ownership check: on platforms that expose public
  // metadata (YouTube/VK) we confirm the tracking code is already in the
  // description so the clipper gets immediate feedback. Real enforcement (and
  // re-checks) happen in syncViews — this is non-blocking and never throws.
  let ownershipState: "verified" | "code_missing" | "pending" = "pending";
  if (status === "POSTED" && platformIsVerifiable(platform)) {
    try {
      const proof = await checkOwnership({ platform, postUrl, trackingCode: submission.trackingCode });
      if (proof.matched) {
        ownershipState = "verified";
        await prisma.submission.update({ where: { id: updatedSubmission.id }, data: { status: "VERIFIED", verifiedAt: new Date() } });
        await prisma.videoCheck.create({
          data: { submissionId: updatedSubmission.id, checkType: "OWNERSHIP", status: "PASS", score: 100, resultJson: stringify({ reason: proof.reason, evidence: proof.evidence, createdFrom: "submitClipAction" }) }
        });
      } else if (proof.reason === "code_missing") {
        ownershipState = "code_missing";
        await prisma.videoCheck.create({
          data: { submissionId: updatedSubmission.id, checkType: "OWNERSHIP", status: "FAIL", score: 0, resultJson: stringify({ reason: proof.reason, evidence: proof.evidence, createdFrom: "submitClipAction" }) }
        });
      }
    } catch {
      // missing keys / quota / private video — leave verification to syncViews
    }
  }

  const watermarkRequired = Boolean(campaignRules.watermarkBonus);
  let videoCheckId: string | null = null;
  if (watermarkRequired || status === "REJECTED") {
    const check = await prisma.videoCheck.create({
      data: {
        submissionId: updatedSubmission.id,
        checkType: "WATERMARK",
        status: "PENDING",
        score: fraudScore,
        resultJson: stringify({
          postUrl,
          platform,
          watermarkRequired,
          watermarkConfirmed,
          trackingCode: submission.trackingCode,
          createdFrom: "submitClipAction"
        })
      }
    });
    videoCheckId = check.id;
    await notifyModerators(prisma, {
      title: "Новая проверка ролика",
      body: `Работа по заказу "${submission.campaign.title}" ждёт проверки watermark и fraud-score.`,
      entityId: check.id,
      metadata: { submissionId: updatedSubmission.id, fraudScore, platform, watermarkRequired }
    });
  }

  await prisma.notification.create({
    data: {
      userId: user.id,
      title: status === "REJECTED" ? "Работа требует проверки" : "Работа отправлена",
      body: status === "REJECTED" ? "Ссылка получила высокий fraud score и ушла на ручную проверку." : "Ссылка отправлена на проверку и трекинг просмотров.",
      channel: "in-app",
      priority: status === "REJECTED" ? "HIGH" : "MED"
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: status === "REJECTED" ? "SUBMISSION_FLAGGED" : "SUBMISSION_POSTED",
      entity: "Submission",
      entityId: submission.id,
      metadata: stringify({ platform, postUrl, fraudScore, reasons, watermarkConfirmed, videoCheckId })
    }
  });

  await trackEvent({
    userId: user.id,
    type: status === "REJECTED" ? "SUBMISSION_FLAGGED" : "SUBMISSION_POSTED",
    path: "/upload",
    provider: platform.toLowerCase(),
    metadata: { submissionId, fraudScore, reasons, watermarkConfirmed, videoCheckId }
  });

  revalidatePath("/upload");
  revalidatePath("/profile");
  redirect(
    status === "REJECTED"
      ? "/upload?flagged=1"
      : ownershipState === "code_missing"
        ? "/upload?nocode=1"
        : ownershipState === "verified"
          ? "/upload?verified=1"
          : "/upload?sent=1"
  );
}

export async function toggleCampaignReactionAction(campaignId: string, kind: "LIKE" | "SAVE") {
  const user = await requireUser();
  if (kind === "LIKE") {
    const existing = await prisma.likedCampaign.findUnique({ where: { userId_campaignId: { userId: user.id, campaignId } } });
    if (existing) {
      await prisma.likedCampaign.delete({ where: { id: existing.id } });
      revalidatePath("/feed");
      revalidatePath("/profile");
      return false;
    }
    await prisma.likedCampaign.create({ data: { userId: user.id, campaignId } });
    revalidatePath("/feed");
    revalidatePath("/profile");
    return true;
  }
  const existing = await prisma.savedCampaign.findUnique({ where: { userId_campaignId: { userId: user.id, campaignId } } });
  if (existing) {
    await prisma.savedCampaign.delete({ where: { id: existing.id } });
    revalidatePath("/feed");
    revalidatePath("/profile");
    return false;
  }
  await prisma.savedCampaign.create({ data: { userId: user.id, campaignId } });
  revalidatePath("/feed");
  revalidatePath("/profile");
  return true;
}

export async function depositAction(formData: FormData) {
  const user = await requireUser();
  const amountCents = parseRubToCents(formData.get("amount"));
  if (amountCents <= 0) redirect("/wallet?error=amount");
  const provider = String(formData.get("provider") || "yookassa") as "yookassa" | "stripe";
  const intent = await createPaymentIntent({ amountCents, userId: user.id, provider, description: "ReelPay deposit" });
  await prisma.transaction.create({
    data: {
      userId: user.id,
      amountCents,
      feeCents: provider === "stripe" ? Math.round(amountCents * 0.029) : 0,
      netCents: amountCents,
      type: "DEPOSIT",
        status: intent.mode === "demo" ? "COMPLETED" : "PENDING",
      provider,
      providerData: stringify(intent)
    }
  });
  if (intent.mode === "demo") {
    await prisma.user.update({ where: { id: user.id }, data: { balanceCents: { increment: amountCents } } });
  }
  revalidatePath("/wallet");
  revalidatePath("/profile");
  redirect(safeCheckoutUrl(intent.checkoutUrl));
}

export async function withdrawAction(formData: FormData) {
  const user = await requireUser();
  const amountCents = parseRubToCents(formData.get("amount"));
  if (amountCents <= 0) redirect("/wallet?error=amount");

  const result = await prisma.user.updateMany({
    where: { id: user.id, balanceCents: { gte: amountCents } },
    data: { balanceCents: { decrement: amountCents } }
  });
  if (result.count === 0) redirect("/wallet?error=balance");

  const fee = 5000 + Math.round(amountCents * 0.01);
  await prisma.transaction.create({
    data: {
      userId: user.id,
      amountCents,
      feeCents: fee,
      netCents: Math.max(0, amountCents - fee),
      type: "WITHDRAWAL",
      status: "PENDING",
      providerData: stringify({ fixedFeeCents: 5000, percentFee: 0.01 })
    }
  });
  revalidatePath("/wallet");
  revalidatePath("/profile");
}

export async function syncViewsAction() {
  await requireUser();
  await syncMockViews();
  revalidatePath("/campaigns");
  revalidatePath("/profile");
}

export async function sendCollabInviteAction(formData: FormData) {
  const user = await requireUser();
  const handle = String(formData.get("handle") || "");
  if (!canManageClient(user.role)) redirect(`/clippers/${handle}?error=role`);
  const workerId = String(formData.get("workerId") || "");
  const message = String(formData.get("message") || "").trim().slice(0, 600);
  if (!workerId || workerId === user.id || message.length < 3) redirect(`/clippers/${handle}?error=invite`);

  const worker = await prisma.user.findUnique({ where: { id: workerId }, select: { id: true } });
  if (!worker) redirect("/leaderboard");

  const existing = await prisma.collabInvite.findFirst({
    where: { clientId: user.id, workerId, status: "PENDING" },
    select: { id: true }
  });
  if (!existing) {
    await prisma.collabInvite.create({ data: { clientId: user.id, workerId, message } });
    await prisma.notification.create({
      data: {
        userId: workerId,
        title: "Приглашение на коллаб",
        body: `${user.name} зовёт на совместный клип`,
        channel: "IN_APP",
        priority: "NORMAL"
      }
    });
  }
  revalidatePath(`/clippers/${handle}`);
  redirect(`/clippers/${handle}?invited=1`);
}

export async function respondCollabInviteAction(formData: FormData) {
  const user = await requireUser();
  const inviteId = String(formData.get("inviteId") || "");
  const accept = String(formData.get("decision") || "") === "accept";

  const invite = await prisma.collabInvite.findFirst({
    where: { id: inviteId, workerId: user.id, status: "PENDING" },
    select: { id: true, clientId: true }
  });
  if (invite) {
    await prisma.collabInvite.update({
      where: { id: invite.id },
      data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date() }
    });
    await prisma.notification.create({
      data: {
        userId: invite.clientId,
        title: accept ? "Коллаб принят" : "Коллаб отклонён",
        body: `${user.name} ${accept ? "принял приглашение" : "отклонил приглашение"}`,
        channel: "IN_APP",
        priority: "NORMAL"
      }
    });
  }
  revalidatePath("/collabs");
  redirect("/collabs");
}

export async function endorseClipperAction(formData: FormData) {
  const user = await requireUser();
  const handle = String(formData.get("handle") || "");
  if (!canManageClient(user.role)) redirect(`/clippers/${handle}?error=role`);
  const workerId = String(formData.get("workerId") || "");
  const note = String(formData.get("note") || "").trim().slice(0, 200) || null;
  if (!workerId || workerId === user.id) redirect(`/clippers/${handle}`);

  // Only "large" clients (by order count) may endorse.
  const orders = await prisma.campaign.count({ where: { ownerId: user.id } });
  if (!canEndorse(orders)) redirect(`/clippers/${handle}?error=tier`);

  await prisma.endorsement.upsert({
    where: { clientId_workerId: { clientId: user.id, workerId } },
    update: { note },
    create: { clientId: user.id, workerId, note }
  });
  await prisma.notification.create({
    data: {
      userId: workerId,
      title: "Вас рекомендуют",
      body: `${user.name} рекомендует вас как клиппера`,
      channel: "IN_APP",
      priority: "HIGH"
    }
  });
  revalidatePath(`/clippers/${handle}`);
  redirect(`/clippers/${handle}?endorsed=1`);
}
