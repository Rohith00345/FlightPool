// Shared helpers for FlightPool check scripts. No secrets are ever printed.
import { spawnSync } from "node:child_process";

export function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return { code: r.status ?? 1, out: (r.stdout || "").trim(), err: (r.stderr || "").trim(), error: r.error };
}

export function sh(cmd) {
  const r = spawnSync(cmd, { shell: true, encoding: "utf8" });
  return { code: r.status ?? 1, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

// Runs a command and streams its output to the console.
export function live(cmd) {
  const r = spawnSync(cmd, { shell: true, stdio: "inherit" });
  return r.status ?? 1;
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
export const isLocalHost = (h) => !!h && LOCAL.has(h);

export class Report {
  constructor(title) {
    this.title = title;
    this.rows = [];
  }
  add(name, status, detail = "") {
    this.rows.push({ name, status, detail });
  }
  get failed() {
    return this.rows.some((r) => r.status === "FAIL");
  }
  count(s) {
    return this.rows.filter((r) => r.status === s).length;
  }
  print() {
    console.log(`\n=== ${this.title} ===`);
    for (const r of this.rows) console.log(`[${r.status}] ${r.name}${r.detail ? " - " + r.detail : ""}`);
    console.log(`\nSummary: ${this.count("PASS")} passed, ${this.count("WARN")} warnings, ${this.count("FAIL")} failed`);
    console.log(this.failed ? "RESULT: FAIL - fix the items marked FAIL before continuing.\n" : "RESULT: OK\n");
  }
}
