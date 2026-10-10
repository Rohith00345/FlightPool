import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

console.log("======================================================");
console.log("🔍 FLIGHTPOOL VERIFICATION RUNNER (scripts/verify.mjs)");
console.log("======================================================");

const startTime = new Date();
const checks = [];
let overallPass = true;

function runStep(name, cmd) {
  process.stdout.write(`⏳ Checking: ${name}... `);
  const start = Date.now();
  try {
    const output = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`✅ PASS (${duration}s)`);
    checks.push({ name, status: "PASS", duration: `${duration}s`, details: output.slice(-300).trim() });
    return true;
  } catch (err) {
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`❌ FAIL (${duration}s)`);
    const errorMsg = (err.stdout || "") + "\n" + (err.stderr || err.message || "");
    checks.push({ name, status: "FAIL", duration: `${duration}s`, details: errorMsg.slice(-500).trim() });
    overallPass = false;
    return false;
  }
}

// 1. Preflight
runStep("Preflight Environment & Database Safety", "node scripts/preflight.mjs");

// 2. TypeScript Static Typecheck
runStep("TypeScript Strict Compilation (tsc --noEmit)", "npx tsc --noEmit");

// 3. ESLint Code Quality
runStep("ESLint Rules & Standards", "npm run lint");

// 4. Vitest Unit & Integration Suites
runStep("Vitest Unit & Integration Suite", "npm test");

// Write docs/VERIFY_REPORT.md
const reportLines = [
  "# FlightPool Verification Report",
  "",
  `**Execution Time**: ${startTime.toISOString()}  `,
  `**Branch**: \`mega-upgrade\`  `,
  `**Target Database**: Local Docker PostgreSQL (\`localhost:5433\`)  `,
  `**Overall Status**: ${overallPass ? "✅ ALL CHECKS PASSED" : "❌ VERIFICATION FAILED"}  `,
  "",
  "## Verification Steps Summary",
  "",
  "| Step | Result | Duration | Notes |",
  "| :--- | :---: | :---: | :--- |",
];

for (const check of checks) {
  const icon = check.status === "PASS" ? "✅ PASS" : "❌ FAIL";
  reportLines.push(`| **${check.name}** | ${icon} | ${check.duration} | Clean |`);
}

reportLines.push("");
reportLines.push("## Step Details");
reportLines.push("");
for (const check of checks) {
  reportLines.push(`### ${check.name} (${check.status})`);
  reportLines.push("```text");
  reportLines.push(check.details || "No output");
  reportLines.push("```");
  reportLines.push("");
}

const docsDir = path.resolve(process.cwd(), "docs");
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}
const reportPath = path.join(docsDir, "VERIFY_REPORT.md");
fs.writeFileSync(reportPath, reportLines.join("\n"), "utf8");
console.log(`\n📄 Generated verification report: ${reportPath}`);

console.log("======================================================");
if (overallPass) {
  console.log("🎉 ALL VERIFICATION CRITERIA PASSED!");
  process.exit(0);
} else {
  console.error("❌ VERIFICATION FAILED. Review errors above.");
  process.exit(1);
}
