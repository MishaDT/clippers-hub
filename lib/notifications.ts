import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildNotificationUpsert, notificationGroup, type NotifyInput } from "@/lib/notification-logic";

type NotificationDb = Pick<Prisma.TransactionClient, "notification">;

export type { NotifyInput };
export { notificationGroup };

export async function notify(input: NotifyInput, db: NotificationDb = prisma) {
  return db.notification.upsert(buildNotificationUpsert(input));
}
