export type ReferralTierInput = {
  minActiveReferrals: number;
  rateBps: number;
  title: string;
};

export function selectReferralTier(tiers: ReferralTierInput[], activeReferrals: number) {
  return [...tiers]
    .filter((tier) => tier.minActiveReferrals <= activeReferrals)
    .sort((a, b) => b.minActiveReferrals - a.minActiveReferrals)[0] || null;
}

export function referralCommissionCents(baseFeeCents: number, rateBps: number) {
  const fee = Math.max(0, Math.floor(baseFeeCents));
  const rate = Math.max(0, Math.min(2500, Math.floor(rateBps)));
  return Math.floor((fee * rate) / 10_000);
}
