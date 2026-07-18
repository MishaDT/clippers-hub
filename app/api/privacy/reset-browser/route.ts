import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BROWSER_DATA_COOKIES } from "@/lib/browser-data";
import { strictSameOrigin } from "@/lib/security";
import { destroySession } from "@/lib/auth";

export async function POST(request: Request) {
  if (!strictSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "invalid_origin" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  // Revoke the server-side session before clearing the browser copy. Merely deleting
  // the cookie would leave a stolen bearer token usable until its natural expiry.
  await destroySession();
  const jar = await cookies();
  for (const name of BROWSER_DATA_COOKIES) {
    jar.delete(name);
  }
  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
  return response;
}
