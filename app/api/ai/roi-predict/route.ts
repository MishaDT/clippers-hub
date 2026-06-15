import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    roi: 3.4,
    expectedViews: 2500000,
    expectedClips: 260,
    expectedWorkers: 86,
    confidence: 0.71
  });
}
