import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2)
});

function redirectUrl(path: string, request: Request) {
  const url = new URL(path, request.url);
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return url;
}

export async function POST(request: Request) {
  if (!rateLimit(`register:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.redirect(redirectUrl("/register?error=too_many", request), 303);
  }
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) {
    return NextResponse.redirect(redirectUrl("/register?error=invalid", request), 303);
  }
  const input = parsed.data;
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
    return NextResponse.redirect(redirectUrl("/register?error=exists", request), 303);
  }
}
