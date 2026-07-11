import "server-only";

import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { stringify } from "@/lib/json";

type Db = PrismaClient | Prisma.TransactionClient;

export async function appendOwnershipEvidence(db: Db, input: {
  submissionId: string;
  socialAccountId?: string | null;
  method: string;
  status: string;
  platformPostId?: string | null;
  source: string;
  details?: unknown;
  moderatorId?: string | null;
}) {
  const detailsJson = stringify(input.details || {});
  const evidenceHash = createHash("sha256")
    .update([input.submissionId, input.socialAccountId || "", input.method, input.status, input.platformPostId || "", input.source, detailsJson].join("\u001f"))
    .digest("base64url");
  return db.submissionOwnershipEvidence.create({
    data: { ...input, detailsJson, evidenceHash }
  });
}
