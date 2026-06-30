import { prisma } from "@/lib/prisma";
import { fetchPublicImage } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offer = await prisma.storeOffer.findFirst({
    where: { id, active: true },
    select: { imageUrl: true }
  });
  if (!offer?.imageUrl) return new Response(null, { status: 404 });

  try {
    const image = await fetchPublicImage(offer.imageUrl);
    return new Response(image.body, {
      headers: {
        "content-type": image.contentType,
        "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
