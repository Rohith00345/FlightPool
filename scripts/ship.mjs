import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config();

console.log("======================================================");
console.log("🚀 FLIGHTPOOL SHIP SCRIPT (scripts/ship.mjs)");
console.log("======================================================");

// 1. Verify verify.mjs passes first
console.log("Running verification pre-check...");
try {
  execSync("node scripts/verify.mjs", { stdio: "inherit" });
} catch (e) {
  console.error("❌ Pre-ship verification failed. Aborting ship.");
  process.exit(1);
}

// 2. Check branch
const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
if (branch !== "mega-upgrade") {
  console.error(`❌ Cannot ship from branch '${branch}'. Must be on 'mega-upgrade'.`);
  process.exit(1);
}

// 3. Check for uncommitted changes
const status = execSync("git status --porcelain", { encoding: "utf8" }).trim();
if (status) {
  console.warn("⚠️ Warning: uncommitted changes detected in working tree.");
}

// 4. Push branch to GitHub
const shipMsg = process.argv[2] || "Ship mega-upgrade";
console.log(`\nPushing branch '${branch}' to origin on GitHub ("${shipMsg}")...`);
try {
  execSync(`git push -u origin ${branch}`, { stdio: "inherit" });
  console.log(`\n🎉 Successfully pushed branch '${branch}' to GitHub!`);
  console.log("Vercel preview build will trigger automatically.");
  process.exit(0);
} catch (e) {
  console.error("\n❌ Failed to push to GitHub:", e.message);
  process.exit(1);
}
