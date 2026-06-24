import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeEmail, sameOrigin, validatePassword } from "@/lib/security";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(2).max(80)
});

function redirectUrl(path: string, request: Request) {
  const url = new URL(path, request.url);
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return url;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.redirect(redirectUrl("/register?error=invalid", request), 303);
  }
  if (!rateLimit(`register:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.redirect(redirectUrl("/register?error=too_many", request), 303);
  }
  const formData = await request.formData();
  const parsed = schema.safeParse({
    email: normalizeEmail(formData.get("email")),
    password: String(formData.get("password") || ""),
    name: String(formData.get("name") || "").trim()
  });
  if (!parsed.success) {
    return NextResponse.redirect(redirectUrl("/register?error=invalid", request), 303);
  }
  const input = parsed.data;
  const passwordError = validatePassword(input.password, input.email);
  if (passwordError) {
    return NextResponse.redirect(redirectUrl("/register?error=weak_password", request), 303);
  }
  const base = input.email.split("@")[0].replace(/[^a-z0-9_]/gi, "").toLowerCase().slice(0, 12) || "user";
  const handle = `${base}${Math.floor(Math.random() * 9000 + 1000)}`;

  try {
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: await hashPassword(input.password),
        name: input.name,
        handle,
        role: "BOTH",
        referralCode: handle.toUpperCase().slice(0, 12)
      }
    });
    await createSession(user.id);
    return NextResponse.redirect(redirectUrl("/feed", request), 303);
  } catch {
    // unique email/handle collision, etc.
    return NextResponse.redirect(redirectUrl("/register?error=register_failed", request), 303);
  }
}
