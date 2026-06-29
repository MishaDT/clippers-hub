import type { Prisma } from "@prisma/client";
import { notificationGroup, notify } from "@/lib/notifications";

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
  await notify({
    userId: inviter.id,
    groupKey: notificationGroup("referral-signup", invitee.id),
    title: `+${REFERRAL_SIGNUP_REWARD_RP} RP за приглашение`,
    body: `${invitee.name} зарегистрировался по вашей ссылке.`,
    kind: "REWARD",
    href: "/wallet?tab=rp"
  }, tx);
  return true;
}
