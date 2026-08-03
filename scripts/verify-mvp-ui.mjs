import { chromium } from "playwright";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

async function expectText(text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible" });
}

async function assertNoHorizontalOverflow() {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (overflow) throw new Error(`Horizontal overflow on ${page.url()}`);
}

await page.goto(`${baseURL}/register`, { waitUntil: "networkidle" });
await expectText("Создать и подтвердить email");
await assertNoHorizontalOverflow();

await page.goto(`${baseURL}/campaigns`, { waitUntil: "networkidle" });
await assertNoHorizontalOverflow();

await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Email").fill("anya@clippers.local");
await page.getByLabel("Пароль").fill("password123");
await Promise.all([
  page.waitForURL(/\/campaigns/),
  page.getByRole("button", { name: /Войти/ }).click()
]);

await page.goto(`${baseURL}/settings/account#social-accounts`, { waitUntil: "networkidle" });
await expectText("Площадки для публикаций");
if (await page.getByText("Через ключ", { exact: true }).count()) throw new Error("Legacy dead-end label is still visible");
await assertNoHorizontalOverflow();

await page.goto(`${baseURL}/upload`, { waitUntil: "networkidle" });
await expectText("Подключ");
await assertNoHorizontalOverflow();
await page.screenshot({ path: "test-results/mvp-upload-mobile.png", fullPage: true });

if (errors.length) throw new Error(`Browser console errors: ${errors.join(" | ")}`);
await browser.close();
console.log("MVP UI smoke passed: register, marketplace, social settings, upload mobile");
