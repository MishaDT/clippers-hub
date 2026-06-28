export const SPECIALTIES = [
  "Стримы",
  "Подкасты",
  "Игры",
  "Бизнес",
  "Образование",
  "Юмор",
  "Спорт",
  "Технологии"
] as const;

export const SOCIAL_HOSTS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "vk.com",
  "twitch.tv",
  "t.me"
] as const;

export function normalizeHandle(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function validateHandle(value: unknown) {
  const handle = normalizeHandle(value);
  return {
    handle,
    ok: /^[a-z0-9_]{3,24}$/.test(handle)
  };
}

export function canChangeHandle(lastChangedAt: Date | null, now = new Date()) {
  if (!lastChangedAt) return true;
  return now.getTime() - lastChangedAt.getTime() >= 30 * 24 * 60 * 60 * 1000;
}

export function parseSpecialties(values: unknown[]) {
  return [...new Set(values.map(String))]
    .filter((value): value is (typeof SPECIALTIES)[number] =>
      SPECIALTIES.includes(value as (typeof SPECIALTIES)[number]))
    .slice(0, 5);
}

export function parseSocialLinks(value: unknown) {
  const raw = String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const links: string[] = [];
  for (const item of raw) {
    try {
      const url = new URL(item);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (url.protocol !== "https:" || !SOCIAL_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) continue;
      links.push(url.toString());
    } catch {}
  }
  return [...new Set(links)].slice(0, 5);
}

export function isPortfolioEligible(status: string, verifiedAt: Date | null) {
  return Boolean(verifiedAt) && ["VERIFIED", "THRESHOLD_MET", "SETTLING", "PAID"].includes(status);
}
