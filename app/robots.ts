import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://clippers-hub-mdt.netlify.app");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/wallet",
        "/settings",
        "/notifications",
        "/chats",
        "/collabs",
        "/upload",
        "/profile",
        "/verify-email",
        "/go",
        "/r/"
      ]
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
    host: siteUrl
  };
}
