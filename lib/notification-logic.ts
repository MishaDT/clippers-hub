// Pure, prisma-free notification helpers so the grouping/dedup logic is unit-testable.

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

// Stable key for "one notification per object": same scope+entity always collapses into one row.
export function notificationGroup(scope: string, entityId: string) {
  return `${scope}:${entityId}`;
}

// Short human label for a grouped notification, e.g. "3 новых события".
export function occurrenceLabel(count: number) {
  if (count <= 1) return "";
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "новое событие"
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? "новых события"
      : "новых событий";
  return `${count} ${word}`;
}

// Builds the exact upsert payload: a repeated event updates the existing row, bumps the
// counter and un-reads/un-archives it instead of creating a duplicate.
export function buildNotificationUpsert(input: NotifyInput, now: Date = new Date()) {
  const kind = input.kind || "GENERAL";
  const priority = input.priority || "NORMAL";
  const channel = input.channel || "IN_APP";
  const href = input.href ?? null;
  return {
    where: { userId_groupKey: { userId: input.userId, groupKey: input.groupKey } },
    create: {
      userId: input.userId,
      groupKey: input.groupKey,
      title: input.title,
      body: input.body,
      href,
      kind,
      priority,
      channel,
      lastOccurredAt: now
    },
    update: {
      title: input.title,
      body: input.body,
      href,
      kind,
      priority,
      channel,
      occurrenceCount: { increment: 1 },
      lastOccurredAt: now,
      readAt: null,
      archivedAt: null
    }
  };
}
