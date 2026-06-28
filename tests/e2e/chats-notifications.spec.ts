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

  await trigger.click();
  await page.getByRole("button", { name: /Коллабы/ }).click();
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

test("presentation asks portrait users for a viewing mode", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Portrait prompt is mobile-only");
  await page.goto("/");
  await page.getByRole("button", { name: /Смотреть, как работает ReelPay/ }).click();
  await expect(page.getByRole("dialog", { name: "Режим просмотра" })).toBeVisible();
  await page.getByRole("button", { name: "Смотреть вертикально" }).click();
  await expect(page.getByRole("dialog", { name: "Режим просмотра" })).toHaveCount(0);
});
