import { expect, test } from "@playwright/test";

test.describe("leaderboard experience", () => {
  test("podium is responsive and unobstructed", async ({ page, isMobile }) => {
    await page.goto("/leaderboard?period=all");
    await expect(page.getByRole("heading", { name: /Доска лидеров/i })).toBeVisible();
    await expect(page.locator(".podium-card")).toHaveCount(3);
    const podiumNames = await page.locator(".podium-name").allTextContents();
    expect(podiumNames.every((name) => name.trim().length > 0)).toBe(true);
    expect(new Set(podiumNames).size).toBe(3);

    const layout = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
      const hero = rect(".leaderboard-hero");
      const crown = rect(".podium-crown");
      const avatar = rect(".podium-card--first .podium-avatar img");
      const first = rect(".podium-card--first");
      const second = rect(".podium-card--second");
      const third = rect(".podium-card--third");
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        heroHeight: hero?.height || 0,
        crownInside: Boolean(hero && crown && crown.top >= hero.top),
        crownOverlapsAvatar: Boolean(crown && avatar && crown.bottom > avatar.top),
        firstCenter: first ? first.left + first.width / 2 : 0,
        secondCenter: second ? second.left + second.width / 2 : 0,
        thirdCenter: third ? third.left + third.width / 2 : 0,
        firstHeight: first?.height || 0,
        secondHeight: second?.height || 0,
        thirdHeight: third?.height || 0
      };
    });

    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.crownInside).toBe(true);
    expect(layout.crownOverlapsAvatar).toBe(false);
    if (isMobile) {
      expect(layout.firstHeight).toBeGreaterThanOrEqual(layout.secondHeight);
      expect(layout.firstHeight).toBeGreaterThanOrEqual(layout.thirdHeight);
      expect(layout.heroHeight).toBeLessThan(380);
      expect(layout.secondCenter).toBeLessThan(layout.firstCenter);
      expect(layout.firstCenter).toBeLessThan(layout.thirdCenter);
      await expect(page.locator(".mobile-rank-overview")).toHaveCount(0);
    } else {
      expect(layout.firstHeight).toBeGreaterThan(layout.secondHeight);
      expect(layout.firstHeight).toBeGreaterThan(layout.thirdHeight);
      expect(layout.heroHeight).toBeLessThan(500);
      await expect(page.locator(".mobile-rank-overview")).toBeHidden();
    }

    await expect(page.locator(".podium-flame-canvas")).toHaveCount(3);
    await expect(page.locator(".podium-flame-canvas").first()).toBeHidden();
    const legacyLabel = await page.locator(".leaderboard-hero").evaluate((element) =>
      getComputedStyle(element, "::before").content
    );
    expect(["none", '""']).toContain(legacyLabel);
  });

  test("period controls react and navigate correctly", async ({ page }) => {
    await page.goto("/leaderboard?period=all");
    const week = page.locator('.leaderboard-tabs a[href*="period=week"]');
    await week.click();
    await expect(page).toHaveURL(/period=week/);
    await expect(week).toHaveClass(/active/);
    await expect(page.locator(".podium-card")).toHaveCount(3);

    const allTime = page.locator('.leaderboard-tabs a[href*="period=all"]');
    await allTime.click();
    await expect(page).toHaveURL(/period=all/);
    await expect(allTime).toHaveClass(/active/);
  });
});
