import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Recent notifications for the bell dropdown, fetched on open instead of on every page render —
// this keeps one findMany off the critical path of every authenticated page.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ items: [] }, { status: 401 });

  const rows = await prisma.notification.findMany({
    where: { userId: user.id, archivedAt: null },
    orderBy: { lastOccurredAt: "desc" },
    take: 6,
    select: { id: true, title: true, body: true, href: true, readAt: true, occurrenceCount: true, lastOccurredAt: true }
  });

  return NextResponse.json({
    items: rows.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      href: item.href,
      read: Boolean(item.readAt),
      occurrenceCount: item.occurrenceCount,
      createdAt: item.lastOccurredAt.toLocaleString("ru-RU", { day: "2-digit", month: "short" })
    }))
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" }
  });
}
