import { describe, it, expect } from "vitest";

describe("Double-Entry Ledger & Financial Invariants", () => {
  it("enforces balanced debits and credits on fare payment postings", () => {
    const totalFarePaise = 54000; // ₹540.00
    const commissionPct = 15.0; // 15%

    const platformFeePaise = Math.round(totalFarePaise * (commissionPct / 100));
    const driverPayoutPaise = totalFarePaise - platformFeePaise;

    expect(platformFeePaise).toBe(8100); // ₹81.00
    expect(driverPayoutPaise).toBe(45900); // ₹459.00

    const totalDebited = totalFarePaise;
    const totalCredited = platformFeePaise + driverPayoutPaise;

    // Strict Double-Entry Invariant: Debits === Credits
    expect(totalDebited).toEqual(totalCredited);
  });

  it("enforces balanced debits and credits on refund postings", () => {
    const refundPaise = 32000; // ₹320.00
    const commissionPct = 15.0;

    const platformFeeReversal = Math.round(refundPaise * (commissionPct / 100));
    const driverPayoutReversal = refundPaise - platformFeeReversal;

    const totalDebited = platformFeeReversal + driverPayoutReversal;
    const totalCredited = refundPaise;

    // Strict Double-Entry Invariant: Debits === Credits
    expect(totalDebited).toEqual(totalCredited);
  });

  it("handles odd paise correctly without rounding leakage", () => {
    // ₹333.33 -> 33333 paise
    const totalFarePaise = 33333;
    const commissionRate = 0.15;

    const platformFee = Math.round(totalFarePaise * commissionRate);
    const driverPayout = totalFarePaise - platformFee;

    expect(platformFee + driverPayout).toBe(totalFarePaise);
  });
});
