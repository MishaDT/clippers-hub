const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const submissions = await prisma.submission.findMany({
    where: { chatThreads: { none: {} } },
    select: {
      id: true,
      campaignId: true,
      workerId: true,
      campaign: { select: { ownerId: true } }
    }
  });

  let created = 0;
  for (const submission of submissions) {
    await prisma.chatThread.upsert({
      where: {
        campaignId_workerId: {
          campaignId: submission.campaignId,
          workerId: submission.workerId
        }
      },
      update: { submissionId: submission.id },
      create: {
        campaignId: submission.campaignId,
        submissionId: submission.id,
        clientId: submission.campaign.ownerId,
        workerId: submission.workerId,
        messages: {
          create: {
            senderId: submission.workerId,
            type: "SYSTEM",
            body: "Исполнитель взял заказ. Здесь можно уточнить детали и прислать вопросы по ролику."
          }
        }
      }
    });
    created += 1;
  }
  console.log(`Chat backfill complete: ${created}`);
}

main().finally(() => prisma.$disconnect());
