import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ minCents: 48000, maxCents: 92000, confidence: 0.74 });
}
