/**
 * Database Guard Utility
 *
 * Ensures destructive operations (migrate reset, demo seeds, table purges)
 * REFUSE to run unless the target DATABASE_URL host is strictly localhost or 127.0.0.1.
 */

export function extractDatabaseHost(databaseUrl?: string): string {
  const urlStr = databaseUrl ?? process.env.DATABASE_URL;
  if (!urlStr || urlStr.trim() === "") {
    throw new Error("FATAL: DATABASE_URL environment variable is required but is missing or empty.");
  }

  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    throw new Error(`FATAL: DATABASE_URL is not a valid database connection URL.`);
  }
}

export function isLocalDatabase(databaseUrl?: string): boolean {
  try {
    const host = extractDatabaseHost(databaseUrl);
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export function assertLocalDatabase(
  operationName = "Destructive database operation",
  databaseUrl?: string
): void {
  const host = extractDatabaseHost(databaseUrl);
  if (!isLocalDatabase(databaseUrl)) {
    throw new Error(
      `FATAL: ${operationName} REFUSED! Target database host '${host}' is NOT localhost or 127.0.0.1. Destructive actions and demo seeds may only run against local databases to prevent accidental data loss.`
    );
  }
}
