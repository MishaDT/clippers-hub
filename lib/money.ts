export function rub(cents: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

export function compactNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function parseRubToCents(value: FormDataEntryValue | null) {
  const amount = Number(String(value ?? "0").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const cents = Math.round(amount * 100);
  // Monetary columns use PostgreSQL INTEGER. Keep malformed or overflowing
  // browser input from reaching Prisma and turning into a 500 response.
  return Number.isSafeInteger(cents) && cents <= 2_000_000_000 ? cents : 0;
}

export function commissionRate(rank: string) {
  if (rank === "LEGENDARY") return 0.07;
  if (rank === "DIAMOND") return 0.09;
  if (rank === "GOLD") return 0.11;
  if (rank === "SILVER") return 0.13;
  return 0.15;
}

// Full amount reserved from the client's funded campaign for one successful result.
export function grossPayout(viewThreshold: number, cpmRateCents: number) {
  if (!Number.isFinite(viewThreshold) || !Number.isFinite(cpmRateCents)) return 0;
  const payout = Math.round((Math.max(0, viewThreshold) / 1000) * Math.max(0, cpmRateCents));
  return Number.isSafeInteger(payout) ? Math.min(payout, 2_000_000_000) : 0;
}

// Amount the clipper receives after their rank-specific platform commission.
export function expectedPayout(viewThreshold: number, cpmRateCents: number, rank = "BRONZE") {
  const gross = grossPayout(viewThreshold, cpmRateCents);
  return gross - Math.floor(gross * commissionRate(rank));
}

export function netPayout(grossCents: number, rank = "BRONZE") {
  const gross = Math.max(0, Math.round(grossCents));
  return gross - Math.floor(gross * commissionRate(rank));
}

export function minimumGuaranteedPayout(minimumGuaranteeCents: number, rank = "BRONZE") {
  return netPayout(minimumGuaranteeCents, rank);
}

export function settlementGross({
  views,
  viewThreshold,
  cpmRateCents,
  minimumGuaranteeCents,
  reservedPayoutCents,
  deadlineReached
}: {
  views: number;
  viewThreshold: number;
  cpmRateCents: number;
  minimumGuaranteeCents: number;
  reservedPayoutCents: number;
  deadlineReached: boolean;
}) {
  const reserved = Math.max(0, reservedPayoutCents);
  if (reserved <= 0) return 0;
  if (views >= viewThreshold) return reserved;
  if (!deadlineReached || minimumGuaranteeCents <= 0) return 0;

  const actualByViews = Math.max(0, Math.floor((views / 1000) * cpmRateCents));
  return Math.min(reserved, Math.max(minimumGuaranteeCents, actualByViews));
}

export function settlementReservationSplit({
  reservedPayoutCents,
  grossPayoutCents,
  campaignCompleted
}: {
  reservedPayoutCents: number;
  grossPayoutCents: number;
  campaignCompleted: boolean;
}) {
  const reserved = Math.max(0, reservedPayoutCents);
  const gross = Math.min(reserved, Math.max(0, grossPayoutCents));
  const unused = reserved - gross;
  return {
    reserved,
    gross,
    returnToCampaignCents: campaignCompleted ? 0 : unused,
    refundOwnerCents: campaignCompleted ? unused : 0
  };
}
