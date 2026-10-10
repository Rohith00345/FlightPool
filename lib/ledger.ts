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
  commissionPct?: number;
}): Promise<LedgerPostingResult> {
  const txnId = `tx_fare_${params.paymentId}_${crypto.randomBytes(4).toString("hex")}`;
  const commissionRate = (params.commissionPct ?? 15.0) / 100;

  const platformFeePaise = Math.round(params.totalFarePaise * commissionRate);
  const driverPayoutPaise = params.totalFarePaise - platformFeePaise;

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
    // DEBIT: Platform Cash (Asset +)
    await tx.ledgerEntry.create({
      data: {
        txnId,
        accountId: cashAccount.id,
        direction: "DEBIT",
        amountPaise: params.totalFarePaise,
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

    const debits = params.totalFarePaise;
    const credits = platformFeePaise + driverPayoutPaise;

    return {
      txnId,
      entriesCount: 3,
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
  commissionPct?: number;
}): Promise<LedgerPostingResult> {
  const txnId = `tx_refund_${params.refundId}_${crypto.randomBytes(4).toString("hex")}`;
  const commissionRate = (params.commissionPct ?? 15.0) / 100;

  const platformFeePaise = Math.round(params.refundPaise * commissionRate);
  const driverPayoutPaise = params.refundPaise - platformFeePaise;

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

    // CREDIT: Platform Cash (Asset -)
    await tx.ledgerEntry.create({
      data: {
        txnId,
        accountId: cashAccount.id,
        direction: "CREDIT",
        amountPaise: params.refundPaise,
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

    const debits = platformFeePaise + driverPayoutPaise;
    const credits = params.refundPaise;

    return {
      txnId,
      entriesCount: 3,
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
