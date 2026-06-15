const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const json = (value) => JSON.stringify(value);
const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const platforms = ["TIKTOK", "YOUTUBE", "INSTAGRAM", "VK"];
const covers = ["gaming", "podcast", "education", "fitness", "music", "travel", "food", "business"];

const clipTitles = [
  "Стример замолчал на 5 секунд, а чат уже понял",
  "Момент, который досмотрели до конца",
  "Самый короткий разбор сложной темы",
  "Донат, после которого стрим пошел не по плану",
  "Ошибка новичка, которую делают все",
  "Нарезка с идеальным первым кадром",
  "Фраза, которую уже забрали в мемы",
  "Один совет, который сэкономил людям неделю",
  "Подкаст стал понятным за 32 секунды",
  "Самый напряженный момент турнира",
  "Реакция, которую хочется пересмотреть",
  "Клип, который заказчик закрепил в профиле",
  "Хук на первые две секунды сработал",
  "Субтитры сделали ролик в два раза понятнее",
  "Сравнение до и после за один экран"
];

const users = [
  ["admin@clippers.local", "Миша Admin", "misha_admin", "ADMIN", "LEGENDARY", 100],
  ["nikita@clippers.local", "NikitaX Live", "nikitax", "CLIENT", "BRONZE", 98],
  ["brand@clippers.local", "EduPro Growth", "edupro", "CLIENT", "BRONZE", 96],
  ["podcast@clippers.local", "Разговорный цех", "talk_ceh", "CLIENT", "BRONZE", 94],
  ["fitness@clippers.local", "FitLab Daily", "fitlab", "CLIENT", "BRONZE", 93],
  ["anya@clippers.local", "Аня Clips", "anya_clips", "WORKER", "GOLD", 94],
  ["maks@clippers.local", "Макс Cut", "maks_cut", "WORKER", "DIAMOND", 97],
  ["dasha@clippers.local", "Даша Reels", "reels_dasha", "WORKER", "SILVER", 91],
  ["tim@clippers.local", "Tim Shorts", "tim_shorts", "WORKER", "GOLD", 92],
  ["ira@clippers.local", "Ира Монтаж", "ira_edit", "WORKER", "SILVER", 89],
  ["roman@clippers.local", "Roman Hooks", "roman_hooks", "WORKER", "BRONZE", 86],
  ["lena@clippers.local", "Lena Captions", "lena_caps", "WORKER", "GOLD", 95],
  ["combo@clippers.local", "Studio Both", "studio_both", "BOTH", "SILVER", 90]
];

const campaignTemplates = [
  ["NikitaX Live: смешные моменты стрима", "Найти смешные и странные моменты из Twitch VOD. Вертикальные клипы 20-45 секунд, быстрый хук, крупные субтитры.", "TWITCH", "Gaming", 5600, 10000, 18000000, "FEATURED"],
  ["FinStudy Podcast: деньги простым языком", "Короткие экспертные клипы без кликбейта. Нужно объяснять одну мысль за один ролик.", "YOUTUBE", "Podcast", 4800, 7000, 9200000, "PUBLIC"],
  ["GameGate: хайлайты турнира", "Динамичные моменты матчей, реакции игроков и комментаторов. Можно TikTok, Shorts и VK Clips.", "TWITCH", "Gaming", 3900, 5000, 12000000, "FEATURED"],
  ["FitLab Daily: тренировки дома", "Нужны понятные Reels с упражнениями, ошибками техники и короткими советами.", "YOUTUBE", "Fitness", 5200, 8000, 8400000, "PUBLIC"],
  ["Разговорный цех: сильные фразы гостей", "Из длинных выпусков вырезать честные, эмоциональные и спорные мысли гостей.", "YOUTUBE", "Podcast", 4400, 6000, 7600000, "PUBLIC"],
  ["EduPro: микроуроки по английскому", "Сделать короткие уроки с примерами, субтитрами и финальным вопросом в комментарии.", "YOUTUBE", "Education", 5100, 9000, 11200000, "FEATURED"],
  ["MusicRoom: студийные моменты", "Вырезать процесс записи, неожиданные ошибки и красивые до/после звука.", "YOUTUBE", "Music", 4700, 6000, 6900000, "PUBLIC"],
  ["Travel One: город за 30 секунд", "Короткие вертикальные ролики с маршрутом, ценой и одним полезным советом.", "YOUTUBE", "Travel", 4300, 7000, 8800000, "PUBLIC"],
  ["FoodLab: рецепты без воды", "Из длинных видео сделать быстрые шаги рецепта. Важно показать результат в начале.", "YOUTUBE", "Food", 4600, 8000, 7900000, "PUBLIC"],
  ["Founder Notes: бизнес-разборы", "Клипы из интервью предпринимателей. Нужны сильные тезисы без инфоцыганского тона.", "YOUTUBE", "Business", 6200, 12000, 15400000, "FEATURED"],
  ["Design Review: разбор интерфейсов", "Сделать короткие ролики с критикой UI, до/после и понятным выводом.", "YOUTUBE", "Design", 5400, 9000, 10100000, "PUBLIC"],
  ["Streamer School: советы новичкам", "Клипы для начинающих стримеров: звук, свет, сцены, донаты, удержание зрителя.", "TWITCH", "Education", 4900, 7000, 8300000, "PUBLIC"],
  ["Mobile Games Daily: реакции на патчи", "Быстрые нарезки реакций, мемные моменты и сравнение до/после обновления.", "TWITCH", "Gaming", 4200, 6000, 7300000, "PUBLIC"],
  ["Career Talk: поиск работы", "Короткие советы из подкаста про резюме, собеседования и карьерные ошибки.", "YOUTUBE", "Career", 5000, 8000, 9600000, "FEATURED"],
  ["Crypto Calm: новости без паники", "Спокойные клипы с объяснениями рынка. Без обещаний дохода и агрессивного FOMO.", "YOUTUBE", "Finance", 5800, 10000, 12400000, "PUBLIC"],
  ["BookShot: идеи из книг", "Одна мысль из книги в одном ролике. Нужен чистый монтаж и понятные титры.", "YOUTUBE", "Education", 4100, 5000, 6200000, "PUBLIC"],
  ["Cinema Cut: разбор сцен", "Короткие разборы киноязыка без использования длинных фрагментов фильмов.", "YOUTUBE", "Film", 5300, 9000, 10200000, "PUBLIC"],
  ["Local Brand: запуск нового продукта", "UGC-клипы с объяснением пользы продукта, без рекламной воды и лишних обещаний.", "YOUTUBE", "Brand", 6500, 12000, 16500000, "FEATURED"]
];

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.disputeCase.deleteMany();
  await prisma.leaderboardSnapshot.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.socialAccount.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);
  const createdUsers = {};

  for (const [email, name, handle, role, rank, trustScore] of users) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        handle,
        role,
        rank,
        trustScore,
        balanceCents: role === "WORKER" || role === "BOTH" ? 600000 + Math.floor(Math.random() * 2400000) : 12000000 + Math.floor(Math.random() * 26000000),
        holdBalanceCents: Math.floor(Math.random() * 1800000),
        streakDays: role === "WORKER" || role === "BOTH" ? 2 + Math.floor(Math.random() * 34) : 0,
        lifetimeViews: role === "WORKER" || role === "BOTH" ? 250000 + Math.floor(Math.random() * 9000000) : 0,
        referralCode: handle.toUpperCase().slice(0, 12),
        createdAt: daysAgo(80 - Math.floor(Math.random() * 70))
      }
    });
    createdUsers[handle] = user;
  }

  const clients = [createdUsers.nikitax, createdUsers.edupro, createdUsers.talk_ceh, createdUsers.fitlab, createdUsers.studio_both];
  const workers = [createdUsers.anya_clips, createdUsers.maks_cut, createdUsers.reels_dasha, createdUsers.tim_shorts, createdUsers.ira_edit, createdUsers.roman_hooks, createdUsers.lena_caps, createdUsers.studio_both];

  await prisma.socialAccount.createMany({
    data: workers.flatMap((user, index) => [
      { userId: user.id, platform: "TIKTOK", externalId: `tt_${user.handle}`, handle: `@${user.handle}`, verifiedAt: daysAgo(60 - index) },
      { userId: user.id, platform: "YOUTUBE", externalId: `yt_${user.handle}`, handle: `@${user.handle}Shorts`, verifiedAt: daysAgo(56 - index) },
      { userId: user.id, platform: "INSTAGRAM", externalId: `ig_${user.handle}`, handle: `@${user.handle}.reels`, verifiedAt: daysAgo(52 - index) }
    ])
  });

  const campaigns = [];
  for (let index = 0; index < campaignTemplates.length; index++) {
    const [title, description, sourcePlatform, niche, cpm, threshold, budget, visibility] = campaignTemplates[index];
    const usedPlatforms = index % 3 === 0 ? ["TIKTOK", "YOUTUBE", "INSTAGRAM", "VK"] : index % 3 === 1 ? ["TIKTOK", "YOUTUBE", "INSTAGRAM"] : ["TIKTOK", "VK"];
    const spent = Math.floor(budget * (0.18 + (index % 7) * 0.08));
    const campaign = await prisma.campaign.create({
      data: {
        ownerId: clients[index % clients.length].id,
        title,
        description,
        sourceUrl: `https://www.pexels.com/videos/search/${encodeURIComponent(String(niche).toLowerCase())}/`,
        sourcePlatform,
        allowedPlatformsJson: json(usedPlatforms),
        rulesJson: json({
          requiredTags: [`#${String(niche).toLowerCase()}`, `#ch_${index + 21}`],
          bans: ["NSFW", "политика", "оскорбления", "чужие логотипы крупным планом"],
          watermarkBonus: index % 2 === 0
        }),
        cpmRateCents: cpm,
        viewThreshold: threshold,
        totalBudgetCents: budget,
        remainingBudgetCents: Math.max(600000, budget - spent),
        status: index % 9 === 0 ? "LOW_BUDGET" : "ACTIVE",
        visibility,
        trackingPrefix: `ch_${String(index + 21).padStart(2, "0")}`,
        deadline: daysFromNow(6 + (index % 24)),
        language: "ru",
        niche,
        metricsJson: json({
          views: 220000 + index * 185000,
          fillRate: Number((spent / budget).toFixed(2)),
          roi: Number((1.8 + (index % 8) * 0.27).toFixed(1)),
          cover: covers[index % covers.length]
        }),
        createdAt: daysAgo(58 - (index % 45))
      }
    });
    campaigns.push(campaign);
  }

  const submissions = [];
  for (let i = 0; i < 120; i++) {
    const campaign = campaigns[i % campaigns.length];
    const worker = workers[i % workers.length];
    const platform = platforms[i % platforms.length];
    const views = Math.floor(1800 + ((i * 74113) % 1400000));
    const likes = Math.floor(views * (0.035 + (i % 6) * 0.006));
    const comments = Math.floor(views * (0.002 + (i % 4) * 0.001));
    const status = views > campaign.viewThreshold * 12 ? "PAID" : views > campaign.viewThreshold * 3 ? "SETTLING" : views > campaign.viewThreshold ? "THRESHOLD_MET" : i % 5 === 0 ? "VERIFIED" : "POSTED";
    const fraudScore = i % 37 === 0 ? 62 : 6 + (i % 22);
    const trackingCode = `${campaign.trackingPrefix}_${worker.handle.slice(0, 4).toUpperCase()}_${String(i + 101).padStart(3, "0")}`;
    const submission = await prisma.submission.create({
      data: {
        campaignId: campaign.id,
        workerId: worker.id,
        postUrl: `https://www.pexels.com/videos/search/${platform.toLowerCase()}-${i + 1}/`,
        platform,
        platformPostId: `${platform.toLowerCase()}_${10000 + i}`,
        trackingCode,
        currentViews: views,
        currentLikes: likes,
        currentComments: comments,
        peakViews: views + Math.floor(views * 0.08),
        status,
        fraudScore,
        viewVelocityJson: json([Math.floor(views * 0.04), Math.floor(views * 0.18), Math.floor(views * 0.52), views]),
        verifiedAt: status === "POSTED" ? null : daysAgo(12 - (i % 10)),
        paidAt: status === "PAID" ? daysAgo(i % 20) : null,
        createdAt: daysAgo(44 - (i % 39))
      }
    });
    submissions.push(submission);
  }

  const transactions = [];
  for (const campaign of campaigns) {
    transactions.push({
      userId: campaign.ownerId,
      amountCents: campaign.totalBudgetCents,
      feeCents: Math.round(campaign.totalBudgetCents * 0.029),
      netCents: campaign.totalBudgetCents,
      type: "DEPOSIT",
      status: "COMPLETED",
      provider: "yookassa",
      providerData: json({ mode: "seed", reservedForCampaign: campaign.id }),
      createdAt: campaign.createdAt
    });
  }

  for (const submission of submissions.filter((item) => item.status === "PAID" || item.status === "SETTLING").slice(0, 72)) {
    const campaign = campaigns.find((item) => item.id === submission.campaignId);
    const worker = workers.find((item) => item.id === submission.workerId);
    const gross = Math.floor((submission.currentViews / 1000) * campaign.cpmRateCents);
    const commission = worker.rank === "DIAMOND" ? 0.09 : worker.rank === "GOLD" ? 0.11 : worker.rank === "SILVER" ? 0.13 : 0.15;
    transactions.push({
      userId: worker.id,
      submissionId: submission.id,
      amountCents: gross,
      feeCents: Math.floor(gross * commission),
      netCents: Math.floor(gross * (1 - commission)),
      type: "EARNING",
      status: submission.status === "PAID" ? "COMPLETED" : "PENDING",
      providerData: json({ rank: worker.rank, commissionRate: commission }),
      createdAt: submission.createdAt
    });
  }

  await prisma.transaction.createMany({ data: transactions });

  const achievements = await Promise.all([
    prisma.achievement.create({ data: { code: "FIRST_CLIP", title: "Первый клип", description: "Первая одобренная публикация", icon: "play" } }),
    prisma.achievement.create({ data: { code: "ONE_HUNDRED_K", title: "100K просмотров", description: "Один клип набрал 100K+", icon: "100K" } }),
    prisma.achievement.create({ data: { code: "VIRAL_HIT", title: "Viral Hit", description: "Клип набрал 1M+ просмотров", icon: "1M" } }),
    prisma.achievement.create({ data: { code: "STREAK_30", title: "Streak 30", description: "30 дней подряд с публикациями", icon: "30" } })
  ]);

  await prisma.userAchievement.createMany({
    data: workers.flatMap((user, index) => achievements.slice(0, 2 + (index % 3)).map((achievement) => ({ userId: user.id, achievementId: achievement.id })))
  });

  await prisma.leaderboardSnapshot.createMany({
    data: workers
      .map((user, index) => ({
        season: "S2-2026",
        type: "daily",
        handle: user.handle,
        rank: index + 1,
        views: 420000 + (workers.length - index) * 185000,
        payoutCents: 380000 + (workers.length - index) * 210000
      }))
      .sort((a, b) => b.views - a.views)
      .map((row, index) => ({ ...row, rank: index + 1 }))
  });

  await prisma.notification.createMany({
    data: [
      { userId: createdUsers.anya_clips.id, title: "Клип добрал порог", body: "Твой ролик по NikitaX перешел в settlement. Деньги уже зарезервированы.", channel: "telegram", priority: "HIGH" },
      { userId: createdUsers.nikitax.id, title: "Новые клипы в заказе", body: "За ночь добавлено 14 публикаций. Три ролика уже набрали больше 100K просмотров.", channel: "push", priority: "HIGH" },
      { userId: createdUsers.misha_admin.id, title: "Fraud queue спокойная", body: "Нет публикаций с fraud score выше 70. Один ролик требует ручного просмотра.", channel: "in-app", priority: "LOW" },
      { userId: createdUsers.edupro.id, title: "Бюджет расходуется ровно", body: "Fill rate кампаний за неделю: 64%. Рекомендуем поднять CPV на 8%.", channel: "email", priority: "MED" }
    ]
  });

  await prisma.auditLog.create({
    data: {
      userId: createdUsers.misha_admin.id,
      action: "SEED_LIVE_DEMO",
      entity: "System",
      entityId: "seed",
      metadata: json({ users: users.length, campaigns: campaigns.length, submissions: submissions.length, transactions: transactions.length })
    }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
