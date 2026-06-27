const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const founders = [
  {
    email: "dudarevmisha@gmail.com",
    name: "Миша",
    role: "BOTH",
    targetViews: 14_260_000,
    clips: 14,
    streakDays: 18,
    trustScore: 98,
    balanceCents: 186_059_00,
    holdBalanceCents: 24_800_00,
    achievements: ["FIRST_CLIP", "ONE_HUNDRED_K", "TOP_3", "STREAK_7"]
  },
  {
    email: "vityaliti@gmail.com",
    name: "Витя",
    role: "ADMIN",
    targetViews: 13_480_000,
    clips: 13,
    streakDays: 11,
    trustScore: 96,
    balanceCents: 142_300_00,
    holdBalanceCents: 18_600_00,
    achievements: ["FIRST_CLIP", "ONE_HUNDRED_K", "TOP_3", "STREAK_7"]
  },
  {
    email: "priymak.nk@gmail.com",
    name: "Коля",
    role: "ADMIN",
    targetViews: 12_730_000,
    clips: 12,
    streakDays: 7,
    trustScore: 94,
    balanceCents: 119_840_00,
    holdBalanceCents: 12_400_00,
    achievements: ["FIRST_CLIP", "ONE_HUNDRED_K", "TOP_3"]
  }
];

const achievementCatalog = [
  ["FIRST_CLIP", "Первый клип", "Опубликована первая работа", "scissors"],
  ["ONE_HUNDRED_K", "Вирусный", "Один клип набрал 100 тысяч просмотров", "flame"],
  ["TOP_3", "На пьедестале", "Попадание в тройку лидеров", "trophy"],
  ["STREAK_7", "Неделя в деле", "Серия публикаций длиной 7 дней", "zap"],
  ["STREAK_30", "Месяц без пауз", "Серия публикаций длиной 30 дней", "calendar"],
  ["VIRAL_HIT", "Миллионник", "Один клип набрал миллион просмотров", "rocket"]
];

function splitViews(total, count) {
  const weights = Array.from({ length: count }, (_, index) => count + 3 - index * 0.42);
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const values = weights.map((weight) => Math.floor((total * weight) / weightSum));
  values[0] += total - values.reduce((sum, value) => sum + value, 0);
  return values;
}

async function main() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: { in: ["ACTIVE", "LOW_BUDGET", "COMPLETED"] } },
    select: { id: true, cpmRateCents: true },
    orderBy: { createdAt: "asc" },
    take: 18
  });
  if (campaigns.length < 3) throw new Error("Для демонстрационных работ нужны минимум 3 кампании.");

  const achievements = new Map();
  for (const [code, title, description, icon] of achievementCatalog) {
    const achievement = await prisma.achievement.upsert({
      where: { code },
      update: { title, description, icon },
      create: { code, title, description, icon }
    });
    achievements.set(code, achievement);
  }

  const result = [];
  for (let founderIndex = 0; founderIndex < founders.length; founderIndex += 1) {
    const founder = founders[founderIndex];
    const user = await prisma.user.findUnique({ where: { email: founder.email } });
    if (!user) throw new Error(`Не найден аккаунт ${founder.email}`);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: founder.name,
        role: founder.role,
        rank: "LEGENDARY",
        kycStatus: "VERIFIED",
        trustScore: founder.trustScore,
        streakDays: founder.streakDays,
        balanceCents: founder.balanceCents,
        holdBalanceCents: founder.holdBalanceCents
      }
    });

    const views = splitViews(founder.targetViews, founder.clips);
    for (let index = 0; index < founder.clips; index += 1) {
      const campaign = campaigns[(founderIndex * 5 + index) % campaigns.length];
      const trackingCode = `founder_${founderIndex + 1}_${String(index + 1).padStart(2, "0")}`;
      const createdAt = new Date(Date.now() - ((index % 6) * 18 + founderIndex * 2) * 60 * 60 * 1000);
      const currentViews = views[index];
      const submission = await prisma.submission.upsert({
        where: { trackingCode },
        update: {
          campaignId: campaign.id,
          workerId: user.id,
          currentViews,
          currentLikes: Math.round(currentViews * (0.061 - founderIndex * 0.004)),
          currentComments: Math.round(currentViews * 0.0038),
          peakViews: Math.round(currentViews * 1.04),
          status: index < founder.clips - 2 ? "PAID" : index === founder.clips - 2 ? "SETTLING" : "VERIFIED",
          fraudScore: 4 + ((index + founderIndex) % 11),
          lastSyncedAt: new Date(),
          verifiedAt: createdAt,
          paidAt: index < founder.clips - 2 ? new Date(createdAt.getTime() + 48 * 60 * 60 * 1000) : null,
          createdAt
        },
        create: {
          campaignId: campaign.id,
          workerId: user.id,
          postUrl: `https://youtube.com/shorts/reelpay-${founderIndex + 1}-${index + 1}`,
          platform: index % 3 === 0 ? "YOUTUBE" : index % 3 === 1 ? "TIKTOK" : "VK",
          platformPostId: `reelpay-${founderIndex + 1}-${index + 1}`,
          trackingCode,
          currentViews,
          currentLikes: Math.round(currentViews * (0.061 - founderIndex * 0.004)),
          currentComments: Math.round(currentViews * 0.0038),
          peakViews: Math.round(currentViews * 1.04),
          status: index < founder.clips - 2 ? "PAID" : index === founder.clips - 2 ? "SETTLING" : "VERIFIED",
          fraudScore: 4 + ((index + founderIndex) % 11),
          viewVelocityJson: JSON.stringify([0.04, 0.18, 0.51, 0.79, 1].map((part) => Math.round(currentViews * part))),
          lastSyncedAt: new Date(),
          verifiedAt: createdAt,
          paidAt: index < founder.clips - 2 ? new Date(createdAt.getTime() + 48 * 60 * 60 * 1000) : null,
          createdAt
        }
      });

      const gross = Math.round((currentViews / 1000) * campaign.cpmRateCents);
      const transaction = await prisma.transaction.findFirst({
        where: { submissionId: submission.id, userId: user.id, type: "EARNING" }
      });
      const transactionData = {
        amountCents: gross,
        feeCents: Math.round(gross * 0.07),
        netCents: Math.round(gross * 0.93),
        status: index < founder.clips - 2 ? "COMPLETED" : "PENDING",
        provider: "platform",
        providerData: JSON.stringify({ source: "founder-showcase", rank: "LEGENDARY" }),
        createdAt
      };
      if (transaction) {
        await prisma.transaction.update({ where: { id: transaction.id }, data: transactionData });
      } else {
        await prisma.transaction.create({
          data: { userId: user.id, submissionId: submission.id, type: "EARNING", ...transactionData }
        });
      }
    }

    for (const code of founder.achievements) {
      const achievement = achievements.get(code);
      await prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId: user.id, achievementId: achievement.id } },
        update: {},
        create: { userId: user.id, achievementId: achievement.id }
      });
    }

    const totals = await prisma.submission.aggregate({
      where: { workerId: user.id },
      _sum: { currentViews: true },
      _count: { _all: true }
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { lifetimeViews: totals._sum.currentViews || 0 }
    });
    result.push({
      name: founder.name,
      views: totals._sum.currentViews || 0,
      clips: totals._count._all,
      achievements: founder.achievements.length
    });
  }

  await prisma.leaderboardSnapshot.deleteMany({ where: { season: "founder-showcase" } });
  await prisma.leaderboardSnapshot.createMany({
    data: result.flatMap((row, index) => [
      {
        season: "founder-showcase",
        type: "ALL_TIME",
        handle: founders[index].email,
        rank: index + 1,
        views: row.views,
        payoutCents: founders[index].balanceCents
      },
      {
        season: "founder-showcase",
        type: "WEEKLY",
        handle: founders[index].email,
        rank: index + 1,
        views: row.views,
        payoutCents: founders[index].balanceCents
      }
    ])
  });

  console.table(result);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
