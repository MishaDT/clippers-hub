import type { Prisma } from "@prisma/client";

export const REFERRAL_SIGNUP_REWARD_RP = 25;

export async function awardReferralSignup(
  tx: Prisma.TransactionClient,
  invitee: { id: string; name: string; referredBy: string | null }
) {
  if (!invitee.referredBy) return false;
  const inviter = await tx.user.findUnique({
    where: { referralCode: invitee.referredBy },
    select: { id: true }
  });
  if (!inviter || inviter.id === invitee.id) return false;

  const reference = `referral:signup:${invitee.id}`;
  const existing = await tx.rpTransaction.findUnique({ where: { reference }, select: { id: true } });
  if (existing) return false;

  await tx.rpTransaction.create({
    data: {
      userId: inviter.id,
      amount: REFERRAL_SIGNUP_REWARD_RP,
      type: "REFERRAL_REWARD",
      reference,
      metadataJson: JSON.stringify({ inviteeId: invitee.id })
    }
  });
  await tx.user.update({
    where: { id: inviter.id },
    data: { rpBalance: { increment: REFERRAL_SIGNUP_REWARD_RP } }
  });
  await tx.notification.create({
    data: {
      userId: inviter.id,
      title: `+${REFERRAL_SIGNUP_REWARD_RP} RP за приглашение`,
      body: `${invitee.name} зарегистрировался по вашей ссылке.`,
      channel: "IN_APP",
      priority: "NORMAL",
      kind: "REWARD",
      href: "/wallet?tab=rp"
    }
  });
  return true;
}
