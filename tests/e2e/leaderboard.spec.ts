import { expect, test } from "@playwright/test";

async function canvasSignature(page: import("@playwright/test").Page) {
  return page.locator(".podium-flame-canvas").evaluateAll((canvases) =>
    canvases.map((element) => {
      const canvas = element as HTMLCanvasElement;
      const context = canvas.getContext("2d");
      if (!context) return { alpha: 0, hash: 0 };
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let alpha = 0;
      let hash = 2166136261;
      for (let index = 3; index < data.length; index += 64) {
        alpha += data[index];
        hash ^= data[index];
        hash = Math.imul(hash, 16777619);
      }
      return { alpha, hash: hash >>> 0 };
    })
  );
}

test.describe("leaderboard experience", () => {
  test("podium is responsive, unobstructed and animated", async ({ page, isMobile }) => {
    await page.goto("/leaderboard?period=all");
    await expect(page.getByRole("heading", { name: /Доска лидеров/i })).toBeVisible();
    await expect(page.locator(".podium-card")).toHaveCount(3);

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
    expect(layout.firstHeight).toBeGreaterThan(layout.secondHeight);
    expect(layout.firstHeight).toBeGreaterThan(layout.thirdHeight);

    if (isMobile) {
      expect(layout.heroHeight).toBeLessThan(380);
      expect(layout.secondCenter).toBeLessThan(layout.firstCenter);
      expect(layout.firstCenter).toBeLessThan(layout.thirdCenter);
    } else {
      expect(layout.heroHeight).toBeLessThan(500);
    }

    await expect(page.locator(".podium-flame-canvas")).toHaveCount(3);
    await page.waitForTimeout(250);
    const before = await canvasSignature(page);
    await page.waitForTimeout(650);
    const after = await canvasSignature(page);

    expect(before.every((item) => item.alpha > 1000)).toBe(true);
    expect(after.some((item, index) => item.hash !== before[index]?.hash)).toBe(true);
  });

  test("period controls react and navigate correctly", async ({ page }) => {
    await page.goto("/leaderboard?period=all");
    const week = page.locator('.leaderboard-tabs a[href*="period=week"]');
    await week.click();
    await expect(page).toHaveURL(/period=week/);
    await expect(week).toHaveClass(/active/);

    const allTime = page.locator('.leaderboard-tabs a[href*="period=all"]');
    await allTime.click();
    await expect(page).toHaveURL(/period=all/);
    await expect(allTime).toHaveClass(/active/);
  });
});
