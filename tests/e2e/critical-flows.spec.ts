import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupTestData() {
  await prisma.campaign.deleteMany({ where: { title: { contains: "E2E" } } });
  await prisma.submission.deleteMany({ where: { postUrl: { contains: "/e2e-" } } });
  await prisma.user.updateMany({ where: { email: "anya@clippers.local" }, data: { role: "WORKER" } });
  await prisma.user.updateMany({ where: { email: "nikita@clippers.local" }, data: { role: "CLIENT" } });
}

test.beforeAll(cleanupTestData);
test.afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

async function login(page: Page, email: string, password = "password123") {
  await page.goto("/login");
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

    await expect(page.getByRole("heading", { name: /Видео, которые/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Я заказчик/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Я клиппер/i })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /Начать/i })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: /Заказы/i })).toBeVisible();
    await expect(page.locator(".job-list-card").first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe("worker flow", () => {
  test("clipper can log in, join a campaign and submit a clip link", async ({ page, isMobile }) => {
    await login(page, "anya@clippers.local");
    await expect(page).toHaveURL(/\/clipper$/);
    await expect(page.getByRole("heading", { name: /зарабатывает/i })).toBeVisible();
    if (isMobile) {
      await expect(page.locator(".bottom-nav")).toBeVisible();
    } else {
      await expect(page.locator(".top-nav")).toBeVisible();
      await expect(page.locator(".bottom-nav")).toBeHidden();
    }

    await page.goto("/campaigns");
    await page.getByRole("link", { name: /Подробнее/i }).first().click();
    await page.getByRole("button", { name: /Откликнуться/i }).click();
    await expect(page).toHaveURL(/\/clipper$/);

    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: /Выложить работу/i })).toBeVisible();
    await page.locator('input[name="postUrl"]').fill(`https://tiktok.com/@anya_clips/video/e2e-${Date.now()}`);
    await page.getByRole("button", { name: /Отправить/i }).click();
    await expect(page.locator("body")).toContainText("Выложить работу");
    await expectNoHorizontalScroll(page);
  });
});

test.describe("client flow", () => {
  test("client can create a campaign from the simple order form", async ({ page }) => {
    await login(page, "nikita@clippers.local");
    await expect(page).toHaveURL(/\/client$/);

    await page.goto("/campaigns/new");
    await expect(page.getByRole("heading", { name: /Создать заказ/i })).toBeVisible();
    await page.locator('input[name="title"]').fill(`E2E заказ ${Date.now()}`);
    await page.locator('input[name="sourceUrl"]').fill("https://twitch.tv/videos/e2e-demo");
    await page.locator('input[name="budget"]').fill("50000");
    await page.locator('input[name="cpm"]').fill("45");
    await page.getByRole("button", { name: /Опубликовать кампанию/i }).click();

    await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+$/);
    await expect(page.getByRole("heading", { name: /E2E заказ/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
