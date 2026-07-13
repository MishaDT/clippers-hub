import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("combo@clippers.local");
  await page.getByLabel("Пароль").fill("password123");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
}

test("mobile chat filters open, apply and close without reload", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile-only interaction");
  await login(page);
  await page.goto("/chats");

  const trigger = page.getByRole("button", { name: "Фильтры" });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Фильтры чатов" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(page.getByRole("dialog", { name: "Фильтры чатов" })).toHaveCount(0);

  await page.locator(".chat-thread-row").first().click();
  await expect(page.locator(".chat-card-v2")).toBeVisible();
  await expect(page.getByPlaceholder("Напишите сообщение")).toBeVisible();
  await page.getByRole("link", { name: /Все чаты/ }).click();

  await page.locator(".chat-type-tabs").getByRole("link", { name: /Коллабы/ }).click();
  await expect(page).toHaveURL(/type=collabs/);
  await expect(page.getByRole("dialog", { name: "Фильтры чатов" })).toHaveCount(0);
});

test("notification archive page is compact and reachable", async ({ page }) => {
  await login(page);
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Уведомления" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Архив" })).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("landing shows a clear role-specific roadmap on portrait screens", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile-only landing check");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /От исходного видео до проверенного результата/i })).toBeVisible();
  await page.getByRole("tab", { name: "Клипперам" }).click();
  await expect(page.getByRole("heading", { name: /От заказа до выплаты/i })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
