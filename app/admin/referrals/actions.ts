"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { stringify } from "@/lib/json";
import { boundedInteger, boundedNumber } from "@/lib/numbers";

export async function saveReferralProgramAction(formData: FormData) {
  const admin = await requireAdmin();
  const enabled = formData.get("enabled") === "on";
  const attributionDays = boundedInteger(formData.get("attributionDays"), { min: 1, max: 90, fallback: 30 });
  const activationRewardRp = boundedInteger(formData.get("activationRewardRp"), { min: 0, max: 10_000, fallback: 25 });
  await prisma.$transaction([
    prisma.referralProgramConfig.upsert({
      where: { id: "default" },
      create: { id: "default", enabled, attributionDays, activationRewardRp },
      update: { enabled, attributionDays, activationRewardRp }
    }),
    prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "REFERRAL_CONFIG_UPDATE",
        entity: "ReferralProgramConfig",
        entityId: "default",
        metadata: stringify({ enabled, attributionDays, activationRewardRp })
      }
    })
  ]);
  revalidatePath("/admin/referrals");
  revalidatePath("/referrals");
}

export async function saveReferralTierAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim().slice(0, 40);
  const minActiveReferrals = boundedInteger(formData.get("minActiveReferrals"), { min: 1, max: 100_000, fallback: 1 });
  const ratePercent = boundedNumber(formData.get("ratePercent"), { min: 0, max: 25, fallback: 0 });
  const sortOrder = boundedInteger(formData.get("sortOrder"), { min: -1_000, max: 1_000, fallback: minActiveReferrals });
  if (title.length < 2) return;
  const data = {
      title,
      minActiveReferrals,
      rateBps: Math.round(ratePercent * 100),
      sortOrder,
      active: formData.get("active") === "on"
  };
  const tier = id
    ? await prisma.referralTier.update({ where: { id }, data })
    : await prisma.referralTier.create({ data });
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: id ? "REFERRAL_TIER_UPDATE" : "REFERRAL_TIER_CREATE",
      entity: "ReferralTier",
      entityId: tier.id,
      metadata: stringify({ title, minActiveReferrals, rateBps: tier.rateBps, active: tier.active })
    }
  });
  revalidatePath("/admin/referrals");
  revalidatePath("/referrals");
}

export async function moderateReferralRelationAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || "");
  if (!id || !["activate", "register", "block"].includes(decision)) return;
  const status = decision === "activate" ? "ACTIVE" : decision === "block" ? "BLOCKED" : "REGISTERED";
  await prisma.$transaction(async (tx) => {
    const relation = await tx.referralRelation.update({
      where: { id },
      data: {
        status,
        qualifiedAt: status === "ACTIVE" ? new Date() : undefined,
        flaggedAt: null,
        flagReason: null
      }
    });
    const held = await tx.referralCommission.findMany({
      where: { relationId: id, status: "HELD" },
      select: { id: true, amountCents: true, transactionId: true, referredUserId: true, side: true, rateBps: true, transaction: { select: { isDemo: true } } }
    });
    if (decision === "activate" && held.length) {
      const total = held.reduce((sum, item) => sum + item.amountCents, 0);
      await tx.referralCommission.updateMany({
        where: { relationId: id, status: "HELD" },
        data: { status: "AVAILABLE", releasedAt: new Date() }
      });
      await tx.user.update({ where: { id: relation.referrerId }, data: { balanceCents: { increment: total } } });
      for (const item of held) {
        await tx.transaction.create({
          data: {
            userId: relation.referrerId,
            amountCents: item.amountCents,
            feeCents: 0,
            netCents: item.amountCents,
            type: "REFERRAL_BONUS",
            status: "COMPLETED",
            isDemo: item.transaction.isDemo,
            providerData: stringify({ sourceTransactionId: item.transactionId, referredUserId: item.referredUserId, side: item.side, rateBps: item.rateBps, manuallyReleased: true })
          }
        });
      }
    }
    if (decision === "activate") {
      const [config, priorReward] = await Promise.all([
        tx.referralProgramConfig.findUnique({ where: { id: "default" } }),
        tx.rpTransaction.findFirst({
          where: {
            reference: {
              in: [`referral:signup:${relation.referredUserId}`, `referral:activation:${relation.referredUserId}`]
            }
          },
          select: { id: true }
        })
      ]);
      const reward = Math.max(0, config?.activationRewardRp ?? 25);
      if (!priorReward && reward > 0) {
        await tx.rpTransaction.create({
          data: {
            userId: relation.referrerId,
            amount: reward,
            type: "REFERRAL_REWARD",
            reference: `referral:activation:${relation.referredUserId}`,
            metadataJson: stringify({ inviteeId: relation.referredUserId, manuallyReleased: true })
          }
        });
        await tx.user.update({ where: { id: relation.referrerId }, data: { rpBalance: { increment: reward } } });
      }
    }
    if (decision === "block") {
      await tx.referralCommission.updateMany({
        where: { relationId: id, status: "HELD" },
        data: { status: "REVERSED", reversedAt: new Date() }
      });
    }
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "REFERRAL_RELATION_MODERATE",
        entity: "ReferralRelation",
        entityId: id,
        metadata: stringify({ decision, status })
      }
    });
  });
  revalidatePath("/admin/referrals");
  revalidatePath("/referrals");
}
