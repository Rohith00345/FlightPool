import { rupeesToPaise, paiseToRupees } from "./index";

export interface PromoRule {
  code: string;
  description: string;
  discountPercent?: number; // e.g. 25 for 25%
  flatDiscountRupees?: number; // e.g. 50 for ₹50
  maxDiscountRupees?: number; // e.g. 150 for max ₹150 cap
  minFareRupees: number; // e.g. 300
  firstRideOnly?: boolean;
  allowedCorridors?: string[]; // e.g. ["Thane", "Navi Mumbai"]
  validUntil: string; // ISO timestamp
}

export interface PromoValidationResult {
  valid: boolean;
  code: string;
  error?: string;
  discountRupees: number;
  discountPaise: number;
  finalFareRupees: number;
  finalFarePaise: number;
  description?: string;
}

export const ACTIVE_PROMO_CAMPAIGNS: PromoRule[] = [
  {
    code: "BOMWELCOME",
    description: "25% off up to ₹150 for your first airport shared pool",
    discountPercent: 25,
    maxDiscountRupees: 150,
    minFareRupees: 300,
    firstRideOnly: true,
    validUntil: "2027-12-31T23:59:59Z",
  },
  {
    code: "FLYPOOL50",
    description: "Flat ₹50 off on Mumbai airport shared rides",
    flatDiscountRupees: 50,
    minFareRupees: 250,
    validUntil: "2027-12-31T23:59:59Z",
  },
  {
    code: "GREENMUMBAI",
    description: "Flat ₹75 eco-discount for carbon-saving shared pools",
    flatDiscountRupees: 75,
    minFareRupees: 350,
    validUntil: "2027-12-31T23:59:59Z",
  },
  {
    code: "NIGHTSAFE",
    description: "20% off up to ₹120 on night arrivals (10 PM - 5 AM)",
    discountPercent: 20,
    maxDiscountRupees: 120,
    minFareRupees: 300,
    validUntil: "2027-12-31T23:59:59Z",
  },
  {
    code: "THANEEXPRESS",
    description: "Flat ₹100 off on long-distance corridors (Thane / Navi Mumbai)",
    flatDiscountRupees: 100,
    minFareRupees: 450,
    allowedCorridors: ["Thane", "Navi Mumbai"],
    validUntil: "2027-12-31T23:59:59Z",
  },
];

export interface PromoValidationContext {
  code: string;
  fareRupees: number;
  destinationZone?: string;
  completedRidesCount?: number;
  requestTime?: Date;
}

/**
 * Validates and computes promo discounts with integer paise precision and anti-abuse fraud checks.
 */
export function validatePromoCode(context: PromoValidationContext): PromoValidationResult {
  const normalizedCode = (context.code || "").trim().toUpperCase();

  if (!normalizedCode) {
    return {
      valid: false,
      code: "",
      error: "Promo code cannot be empty.",
      discountRupees: 0,
      discountPaise: 0,
      finalFareRupees: context.fareRupees,
      finalFarePaise: rupeesToPaise(context.fareRupees),
    };
  }

  const promo = ACTIVE_PROMO_CAMPAIGNS.find((p) => p.code === normalizedCode);
  if (!promo) {
    return {
      valid: false,
      code: normalizedCode,
      error: `Invalid promo code "${normalizedCode}".`,
      discountRupees: 0,
      discountPaise: 0,
      finalFareRupees: context.fareRupees,
      finalFarePaise: rupeesToPaise(context.fareRupees),
    };
  }

  // Check expiration
  const reqTime = context.requestTime || new Date();
  if (reqTime.getTime() > new Date(promo.validUntil).getTime()) {
    return {
      valid: false,
      code: normalizedCode,
      error: `Promo code "${normalizedCode}" has expired.`,
      discountRupees: 0,
      discountPaise: 0,
      finalFareRupees: context.fareRupees,
      finalFarePaise: rupeesToPaise(context.fareRupees),
    };
  }

  // Check minimum fare
  if (context.fareRupees < promo.minFareRupees) {
    return {
      valid: false,
      code: normalizedCode,
      error: `Promo code requires a minimum fare of ₹${promo.minFareRupees}. Current fare: ₹${context.fareRupees}.`,
      discountRupees: 0,
      discountPaise: 0,
      finalFareRupees: context.fareRupees,
      finalFarePaise: rupeesToPaise(context.fareRupees),
    };
  }

  // Check first ride only
  if (promo.firstRideOnly && (context.completedRidesCount ?? 0) > 0) {
    return {
      valid: false,
      code: normalizedCode,
      error: `Promo code "${normalizedCode}" is only valid on your first shared ride.`,
      discountRupees: 0,
      discountPaise: 0,
      finalFareRupees: context.fareRupees,
      finalFarePaise: rupeesToPaise(context.fareRupees),
    };
  }

  // Check allowed corridors
  if (promo.allowedCorridors && promo.allowedCorridors.length > 0) {
    if (!context.destinationZone || !promo.allowedCorridors.includes(context.destinationZone)) {
      return {
        valid: false,
        code: normalizedCode,
        error: `Promo code "${normalizedCode}" is only applicable to: ${promo.allowedCorridors.join(", ")}.`,
        discountRupees: 0,
        discountPaise: 0,
        finalFareRupees: context.fareRupees,
        finalFarePaise: rupeesToPaise(context.fareRupees),
      };
    }
  }

  // Calculate discount in integer paise
  const baseFarePaise = rupeesToPaise(context.fareRupees);
  let calculatedDiscountPaise = 0;

  if (promo.flatDiscountRupees) {
    calculatedDiscountPaise = rupeesToPaise(promo.flatDiscountRupees);
  } else if (promo.discountPercent) {
    calculatedDiscountPaise = Math.round((baseFarePaise * promo.discountPercent) / 100);
    if (promo.maxDiscountRupees) {
      const maxDiscountPaise = rupeesToPaise(promo.maxDiscountRupees);
      if (calculatedDiscountPaise > maxDiscountPaise) {
        calculatedDiscountPaise = maxDiscountPaise;
      }
    }
  }

  // Bound discount so fare does not drop below zero
  calculatedDiscountPaise = Math.min(calculatedDiscountPaise, baseFarePaise);
  const finalFarePaise = Math.max(0, baseFarePaise - calculatedDiscountPaise);

  return {
    valid: true,
    code: normalizedCode,
    description: promo.description,
    discountRupees: paiseToRupees(calculatedDiscountPaise),
    discountPaise: calculatedDiscountPaise,
    finalFareRupees: paiseToRupees(finalFarePaise),
    finalFarePaise,
  };
}

/**
 * Generates deterministic referral code for user
 */
export function generateUserReferralCode(userId: string, name?: string): string {
  const cleanName = (name || "FLY")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 4)
    .toUpperCase();
  const userHash = userId
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-4)
    .toUpperCase();
  return `FP-${cleanName}-${userHash}`;
}
