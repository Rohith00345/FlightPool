import { describe, it, expect } from "vitest";
import {
  assertStrictPaise,
  rupeesToPaise,
  paiseToRupees,
  formatPaiseToRupees,
  calculateSoloFarePaise,
  calculatePoolPricingPaise,
  MoneyUnitError,
  DEFAULT_PRICING_CONFIG,
} from "../lib/pricing";

describe("Strict Money Units & Integer Paise Invariants", () => {
  it("enforces strict integer paise and rejects fractional rupees masquerading as paise", () => {
    // Valid integer paise amounts
    expect(assertStrictPaise(35000)).toBe(35000);
    expect(assertStrictPaise(0)).toBe(0);
    expect(assertStrictPaise(1)).toBe(1);

    // Rejects fractional numbers (e.g. ₹350.50 passed as 350.50)
    expect(() => assertStrictPaise(350.5, "testContext")).toThrow(MoneyUnitError);
    expect(() => assertStrictPaise(350.5, "testContext")).toThrow(
      /Fractional paise detected/
    );

    // Rejects NaN and non-numbers
    expect(() => assertStrictPaise(NaN)).toThrow(MoneyUnitError);

    // Rejects negative amounts
    expect(() => assertStrictPaise(-100)).toThrow(MoneyUnitError);
    expect(() => assertStrictPaise(-100)).toThrow(/Negative money amount not permitted/);
  });

  it("accurately converts between rupees and paise without floating-point drift", () => {
    expect(rupeesToPaise(100)).toBe(10000);
    expect(rupeesToPaise(350.5)).toBe(35050);
    expect(rupeesToPaise(740.25)).toBe(74025);

    expect(paiseToRupees(10000)).toBe(100);
    expect(paiseToRupees(35050)).toBe(350.5);
    expect(paiseToRupees(74025)).toBe(740.25);
  });

  it("formats integer paise into standard Indian Rupee presentation format for UI", () => {
    expect(formatPaiseToRupees(74000)).toBe("₹740");
    expect(formatPaiseToRupees(35050)).toBe("₹350.50");
    expect(formatPaiseToRupees(125000)).toBe("₹1,250");
    expect(formatPaiseToRupees(0)).toBe("₹0");
  });

  it("calculates solo fare strictly in integer paise", () => {
    // 10 km off-peak: 120 + 18 * 10 = ₹300 -> 30,000 paise
    const farePaise = calculateSoloFarePaise(10, 1.0, DEFAULT_PRICING_CONFIG);
    expect(Number.isInteger(farePaise)).toBe(true);
    expect(farePaise).toBe(30000);

    // Thane trip: ~30.8 km off-peak -> 120 + 18 * 30.8 = 120 + 554.4 = 674.4 -> ₹674 -> 67,400 paise
    // At evening peak 1.25x: 120 + 18 * 30.8 * 1.25 = 120 + 693 = ₹813 -> 81,300 paise
    const thaneOffPeakPaise = calculateSoloFarePaise(30.8, 1.0, DEFAULT_PRICING_CONFIG);
    expect(Number.isInteger(thaneOffPeakPaise)).toBe(true);
    expect(thaneOffPeakPaise).toBe(67400);

    const thanePeakPaise = calculateSoloFarePaise(30.8, 1.25, DEFAULT_PRICING_CONFIG);
    expect(Number.isInteger(thanePeakPaise)).toBe(true);
    expect(thanePeakPaise).toBe(81300);
  });

  it("guarantees pool shares sum exactly to totalPoolFarePaise with zero paise leakage", () => {
    const riders = [
      { riderId: "r1", soloDistanceKm: 18.5 },
      { riderId: "r2", soloDistanceKm: 24.2 },
      { riderId: "r3", soloDistanceKm: 31.0 },
    ];

    const poolResult = calculatePoolPricingPaise(riders, 34.0, 1.15, DEFAULT_PRICING_CONFIG);

    expect(Number.isInteger(poolResult.totalPoolFarePaise)).toBe(true);
    expect(Number.isInteger(poolResult.platformFeePaise)).toBe(true);
    expect(Number.isInteger(poolResult.driverPayoutPaise)).toBe(true);

    // Exact penny balancing: sum of rider shares must equal total pool fare
    const sumOfRiderSharesPaise = poolResult.riderShares.reduce(
      (sum, share) => sum + share.poolFarePaise,
      0
    );
    expect(sumOfRiderSharesPaise).toBe(poolResult.totalPoolFarePaise);

    // Split balancing: platformFee + driverPayout must equal total pool fare
    expect(poolResult.platformFeePaise + poolResult.driverPayoutPaise).toBe(
      poolResult.totalPoolFarePaise
    );

    // Every individual share is an integer paise value
    for (const share of poolResult.riderShares) {
      expect(Number.isInteger(share.soloFarePaise)).toBe(true);
      expect(Number.isInteger(share.poolFarePaise)).toBe(true);
      expect(Number.isInteger(share.savingsAmountPaise)).toBe(true);
      expect(share.poolFarePaise).toBeLessThan(share.soloFarePaise);
    }
  });

  it("fails when an uncoverted rupee float is supplied where paise is required", () => {
    const invalidInputs = [19.99, 350.25, 0.01, 1500.5];
    for (const val of invalidInputs) {
      expect(() => assertStrictPaise(val)).toThrow(MoneyUnitError);
    }
  });
});
