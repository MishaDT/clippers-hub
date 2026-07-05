type MatchCampaign = {
  niche: string | null;
  sourcePlatform: string;
  reviewMode?: string;
  deadline: Date | string;
};

type MatchProfile = {
  specialties: string[];
  completedNiches: string[];
  completedPlatforms: string[];
  trustScore: number;
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

function normalized(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function specialtyMatches(specialty: string, niche: string) {
  const keys = SPECIALTY_KEYWORDS[specialty] || [normalized(specialty)];
  return keys.some((key) => niche.includes(normalized(key)));
}

export function campaignMatch(
  campaign: MatchCampaign,
  profile: MatchProfile,
  now = new Date()
) {
  const niche = normalized(campaign.niche);
  const completedNiches = new Set(profile.completedNiches.map(normalized).filter(Boolean));
  const completedPlatforms = new Set(profile.completedPlatforms.map(normalized).filter(Boolean));
  const reasons: string[] = [];
  let score = 30;

  if (niche && profile.specialties.some((item) => specialtyMatches(item, niche))) {
    score += 35;
    reasons.push("Совпадает со специализацией");
  }
  if (niche && completedNiches.has(niche)) {
    score += 20;
    reasons.push("Есть опыт в этой теме");
  }
  if (completedPlatforms.has(normalized(campaign.sourcePlatform))) {
    score += 10;
    reasons.push("Знакомая площадка");
  }

  const hoursLeft = (new Date(campaign.deadline).getTime() - now.getTime()) / 3_600_000;
  if (hoursLeft >= 72) {
    score += 5;
    reasons.push("Комфортный срок");
  } else if (hoursLeft < 24) {
    score -= 15;
  }

  if (campaign.reviewMode === "FAST" && profile.trustScore < 90) {
    score -= 10;
  }

  if (!profile.specialties.length && !profile.completedNiches.length) {
    reasons.push("Заполните специализации для точного подбора");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons: reasons.slice(0, 2)
  };
}
