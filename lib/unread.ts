import "server-only";

import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

function numberFromCount(rows: Array<{ count: bigint | number }>) {
  return Number(rows[0]?.count || 0);
}

export function unreadSummaryTag(userId: string) {
  return `unread-summary:${userId}`;
}

async function queryUnreadSummary(userId: string) {
  const rows = await prisma.$queryRaw<Array<{
    chats: bigint;
    support: bigint;
    notifications: bigint;
    admin_alerts: bigint;
  }>>(Prisma.sql`
    SELECT
      (
        SELECT COUNT(*)::bigint
        FROM "ChatMessage" message
        JOIN "ChatThread" thread ON thread.id = message."threadId"
        LEFT JOIN "ChatReadState" state
          ON state."threadId" = thread.id AND state."userId" = ${userId}
        WHERE (thread."clientId" = ${userId} OR thread."workerId" = ${userId})
          AND message."senderId" <> ${userId}
          AND message."createdAt" > COALESCE(state."lastReadAt", TIMESTAMP '1970-01-01')
      ) AS chats,
      (
        SELECT COUNT(*)::bigint
        FROM "SupportMessage" message
        JOIN "SupportThread" thread ON thread.id = message."threadId"
        WHERE thread."requesterId" = ${userId}
          AND message."senderId" <> ${userId}
          AND message."createdAt" > thread."requesterReadAt"
      ) AS support,
      (
        SELECT COUNT(*)::bigint
        FROM "Notification"
        WHERE "userId" = ${userId}
          AND "readAt" IS NULL
          AND "archivedAt" IS NULL
      ) AS notifications,
      (
        SELECT COUNT(*)::bigint
        FROM "Notification"
        WHERE "userId" = ${userId}
          AND "readAt" IS NULL
          AND "archivedAt" IS NULL
          AND priority = 'HIGH'
      ) AS admin_alerts
  `);
  const row = rows[0];
  const chats = Number(row?.chats || 0);
  const support = Number(row?.support || 0);
  return {
    chats,
    support,
    chatBadge: chats + support,
    notifications: Number(row?.notifications || 0),
    adminAlerts: Number(row?.admin_alerts || 0)
  };
}

export async function getUnreadSummary(userId: string) {
  return unstable_cache(
    () => queryUnreadSummary(userId),
    ["unread-summary-v2", userId],
    { revalidate: 15, tags: [unreadSummaryTag(userId)] }
  )();
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
