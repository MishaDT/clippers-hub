import type { NextConfig } from "next";
import path from "node:path";

// The Content-Security-Policy is set per-request in middleware.ts so it can carry a fresh
// nonce (script-src is nonce-gated, no 'unsafe-inline'). The static headers below apply to
// every route.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" }
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: false,
  outputFileTracingRoot: path.join(process.cwd()),
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb"
    }
  },
  images: {
    unoptimized: true
  },
  async headers() {
    return [
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800"
          }
        ]
      },
      {
        source: "/(.*)",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
