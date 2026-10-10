// Run before any work: node scripts/preflight.mjs
// Checks branch, database target, secrets and Docker. Prints only hostnames, never passwords.
import fs from "node:fs";
import { git, sh, hostOf, isLocalHost, Report } from "./_lib.mjs";

const r = new Report("FlightPool preflight");

// 1. Git and branch
const branch = git(["branch", "--show-current"]);
if (branch.code !== 0) {
  r.add("Git available and this is a repository", "FAIL", branch.err || "git not found");
} else {
  r.add("Git available and this is a repository", "PASS");
  const name = branch.out;
  if (!name) r.add("On a named branch", "FAIL", "detached HEAD");
  else if (name === "main" || name === "master") r.add("Not on main", "FAIL", `on '${name}' - create a work branch first`);
  else r.add("Not on main", "PASS", `branch: ${name}`);
}

// 2. Working tree
const dirty = git(["status", "--porcelain"]);
const changed = dirty.out ? dirty.out.split("\n").length : 0;
r.add("Working tree clean", changed ? "WARN" : "PASS", changed ? `${changed} changed file(s) not committed` : "");

// 3. Database target must be local
const envUrl = process.env.DATABASE_URL;
if (envUrl) {
  const h = hostOf(envUrl);
  r.add("Shell DATABASE_URL is local", isLocalHost(h) ? "PASS" : "FAIL", `host: ${h ?? "unreadable"}${isLocalHost(h) ? "" : " - close this window and open a new one"}`);
} else {
  r.add("Shell DATABASE_URL is local", "PASS", "not set in this window (good)");
}
if (fs.existsSync(".env")) {
  const txt = fs.readFileSync(".env", "utf8");
  const m = txt.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);
  if (!m) r.add(".env DATABASE_URL is local", "WARN", "no DATABASE_URL line found");
  else {
    const v = m[1].replace(/^["']|["']$/g, "");
    const h = hostOf(v);
    r.add(".env DATABASE_URL is local", isLocalHost(h) ? "PASS" : "FAIL", `host: ${h ?? "unreadable"}`);
  }
} else {
  r.add(".env exists", "WARN", "no .env file found");
}

// 4. .env must never be tracked, staged or in history
if (fs.existsSync(".env")) {
  r.add(".env is git-ignored", git(["check-ignore", "-q", ".env"]).code === 0 ? "PASS" : "FAIL");
}
r.add(".env is not tracked", git(["ls-files", "--error-unmatch", ".env"]).code === 0 ? "FAIL" : "PASS");
const hist = git(["log", "--all", "--oneline", "--", ".env"]);
r.add(".env never appears in git history", hist.out ? "FAIL" : "PASS", hist.out ? "found in history - tell your reviewer" : "");
const staged = git(["diff", "--cached", "--name-only"]).out.split("\n").filter(Boolean);
const badStaged = staged.filter((f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith(".env.example"));
r.add("No env files staged", badStaged.length ? "FAIL" : "PASS", badStaged.join(", "));

// 5. Secret scan over tracked and untracked (not ignored) files
const patterns = [
  ["Neon-style password", "npg_[A-Za-z0-9]{8,}"],
  ["old dev password", "flightpool_dev_pass"],
  ["Razorpay key", "rzp_(live|test)_[A-Za-z0-9]{6,}"],
  ["AWS access key", "AKIA[0-9A-Z]{16}"],
  ["Private key block", "-----BEGIN [A-Z ]*PRIVATE KEY-----"],
];
const excludes = [":(exclude)package-lock.json", ":(exclude)scripts/preflight.mjs", ":(exclude)docs/screenshots"];
let leaks = 0;
for (const [label, pat] of patterns) {
  const g = git(["grep", "--untracked", "-n", "-I", "-E", pat, "--", ".", ...excludes]);
  const files = g.out ? [...new Set(g.out.split("\n").map((l) => l.split(":")[0]))] : [];
  if (files.length) {
    leaks += files.length;
    r.add(`No ${label} in files`, "FAIL", `found in: ${files.join(", ")}`);
  }
}
// connection strings with credentials that point to a non-local host
const cs = git(["grep", "--untracked", "-n", "-I", "-E", "postgres(ql)?://[^:@/ ]+:[^@ ]+@[^/ ]+", "--", ".", ...excludes]);
const remote = [];
if (cs.out) {
  for (const line of cs.out.split("\n")) {
    const m = line.match(/@([^/:?\s"'`]+)/);
    if (m && !isLocalHost(m[1].toLowerCase()) && !/^(host|hostname|your|example|db|postgres)/i.test(m[1])) remote.push(line.split(":")[0]);
  }
}
if (remote.length) {
  leaks += remote.length;
  r.add("No remote database credentials in files", "FAIL", `found in: ${[...new Set(remote)].join(", ")}`);
}
if (!leaks) r.add("Secret scan (passwords, keys, remote DB URLs)", "PASS");

// 6. Tooling
const major = Number(process.versions.node.split(".")[0]);
r.add("Node 18 or newer", major >= 18 ? "PASS" : "FAIL", `node ${process.versions.node}`);
const dk = sh("docker ps --format {{.Names}}");
if (dk.code !== 0) r.add("Docker running", "WARN", "Docker not reachable - open Docker Desktop before running tests");
else r.add("Local Postgres container running", /flightpool-postgres/.test(dk.out) ? "PASS" : "WARN", /flightpool-postgres/.test(dk.out) ? "" : "run: docker compose up -d");

r.print();
process.exit(r.failed ? 1 : 0);
