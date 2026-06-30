import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const redirects: Record<string, string> = {
  "/index.html": "/",
  "/orders.html": "/campaigns",
  "/wizard.html": "/campaigns/new",
  "/client.html": "/profile",
  "/creator.html": "/profile"
};

// Scripts are nonce-gated: Next stamps this nonce onto its own bootstrap <script>, and
// 'strict-dynamic' then trusts the chunk scripts that bootstrap loads. No 'unsafe-inline',
// so an injected inline <script> won't run even if some future XSS slips through. Dev needs
// 'unsafe-eval' (React Fast Refresh) and websocket connect for HMR.
function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' https:",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' https:${isDev ? " ws: wss:" : ""}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "upgrade-insecure-requests"
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const target = redirects[request.nextUrl.pathname];
  if (target) return NextResponse.redirect(new URL(target, request.url));

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  // Next reads the nonce from the CSP on the *request* headers and applies it to its scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Run on documents, not on static assets / the image optimizer / metadata files.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|robots.txt|sitemap.xml|assets/).*)"
  ]
};
