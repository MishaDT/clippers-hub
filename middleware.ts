import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const redirects: Record<string, string> = {
  "/index.html": "/",
  "/orders.html": "/campaigns",
  "/wizard.html": "/campaigns/new",
  "/client.html": "/profile",
  "/creator.html": "/profile"
};

export function middleware(request: NextRequest) {
  const target = redirects[request.nextUrl.pathname];
  if (!target) return NextResponse.next();
  return NextResponse.redirect(new URL(target, request.url));
}
