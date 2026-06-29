import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const CATEGORIES = new Set(["all", "streams", "humor", "games", "business"]);
const DEADLINES = new Set(["any", "3", "7", "later"]);
const SORTS = new Set(["promoted", "rate", "pay", "deadline", "new"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, Math.min(100, Number(url.searchParams.get("page") || 1)));
  const query = String(url.searchParams.get("query") || "").trim().slice(0, 80);
  const category = CATEGORIES.has(String(url.searchParams.get("category"))) ? String(url.searchParams.get("category")) : "all";
  const deadline = DEADLINES.has(String(url.searchParams.get("deadline"))) ? String(url.searchParams.get("deadline")) : "any";
  const sort = SORTS.has(String(url.searchParams.get("sort"))) ? String(url.searchParams.get("sort")) : "promoted";
  const take = 12;
  const now = new Date();
  const deadlineDate = deadline === "3" || deadline === "7" ? new Date(now.getTime() + Number(deadline) * 86400000) : null;

  const where: Prisma.CampaignWhereInput = {
    status: { in: ["ACTIVE", "LOW_BUDGET"] },
    visibility: { in: ["PUBLIC", "FEATURED"] },
    ...(query ? { OR: [
      { title: { contains: query, mode: "insensitive" as const } },
      { description: { contains: query, mode: "insensitive" as const } },
      { niche: { contains: query, mode: "insensitive" as const } }
    ] } : {}),
    ...(deadlineDate ? { deadline: { lte: deadlineDate } } : deadline === "later" ? { deadline: { gt: new Date(now.getTime() + 7 * 86400000) } } : {}),
    ...(category === "streams" ? { sourcePlatform: "TWITCH" as const } : {}),
    ...(category === "games" ? { niche: "Gaming" } : {}),
    ...(category === "business" ? { niche: { in: ["Business", "Brand", "Finance", "Career", "Design"] } } : {})
  };
  const orderBy = sort === "rate" ? { cpmRateCents: "desc" as const }
    : sort === "deadline" ? { deadline: "asc" as const }
      : { createdAt: "desc" as const };
  const [items, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy,
      skip: (page - 1) * take,
      take,
      select: {
        id: true, title: true, description: true, cpmRateCents: true, viewThreshold: true,
        deadline: true, niche: true, visibility: true, featuredUntil: true, remainingBudgetCents: true,
        owner: { select: { name: true, handle: true, avatar: true } },
        _count: { select: { submissions: true } }
      }
    }),
    prisma.campaign.count({ where })
  ]);
  return NextResponse.json({ items, page, totalPages: Math.max(1, Math.ceil(total / take)) });
}
