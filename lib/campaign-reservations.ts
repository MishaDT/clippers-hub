import { Prisma } from "@prisma/client";
import { grossPayout } from "@/lib/money";
import { nextCampaignStatusAfterReservation } from "@/lib/reservation-rules";

export class CampaignReservationError extends Error {
  constructor(public readonly code: "CLOSED" | "NO_BUDGET" | "NO_SLOTS" | "ALREADY_JOINED") {
    super(code);
  }
}

export async function reserveCampaignSlot(
  db: Prisma.TransactionClient,
  campaignId: string,
  workerId: string
) {
  // Lock the campaign row until this transaction finishes. Without this lock two workers
  // could both observe the last slot as free before either submission is created.
  await db.$queryRaw(Prisma.sql`
    SELECT "id" FROM "Campaign" WHERE "id" = ${campaignId} FOR UPDATE
  `);
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      visibility: true,
      deadline: true,
      trackingPrefix: true,
      viewThreshold: true,
      cpmRateCents: true,
      remainingBudgetCents: true,
      maxPaidResults: true
    }
  });
  if (!campaign || !["ACTIVE", "LOW_BUDGET"].includes(campaign.status) || campaign.deadline.getTime() <= Date.now()) {
    throw new CampaignReservationError("CLOSED");
  }
  const existing = await db.submission.findUnique({
    where: { campaignId_workerId: { campaignId, workerId } },
    select: { id: true }
  });
  if (existing) throw new CampaignReservationError("ALREADY_JOINED");

  const occupied = await db.submission.count({
    where: {
      campaignId,
      status: { not: "REJECTED" }
    }
  });
  if (occupied >= campaign.maxPaidResults) throw new CampaignReservationError("NO_SLOTS");

  const reserve = grossPayout(campaign.viewThreshold, campaign.cpmRateCents);
  if (reserve <= 0 || campaign.remainingBudgetCents < reserve) {
    throw new CampaignReservationError("NO_BUDGET");
  }

  const claimed = await db.campaign.updateMany({
    where: {
      id: campaignId,
      remainingBudgetCents: { gte: reserve },
      status: { in: ["ACTIVE", "LOW_BUDGET"] }
    },
    data: {
      remainingBudgetCents: { decrement: reserve },
      reservedBudgetCents: { increment: reserve }
    }
  });
  if (claimed.count === 0) throw new CampaignReservationError("NO_BUDGET");
  const nextRemaining = campaign.remainingBudgetCents - reserve;
  await db.campaign.update({
    where: { id: campaignId },
    data: {
      status: nextCampaignStatusAfterReservation({
        currentStatus: campaign.status as "ACTIVE" | "LOW_BUDGET",
        nextRemaining,
        reserve,
        occupiedAfter: occupied + 1,
        maxPaidResults: campaign.maxPaidResults
      })
    }
  });
  return { campaign, reserve };
}

export async function releaseSubmissionReservation(
  db: Prisma.TransactionClient,
  submissionId: string
) {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { campaign: true }
  });
  if (!submission || submission.reservationReleasedAt || submission.reservedPayoutCents <= 0) return 0;

  const released = await db.submission.updateMany({
    where: {
      id: submissionId,
      reservationReleasedAt: null,
      reservedPayoutCents: submission.reservedPayoutCents
    },
    data: {
      reservedPayoutCents: 0,
      reservationReleasedAt: new Date()
    }
  });
  if (released.count === 0) return 0;
  if (submission.campaign.status === "COMPLETED") {
    await db.campaign.update({
      where: { id: submission.campaignId },
      data: { reservedBudgetCents: { decrement: submission.reservedPayoutCents } }
    });
    await db.user.update({
      where: { id: submission.campaign.ownerId },
      data: { balanceCents: { increment: submission.reservedPayoutCents } }
    });
    await db.transaction.create({
      data: {
        userId: submission.campaign.ownerId,
        amountCents: submission.reservedPayoutCents,
        feeCents: 0,
        netCents: submission.reservedPayoutCents,
        type: "ADJUSTMENT",
        status: "COMPLETED",
        providerData: JSON.stringify({
          escrowRefundForRejectedSubmission: submission.id,
          campaignId: submission.campaignId
        })
      }
    });
  } else {
    await db.campaign.update({
      where: { id: submission.campaignId },
      data: {
        reservedBudgetCents: { decrement: submission.reservedPayoutCents },
        remainingBudgetCents: { increment: submission.reservedPayoutCents },
        ...(submission.campaign.deadline.getTime() > Date.now() ? { status: "ACTIVE" as const } : {})
      }
    });
  }
  return submission.reservedPayoutCents;
}

export async function restoreSubmissionReservation(
  db: Prisma.TransactionClient,
  submissionId: string
) {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { campaign: true }
  });
  if (!submission || submission.reservedPayoutCents > 0) return submission?.reservedPayoutCents || 0;

  const occupied = await db.submission.count({
    where: { campaignId: submission.campaignId, status: { not: "REJECTED" } }
  });
  if (occupied >= submission.campaign.maxPaidResults) throw new CampaignReservationError("NO_SLOTS");

  const reserve = grossPayout(submission.campaign.viewThreshold, submission.campaign.cpmRateCents);
  const claimed = await db.campaign.updateMany({
    where: { id: submission.campaignId, remainingBudgetCents: { gte: reserve } },
    data: {
      remainingBudgetCents: { decrement: reserve },
      reservedBudgetCents: { increment: reserve }
    }
  });
  if (claimed.count === 0) throw new CampaignReservationError("NO_BUDGET");
  await db.submission.update({
    where: { id: submissionId },
    data: {
      reservedPayoutCents: reserve,
      reservationReleasedAt: null
    }
  });
  return reserve;
}
