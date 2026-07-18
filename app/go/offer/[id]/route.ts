import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { safeHttpsUrl } from "@/lib/safe-https-url";

const allowedSources = new Set(["card", "qr", "leaderboard"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestUrl = new URL(request.url);
  const source = allowedSources.has(requestUrl.searchParams.get("from") || "")
    ? requestUrl.searchParams.get("from")!
    : "card";
  const offer = await prisma.storeOffer.findFirst({
    where: { id, kind: "PARTNER_LINK", active: true, url: { not: null } },
    select: { id: true, url: true, source: true, provider: true }
  });

  if (!offer?.url) {
    return NextResponse.redirect(new URL("/store?tab=partners&offer=unavailable", request.url), 302);
  }

  const safeDestination = safeHttpsUrl(offer.url);
  if (!safeDestination) {
    return NextResponse.redirect(new URL("/store?tab=partners&offer=invalid", request.url), 302);
  }
  const destination = new URL(safeDestination);

  const user = await getCurrentUser();
  await trackEvent({
    request,
    userId: user?.id,
    type: "STORE_OFFER_CLICK",
    path: `/go/offer/${offer.id}`,
    provider: offer.source || offer.provider,
    metadata: { offerId: offer.id, source }
  });

  return NextResponse.redirect(destination, 302);
}
