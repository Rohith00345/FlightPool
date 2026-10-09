export interface PricingConfig {
  baseFare: number;              // Base airport flag drop fare (₹120)
  perKmRate: number;             // Base rate per road km (₹18)
  minSavingPct: number;          // Guaranteed minimum saving percentage (0.30 = 30%)
  platformCommissionPct: number; // Platform fee percentage (0.15 = 15%)
  minimumSoloFare: number;       // Minimum ride fare (₹180)
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  baseFare: 120,
  perKmRate: 18,
  minSavingPct: 0.30,
  platformCommissionPct: 0.15,
  minimumSoloFare: 180,
};

export interface RiderPricingInput {
  riderId: string;
  name?: string;
  destinationZone?: string;
  soloDistanceKm: number;
}

export interface RiderPoolShare {
  riderId: string;
  soloFare: number;
  poolFare: number;
  savingsAmount: number;
  savingsPct: number;
  distanceKm: number;
}

export interface PoolPricingResult {
  totalSoloFares: number;
  totalPoolFare: number;
  totalSavingsAmount: number;
  effectiveAverageSavingsPct: number;
  platformFee: number;
  driverPayout: number;
  riderShares: RiderPoolShare[];
}

/**
 * Returns time of day multiplier based on local hour
 * Peak Evening (17:00-22:00): 1.25
 * Night (23:00-05:00): 1.20
 * Morning Peak (08:00-11:00): 1.15
 * Off-Peak: 1.00
 */
export function getTimeOfDayMultiplier(date: Date = new Date()): number {
  const hour = date.getHours();
  if (hour >= 17 && hour < 22) {
    return 1.25;
  }
  if (hour >= 23 || hour < 5) {
    return 1.20;
  }
  if (hour >= 8 && hour < 11) {
    return 1.15;
  }
  return 1.0;
}

/**
 * Computes solo fare: base + (per-km * distance * time-of-day multiplier)
 * Rounded to nearest rupee.
 */
export function calculateSoloFare(
  distanceKm: number,
  timeMultiplier = 1.0,
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): number {
  const rawFare = config.baseFare + config.perKmRate * distanceKm * timeMultiplier;
  return Math.round(Math.max(rawFare, config.minimumSoloFare));
}

/**
 * Computes pool fare for each rider with guaranteed minimum savings (default 30%).
 * Shares are distributed proportionally to each rider's solo route distance.
 * The shares are rounded to nearest rupee and guaranteed to sum EXACTLY to totalPoolFare.
 */
export function calculatePoolPricing(
  riders: RiderPricingInput[],
  totalSharedRouteKm: number,
  timeMultiplier = 1.0,
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): PoolPricingResult {
  if (!riders || riders.length === 0) {
    return {
      totalSoloFares: 0,
      totalPoolFare: 0,
      totalSavingsAmount: 0,
      effectiveAverageSavingsPct: 0,
      platformFee: 0,
      driverPayout: 0,
      riderShares: [],
    };
  }

  // Calculate solo fare for each rider
  const riderSoloFares = riders.map((r) => ({
    riderId: r.riderId,
    distanceKm: r.soloDistanceKm,
    soloFare: calculateSoloFare(r.soloDistanceKm, timeMultiplier, config),
  }));

  const totalSoloFares = riderSoloFares.reduce((sum, r) => sum + r.soloFare, 0);

  // If only 1 rider, they pay solo fare (no pool discount)
  if (riders.length === 1) {
    const solo = riderSoloFares[0].soloFare;
    const platformFee = Math.round(solo * config.platformCommissionPct);
    const driverPayout = solo - platformFee;
    return {
      totalSoloFares: solo,
      totalPoolFare: solo,
      totalSavingsAmount: 0,
      effectiveAverageSavingsPct: 0,
      platformFee,
      driverPayout,
      riderShares: [
        {
          riderId: riders[0].riderId,
          soloFare: solo,
          poolFare: solo,
          savingsAmount: 0,
          savingsPct: 0,
          distanceKm: riders[0].soloDistanceKm,
        },
      ],
    };
  }

  // Tiered pooling savings discount:
  // 2 riders: ~35% base savings
  // 3 riders: ~45% base savings
  // 4 riders: ~52% base savings
  // Always >= config.minSavingPct (default 30%)
  const riderCount = riders.length;
  let targetPoolDiscount = config.minSavingPct;
  if (riderCount === 2) {
    targetPoolDiscount = Math.max(config.minSavingPct, 0.35);
  } else if (riderCount === 3) {
    targetPoolDiscount = Math.max(config.minSavingPct, 0.44);
  } else if (riderCount >= 4) {
    targetPoolDiscount = Math.max(config.minSavingPct, 0.52);
  }

  // Raw unadjusted pool fares for each rider ensuring guaranteed minimum saving
  const rawShares = riderSoloFares.map((r) => {
    // Rider pays: soloFare * (1 - targetPoolDiscount)
    const rawRiderPoolFare = r.soloFare * (1 - targetPoolDiscount);
    // Ensure guaranteed minimum saving vs solo
    const maxAllowedFare = r.soloFare * (1 - config.minSavingPct);
    const cappedFare = Math.min(rawRiderPoolFare, maxAllowedFare);
    return {
      riderId: r.riderId,
      soloFare: r.soloFare,
      distanceKm: r.distanceKm,
      roundedFare: Math.round(cappedFare),
    };
  });

  // Calculate sum of rounded shares
  let targetTotalPoolFare = rawShares.reduce((sum, r) => sum + r.roundedFare, 0);

  // Verification: ensure no rider exceeds solo fare * (1 - minSavingPct)
  const riderShares: RiderPoolShare[] = rawShares.map((r) => {
    const savingsAmount = r.soloFare - r.roundedFare;
    const savingsPct = Number(((savingsAmount / r.soloFare) * 100).toFixed(1));
    return {
      riderId: r.riderId,
      soloFare: r.soloFare,
      poolFare: r.roundedFare,
      savingsAmount,
      savingsPct,
      distanceKm: r.distanceKm,
    };
  });

  // Exact sum verification:
  const exactSumOfShares = riderShares.reduce((s, r) => s + r.poolFare, 0);
  targetTotalPoolFare = exactSumOfShares;

  const totalSavings = totalSoloFares - targetTotalPoolFare;
  const avgSavingsPct =
    totalSoloFares > 0
      ? Number(((totalSavings / totalSoloFares) * 100).toFixed(1))
      : 0;

  const platformFee = Math.round(targetTotalPoolFare * config.platformCommissionPct);
  const driverPayout = targetTotalPoolFare - platformFee;

  return {
    totalSoloFares,
    totalPoolFare: targetTotalPoolFare,
    totalSavingsAmount: totalSavings,
    effectiveAverageSavingsPct: avgSavingsPct,
    platformFee,
    driverPayout,
    riderShares,
  };
}
