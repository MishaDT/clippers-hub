import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("password123");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/campaigns$/);
}

test("authorized interface stays inside the selected role", async ({ page, context, isMobile }) => {
  const navSelector = isMobile ? ".bottom-nav" : ".top-nav";
  await login(page, "anya@clippers.local");
  await expect(page.getByRole("heading", { name: /Найди ролик/i })).toBeVisible();
  await expect(page.locator(`${navSelector} a[href="/campaigns/new"]`)).toHaveCount(0);
  await expect(page.locator(`${navSelector} a[href="/upload"]`)).toBeVisible();

  await page.goto("/wallet");
  await expect(page.getByRole("heading", { name: "Выплаты", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Вывести средства" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Пополнить баланс" })).toHaveCount(0);

  await page.goto("/campaigns/new");
  await expect(page).toHaveURL(/\/campaigns$/);

  if (isMobile) {
    await page.goto("/leaderboard");
    await expect(page.locator(".mobile-rank-overview")).toBeVisible();
  }

  await context.clearCookies();
  await login(page, "nikita@clippers.local");
  await expect(page.getByRole("heading", { name: /Мои кампании/i })).toBeVisible();
  await expect(page.locator(`${navSelector} a[href="/campaigns/new"]`)).toBeVisible();
  await expect(page.locator(`${navSelector} a[href="/upload"]`)).toHaveCount(0);

  await page.goto("/wallet");
  await expect(page.getByRole("heading", { name: "Бюджет", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Пополнить баланс" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Вывести средства" })).toHaveCount(0);

  await page.goto("/upload");
  await expect(page).toHaveURL(/\/campaigns$/);

  await page.goto("/feed");
  await expect(page.getByRole("link", { name: /Открыть кампанию/i }).first()).toBeVisible();

  if (isMobile) {
    await page.goto("/leaderboard");
    await expect(page.locator(".mobile-rank-overview")).toHaveCount(0);
  }
});
