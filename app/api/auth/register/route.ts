import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  handle: z.string().min(3).regex(/^[a-z0-9_]+$/i),
  role: z.enum(["CLIENT", "WORKER", "BOTH"])
});

function redirectUrl(path: string, request: Request) {
  const url = new URL(path, request.url);
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return url;
}

export async function POST(request: Request) {
  const input = schema.parse(Object.fromEntries(await request.formData()));
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password),
      name: input.name,
      handle: input.handle.toLowerCase(),
      role: input.role,
      referralCode: `${input.handle.toUpperCase().slice(0, 10)}${Math.floor(Math.random() * 90 + 10)}`
    }
  });
  await createSession(user.id);
  return NextResponse.redirect(redirectUrl("/feed", request), 303);
}
