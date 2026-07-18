import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runWatermarkQueue } from "@/lib/video-checks";
import { readJsonWithLimit } from "@/lib/request-json";
import { boundedInteger } from "@/lib/numbers";

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

  const body = await readJsonWithLimit(request, 1_024).catch(() => ({}));
  const limitValue = body && typeof body === "object" && "limit" in body
    ? (body as { limit?: unknown }).limit
    : undefined;
  const limit = boundedInteger(limitValue, { min: 1, max: 50, fallback: 20 });
  const results = await runWatermarkQueue(prisma, limit);
  return NextResponse.json({ ok: true, processed: results.length });
}
