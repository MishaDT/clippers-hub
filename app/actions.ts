"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";
import { canManageClient, canWork, destroySession, getCurrentUser, requireUser } from "@/lib/auth";
import { extractPlatformPostId, scoreSubmissionFraud } from "@/lib/fraud";
import { stringify } from "@/lib/json";
import { parseRubToCents } from "@/lib/money";
import { createPaymentIntent } from "@/lib/payments";
import { syncMockViews } from "@/lib/social-sync";

function safeCheckoutUrl(url: string | undefined) {
  if (!url) return "/wallet?deposit=ok";
  if (url.startsWith("/")) return url;
  try {
    const host = new URL(url).hostname;
    if (host.endsWith("stripe.com") || host.endsWith("checkout.stripe.com") || host.endsWith("yookassa.ru") || host.endsWith("yoomoney.ru")) return url;
  } catch {}
  return "/wallet?deposit=blocked";
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
  const platforms = formData.getAll("platforms").map(String);
  const deadlineDays = Math.max(1, Number(formData.get("deadlineDays") || 7));
  const sourcePlatform = String(formData.get("sourcePlatform") || "TWITCH");
  const visibility = String(formData.get("visibility") || "PUBLIC");
  const trackingPrefix = `ch_${String(formData.get("trackingPrefix") || "CPV").replace(/[^a-z0-9_]/gi, "").toUpperCase().slice(0, 8)}_${Math.floor(Math.random() * 90 + 10)}`;

  const campaign = await prisma.campaign.create({
    data: {
      ownerId: user.id,
      title: String(formData.get("title") || "Новая CPV-кампания"),
      description: String(formData.get("description") || ""),
      sourceUrl: String(formData.get("sourceUrl") || ""),
      sourcePlatform: (["YOUTUBE", "TIKTOK", "INSTAGRAM", "VK", "TWITCH"].includes(sourcePlatform) ? sourcePlatform : "TWITCH") as "YOUTUBE",
      allowedPlatformsJson: stringify(platforms.length ? platforms : ["TIKTOK", "YOUTUBE", "INSTAGRAM", "VK"]),
      rulesJson: stringify({
        requiredTags: String(formData.get("requiredTags") || "").split(",").map((item) => item.trim()).filter(Boolean),
        bans: String(formData.get("bans") || "").split(",").map((item) => item.trim()).filter(Boolean),
        watermarkBonus: formData.get("watermarkBonus") === "on"
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
  await prisma.submission.create({
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
  revalidatePath("/upload");
  revalidatePath("/profile");
  redirect("/upload");
}

export async function submitClipAction(formData: FormData) {
  const user = await requireUser();
  const submissionId = String(formData.get("submissionId"));
  const postUrl = String(formData.get("postUrl") || "").trim();
  const platformInput = String(formData.get("platform") || "TIKTOK");
  const platform = (["TIKTOK", "YOUTUBE", "INSTAGRAM", "VK"].includes(platformInput) ? platformInput : "TIKTOK") as "TIKTOK" | "YOUTUBE" | "INSTAGRAM" | "VK";

  const [submission, duplicate, recentSubmissions] = await Promise.all([
    prisma.submission.findFirstOrThrow({ where: { id: submissionId, workerId: user.id } }),
    prisma.submission.findFirst({ where: { postUrl, NOT: { id: submissionId } }, select: { id: true } }),
    prisma.submission.findMany({ where: { workerId: user.id }, orderBy: { createdAt: "desc" }, take: 20 })
  ]);

  const fraud = scoreSubmissionFraud({ postUrl, platform, user, duplicateUrl: Boolean(duplicate), recentSubmissions });
  const status = fraud.score >= 75 ? "REJECTED" : "POSTED";

  await prisma.submission.update({
    where: { id: submissionId, workerId: user.id },
    data: {
      postUrl,
      platform,
      platformPostId: extractPlatformPostId(postUrl),
      status,
      fraudScore: fraud.score,
      verifiedAt: status === "POSTED" ? new Date() : null,
      viewVelocityJson: stringify([{ at: new Date().toISOString(), event: "submitted", fraudScore: fraud.score, reasons: fraud.reasons }])
    }
  });

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
      metadata: stringify({ platform, postUrl, fraudScore: fraud.score, reasons: fraud.reasons })
    }
  });

  await trackEvent({
    userId: user.id,
    type: status === "REJECTED" ? "SUBMISSION_FLAGGED" : "SUBMISSION_POSTED",
    path: "/upload",
    provider: platform.toLowerCase(),
    metadata: { submissionId, fraudScore: fraud.score, reasons: fraud.reasons }
  });

  revalidatePath("/upload");
  revalidatePath("/profile");
  redirect(status === "REJECTED" ? "/upload?flagged=1" : "/upload?sent=1");
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
