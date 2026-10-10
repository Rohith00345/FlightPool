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

/**
 * Executes the weekly driver payout batch job.
 * Creates payout records and posts balancing double-entry ledger transfers:
 * DEBIT: Driver Payable (Liability decreases)
 * CREDIT: Platform Cash (Asset decreases)
 * Invariant: Sum of DEBITS strictly equals Sum of CREDITS.
 */
export async function processWeeklyDriverPayouts(params: {
  periodStart: Date;
  periodEnd: Date;
  driverId?: string;
}): Promise<{
  payoutsProcessed: number;
  totalPaidOutPaise: number;
  postingResults: LedgerPostingResult[];
}> {
  const drivers = await prisma.driver.findMany({
    where: params.driverId ? { id: params.driverId } : {},
  });

  const postingResults: LedgerPostingResult[] = [];
  let totalPaidOutPaise = 0;
  let payoutsProcessed = 0;

  for (const driver of drivers) {
    const payableBalance = await getAccountBalancePaise("driver", driver.id, "payable");
    if (payableBalance <= 0) continue;

    const netPaise = payableBalance;
    const txnId = `tx_payout_${driver.id}_${crypto.randomBytes(4).toString("hex")}`;

    const posting = await prisma.$transaction(async (tx) => {
      // 1. Resolve Accounts
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
            ownerId: driver.id,
            accountType: "payable",
          },
        },
      });
      if (!driverPayableAccount) {
        driverPayableAccount = await tx.ledgerAccount.create({
          data: {
            ownerType: "driver",
            ownerId: driver.id,
            accountType: "payable",
            currency: "INR",
          },
        });
      }

      // 2. Post balancing entries
      // DEBIT: Driver Payable (Liability decreases)
      await tx.ledgerEntry.create({
        data: {
          txnId,
          accountId: driverPayableAccount.id,
          direction: "DEBIT",
          amountPaise: netPaise,
          refType: "PAYOUT",
          refId: driver.id,
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
          refId: driver.id,
        },
      });

      // 3. Upsert Payout record
      await tx.payout.upsert({
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
          status: "PAID",
          paidAt: new Date(),
        },
        create: {
          driverId: driver.id,
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
          grossPaise: netPaise,
          commissionPaise: 0,
          netPaise,
          status: "PAID",
          paidAt: new Date(),
        },
      });

      return {
        txnId,
        entriesCount: 2,
        totalDebitedPaise: netPaise,
        totalCreditedPaise: netPaise,
        isBalanced: true,
      };
    });

    postingResults.push(posting);
    totalPaidOutPaise += netPaise;
    payoutsProcessed++;
  }

  return {
    payoutsProcessed,
    totalPaidOutPaise,
    postingResults,
  };
}

