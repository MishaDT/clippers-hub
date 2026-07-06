import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://clippers-hub-mdt.netlify.app");

const abs = (path: string) => new URL(path, siteUrl).toString();

const staticEntries: MetadataRoute.Sitemap = [
  { url: abs("/"), changeFrequency: "daily", priority: 1 },
  { url: abs("/business"), changeFrequency: "weekly", priority: 0.9 },
  { url: abs("/campaigns"), changeFrequency: "hourly", priority: 0.9 },
  { url: abs("/leaderboard"), changeFrequency: "daily", priority: 0.6 },
  { url: abs("/about"), changeFrequency: "monthly", priority: 0.5 },
  { url: abs("/help"), changeFrequency: "monthly", priority: 0.5 },
  { url: abs("/safety"), changeFrequency: "monthly", priority: 0.5 },
  { url: abs("/safety/budget"), changeFrequency: "monthly", priority: 0.5 },
  { url: abs("/safety/views"), changeFrequency: "monthly", priority: 0.5 },
  { url: abs("/legal/terms"), changeFrequency: "yearly", priority: 0.3 },
  { url: abs("/legal/privacy"), changeFrequency: "yearly", priority: 0.3 },
  { url: abs("/legal/cookies"), changeFrequency: "yearly", priority: 0.3 }
];

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let dynamic: MetadataRoute.Sitemap = [];

  try {
    const [campaigns, clippers] = await Promise.all([
      prisma.campaign.findMany({
        where: {
          isDemo: false,
          visibility: { in: ["PUBLIC", "FEATURED"] },
          status: { in: ["ACTIVE", "LOW_BUDGET"] }
        },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 2000
      }),
      prisma.user.findMany({
        where: {
          accountStatus: "ACTIVE",
          role: { in: ["WORKER", "BOTH"] },
          lifetimeViews: { gt: 0 },
          NOT: { email: { endsWith: "@clippers.local" } }
        },
        select: { handle: true, updatedAt: true },
        orderBy: { lifetimeViews: "desc" },
        take: 2000
      })
    ]);

    dynamic = [
      ...campaigns.map((c) => ({
        url: abs(`/campaigns/${c.id}`),
        lastModified: c.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.7
      })),
      ...clippers.map((u) => ({
        url: abs(`/clippers/${u.handle}`),
        lastModified: u.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6
      }))
    ];
  } catch {
    // If the DB is unreachable, still return the static sitemap.
  }

  return [...staticEntries, ...dynamic];
}
