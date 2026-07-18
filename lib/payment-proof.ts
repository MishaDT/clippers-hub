export type DepositProof = {
  amountCents: number;
  currency: string;
  userId: string;
  source: string;
};

export function depositProofMatches(
  transaction: { amountCents: number; userId: string },
  proof: DepositProof
) {
  return Number.isSafeInteger(proof.amountCents)
    && proof.amountCents > 0
    && proof.amountCents === transaction.amountCents
    && proof.currency.toUpperCase() === "RUB"
    && proof.userId === transaction.userId
    && proof.source === "wallet_deposit";
}
