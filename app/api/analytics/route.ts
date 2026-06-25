import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  type: z.string().max(40).default("PAGE_VIEW"),
  path: z.string().max(240).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export async function POST(request: Request) {
  if (!rateLimit(`analytics:${clientIp(request)}`, 80, 60_000)) {
    return NextResponse.json({ ok: true });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const user = await getCurrentUser();
  await trackEvent({
    request,
    userId: user?.id,
    type: parsed.data.type,
    path: parsed.data.path,
    metadata: parsed.data.metadata
  });

  return NextResponse.json({ ok: true });
}
