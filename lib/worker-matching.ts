type WorkerMatchCampaign = {
  niche: string | null;
  sourcePlatform: string;
  deadline: Date | string;
  reviewMode?: string;
  viewThreshold: number;
};

type WorkerMatchProfile = {
  specialties: string[];
  completedNiches: string[];
  completedPlatforms: string[];
  trustScore: number;
  verified: boolean;
  averageViews: number;
  activeOrders: number;
};

const SPECIALTY_KEYWORDS: Record<string, string[]> = {
  "Стримы": ["stream", "стрим", "twitch"],
  "Подкасты": ["podcast", "подкаст", "интервью"],
  "Игры": ["gaming", "game", "игр"],
  "Бизнес": ["business", "brand", "finance", "career", "design", "бизнес", "бренд", "финанс", "карьер", "дизайн"],
  "Образование": ["education", "school", "обуч", "образован"],
  "Юмор": ["humor", "comedy", "юмор", "смеш", "мем"],
  "Спорт": ["sport", "fitness", "спорт", "фитнес"],
  "Технологии": ["tech", "technology", "ai", "технолог", "ии"]
};

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function specialtyMatches(specialty: string, niche: string) {
  const keys = SPECIALTY_KEYWORDS[specialty] || [normalize(specialty)];
  return keys.some((key) => niche.includes(normalize(key)));
}

export function workerMatch(
  campaign: WorkerMatchCampaign,
  profile: WorkerMatchProfile,
  now = new Date()
) {
  const niche = normalize(campaign.niche);
  const completedNiches = new Set(profile.completedNiches.map(normalize).filter(Boolean));
  const completedPlatforms = new Set(profile.completedPlatforms.map(normalize).filter(Boolean));
  const reasons: string[] = [];
  let score = 25;

  if (niche && profile.specialties.some((item) => specialtyMatches(item, niche))) {
    score += 30;
    reasons.push("Подходит специализация");
  }
  if (niche && completedNiches.has(niche)) {
    score += 15;
    reasons.push("Есть опыт в этой теме");
  }
  if (completedPlatforms.has(normalize(campaign.sourcePlatform))) {
    score += 10;
    reasons.push("Работал с этой площадкой");
  }
  if (profile.verified) {
    score += 8;
    reasons.push("Личность подтверждена");
  }

  score += Math.round(Math.max(-10, Math.min(10, (profile.trustScore - 80) / 2)));

  if (profile.averageViews >= campaign.viewThreshold) {
    score += 8;
    reasons.push("Средний охват выше цели");
  } else if (profile.averageViews >= campaign.viewThreshold / 2) {
    score += 4;
  }

  if (profile.activeOrders >= 3) {
    score -= 18;
    reasons.push("Сейчас высокая загрузка");
  } else if (profile.activeOrders === 0) {
    score += 4;
    reasons.push("Свободен для нового заказа");
  }

  const hoursLeft = (new Date(campaign.deadline).getTime() - now.getTime()) / 3_600_000;
  if (hoursLeft < 24) score -= 12;
  if (campaign.reviewMode === "FAST" && profile.trustScore < 90) score -= 8;

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons: reasons.slice(0, 3)
  };
}
