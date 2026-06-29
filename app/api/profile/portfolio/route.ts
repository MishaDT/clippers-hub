import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPortfolioEligible } from "@/lib/profile-rules";

const PAGE_SIZE = 12;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const url = new URL(request.url);
  const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page") || 1)));
  const query = String(url.searchParams.get("q") || "").trim().slice(0, 80);
  const where: Prisma.SubmissionWhereInput = {
    workerId: user.id,
    verifiedAt: { not: null },
    status: { in: ["VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"] },
    ...(query ? { campaign: { title: { contains: query, mode: "insensitive" as const } } } : {})
  };
  const [items, total, pins] = await Promise.all([
    prisma.submission.findMany({
      where,
      select: { id: true, currentViews: true, campaign: { select: { title: true } } },
      orderBy: { currentViews: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    }),
    prisma.submission.count({ where }),
    prisma.portfolioPin.findMany({ where: { userId: user.id }, select: { submissionId: true } })
  ]);
  return NextResponse.json({
    items,
    pinnedIds: pins.map((pin) => pin.submissionId),
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE))
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { action?: string; submissionId?: string; pinId?: string; direction?: string };

  if (body.action === "pin" && body.submissionId) {
    const submission = await prisma.submission.findFirst({
      where: { id: body.submissionId, workerId: user.id },
      select: { id: true, status: true, verifiedAt: true }
    });
    if (!submission || !isPortfolioEligible(submission.status, submission.verifiedAt)) {
      return NextResponse.json({ error: "NOT_ELIGIBLE" }, { status: 400 });
    }
    const pins = await prisma.portfolioPin.findMany({ where: { userId: user.id }, orderBy: { position: "asc" } });
    if (pins.some((pin) => pin.submissionId === submission.id)) return NextResponse.json({ ok: true });
    const position = [0, 1, 2, 3, 4, 5].find((value) => !pins.some((pin) => pin.position === value));
    if (position === undefined) return NextResponse.json({ error: "LIMIT" }, { status: 400 });
    await prisma.portfolioPin.create({ data: { userId: user.id, submissionId: submission.id, position } });
  } else if (body.action === "remove" && body.pinId) {
    await prisma.portfolioPin.deleteMany({ where: { id: body.pinId, userId: user.id } });
  } else if (body.action === "move" && body.pinId) {
    const direction = body.direction === "up" ? -1 : 1;
    const pin = await prisma.portfolioPin.findFirst({ where: { id: body.pinId, userId: user.id } });
    if (pin) {
      const other = await prisma.portfolioPin.findFirst({ where: { userId: user.id, position: pin.position + direction } });
      if (other) {
        await prisma.$transaction([
          prisma.portfolioPin.update({ where: { id: pin.id }, data: { position: -1 } }),
          prisma.portfolioPin.update({ where: { id: other.id }, data: { position: pin.position } }),
          prisma.portfolioPin.update({ where: { id: pin.id }, data: { position: other.position } })
        ]);
      }
    }
  } else {
    return NextResponse.json({ error: "BAD_ACTION" }, { status: 400 });
  }

  const pins = await prisma.portfolioPin.findMany({
    where: { userId: user.id },
    orderBy: { position: "asc" },
    include: { submission: { select: { id: true, currentViews: true, campaign: { select: { title: true } } } } }
  });
  return NextResponse.json({ ok: true, pins });
}
