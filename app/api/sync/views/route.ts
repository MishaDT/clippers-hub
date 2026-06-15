import { NextResponse } from "next/server";
import { syncMockViews } from "@/lib/social-sync";

export async function POST() {
  const result = await syncMockViews();
  return NextResponse.json(result);
}
