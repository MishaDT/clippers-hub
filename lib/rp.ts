export const WEEKLY_RP_CAP = 120;

export const RECURRING_REWARDS = [
  { code: "WEEK_CLIPS_3", title: "3 ролика за неделю", reward: 20, target: 3, metric: "approvedClips" },
  { code: "WEEK_VIEWS_50K", title: "50K просмотров за неделю", reward: 30, target: 50_000, metric: "weekViews" },
  { code: "WEEK_STREAK_7", title: "Серия 7 дней", reward: 40, target: 7, metric: "streakDays" },
  { code: "WEEK_ORDERS_2", title: "2 завершённых заказа", reward: 30, target: 2, metric: "completedOrders" }
] as const;

export function moscowWeekKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localDate = new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)));
  const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);
  return localDate.toISOString().slice(0, 10);
}

export function splitRpSpend(total: number, purchased: number, cost: number) {
  const bonus = Math.max(0, total - purchased);
  const bonusUsed = Math.min(bonus, cost);
  const purchasedUsed = Math.max(0, cost - bonusUsed);
  return { bonusUsed, purchasedUsed };
}
