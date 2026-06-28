"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null, archivedAt: null },
    data: { readAt: new Date() }
  });
  revalidatePath("/", "layout");
}

export async function archiveNotificationAction(formData: FormData) {
  const user = await requireUser();
  const notificationId = String(formData.get("notificationId") || "");
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id },
    data: { archivedAt: new Date(), readAt: new Date() }
  });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function restoreNotificationAction(formData: FormData) {
  const user = await requireUser();
  const notificationId = String(formData.get("notificationId") || "");
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id },
    data: { archivedAt: null }
  });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function archiveReadNotificationsAction() {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: { not: null }, archivedAt: null },
    data: { archivedAt: new Date() }
  });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markNotificationReadAction(notificationId: string) {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id, readAt: null },
    data: { readAt: new Date() }
  });
  revalidatePath("/", "layout");
}

export async function markNotificationReadFormAction(formData: FormData) {
  await markNotificationReadAction(String(formData.get("notificationId") || ""));
  revalidatePath("/notifications");
}
