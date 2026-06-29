import { prisma } from "@/lib/prisma";
import { stringify } from "@/lib/json";

export const PAMPADU_WIDGET_ID = "2f0f0fbc-775f-471a-8cc3-783b3e50b904";

type RawAdvantage = { title?: unknown };
type RawOffer = {
  id?: unknown;
  type?: unknown;
  agentUrl?: unknown;
  title?: unknown;
  icon?: unknown;
  disclaimer?: unknown;
  licenseNumber?: unknown;
  bankName?: unknown;
  keyAdvantages?: unknown;
  additionalAdvantages?: unknown;
};

export type ImportedPartnerOffer = {
  externalId: string;
  category: "DEBIT_CARD" | "CREDIT_CARD" | "BUSINESS_ACCOUNT";
  categoryLabel: string;
  provider: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  licenseNumber: string | null;
  disclaimer: string | null;
  features: string[];
  sortOrder: number;
  featured: boolean;
};

const CATEGORY_INFO = {
  "2": { code: "DEBIT_CARD", label: "Дебетовые карты", order: 1000 },
  "5": { code: "CREDIT_CARD", label: "Кредитные карты", order: 2000 },
  "6": { code: "BUSINESS_ACCOUNT", label: "РКО для бизнеса", order: 3000 }
} as const;

function text(value: unknown, max = 8000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function list(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item, 240)).filter(Boolean);
}

function keyAdvantages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text((item as RawAdvantage)?.title, 240)).filter(Boolean);
}

function providerFromTitle(title: string) {
  return title.split(/\s(?:-|—|\|)\s/)[0]?.trim().slice(0, 120) || "Партнёр";
}

function trackingUrl(value: unknown) {
  try {
    const url = new URL(text(value, 2000));
    if (url.protocol !== "https:" || url.hostname !== "trk.ppdu.ru") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function imageUrl(value: unknown) {
  const path = text(value, 1000);
  if (!path.startsWith("/api/file/ViewFile?")) return null;
  return new URL(path, "https://agents.pampadu.ru").toString();
}

async function fetchPublicJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "application/json, text/plain, */*",
        widgetid: PAMPADU_WIDGET_ID,
        referer: `https://ppdu.ru/${PAMPADU_WIDGET_ID}`
      }
    });
    if (!response.ok) throw new Error(`PAMPADU_${response.status}`);
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > 2_000_000) throw new Error("PAMPADU_TOO_LARGE");
    return JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

export function parsePampaduCatalog(payload: Record<string, unknown>) {
  const offers: ImportedPartnerOffer[] = [];

  for (const [type, category] of Object.entries(CATEGORY_INFO)) {
    const rows = Array.isArray(payload[type]) ? payload[type] as RawOffer[] : [];
    rows.forEach((row, index) => {
      const externalId = text(row.id, 80);
      const title = text(row.title, 180);
      const url = trackingUrl(row.agentUrl);
      if (!externalId || !title || !url) return;
      const features = [...new Set([...keyAdvantages(row.keyAdvantages), ...list(row.additionalAdvantages)])].slice(0, 8);
      offers.push({
        externalId,
        category: category.code,
        categoryLabel: category.label,
        provider: text(row.bankName, 140) || providerFromTitle(title),
        title,
        description: features.slice(0, 3).join(" · ") || "Финансовое предложение партнёра",
        url,
        imageUrl: imageUrl(row.icon),
        licenseNumber: text(row.licenseNumber, 240) || null,
        disclaimer: text(row.disclaimer, 8000) || null,
        features,
        sortOrder: category.order + index,
        featured: index === 0
      });
    });
  }
  if (!offers.length) throw new Error("PAMPADU_EMPTY");
  return offers;
}

export async function fetchPampaduCatalog() {
  return parsePampaduCatalog(await fetchPublicJson("https://ppdu.ru/api/widget/getOffers"));
}

export async function syncPampaduCatalog(adminId: string) {
  const offers = await fetchPampaduCatalog();
  const importedAt = new Date();
  const operations = offers.map((offer) => prisma.storeOffer.upsert({
    where: { externalId: offer.externalId },
    create: {
      kind: "PARTNER_LINK",
      source: "PAMPADU",
      externalId: offer.externalId,
      category: offer.category,
      provider: offer.provider,
      title: offer.title,
      description: offer.description,
      url: offer.url,
      imageUrl: offer.imageUrl,
      licenseNumber: offer.licenseNumber,
      disclaimer: offer.disclaimer,
      featuresJson: stringify(offer.features),
      active: true,
      featured: offer.featured,
      sortOrder: offer.sortOrder,
      importedAt
    },
    update: {
      kind: "PARTNER_LINK",
      source: "PAMPADU",
      category: offer.category,
      provider: offer.provider,
      title: offer.title,
      description: offer.description,
      url: offer.url,
      imageUrl: offer.imageUrl,
      licenseNumber: offer.licenseNumber,
      disclaimer: offer.disclaimer,
      featuresJson: stringify(offer.features),
      sortOrder: offer.sortOrder,
      importedAt
    }
  }));
  await prisma.$transaction([
    ...operations,
    prisma.storeOffer.updateMany({
      where: { kind: "PAMPADU_WIDGET" },
      data: { active: false }
    }),
    prisma.storeOffer.updateMany({
      where: { source: "PAMPADU", externalId: { notIn: offers.map((offer) => offer.externalId) } },
      data: { active: false }
    }),
    prisma.auditLog.create({
      data: {
        userId: adminId,
        action: "ADMIN_STORE_PAMPADU_IMPORT",
        entity: "StoreOffer",
        entityId: PAMPADU_WIDGET_ID,
        metadata: stringify({ count: offers.length, importedAt: importedAt.toISOString() })
      }
    })
  ]);
  return offers.length;
}
