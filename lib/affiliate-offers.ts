import "server-only";

import type { AffiliateOffer } from "@/components/affiliate-carousel";

type RawOffer = AffiliateOffer;

function validOffer(value: unknown): value is RawOffer {
  if (!value || typeof value !== "object") return false;
  const offer = value as Partial<RawOffer>;
  if (!offer.id || !offer.title || !offer.description || !offer.eyebrow) return false;
  if (offer.qrDataUrl && !offer.qrDataUrl.startsWith("https://") && !offer.qrDataUrl.startsWith("data:image/")) return false;
  if (!offer.href) return true;
  try {
    return new URL(offer.href).protocol === "https:";
  } catch {
    return false;
  }
}

export async function loadAffiliateOffers(): Promise<AffiliateOffer[]> {
  let configured: unknown = [];
  try {
    configured = JSON.parse(process.env.AFFILIATE_OFFERS_JSON || "[]");
  } catch {
    configured = [];
  }
  const offers = Array.isArray(configured) ? configured.filter(validOffer).slice(0, 6) : [];
  if (!offers.length) {
    return [{
      id: "partner-placeholder",
      eyebrow: "Партнёрская витрина",
      title: "Финансовые продукты",
      description: "Скоро здесь появятся проверенные предложения банков и сервисов."
    }];
  }
  return offers;
}
