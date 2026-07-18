import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { referralFingerprint } from "@/lib/referral-attribution";
import { normalizeTrackingTarget } from "@/lib/tracking-links";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-zA-Z0-9_-]{8,32}$/.test(code)) return NextResponse.redirect(new URL("/", request.url));
  const link = await prisma.campaignTrackingLink.findUnique({
    where: { code },
    select: { id: true, targetUrl: true, active: true, campaign: { select: { isDemo: true } } }
  });
  if (!link?.active) return NextResponse.redirect(new URL("/", request.url));
  const targetUrl = normalizeTrackingTarget(link.targetUrl);
  if (!targetUrl) return NextResponse.redirect(new URL("/", request.url));

  if (await rateLimit(`campaign-click:${link.id}:${clientIp(request)}`, 12, 60 * 60 * 1000)) {
    let refererHost: string | null = null;
    try { refererHost = new URL(request.headers.get("referer") || "").hostname.slice(0, 120) || null; } catch { /* no referrer */ }
    await prisma.campaignClick.create({
      data: {
        trackingLinkId: link.id,
        ipHash: referralFingerprint(clientIp(request)),
        userAgentHash: referralFingerprint(request.headers.get("user-agent") || ""),
        refererHost
      }
    }).catch(() => undefined);
  }
  return NextResponse.redirect(targetUrl, { headers: { "Cache-Control": "no-store, private" } });
}
