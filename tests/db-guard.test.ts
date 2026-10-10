import { describe, it, expect } from "vitest";
import {
  extractDatabaseHost,
  isLocalDatabase,
  assertLocalDatabase,
} from "../lib/db-guard";

describe("Database Guard (Local Protection)", () => {
  it("correctly identifies localhost as local", () => {
    expect(isLocalDatabase("postgresql://flightpool:pass@localhost:5433/flightpool")).toBe(true);
    expect(isLocalDatabase("postgresql://user:pass@127.0.0.1:5432/db")).toBe(true);
    expect(isLocalDatabase("postgresql://user:pass@[::1]:5432/db")).toBe(true);
  });

  it("extracts the hostname accurately", () => {
    expect(
      extractDatabaseHost("postgresql://flightpool:secret@localhost:5433/flightpool?schema=public")
    ).toBe("localhost");
    expect(
      extractDatabaseHost("postgres://admin:pass@db.aws.neon.tech:5432/production")
    ).toBe("db.aws.neon.tech");
  });

  it("refuses destructive operations against remote databases with clear error message", () => {
    const remoteUrls = [
      "postgresql://user:pass@db.aws.neon.tech/flightpool",
      "postgresql://postgres:secret@db.supabase.co:5432/production",
      "postgresql://app:pass@192.168.1.50:5432/flightpool",
      "postgresql://app:pass@prod-db.internal:5432/flightpool",
    ];

    for (const url of remoteUrls) {
      expect(isLocalDatabase(url)).toBe(false);
      expect(() => assertLocalDatabase("Database reset", url)).toThrow(
        /FATAL: Database reset REFUSED! Target database host '.*' is NOT localhost or 127.0.0.1/
      );
    }
  });

  it("allows destructive operations on localhost and 127.0.0.1 without throwing", () => {
    expect(() =>
      assertLocalDatabase("Local reset", "postgresql://flightpool:pass@localhost:5433/flightpool")
    ).not.toThrow();

    expect(() =>
      assertLocalDatabase("Local reset", "postgresql://flightpool:pass@127.0.0.1:5433/flightpool")
    ).not.toThrow();
  });

  it("fails closed when DATABASE_URL is missing or malformed", () => {
    expect(() => assertLocalDatabase("Operation", "")).toThrow(/DATABASE_URL environment variable is required/);
    expect(() => assertLocalDatabase("Operation", "not-a-valid-url")).toThrow(/not a valid database connection URL/);
  });
});
