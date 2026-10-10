// Full automatic check: node scripts/verify.mjs  (add --fast to skip build and E2E, --keep-going to run all steps)
import fs from "node:fs";
import { git, live, Report } from "./_lib.mjs";

const args = process.argv.slice(2);
const fast = args.includes("--fast");
const keepGoing = args.includes("--keep-going");
const r = new Report("FlightPool verification");

// Preflight first
const pre = live("node scripts/preflight.mjs");
r.add("Preflight (branch, database target, secrets)", pre === 0 ? "PASS" : "FAIL");

const steps = [
  ["Lint", "npm run lint"],
  ["Type check", "npx tsc --noEmit"],
  ["Unit and integration tests", "npm test"],
];
if (!fast) {
  steps.push(["Production build", "npm run build"]);
  steps.push(["End-to-end tests (Playwright)", "npm run test:e2e"]);
}

let stop = pre !== 0 && !keepGoing;
for (const [name, cmd] of steps) {
  if (stop) {
    r.add(name, "SKIP", "skipped after an earlier failure");
    continue;
  }
  console.log(`\n>>> ${name}: ${cmd}\n`);
  const t = Date.now();
  const code = live(cmd);
  const secs = ((Date.now() - t) / 1000).toFixed(1);
  r.add(name, code === 0 ? "PASS" : "FAIL", `${secs}s`);
  if (code !== 0 && !keepGoing) stop = true;
}

// Test-weakening check against main
let base = null;
for (const ref of ["main", "origin/main"]) {
  if (git(["rev-parse", "--verify", "--quiet", ref]).code === 0) {
    base = ref;
    break;
  }
}
if (base) {
  const d = git(["diff", "--numstat", base, "--", "tests"]);
  let del = 0;
  for (const line of d.out.split("\n").filter(Boolean)) {
    const n = Number(line.split("\t")[1]);
    if (!Number.isNaN(n)) del += n;
  }
  r.add("Test lines deleted vs " + base, del ? "WARN" : "PASS", del ? `${del} deleted line(s) - review that no assertion was weakened` : "no deletions");
} else {
  r.add("Test-weakening check", "SKIP", "no main branch to compare");
}

// Vercel cron schedule check (Hobby plan allows daily only)
if (fs.existsSync("vercel.json")) {
  try {
    const v = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
    const frequent = (v.crons || []).filter((c) => {
      const [min = "", hour = ""] = String(c.schedule).split(/\s+/);
      return hour === "*" || /[*\/,-]/.test(min) || hour.includes("/") || hour.includes(",");
    });
    r.add("Cron schedules are daily-or-slower", frequent.length ? "WARN" : "PASS", frequent.length ? `more frequent than daily: ${frequent.map((c) => c.path).join(", ")} - the free Vercel plan may reject the deploy` : "");
  } catch {
    r.add("vercel.json is valid JSON", "FAIL");
  }
}

// Generated files that must not be committed
const tracked = git(["ls-files"]).out.split("\n");
const junk = tracked.filter((f) => /(^|\/)(playwright-report|blob-report|test-results|\.next)\//.test(f) || /\.log$/.test(f));
r.add("No generated files tracked", junk.length ? "FAIL" : "PASS", junk.slice(0, 3).join(", "));

r.print();

fs.mkdirSync("docs", { recursive: true });
const md = [
  "# Verification report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "| Check | Result | Detail |",
  "|---|---|---|",
  ...r.rows.map((x) => `| ${x.name} | ${x.status} | ${x.detail.replace(/\|/g, "/")} |`),
  "",
].join("\n");
fs.writeFileSync("docs/VERIFY_REPORT.md", md);
console.log("Report saved to docs/VERIFY_REPORT.md");
process.exit(r.failed ? 1 : 0);
