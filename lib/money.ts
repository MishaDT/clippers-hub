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

// Expected clipper payout (in cents) for hitting the view goal, net of platform fee.
export function expectedPayout(viewThreshold: number, cpmRateCents: number) {
  return Math.round((viewThreshold / 1000) * cpmRateCents * 0.89);
}
