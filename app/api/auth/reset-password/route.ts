import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { strictSameOrigin } from "@/lib/security";
import { readFormDataWithLimit } from "@/lib/request-json";
import { resetPassword } from "@/lib/password-reset";

function redirectUrl(path: string, request: Request) {
  const url = new URL(path, request.url);
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return url;
}

export async function POST(request: Request) {
  if (!strictSameOrigin(request)) return NextResponse.redirect(redirectUrl("/reset-password?status=invalid", request), 303);
  if (!(await rateLimit(`reset-password:${clientIp(request)}`, 10, 60 * 60_000))) {
    return NextResponse.redirect(redirectUrl("/reset-password?status=limited", request), 303);
  }
  const formData = await readFormDataWithLimit(request, 12_000).catch(() => null);
  if (!formData) return NextResponse.redirect(redirectUrl("/reset-password?status=invalid", request), 303);
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  if (password !== confirmPassword) {
    return NextResponse.redirect(redirectUrl(`/reset-password?status=mismatch&token=${encodeURIComponent(token)}`, request), 303);
  }
  const result = await resetPassword(token, password);
  if (result === "ok") return NextResponse.redirect(redirectUrl("/login?reset=ok", request), 303);
  return NextResponse.redirect(redirectUrl(`/reset-password?status=${result}&token=${encodeURIComponent(token)}`, request), 303);
}
