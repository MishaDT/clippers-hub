import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const offer = await prisma.storeOffer.findFirst({
    where: { id, kind: "PARTNER_LINK", active: true, url: { not: null } },
    select: { id: true }
  });

  if (!offer) return new Response("Not found", { status: 404 });

  const origin = new URL(request.url).origin;
  const png = await QRCode.toBuffer(`${origin}/go/offer/${encodeURIComponent(offer.id)}?from=qr`, {
    type: "png",
    width: 420,
    margin: 2,
    color: { dark: "#0a0c09", light: "#ffffff" },
    errorCorrectionLevel: "M"
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Disposition": `inline; filename="reelpay-${offer.id}.png"`
    }
  });
}
