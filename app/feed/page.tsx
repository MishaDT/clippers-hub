import { unstable_cache } from "next/cache";
import { AppShell } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { FeedClient } from "./feed-client";
import { getCurrentUser } from "@/lib/auth";
import { getActiveRoleMode } from "@/lib/role-mode";

const images = [
  "/assets/gaming-order.webp",
  "/assets/podcast-order.webp",
  "/assets/marketplace-thumb.webp",
  "/assets/hero-studio.webp",
  "/assets/creator-nika.webp"
];
// Cache the heavy campaign query for 30s so the feed renders instantly (no DB wait).
const getFeedCampaigns = unstable_cache(
  async () => {
    const campaigns = await prisma.campaign.findMany({
      where: {
        isDemo: false,
        visibility: { in: ["PUBLIC", "FEATURED"] },
        status: { in: ["ACTIVE", "LOW_BUDGET"] }
      },
      include: { owner: true, submissions: true },
      orderBy: [{ visibility: "asc" }, { createdAt: "desc" }],
      take: 12
    });
    return campaigns.map((campaign, index) => ({
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      niche: campaign.niche,
      viewThreshold: campaign.viewThreshold,
      cpmRateCents: campaign.cpmRateCents,
      minimumGuaranteeCents: campaign.minimumGuaranteeCents,
      deadline: campaign.deadline.toISOString(),
      ownerName: campaign.owner.name,
      ownerAvatar: campaign.owner.avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(campaign.owner.handle)}`,
      submissions: campaign.submissions.length,
      views: campaign.submissions.reduce((sum, item) => sum + item.currentViews, 0),
      cover: images[index % images.length]
    }));
  },
  ["feed-campaigns-real-v1"],
  { revalidate: 30, tags: ["campaigns"] }
);

export default async function FeedPage() {
  const [campaigns, user] = await Promise.all([getFeedCampaigns(), getCurrentUser()]);
  const mode = user ? await getActiveRoleMode(user) : "worker";

  return (
    <AppShell immersive>
      <FeedClient campaigns={campaigns} mode={mode} />
    </AppShell>
  );
}
