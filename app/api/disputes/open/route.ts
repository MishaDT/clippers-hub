import { NextResponse } from "next/server";
import { openDisputeAction } from "@/app/actions";
import { readFormDataWithLimit } from "@/lib/request-json";
import { strictSameOrigin } from "@/lib/security";

export async function POST(request: Request) {
  if (!strictSameOrigin(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }

  const formData = await readFormDataWithLimit(request, 16_000).catch(() => null);
  if (!formData) {
    return NextResponse.redirect(new URL("/campaigns?error=dispute_request", request.url), 303);
  }

  const state = await openDisputeAction({ status: "idle" }, formData);
  return NextResponse.redirect(new URL(state.redirectTo || "/campaigns", request.url), 303);
}
