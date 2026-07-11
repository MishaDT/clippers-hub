import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function login(page: Page, email: string) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
  await page.context().addCookies([{ name: "rp_consent", value: "necessary", url: baseURL }]);
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("password123");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/campaigns$/);
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("campaign filters stay simple and responsive", async ({ page }) => {
  await login(page, "anya@clippers.local");
  await page.getByRole("button", { name: /Фильтры/ }).click();
  await expect(page.getByRole("dialog", { name: "Фильтры заказов" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Игры" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Применить/ }).click();

  await expect(page).toHaveURL(/category=games/);
  await expect(page.getByLabel("Активные фильтры").getByText("Игры")).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.locator("body").evaluate((node) => node.clientWidth));
});

test("admin mobile header stays compact with notification counters", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await login(page, "admin@clippers.local");
  await page.goto("/profile");

  const header = page.locator("header").first();
  await expect(page.getByRole("link", { name: "Открыть админку" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Выйти из аккаунта" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await expect.poll(() => header.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
});

test("support request reaches admin and the reply reaches the user", async ({ page, context }) => {
  const subject = `E2E поддержка ${Date.now()}`;

  try {
    await login(page, "anya@clippers.local");
    await page.goto("/support?new=1");
    await page.locator('input[name="subject"]').fill(subject);
    await page.locator('select[name="category"]').selectOption("ACCOUNT");
    await page.locator('textarea[name="body"]').fill("Проверка полного цикла обращения в поддержку.");
    await page.getByRole("button", { name: "Создать обращение" }).click();
    await expect(page).toHaveURL(/\/support\?thread=/);
    await expect(page.getByRole("heading", { name: subject })).toBeVisible();

    await context.clearCookies();
    await login(page, "admin@clippers.local");
    await page.goto(`/admin/support?q=${encodeURIComponent(subject)}`);
    await page.getByRole("link", { name: new RegExp(subject) }).click();
    await page.getByPlaceholder("Ответить от имени ReelPay Support").fill("Обращение получено и проверено.");
    await page.getByRole("button", { name: "Отправить" }).click();
    await expect(page.getByText("Обращение получено и проверено.", { exact: true })).toBeVisible();
    await expect.poll(async () => prisma.supportMessage.count({
      where: { thread: { subject }, body: "Обращение получено и проверено." }
    })).toBe(1);

    await context.clearCookies();
    await login(page, "anya@clippers.local");
    const thread = await prisma.supportThread.findFirstOrThrow({ where: { subject }, select: { id: true } });
    await page.goto(`/support?thread=${thread.id}`);
    await expect(page.getByText("Обращение получено и проверено.", { exact: true })).toBeVisible();
  } finally {
    await prisma.supportThread.deleteMany({ where: { subject } });
  }
});
