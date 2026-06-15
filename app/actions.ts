"use server";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canManageClient, canWork, createSession, destroySession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { parseRubToCents } from "@/lib/money";
import { createPaymentIntent } from "@/lib/payments";
import { stringify } from "@/lib/json";
import { syncMockViews } from "@/lib/social-sync";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  handle: z.string().min(3).regex(/^[a-z0-9_]+$/i),
  role: z.enum(["CLIENT", "WORKER", "BOTH"])
});

export async function registerAction(formData: FormData) {
  const input = registerSchema.parse(Object.fromEntries(formData));
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      handle: input.handle.toLowerCase(),
      role: input.role,
      referralCode: input.handle.toUpperCase().slice(0, 12)
    }
  });
  await createSession(user.id);
  redirect(input.role === "CLIENT" ? "/client" : "/clipper");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=bad_credentials");
  }
  await createSession(user.id);
  redirect(user.role === "CLIENT" ? "/client" : user.role === "ADMIN" ? "/admin" : "/clipper");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function switchRoleAction(formData: FormData) {
  const user = await requireUser();
  const nextRole = String(formData.get("role"));
  if (!["CLIENT", "WORKER", "BOTH"].includes(nextRole)) redirect("/profile");
  await prisma.user.update({ where: { id: user.id }, data: { role: nextRole as "CLIENT" | "WORKER" | "BOTH" } });
  revalidatePath("/profile");
  revalidatePath("/clipper");
  revalidatePath("/client");
  redirect("/profile");
}

export async function createCampaignAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageClient(user.role)) redirect("/client?error=role");

  const budget = parseRubToCents(formData.get("budget"));
  const cpm = parseRubToCents(formData.get("cpm"));
  const platforms = formData.getAll("platforms").map(String);
  const trackingPrefix = `ch_${String(formData.get("trackingPrefix") || "CPV").replace(/[^a-z0-9_]/gi, "").toUpperCase().slice(0, 8)}_${Math.floor(Math.random() * 90 + 10)}`;

  const campaign = await prisma.campaign.create({
    data: {
      ownerId: user.id,
      title: String(formData.get("title") || "Новая CPV-кампания"),
      description: String(formData.get("description") || ""),
      sourceUrl: String(formData.get("sourceUrl") || ""),
      sourcePlatform: String(formData.get("sourcePlatform") || "TWITCH") as "YOUTUBE",
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
      visibility: String(formData.get("visibility") || "PUBLIC") as "PUBLIC",
      trackingPrefix,
      deadline: new Date(String(formData.get("deadline") || new Date(Date.now() + 14 * 86400000).toISOString())),
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
  redirect(`/campaigns/${campaign.id}`);
}

export async function joinCampaignAction(formData: FormData) {
  const user = await requireUser();
  if (!canWork(user.role)) redirect("/clipper?error=role");
  const campaignId = String(formData.get("campaignId"));
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
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
  revalidatePath("/clipper");
  redirect("/clipper");
}

export async function submitClipAction(formData: FormData) {
  const user = await requireUser();
  const submissionId = String(formData.get("submissionId"));
  const postUrl = String(formData.get("postUrl") || "");
  const platform = String(formData.get("platform") || "TIKTOK") as "TIKTOK";
  const videoFile = formData.get("videoFile");
  let localVideoPath = "";

  if (videoFile instanceof File && videoFile.size > 0) {
    const extension = videoFile.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "mp4";
    const fileName = `${randomUUID()}.${extension}`;
    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, fileName), Buffer.from(await videoFile.arrayBuffer()));
    localVideoPath = `/uploads/${fileName}`;
  }

  await prisma.submission.update({
    where: { id: submissionId, workerId: user.id },
    data: {
      postUrl: postUrl || localVideoPath,
      platform,
      platformPostId: localVideoPath || postUrl.split("/").pop() || `post_${Date.now()}`,
      status: "POSTED",
      verifiedAt: new Date()
    }
  });
  await prisma.notification.create({
    data: {
      userId: user.id,
      title: "Работа отправлена",
      body: localVideoPath ? "Видео сохранено локально, ссылка отправлена на проверку." : "Ссылка отправлена на проверку и трекинг.",
      channel: "in-app",
      priority: "MED"
    }
  });
  revalidatePath("/clipper");
  revalidatePath("/upload");
  revalidatePath("/profile");
  redirect("/upload?sent=1");
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
  const provider = String(formData.get("provider") || "yookassa") as "yookassa" | "stripe";
  const intent = await createPaymentIntent({ amountCents, userId: user.id, provider, description: "Clippers Hub deposit" });
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
  redirect(intent.checkoutUrl);
}

export async function withdrawAction(formData: FormData) {
  const user = await requireUser();
  const amountCents = parseRubToCents(formData.get("amount"));
  if (amountCents <= 0 || amountCents > user.balanceCents) redirect("/wallet?error=balance");
  const fee = 5000 + Math.round(amountCents * 0.01);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { balanceCents: { decrement: amountCents } } }),
    prisma.transaction.create({
      data: {
        userId: user.id,
        amountCents,
        feeCents: fee,
        netCents: Math.max(0, amountCents - fee),
        type: "WITHDRAWAL",
        status: "PENDING",
        providerData: stringify({ fixedFeeCents: 5000, percentFee: 0.01 })
      }
    })
  ]);
  revalidatePath("/wallet");
}

export async function syncViewsAction() {
  await requireUser();
  await syncMockViews();
  revalidatePath("/campaigns");
  revalidatePath("/clipper");
  revalidatePath("/client");
  revalidatePath("/admin");
}
