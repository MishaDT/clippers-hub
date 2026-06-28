import "server-only";

import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scanContent } from "@/lib/content-policy";
import { stringify } from "@/lib/json";

export async function assertAccountActive(user: Pick<User, "id" | "accountStatus" | "restrictedUntil">) {
  if (user.accountStatus === "BANNED" || user.accountStatus === "FROZEN") throw new Error("Аккаунт ограничен модерацией");
  if (user.accountStatus === "RESTRICTED" && (!user.restrictedUntil || user.restrictedUntil > new Date())) {
    throw new Error("Действие временно ограничено");
  }
}

export async function createModerationCase(input: {
  source?: string;
  contentType: string;
  entityId?: string;
  authorId?: string;
  reporterId?: string;
  text?: string;
  category: string;
  severity: string;
  payload?: Record<string, unknown>;
}) {
  const moderationCase = await prisma.moderationCase.create({
    data: {
      source: input.source || "AUTO",
      contentType: input.contentType,
      entityId: input.entityId,
      authorId: input.authorId,
      reporterId: input.reporterId,
      category: input.category,
      severity: input.severity,
      excerpt: input.text?.slice(0, 240),
      payloadJson: stringify(input.payload || {})
    }
  });
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length) {
    await prisma.notification.createMany({
      data: admins.map(({ id }) => ({
        userId: id,
        title: "Новый случай модерации",
        body: `${input.contentType}: ${input.category}`,
        channel: "IN_APP",
        priority: input.severity === "CRITICAL" ? "HIGH" : "NORMAL",
        kind: "MODERATION",
        href: `/admin/moderation?case=${moderationCase.id}`
      }))
    });
  }
  return moderationCase;
}

export async function moderateText(input: {
  text: string;
  contentType: string;
  authorId: string;
  context?: "PUBLIC" | "CHAT" | "SUPPORT";
  payload?: Record<string, unknown>;
}) {
  const decision = scanContent(input.text, input.context);
  if (decision.action !== "ALLOW") {
    await createModerationCase({
      contentType: input.contentType,
      authorId: input.authorId,
      text: input.text,
      category: decision.category,
      severity: decision.severity,
      payload: { ...input.payload, matches: decision.matches }
    });
  }
  return decision;
}

export async function reportContent(input: {
  reporterId: string;
  authorId?: string;
  contentType: string;
  entityId: string;
  reason: string;
  category?: string;
}) {
  const existing = await prisma.moderationCase.findFirst({
    where: { source: "REPORT", reporterId: input.reporterId, contentType: input.contentType, entityId: input.entityId, status: "OPEN" },
    select: { id: true }
  });
  if (existing) return existing;
  return createModerationCase({
    source: "REPORT",
    reporterId: input.reporterId,
    authorId: input.authorId,
    contentType: input.contentType,
    entityId: input.entityId,
    text: input.reason,
    category: input.category || "USER_REPORT",
    severity: "MEDIUM"
  });
}
