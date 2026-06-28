const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const REWARD = 25;

async function main() {
  const invitees = await prisma.user.findMany({
    where: { referredBy: { not: null } },
    select: { id: true, name: true, referredBy: true }
  });
  let awarded = 0;
  for (const invitee of invitees) {
    const reference = `referral:signup:${invitee.id}`;
    const exists = await prisma.rpTransaction.findUnique({ where: { reference }, select: { id: true } });
    if (exists) continue;
    const inviter = await prisma.user.findUnique({ where: { referralCode: invitee.referredBy }, select: { id: true } });
    if (!inviter || inviter.id === invitee.id) continue;
    await prisma.$transaction([
      prisma.rpTransaction.create({
        data: {
          userId: inviter.id,
          amount: REWARD,
          type: "REFERRAL_REWARD",
          reference,
          metadataJson: JSON.stringify({ inviteeId: invitee.id, backfill: true })
        }
      }),
      prisma.user.update({ where: { id: inviter.id }, data: { rpBalance: { increment: REWARD } } }),
      prisma.notification.create({
        data: {
          userId: inviter.id,
          title: `+${REWARD} RP за приглашение`,
          body: `${invitee.name} зарегистрировался по вашей ссылке.`,
          channel: "IN_APP",
          priority: "NORMAL",
          kind: "REWARD",
          href: "/wallet?tab=rp"
        }
      })
    ]);
    awarded += 1;
  }
  console.log(`Referral rewards awarded: ${awarded}`);
}

main().finally(() => prisma.$disconnect());
