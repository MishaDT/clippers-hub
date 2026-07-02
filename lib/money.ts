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
  return Math.max(0, Math.round(amount * 100));
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
  return Math.max(0, Math.round((viewThreshold / 1000) * cpmRateCents));
}

// Amount the clipper receives after their rank-specific platform commission.
export function expectedPayout(viewThreshold: number, cpmRateCents: number, rank = "BRONZE") {
  const gross = grossPayout(viewThreshold, cpmRateCents);
  return gross - Math.floor(gross * commissionRate(rank));
}
