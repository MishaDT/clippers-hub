import type { Prisma } from "@prisma/client";
import { notificationGroup, notify } from "@/lib/notifications";
import { referralCommissionCents, selectReferralTier } from "@/lib/referral-rules";

async function ensureRelation(
  db: Prisma.TransactionClient,
  referredUserId: string
) {
  const existing = await db.referralRelation.findUnique({
    where: { referredUserId },
    include: { referrer: { select: { id: true, referralCode: true } } }
  });
  if (existing) return existing;

  const referred = await db.user.findUnique({
    where: { id: referredUserId },
    select: { id: true, referredBy: true }
  });
  if (!referred?.referredBy) return null;
  const referrer = await db.user.findUnique({
    where: { referralCode: referred.referredBy },
    select: { id: true, referralCode: true }
  });
  if (!referrer || referrer.id === referredUserId) return null;
  return db.referralRelation.create({
    data: {
      referrerId: referrer.id,
      referredUserId,
      codeSnapshot: referrer.referralCode
    },
    include: { referrer: { select: { id: true, referralCode: true } } }
  });
}

async function activateRelation(
  db: Prisma.TransactionClient,
  relation: NonNullable<Awaited<ReturnType<typeof ensureRelation>>>,
  activationRewardRp: number
) {
  if (relation.status === "BLOCKED" || relation.status === "FLAGGED") return false;
  if (relation.status !== "ACTIVE") {
    await db.referralRelation.update({
      where: { id: relation.id },
      data: { status: "ACTIVE", qualifiedAt: new Date() }
    });
  }

  const legacyReference = `referral:signup:${relation.referredUserId}`;
  const reference = `referral:activation:${relation.referredUserId}`;
  const prior = await db.rpTransaction.findFirst({
    where: { reference: { in: [legacyReference, reference] } },
    select: { id: true }
  });
  if (!prior && activationRewardRp > 0) {
    await db.rpTransaction.create({
      data: {
        userId: relation.referrerId,
        amount: activationRewardRp,
        type: "REFERRAL_REWARD",
        reference,
        metadataJson: JSON.stringify({ inviteeId: relation.referredUserId })
      }
    });
    await db.user.update({
      where: { id: relation.referrerId },
      data: { rpBalance: { increment: activationRewardRp } }
    });
  }
  return true;
}

export async function releaseReferralCommissions(
  db: Prisma.TransactionClient,
  input: {
    transactionId: string;
    workerId: string;
    clientId: string;
    platformFeeCents: number;
  }
) {
  if (input.platformFeeCents <= 0) return [];
  const config = await db.referralProgramConfig.findUnique({ where: { id: "default" } });
  if (config && !config.enabled) return [];
  const activationRewardRp = Math.max(0, config?.activationRewardRp ?? 25);
  const tiers = await db.referralTier.findMany({
    where: { active: true },
    orderBy: { minActiveReferrals: "asc" },
    select: { title: true, minActiveReferrals: true, rateBps: true }
  });
  const sides = [
    { referredUserId: input.workerId, side: "WORKER" as const },
    { referredUserId: input.clientId, side: "CLIENT" as const }
  ];
  const created: Array<{ referrerId: string; amountCents: number }> = [];
  const eligibleSources: Array<{
    source: (typeof sides)[number];
    relation: NonNullable<Awaited<ReturnType<typeof ensureRelation>>>;
    held: boolean;
  }> = [];

  for (const source of sides) {
    const relation = await ensureRelation(db, source.referredUserId);
    if (!relation) continue;
    if (relation.status === "BLOCKED") continue;
    if (relation.status === "FLAGGED") {
      eligibleSources.push({ source, relation, held: true });
      continue;
    }
    const eligible = await activateRelation(db, relation, activationRewardRp);
    if (!eligible) continue;
    eligibleSources.push({ source, relation, held: false });
  }

  // Activate every participant first. If a single completed deal moves a partner across
  // a tier boundary, both commissions from that deal use the newly reached tier.
  for (const { source, relation, held } of eligibleSources) {
    const activeCount = await db.referralRelation.count({
      where: { referrerId: relation.referrerId, status: "ACTIVE" }
    });
    const tier = selectReferralTier(tiers, activeCount) || tiers[0] || null;
    if (!tier) continue;
    const amountCents = referralCommissionCents(input.platformFeeCents, tier.rateBps);
    if (amountCents <= 0) continue;

    const inserted = await db.referralCommission.createMany({
      data: [{
        referrerId: relation.referrerId,
        referredUserId: source.referredUserId,
        relationId: relation.id,
        transactionId: input.transactionId,
        side: source.side,
        rateBps: Math.min(2500, tier.rateBps),
        baseFeeCents: input.platformFeeCents,
        amountCents,
        status: held ? "HELD" : "AVAILABLE",
        releasedAt: held ? null : new Date()
      }],
      skipDuplicates: true
    });
    if (!inserted.count) continue;

    if (held) continue;
    await db.user.update({
      where: { id: relation.referrerId },
      data: { balanceCents: { increment: amountCents } }
    });
    await db.transaction.create({
      data: {
        userId: relation.referrerId,
        amountCents,
        feeCents: 0,
        netCents: amountCents,
        type: "REFERRAL_BONUS",
        status: "COMPLETED",
        providerData: JSON.stringify({
          sourceTransactionId: input.transactionId,
          referredUserId: source.referredUserId,
          side: source.side,
          rateBps: Math.min(2500, tier.rateBps)
        })
      }
    });
    await notify({
      userId: relation.referrerId,
      groupKey: notificationGroup("referral-commission", `${input.transactionId}:${source.referredUserId}`),
      title: `Партнёрская комиссия +${(amountCents / 100).toLocaleString("ru-RU")} ₽`,
      body: `Активный реферал принёс комиссию по уровню «${tier.title}».`,
      kind: "REWARD",
      href: "/referrals"
    }, db);
    created.push({ referrerId: relation.referrerId, amountCents });
  }
  return created;
}
