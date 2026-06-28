const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const accepted = await prisma.collabInvite.findMany({
    where: { status: "ACCEPTED", chatThread: null },
    select: { id: true, clientId: true, workerId: true, respondedAt: true, createdAt: true }
  });

  for (const invite of accepted) {
    await prisma.$transaction(async (tx) => {
      const thread = await tx.chatThread.upsert({
        where: { collabInviteId: invite.id },
        update: {},
        create: {
          kind: "COLLAB",
          collabInviteId: invite.id,
          clientId: invite.clientId,
          workerId: invite.workerId,
          createdAt: invite.respondedAt || invite.createdAt
        }
      });
      const existingMessage = await tx.chatMessage.findFirst({
        where: { threadId: thread.id, type: "SYSTEM" },
        select: { id: true }
      });
      if (!existingMessage) {
        await tx.chatMessage.create({
          data: {
            threadId: thread.id,
            senderId: invite.workerId,
            type: "SYSTEM",
            body: "Коллаб принят. Обсудите идею, формат и сроки."
          }
        });
      }
    });
  }

  console.log(`Collab chats backfilled: ${accepted.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
