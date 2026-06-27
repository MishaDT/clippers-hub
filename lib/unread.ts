import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function numberFromCount(rows: Array<{ count: bigint | number }>) {
  return Number(rows[0]?.count || 0);
}

export async function getUnreadSummary(userId: string) {
  const [chatRows, supportRows, notifications] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "ChatMessage" message
      JOIN "ChatThread" thread ON thread.id = message."threadId"
      LEFT JOIN "ChatReadState" state
        ON state."threadId" = thread.id AND state."userId" = ${userId}
      WHERE (thread."clientId" = ${userId} OR thread."workerId" = ${userId})
        AND message."senderId" <> ${userId}
        AND message."createdAt" > COALESCE(state."lastReadAt", TIMESTAMP '1970-01-01')
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "SupportMessage" message
      JOIN "SupportThread" thread ON thread.id = message."threadId"
      WHERE thread."requesterId" = ${userId}
        AND message."senderId" <> ${userId}
        AND message."createdAt" > thread."requesterReadAt"
    `),
    prisma.notification.count({ where: { userId, readAt: null } })
  ]);

  const chats = numberFromCount(chatRows);
  const support = numberFromCount(supportRows);
  return { chats, support, chatBadge: chats + support, notifications };
}

export async function getAdminSupportUnread() {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM "SupportMessage" message
    JOIN "SupportThread" thread ON thread.id = message."threadId"
    WHERE message."senderId" = thread."requesterId"
      AND message."createdAt" > COALESCE(thread."adminReadAt", TIMESTAMP '1970-01-01')
      AND thread.status NOT IN ('RESOLVED', 'CLOSED')
  `);
  return numberFromCount(rows);
}

