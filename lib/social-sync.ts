import { prisma } from "@/lib/prisma";
import { commissionRate } from "@/lib/money";
import { stringify } from "@/lib/json";
import { viewProviders, type ViewPlatform } from "@/lib/view-providers";

function canUseProvider(platform: string): platform is ViewPlatform {
  return platform === "YOUTUBE" || platform === "VK" || platform === "TIKTOK" || platform === "INSTAGRAM";
}

export async function syncMockViews() {
  const submissions = await prisma.submission.findMany({
    include: { campaign: true, worker: true },
    where: { status: { in: ["POSTED", "VERIFIED", "THRESHOLD_MET", "SETTLING"] } },
    orderBy: { createdAt: "asc" },
    take: 200
  });

  const updates = [];

  for (const submission of submissions) {
    let providerMode = "demo";
    let velocity = 1800 + Math.floor(Math.random() * 38000);
    let views = submission.currentViews + velocity;
    let likes = submission.currentLikes + Math.floor(velocity * (0.035 + Math.random() * 0.04));
    let comments = submission.currentComments + Math.floor(velocity * (0.001 + Math.random() * 0.005));

    if (canUseProvider(submission.platform)) {
      try {
        const snapshot = await viewProviders[submission.platform].fetchSnapshot(submission.postUrl);
        providerMode = "api";
        views = Math.max(submission.currentViews, snapshot.views);
        likes = Math.max(submission.currentLikes, snapshot.likes || 0);
        comments = Math.max(submission.currentComments, snapshot.comments || 0);
        velocity = Math.max(0, views - submission.currentViews);
      } catch (error) {
        providerMode = `fallback:${error instanceof Error ? error.message : "unknown"}`;
      }
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
      const gross = Math.floor((views / 1000) * submission.campaign.cpmRateCents);
      const fee = Math.floor(gross * commissionRate(submission.worker.rank));
      const net = gross - fee;
      await prisma.transaction.create({
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
      });
      await prisma.user.update({
        where: { id: submission.workerId },
        data: {
          holdBalanceCents: { increment: net },
          lifetimeViews: { increment: velocity }
        }
      });
    }

    updates.push(updated);
  }

  return { synced: updates.length, submissions: updates };
}
