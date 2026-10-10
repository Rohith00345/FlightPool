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

console.log("\n✅ Ready for user-initiated shipping / deployment.");
console.log("Note: As specified in safety rules, automated push/merge is disabled.");
console.log("The user will execute deployment steps manually.");
process.exit(0);
