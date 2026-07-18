import "server-only";

import { timingSafeEqual } from "node:crypto";

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function hasValidBearerSecret(request: Request, secret: string | undefined) {
  if (!secret) return process.env.NODE_ENV !== "production";
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  return constantTimeEqual(authorization.slice(7), secret);
}
