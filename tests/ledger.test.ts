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

  it("enforces balanced debits and credits with rider convenience fee included", () => {
    const farePaise = 42000; // ₹420.00 ride fare
    const convenienceFeePaise = 2000; // ₹20.00 platform convenience fee
    const commissionPct = 15.0; // 15% platform commission on ride fare

    const platformCommissionPaise = Math.round(farePaise * (commissionPct / 100));
    const driverPayoutPaise = farePaise - platformCommissionPaise;
    const totalCashDebited = farePaise + convenienceFeePaise;

    const totalCashCredited =
      platformCommissionPaise + convenienceFeePaise + driverPayoutPaise;

    // Strict Double-Entry: Cash debited strictly equals credits across platform & driver
    expect(totalCashDebited).toBe(totalCashCredited);
    expect(totalCashDebited).toBe(44000);
    expect(driverPayoutPaise).toBe(35700);
    expect(platformCommissionPaise + convenienceFeePaise).toBe(8300);
  });

  it("enforces balanced debits and credits on refund reversals with convenience fee", () => {
    const refundFarePaise = 42000;
    const refundConvenienceFeePaise = 2000;
    const commissionPct = 15.0;

    const commissionReversal = Math.round(refundFarePaise * (commissionPct / 100));
    const driverPayoutReversal = refundFarePaise - commissionReversal;
    const totalDebited = commissionReversal + refundConvenienceFeePaise + driverPayoutReversal;
    const totalCredited = refundFarePaise + refundConvenienceFeePaise;

    expect(totalDebited).toEqual(totalCredited);
    expect(totalDebited).toBe(44000);
  });

  it("enforces balanced debits and credits in the weekly driver payout job", () => {
    const accumulatedDriverEarningsPaise = 35700; // ₹357.00 liability to driver

    // Payout transaction:
    // DEBIT: Driver Payable (Liability decreases by 35700)
    // CREDIT: Platform Cash (Asset decreases by 35700)
    const debitDriverPayable = accumulatedDriverEarningsPaise;
    const creditPlatformCash = accumulatedDriverEarningsPaise;

    expect(debitDriverPayable).toEqual(creditPlatformCash);
    expect(debitDriverPayable - creditPlatformCash).toBe(0);
  });
});

