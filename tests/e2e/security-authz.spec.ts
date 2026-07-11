import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("password123");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/campaigns$/);
}

test("non-admin cannot open the administration area", async ({ page }) => {
  await login(page, "anya@clippers.local");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.locator("body")).not.toContainText("Интеграции и готовность");
});

test("private campaign resists direct object access", async ({ page, context }) => {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "nikita@clippers.local" } });
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
  const campaign = await prisma.campaign.create({
    data: {
      ownerId: owner.id,
      title: `E2E private authz ${suffix}`,
      description: "Приватный заказ доступен только владельцу.",
      sourceUrl: "https://example.com/private-source",
      sourcePlatform: "YOUTUBE",
      allowedPlatformsJson: JSON.stringify(["YOUTUBE"]),
      rulesJson: "{}",
      cpmRateCents: 5_000,
      viewThreshold: 10_000,
      totalBudgetCents: 300_000,
      remainingBudgetCents: 300_000,
      trackingPrefix: `authz_${suffix}`,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      visibility: "PRIVATE_INVITE",
      isAdvertising: false,
      isDemo: false
    }
  });

  try {
    await login(page, "anya@clippers.local");
    await page.goto(`/campaigns/${campaign.id}`);
    // App Router can stream the shell with HTTP 200 before notFound() is resolved;
    // the security property is that no private campaign data reaches the page.
    await expect(page.getByRole("heading", { name: "Страница не найдена" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(campaign.title);
    await expect(page.locator("body")).not.toContainText(campaign.description);

    await context.clearCookies();
    await login(page, "nikita@clippers.local");
    const allowed = await page.goto(`/campaigns/${campaign.id}`);
    expect(allowed?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: campaign.title })).toBeVisible();
  } finally {
    await prisma.campaign.deleteMany({ where: { id: campaign.id } });
  }
});

test.afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { title: { startsWith: "E2E private authz" } } });
  await prisma.$disconnect();
});
