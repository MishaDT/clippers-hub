import { prisma } from "@/lib/prisma";
import { commissionRate } from "@/lib/money";
import { stringify } from "@/lib/json";
import { viewProviders, type ViewPlatform } from "@/lib/view-providers";
import { checkOwnership, platformIsVerifiable, type OwnershipResult } from "@/lib/antifraud";
import { trackEvent } from "@/lib/analytics";

function canUseProvider(platform: string): platform is ViewPlatform {
  return platform === "YOUTUBE" || platform === "VK" || platform === "TIKTOK" || platform === "INSTAGRAM";
}

function allowDemoSync() {
  return process.env.DEMO_VIEW_SYNC === "1" || process.env.DEMO_VIEW_SYNC === "true";
}

// One OWNERSHIP VideoCheck row per submission, upserted to reflect the latest result.
async function recordOwnershipCheck(submissionId: string, status: "PASS" | "FAIL", proof: OwnershipResult) {
  const data = {
    checkType: "OWNERSHIP",
    status,
    score: status === "PASS" ? 100 : 0,
    resultJson: stringify({
      reason: proof.reason,
      verifiable: proof.verifiable,
      evidence: proof.evidence,
      checkedAt: new Date().toISOString()
    })
  };
  const existing = await prisma.videoCheck.findFirst({
    where: { submissionId, checkType: "OWNERSHIP" },
    select: { id: true }
  });
  if (existing) {
    await prisma.videoCheck.update({ where: { id: existing.id }, data });
  } else {
    await prisma.videoCheck.create({ data: { submissionId, ...data } });
  }
}

async function settlePendingEarnings() {
  const settlementCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const pending = await prisma.transaction.findMany({
    where: {
      type: "EARNING",
      status: "PENDING",
      createdAt: { lte: settlementCutoff },
      submissionId: { not: null },
      submission: {
        disputes: {
          none: { status: "OPEN" }
        }
      }
    },
    include: { submission: true },
    take: 100
  });

  let released = 0;
  for (const tx of pending) {
    if (!tx.submission || tx.submission.fraudScore >= 70 || tx.submission.status === "REJECTED") continue;
    // Final ownership gate before money actually leaves hold: never release if the
    // latest tracking-code check on this clip failed.
    const ownershipFail = await prisma.videoCheck.findFirst({
      where: { submissionId: tx.submission.id, checkType: "OWNERSHIP", status: "FAIL" },
      select: { id: true }
    });
    if (ownershipFail) continue;
    const submissionId = tx.submission.id;
    // Atomic claim: only the run that flips this earning PENDING -> COMPLETED moves the
    // money out of hold. Concurrent settlement passes that lose the race update 0 rows and
    // release nothing, so a single earning can never be paid out twice.
    const releasedOk = await prisma.$transaction(async (db) => {
      const openDispute = await db.disputeCase.findFirst({
        where: { submissionId, status: "OPEN" },
        select: { id: true }
      });
      if (openDispute) return false;
      const claim = await db.transaction.updateMany({
        where: { id: tx.id, status: "PENDING" },
        data: { status: "COMPLETED" }
      });
      if (claim.count === 0) return false;
      await db.submission.update({ where: { id: submissionId }, data: { status: "PAID", paidAt: new Date() } });
      await db.user.update({
        where: { id: tx.userId },
        data: {
          holdBalanceCents: { decrement: tx.netCents },
          balanceCents: { increment: tx.netCents }
        }
      });
      return true;
    }, { isolationLevel: "Serializable" });
    if (releasedOk) released += 1;
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

    // Don't skip a submission that already reached the goal (e.g. via manual admin
    // verification on TikTok/Instagram, which has no metrics API) — it still needs the
    // settlement mint below to pay out through the reserved budget.
    if (providerMode !== "api" && !allowDemoSync() && submission.status !== "THRESHOLD_MET") {
      skipped += 1;
      continue;
    }

    // Demo (randomised) views are for a sandbox showcase only. In production they may animate
    // the counter for display, but must NEVER verify a clip or drive a real payout from real
    // escrow. Guard both the earning transition and the verified flag.
    const demoInProd = providerMode.includes("demo") && process.env.NODE_ENV === "production";

    const ratio = likes === 0 ? 999 : views / likes;
    let fraudScore = Math.min(96, Math.max(4, Math.round(ratio > 200 ? 75 : 8 + Math.random() * 24)));

    // ---- Ownership gate ----------------------------------------------------
    // A clip may only advance toward payout once we've confirmed its tracking
    // code is present in the published video's description (proves the clipper
    // owns it). We re-verify on every cycle up to SETTLING, so removing the code
    // after the fact also freezes the money.
    // Keep checking during the 48-hour settlement window. Removing the code
    // after reaching the threshold must freeze the pending payout.
    const lockedIn = submission.status === "PAID";
    let ownershipOk = lockedIn;
    let ownershipNote = lockedIn ? "locked_in" : "unverified";

    if (!ownershipOk) {
      if (providerMode.includes("demo")) {
        ownershipOk = true; // sandbox economy — no real platform to check against
        ownershipNote = "demo_bypass";
      } else if (platformIsVerifiable(submission.platform)) {
        const proof = await checkOwnership({
          platform: submission.platform,
          postUrl: submission.postUrl,
          trackingCode: submission.trackingCode
        });
        if (proof.matched) {
          ownershipOk = true;
          ownershipNote = "code_found";
          fraudScore = Math.min(fraudScore, 30);
          await recordOwnershipCheck(submission.id, "PASS", proof);
        } else if (proof.reason.startsWith("fetch_failed")) {
          ownershipNote = proof.reason; // transient (quota/private/deleted) — hold, no penalty
        } else {
          ownershipNote = "code_missing"; // genuinely absent — flag, block earning, allow recovery
          fraudScore = Math.max(fraudScore, 60);
          await recordOwnershipCheck(submission.id, "FAIL", proof);
        }
      } else {
        // TikTok / Instagram have no public metadata — require a manual moderator pass.
        const manual = await prisma.videoCheck.findFirst({
          where: { submissionId: submission.id, checkType: "OWNERSHIP", status: "PASS" },
          select: { id: true }
        });
        ownershipOk = Boolean(manual);
        ownershipNote = manual ? "manual_pass" : "awaiting_manual_ownership";
      }
    }

    const reachedThreshold = views >= submission.campaign.viewThreshold;
    let status = submission.status;
    if (fraudScore >= 70) {
      status = "REJECTED";
    } else if (!ownershipOk || demoInProd) {
      status = submission.status; // accumulate views for display, never enter earning states
    } else if (submission.status === "THRESHOLD_MET") {
      status = "SETTLING";
    } else if (reachedThreshold && submission.status !== "SETTLING") {
      status = "THRESHOLD_MET";
    } else if (submission.status === "POSTED") {
      status = "VERIFIED";
    }

    // The THRESHOLD_MET -> SETTLING transition is the only one that mints money. Keep the
    // metric write at THRESHOLD_MET for that case and let the atomic block below claim the
    // transition, so exactly one concurrent run can create the earning.
    const willMint = status === "SETTLING" && submission.status === "THRESHOLD_MET";
    const metricStatus = willMint ? "THRESHOLD_MET" : status;

    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        currentViews: views,
        currentLikes: likes,
        currentComments: comments,
        peakViews: Math.max(views, submission.peakViews),
        fraudScore,
        status: metricStatus,
        verifiedAt: ownershipOk && !demoInProd && !submission.verifiedAt ? new Date() : submission.verifiedAt,
        lastSyncedAt: new Date(),
        viewVelocityJson: stringify([
          ...JSON.parse(submission.viewVelocityJson || "[]").slice(-20),
          { at: new Date().toISOString(), from: submission.currentViews, to: views, mode: providerMode, ownership: ownershipNote }
        ])
      }
    });
    if (ownershipOk && !demoInProd && !submission.verifiedAt) {
      const verifiedForClient = await prisma.submission.count({
        where: {
          campaign: { ownerId: submission.campaign.ownerId },
          verifiedAt: { not: null }
        }
      });
      if (verifiedForClient === 1) {
        await trackEvent({
          userId: submission.campaign.ownerId,
          type: "FIRST_VERIFIED_RESULT",
          path: `/campaigns/${submission.campaignId}`,
          metadata: { campaignId: submission.campaignId, submissionId: submission.id }
        });
      }
    }

    if (willMint) {
      // Mint the earning atomically: claim the THRESHOLD_MET -> SETTLING transition, read the
      // budget fresh inside the same transaction, and cap the payout at the remaining
      // (escrowed) budget so total payouts can never exceed what the client funded. A losing
      // concurrent run updates 0 rows and mints nothing.
      await prisma.$transaction(async (db) => {
        const claim = await db.submission.updateMany({
          where: { id: submission.id, status: "THRESHOLD_MET" },
          data: { status: "SETTLING" }
        });
        if (claim.count === 0) return;
        const existingEarning = await db.transaction.findFirst({ where: { submissionId: submission.id, type: "EARNING" } });
        if (existingEarning) return;

        const campaign = await db.campaign.findUnique({
          where: { id: submission.campaignId },
          select: { remainingBudgetCents: true, reservedBudgetCents: true, totalBudgetCents: true, status: true }
        });
        const remaining = Math.max(0, campaign?.remainingBudgetCents ?? 0);
        const rawGross = Math.floor((views / 1000) * submission.campaign.cpmRateCents);
        const reserved = Math.max(0, submission.reservedPayoutCents || 0);
        // New submissions are paid strictly from their addressable reservation. Legacy
        // submissions created before reservations keep the old escrow fallback.
        const gross = reserved > 0 ? reserved : Math.min(rawGross, remaining);
        if (gross <= 0) return; // budget exhausted — nothing is owed for this clip

        const fee = Math.floor(gross * commissionRate(submission.worker.rank));
        const net = gross - fee;
        await db.transaction.create({
          data: {
            userId: submission.workerId,
            submissionId: submission.id,
            amountCents: gross,
            feeCents: fee,
            netCents: net,
            type: "EARNING",
            status: "PENDING",
            providerData: stringify({ settlementHours: 48, fraudScore, rawGross })
          }
        });
        await db.user.update({
          where: { id: submission.workerId },
          data: {
            holdBalanceCents: { increment: net },
            lifetimeViews: { increment: velocity }
          }
        });
        const nextRemaining = reserved > 0 ? remaining : remaining - gross;
        await db.campaign.update({
          where: { id: submission.campaignId },
          data: {
            ...(reserved > 0
              ? { reservedBudgetCents: { decrement: gross } }
              : { remainingBudgetCents: { decrement: gross } }),
            status: nextRemaining <= 0
              ? "PAUSED"
              : nextRemaining < submission.campaign.totalBudgetCents * 0.2
                ? "LOW_BUDGET"
                : (campaign?.status ?? submission.campaign.status)
          }
        });
        if (reserved > 0) {
          await db.submission.update({
            where: { id: submission.id },
            data: { reservedPayoutCents: { decrement: gross } }
          });
        }
      });
    }

    updates.push(updated);
  }

  const released = await settlePendingEarnings();
  return { synced: updates.length, apiSynced, demoSynced, skipped, released, submissions: updates };
}

export const syncMockViews = syncViews;
