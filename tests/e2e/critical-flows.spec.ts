import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupTestData() {
  await prisma.campaign.deleteMany({ where: { title: { contains: "E2E" } } });
  await prisma.submission.deleteMany({ where: { postUrl: { contains: "/e2e-" } } });
  await prisma.user.updateMany({ where: { email: "anya@clippers.local" }, data: { role: "WORKER" } });
  await prisma.user.updateMany({ where: { email: "nikita@clippers.local" }, data: { role: "CLIENT" } });
}

async function createWorkerCampaign() {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "nikita@clippers.local" } });
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
  return prisma.campaign.create({
    data: {
      ownerId: owner.id,
      title: `E2E worker order ${suffix}`,
      description: "Изолированный заказ для проверки полного пути исполнителя.",
      sourceUrl: "https://example.com/e2e-source",
      sourcePlatform: "YOUTUBE",
      allowedPlatformsJson: JSON.stringify(["TIKTOK", "YOUTUBE"]),
      rulesJson: JSON.stringify({ requiredTags: ["#reelpay"] }),
      cpmRateCents: 4_500,
      viewThreshold: 5_000,
      totalBudgetCents: 500_000,
      remainingBudgetCents: 500_000,
      maxPaidResults: 2,
      trackingPrefix: `e2e_${suffix}`,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      niche: "Education",
      isAdvertising: false,
      isDemo: false,
      draftRequired: false
    }
  });
}

test.beforeAll(cleanupTestData);
test.afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

async function login(page: Page, email: string, password = "password123") {
  await page.goto("/login");
  await page.context().addCookies([{ name: "rp_consent", value: "necessary", url: page.url() }]);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page should not have horizontal overflow").toBeLessThanOrEqual(1);
}

test.describe("public experience", () => {
  test("guest understands the product and can choose a role", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Запускайте короткие ролики/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Посмотреть пример расчёта/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /От исходного видео до проверенного результата/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Запустим первые ролики вместе/i })).toBeVisible();
    await page.getByRole("tab", { name: "Клипперам" }).click();
    await expect(page.getByRole("heading", { name: /Зарабатывайте на роликах/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /От заказа до выплаты/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /От исходного видео до проверенного результата/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Запустим первые ролики вместе/i })).toHaveCount(0);
    await expect(page.getByText("Что я вижу до принятия заказа?")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Рџ");
    await expect(page.locator("body")).not.toContainText("вЂ");
    await expectNoHorizontalScroll(page);
  });

  test("protected product actions send guests to login", async ({ page }) => {
    for (const path of ["/campaigns/new", "/upload", "/profile", "/wallet"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("feed and marketplace are readable on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-only UX check");

    await page.goto("/feed");
    await expect(page.getByText(/Для тебя/i)).toBeVisible();
    await expect(page.locator(".bottom-nav")).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    await page.goto("/campaigns");
    await expect(page.getByRole("heading", { name: /Найди заказ/i })).toBeVisible();
    await expect(page.locator(".mk-card").first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe("worker flow", () => {
  test.beforeEach(async () => {
    await prisma.user.updateMany({
      where: { email: "anya@clippers.local" },
      data: { role: "WORKER", preferredRoleMode: "worker" }
    });
  });

  test("public information pages preserve the authenticated session", async ({ page }) => {
    await login(page, "anya@clippers.local");
    await page.goto("/business");
    await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
    await page.goto("/safety");
    await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
    await page.goto("/business");
    await page.getByRole("button", { name: /Создать кампанию/ }).click();
    await expect(page).toHaveURL(/\/campaigns\/new/);
  });

  test("notification list is fetched only when the bell opens", async ({ page }) => {
    let recentRequests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/notifications/recent")) recentRequests += 1;
    });

    await login(page, "anya@clippers.local");
    await expect(page).toHaveURL(/\/campaigns$/);
    expect(recentRequests).toBe(0);

    const bell = page.getByRole("button", { name: /Уведомления/i });
    await expect(bell).toHaveAttribute("data-ready", "true");
    await bell.click();
    await expect.poll(() => recentRequests).toBe(1);
    await expect(page.getByText(/Все уведомления/i)).toBeVisible();
  });

  test("clipper can log in, join a campaign and submit a clip link", async ({ page, isMobile }) => {
    const campaign = await createWorkerCampaign();
    await login(page, "anya@clippers.local");
    await expect(page).toHaveURL(/\/campaigns$/);
    if (isMobile) {
      await expect(page.locator(".bottom-nav")).toBeVisible();
    } else {
      await expect(page.locator(".top-nav")).toBeVisible();
      await expect(page.locator(".bottom-nav")).toBeHidden();
    }

    await page.goto(`/campaigns/${campaign.id}`);
    const campaignAction = page.locator(".od-apply");
    await campaignAction.locator('.od-apply-btn').waitFor({ state: "visible" });
    const joinButton = campaignAction.getByRole("button", { name: /Взять заказ/i });
    if (await joinButton.isVisible().catch(() => false)) {
      await joinButton.click();
      await page.getByRole("button", { name: /Подтвердить и взять заказ/i }).click();
    } else {
      await campaignAction.getByRole("link", { name: /Выложить работу/i }).click();
    }
    await expect(page).toHaveURL(/\/upload$/);

    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: /Выложить работу/i })).toBeVisible();
    await page.locator('input[name="postUrl"]').fill(`https://tiktok.com/@anya_clips/video/e2e-${Date.now()}`);
    await page.locator('input[name="watermarkConfirmed"]').check();
    await page.getByRole("button", { name: /Отправить/i }).click();
    await expect(page.locator("body")).toContainText("Выложить работу");
    await expectNoHorizontalScroll(page);
  });

  test("open dispute blocks the payout until an admin decision", async ({ page }) => {
    const worker = await prisma.user.findUniqueOrThrow({ where: { email: "anya@clippers.local" } });
    const submission = await prisma.submission.findFirstOrThrow({
      where: { workerId: worker.id, status: { not: "PAID" } },
      include: { campaign: true }
    });
    await prisma.disputeCase.deleteMany({ where: { submissionId: submission.id } });
    await prisma.submission.update({ where: { id: submission.id }, data: { status: "REJECTED" } });

    await login(page, "anya@clippers.local");
    await page.goto(`/campaigns/${submission.campaignId}`);
    await page.getByText("Спор и апелляция").click();
    await page.locator(`textarea[name="reason"]`).fill("Работа выполнена по брифу, tracking-код сохранён, прошу проверить отклонение по фактам.");
    await page.getByRole("button", { name: "Открыть апелляцию" }).click();
    await expect(page).toHaveURL(/dispute=opened/, { timeout: 45_000 });
    await expect(page.getByText("Выплата остановлена")).toBeVisible();

    const opened = await prisma.disputeCase.findFirstOrThrow({ where: { submissionId: submission.id, status: "OPEN" } });
    await page.context().clearCookies();
    await login(page, "admin@clippers.local");
    await page.goto("/admin/disputes");
    await page.locator(`input[name="disputeId"][value="${opened.id}"]`).locator("..").locator('textarea[name="resolution"]').fill(
      "Проверка показала, что отклонение обосновано отсутствием подтверждения владения публикацией."
    );
    await page.locator(`input[name="disputeId"][value="${opened.id}"]`).locator("..").getByRole("button", { name: "Отклонить апелляцию" }).click();
    await expect(page).toHaveURL(/resolved=1/);
    await expect.poll(async () => (await prisma.disputeCase.findUnique({ where: { id: opened.id } }))?.status)
      .toBe("RESOLVED_REJECTED");
  });
});

test.describe("client flow", () => {
  test("client can create a campaign from the simple order form", async ({ page }) => {
    await login(page, "nikita@clippers.local");
    await expect(page).toHaveURL(/\/campaigns$/);

    await page.goto("/campaigns/new");
    await expect(page.getByRole("heading", { name: /Опиши задачу/i })).toBeVisible();
    await page.locator('input[name="title"]').fill(`E2E заказ ${Date.now()}`);
    await page.getByRole("button", { name: /Продолжить/i }).click();
    await page.locator('input[name="sourceUrl"]').fill("https://twitch.tv/videos/e2e-demo");
    await page.getByRole("button", { name: /Продолжить/i }).click();
    await page.getByRole("button", { name: /Продолжить/i }).click();
    await page.getByRole("button", { name: /Продолжить/i }).click();
    await page.getByRole("button", { name: /Продолжить/i }).click();
    await page.locator('input[name="budget"]').fill("50000");
    await page.locator('input[name="cpm"]').fill("45");
    await page.getByRole("button", { name: /Продолжить/i }).click();
    await page.locator('input[name="rightsConfirmed"]').check();
    await page.locator('input[name="briefConfirmed"]').check();
    await page.getByRole("button", { name: /Опубликовать заказ/i }).click();

    await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+$/, { timeout: 45_000 });
    await expect(page.getByRole("heading", { name: /E2E заказ/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("accepted client dispute reverses a pending earning exactly once", async ({ page }) => {
    const client = await prisma.user.findUniqueOrThrow({ where: { email: "nikita@clippers.local" } });
    const submission = await prisma.submission.findFirstOrThrow({
      where: { campaign: { ownerId: client.id }, status: { not: "PAID" } },
      include: { worker: true, campaign: true }
    });
    await prisma.disputeCase.deleteMany({ where: { submissionId: submission.id } });
    await prisma.transaction.deleteMany({ where: { submissionId: submission.id, type: "EARNING" } });
    const gross = 12_000;
    const net = 10_000;
    const workerHoldBefore = submission.worker.holdBalanceCents;
    const remainingBefore = submission.campaign.remainingBudgetCents;
    await prisma.$transaction([
      prisma.submission.update({ where: { id: submission.id }, data: { status: "SETTLING", reservedPayoutCents: 0 } }),
      prisma.user.update({ where: { id: submission.workerId }, data: { holdBalanceCents: { increment: net } } }),
      prisma.transaction.create({
        data: {
          userId: submission.workerId,
          submissionId: submission.id,
          amountCents: gross,
          feeCents: gross - net,
          netCents: net,
          type: "EARNING",
          status: "PENDING"
        }
      })
    ]);

    await login(page, "nikita@clippers.local");
    await page.goto(`/campaigns/${submission.campaignId}`);
    const report = page.locator(`[data-submission-id="${submission.id}"]`);
    await report.getByText("Спор и апелляция").click();
    await report.locator('textarea[name="reason"]').fill(
      "Просмотры выглядят аномально и не соответствуют сохранённой динамике, прошу остановить выплату."
    );
    await report.getByRole("button", { name: "Открыть апелляцию" }).click();
    await expect(page).toHaveURL(/dispute=opened/, { timeout: 45_000 });
    const opened = await prisma.disputeCase.findFirstOrThrow({ where: { submissionId: submission.id, status: "OPEN" } });

    await page.context().clearCookies();
    await login(page, "admin@clippers.local");
    await page.goto("/admin/disputes");
    const resolutionForm = page.locator(`input[name="disputeId"][value="${opened.id}"]`).locator("..");
    await resolutionForm.locator('textarea[name="resolution"]').fill(
      "Аномалия подтверждена проверками. Выплата отменена, сумма возвращена в доступный бюджет кампании."
    );
    await resolutionForm.getByRole("button", { name: "Удовлетворить апелляцию" }).click();
    await expect(page).toHaveURL(/resolved=1/, { timeout: 45_000 });

    const [earning, workerAfter, campaignAfter, submissionAfter] = await Promise.all([
      prisma.transaction.findFirstOrThrow({ where: { submissionId: submission.id, type: "EARNING" } }),
      prisma.user.findUniqueOrThrow({ where: { id: submission.workerId } }),
      prisma.campaign.findUniqueOrThrow({ where: { id: submission.campaignId } }),
      prisma.submission.findUniqueOrThrow({ where: { id: submission.id } })
    ]);
    expect(earning.status).toBe("REVERSED");
    expect(workerAfter.holdBalanceCents).toBe(workerHoldBefore);
    expect(campaignAfter.remainingBudgetCents).toBe(remainingBefore + gross);
    expect(submissionAfter.status).toBe("REJECTED");
  });
});
