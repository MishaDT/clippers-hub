import { NextResponse } from "next/server";
import { handleYooKassaWebhook } from "@/lib/payment-webhooks";
import { readTextWithLimit } from "@/lib/request-json";

export async function POST(request: Request) {
  const body = await readTextWithLimit(request, 128_000).catch(() => null);
  if (body === null) return NextResponse.json({ error: "invalid_body" }, { status: 413 });
  const result = await handleYooKassaWebhook(body);
  return NextResponse.json(result);
}
