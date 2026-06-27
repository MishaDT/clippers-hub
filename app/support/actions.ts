"use server";

import type { SupportCategory, SupportPriority, SupportStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessAdmin, requireAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { validateChatMessage } from "@/lib/chat-safety";
import { stringify } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { supportCategories, supportPriorities, supportStatuses } from "@/lib/support";

function cleanSubject(value: FormDataEntryValue | null) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

async function notifyAdmins(title: string, body: string, href: string) {
  const configuredEmails = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const admins = await prisma.user.findMany({
    where: {
      OR: [
        { role: "ADMIN" },
        ...(configuredEmails.length ? [{ email: { in: configuredEmails } }] : [])
      ]
    },
    select: { id: true }
  });
  if (!admins.length) return;
  await prisma.notification.createMany({
    data: admins.map(({ id }) => ({
      userId: id,
      title,
      body,
      channel: "IN_APP",
      priority: "HIGH",
      kind: "SUPPORT",
      href
    }))
  });
}

export async function createSupportThreadAction(formData: FormData) {
  const user = await requireUser();
  const subject = cleanSubject(formData.get("subject"));
  const categoryValue = String(formData.get("category") || "");
  const checked = validateChatMessage(String(formData.get("body") || ""));

  if (subject.length < 5 || !supportCategories.includes(categoryValue as SupportCategory) || !checked.ok) {
    redirect("/support?error=invalid");
  }

  const thread = await prisma.supportThread.create({
    data: {
      requesterId: user.id,
      subject,
      category: categoryValue as SupportCategory,
      requesterReadAt: new Date(),
      messages: {
        create: {
          senderId: user.id,
          body: checked.body,
          metadataJson: stringify({ urls: checked.urls })
        }
      }
    },
    select: { id: true }
  });

  await notifyAdmins("Новое обращение", subject, `/admin/support?thread=${thread.id}`);
  revalidatePath("/support");
  revalidatePath("/admin/support");
  redirect(`/support?thread=${thread.id}`);
}

export async function sendSupportMessageAction(formData: FormData) {
  const user = await requireUser();
  const threadId = String(formData.get("threadId") || "");
  const checked = validateChatMessage(String(formData.get("body") || ""));
  if (!threadId || !checked.ok) return { ok: false, error: checked.reasons[0] || "Сообщение не отправлено" };

  const thread = await prisma.supportThread.findFirst({
    where: { id: threadId, requesterId: user.id },
    select: { id: true, assignedToId: true }
  });
  if (!thread) return { ok: false, error: "Обращение не найдено" };

  await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        threadId,
        senderId: user.id,
        body: checked.body,
        metadataJson: stringify({ urls: checked.urls })
      }
    }),
    prisma.supportThread.update({
      where: { id: threadId },
      data: {
        status: thread.assignedToId ? "IN_PROGRESS" : "OPEN",
        requesterReadAt: new Date(),
        updatedAt: new Date()
      }
    })
  ]);

  await notifyAdmins("Ответ в поддержке", checked.body.slice(0, 90), `/admin/support?thread=${threadId}`);
  revalidatePath("/support");
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function markSupportReadAction(threadId: string) {
  const user = await requireUser();
  await prisma.supportThread.updateMany({
    where: { id: threadId, requesterId: user.id },
    data: { requesterReadAt: new Date() }
  });
  revalidatePath("/support");
}

export async function markChatThreadReadAction(threadId: string) {
  const user = await requireUser();
  const thread = await prisma.chatThread.findFirst({
    where: { id: threadId, OR: [{ clientId: user.id }, { workerId: user.id }] },
    select: { id: true }
  });
  if (!thread) return;
  await prisma.chatReadState.upsert({
    where: { threadId_userId: { threadId, userId: user.id } },
    create: { threadId, userId: user.id, lastReadAt: new Date() },
    update: { lastReadAt: new Date() }
  });
}

export async function adminReplySupportAction(formData: FormData) {
  const admin = await requireAdmin();
  const threadId = String(formData.get("threadId") || "");
  const checked = validateChatMessage(String(formData.get("body") || ""));
  if (!threadId || !checked.ok) return { ok: false, error: checked.reasons[0] || "Сообщение не отправлено" };

  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    select: { requesterId: true, subject: true }
  });
  if (!thread) return { ok: false, error: "Обращение не найдено" };

  await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        threadId,
        senderId: admin.id,
        body: checked.body,
        metadataJson: stringify({ urls: checked.urls })
      }
    }),
    prisma.supportThread.update({
      where: { id: threadId },
      data: {
        assignedToId: admin.id,
        status: "WAITING_USER",
        adminReadAt: new Date(),
        updatedAt: new Date()
      }
    }),
    prisma.notification.create({
      data: {
        userId: thread.requesterId,
        title: "Ответ поддержки",
        body: checked.body.slice(0, 120),
        channel: "IN_APP",
        priority: "HIGH",
        kind: "SUPPORT",
        href: `/support?thread=${threadId}`
      }
    })
  ]);
  revalidatePath("/support");
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function updateSupportThreadAction(formData: FormData) {
  const admin = await requireAdmin();
  const threadId = String(formData.get("threadId") || "");
  const statusValue = String(formData.get("status") || "");
  const priorityValue = String(formData.get("priority") || "");
  const assignedToId = String(formData.get("assignedToId") || "");
  if (
    !threadId ||
    !supportStatuses.includes(statusValue as SupportStatus) ||
    !supportPriorities.includes(priorityValue as SupportPriority)
  ) return;

  const assignee = assignedToId
    ? await prisma.user.findUnique({ where: { id: assignedToId }, select: { role: true, email: true } })
    : null;
  if (assignee && !canAccessAdmin(assignee)) return;

  await prisma.supportThread.update({
    where: { id: threadId },
    data: {
      status: statusValue as SupportStatus,
      priority: priorityValue as SupportPriority,
      assignedToId: assignedToId || admin.id,
      adminReadAt: new Date(),
      resolvedAt: ["RESOLVED", "CLOSED"].includes(statusValue) ? new Date() : null
    }
  });
  revalidatePath("/support");
  revalidatePath("/admin/support");
}

export async function markAdminSupportReadAction(threadId: string) {
  await requireAdmin();
  await prisma.supportThread.update({
    where: { id: threadId },
    data: { adminReadAt: new Date() }
  });
  revalidatePath("/admin/support");
}

