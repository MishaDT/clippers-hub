// Pure helpers (safe in server and client components).
// Clipper leagues are derived from lifetime verified views.

export type League = {
  key: "rookie" | "pro" | "legend";
  name: string;
  emoji: string;
  min: number;
  max: number | null;
  color: string;
  glow: string;
};

export const LEAGUES: League[] = [
  { key: "rookie", name: "Новичок", emoji: "🥉", min: 0, max: 100_000, color: "#9ca3af", glow: "rgba(156,163,175,.35)" },
  { key: "pro", name: "Про", emoji: "🥇", min: 100_000, max: 5_000_000, color: "#c9f31d", glow: "rgba(201,243,29,.45)" },
  { key: "legend", name: "Легенда клипов", emoji: "🏆", min: 5_000_000, max: null, color: "#ffd24a", glow: "rgba(255,210,74,.5)" }
];

export function leagueForViews(views: number): League {
  return [...LEAGUES].reverse().find((league) => views >= league.min) ?? LEAGUES[0];
}

export function nextLeague(views: number): League | null {
  const index = LEAGUES.findIndex((league) => league.key === leagueForViews(views).key);
  return LEAGUES[index + 1] ?? null;
}

// 0..1 progress toward the next league (1 when already at the top).
export function leagueProgress(views: number): number {
  const current = leagueForViews(views);
  if (current.max == null) return 1;
  return Math.min(1, Math.max(0, (views - current.min) / (current.max - current.min)));
}

// Client (customer) tiers are derived from the number of campaigns they ran.
export type ClientTier = {
  key: "new" | "active" | "big" | "whale";
  name: string;
  emoji: string;
  min: number;
  canEndorse: boolean;
};

export const CLIENT_TIERS: ClientTier[] = [
  { key: "new", name: "Новый заказчик", emoji: "🌱", min: 0, canEndorse: false },
  { key: "active", name: "Активный", emoji: "⚡", min: 3, canEndorse: false },
  { key: "big", name: "Крупный", emoji: "💼", min: 10, canEndorse: true },
  { key: "whale", name: "Крупная рыба", emoji: "🐳", min: 30, canEndorse: true }
];

export function clientTier(orders: number): ClientTier {
  return [...CLIENT_TIERS].reverse().find((tier) => orders >= tier.min) ?? CLIENT_TIERS[0];
}

export function canEndorse(orders: number) {
  return clientTier(orders).canEndorse;
}
