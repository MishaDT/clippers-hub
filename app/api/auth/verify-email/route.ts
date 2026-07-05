import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { consumeEmailVerification, sendEmailVerification } from "@/lib/email-verification";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sameOrigin } from "@/lib/security";
import { safeReturnTo } from "@/lib/navigation";

function redirectUrl(path: string, request: Request) {
  const url = new URL(path, request.url);
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return url;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("token") || "";
  const returnTo = safeReturnTo(requestUrl.searchParams.get("returnTo"), "/profile");
  const verified = await consumeEmailVerification(token);
  const resultQuery = new URLSearchParams({
    status: verified ? "verified" : "invalid",
    returnTo
  });
  return NextResponse.redirect(
    redirectUrl(`/verify-email?${resultQuery}`, request),
    303
  );
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.redirect(redirectUrl("/verify-email?status=invalid", request), 303);
  }
  const formData = await request.formData();
  const returnTo = safeReturnTo(formData.get("returnTo"), "/profile");
  const resultPath = (status: string) => `/verify-email?${new URLSearchParams({ status, returnTo })}`;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(redirectUrl("/login", request), 303);
  if (user.emailVerifiedAt) {
    return NextResponse.redirect(redirectUrl(resultPath("verified"), request), 303);
  }
  if (!(await rateLimit(`verify-email:${user.id}:${clientIp(request)}`, 3, 60 * 60 * 1000))) {
    return NextResponse.redirect(redirectUrl(resultPath("limited"), request), 303);
  }

  const result = await sendEmailVerification({ userId: user.id, email: user.email, name: user.name, returnTo });
  return NextResponse.redirect(
    redirectUrl(resultPath(result.sent ? "sent" : "unavailable"), request),
    303
  );
}
