import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("a one-time reset link changes the password and revokes the old session", async ({ page }) => {
  const suffix = randomBytes(6).toString("hex");
  const email = `recovery-${suffix}@example.test`;
  const oldPassword = "old-secure-password";
  const newPassword = "new-secure-password";
  const user = await prisma.user.create({
    data: {
      email,
      name: "Recovery User",
      handle: `recovery_${suffix}`,
      referralCode: `REC${suffix}`.slice(0, 12).toUpperCase(),
      passwordHash: await bcrypt.hash(oldPassword, 12),
      role: "BOTH",
      preferredRoleMode: "worker"
    }
  });

  try {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(oldPassword);
    await page.getByRole("button", { name: /^Войти/ }).click();
    await expect(page).toHaveURL(/\/campaigns$/);

    const token = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 60 * 60_000)
      }
    });

    await page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
    await page.locator('input[name="password"]').fill(newPassword);
    await page.locator('input[name="confirmPassword"]').fill(newPassword);
    await page.getByRole("button", { name: /Сохранить пароль/ }).click();
    await expect(page).toHaveURL(/\/login\?reset=ok$/);
    await expect(page.getByText("Пароль изменён", { exact: false })).toBeVisible();

    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(newPassword);
    await page.getByRole("button", { name: /^Войти/ }).click();
    await expect(page).toHaveURL(/\/campaigns$/);

    const consumed = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });
    expect(consumed?.usedAt).not.toBeNull();
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }
});
