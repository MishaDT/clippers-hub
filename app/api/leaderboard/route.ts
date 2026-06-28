import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const period = url.searchParams.get("period") === "all" ? "all" : "week";
  const cursor = Math.max(0, Math.min(10_000, Number(url.searchParams.get("cursor") || 0) || 0));
  const limit = Math.max(10, Math.min(30, Number(url.searchParams.get("limit") || 10) || 10));
  const since = new Date(Date.now() - 7 * 86400000);
  const groups = await prisma.submission.groupBy({
    by: ["workerId"],
    where: period === "week" ? { updatedAt: { gte: since } } : {},
    _sum: { currentViews: true },
    _count: { _all: true },
    orderBy: { _sum: { currentViews: "desc" } },
    skip: cursor,
    take: limit + 1
  });
  const page = groups.slice(0, limit);
  const users = await prisma.user.findMany({
    where: { id: { in: page.map((row) => row.workerId) } },
    select: { id: true, name: true, handle: true, avatar: true, lifetimeViews: true, kycStatus: true }
  });
  const byId = new Map(users.map((user) => [user.id, user]));
  return NextResponse.json({
    items: page.map((row, index) => ({ rank: cursor + index + 1, ...byId.get(row.workerId), views: row._sum.currentViews || 0, clips: row._count._all })),
    nextCursor: groups.length > limit ? cursor + limit : null
  }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
