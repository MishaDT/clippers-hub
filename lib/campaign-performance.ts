export type CampaignPerformanceInput = {
  views: number;
  clicks: number;
  spentCents: number;
  leads: number;
  sales: number;
  revenueCents: number;
};

export function calculateCampaignPerformance(input: CampaignPerformanceInput) {
  const views = Math.max(0, input.views);
  const clicks = Math.max(0, input.clicks);
  const spentCents = Math.max(0, input.spentCents);
  const leads = Math.max(0, input.leads);
  const sales = Math.max(0, input.sales);
  const revenueCents = Math.max(0, input.revenueCents);

  return {
    ctrPercent: views > 0 ? (clicks / views) * 100 : null,
    costPerClickCents: clicks > 0 ? Math.round(spentCents / clicks) : null,
    costPerLeadCents: leads > 0 ? Math.round(spentCents / leads) : null,
    costPerSaleCents: sales > 0 ? Math.round(spentCents / sales) : null,
    roasPercent: spentCents > 0 && revenueCents > 0 ? (revenueCents / spentCents) * 100 : null
  };
}
