import crypto from "crypto";

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number; // 0 to 100
  allowedRoles?: string[]; // e.g. ["ADMIN", "DRIVER"]
}

export const DEFAULT_FEATURE_FLAGS: Record<string, FeatureFlag> = {
  PRE_LANDING_QUEUE: {
    key: "PRE_LANDING_QUEUE",
    name: "In-Flight Pre-Landing Booking Queue",
    description: "Allows airborne passengers to queue ride requests prior to touchdown",
    enabled: true,
    rolloutPercentage: 100,
  },
  WOMEN_ONLY_POOLS: {
    key: "WOMEN_ONLY_POOLS",
    name: "Women-Only Shared Pools",
    description: "Restricts cab matching strictly to verified female passengers",
    enabled: true,
    rolloutPercentage: 100,
  },
  DYNAMIC_SURGE_PRICING: {
    key: "DYNAMIC_SURGE_PRICING",
    name: "Dynamic Time-of-Day Multiplier",
    description: "Applies night/peak surge multipliers on airport base fares",
    enabled: true,
    rolloutPercentage: 100,
  },
  GREEN_MILES_REWARDS: {
    key: "GREEN_MILES_REWARDS",
    name: "FlightDeck Green Miles Loyalty Program",
    description: "Enables carbon saving miles and tier perks gamification",
    enabled: true,
    rolloutPercentage: 100,
  },
  CASHFREE_GATEWAY: {
    key: "CASHFREE_GATEWAY",
    name: "Cashfree Payment Gateway Option",
    description: "Exposes Cashfree UPI and cards as alternative checkout method",
    enabled: true,
    rolloutPercentage: 50,
  },
  EXPRESS_BAY_PRIORITY: {
    key: "EXPRESS_BAY_PRIORITY",
    name: "Express Bay Priority Boarding",
    description: "Dispatches riders directly to priority terminal lane P4",
    enabled: false,
    rolloutPercentage: 0,
    allowedRoles: ["ADMIN", "MARSHAL"],
  },
};

// In-memory runtime override registry for admin live toggling
const runtimeFlagOverrides = new Map<string, Partial<FeatureFlag>>();

/**
 * Deterministically calculates a bucket number (0 - 99) for a given userId and flagKey
 */
export function calculateUserBucket(flagKey: string, userId: string): number {
  const hash = crypto.createHash("sha256").update(`${flagKey}:${userId}`).digest("hex");
  const sub = parseInt(hash.slice(0, 8), 16);
  return sub % 100;
}

/**
 * Evaluates whether a feature flag is active for a given user context.
 */
export function isFeatureEnabled(flagKey: string, context?: { userId?: string; role?: string }): boolean {
  const baseFlag = DEFAULT_FEATURE_FLAGS[flagKey];
  if (!baseFlag) {
    return false;
  }

  const override = runtimeFlagOverrides.get(flagKey);
  const isGloballyEnabled = override?.enabled !== undefined ? override.enabled : baseFlag.enabled;
  if (!isGloballyEnabled) {
    return false;
  }

  // Check role restrictions if defined
  const allowedRoles = override?.allowedRoles || baseFlag.allowedRoles;
  if (allowedRoles && allowedRoles.length > 0) {
    if (!context?.role || !allowedRoles.includes(context.role)) {
      return false;
    }
  }

  const rolloutPct = override?.rolloutPercentage !== undefined ? override.rolloutPercentage : baseFlag.rolloutPercentage;
  if (rolloutPct >= 100) {
    return true;
  }
  if (rolloutPct <= 0) {
    return false;
  }

  // If userId is provided, evaluate deterministic bucket
  if (context?.userId) {
    const bucket = calculateUserBucket(flagKey, context.userId);
    return bucket < rolloutPct;
  }

  // Without userId, treat fractional rollout as disabled for safety
  return false;
}

/**
 * Returns all feature flags with applied runtime overrides
 */
export function getAllFeatureFlags(context?: { userId?: string; role?: string }): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const key of Object.keys(DEFAULT_FEATURE_FLAGS)) {
    result[key] = isFeatureEnabled(key, context);
  }
  return result;
}

/**
 * Returns full definitions of flags (for admin console)
 */
export function getFeatureFlagDefinitions(): FeatureFlag[] {
  return Object.values(DEFAULT_FEATURE_FLAGS).map((f) => {
    const override = runtimeFlagOverrides.get(f.key);
    return {
      ...f,
      ...(override || {}),
    };
  });
}

/**
 * Updates a feature flag at runtime (restricted to Admin)
 */
export function updateFeatureFlag(key: string, updates: Partial<FeatureFlag>): FeatureFlag {
  const baseFlag = DEFAULT_FEATURE_FLAGS[key];
  if (!baseFlag) {
    throw new Error(`Unknown feature flag "${key}"`);
  }

  const existingOverride = runtimeFlagOverrides.get(key) || {};
  const updated = {
    ...existingOverride,
    ...updates,
  };
  runtimeFlagOverrides.set(key, updated);

  return {
    ...baseFlag,
    ...updated,
  };
}

/**
 * Resets all overrides to baseline (useful in test teardown)
 */
export function resetFeatureFlagOverrides(): void {
  runtimeFlagOverrides.clear();
}
