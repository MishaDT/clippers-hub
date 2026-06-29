const { createHash } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

function keyFor(item) {
  const raw = [item.kind, item.title, item.href || ""].join("|");
  return `legacy:${createHash("sha256").update(raw).digest("hex").slice(0, 24)}`;
}

async function main() {
  const columns = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'Notification' AND column_name = 'occurrenceCount'
  `;
  const migrated = columns.length > 0;
  const rows = migrated
    ? await prisma.$queryRaw`
        SELECT id, "userId", kind, title, href, "occurrenceCount"
        FROM "Notification"
        WHERE "groupKey" IS NULL
        ORDER BY "lastOccurredAt" DESC, "createdAt" DESC
      `
    : await prisma.$queryRaw`
        SELECT id, "userId", kind, title, href, 1 AS "occurrenceCount"
        FROM "Notification"
        ORDER BY "createdAt" DESC
      `;
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.userId}|${keyFor(row)}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  const duplicates = [...groups.values()].filter((items) => items.length > 1);
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    notifications: rows.length,
    duplicateGroups: duplicates.length,
    rowsToArchive: duplicates.reduce((sum, items) => sum + items.length - 1, 0)
  }, null, 2));
  if (!apply) return;
  if (!migrated) throw new Error("Apply the notification migration before cleanup.");

  for (const items of groups.values()) {
    const [keeper, ...older] = items;
    const occurrenceCount = items.reduce((sum, item) => sum + item.occurrenceCount, 0);
    await prisma.$transaction([
      prisma.notification.update({
        where: { id: keeper.id },
        data: { groupKey: keyFor(keeper), occurrenceCount }
      }),
      ...(older.length ? [prisma.notification.updateMany({
        where: { id: { in: older.map((item) => item.id) } },
        data: { archivedAt: new Date(), readAt: new Date() }
      })] : [])
    ]);
  }
}

main().finally(() => prisma.$disconnect());
