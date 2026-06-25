import { NextResponse } from "next/server";
import { syncViews } from "@/lib/social-sync";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await syncViews();
  return NextResponse.json(result);
}
