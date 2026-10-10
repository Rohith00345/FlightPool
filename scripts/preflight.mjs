import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config();

console.log("======================================================");
console.log("🛫 FLIGHTPOOL PREFLIGHT CHECK (scripts/preflight.mjs)");
console.log("======================================================");

let failed = false;

// 1. Branch check
try {
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  if (branch !== "mega-upgrade") {
    console.error(`❌ Branch check failed: expected 'mega-upgrade', found '${branch}'`);
    failed = true;
  } else {
    console.log(`✓ Active branch is 'mega-upgrade'`);
  }
} catch (e) {
  console.error(`❌ Could not determine git branch: ${e.message}`);
  failed = true;
}

// 2. Database safety guard
const dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl) {
  console.error(`❌ DATABASE_URL is not set in environment`);
  failed = true;
} else {
  try {
    const url = new URL(dbUrl);
    const host = url.hostname.toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!isLocal) {
      console.error(`❌ SAFETY VIOLATION: DATABASE_URL host '${host}' is NOT localhost! Remote DBs forbidden.`);
      failed = true;
    } else {
      console.log(`✓ Database host is strictly local (${host}:${url.port || 5432})`);
    }
  } catch (e) {
    console.error(`❌ Invalid DATABASE_URL format: ${e.message}`);
    failed = true;
  }
}

// 3. Secrets verification
const sessionSecret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  console.error(`❌ SESSION_SECRET missing or insecure (min 32 chars required)`);
  failed = true;
} else {
  console.log(`✓ Secure SESSION_SECRET configured (${sessionSecret.length} chars)`);
}

// 4. Test Prisma DB connection
try {
  execSync("npx prisma db execute --schema prisma/schema.prisma --stdin", {
    input: "SELECT 1;",
    stdio: ["pipe", "ignore", "pipe"],
    encoding: "utf8",
  });
  console.log(`✓ Local PostgreSQL database connection verified`);
} catch (e) {
  console.error(`❌ Could not connect to local database: ${e.message}`);
  failed = true;
}

console.log("======================================================");
if (failed) {
  console.error("❌ PREFLIGHT CHECKS FAILED. Fix errors before proceeding.");
  process.exit(1);
} else {
  console.log("✅ ALL PREFLIGHT CHECKS PASSED. Ready to build.");
  process.exit(0);
}
