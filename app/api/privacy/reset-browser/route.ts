import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const RESET_COOKIES = ["clippers_session", "rp_consent", "oauth_state", "oauth_verifier", "oauth_provider", "oauth_intent"];

export async function POST() {
  const jar = await cookies();
  for (const name of RESET_COOKIES) {
    jar.delete(name);
  }
  return NextResponse.json({ ok: true });
}
