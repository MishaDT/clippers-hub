export type PayoutDetailsInput = {
  payoutFullName?: string | null;
  payoutInn?: string | null;
  payoutAccount?: string | null;
  payoutBik?: string | null;
  payoutPhone?: string | null;
  selfEmployedConfirmedAt?: Date | null;
};

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizePayoutDetails(input: Record<string, unknown>) {
  const payoutFullName = String(input.payoutFullName || "").trim().replace(/\s+/g, " ").slice(0, 120);
  const payoutInn = digits(input.payoutInn);
  const payoutAccount = digits(input.payoutAccount);
  const payoutBik = digits(input.payoutBik);
  const payoutPhone = digits(input.payoutPhone);

  if (
    payoutFullName.length < 5 ||
    payoutInn.length !== 12 ||
    payoutAccount.length !== 20 ||
    payoutBik.length !== 9 ||
    payoutPhone.length < 10 ||
    payoutPhone.length > 15
  ) return null;

  return { payoutFullName, payoutInn, payoutAccount, payoutBik, payoutPhone };
}

export function hasCompletePayoutDetails(input: PayoutDetailsInput) {
  return Boolean(input.selfEmployedConfirmedAt && normalizePayoutDetails(input));
}
