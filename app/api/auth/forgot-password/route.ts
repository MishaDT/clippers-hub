import { createHash } from "node:crypto";
import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeEmail, strictSameOrigin } from "@/lib/security";
import { readFormDataWithLimit } from "@/lib/request-json";
import { sendPasswordReset } from "@/lib/password-reset";
import { emailDeliveryReady } from "@/lib/email-verification";

function redirectUrl(path: string, request: Request) {
  const url = new URL(path, request.url);
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return url;
}

export async function POST(request: Request) {
  if (!strictSameOrigin(request)) return NextResponse.redirect(redirectUrl("/forgot-password?status=invalid", request), 303);
  if (!emailDeliveryReady()) return NextResponse.redirect(redirectUrl("/forgot-password?status=unavailable", request), 303);
  if (!(await rateLimit(`forgot-password:${clientIp(request)}`, 5, 60 * 60_000))) {
    return NextResponse.redirect(redirectUrl("/forgot-password?status=sent", request), 303);
  }

  const formData = await readFormDataWithLimit(request, 8_000).catch(() => null);
  const email = normalizeEmail(formData ? formData.get("email") : null);
  if (!email || email.length > 254) return NextResponse.redirect(redirectUrl("/forgot-password?status=sent", request), 303);

  const accountKey = createHash("sha256").update(email).digest("hex").slice(0, 32);
  if (await rateLimit(`forgot-password-account:${accountKey}`, 3, 60 * 60_000)) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, accountStatus: true } });
    if (user && user.accountStatus !== "BANNED") {
      // Send after the response so request timing does not reveal whether the account exists.
      after(async () => {
        await sendPasswordReset({ userId: user.id, email: user.email, name: user.name });
      });
    }
  }

  // Always the same answer: nobody can discover whether an email is registered.
  return NextResponse.redirect(redirectUrl("/forgot-password?status=sent", request), 303);
}
