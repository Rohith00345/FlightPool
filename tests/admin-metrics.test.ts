import { describe, it, expect } from "vitest";
import {
  computeAverageWaitTime,
  computeFillRates,
  computeCapturedRevenue,
  MatchedWaitRecord,
  PoolSummary,
  CompletedTripRevenueItem,
} from "../lib/metrics";

describe("Admin Dashboard Metrics Engine (Part B)", () => {
  describe("B1: Average Wait Time Invariants", () => {
    it("computes average wait time as confirmedAt minus readyAt for matched requests within 24h", () => {
      const now = new Date("2026-10-11T12:00:00Z");

      // Fixtures: 3 matched requests within the last 24 hours
      const fixtures: MatchedWaitRecord[] = [
        {
          // Waited 8.5 minutes
          readyAt: new Date("2026-10-11T10:00:00Z"),
          confirmedAt: new Date("2026-10-11T10:08:30Z"),
        },
        {
          // Waited 14.0 minutes
          readyAt: new Date("2026-10-11T11:00:00Z"),
          confirmedAt: new Date("2026-10-11T11:14:00Z"),
        },
        {
          // Waited 5.0 minutes
          readyAt: new Date("2026-10-11T11:45:00Z"),
          confirmedAt: new Date("2026-10-11T11:50:00Z"),
        },
      ];

      const result = computeAverageWaitTime(fixtures, now);
      // (8.5 + 14.0 + 5.0) / 3 = 27.5 / 3 = 9.166... -> 9.2m
      expect(result.avgWaitMinutes).toBe(9.2);
      expect(result.display).toBe("9.2m");
      expect(result.count).toBe(3);
    });

    it("strictly ignores stale seed data older than 24 hours (prevents 345.2m bug)", () => {
      const now = new Date("2026-10-11T12:00:00Z");

      const fixturesWithStaleSeed: MatchedWaitRecord[] = [
        {
          // Stale seed record from 3 days ago (would produce 345m+ if included)
          readyAt: new Date("2026-10-08T06:00:00Z"),
          confirmedAt: new Date("2026-10-08T11:45:00Z"),
        },
        {
          // Stale seed record from 48 hours ago
          readyAt: new Date("2026-10-09T10:00:00Z"),
          confirmedAt: new Date("2026-10-09T10:15:00Z"),
        },
        {
          // Fresh valid record within last 24h: waited 6.0 minutes
          readyAt: new Date("2026-10-11T11:20:00Z"),
          confirmedAt: new Date("2026-10-11T11:26:00Z"),
        },
      ];

      const result = computeAverageWaitTime(fixturesWithStaleSeed, now);
      expect(result.count).toBe(1);
      expect(result.avgWaitMinutes).toBe(6.0);
      expect(result.display).toBe("6m");
    });

    it("caps wait time at the 20-minute wait cap floor", () => {
      const now = new Date("2026-10-11T12:00:00Z");

      const fixturesOverCap: MatchedWaitRecord[] = [
        {
          // Waited 28 minutes raw, must be capped at 20m
          readyAt: new Date("2026-10-11T09:00:00Z"),
          confirmedAt: new Date("2026-10-11T09:28:00Z"),
        },
      ];

      const result = computeAverageWaitTime(fixturesOverCap, now);
      expect(result.avgWaitMinutes).toBe(20.0);
      expect(result.display).toBe("20m");
    });

    it("displays '-' when there is no data or all records are stale", () => {
      const now = new Date("2026-10-11T12:00:00Z");

      expect(computeAverageWaitTime([], now)).toEqual({
        avgWaitMinutes: null,
        display: "-",
        count: 0,
      });

      const allStaleFixtures: MatchedWaitRecord[] = [
        {
          readyAt: new Date("2026-09-01T10:00:00Z"),
          confirmedAt: new Date("2026-09-01T10:10:00Z"),
        },
      ];
      expect(computeAverageWaitTime(allStaleFixtures, now)).toEqual({
        avgWaitMinutes: null,
        display: "-",
        count: 0,
      });
    });
  });

  describe("B3: Fill Rate With and Without Solo Pools", () => {
    it("computes fill rate with all pools and separately without single-rider solo pools", () => {
      const pools: PoolSummary[] = [
        { id: "p1", memberCount: 3, status: "CONFIRMED" }, // shared
        { id: "p2", memberCount: 2, status: "CONFIRMED" }, // shared
        { id: "p3", memberCount: 1, status: "CONFIRMED" }, // solo
        { id: "p4", memberCount: 1, status: "CONFIRMED" }, // solo
      ];

      const stats = computeFillRates(pools);

      // Total members = 3 + 2 + 1 + 1 = 7 across 4 pools -> 7 / 4 = 1.75
      expect(stats.fillRateTotal).toBe(1.75);

      // Without solo: (3 + 2) / 2 shared pools = 5 / 2 = 2.50
      expect(stats.fillRateWithoutSolo).toBe(2.5);
      expect(stats.soloPoolsCount).toBe(2);
      expect(stats.sharedPoolsCount).toBe(2);
      expect(stats.totalPools).toBe(4);
    });

    it("handles zero pools gracefully", () => {
      const stats = computeFillRates([]);
      expect(stats.fillRateTotal).toBe(0);
      expect(stats.fillRateWithoutSolo).toBe(0);
      expect(stats.totalPools).toBe(0);
    });
  });

  describe("B4: Captured Revenue on Completed Trips", () => {
    it("computes captured platform revenue strictly from completed trips", () => {
      const trips: CompletedTripRevenueItem[] = [
        { status: "COMPLETED", platformFee: 111.0, totalFare: 740.0 },
        { status: "COMPLETED", platformFee: 48.0, totalFare: 320.0 },
        { status: "IN_TRANSIT", platformFee: 65.0, totalFare: 430.0 }, // ongoing, uncaptured
        { status: "CANCELLED", platformFee: 0.0, totalFare: 0.0 },
      ];

      const rev = computeCapturedRevenue(trips);
      // Strictly completed: 111 + 48 = ₹159
      expect(rev.capturedRevenueRupees).toBe(159);
      expect(rev.capturedRevenuePaise).toBe(15900);
      expect(rev.completedTripCount).toBe(2);
    });
  });
});
