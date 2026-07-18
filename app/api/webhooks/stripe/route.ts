import { NextResponse } from "next/server";
import { handleStripeWebhook, verifyStripeSignature } from "@/lib/payment-webhooks";
import { readTextWithLimit } from "@/lib/request-json";

export async function POST(request: Request) {
  const body = await readTextWithLimit(request, 128_000).catch(() => null);
  if (body === null) return NextResponse.json({ error: "invalid_body" }, { status: 413 });
  if (!verifyStripeSignature(body, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }
  const result = await handleStripeWebhook(body);
  return NextResponse.json(result);
}
