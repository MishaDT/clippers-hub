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
  if (target) return NextResponse.redirect(new URL(target, request.url));
  const response = NextResponse.next();
  if (request.nextUrl.pathname === "/store" || request.nextUrl.pathname.startsWith("/store/")) {
    response.headers.set("Content-Security-Policy", [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "frame-src 'none'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' https:",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https:",
      "font-src 'self' data:",
      "object-src 'none'",
      "upgrade-insecure-requests"
    ].join("; "));
  }
  return response;
}
