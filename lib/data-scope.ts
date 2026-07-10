import type { Prisma } from "@prisma/client";

/** Public/business reporting must never include seed or demo identities. */
export const realUserWhere = {
  isDemo: false
} satisfies Prisma.UserWhereInput;

/** Financial reporting excludes both demo ledger rows and demo identities. */
export const realTransactionWhere = {
  isDemo: false,
  user: { isDemo: false }
} satisfies Prisma.TransactionWhereInput;

/** Rankings and verified-work metrics only use real campaigns and identities. */
export const realSubmissionWhere = {
  campaign: { isDemo: false },
  worker: { isDemo: false }
} satisfies Prisma.SubmissionWhereInput;

/** Anonymous traffic stays measurable; authenticated demo accounts are excluded. */
export const realAnalyticsWhere = {
  OR: [
    { userId: null },
    { user: { is: { isDemo: false } } }
  ]
} satisfies Prisma.AnalyticsEventWhereInput;
