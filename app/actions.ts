"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";
import { canManageClient, canWork, destroySession, getCurrentUser, requireUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin";
import { validateChatMessage } from "@/lib/chat-safety";
import { extractPlatformPostId, validatePublicMediaUrl } from "@/lib/content-safety";
import { scoreSubmissionFraud } from "@/lib/fraud";
import { checkOwnership, platformIsVerifiable } from "@/lib/antifraud";
import { stringify } from "@/lib/json";
import { canEndorse } from "@/lib/leagues";
import { achievementByCode, achievementProgress, nextFeaturedUntil, RP_BOOST_COST } from "@/lib/achievements";
import { loadAchievementStats } from "@/lib/achievement-stats";
import { grossPayout, parseRubToCents } from "@/lib/money";
import { createPaymentIntent } from "@/lib/payments";
import { isPaymentProvider, isPaymentProviderAvailable } from "@/lib/payment-readiness";
import { syncMockViews } from "@/lib/social-sync";
import { notifyModerators } from "@/lib/video-checks";
import { canUseRoleMode, getActiveRoleMode, ROLE_MODE_COOKIE, type RoleMode } from "@/lib/role-mode";
import { assertAccountActive, moderateText, reportContent } from "@/lib/moderation";
import { moscowWeekKey, RECURRING_REWARDS, splitRpSpend, WEEKLY_RP_CAP } from "@/lib/rp";
import { scanContent } from "@/lib/content-policy";
import { isSafeRussianReport, normalizeRussianReport, reportReasonLabel } from "@/lib/report-reasons";
import { notificationGroup, notify } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";
import { safeReturnTo } from "@/lib/navigation";
import { CampaignReservationError, releaseSubmissionReservation, reserveCampaignSlot } from "@/lib/campaign-reservations";
import { initialDraftDecision, nextDraftRevision, validateDraftUrl } from "@/lib/draft-workflow";
import { ratingParties } from "@/lib/rating-rules";

function safeCheckoutUrl(url: string | undefined) {
  if (!url) return "/wallet?deposit=ok";
  if (url.startsWith("/")) return url;
  try {
    const host = new URL(url).hostname;
    const trustedHosts = ["stripe.com", "yookassa.ru", "yoomoney.ru"];
    if (trustedHosts.some((trusted) => host === trusted || host.endsWith(`.${trusted}`))) return url;
  } catch {}
  return "/wallet?deposit=blocked";
}

function safeInternalPath(value: string, fallback: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value.slice(0, 240) : fallback;
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// Demo (unpaid) deposits credit balance with no real money behind them. They must
// be an explicit, deliberate opt-in for test/staging — never the silent fallback in
// production when a payment provider secret happens to be missing.
function demoPaymentsEnabled() {
  return process.env.DEMO_PAYMENTS === "1" || process.env.DEMO_PAYMENTS === "true";
}

function requireVerifiedEmail(user: { emailVerifiedAt: Date | null }) {
  if (!user.emailVerifiedAt) redirect("/verify-email");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) await trackEvent({ userId: user.id, type: "LOGOUT", path: "/profile" });
  await destroySession();
  redirect("/login");
}

export async function openDisputeAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  if (!(await rateLimit(`dispute:${user.id}`, 3, 60 * 60 * 1000))) {
    redirect("/support?error=dispute_limit");
  }

  const submissionId = String(formData.get("submissionId") || "");
  const returnTo = safeInternalPath(String(formData.get("returnTo") || ""), "/profile");
  const reason = String(formData.get("reason") || "").trim().slice(0, 1000);
  if (!submissionId || reason.length < 20) redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=dispute_reason`);

  const policy = await moderateText({
    text: reason,
    contentType: "DISPUTE",
    authorId: user.id,
    context: "SUPPORT"
  });
  if (policy.action === "BLOCK") redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=moderation`);

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      campaign: { select: { id: true, title: true, ownerId: true } },
      worker: { select: { id: true, name: true } }
    }
  });
  if (!submission) redirect(returnTo);
  const isParty = submission.workerId === user.id || submission.campaign.ownerId === user.id;
  if (!isParty && !canAccessAdmin(user)) redirect(returnTo);
  if (submission.status === "PAID") {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=dispute_paid`);
  }

  let disputeId = "";
  try {
    const dispute = await prisma.$transaction(async (db) => {
      const created = await db.disputeCase.create({
        data: {
          userId: user.id,
          submissionId,
          reason,
          openKey: submissionId
        }
      });
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: "DISPUTE_OPENED",
          entity: "DisputeCase",
          entityId: created.id,
          metadata: stringify({ submissionId, campaignId: submission.campaign.id })
        }
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    disputeId = dispute.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}dispute=already_open`);
    }
    throw error;
  }

  const counterpartId = user.id === submission.workerId ? submission.campaign.ownerId : submission.workerId;
  await notify({
    userId: counterpartId,
    groupKey: notificationGroup("dispute", submissionId),
    title: "Открыта апелляция",
    body: `В работе «${submission.campaign.title}» открыт спор. Выплата приостановлена до решения.`,
    priority: "HIGH",
    kind: "DISPUTE",
    href: `/campaigns/${submission.campaign.id}`
  });
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(admins.map((admin) => notify({
    userId: admin.id,
    groupKey: notificationGroup("admin-dispute", disputeId),
    title: "Новый спор по работе",
    body: `${user.name} просит проверить результат по кампании «${submission.campaign.title}».`,
    priority: "HIGH",
    kind: "MODERATION",
    href: "/admin/disputes"
  })));

  revalidatePath(`/campaigns/${submission.campaign.id}`);
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}dispute=opened`);
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
  const mode = String(formData.get("mode")) as RoleMode;
  const returnTo = safeReturnTo(formData.get("returnTo"), "/profile");
  if (!["client", "worker"].includes(mode) || !canUseRoleMode(user.role, mode)) redirect(returnTo);
  (await cookies()).set(ROLE_MODE_COOKIE, mode, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
  await prisma.user.update({ where: { id: user.id }, data: { preferredRoleMode: mode } });
  revalidatePath(`/profiles/${user.handle}`);
  revalidatePath(`/clippers/${user.handle}`);
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function createCampaignAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  requireVerifiedEmail(user);
  if (!canManageClient(user.role) || await getActiveRoleMode(user) !== "client") redirect("/campaigns");
  if (formData.get("rightsConfirmed") !== "on") redirect("/campaigns/new?error=rights");
  if (formData.get("briefConfirmed") !== "on") redirect("/campaigns/new?error=brief");

  const budget = parseRubToCents(formData.get("budget"));
  const cpm = parseRubToCents(formData.get("cpm"));
  const platforms = formData.getAll("platforms").map(String).filter((item) => ["TIKTOK", "YOUTUBE", "INSTAGRAM", "VK"].includes(item));
  const deadlineDays = Math.max(1, Number(formData.get("deadlineDays") || 7));
  const sourcePlatform = String(formData.get("sourcePlatform") || "TWITCH");
  const requestedVisibility = String(formData.get("visibility") || "PUBLIC");
  const requestedReviewMode = String(formData.get("reviewMode") || "STANDARD");
  const reviewMode = (["FAST", "STANDARD", "STRICT"].includes(requestedReviewMode)
    ? requestedReviewMode
    : "STANDARD") as "FAST" | "STANDARD" | "STRICT";
  const maxRevisionRounds = Math.max(1, Math.min(3, Number(formData.get("maxRevisionRounds") || 2)));
  const visibility = user.role === "ADMIN" && requestedVisibility === "FEATURED" ? "FEATURED" : "PUBLIC";
  const cleanSourcePlatform = (["YOUTUBE", "TIKTOK", "INSTAGRAM", "VK", "TWITCH"].includes(sourcePlatform) ? sourcePlatform : "TWITCH") as "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "VK" | "TWITCH";
  const sourceUrlCheck = validatePublicMediaUrl(String(formData.get("sourceUrl") || ""), cleanSourcePlatform);
  if (!sourceUrlCheck.ok) redirect(`/campaigns/new?error=source_url&reason=${encodeURIComponent(sourceUrlCheck.reasons[0] || "bad_url")}`);
  const trackingBase = String(formData.get("trackingPrefix") || "CPV")
    .replace(/[^a-z0-9_]/gi, "")
    .toUpperCase()
    .slice(0, 8) || "CPV";
  const trackingPrefix = `ch_${trackingBase}_${randomBytes(5).toString("hex").toUpperCase()}`;

  const campaignPolicy = await moderateText({
    text: [
      formData.get("title"),
      formData.get("description"),
      formData.get("requiredTags"),
      formData.get("bans")
    ].map((value) => String(value || "")).join("\n"),
    contentType: "CAMPAIGN",
    authorId: user.id,
    context: "PUBLIC"
  });
  if (campaignPolicy.action === "BLOCK" || campaignPolicy.action === "REVIEW") redirect("/campaigns/new?error=moderation");

  const totalBudgetCents = budget || 5000000;
  const maxPaidResults = Math.max(1, Math.min(20, Number(formData.get("deliverableCount") || 1)));
  const viewThreshold = Number(formData.get("viewThreshold") || 10000);
  const targetPayoutCents = grossPayout(viewThreshold, cpm || 4500);
  const minimumGuaranteeCents = Math.min(
    targetPayoutCents,
    parseRubToCents(formData.get("minimumGuarantee"))
  );
  const minimumBudgetCents = targetPayoutCents * maxPaidResults;
  if (totalBudgetCents < minimumBudgetCents) {
    redirect(`/campaigns/new?error=budget_min&need=${minimumBudgetCents}`);
  }
  const priorCampaignCount = await prisma.campaign.count({ where: { ownerId: user.id } });

  let campaign;
  try {
    campaign = await prisma.$transaction(async (db) => {
      // Escrow the full budget from the client's balance up front. The debit is an atomic
      // conditional update, so a campaign can never become ACTIVE with money the client
      // never funded — every cent a clipper can earn is backed by a real client deposit.
      const funded = await db.user.updateMany({
        where: { id: user.id, balanceCents: { gte: totalBudgetCents } },
        data: { balanceCents: { decrement: totalBudgetCents } }
      });
      if (funded.count === 0) throw new Error("INSUFFICIENT_BUDGET");

      const created = await db.campaign.create({
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
          briefJson: stringify({
            deliverableCount: maxPaidResults,
            clipDuration: String(formData.get("clipDuration") || "30-60"),
            aspectRatio: String(formData.get("aspectRatio") || "9:16"),
            style: String(formData.get("style") || "dynamic").slice(0, 40),
            language: String(formData.get("language") || "ru").slice(0, 12),
            subtitles: String(formData.get("subtitles") || "required").slice(0, 30),
            cta: String(formData.get("cta") || "").trim().slice(0, 180),
            mustInclude: String(formData.get("mustInclude") || "").trim().slice(0, 400),
            exampleUrls: String(formData.get("exampleUrls") || "").split(/\r?\n/).map((item) => item.trim()).filter((item) => /^https?:\/\//i.test(item)).slice(0, 3),
            rightsConfirmed: formData.get("rightsConfirmed") === "on",
            briefConfirmed: true,
            briefAcceptedAt: new Date().toISOString(),
            briefVersion: 1
          }),
          cpmRateCents: cpm || 4500,
          viewThreshold,
          minimumGuaranteeCents,
          reviewMode,
          maxRevisionRounds,
          briefVersion: 1,
          draftRequired: true,
          totalBudgetCents,
          remainingBudgetCents: totalBudgetCents,
          reservedBudgetCents: 0,
          maxPaidResults,
          status: "ACTIVE",
          visibility,
          trackingPrefix,
          deadline: new Date(Date.now() + deadlineDays * 86400000),
          language: String(formData.get("language") || "ru"),
          niche: String(formData.get("niche") || "Gaming"),
          metricsJson: stringify({ views: 0, roi: 0, fillRate: 0 })
        }
      });

      // Immutable ledger entry for the escrow debit (negative net = money left the wallet).
      await db.transaction.create({
        data: {
          userId: user.id,
          amountCents: totalBudgetCents,
          feeCents: 0,
          netCents: -totalBudgetCents,
          type: "ADJUSTMENT",
          status: "COMPLETED",
          providerData: stringify({ escrowForCampaign: created.id })
        }
      });

      return created;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BUDGET") {
      redirect(`/wallet?error=insufficient_budget&need=${totalBudgetCents}`);
    }
    throw error;
  }

  revalidatePath("/campaigns");
  revalidateTag("campaigns");
  revalidatePath("/profile");
  await trackEvent({
    userId: user.id,
    type: "CAMPAIGN_PUBLISHED",
    path: "/campaigns/new",
    metadata: { campaignId: campaign.id, maxPaidResults, viewThreshold: campaign.viewThreshold }
  });
  if (priorCampaignCount > 0) {
    await trackEvent({
      userId: user.id,
      type: "CAMPAIGN_REPEATED",
      path: "/campaigns/new",
      metadata: { campaignId: campaign.id, priorCampaignCount }
    });
  }
  redirect(`/campaigns/${campaign.id}`);
}

export async function closeCampaignAction(formData: FormData) {
  const user = await requireUser();
  const campaignId = String(formData.get("campaignId") || "");
  try {
    await prisma.$transaction(async (db) => {
      const campaign = await db.campaign.findUnique({
        where: { id: campaignId },
        select: { ownerId: true, status: true, remainingBudgetCents: true }
      });
      if (!campaign || campaign.ownerId !== user.id) throw new Error("FORBIDDEN");
      if (campaign.status === "COMPLETED") return;
      // Close + zero the budget conditionally on the exact remaining we read, so a concurrent
      // settlement can't let us refund more than is actually unspent (and a double-submit
      // can't refund twice).
      const closed = await db.campaign.updateMany({
        where: { id: campaignId, status: { not: "COMPLETED" }, remainingBudgetCents: campaign.remainingBudgetCents },
        data: { status: "COMPLETED", remainingBudgetCents: 0 }
      });
      if (closed.count === 0) return;
      const refund = Math.max(0, campaign.remainingBudgetCents);
      if (refund > 0) {
        await db.user.update({ where: { id: user.id }, data: { balanceCents: { increment: refund } } });
        await db.transaction.create({
          data: {
            userId: user.id,
            amountCents: refund,
            feeCents: 0,
            netCents: refund,
            type: "ADJUSTMENT",
            status: "COMPLETED",
            providerData: stringify({ escrowRefundForCampaign: campaignId })
          }
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") redirect("/campaigns");
    throw error;
  }
  revalidatePath("/campaigns");
  revalidateTag("campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/profile");
  revalidatePath("/wallet");
  redirect(`/campaigns/${campaignId}?closed=1`);
}

export async function joinCampaignAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  requireVerifiedEmail(user);
  if (!canWork(user.role) || await getActiveRoleMode(user) !== "worker") redirect("/campaigns");
  const campaignId = String(formData.get("campaignId"));
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });

  // Access guards: a clipper may only take a live, public, in-budget campaign that isn't
  // their own. Without these, anyone who knew an ID could join a draft / paused / finished /
  // private / expired campaign, or a BOTH/ADMIN account could take its own order and pay
  // itself out of its own escrow.
  if (campaign.ownerId === user.id) redirect("/campaigns?error=own_campaign");
  if (campaign.status !== "ACTIVE" && campaign.status !== "LOW_BUDGET") redirect("/campaigns?error=closed");
  if (campaign.visibility === "PRIVATE_INVITE") redirect("/campaigns?error=private");
  if (campaign.deadline.getTime() <= Date.now()) redirect("/campaigns?error=expired");
  if (campaign.remainingBudgetCents <= 0) redirect("/campaigns?error=no_budget");

  const existing = await prisma.submission.findFirst({ where: { campaignId, workerId: user.id } });
  if (existing) redirect("/upload");

  const trackingCode = `${campaign.trackingPrefix}_${user.handle.toUpperCase().slice(0, 4)}_${randomBytes(5).toString("hex").toUpperCase()}`;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await prisma.$transaction(async (tx) => {
          const { reserve } = await reserveCampaignSlot(tx, campaignId, user.id);
          const submission = await tx.submission.create({
            data: {
              campaignId,
              workerId: user.id,
              postUrl: "https://example.com/post-link-waiting",
              platform: "TIKTOK",
              platformPostId: `draft_${Date.now()}`,
              trackingCode,
              status: "ACCEPTED",
              fraudScore: 0,
              reservedPayoutCents: reserve
            }
          });
          await tx.chatThread.upsert({
            where: { campaignId_workerId: { campaignId, workerId: user.id } },
            update: {
              submissionId: submission.id,
              messages: {
                create: {
                  senderId: user.id,
                  type: "SYSTEM",
                  body: "Исполнитель снова открыл заказ. Можно продолжить обсуждение здесь."
                }
              }
            },
            create: {
              campaignId,
              submissionId: submission.id,
              clientId: campaign.ownerId,
              workerId: user.id,
              messages: {
                create: {
                  senderId: user.id,
                  type: "SYSTEM",
                  body: "Исполнитель взял заказ. Выплата зарезервирована; здесь можно уточнить детали и вопросы по ролику."
                }
              }
            }
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof CampaignReservationError) {
      const reason = error.code === "NO_SLOTS" ? "no_slots" : error.code === "ALREADY_JOINED" ? "already_joined" : error.code === "CLOSED" ? "closed" : "no_budget";
      redirect(`/campaigns?error=${reason}`);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/upload");
    }
    throw error;
  }
  const thread = await prisma.chatThread.findUnique({
    where: { campaignId_workerId: { campaignId, workerId: user.id } },
    select: { id: true }
  });
  if (thread) {
    await notify({
      userId: campaign.ownerId,
      groupKey: notificationGroup("campaign-join", `${campaignId}:${user.id}`),
      title: "Новый отклик на заказ",
      body: `${user.name} взял заказ «${campaign.title}».`,
      kind: "CAMPAIGN",
      href: `/chats?thread=${thread.id}`
    });
  }
  await trackEvent({
    userId: user.id,
    type: "ORDER_TAKEN",
    path: `/campaigns/${campaignId}`,
    metadata: { campaignId }
  });
  revalidatePath("/upload");
  revalidatePath("/profile");
  redirect("/upload");
}

export async function sendChatMessageAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  if (!(await rateLimit(`chat:${user.id}`, 20, 60_000))) return { ok: false, error: "Слишком много сообщений подряд. Подождите немного." };
  const threadId = String(formData.get("threadId") || "");
  const checked = validateChatMessage(String(formData.get("body") || ""));
  if (!threadId || !checked.ok) return { ok: false, error: checked.reasons[0] || "bad_message" };

  const thread = await prisma.chatThread.findFirst({
    where: {
      id: threadId,
      OR: [{ clientId: user.id }, { workerId: user.id }]
    },
    select: { id: true, kind: true, campaignId: true, clientId: true, workerId: true }
  });
  if (!thread) return { ok: false, error: "Чат не найден или у вас нет доступа" };

  // Anti-flood: refuse an exact repeat of this sender's last message in the thread.
  const lastOwn = await prisma.chatMessage.findFirst({
    where: { threadId, senderId: user.id, type: "TEXT" },
    orderBy: { createdAt: "desc" },
    select: { body: true, createdAt: true }
  });
  if (lastOwn && lastOwn.body === checked.body && Date.now() - lastOwn.createdAt.getTime() < 5 * 60_000) {
    return { ok: false, error: "Вы уже отправили это сообщение." };
  }

  const policy = await moderateText({
    text: checked.body,
    contentType: "CHAT_MESSAGE",
    authorId: user.id,
    context: "CHAT",
    payload: { threadId }
  });
  if (policy.action === "BLOCK") return { ok: false, error: "Сообщение нарушает правила платформы" };
  if (policy.action === "REVIEW") return { ok: false, error: "Сообщение отправлено модератору на проверку" };

  const now = new Date();
  await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        threadId,
        senderId: user.id,
        type: "TEXT",
        body: checked.body,
        metadataJson: stringify({ urls: checked.urls })
      }
    }),
    prisma.chatThread.update({ where: { id: threadId }, data: { updatedAt: now, clientClearedAt: null, workerClearedAt: null } }),
    prisma.chatReadState.upsert({
      where: { threadId_userId: { threadId, userId: user.id } },
      create: { threadId, userId: user.id, lastReadAt: now },
      update: { lastReadAt: now }
    })
  ]);
  if (thread.campaignId) revalidatePath(`/campaigns/${thread.campaignId}`);
  revalidatePath("/chats");
  return { ok: true };
}

export async function editChatMessageAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const messageId = String(formData.get("messageId") || "");
  const checked = validateChatMessage(String(formData.get("body") || ""));
  if (!messageId || !checked.ok) return { ok: false, error: checked.reasons[0] || "bad_message" };

  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, senderId: user.id, type: "TEXT", deletedAt: null },
    select: { id: true, threadId: true, body: true, thread: { select: { campaignId: true } } }
  });
  if (!message) return { ok: false, error: "Это сообщение нельзя изменить" };
  if (message.body === checked.body) return { ok: true };

  const policy = await moderateText({
    text: checked.body,
    contentType: "CHAT_MESSAGE",
    authorId: user.id,
    context: "CHAT",
    payload: { threadId: message.threadId, messageId }
  });
  if (policy.action === "BLOCK") return { ok: false, error: "Сообщение нарушает правила платформы" };
  if (policy.action === "REVIEW") return { ok: false, error: "Изменение отправлено модератору на проверку" };

  await prisma.$transaction([
    prisma.chatMessageEdit.create({
      data: {
        messageId: message.id,
        threadId: message.threadId,
        editorId: user.id,
        previousBody: message.body,
        newBody: checked.body,
        action: "EDIT"
      }
    }),
    prisma.chatMessage.update({
      where: { id: message.id },
      data: { body: checked.body, editedAt: new Date(), metadataJson: stringify({ urls: checked.urls }) }
    })
  ]);
  if (message.thread.campaignId) revalidatePath(`/campaigns/${message.thread.campaignId}`);
  revalidatePath("/chats");
  return { ok: true };
}

export async function deleteChatMessageAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const messageId = String(formData.get("messageId") || "");
  if (!messageId) return { ok: false, error: "bad_request" };

  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, senderId: user.id, deletedAt: null },
    select: { id: true, threadId: true, body: true, thread: { select: { campaignId: true } } }
  });
  if (!message) return { ok: false, error: "Это сообщение нельзя удалить" };

  await prisma.$transaction([
    prisma.chatMessageEdit.create({
      data: {
        messageId: message.id,
        threadId: message.threadId,
        editorId: user.id,
        previousBody: message.body,
        newBody: null,
        action: "DELETE"
      }
    }),
    prisma.chatMessage.update({
      where: { id: message.id },
      data: { deletedAt: new Date(), body: "", metadataJson: "{}" }
    })
  ]);
  if (message.thread.campaignId) revalidatePath(`/campaigns/${message.thread.campaignId}`);
  revalidatePath("/chats");
  return { ok: true };
}

export async function archiveThreadAction(formData: FormData) {
  const user = await requireUser();
  const threadId = String(formData.get("threadId") || "");
  const archive = String(formData.get("archive") || "1") === "1";
  const thread = await prisma.chatThread.findFirst({
    where: { id: threadId, OR: [{ clientId: user.id }, { workerId: user.id }] },
    select: { id: true, clientId: true }
  });
  if (thread) {
    const asClient = thread.clientId === user.id;
    const value = archive ? new Date() : null;
    await prisma.chatThread.update({
      where: { id: thread.id },
      data: asClient ? { clientArchivedAt: value } : { workerArchivedAt: value }
    });
  }
  revalidatePath("/chats");
  redirect(archive ? "/chats?view=archived" : "/chats");
}

export async function clearThreadAction(formData: FormData) {
  const user = await requireUser();
  const threadId = String(formData.get("threadId") || "");
  const thread = await prisma.chatThread.findFirst({
    where: { id: threadId, OR: [{ clientId: user.id }, { workerId: user.id }] },
    select: { id: true, clientId: true }
  });
  if (thread) {
    const asClient = thread.clientId === user.id;
    const now = new Date();
    await prisma.chatThread.update({
      where: { id: thread.id },
      data: asClient
        ? { clientClearedAt: now, clientArchivedAt: null }
        : { workerClearedAt: now, workerArchivedAt: null }
    });
  }
  revalidatePath("/chats");
  redirect("/chats");
}

export async function claimAchievementAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const code = String(formData.get("code") || "");
  const def = achievementByCode(code);
  if (!def) return { ok: false, error: "Достижение не найдено" };
  const mode = await getActiveRoleMode(user);
  if (def.role !== "any" && def.role !== mode) return { ok: false, error: "Достижение относится к другой роли" };

  const stats = await loadAchievementStats(user);
  if (!achievementProgress(def, stats).done) return { ok: false, error: "Условие ещё не выполнено" };

  const achievement = await prisma.achievement.upsert({
    where: { code: def.code },
    create: { code: def.code, title: def.title, description: def.description, icon: def.icon },
    update: {},
    select: { id: true }
  });

  const reference = `achievement:${user.id}:${def.code}`;
  try {
    const claimed = await prisma.$transaction(async (tx) => {
      const unlocked = await tx.userAchievement.upsert({
        where: { userId_achievementId: { userId: user.id, achievementId: achievement.id } },
        create: { userId: user.id, achievementId: achievement.id },
        update: {}
      });
      if (unlocked.claimedAt) return false;
      await tx.rpTransaction.create({
        data: {
          userId: user.id,
          amount: def.reward,
          type: "ACHIEVEMENT",
          reference,
          metadataJson: stringify({ code: def.code })
        }
      });
      await tx.user.update({ where: { id: user.id }, data: { rpBalance: { increment: def.reward } } });
      await tx.userAchievement.update({
        where: { id: unlocked.id },
        data: { claimedAt: new Date(), rewardRp: def.reward }
      });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!claimed) {
      const account = await prisma.user.findUnique({ where: { id: user.id }, select: { rpBalance: true } });
      return { ok: true, already: true, claimed: true, rewardRp: 0, rpBalance: account?.rpBalance || 0 };
    }
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    const account = await prisma.user.findUnique({ where: { id: user.id }, select: { rpBalance: true } });
    return { ok: true, already: true, claimed: true, rewardRp: 0, rpBalance: account?.rpBalance || 0 };
  }
  revalidatePath("/profile");
  revalidatePath("/leaderboard");
  const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { rpBalance: true } });
  return { ok: true, claimed: true, rewardRp: def.reward, rpBalance: account.rpBalance };
}

export async function boostCampaignWithRpAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  if (!canManageClient(user.role) || await getActiveRoleMode(user) !== "client") redirect("/campaigns");
  const campaignId = String(formData.get("campaignId") || "");
  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.findFirst({
        where: { id: campaignId, ownerId: user.id, status: { in: ["ACTIVE", "LOW_BUDGET"] } },
        select: { id: true, featuredUntil: true }
      });
      if (!campaign) throw new Error("CAMPAIGN_NOT_AVAILABLE");
      const featuredUntil = nextFeaturedUntil(campaign.featuredUntil, now);
      if (!featuredUntil) throw new Error("FEATURED_LIMIT");
      const account = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { rpBalance: true, rpPurchasedBalance: true, balanceCents: true }
      });
      const missing = Math.max(0, RP_BOOST_COST - account.rpBalance);
      const autoConvert = String(formData.get("autoConvert") || "") === "1";
      if (missing && !autoConvert) throw new Error("RP_BALANCE");
      if (account.balanceCents < missing * 100) throw new Error("RUB_BALANCE");
      const totalBeforeSpend = account.rpBalance + missing;
      const purchasedBeforeSpend = account.rpPurchasedBalance + missing;
      const { purchasedUsed } = splitRpSpend(totalBeforeSpend, purchasedBeforeSpend, RP_BOOST_COST);
      await tx.user.update({
        where: { id: user.id },
        data: {
          balanceCents: account.balanceCents - missing * 100,
          rpBalance: totalBeforeSpend - RP_BOOST_COST,
          rpPurchasedBalance: purchasedBeforeSpend - purchasedUsed
        }
      });
      if (missing) {
        await tx.rpTransaction.create({
          data: {
            userId: user.id,
            amount: missing,
            type: "PURCHASE",
            reference: `rp:auto:${campaign.id}:${featuredUntil.toISOString()}`,
            metadataJson: stringify({ rubCents: missing * 100, automatic: true })
          }
        });
      }
      await tx.campaign.update({ where: { id: campaign.id }, data: { featuredUntil } });
      await tx.rpTransaction.create({
        data: {
          userId: user.id,
          amount: -RP_BOOST_COST,
          type: "CAMPAIGN_BOOST",
          reference: `boost:${campaign.id}:${featuredUntil.toISOString()}`,
          metadataJson: stringify({ campaignId: campaign.id, featuredUntil, purchasedUsed })
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "boost";
    redirect(`/campaigns?boost=${encodeURIComponent(reason)}`);
  }
  revalidateTag("campaigns");
  revalidatePath("/campaigns");
  revalidatePath("/profile");
  redirect("/campaigns?boost=ok");
}

export async function convertRubToRpAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const amount = Math.max(1, Math.min(1_000_000, Number(formData.get("amount") || 0)));
  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: user.id, balanceCents: { gte: amount * 100 } },
        data: {
          balanceCents: { decrement: amount * 100 },
          rpBalance: { increment: amount },
          rpPurchasedBalance: { increment: amount }
        }
      });
      if (!result.count) throw new Error("RUB_BALANCE");
      await tx.rpTransaction.create({
        data: {
          userId: user.id,
          amount,
          type: "PURCHASE",
          reference: `rp:purchase:${user.id}:${randomBytes(8).toString("hex")}`,
          metadataJson: stringify({ rubCents: amount * 100 })
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    redirect("/wallet?tab=rp&error=rub_balance");
  }
  revalidatePath("/wallet");
  revalidatePath("/profile");
  redirect("/wallet?tab=rp&converted=1");
}

export async function convertRpToRubAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const amount = Math.max(1, Math.min(1_000_000, Number(formData.get("amount") || 0)));
  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: user.id, rpPurchasedBalance: { gte: amount }, rpBalance: { gte: amount } },
        data: {
          balanceCents: { increment: amount * 100 },
          rpBalance: { decrement: amount },
          rpPurchasedBalance: { decrement: amount }
        }
      });
      if (!result.count) throw new Error("RP_REFUND");
      await tx.rpTransaction.create({
        data: {
          userId: user.id,
          amount: -amount,
          type: "REFUND",
          reference: `rp:refund:${user.id}:${randomBytes(8).toString("hex")}`,
          metadataJson: stringify({ rubCents: amount * 100 })
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    redirect("/wallet?tab=rp&error=rp_refund");
  }
  revalidatePath("/wallet");
  revalidatePath("/profile");
  redirect("/wallet?tab=rp&refunded=1");
}

export async function claimRecurringRewardAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const code = String(formData.get("code") || "");
  const reward = RECURRING_REWARDS.find((item) => item.code === code);
  if (!reward) return { ok: false, error: "Награда не найдена" };
  const stats = await loadAchievementStats(user);
  if ((stats[reward.metric] || 0) < reward.target) return { ok: false, error: "Условие ещё не выполнено" };
  const periodKey = moscowWeekKey();
  const claimed = await prisma.recurringRewardClaim.aggregate({
    where: { userId: user.id, periodKey },
    _sum: { rewardRp: true }
  });
  if ((claimed._sum.rewardRp || 0) + reward.reward > WEEKLY_RP_CAP) return { ok: false, error: "Недельный лимит уже достигнут" };
  try {
    await prisma.$transaction([
      prisma.recurringRewardClaim.create({ data: { userId: user.id, code, periodKey, rewardRp: reward.reward } }),
      prisma.user.update({ where: { id: user.id }, data: { rpBalance: { increment: reward.reward } } }),
      prisma.rpTransaction.create({
        data: {
          userId: user.id,
          amount: reward.reward,
          type: "WEEKLY_REWARD",
          reference: `weekly:${user.id}:${code}:${periodKey}`,
          metadataJson: stringify({ code, periodKey })
        }
      })
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const account = await prisma.user.findUnique({ where: { id: user.id }, select: { rpBalance: true } });
      return { ok: true, claimed: true, already: true, rewardRp: 0, rpBalance: account?.rpBalance || 0 };
    }
    throw error;
  }
  revalidatePath("/profile");
  revalidatePath("/wallet");
  const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { rpBalance: true } });
  return { ok: true, claimed: true, rewardRp: reward.reward, rpBalance: account.rpBalance };
}

export async function markMarketGuideSeenAction() {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { marketGuideSeenAt: new Date() } });
  revalidatePath("/campaigns");
}

export async function reportContentAction(formData: FormData) {
  const user = await requireUser();
  const contentType = String(formData.get("contentType") || "");
  const entityId = String(formData.get("entityId") || "");
  const authorId = String(formData.get("authorId") || "") || undefined;
  const category = String(formData.get("category") || "");
  const categoryLabel = reportReasonLabel(category);
  const details = normalizeRussianReport(String(formData.get("details") || ""));
  if (!["USER", "CAMPAIGN", "SUBMISSION", "CHAT_MESSAGE", "AVATAR"].includes(contentType) || !entityId) {
    redirect("/support");
  }
  const returnTo = safeInternalPath(String(formData.get("returnTo") || "/profile"), "/profile");
  if (!categoryLabel || (category === "OTHER" && !isSafeRussianReport(details)) || authorId === user.id) {
    redirect(`${returnTo}?error=report`);
  }
  const reason = category === "OTHER" ? `${categoryLabel}: ${details}` : categoryLabel;
  const policy = scanContent(reason, "SUPPORT");
  await reportContent({
    reporterId: user.id,
    authorId,
    contentType,
    entityId,
    reason,
    category: policy.category === "NONE" ? `REPORT_${category}` : policy.category
  });
  revalidatePath(returnTo);
  redirect(`${returnTo}?reported=1`);
}

export async function submitDraftAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  requireVerifiedEmail(user);
  if (!canWork(user.role) || await getActiveRoleMode(user) !== "worker") redirect("/campaigns");
  if (!(await rateLimit(`draft-submit:${user.id}`, 8, 60 * 60 * 1000))) redirect("/upload?draft=too_many");

  const submissionId = String(formData.get("submissionId") || "");
  const draftUrl = validateDraftUrl(String(formData.get("draftUrl") || ""));
  const workerNote = String(formData.get("workerNote") || "").trim().slice(0, 500);
  if (!draftUrl) redirect("/upload?draft=bad_url");

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, workerId: user.id },
    include: {
      campaign: { select: { id: true, ownerId: true, title: true, reviewMode: true, maxRevisionRounds: true, draftRequired: true } },
      chatThreads: { select: { id: true }, take: 1 }
    }
  });
  if (!submission || submission.status !== "ACCEPTED") redirect("/upload?draft=closed");
  const revision = nextDraftRevision(submission.draftStatus, submission.draftRevision, submission.campaign.maxRevisionRounds);
  if (revision == null) redirect("/upload?draft=not_editable");

  if (workerNote) {
    const policy = await moderateText({
      text: workerNote,
      contentType: "SUBMISSION",
      authorId: user.id,
      context: "SUPPORT"
    });
    if (policy.action === "BLOCK") redirect("/upload?draft=moderation");
  }

  const decision = initialDraftDecision({ reviewMode: submission.campaign.reviewMode, trustScore: user.trustScore });
  const now = new Date();
  const result = await prisma.$transaction(async (db) => {
    const claimed = await db.submission.updateMany({
      where: {
        id: submission.id,
        workerId: user.id,
        status: "ACCEPTED",
        draftStatus: submission.draftStatus
      },
      data: {
        draftUrl,
        draftStatus: decision,
        draftRevision: revision,
        draftSubmittedAt: now,
        draftReviewedAt: decision === "APPROVED" ? now : null,
        draftReviewNote: decision === "APPROVED" ? "Автопроверка: быстрый режим и высокий рейтинг доверия." : null,
        draftReviewedById: decision === "APPROVED" ? user.id : null,
        publishApprovedAt: decision === "APPROVED" ? now : null
      }
    });
    if (claimed.count !== 1) throw new Error("DRAFT_CHANGED");
    const check = await db.videoCheck.create({
      data: {
        submissionId: submission.id,
        checkType: "DRAFT",
        status: decision === "APPROVED" ? "PASS" : "PENDING",
        score: decision === "APPROVED" ? 100 : 0,
        resultJson: stringify({
          draftUrl,
          workerNote,
          revision,
          reviewMode: submission.campaign.reviewMode,
          autoApproved: decision === "APPROVED",
          submittedAt: now.toISOString()
        })
      }
    });
    if (submission.chatThreads[0]) {
      await db.chatMessage.create({
        data: {
          threadId: submission.chatThreads[0].id,
          senderId: user.id,
          type: "SYSTEM",
          body: decision === "APPROVED"
            ? `Черновик версии ${revision + 1} прошёл быструю проверку. Можно публиковать ролик.`
            : `Черновик версии ${revision + 1} отправлен на проверку. До решения публиковать ролик не нужно.`
        }
      });
    }
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: decision === "APPROVED" ? "DRAFT_AUTO_APPROVED" : "DRAFT_SUBMITTED",
        entity: "Submission",
        entityId: submission.id,
        metadata: stringify({ revision, reviewMode: submission.campaign.reviewMode, checkId: check.id })
      }
    });
    return check;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (decision === "APPROVED") {
    await notify({
      userId: submission.campaign.ownerId,
      groupKey: notificationGroup("draft-approved", submission.id),
      title: "Черновик готов к публикации",
      body: `${user.name} прошёл быструю проверку по заказу «${submission.campaign.title}».`,
      kind: "SUBMISSION",
      href: `/campaigns/${submission.campaign.id}`
    });
  } else if (submission.campaign.reviewMode === "STRICT") {
    await notify({
      userId: submission.campaign.ownerId,
      groupKey: notificationGroup("draft-review", submission.id),
      title: "Черновик ждёт вашего решения",
      body: `${user.name} отправил черновик по заказу «${submission.campaign.title}».`,
      priority: "HIGH",
      kind: "SUBMISSION",
      href: `/campaigns/${submission.campaign.id}`
    });
  } else {
    await notifyModerators(prisma, {
      title: "Новый черновик на проверку",
      body: `Версия ${revision + 1} по заказу «${submission.campaign.title}» ждёт решения.`,
      entityId: result.id,
      metadata: { submissionId: submission.id, reviewMode: submission.campaign.reviewMode, revision }
    });
  }

  await trackEvent({
    userId: user.id,
    type: "DRAFT_SUBMITTED",
    path: "/upload",
    metadata: { submissionId: submission.id, revision, reviewMode: submission.campaign.reviewMode, decision }
  });
  revalidatePath("/upload");
  revalidatePath(`/campaigns/${submission.campaign.id}`);
  redirect(decision === "APPROVED" ? "/upload?draft=approved" : "/upload?draft=pending");
}

export async function reviewDraftAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const submissionId = String(formData.get("submissionId") || "");
  const decision = String(formData.get("decision") || "");
  const note = String(formData.get("note") || "").trim().slice(0, 700);
  const returnTo = safeInternalPath(String(formData.get("returnTo") || ""), "/admin/moderation");
  if (!["approve", "changes", "reject"].includes(decision)) redirect(`${returnTo}?draft=bad_decision`);
  if (decision !== "approve" && note.length < 5) redirect(`${returnTo}?draft=note_required`);

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      worker: { select: { id: true, name: true } },
      campaign: { select: { id: true, title: true, ownerId: true, reviewMode: true, maxRevisionRounds: true } },
      chatThreads: { select: { id: true }, take: 1 }
    }
  });
  if (!submission || submission.draftStatus !== "PENDING" || !submission.draftUrl) redirect(`${returnTo}?draft=closed`);
  const isAdmin = canAccessAdmin(user);
  const strictOwner = submission.campaign.reviewMode === "STRICT" && submission.campaign.ownerId === user.id;
  if (!isAdmin && !strictOwner) redirect("/profile");
  if (decision === "changes" && submission.draftRevision >= submission.campaign.maxRevisionRounds) {
    redirect(`${returnTo}?draft=revision_limit`);
  }

  const nextDraftStatus = decision === "approve"
    ? "APPROVED" as const
    : decision === "changes"
      ? "CHANGES_REQUESTED" as const
      : "REJECTED" as const;
  const now = new Date();
  await prisma.$transaction(async (db) => {
    const claimed = await db.submission.updateMany({
      where: { id: submission.id, draftStatus: "PENDING" },
      data: {
        draftStatus: nextDraftStatus,
        draftReviewedAt: now,
        draftReviewNote: note || "Черновик соответствует брифу.",
        draftReviewedById: user.id,
        publishApprovedAt: decision === "approve" ? now : null,
        ...(decision === "reject" ? { status: "REJECTED" as const } : {})
      }
    });
    if (claimed.count !== 1) throw new Error("DRAFT_CHANGED");
    await db.videoCheck.create({
      data: {
        submissionId: submission.id,
        checkType: "DRAFT_REVIEW",
        status: decision === "approve" ? "PASS" : decision === "changes" ? "NEEDS_CHANGES" : "FAIL",
        score: decision === "approve" ? 100 : decision === "changes" ? 50 : 0,
        resultJson: stringify({
          decision,
          note,
          reviewerId: user.id,
          revision: submission.draftRevision,
          reviewedAt: now.toISOString()
        })
      }
    });
    if (decision === "reject") await releaseSubmissionReservation(db, submission.id);
    if (submission.chatThreads[0]) {
      await db.chatMessage.create({
        data: {
          threadId: submission.chatThreads[0].id,
          senderId: user.id,
          type: "SYSTEM",
          body: decision === "approve"
            ? `Черновик версии ${submission.draftRevision + 1} принят. Можно публиковать.`
            : decision === "changes"
              ? `Нужны изменения в черновике: ${note}`
              : `Черновик отклонён: ${note}`
        }
      });
    }
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: `DRAFT_${nextDraftStatus}`,
        entity: "Submission",
        entityId: submission.id,
        metadata: stringify({ decision, note, revision: submission.draftRevision })
      }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await notify({
    userId: submission.worker.id,
    groupKey: notificationGroup("draft-decision", submission.id),
    title: decision === "approve" ? "Черновик принят" : decision === "changes" ? "Нужны изменения" : "Черновик отклонён",
    body: decision === "approve"
      ? `Можно публиковать ролик по заказу «${submission.campaign.title}».`
      : note,
    priority: decision === "approve" ? "NORMAL" : "HIGH",
    kind: "SUBMISSION",
    href: `/campaigns/${submission.campaign.id}`
  });
  await trackEvent({
    userId: user.id,
    type: `DRAFT_${nextDraftStatus}`,
    path: returnTo,
    metadata: { submissionId: submission.id, revision: submission.draftRevision }
  });
  revalidatePath("/upload");
  revalidatePath("/admin/moderation");
  revalidatePath(`/campaigns/${submission.campaign.id}`);
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}draft=updated`);
}

export async function submitClipAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  if (!canWork(user.role) || await getActiveRoleMode(user) !== "worker") redirect("/campaigns");
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
  if (
    submission.campaign.draftRequired
    && (submission.draftStatus !== "APPROVED" || !submission.publishApprovedAt)
  ) {
    redirect("/upload?draft=approval_required");
  }

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

  // Referral reward is granted here — on a real, non-rejected clip — rather than at signup,

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

  await notify({
    userId: user.id,
    groupKey: notificationGroup("submission-status", submission.id),
    title: status === "REJECTED" ? "Работа требует проверки" : "Работа отправлена",
    body: status === "REJECTED" ? "Ссылка получила высокий fraud score и ушла на ручную проверку." : "Ссылка отправлена на проверку и трекинг просмотров.",
    priority: status === "REJECTED" ? "HIGH" : "NORMAL",
    kind: "SUBMISSION",
    href: `/campaigns/${submission.campaignId}`
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
  requireVerifiedEmail(user);
  if (!canManageClient(user.role) || await getActiveRoleMode(user) !== "client") redirect("/wallet");
  const amountCents = parseRubToCents(formData.get("amount"));
  if (amountCents <= 0) redirect("/wallet?error=amount");
  const provider = String(formData.get("provider") || "");
  if (!isPaymentProvider(provider) || !isPaymentProviderAvailable(provider)) {
    redirect("/wallet?error=payments_unavailable");
  }
  const intent = await createPaymentIntent({ amountCents, userId: user.id, provider, description: "ReelPay deposit" });

  // Fail-closed: a "demo" intent means no real provider processed a payment. Crediting
  // balance for it is only safe in an explicitly enabled test environment. In production
  // this refuses instead of minting unpaid money.
  if (!intent || (intent.mode === "demo" && !demoPaymentsEnabled())) {
    redirect("/wallet?error=payments_unavailable");
  }

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
  await assertAccountActive(user); // frozen/banned/restricted accounts may not move money out
  if (!canWork(user.role) || await getActiveRoleMode(user) !== "worker") redirect("/wallet");
  const amountCents = parseRubToCents(formData.get("amount"));
  if (amountCents <= 0) redirect("/wallet?error=amount");
  const fee = 5000 + Math.round(amountCents * 0.01);
  if (amountCents <= fee) redirect("/wallet?error=amount_too_small");

  // Debit and ledger entry happen in one transaction: the balance can never drop without a
  // matching WITHDRAWAL record (or vice versa). The conditional debit also stops concurrent
  // withdrawals from overdrawing the balance.
  let debited = true;
  await prisma.$transaction(async (db) => {
    const result = await db.user.updateMany({
      where: { id: user.id, balanceCents: { gte: amountCents } },
      data: { balanceCents: { decrement: amountCents } }
    });
    if (result.count === 0) {
      debited = false;
      return;
    }
    await db.transaction.create({
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
  });
  if (!debited) redirect("/wallet?error=balance");
  revalidatePath("/wallet");
  revalidatePath("/profile");
}

export async function syncViewsAction() {
  // View sync runs the settlement engine (mints earnings, releases holds). It must
  // never be triggerable by ordinary users — production sync is driven by the
  // CRON_SECRET-protected /api/sync/views route. Restrict the action to admins.
  const user = await requireUser();
  if (!canAccessAdmin(user)) redirect("/profile");
  await syncMockViews();
  revalidatePath("/campaigns");
  revalidatePath("/profile");
}

export async function sendCollabInviteAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const handle = String(formData.get("handle") || "");
  if (!canManageClient(user.role) || await getActiveRoleMode(user) !== "client") redirect("/campaigns");
  const workerId = String(formData.get("workerId") || "");
  const campaignId = String(formData.get("campaignId") || "");
  const role = String(formData.get("role") || "").trim().slice(0, 80);
  const message = String(formData.get("message") || "").trim().slice(0, 600);
  if (!workerId || workerId === user.id || !campaignId || role.length < 2 || message.length < 3) {
    redirect(`/clippers/${handle}?error=invite`);
  }
  if (!(await rateLimit(`client-collab:${user.id}`, 10, 86_400_000))) {
    redirect(`/profiles/${handle}?error=limit`);
  }
  const policy = await moderateText({ text: message, contentType: "COLLAB", authorId: user.id, context: "PUBLIC" });
  if (policy.action === "BLOCK" || policy.action === "REVIEW") redirect(`/clippers/${handle}?error=moderation`);

  const [worker, campaign] = await Promise.all([
    prisma.user.findUnique({
      where: { id: workerId },
      select: { id: true, role: true, preferredRoleMode: true, collabAvailability: true }
    }),
    prisma.campaign.findFirst({
      where: {
        id: campaignId,
        ownerId: user.id,
        status: { in: ["ACTIVE", "LOW_BUDGET"] },
        deadline: { gt: new Date() }
      },
      select: { id: true, deadline: true }
    })
  ]);
  const workerAccepts = worker && canWork(worker.role) && worker.collabAvailability !== "NONE"
    && (worker.collabAvailability === "BOTH" || worker.preferredRoleMode !== "client");
  if (!workerAccepts || !campaign) redirect(`/profiles/${handle}?error=campaign`);

  const existing = await prisma.collabInvite.findFirst({
    where: { clientId: user.id, workerId, campaignId, status: "PENDING" },
    select: { id: true }
  });
  if (!existing) {
    const invite = await prisma.collabInvite.create({
      data: {
        clientId: user.id,
        workerId,
        initiatorId: user.id,
        campaignId,
        role,
        deadline: campaign.deadline,
        message
      }
    });
    await notify({
      userId: workerId,
      groupKey: notificationGroup("collab-invite", invite.id),
      title: "Приглашение на коллаб",
      body: `${user.name} зовёт на совместный клип`,
      kind: "COLLAB",
      href: `/collabs?invite=${invite.id}`
    });
  }
  revalidatePath(`/clippers/${handle}`);
  redirect(`/clippers/${handle}?invited=1`);
}

export async function sendWorkerPitchAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  requireVerifiedEmail(user);
  if (!canWork(user.role) || await getActiveRoleMode(user) !== "worker") redirect("/campaigns");
  const clientId = String(formData.get("clientId") || "");
  const handle = String(formData.get("handle") || "");
  const role = String(formData.get("role") || "").trim().slice(0, 80);
  const message = String(formData.get("message") || "").trim().slice(0, 600);
  if (!clientId || clientId === user.id || role.length < 2 || message.length < 3) {
    redirect(`/profiles/${handle}?error=invite`);
  }
  if (!(await rateLimit(`worker-pitch:${user.id}`, 10, 86_400_000))) {
    redirect(`/profiles/${handle}?error=limit`);
  }
  const policy = await moderateText({ text: message, contentType: "COLLAB", authorId: user.id, context: "PUBLIC" });
  if (policy.action !== "ALLOW") redirect(`/profiles/${handle}?error=moderation`);
  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: { id: true, role: true, preferredRoleMode: true, collabAvailability: true }
  });
  const accepts = client && canManageClient(client.role) && client.collabAvailability !== "NONE"
    && (client.collabAvailability === "BOTH" || client.preferredRoleMode === "client");
  if (!accepts) redirect(`/profiles/${handle}?error=availability`);
  const existing = await prisma.collabInvite.findFirst({
    where: { clientId, workerId: user.id, initiatorId: user.id, status: "PENDING" },
    select: { id: true }
  });
  if (!existing) {
    const invite = await prisma.collabInvite.create({
      data: {
        clientId,
        workerId: user.id,
        initiatorId: user.id,
        role,
        message,
        deadline: new Date(Date.now() + 14 * 86_400_000)
      }
    });
    await notify({
      userId: clientId,
      groupKey: notificationGroup("collab-invite", invite.id),
      title: "Предложение от исполнителя",
      body: `${user.name} предлагает обсудить сотрудничество. Это ещё не оплаченный заказ.`,
      kind: "COLLAB",
      href: `/collabs?invite=${invite.id}`
    });
  }
  revalidatePath(`/profiles/${handle}`);
  redirect(`/profiles/${handle}?invited=1`);
}

export async function respondCollabInviteAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const inviteId = String(formData.get("inviteId") || "");
  const accept = String(formData.get("decision") || "") === "accept";

  const invite = await prisma.collabInvite.findFirst({
    where: {
      id: inviteId,
      status: { in: ["PENDING", "ACCEPTED"] },
      initiatorId: { not: user.id },
      OR: [{ workerId: user.id }, { clientId: user.id }]
    },
    select: { id: true, clientId: true, workerId: true, initiatorId: true, status: true, chatThread: { select: { id: true } } }
  });
  if (!invite) redirect("/collabs");

  if (accept && invite.status === "ACCEPTED" && invite.chatThread) {
    redirect(`/chats?thread=${invite.chatThread.id}&type=collabs`);
  }
  if (invite.status !== "PENDING") redirect("/collabs");

  if (accept) {
    const thread = await prisma.$transaction(async (tx) => {
      const updated = await tx.collabInvite.updateMany({
        where: { id: invite.id, initiatorId: { not: user.id }, status: "PENDING" },
        data: { status: "ACCEPTED", respondedAt: new Date() }
      });
      if (!updated.count) {
        return tx.chatThread.findUnique({ where: { collabInviteId: invite.id } });
      }
      const created = await tx.chatThread.create({
        data: {
          kind: "COLLAB",
          collabInviteId: invite.id,
          clientId: invite.clientId,
          workerId: invite.workerId,
          messages: {
            create: {
              senderId: user.id,
              type: "SYSTEM",
              body: "Коллаб принят. Обсудите идею, формат и сроки."
            }
          }
        }
      });
      await notify({
        userId: invite.initiatorId,
        groupKey: notificationGroup("collab-response", invite.id),
        title: "Коллаб принят",
        body: `${user.name} принял приглашение. Обсуждение уже открыто.`,
        kind: "COLLAB",
        href: `/chats?thread=${created.id}&type=collabs`
      }, tx);
      return created;
    });
    revalidatePath("/collabs");
    revalidatePath("/chats");
    redirect(`/chats?thread=${thread?.id}&type=collabs`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.collabInvite.update({
      where: { id: invite.id },
      data: { status: "DECLINED", respondedAt: new Date() }
    });
    await notify({
      userId: invite.initiatorId,
      groupKey: notificationGroup("collab-response", invite.id),
      title: "Коллаб отклонён",
      body: `${user.name} отклонил приглашение`,
      kind: "COLLAB",
      href: "/collabs"
    }, tx);
  });
  revalidatePath("/collabs");
  redirect("/collabs");
}

export async function cancelCollabInviteAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const inviteId = String(formData.get("inviteId") || "");
  const invite = await prisma.collabInvite.findFirst({
    where: { id: inviteId, initiatorId: user.id, status: "PENDING" },
    select: { id: true, workerId: true, clientId: true, initiatorId: true }
  });
  const returnTo = safeInternalPath(String(formData.get("returnTo") || "/collabs"), "/collabs");
  if (!invite) redirect(returnTo);
  await prisma.$transaction([
    prisma.collabInvite.update({
      where: { id: invite.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), respondedAt: new Date() }
    }),
    prisma.notification.updateMany({
      where: {
        userId: invite.initiatorId === invite.workerId ? invite.clientId : invite.workerId,
        href: `/collabs?invite=${invite.id}`,
        archivedAt: null
      },
      data: { archivedAt: new Date(), readAt: new Date() }
    })
  ]);
  revalidatePath("/collabs");
  revalidatePath(returnTo);
  revalidatePath("/", "layout");
  redirect(`${returnTo}?cancelled=1`);
}

export async function advanceCollabStageAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const threadId = String(formData.get("threadId") || "");
  const marker = "Условия согласованы. Коллаб перешёл к выполнению.";
  const thread = await prisma.chatThread.findFirst({
    where: {
      id: threadId,
      kind: "COLLAB",
      OR: [{ clientId: user.id }, { workerId: user.id }],
      collabInvite: { status: "ACCEPTED" }
    },
    select: {
      id: true,
      clientId: true,
      workerId: true,
      messages: { where: { type: "SYSTEM", body: marker }, select: { id: true }, take: 1 }
    }
  });
  if (!thread) return { ok: false, error: "Коллаб уже завершён или недоступен." };
  if (thread.messages.length) return { ok: true };

  const peerId = thread.clientId === user.id ? thread.workerId : thread.clientId;
  await prisma.$transaction(async (tx) => {
    await tx.chatMessage.create({
      data: { threadId: thread.id, senderId: user.id, type: "SYSTEM", body: marker }
    });
    await tx.chatThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
    await notify({
      userId: peerId,
      groupKey: notificationGroup("collab-stage", thread.id),
      title: "Коллаб перешёл к выполнению",
      body: `${user.name} подтвердил договорённости. Можно приступать к работе.`,
      kind: "COLLAB",
      href: `/chats?thread=${thread.id}&type=collabs`
    }, tx);
  });
  revalidatePath("/chats");
  revalidatePath("/collabs");
  return { ok: true };
}

export async function attachCollabCampaignAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const inviteId = String(formData.get("inviteId") || "");
  const campaignId = String(formData.get("campaignId") || "");
  const [invite, campaign] = await Promise.all([
    prisma.collabInvite.findFirst({
      where: { id: inviteId, clientId: user.id, status: "ACCEPTED", campaignId: null },
      select: { id: true, chatThread: { select: { id: true } } }
    }),
    prisma.campaign.findFirst({
      where: { id: campaignId, ownerId: user.id, status: { in: ["ACTIVE", "LOW_BUDGET"] }, deadline: { gt: new Date() } },
      select: { id: true, title: true, deadline: true }
    })
  ]);
  if (!invite || !campaign) redirect("/collabs?error=campaign");
  await prisma.$transaction(async (tx) => {
    await tx.collabInvite.update({
      where: { id: invite.id },
      data: { campaignId: campaign.id, deadline: campaign.deadline }
    });
    if (invite.chatThread) {
      await tx.chatMessage.create({
        data: {
          threadId: invite.chatThread.id,
          senderId: user.id,
          type: "SYSTEM",
          body: `К обсуждению прикреплена кампания «${campaign.title}».`
        }
      });
    }
  });
  revalidatePath("/collabs");
  revalidatePath("/chats");
  redirect(invite.chatThread ? `/chats?thread=${invite.chatThread.id}&type=collabs` : "/collabs");
}

export async function endCollabAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const inviteId = String(formData.get("inviteId") || "");
  const invite = await prisma.collabInvite.findFirst({
    where: {
      id: inviteId,
      status: "ACCEPTED",
      OR: [{ clientId: user.id }, { workerId: user.id }]
    },
    select: { id: true, clientId: true, workerId: true, chatThread: { select: { id: true } } }
  });
  if (!invite) redirect("/collabs");
  const peerId = invite.clientId === user.id ? invite.workerId : invite.clientId;
  await prisma.$transaction(async (tx) => {
    await tx.collabInvite.update({
      where: { id: invite.id },
      data: { status: "COMPLETED", endedAt: new Date() }
    });
    if (invite.chatThread) {
      await tx.chatMessage.create({
        data: {
          threadId: invite.chatThread.id,
          senderId: user.id,
          type: "SYSTEM",
          body: "Коллаб завершён. История обсуждения сохранена."
        }
      });
    }
    await notify({
      userId: peerId,
      groupKey: notificationGroup("collab-completed", invite.id),
      title: "Коллаб завершён",
      body: `${user.name} завершил совместный проект`,
      kind: "COLLAB",
      href: invite.chatThread ? `/chats?thread=${invite.chatThread.id}&type=collabs` : "/collabs"
    }, tx);
  });
  revalidatePath("/collabs");
  revalidatePath("/chats");
  redirect("/collabs?ended=1");
}

export async function endorseClipperAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const handle = String(formData.get("handle") || "");
  if (!canManageClient(user.role) || await getActiveRoleMode(user) !== "client") redirect("/campaigns");
  const workerId = String(formData.get("workerId") || "");
  const note = String(formData.get("note") || "").trim().slice(0, 200) || null;
  if (!workerId || workerId === user.id) redirect(`/clippers/${handle}`);
  if (note) {
    const policy = await moderateText({ text: note, contentType: "ENDORSEMENT", authorId: user.id, context: "PUBLIC" });
    if (policy.action === "BLOCK" || policy.action === "REVIEW") redirect(`/clippers/${handle}?error=moderation`);
  }

  // Only "large" clients (by order count) may endorse.
  const orders = await prisma.campaign.count({ where: { ownerId: user.id } });
  if (!canEndorse(orders)) redirect(`/clippers/${handle}?error=tier`);

  await prisma.endorsement.upsert({
    where: { clientId_workerId: { clientId: user.id, workerId } },
    update: { note },
    create: { clientId: user.id, workerId, note }
  });
  await notify({
    userId: workerId,
    groupKey: notificationGroup("endorsement", user.id),
    title: "Вас рекомендуют",
    body: `${user.name} рекомендует вас как клиппера`,
    priority: "HIGH",
    kind: "ENDORSEMENT",
    href: `/clippers/${handle}`
  });
  revalidatePath(`/clippers/${handle}`);
  redirect(`/clippers/${handle}?endorsed=1`);
}

export async function rateCompletedSubmissionAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  const submissionId = String(formData.get("submissionId") || "");
  const score = Number(formData.get("score"));
  const comment = String(formData.get("comment") || "").trim().slice(0, 500) || null;
  const returnTo = safeInternalPath(String(formData.get("returnTo") || ""), "/campaigns");

  if (!submissionId || !Number.isInteger(score) || score < 1 || score > 5) {
    redirect(`${returnTo}?rating=invalid`);
  }
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      status: true,
      workerId: true,
      worker: { select: { handle: true } },
      campaign: { select: { ownerId: true, owner: { select: { handle: true } } } }
    }
  });
  if (!submission) redirect(`${returnTo}?rating=unavailable`);
  const parties = ratingParties({
    authorId: user.id,
    ownerId: submission.campaign.ownerId,
    workerId: submission.workerId,
    status: submission.status
  });
  if (!parties) redirect(`${returnTo}?rating=forbidden`);
  const { subjectId, authorRole } = parties;
  const subjectHandle = authorRole === "CLIENT" ? submission.worker.handle : submission.campaign.owner.handle;
  if (comment) {
    const policy = await moderateText({
      text: comment,
      contentType: "RATING",
      authorId: user.id,
      context: "PUBLIC",
      payload: { submissionId, subjectId }
    });
    if (policy.action === "BLOCK" || policy.action === "REVIEW") redirect(`${returnTo}?rating=moderation`);
  }

  await prisma.userRating.upsert({
    where: { submissionId_authorId: { submissionId, authorId: user.id } },
    create: {
      submissionId,
      authorId: user.id,
      subjectId,
      authorRole,
      score,
      comment
    },
    update: { score, comment }
  });
  await notify({
    userId: subjectId,
    groupKey: notificationGroup("rating", `${submissionId}:${user.id}`),
    title: "Новая оценка",
    body: `${user.name} поставил вам ${score} из 5`,
    kind: "RATING",
    href: `/profiles/${subjectHandle}`
  });
  revalidatePath(returnTo);
  revalidatePath(`/profiles/${subjectHandle}`);
  redirect(`${returnTo}?rating=saved`);
}
