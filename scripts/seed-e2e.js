const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const json = JSON.stringify;

async function main() {
  const passwordHash = await bcrypt.hash("password123", 4);
  const people = [
    ["admin@clippers.local", "Admin", "misha_admin", "ADMIN", 0],
    ["nikita@clippers.local", "NikitaX Live", "nikitax", "CLIENT", 0],
    ["brand@clippers.local", "Brand Client", "brand_client", "CLIENT", 0],
    ["anya@clippers.local", "Аня Clips", "anya_clips", "WORKER", 8_000_000],
    ["combo@clippers.local", "Studio Both", "studio_both", "BOTH", 7_000_000],
    ["maks@clippers.local", "Макс Cut", "maks_cut", "WORKER", 6_000_000],
    ["dasha@clippers.local", "Даша Reels", "reels_dasha", "WORKER", 5_000_000],
    ["tim@clippers.local", "Tim Shorts", "tim_shorts", "WORKER", 4_000_000],
    ["ira@clippers.local", "Ира Монтаж", "ira_edit", "WORKER", 3_000_000],
    ["roman@clippers.local", "Roman Hooks", "roman_hooks", "WORKER", 2_000_000],
    ["lena@clippers.local", "Lena Captions", "lena_caps", "WORKER", 1_000_000]
  ];

  await prisma.user.createMany({
    data: people.map(([email, name, handle, role, lifetimeViews]) => ({
      email,
      name,
      handle,
      role,
      lifetimeViews,
      passwordHash,
      emailVerifiedAt: new Date(),
      referralCode: String(handle).toUpperCase(),
      balanceCents: role === "CLIENT" ? 50_000_000 : 2_000_000,
      rank: lifetimeViews >= 5_000_000 ? "DIAMOND" : lifetimeViews >= 1_000_000 ? "GOLD" : "BRONZE"
    }))
  });
  const users = await prisma.user.findMany();
  const byHandle = Object.fromEntries(users.map((user) => [user.handle, user]));
  const workers = ["anya_clips", "studio_both", "maks_cut", "reels_dasha", "tim_shorts", "ira_edit", "roman_hooks", "lena_caps"];
  const deadline = new Date(Date.now() + 14 * 86_400_000);

  await prisma.campaign.createMany({
    data: [
      {
        ownerId: byHandle.brand_client.id,
        title: "Свободный тестовый заказ",
        description: "Сделать короткий вертикальный ролик с субтитрами.",
        sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        sourcePlatform: "YOUTUBE",
        allowedPlatformsJson: json(["TIKTOK", "YOUTUBE"]),
        rulesJson: json({ requiredTags: ["#reelpay"] }),
        cpmRateCents: 4_500,
        viewThreshold: 10_000,
        totalBudgetCents: 1_000_000,
        remainingBudgetCents: 1_000_000,
        maxPaidResults: 2,
        trackingPrefix: "e2e_free",
        deadline,
        niche: "Gaming",
        draftRequired: false
      },
      ...workers.map((handle, index) => ({
        ownerId: byHandle.nikitax.id,
        title: `Тест рейтинга ${index + 1}`,
        description: "Тестовая кампания для полного пользовательского сценария.",
        sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        sourcePlatform: "YOUTUBE",
        allowedPlatformsJson: json(["YOUTUBE", "TIKTOK"]),
        rulesJson: json({ requiredTags: ["#reelpay"] }),
        cpmRateCents: 4_500,
        viewThreshold: 10_000,
        totalBudgetCents: 1_000_000,
        remainingBudgetCents: 950_000,
        reservedBudgetCents: 50_000,
        maxPaidResults: 2,
        trackingPrefix: `e2e_rank_${index + 1}`,
        deadline,
        niche: "Gaming",
        draftRequired: false
      }))
    ]
  });

  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "asc" } });
  const rankedCampaigns = campaigns.filter((campaign) => campaign.trackingPrefix.startsWith("e2e_rank_"));
  await prisma.submission.createMany({
    data: rankedCampaigns.map((campaign, index) => {
      const worker = byHandle[workers[index]];
      const views = (workers.length - index) * 100_000;
      return {
        campaignId: campaign.id,
        workerId: worker.id,
        postUrl: `https://youtube.com/shorts/test-rank-${index + 1}`,
        platform: "YOUTUBE",
        platformPostId: `e2e-${index + 1}`,
        trackingCode: `E2E_RANK_${index + 1}`,
        currentViews: views,
        currentLikes: Math.round(views * 0.05),
        currentComments: Math.round(views * 0.002),
        peakViews: views,
        status: "VERIFIED",
        fraudScore: 5,
        reservedPayoutCents: 50_000,
        verifiedAt: new Date()
      };
    })
  });

  const comboCampaign = rankedCampaigns[1];
  await prisma.chatThread.create({
    data: {
      kind: "CAMPAIGN",
      campaignId: comboCampaign.id,
      clientId: byHandle.nikitax.id,
      workerId: byHandle.studio_both.id,
      messages: {
        create: {
          senderId: byHandle.studio_both.id,
          type: "SYSTEM",
          body: "Заказ взят. Здесь можно обсудить детали работы."
        }
      }
    }
  });

  await prisma.notification.createMany({
    data: [
      { userId: byHandle.anya_clips.id, title: "Проверка уведомлений", body: "Тестовое уведомление ReelPay.", channel: "in-app", priority: "LOW" },
      { userId: byHandle.nikitax.id, title: "Новый результат", body: "В кампании появился новый ролик.", channel: "in-app", priority: "MED" }
    ]
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
