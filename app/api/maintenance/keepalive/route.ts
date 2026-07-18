import { NextResponse } from "next/server";
import { hasValidBearerSecret } from "@/lib/bearer-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(request: Request) {
  if (!hasValidBearerSecret(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const startedAt = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json(
    { ok: true, latencyMs: Date.now() - startedAt },
    { headers: { "Cache-Control": "no-store" } }
  );
}
