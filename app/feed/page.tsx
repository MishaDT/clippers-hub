import { unstable_cache } from "next/cache";
import { AppShell } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { FeedClient } from "./feed-client";

const images = [
  "/assets/gaming-order.png",
  "/assets/podcast-order.png",
  "/assets/marketplace-thumb.png",
  "/assets/hero-studio.png",
  "https://picsum.photos/seed/reelpay-feed-1/720/1100",
  "https://picsum.photos/seed/reelpay-feed-2/720/1100",
  "https://picsum.photos/seed/reelpay-feed-3/720/1100"
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

// Cache the heavy campaign query for 30s so most navigations render instantly
// (no wait on the database). Returns plain JSON-safe objects (no Date methods after).
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
  ["feed-campaigns-v1"],
  { revalidate: 30, tags: ["campaigns"] }
);

export default async function FeedPage() {
  const user = await getCurrentUser();
  const [campaigns, liked, saved] = await Promise.all([
    getFeedCampaigns(),
    user ? prisma.likedCampaign.findMany({ where: { userId: user.id }, select: { campaignId: true } }) : [],
    user ? prisma.savedCampaign.findMany({ where: { userId: user.id }, select: { campaignId: true } }) : []
  ]);

  return (
    <AppShell>
      <section className="section social-feed">
        <FeedClient likedIds={liked.map((item) => item.campaignId)} savedIds={saved.map((item) => item.campaignId)} campaigns={campaigns} />
      </section>
    </AppShell>
  );
}
