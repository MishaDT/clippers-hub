// Removes old PAGE_VIEW analytics noise while keeping the last 30 days
// (the admin charts need recent PAGE_VIEW data) and every non-PAGE_VIEW event.
// Dry-run by default; pass --apply to delete. Batched to avoid long locks.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
const DAYS = daysArg ? Math.max(1, Number(daysArg.slice(7))) : 30;

async function main() {
  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const where = { type: "PAGE_VIEW", createdAt: { lt: cutoff } };
  const total = await prisma.analyticsEvent.count({ where });
  const totalAll = await prisma.analyticsEvent.count();
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    keepSinceDays: DAYS,
    totalEvents: totalAll,
    pageViewsToDelete: total
  }, null, 2));
  if (!apply || total === 0) return;

  let deleted = 0;
  for (;;) {
    const batch = await prisma.analyticsEvent.findMany({ where, select: { id: true }, take: 5000 });
    if (!batch.length) break;
    const res = await prisma.analyticsEvent.deleteMany({ where: { id: { in: batch.map((row) => row.id) } } });
    deleted += res.count;
    process.stdout.write(`deleted ${deleted}/${total}\r`);
    if (res.count === 0) break;
  }
  console.log(`\ndone: deleted ${deleted} old PAGE_VIEW events`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
