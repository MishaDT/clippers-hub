import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runWatermarkQueue } from "@/lib/video-checks";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(50, Math.max(1, Number(body.limit || 20)));
  const results = await runWatermarkQueue(prisma, limit);
  return NextResponse.json({ ok: true, processed: results.length });
}
