export function ratingParties(input: {
  authorId: string;
  ownerId: string;
  workerId: string;
  status: string;
}) {
  if (input.status !== "PAID") return null;
  if (input.authorId === input.ownerId && input.authorId !== input.workerId) {
    return { subjectId: input.workerId, authorRole: "CLIENT" as const };
  }
  if (input.authorId === input.workerId && input.authorId !== input.ownerId) {
    return { subjectId: input.ownerId, authorRole: "WORKER" as const };
  }
  return null;
}
