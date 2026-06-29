import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ externalId: string }> }) {
  const { externalId } = await params;
  const offer = await prisma.storeOffer.findUnique({
    where: { externalId },
    select: { source: true, imageUrl: true }
  });
  if (offer?.source !== "PAMPADU" || !offer.imageUrl) return new Response(null, { status: 404 });

  let imageUrl: URL;
  try {
    imageUrl = new URL(offer.imageUrl);
  } catch {
    return new Response(null, { status: 404 });
  }
  if (imageUrl.protocol !== "https:" || imageUrl.hostname !== "agents.pampadu.ru" || imageUrl.pathname !== "/api/file/ViewFile") {
    return new Response(null, { status: 404 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(imageUrl, {
      cache: "no-store",
      signal: controller.signal,
      headers: { referer: "https://ppdu.ru/" }
    });
    if (!response.ok) return new Response(null, { status: 502 });
    const contentType = response.headers.get("content-type")?.split(";")[0] || "";
    if (!["image/png", "image/jpeg", "image/webp"].includes(contentType)) return new Response(null, { status: 415 });
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > 1_500_000) return new Response(null, { status: 413 });
    return new Response(body, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    return new Response(null, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
