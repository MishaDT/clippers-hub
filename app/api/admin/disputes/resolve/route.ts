import { NextResponse } from "next/server";
import { adminResolveDisputeAction } from "@/app/admin/actions";
import { readFormDataWithLimit } from "@/lib/request-json";
import { strictSameOrigin } from "@/lib/security";

export async function POST(request: Request) {
  if (!strictSameOrigin(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }

  const formData = await readFormDataWithLimit(request, 16_000).catch(() => null);
  if (!formData) {
    return NextResponse.redirect(new URL("/admin/disputes?error=request", request.url), 303);
  }

  await adminResolveDisputeAction(formData);
  return NextResponse.redirect(new URL("/admin/disputes?resolved=1", request.url), 303);
}
