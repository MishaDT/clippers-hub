import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const redirects: Record<string, string> = {
  "/index.html": "/",
  "/orders.html": "/campaigns",
  "/wizard.html": "/campaigns/new",
  "/client.html": "/client",
  "/creator.html": "/clipper",
  "/editor.html": "/ai-studio",
  "/marketplace.html": "/leaderboard",
  "/analytics.html": "/analytics"
};

export function middleware(request: NextRequest) {
  const target = redirects[request.nextUrl.pathname];
  if (!target) return NextResponse.next();
  return NextResponse.redirect(new URL(target, request.url));
}
