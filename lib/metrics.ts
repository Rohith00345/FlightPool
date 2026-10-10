/**
 * Operational Metrics & Aggregations Engine
 * Enforces business logic for wait time, fill rates, and captured revenue.
 */

export interface MatchedWaitRecord {
  readyAt: Date | string | null;
  confirmedAt: Date | string | null;
}

/**
 * B1: Computes average wait time = pool confirmedAt minus rideRequest readyAt
 * for matched requests in the last 24 hours.
 * - Stale records (> 24h old or readyAt > confirmedAt) are strictly ignored.
 * - Caps wait time at 20 minutes.
 * - Returns null / "-" when no valid matched requests exist in the window.
 */
export function computeAverageWaitTime(
  records: MatchedWaitRecord[],
  now: Date = new Date()
): { avgWaitMinutes: number | null; display: string; count: number } {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const cutoffTime = now.getTime() - ONE_DAY_MS;

  const validDiffsMinutes: number[] = [];

  for (const r of records) {
    if (!r.readyAt || !r.confirmedAt) continue;

    const readyDate = typeof r.readyAt === "string" ? new Date(r.readyAt) : r.readyAt;
    const confirmedDate = typeof r.confirmedAt === "string" ? new Date(r.confirmedAt) : r.confirmedAt;

    const readyTime = readyDate.getTime();
    const confirmedTime = confirmedDate.getTime();

    // Ignore invalid timestamps
    if (isNaN(readyTime) || isNaN(confirmedTime)) continue;

    // Filter to last 24 hours based on confirmation timestamp
    if (confirmedTime < cutoffTime || confirmedTime > now.getTime() + 60000) {
      continue;
    }

    // Ignore stale ready times older than 25 hours (stale seed data)
    if (readyTime < cutoffTime - 60 * 60 * 1000) {
      continue;
    }

    // Invariant: confirmedAt must be >= readyAt
    if (confirmedTime < readyTime) {
      continue;
    }

    const diffMinutes = (confirmedTime - readyTime) / 60000;
    // Cap at 20 minutes
    const boundedMinutes = Math.min(20, Math.max(0, diffMinutes));
    validDiffsMinutes.push(boundedMinutes);
  }

  if (validDiffsMinutes.length === 0) {
    return { avgWaitMinutes: null, display: "-", count: 0 };
  }

  const sum = validDiffsMinutes.reduce((acc, val) => acc + val, 0);
  const avg = Number((sum / validDiffsMinutes.length).toFixed(1));

  return {
    avgWaitMinutes: avg,
    display: `${avg}m`,
    count: validDiffsMinutes.length,
  };
}

export interface PoolSummary {
  id: string;
  memberCount: number;
  status: string;
}

/**
 * B3: Computes fill rate with and without single-rider solo pools.
 */
export function computeFillRates(pools: PoolSummary[]): {
  fillRateTotal: number;
  fillRateWithoutSolo: number;
  totalPools: number;
  soloPoolsCount: number;
  sharedPoolsCount: number;
} {
  const totalPools = pools.length;
  if (totalPools === 0) {
    return {
      fillRateTotal: 0,
      fillRateWithoutSolo: 0,
      totalPools: 0,
      soloPoolsCount: 0,
      sharedPoolsCount: 0,
    };
  }

  const totalMembers = pools.reduce((acc, p) => acc + p.memberCount, 0);
  const fillRateTotal = Number((totalMembers / totalPools).toFixed(2));

  const soloPools = pools.filter((p) => p.memberCount === 1);
  const sharedPools = pools.filter((p) => p.memberCount > 1);

  const sharedMembers = sharedPools.reduce((acc, p) => acc + p.memberCount, 0);
  const fillRateWithoutSolo =
    sharedPools.length > 0
      ? Number((sharedMembers / sharedPools.length).toFixed(2))
      : 0;

  return {
    fillRateTotal,
    fillRateWithoutSolo,
    totalPools,
    soloPoolsCount: soloPools.length,
    sharedPoolsCount: sharedPools.length,
  };
}

export interface CompletedTripRevenueItem {
  status: string;
  platformFee: number;
  totalFare: number;
}

/**
 * B4: Computes captured revenue strictly from completed trips.
 */
export function computeCapturedRevenue(trips: CompletedTripRevenueItem[]): {
  capturedRevenuePaise: number;
  capturedRevenueRupees: number;
  completedTripCount: number;
} {
  const completed = trips.filter((t) => t.status === "COMPLETED");
  const totalFeeRupees = completed.reduce((sum, t) => sum + (t.platformFee || 0), 0);
  const totalFeePaise = Math.round(totalFeeRupees * 100);

  return {
    capturedRevenuePaise: totalFeePaise,
    capturedRevenueRupees: Math.round(totalFeeRupees),
    completedTripCount: completed.length,
  };
}
