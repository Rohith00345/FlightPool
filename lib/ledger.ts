import { prisma } from "./prisma";
import crypto from "crypto";

export interface LedgerPostingResult {
  txnId: string;
  entriesCount: number;
  totalDebitedPaise: number;
  totalCreditedPaise: number;
  isBalanced: boolean;
}

/**
 * Ensures a ledger account exists or creates it idempotently.
 */
export async function getOrCreateLedgerAccount(
  ownerType: "platform" | "rider" | "driver" | "tax",
  ownerId: string,
  accountType: "cash" | "receivable" | "payable" | "commission" | "gst",
  currency = "INR"
) {
  const existing = await prisma.ledgerAccount.findUnique({
    where: {
      ownerType_ownerId_accountType: {
        ownerType,
        ownerId,
        accountType,
      },
    },
  });

  if (existing) return existing;

  return prisma.ledgerAccount.create({
    data: {
      ownerType,
      ownerId,
      accountType,
      currency,
    },
  });
}

/**
 * Records a passenger fare payment with an exact 85/15 driver/platform split.
 * Invariant: Sum of DEBITS strictly equals Sum of CREDITS.
 */
export async function recordFarePaymentLedger(params: {
  paymentId: string;
  tripId?: string;
  userId: string;
  driverId: string;
  totalFarePaise: number;
  convenienceFeePaise?: number;
  commissionPct?: number;
}): Promise<LedgerPostingResult> {
  const txnId = `tx_fare_${params.paymentId}_${crypto.randomBytes(4).toString("hex")}`;
  const commissionRate = (params.commissionPct ?? 15.0) / 100;
  const convenienceFeePaise = params.convenienceFeePaise ?? 0;

  const platformFeePaise = Math.round(params.totalFarePaise * commissionRate);
  const driverPayoutPaise = params.totalFarePaise - platformFeePaise;
  const totalCashCollectedPaise = params.totalFarePaise + convenienceFeePaise;

  return await prisma.$transaction(async (tx) => {
    // 1. Resolve Accounts
    // Platform Cash (Asset Account, debited on cash inflow)
    let cashAccount = await tx.ledgerAccount.findUnique({
      where: {
        ownerType_ownerId_accountType: {
          ownerType: "platform",
          ownerId: "platform",
          accountType: "cash",
        },
      },
    });
    if (!cashAccount) {
      cashAccount = await tx.ledgerAccount.create({
        data: {
          ownerType: "platform",
          ownerId: "platform",
          accountType: "cash",
          currency: "INR",
        },
      });
    }

    // Platform Commission (Revenue Account, credited on earning)
    let commissionAccount = await tx.ledgerAccount.findUnique({
      where: {
        ownerType_ownerId_accountType: {
          ownerType: "platform",
          ownerId: "platform",
          accountType: "commission",
        },
      },
    });
    if (!commissionAccount) {
      commissionAccount = await tx.ledgerAccount.create({
        data: {
          ownerType: "platform",
          ownerId: "platform",
          accountType: "commission",
          currency: "INR",
        },
      });
    }

    // Driver Payable (Liability Account, credited on owed earnings)
    let driverPayableAccount = await tx.ledgerAccount.findUnique({
      where: {
        ownerType_ownerId_accountType: {
          ownerType: "driver",
          ownerId: params.driverId,
          accountType: "payable",
        },
      },
    });
    if (!driverPayableAccount) {
      driverPayableAccount = await tx.ledgerAccount.create({
        data: {
          ownerType: "driver",
          ownerId: params.driverId,
          accountType: "payable",
          currency: "INR",
        },
      });
    }

    // 2. Post Entries
    // DEBIT: Platform Cash (Asset +) - fare + rider convenience fee
    await tx.ledgerEntry.create({
      data: {
        txnId,
        accountId: cashAccount.id,
        direction: "DEBIT",
        amountPaise: totalCashCollectedPaise,
        refType: "PAYMENT",
        refId: params.paymentId,
      },
    });

    // CREDIT: Platform Commission (Revenue +)
    await tx.ledgerEntry.create({
      data: {
        txnId,
        accountId: commissionAccount.id,
        direction: "CREDIT",
        amountPaise: platformFeePaise,
        refType: "PAYMENT",
        refId: params.paymentId,
      },
    });

    // CREDIT: Platform Convenience Fee (Revenue +) if applicable
    if (convenienceFeePaise > 0) {
      await tx.ledgerEntry.create({
        data: {
          txnId,
          accountId: commissionAccount.id,
          direction: "CREDIT",
          amountPaise: convenienceFeePaise,
          refType: "PAYMENT",
          refId: params.paymentId,
        },
      });
    }

    // CREDIT: Driver Payable (Liability +)
    await tx.ledgerEntry.create({
      data: {
        txnId,
        accountId: driverPayableAccount.id,
        direction: "CREDIT",
        amountPaise: driverPayoutPaise,
        refType: "PAYMENT",
        refId: params.paymentId,
      },
    });

    const debits = totalCashCollectedPaise;
    const credits = platformFeePaise + convenienceFeePaise + driverPayoutPaise;

    return {
      txnId,
      entriesCount: convenienceFeePaise > 0 ? 4 : 3,
      totalDebitedPaise: debits,
      totalCreditedPaise: credits,
      isBalanced: debits === credits,
    };
  });
}

/**
 * Records a passenger refund reversal.
 * Invariant: Sum of DEBITS strictly equals Sum of CREDITS.
 */
export async function recordRefundLedger(params: {
  paymentId: string;
  refundId: string;
  driverId: string;
  refundPaise: number;
  convenienceFeeReversalPaise?: number;
  commissionPct?: number;
}): Promise<LedgerPostingResult> {
  const txnId = `tx_refund_${params.refundId}_${crypto.randomBytes(4).toString("hex")}`;
  const commissionRate = (params.commissionPct ?? 15.0) / 100;
  const convenienceFeeReversalPaise = params.convenienceFeeReversalPaise ?? 0;

  const platformFeePaise = Math.round(params.refundPaise * commissionRate);
  const driverPayoutPaise = params.refundPaise - platformFeePaise;
  const totalCashReturnedPaise = params.refundPaise + convenienceFeeReversalPaise;

  return await prisma.$transaction(async (tx) => {
    let cashAccount = await tx.ledgerAccount.findUnique({
      where: {
        ownerType_ownerId_accountType: {
          ownerType: "platform",
          ownerId: "platform",
          accountType: "cash",
        },
      },
    });
    if (!cashAccount) {
      cashAccount = await tx.ledgerAccount.create({
        data: {
          ownerType: "platform",
          ownerId: "platform",
          accountType: "cash",
          currency: "INR",
        },
      });
    }

    let commissionAccount = await tx.ledgerAccount.findUnique({
      where: {
        ownerType_ownerId_accountType: {
          ownerType: "platform",
          ownerId: "platform",
          accountType: "commission",
        },
      },
    });
    if (!commissionAccount) {
      commissionAccount = await tx.ledgerAccount.create({
        data: {
          ownerType: "platform",
          ownerId: "platform",
          accountType: "commission",
          currency: "INR",
        },
      });
    }

    let driverPayableAccount = await tx.ledgerAccount.findUnique({
      where: {
        ownerType_ownerId_accountType: {
          ownerType: "driver",
          ownerId: params.driverId,
          accountType: "payable",
        },
      },
    });
    if (!driverPayableAccount) {
      driverPayableAccount = await tx.ledgerAccount.create({
        data: {
          ownerType: "driver",
          ownerId: params.driverId,
          accountType: "payable",
          currency: "INR",
        },
      });
    }

    // CREDIT: Platform Cash (Asset -) - refund amount + convenience fee reversal
    await tx.ledgerEntry.create({
      data: {
        txnId,
        accountId: cashAccount.id,
        direction: "CREDIT",
        amountPaise: totalCashReturnedPaise,
        refType: "REFUND",
        refId: params.refundId,
      },
    });

    // DEBIT: Platform Commission (Revenue -)
    await tx.ledgerEntry.create({
      data: {
        txnId,
        accountId: commissionAccount.id,
        direction: "DEBIT",
        amountPaise: platformFeePaise,
        refType: "REFUND",
        refId: params.refundId,
      },
    });

    // DEBIT: Platform Convenience Fee (Revenue -) if applicable
    if (convenienceFeeReversalPaise > 0) {
      await tx.ledgerEntry.create({
        data: {
          txnId,
          accountId: commissionAccount.id,
          direction: "DEBIT",
          amountPaise: convenienceFeeReversalPaise,
          refType: "REFUND",
          refId: params.refundId,
        },
      });
    }

    // DEBIT: Driver Payable (Liability -)
    await tx.ledgerEntry.create({
      data: {
        txnId,
        accountId: driverPayableAccount.id,
        direction: "DEBIT",
        amountPaise: driverPayoutPaise,
        refType: "REFUND",
        refId: params.refundId,
      },
    });

    const debits = platformFeePaise + convenienceFeeReversalPaise + driverPayoutPaise;
    const credits = totalCashReturnedPaise;

    return {
      txnId,
      entriesCount: convenienceFeeReversalPaise > 0 ? 4 : 3,
      totalDebitedPaise: debits,
      totalCreditedPaise: credits,
      isBalanced: debits === credits,
    };
  });
}

/**
 * Calculates current net balance in paise for a specific account.
 */
export async function getAccountBalancePaise(
  ownerType: "platform" | "rider" | "driver" | "tax",
  ownerId: string,
  accountType: "cash" | "receivable" | "payable" | "commission" | "gst"
): Promise<number> {
  const account = await prisma.ledgerAccount.findUnique({
    where: {
      ownerType_ownerId_accountType: {
        ownerType,
        ownerId,
        accountType,
      },
    },
    include: {
      entries: true,
    },
  });

  if (!account) return 0;

  let balance = 0;
  for (const entry of account.entries) {
    if (accountType === "cash" || accountType === "receivable") {
      // Normal debit balance (Assets)
      balance += entry.direction === "DEBIT" ? entry.amountPaise : -entry.amountPaise;
    } else {
      // Normal credit balance (Liabilities / Revenue)
      balance += entry.direction === "CREDIT" ? entry.amountPaise : -entry.amountPaise;
    }
  }

  return balance;
}

/**
 * Verifies that all entries under a transaction ID balance to zero.
 */
export async function verifyTransactionBalance(txnId: string): Promise<boolean> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { txnId },
  });

  if (entries.length === 0) return false;

  let debits = 0;
  let credits = 0;
  for (const e of entries) {
    if (e.direction === "DEBIT") debits += e.amountPaise;
    if (e.direction === "CREDIT") credits += e.amountPaise;
  }

  return debits === credits;
}


export interface PayoutProvider {
  name: string;
  dispatchPayout(payout: { id: string; driverId: string; netPaise: number }): Promise<{
    payoutId: string;
    status: "PENDING" | "CONFIRMED" | "FAILED";
    transferRef?: string;
  }>;
}

export class MockPayoutProvider implements PayoutProvider {
  name = "Mock IMPS/NEFT Provider";
  async dispatchPayout(payout: { id: string; driverId: string; netPaise: number }) {
    return {
      payoutId: payout.id,
      status: "PENDING" as const,
      transferRef: `imps_${Date.now()}_${payout.driverId.slice(-4)}`,
    };
  }
}

export const defaultPayoutProvider = new MockPayoutProvider();

/**
 * Weekly Driver Payout Job: Aggregates driver earnings, creates PENDING payouts.
 * Ledger entries are deferred until a PayoutProvider confirms settlement.
 */
export async function processWeeklyDriverPayouts(
  params: {
    periodStart: Date;
    periodEnd: Date;
  },
  provider: PayoutProvider = defaultPayoutProvider
): Promise<{
  payoutsProcessed: number;
  totalPendingPaise: number;
  payouts: Array<{ id: string; driverId: string; netPaise: number; status: string }>;
}> {
  const drivers = await prisma.driver.findMany();
  let totalPendingPaise = 0;
  let payoutsProcessed = 0;
  const payoutsList = [];

  for (const driver of drivers) {
    const payableBalance = await getAccountBalancePaise("driver", driver.id, "payable");
    if (payableBalance <= 0) continue;

    const netPaise = payableBalance;

    // 1. Upsert Payout record with PENDING status
    const payout = await prisma.payout.upsert({
      where: {
        driverId_periodStart_periodEnd: {
          driverId: driver.id,
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
        },
      },
      update: {
        grossPaise: netPaise,
        commissionPaise: 0,
        netPaise,
        status: "PENDING",
        paidAt: null,
      },
      create: {
        driverId: driver.id,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        grossPaise: netPaise,
        commissionPaise: 0,
        netPaise,
        status: "PENDING",
      },
    });

    // 2. Dispatch to Payout Provider
    await provider.dispatchPayout({
      id: payout.id,
      driverId: driver.id,
      netPaise,
    });

    payoutsList.push({
      id: payout.id,
      driverId: driver.id,
      netPaise,
      status: "PENDING",
    });
    totalPendingPaise += netPaise;
    payoutsProcessed++;
  }

  return {
    payoutsProcessed,
    totalPendingPaise,
    payouts: payoutsList,
  };
}

/**
 * Confirms a driver payout upon PayoutProvider webhook or settlement confirmation.
 * Posts the double-entry bank transfer entry to the ledger.
 */
export async function confirmDriverPayout(
  payoutId: string,
  transferRef?: string
): Promise<{
  txnId: string;
  payoutId: string;
  driverId: string;
  amountPaise: number;
  isBalanced: boolean;
}> {
  return await prisma.$transaction(async (tx) => {
    const payout = await tx.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new Error(`Payout not found: ${payoutId}`);
    }

    if (payout.status === "PAID") {
      // Idempotent: already confirmed
      return {
        txnId: `idem_${payout.id}`,
        payoutId: payout.id,
        driverId: payout.driverId,
        amountPaise: payout.netPaise,
        isBalanced: true,
      };
    }

    const netPaise = payout.netPaise;
    const txnId = `tx_payout_${payout.driverId}_${crypto.randomBytes(4).toString("hex")}`;

    // Resolve accounts
    let cashAccount = await tx.ledgerAccount.findUnique({
      where: {
        ownerType_ownerId_accountType: {
          ownerType: "platform",
          ownerId: "platform",
          accountType: "cash",
        },
      },
    });
    if (!cashAccount) {
      cashAccount = await tx.ledgerAccount.create({
        data: {
          ownerType: "platform",
          ownerId: "platform",
          accountType: "cash",
          currency: "INR",
        },
      });
    }

    let driverPayableAccount = await tx.ledgerAccount.findUnique({
      where: {
        ownerType_ownerId_accountType: {
          ownerType: "driver",
          ownerId: payout.driverId,
          accountType: "payable",
        },
      },
    });
    if (!driverPayableAccount) {
      driverPayableAccount = await tx.ledgerAccount.create({
        data: {
          ownerType: "driver",
          ownerId: payout.driverId,
          accountType: "payable",
          currency: "INR",
        },
      });
    }

    // DEBIT: Driver Payable (Liability decreases)
    await tx.ledgerEntry.create({
      data: {
        txnId,
        accountId: driverPayableAccount.id,
        direction: "DEBIT",
        amountPaise: netPaise,
        refType: "PAYOUT",
        refId: transferRef || payout.id,
      },
    });

    // CREDIT: Platform Cash (Asset decreases)
    await tx.ledgerEntry.create({
      data: {
        txnId,
        accountId: cashAccount.id,
        direction: "CREDIT",
        amountPaise: netPaise,
        refType: "PAYOUT",
        refId: transferRef || payout.id,
      },
    });

    // Update Payout record to PAID
    await tx.payout.update({
      where: { id: payout.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    return {
      txnId,
      payoutId: payout.id,
      driverId: payout.driverId,
      amountPaise: netPaise,
      isBalanced: true,
    };
  });
}


