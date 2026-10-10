import { execSync } from "child_process";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config();

console.log("======================================================");
console.log("🗄️ FLIGHTPOOL LIVE DATABASE MIGRATION RUNNER");
console.log("======================================================");

const targetUrl = process.env.NEON_DATABASE_URL || process.env.LIVE_DATABASE_URL || process.env.DATABASE_URL;

if (!targetUrl) {
  console.error("❌ Target database URL missing. Set NEON_DATABASE_URL, LIVE_DATABASE_URL, or DATABASE_URL.");
  process.exit(1);
}

try {
  const url = new URL(targetUrl);
  console.log(`Target database host: ${url.hostname}`);
  console.log(`Database name:        ${url.pathname.replace(/^\//, "")}`);
} catch (e) {
  console.error("❌ Invalid target database URL format.");
  process.exit(1);
}

async function run() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question("\n⚠️ You are about to apply migrations to a LIVE database.\nType 'MIGRATE LIVE' to confirm: ", (input) => {
      rl.close();
      resolve(input.trim());
    });
  });

  if (answer !== "MIGRATE LIVE") {
    console.error("❌ Confirmation failed. Expected 'MIGRATE LIVE'. Aborting.");
    process.exit(1);
  }

  console.log("\nDeploying pending Prisma migrations...");
  try {
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: targetUrl },
      stdio: "inherit",
    });
    console.log("\n✅ Live database migration completed successfully.");
  } catch (e) {
    console.error("\n❌ Migration deployment failed:", e.message);
    process.exit(1);
  }
}

run();
