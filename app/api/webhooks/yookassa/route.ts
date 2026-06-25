import { NextResponse } from "next/server";
import { handleYooKassaWebhook } from "@/lib/payment-webhooks";

export async function POST(request: Request) {
  const body = await request.text();
  const result = await handleYooKassaWebhook(body);
  return NextResponse.json(result);
}
