import { prisma } from "@/lib/prisma";
import { commissionRate } from "@/lib/money";
import { stringify } from "@/lib/json";
import { viewProviders, type ViewPlatform } from "@/lib/view-providers";

function canUseProvider(platform: string): platform is ViewPlatform {
  return platform === "YOUTUBE" || platform === "VK" || platform === "TIKTOK" || platform === "INSTAGRAM";
}

function allowDemoSync() {
  return process.env.DEMO_VIEW_SYNC === "1" || process.env.DEMO_VIEW_SYNC === "true";
}

async function settlePendingEarnings() {
  const settlementCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const pending = await prisma.transaction.findMany({
    where: {
      type: "EARNING",
      status: "PENDING",
      createdAt: { lte: settlementCutoff },
      submissionId: { not: null }
    },
    include: { submission: true },
    take: 100
  });

  let released = 0;
  for (const tx of pending) {
    if (!tx.submission || tx.submission.fraudScore >= 70 || tx.submission.status === "REJECTED") continue;
    await prisma.$transaction([
      prisma.transaction.update({ where: { id: tx.id }, data: { status: "COMPLETED" } }),
      prisma.submission.update({ where: { id: tx.submission.id }, data: { status: "PAID", paidAt: new Date() } }),
      prisma.user.update({
        where: { id: tx.userId },
        data: {
          holdBalanceCents: { decrement: tx.netCents },
          balanceCents: { increment: tx.netCents }
        }
      })
    ]);
    released += 1;
  }
  return released;
}

export async function syncViews() {
  const submissions = await prisma.submission.findMany({
    include: { campaign: true, worker: true },
    where: { status: { in: ["POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING"] } },
    orderBy: { createdAt: "asc" },
    take: 200
  });

  const updates = [];
  let skipped = 0;
  let apiSynced = 0;
  let demoSynced = 0;

  for (const submission of submissions) {
    let providerMode = "skip";
    let velocity = 0;
    let views = submission.currentViews;
    let likes = submission.currentLikes;
    let comments = submission.currentComments;

    if (canUseProvider(submission.platform)) {
      try {
        const snapshot = await viewProviders[submission.platform].fetchSnapshot(submission.postUrl);
        providerMode = "api";
        views = Math.max(submission.currentViews, snapshot.views);
        likes = Math.max(submission.currentLikes, snapshot.likes || 0);
        comments = Math.max(submission.currentComments, snapshot.comments || 0);
        velocity = Math.max(0, views - submission.currentViews);
        apiSynced += 1;
      } catch (error) {
        providerMode = `fallback:${error instanceof Error ? error.message : "unknown"}`;
      }
    }

    if (providerMode !== "api" && allowDemoSync()) {
      providerMode = providerMode === "skip" ? "demo" : `${providerMode}:demo`;
      velocity = 1800 + Math.floor(Math.random() * 38000);
      views = submission.currentViews + velocity;
      likes = submission.currentLikes + Math.floor(velocity * (0.035 + Math.random() * 0.04));
      comments = submission.currentComments + Math.floor(velocity * (0.001 + Math.random() * 0.005));
      demoSynced += 1;
    }

    if (providerMode !== "api" && !allowDemoSync()) {
      skipped += 1;
      continue;
    }

    const ratio = likes === 0 ? 999 : views / likes;
    const fraudScore = Math.min(96, Math.max(4, Math.round(ratio > 200 ? 75 : 8 + Math.random() * 24)));
    const status =
      fraudScore >= 70
        ? "REJECTED"
        : views >= submission.campaign.viewThreshold && submission.status !== "SETTLING"
          ? "THRESHOLD_MET"
          : submission.status === "THRESHOLD_MET"
            ? "SETTLING"
            : submission.status;

    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        currentViews: views,
        currentLikes: likes,
        currentComments: comments,
        peakViews: Math.max(views, submission.peakViews),
        fraudScore,
        status,
        lastSyncedAt: new Date(),
        viewVelocityJson: stringify([
          ...JSON.parse(submission.viewVelocityJson || "[]").slice(-20),
          { at: new Date().toISOString(), from: submission.currentViews, to: views, mode: providerMode }
        ])
      }
    });

    if (status === "SETTLING" && submission.status === "THRESHOLD_MET") {
      const existingEarning = await prisma.transaction.findFirst({ where: { submissionId: submission.id, type: "EARNING" } });
      if (existingEarning) {
        updates.push(updated);
        continue;
      }
      const gross = Math.floor((views / 1000) * submission.campaign.cpmRateCents);
      const fee = Math.floor(gross * commissionRate(submission.worker.rank));
      const net = gross - fee;
      await prisma.$transaction([
        prisma.transaction.create({
          data: {
            userId: submission.workerId,
            submissionId: submission.id,
            amountCents: gross,
            feeCents: fee,
            netCents: net,
            type: "EARNING",
            status: "PENDING",
            providerData: stringify({ settlementHours: 48, fraudScore })
          }
        }),
        prisma.user.update({
          where: { id: submission.workerId },
          data: {
            holdBalanceCents: { increment: net },
            lifetimeViews: { increment: velocity }
          }
        }),
        prisma.campaign.update({
          where: { id: submission.campaignId },
          data: {
            remainingBudgetCents: { decrement: Math.min(gross, Math.max(0, submission.campaign.remainingBudgetCents)) },
            status: submission.campaign.remainingBudgetCents - gross <= 0 ? "PAUSED" : submission.campaign.remainingBudgetCents - gross < submission.campaign.totalBudgetCents * 0.2 ? "LOW_BUDGET" : submission.campaign.status
          }
        })
      ]);
    }

    updates.push(updated);
  }

  const released = await settlePendingEarnings();
  return { synced: updates.length, apiSynced, demoSynced, skipped, released, submissions: updates };
}

export const syncMockViews = syncViews;
