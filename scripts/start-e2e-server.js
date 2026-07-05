const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());
const databaseUrl = new URL(process.env.DATABASE_URL_TEST || process.env.DATABASE_URL);
databaseUrl.searchParams.set("schema", "reelpay_e2e");
function applyE2EEnvironment() {
  process.env.DATABASE_URL = databaseUrl.toString();
  process.env.DIRECT_URL = databaseUrl.toString();
  process.env.E2E_TEST = "1";
}
applyE2EEnvironment();
console.log(`[e2e] database host=${databaseUrl.hostname} schema=${databaseUrl.searchParams.get("schema")}`);
setTimeout(() => {
  const activeUrl = new URL(process.env.DATABASE_URL);
  console.log(`[e2e] active schema=${activeUrl.searchParams.get("schema") || "public"}`);
}, 4_000).unref();

const { startServer } = require("next/dist/server/lib/start-server");

startServer({
  dir: process.cwd(),
  isDev: true,
  hostname: "127.0.0.1",
  port: 3000,
  allowRetry: false
}).then(() => {
  // Next loads .env while booting and may restore the original database URL.
  // Re-apply the isolated schema before the first application module is loaded.
  applyE2EEnvironment();
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
