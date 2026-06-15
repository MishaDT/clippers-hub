import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";

function redirectUrl(path: string, request: Request) {
  const url = new URL(path, request.url);
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return url;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.redirect(redirectUrl("/login?error=bad_credentials", request), 303);
  }
  await createSession(user.id);
  const target = user.role === "CLIENT" ? "/client" : user.role === "ADMIN" ? "/admin" : "/clipper";
  return NextResponse.redirect(redirectUrl(target, request), 303);
}
