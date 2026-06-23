import { unstable_cache } from "next/cache";
import { AppShell } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { FeedClient } from "./feed-client";

const images = [
  "/assets/gaming-order.png",
  "/assets/podcast-order.png",
  "/assets/marketplace-thumb.png",
  "/assets/hero-studio.png",
  "/assets/creator-nika.png"
];
const videos = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4"
];

// Cache the heavy campaign query for 30s so the feed renders instantly (no DB wait).
const getFeedCampaigns = unstable_cache(
  async () => {
    const campaigns = await prisma.campaign.findMany({
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
      deadline: campaign.deadline.toISOString(),
      ownerName: campaign.owner.name,
      ownerAvatar: campaign.owner.avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(campaign.owner.handle)}`,
      submissions: campaign.submissions.length,
      views: campaign.submissions.reduce((sum, item) => sum + item.currentViews, 0),
      cover: images[index % images.length],
      video: videos[index % videos.length]
    }));
  },
  ["feed-campaigns-v2"],
  { revalidate: 30, tags: ["campaigns"] }
);

export default async function FeedPage() {
  const campaigns = await getFeedCampaigns();

  return (
    <AppShell immersive>
      <FeedClient campaigns={campaigns} />
    </AppShell>
  );
}
