import { NextResponse } from "next/server";
import { hasValidBearerSecret } from "@/lib/bearer-auth";
import { syncViews } from "@/lib/social-sync";

// Allow up to 60s — a sync may poll many submissions against external APIs.
export const maxDuration = 60;

// When CRON_SECRET is set, only callers presenting it may run the sync.
// Vercel Cron automatically sends `Authorization: Bearer ${CRON_SECRET}`.
async function run() {
  const result = await syncViews();
  return NextResponse.json(result);
}

// Vercel Cron triggers via GET.
export async function GET(request: Request) {
  if (!hasValidBearerSecret(request, process.env.CRON_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return run();
}

// Manual / programmatic trigger.
export async function POST(request: Request) {
  if (!hasValidBearerSecret(request, process.env.CRON_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return run();
}
