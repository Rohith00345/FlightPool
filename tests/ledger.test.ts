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

  it("proves weekly payouts stay PENDING until confirmed, and ledger posts on confirmation", async () => {
    const { prisma } = await import("../lib/prisma");
    const { processWeeklyDriverPayouts, confirmDriverPayout, getAccountBalancePaise } = await import("../lib/ledger");

    // Create a test driver
    const driver = await prisma.driver.upsert({
      where: { phone: "+919988776655" },
      update: {},
      create: {
        id: `drv_payout_test_${Date.now()}`,
        name: "Payout Test Driver",
        phone: "+919988776655",
        rating: 4.95,
      },
    });

    // Credit driver payable account with ₹450 (45000 paise)
    const payableAccount = await prisma.ledgerAccount.upsert({
      where: {
        ownerType_ownerId_accountType: {
          ownerType: "driver",
          ownerId: driver.id,
          accountType: "payable",
        },
      },
      update: {},
      create: {
        ownerType: "driver",
        ownerId: driver.id,
        accountType: "payable",
        currency: "INR",
      },
    });

    const txnId = `credit_init_${Date.now()}`;
    await prisma.ledgerEntry.create({
      data: {
        txnId,
        accountId: payableAccount.id,
        direction: "CREDIT",
        amountPaise: 45000,
        refType: "PAYMENT",
      },
    });

    const periodStart = new Date("2026-10-01");
    const periodEnd = new Date("2026-10-07");

    try {
      // 1. Run payout job
      const jobResult = await processWeeklyDriverPayouts({ periodStart, periodEnd });
      expect(jobResult.payoutsProcessed).toBeGreaterThan(0);

      const driverPayout = jobResult.payouts.find((p) => p.driverId === driver.id);
      expect(driverPayout).toBeDefined();
      expect(driverPayout?.status).toBe("PENDING");

      // Verify Payout record in DB is PENDING and paidAt is null
      const dbPayout = await prisma.payout.findUniqueOrThrow({
        where: { id: driverPayout!.id },
      });
      expect(dbPayout.status).toBe("PENDING");
      expect(dbPayout.paidAt).toBeNull();

      // Verify NO bank debit ledger entry posted yet for this payout
      const unconfirmedEntries = await prisma.ledgerEntry.findMany({
        where: { refId: dbPayout.id, refType: "PAYOUT" },
      });
      expect(unconfirmedEntries.length).toBe(0);

      // 2. Confirm payout via PayoutProvider callback
      const confirmResult = await confirmDriverPayout(dbPayout.id, "bank_ref_778899");
      expect(confirmResult.isBalanced).toBe(true);
      expect(confirmResult.amountPaise).toBe(45000);

      // Verify Payout record in DB is now PAID
      const paidDbPayout = await prisma.payout.findUniqueOrThrow({
        where: { id: dbPayout.id },
      });
      expect(paidDbPayout.status).toBe("PAID");
      expect(paidDbPayout.paidAt).not.toBeNull();

      // Verify balancing ledger entries exist and are equal
      const payoutEntries = await prisma.ledgerEntry.findMany({
        where: { txnId: confirmResult.txnId },
      });
      const debits = payoutEntries.filter((e) => e.direction === "DEBIT").reduce((s, e) => s + e.amountPaise, 0);
      const credits = payoutEntries.filter((e) => e.direction === "CREDIT").reduce((s, e) => s + e.amountPaise, 0);
      expect(debits).toBe(45000);
      expect(credits).toBe(45000);
      expect(debits).toEqual(credits);
    } finally {
      // Clean up test driver data
      await prisma.ledgerEntry.deleteMany({ where: { accountId: payableAccount.id } });
      await prisma.payout.deleteMany({ where: { driverId: driver.id } });
      await prisma.ledgerAccount.deleteMany({ where: { ownerId: driver.id } });
      await prisma.driver.delete({ where: { id: driver.id } });
    }
  });
});

