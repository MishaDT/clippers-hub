import { NextResponse } from "next/server";
import { handleStripeWebhook, verifyStripeSignature } from "@/lib/payment-webhooks";

export async function POST(request: Request) {
  const body = await request.text();
  if (!verifyStripeSignature(body, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }
  const result = await handleStripeWebhook(body);
  return NextResponse.json(result);
}
