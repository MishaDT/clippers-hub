// Запускает prisma/seed.js только если база пустая.
// Нужно, чтобы повторные деплои на Netlify не падали на повторном сидинге
// (уникальные email/handle). Безопасно вызывать на каждой сборке.
const { execSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");

(async () => {
  const prisma = new PrismaClient();
  let count = 0;
  try {
    count = await prisma.user.count();
  } catch (err) {
    console.error("seed-if-empty: не удалось прочитать users, пропускаю сидинг:", err.message);
    await prisma.$disconnect();
    process.exit(0);
  }
  await prisma.$disconnect();

  if (count > 0) {
    console.log(`seed-if-empty: в базе уже ${count} пользователей — сидинг пропущен.`);
    return;
  }
  console.log("seed-if-empty: база пустая — запускаю seed.js...");
  execSync("node prisma/seed.js", { stdio: "inherit" });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
