import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BROWSER_DATA_COOKIES } from "@/lib/browser-data";

export async function POST() {
  const jar = await cookies();
  for (const name of BROWSER_DATA_COOKIES) {
    jar.delete(name);
  }
  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
  return response;
}
