import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNotificationUpsert,
  notificationGroup,
  occurrenceLabel,
  type NotifyInput
} from "../lib/notification-logic.ts";
import { RECURRING_REWARDS, WEEKLY_RP_CAP } from "../lib/rp.ts";

// A tiny in-memory store that mimics the prisma upsert semantics used by notify(),
// so we can assert dedup/grouping without a database.
type Row = {
  userId: string;
  groupKey: string;
  title: string;
  body: string;
  occurrenceCount: number;
  readAt: Date | null;
  archivedAt: Date | null;
  lastOccurredAt: Date;
};

function makeStore() {
  const rows: Row[] = [];
  return {
    rows,
    upsert(input: NotifyInput, now = new Date()) {
      const payload = buildNotificationUpsert(input, now);
      const existing = rows.find(
        (row) => row.userId === input.userId && row.groupKey === input.groupKey
      );
      if (!existing) {
        rows.push({
          userId: input.userId,
          groupKey: input.groupKey,
          title: payload.create.title,
          body: payload.create.body,
          occurrenceCount: 1,
          readAt: null,
          archivedAt: null,
          lastOccurredAt: payload.create.lastOccurredAt
        });
        return;
      }
      existing.title = payload.update.title;
      existing.body = payload.update.body;
      existing.occurrenceCount += payload.update.occurrenceCount.increment;
      existing.readAt = payload.update.readAt;
      existing.archivedAt = payload.update.archivedAt;
      existing.lastOccurredAt = payload.update.lastOccurredAt;
    }
  };
}

test("notification group keys are stable and per-object", () => {
  assert.equal(notificationGroup("submission", "abc"), "submission:abc");
  assert.equal(notificationGroup("submission", "abc"), notificationGroup("submission", "abc"));
  assert.notEqual(notificationGroup("submission", "abc"), notificationGroup("support", "abc"));
  assert.notEqual(notificationGroup("submission", "abc"), notificationGroup("submission", "xyz"));
});

test("a repeated event updates one row instead of creating duplicates", () => {
  const store = makeStore();
  const input: NotifyInput = {
    userId: "u1",
    groupKey: notificationGroup("submission", "s1"),
    title: "Новый отклик",
    body: "Откликнулись на заказ"
  };
  store.upsert(input);
  store.upsert(input);
  store.upsert(input);
  assert.equal(store.rows.length, 1, "should collapse into a single row");
  assert.equal(store.rows[0].occurrenceCount, 3, "counter reflects repeats");
});

test("a new event re-opens a read group", () => {
  const store = makeStore();
  const input: NotifyInput = {
    userId: "u1",
    groupKey: notificationGroup("submission", "s1"),
    title: "Проверка",
    body: "Статус обновлён"
  };
  store.upsert(input);
  store.rows[0].readAt = new Date();
  store.rows[0].archivedAt = new Date();
  store.upsert(input);
  assert.equal(store.rows[0].readAt, null, "re-opened (unread) on new event");
  assert.equal(store.rows[0].archivedAt, null, "un-archived on new event");
  assert.equal(store.rows[0].occurrenceCount, 2);
});

test("different objects stay separate notifications", () => {
  const store = makeStore();
  store.upsert({ userId: "u1", groupKey: notificationGroup("submission", "s1"), title: "A", body: "" });
  store.upsert({ userId: "u1", groupKey: notificationGroup("submission", "s2"), title: "B", body: "" });
  store.upsert({ userId: "u2", groupKey: notificationGroup("submission", "s1"), title: "C", body: "" });
  assert.equal(store.rows.length, 3);
});

test("upsert payload fills defaults and reset flags", () => {
  const now = new Date("2026-06-29T00:00:00Z");
  const payload = buildNotificationUpsert(
    { userId: "u1", groupKey: "g", title: "t", body: "b" },
    now
  );
  assert.equal(payload.create.kind, "GENERAL");
  assert.equal(payload.create.priority, "NORMAL");
  assert.equal(payload.create.channel, "IN_APP");
  assert.equal(payload.create.href, null);
  assert.equal(payload.create.lastOccurredAt, now);
  assert.deepEqual(payload.update.occurrenceCount, { increment: 1 });
  assert.equal(payload.update.readAt, null);
  assert.equal(payload.update.archivedAt, null);
});

test("occurrence label uses Russian plural forms", () => {
  assert.equal(occurrenceLabel(1), "");
  assert.equal(occurrenceLabel(2), "2 новых события");
  assert.equal(occurrenceLabel(3), "3 новых события");
  assert.equal(occurrenceLabel(5), "5 новых событий");
  assert.equal(occurrenceLabel(11), "11 новых событий");
  assert.equal(occurrenceLabel(21), "21 новое событие");
});

test("weekly rewards never exceed the RP cap", () => {
  const total = RECURRING_REWARDS.reduce((sum, reward) => sum + reward.reward, 0);
  assert.ok(total <= WEEKLY_RP_CAP, "sum of weekly rewards fits within the cap");

  // Mirror the guard used by claimRecurringRewardAction: claimed + reward must not exceed cap.
  let claimed = 0;
  let granted = 0;
  for (const reward of RECURRING_REWARDS) {
    if (claimed + reward.reward > WEEKLY_RP_CAP) continue;
    claimed += reward.reward;
    granted += reward.reward;
  }
  assert.equal(granted, total);
  // A second pass (re-claim attempt) grants nothing — idempotent against the cap.
  let extra = 0;
  for (const reward of RECURRING_REWARDS) {
    if (claimed + reward.reward > WEEKLY_RP_CAP) continue;
    extra += reward.reward;
  }
  assert.equal(extra, 0, "cap blocks double-claim beyond the weekly limit");
});
