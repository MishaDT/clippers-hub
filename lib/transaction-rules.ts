export function adminTransactionTransition(input: {
  type: string;
  currentStatus: string;
  nextStatus: string;
}) {
  if (input.type !== "WITHDRAWAL" || input.currentStatus !== "PENDING") return null;
  if (!["COMPLETED", "FAILED", "REVERSED"].includes(input.nextStatus)) return null;
  return {
    nextStatus: input.nextStatus as "COMPLETED" | "FAILED" | "REVERSED",
    refundBalance: input.nextStatus === "FAILED" || input.nextStatus === "REVERSED"
  };
}
