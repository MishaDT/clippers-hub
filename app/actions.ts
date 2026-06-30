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
import { parseRubToCents } from "@/lib/money";
import { createPaymentIntent } from "@/lib/payments";
import { syncMockViews } from "@/lib/social-sync";
import { notifyModerators } from "@/lib/video-checks";
import { canUseRoleMode, getActiveRoleMode, ROLE_MODE_COOKIE, type RoleMode } from "@/lib/role-mode";
import { assertAccountActive, moderateText, reportContent } from "@/lib/moderation";
import { moscowWeekKey, RECURRING_REWARDS, splitRpSpend, WEEKLY_RP_CAP } from "@/lib/rp";
import { scanContent } from "@/lib/content-policy";
import { isSafeRussianReport, normalizeRussianReport, reportReasonLabel } from "@/lib/report-reasons";
import { notificationGroup, notify } from "@/lib/notifications";
import { awardReferralSignup } from "@/lib/referrals";
import { safeReturnTo } from "@/lib/navigation";

function safeCheckoutUrl(url: string | undefined) {
  if (!url) return "/wallet?deposit=ok";
  if (url.startsWith("/")) return url;
  try {
    const host = new URL(url).hostname;
    if (host.endsWith("stripe.com") || host.endsWith("checkout.stripe.com") || host.endsWith("yookassa.ru") || host.endsWith("yoomoney.ru")) return url;
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
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function createCampaignAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  if (!canManageClient(user.role) || await getActiveRoleMode(user) !== "client") redirect("/campaigns");
  if (formData.get("rightsConfirmed") !== "on") redirect("/campaigns/new?error=rights");

  const budget = parseRubToCents(formData.get("budget"));
  const cpm = parseRubToCents(formData.get("cpm"));
  const platforms = formData.getAll("platforms").map(String).filter((item) => ["TIKTOK", "YOUTUBE", "INSTAGRAM", "VK"].includes(item));
  const deadlineDays = Math.max(1, Number(formData.get("deadlineDays") || 7));
  const sourcePlatform = String(formData.get("sourcePlatform") || "TWITCH");
  const requestedVisibility = String(formData.get("visibility") || "PUBLIC");
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
  if (campaignPolicy.action !== "ALLOW") redirect("/campaigns/new?error=moderation");

  const totalBudgetCents = budget || 5000000;

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
            deliverableCount: Math.max(1, Math.min(20, Number(formData.get("deliverableCount") || 1))),
            clipDuration: String(formData.get("clipDuration") || "30-60"),
            aspectRatio: String(formData.get("aspectRatio") || "9:16"),
            style: String(formData.get("style") || "dynamic").slice(0, 40),
            language: String(formData.get("language") || "ru").slice(0, 12),
            subtitles: String(formData.get("subtitles") || "required").slice(0, 30),
            cta: String(formData.get("cta") || "").trim().slice(0, 180),
            mustInclude: String(formData.get("mustInclude") || "").trim().slice(0, 400),
            exampleUrls: String(formData.get("exampleUrls") || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 3),
            rightsConfirmed: formData.get("rightsConfirmed") === "on"
          }),
          cpmRateCents: cpm || 4500,
          viewThreshold: Number(formData.get("viewThreshold") || 10000),
          totalBudgetCents,
          remainingBudgetCents: totalBudgetCents,
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
  redirect(`/campaigns/${campaign.id}`);
}

export async function joinCampaignAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
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
    await prisma.$transaction(async (tx) => {
    const submission = await tx.submission.create({
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
            body: "Исполнитель взял заказ. Здесь можно уточнить детали и прислать вопросы по ролику."
          }
        }
      }
    });
    });
  } catch (error) {
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
  revalidatePath("/upload");
  revalidatePath("/profile");
  redirect("/upload");
}

export async function sendChatMessageAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
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
  // so fake accounts can't farm referral RP. awardReferralSignup is idempotent per invitee.
  if (status !== "REJECTED" && user.referredBy) {
    try {
      await prisma.$transaction((tx) => awardReferralSignup(tx, { id: user.id, name: user.name, referredBy: user.referredBy }));
    } catch {
      // never block a submission on referral bookkeeping
    }
  }

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
  if (!canManageClient(user.role) || await getActiveRoleMode(user) !== "client") redirect("/wallet");
  const amountCents = parseRubToCents(formData.get("amount"));
  if (amountCents <= 0) redirect("/wallet?error=amount");
  const provider = String(formData.get("provider") || "yookassa") as "yookassa" | "stripe";
  const intent = await createPaymentIntent({ amountCents, userId: user.id, provider, description: "ReelPay deposit" });

  // Fail-closed: a "demo" intent means no real provider processed a payment. Crediting
  // balance for it is only safe in an explicitly enabled test environment. In production
  // this refuses instead of minting unpaid money.
  if (intent.mode === "demo" && !demoPaymentsEnabled()) {
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
  const message = String(formData.get("message") || "").trim().slice(0, 600);
  if (!workerId || workerId === user.id || message.length < 3) redirect(`/clippers/${handle}?error=invite`);
  const policy = await moderateText({ text: message, contentType: "COLLAB", authorId: user.id, context: "PUBLIC" });
  if (policy.action !== "ALLOW") redirect(`/clippers/${handle}?error=moderation`);

  const worker = await prisma.user.findUnique({ where: { id: workerId }, select: { id: true } });
  if (!worker) redirect("/leaderboard");

  const existing = await prisma.collabInvite.findFirst({
    where: { clientId: user.id, workerId, status: "PENDING" },
    select: { id: true }
  });
  if (!existing) {
    const invite = await prisma.collabInvite.create({ data: { clientId: user.id, workerId, message } });
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

export async function respondCollabInviteAction(formData: FormData) {
  const user = await requireUser();
  await assertAccountActive(user);
  if (!canWork(user.role) || await getActiveRoleMode(user) !== "worker") redirect("/campaigns");
  const inviteId = String(formData.get("inviteId") || "");
  const accept = String(formData.get("decision") || "") === "accept";

  const invite = await prisma.collabInvite.findFirst({
    where: { id: inviteId, workerId: user.id },
    select: { id: true, clientId: true, workerId: true, status: true, chatThread: { select: { id: true } } }
  });
  if (!invite) redirect("/collabs");

  if (accept && invite.status === "ACCEPTED" && invite.chatThread) {
    redirect(`/chats?thread=${invite.chatThread.id}&type=collabs`);
  }
  if (invite.status !== "PENDING") redirect("/collabs");

  if (accept) {
    const thread = await prisma.$transaction(async (tx) => {
      const updated = await tx.collabInvite.updateMany({
        where: { id: invite.id, workerId: user.id, status: "PENDING" },
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
        userId: invite.clientId,
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
      userId: invite.clientId,
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
    where: { id: inviteId, clientId: user.id, status: "PENDING" },
    select: { id: true, workerId: true }
  });
  const returnTo = safeInternalPath(String(formData.get("returnTo") || "/collabs"), "/collabs");
  if (!invite) redirect(returnTo);
  await prisma.$transaction([
    prisma.collabInvite.update({
      where: { id: invite.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), respondedAt: new Date() }
    }),
    prisma.notification.updateMany({
      where: { userId: invite.workerId, href: `/collabs?invite=${invite.id}`, archivedAt: null },
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
    if (policy.action !== "ALLOW") redirect(`/clippers/${handle}?error=moderation`);
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
