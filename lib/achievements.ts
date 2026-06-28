// Achievement catalogue. RP are bonus points: 1 RP has 1 ₽ of in-product
// value, but cannot be withdrawn or converted into the cash balance.

export type AchievementStats = {
  approvedClips: number;
  totalClips: number;
  weekViews: number;
  bestClipViews: number;
  streakDays: number;
  referrals: number;
  campaigns: number;
  clipsReceived: number;
  completedOrders: number;
};

export type AchievementRole = "worker" | "client" | "any";

export type AchievementDef = {
  code: string;
  title: string;
  description: string;
  icon: string;
  reward: number;
  role: AchievementRole;
  target: number;
  metric: keyof AchievementStats;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: "FIRST_CLIP", title: "Первый клип", description: "Первая принятая работа", icon: "play", reward: 25, role: "worker", target: 1, metric: "approvedClips" },
  { code: "RISING_STAR", title: "Восходящая звезда", description: "10 000 просмотров за неделю", icon: "star", reward: 30, role: "worker", target: 10_000, metric: "weekViews" },
  { code: "CLIPMAKER", title: "Клипмейкер", description: "50 опубликованных клипов", icon: "scissors", reward: 150, role: "worker", target: 50, metric: "totalClips" },
  { code: "STREAK_7", title: "Серия 7 дней", description: "7 дней подряд с публикациями", icon: "flame", reward: 40, role: "worker", target: 7, metric: "streakDays" },
  { code: "VIRAL_HIT", title: "Вирусный", description: "100 000 просмотров на одном клипе", icon: "flame", reward: 100, role: "worker", target: 100_000, metric: "bestClipViews" },
  { code: "MILLION_CLUB", title: "Клуб миллиона", description: "1 000 000 просмотров на клипе", icon: "trophy", reward: 300, role: "worker", target: 1_000_000, metric: "bestClipViews" },
  { code: "CONNECTOR", title: "Амбассадор", description: "Пригласи 3 друзей на платформу", icon: "users", reward: 75, role: "any", target: 3, metric: "referrals" },
  { code: "FIRST_CAMPAIGN", title: "Первый заказ", description: "Опубликуй первую кампанию", icon: "megaphone", reward: 25, role: "client", target: 1, metric: "campaigns" },
  { code: "PRODUCER", title: "Продюсер", description: "Собери 25 роликов на свои заказы", icon: "film", reward: 150, role: "client", target: 25, metric: "clipsReceived" }
];

export function achievementByCode(code: string) {
  return ACHIEVEMENTS.find((item) => item.code === code) || null;
}

export function achievementProgress(def: AchievementDef, stats: AchievementStats) {
  const value = Math.max(0, stats[def.metric] || 0);
  const done = value >= def.target;
  const pct = Math.min(100, Math.round((value / def.target) * 100));
  return { value, done, pct };
}

export const RP_BOOST_COST = 100;
export const RP_MAX_FEATURED_DAYS = 7;

export function formatRp(balance: number) {
  return `${new Intl.NumberFormat("ru-RU").format(balance)} RP`;
}

export function nextFeaturedUntil(current: Date | null, now = new Date()) {
  const base = current && current > now ? current : now;
  const next = new Date(base.getTime() + 86400000);
  const limit = new Date(now.getTime() + RP_MAX_FEATURED_DAYS * 86400000);
  return next <= limit ? next : null;
}
