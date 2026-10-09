import { describe, it, expect } from "vitest";
import {
  calculateSoloFare,
  calculatePoolPricing,
  getTimeOfDayMultiplier,
  DEFAULT_PRICING_CONFIG,
} from "../lib/pricing";

describe("FlightPool Pricing Engine", () => {
  it("1. calculates solo fare with base and distance components", () => {
    // 10 km off-peak: 120 + 18 * 10 * 1.0 = 300
    const fare = calculateSoloFare(10, 1.0, DEFAULT_PRICING_CONFIG);
    expect(fare).toBe(300);
  });

  it("2. enforces minimum solo fare floor for short distances", () => {
    // 1 km: 120 + 18 = 138, but floor is 180
    const fare = calculateSoloFare(1, 1.0, DEFAULT_PRICING_CONFIG);
    expect(fare).toBe(180);
  });

  it("3. applies peak evening time-of-day multiplier (1.25x)", () => {
    // 10 km at 1.25x: 120 + 18 * 10 * 1.25 = 120 + 225 = 345
    const fare = calculateSoloFare(10, 1.25, DEFAULT_PRICING_CONFIG);
    expect(fare).toBe(345);
  });

  it("4. determines correct time of day multiplier for different hours", () => {
    const eveningDate = new Date("2026-10-09T19:30:00"); // 19:30
    const nightDate = new Date("2026-10-09T01:15:00");   // 01:15
    const morningDate = new Date("2026-10-09T09:00:00"); // 09:00
    const noonDate = new Date("2026-10-09T14:00:00");    // 14:00

    expect(getTimeOfDayMultiplier(eveningDate)).toBe(1.25);
    expect(getTimeOfDayMultiplier(nightDate)).toBe(1.20);
    expect(getTimeOfDayMultiplier(morningDate)).toBe(1.15);
    expect(getTimeOfDayMultiplier(noonDate)).toBe(1.00);
  });

  it("5. guarantees minimum 30% savings for each rider in a pool", () => {
    const riders = [
      { riderId: "r1", soloDistanceKm: 20 },
      { riderId: "r2", soloDistanceKm: 25 },
    ];
    const pricing = calculatePoolPricing(riders, 26, 1.0, DEFAULT_PRICING_CONFIG);

    expect(pricing.riderShares.length).toBe(2);
    pricing.riderShares.forEach((share) => {
      // Must save at least 30%
      expect(share.savingsPct).toBeGreaterThanOrEqual(29.9);
      expect(share.poolFare).toBeLessThan(share.soloFare);
    });
  });

  it("6. scales higher savings for 3 and 4 riders", () => {
    const riders2 = [
      { riderId: "r1", soloDistanceKm: 15 },
      { riderId: "r2", soloDistanceKm: 15 },
    ];
    const pricing2 = calculatePoolPricing(riders2, 16);

    const riders3 = [
      { riderId: "r1", soloDistanceKm: 15 },
      { riderId: "r2", soloDistanceKm: 15 },
      { riderId: "r3", soloDistanceKm: 15 },
    ];
    const pricing3 = calculatePoolPricing(riders3, 17);

    // 3 riders pool should yield higher average savings than 2 riders
    expect(pricing3.effectiveAverageSavingsPct).toBeGreaterThan(
      pricing2.effectiveAverageSavingsPct
    );
  });

  it("7. ensures individual rider pool shares sum EXACTLY to totalPoolFare with integer rupees", () => {
    const riders = [
      { riderId: "r1", soloDistanceKm: 12.3 },
      { riderId: "r2", soloDistanceKm: 18.7 },
      { riderId: "r3", soloDistanceKm: 24.1 },
    ];
    const pricing = calculatePoolPricing(riders, 27.5, 1.15);

    const sumShares = pricing.riderShares.reduce((s, r) => s + r.poolFare, 0);
    expect(sumShares).toBe(pricing.totalPoolFare);

    // All fares must be integer rupees
    pricing.riderShares.forEach((r) => {
      expect(Number.isInteger(r.poolFare)).toBe(true);
      expect(Number.isInteger(r.soloFare)).toBe(true);
    });
  });

  it("8. splits platform commission (15%) and driver payout correctly", () => {
    const riders = [
      { riderId: "r1", soloDistanceKm: 20 },
      { riderId: "r2", soloDistanceKm: 22 },
    ];
    const pricing = calculatePoolPricing(riders, 23);

    expect(pricing.platformFee + pricing.driverPayout).toBe(pricing.totalPoolFare);
    expect(pricing.driverPayout).toBe(
      pricing.totalPoolFare - Math.round(pricing.totalPoolFare * 0.15)
    );
  });

  it("9. falls back gracefully for single rider with 0% discount", () => {
    const riders = [{ riderId: "r1", soloDistanceKm: 15 }];
    const pricing = calculatePoolPricing(riders, 15);

    expect(pricing.riderShares.length).toBe(1);
    expect(pricing.riderShares[0].poolFare).toBe(pricing.riderShares[0].soloFare);
    expect(pricing.riderShares[0].savingsPct).toBe(0);
    expect(pricing.totalSavingsAmount).toBe(0);
  });
});
