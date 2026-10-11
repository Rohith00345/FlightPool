// Safe commit and push: node scripts/ship.mjs "your message"   (add --skip-verify to skip the full test run)
import { git, live } from "./_lib.mjs";

const args = process.argv.slice(2);
const skipVerify = args.includes("--skip-verify");
const message = args.filter((a) => !a.startsWith("--")).join(" ").trim();
if (!message) {
  console.error('Usage: node scripts/ship.mjs "commit message" [--skip-verify]');
  process.exit(1);
}

if (live("node scripts/preflight.mjs") !== 0) process.exit(1);
if (!skipVerify && live("node scripts/verify.mjs") !== 0) {
  console.error("Verification failed. Nothing was committed or pushed.");
  process.exit(1);
}

const branch = git(["branch", "--show-current"]).out;
if (!branch || branch === "main" || branch === "master") {
  console.error("Refusing to commit or push on main/master.");
  process.exit(1);
}

git(["add", "-A"]);
const staged = git(["diff", "--cached", "--name-only"]).out.split("\n").filter(Boolean);
const bad = staged.filter((f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith(".env.example"));
if (bad.length) {
  git(["reset"]);
  console.error("Refusing: env files were staged: " + bad.join(", "));
  process.exit(1);
}

if (staged.length) {
  const c = git(["commit", "-m", message]);
  if (c.code !== 0) {
    console.error("Commit failed:\n" + (c.err || c.out));
    process.exit(1);
  }
  console.log(`Committed ${staged.length} file(s) on ${branch}.`);
} else {
  console.log("Nothing new to commit.");
}

const push = live(`git push -u origin ${branch}`);
if (push !== 0) {
  console.error("Push failed. Your work is committed locally and safe.");
  process.exit(1);
}
console.log(`\nPushed. Review it at: https://github.com/Rohith00345/FlightPool/tree/${branch}`);
