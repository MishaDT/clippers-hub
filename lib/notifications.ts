import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type NotificationDb = Pick<Prisma.TransactionClient, "notification">;

export type NotifyInput = {
  userId: string;
  groupKey: string;
  title: string;
  body: string;
  href?: string | null;
  kind?: string;
  priority?: string;
  channel?: string;
};

export async function notify(input: NotifyInput, db: NotificationDb = prisma) {
  const now = new Date();
  return db.notification.upsert({
    where: { userId_groupKey: { userId: input.userId, groupKey: input.groupKey } },
    create: {
      userId: input.userId,
      groupKey: input.groupKey,
      title: input.title,
      body: input.body,
      href: input.href,
      kind: input.kind || "GENERAL",
      priority: input.priority || "NORMAL",
      channel: input.channel || "IN_APP",
      lastOccurredAt: now
    },
    update: {
      title: input.title,
      body: input.body,
      href: input.href,
      kind: input.kind || "GENERAL",
      priority: input.priority || "NORMAL",
      channel: input.channel || "IN_APP",
      occurrenceCount: { increment: 1 },
      lastOccurredAt: now,
      readAt: null,
      archivedAt: null
    }
  });
}

export function notificationGroup(scope: string, entityId: string) {
  return `${scope}:${entityId}`;
}
