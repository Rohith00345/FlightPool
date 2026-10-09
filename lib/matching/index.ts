import {
  AIRPORT_TERMINALS,
  Coordinates,
  estimateRoadDistanceKm,
  estimateDurationMinutes,
  haversineDistanceKm,
} from "../geo";

export interface RiderRequest {
  id: string;
  userId: string;
  userName: string;
  flightId: string;
  flightNumber: string;
  flightArrivalTime: Date;
  terminal: "T1" | "T2";
  destinationZone: string;
  destinationAddress: string;
  destinationCoords: Coordinates;
  luggageCount: number;
  womenOnly: boolean;
  gender?: string; // "FEMALE", "MALE", "OTHER"
  readyTime?: Date | null;
  status?: string;
  createdAt?: Date;
}

export interface MatchingConstraints {
  maxRidersPerVehicle: number;   // default 3 or 4
  maxLuggageCapacity: number;    // default 4
  maxDetourMinutes: number;      // default 20
  maxWaitMinutes: number;        // default 20
  flightWindowMinutes: number;   // default 30
}

export const DEFAULT_MATCHING_CONSTRAINTS: MatchingConstraints = {
  maxRidersPerVehicle: 3,
  maxLuggageCapacity: 4,
  maxDetourMinutes: 20,
  maxWaitMinutes: 20,
  flightWindowMinutes: 30,
};

export interface RouteStop {
  riderId: string;
  userId: string;
  userName: string;
  destinationAddress: string;
  destinationZone: string;
  coords: Coordinates;
  soloDistanceKm: number;
  soloDurationMinutes: number;
  routeArrivalMinutes: number;
  detourMinutes: number;
  dropoffOrder: number;
}

export interface MatchedPoolResult {
  id: string;
  terminal: "T1" | "T2";
  destinationCluster: string;
  riders: RiderRequest[];
  stops: RouteStop[];
  totalLuggageCount: number;
  totalRouteKm: number;
  totalRouteDurationMinutes: number;
  earliestReadyTime: Date | null;
  waitCapExpiry: Date | null;
  isWaitCapExpired: boolean;
  isWomenOnly: boolean;
  status: "FORMING" | "CONFIRMED" | "WAIT_CAP_EXPIRED";
}

export interface MatchingEngineResult {
  matchedPools: MatchedPoolResult[];
  unmatchedRequests: RiderRequest[];
  waitCapExpiredRequests: RiderRequest[];
}

/**
 * Generate all permutations of an array.
 */
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const current = items[i];
    const remaining = [...items.slice(0, i), ...items.slice(i + 1)];
    const perms = permutations(remaining);
    for (const p of perms) {
      result.push([current, ...p]);
    }
  }
  return result;
}

/**
 * Checks if two riders can belong in the same destination cluster / corridor.
 */
export function areDestinationsCompatible(
  r1: RiderRequest,
  r2: RiderRequest,
  maxDirectDistanceKm = 10
): boolean {
  if (r1.destinationZone === r2.destinationZone) return true;
  // Thane and Mulund share the same Eastern corridor
  if (
    (r1.destinationZone === "Thane" && r2.destinationZone === "Mulund") ||
    (r1.destinationZone === "Mulund" && r2.destinationZone === "Thane")
  ) {
    return true;
  }
  // Check direct distance between dropoffs
  const dist = haversineDistanceKm(r1.destinationCoords, r2.destinationCoords);
  return dist <= maxDirectDistanceKm;
}

/**
 * Computes the optimal drop-off order minimizing total travel time
 * while enforcing max detour per rider.
 */
export function optimizeDropoffRoute(
  terminal: "T1" | "T2",
  riders: RiderRequest[],
  maxDetourMinutes = 20
): {
  stops: RouteStop[];
  totalKm: number;
  totalDurationMin: number;
  isValidDetour: boolean;
} | null {
  if (riders.length === 0) return null;

  const terminalCoords = AIRPORT_TERMINALS[terminal].coords;

  // Pre-calculate solo distance and time for each rider
  const riderSoloStats = new Map<
    string,
    { soloKm: number; soloMin: number }
  >();

  for (const r of riders) {
    const soloKm = estimateRoadDistanceKm(terminalCoords, r.destinationCoords);
    const soloMin = estimateDurationMinutes(soloKm);
    riderSoloStats.set(r.id, { soloKm, soloMin });
  }

  // If 1 rider, trivial
  if (riders.length === 1) {
    const r = riders[0];
    const stats = riderSoloStats.get(r.id)!;
    return {
      stops: [
        {
          riderId: r.id,
          userId: r.userId,
          userName: r.userName,
          destinationAddress: r.destinationAddress,
          destinationZone: r.destinationZone,
          coords: r.destinationCoords,
          soloDistanceKm: stats.soloKm,
          soloDurationMinutes: stats.soloMin,
          routeArrivalMinutes: stats.soloMin,
          detourMinutes: 0,
          dropoffOrder: 1,
        },
      ],
      totalKm: stats.soloKm,
      totalDurationMin: stats.soloMin,
      isValidDetour: true,
    };
  }

  const allPerms = permutations(riders);
  let bestRoute: {
    stops: RouteStop[];
    totalKm: number;
    totalDurationMin: number;
    isValidDetour: boolean;
  } | null = null;
  let minTotalMinutes = Infinity;

  for (const perm of allPerms) {
    let currentCoords: Coordinates = terminalCoords;
    let accumulatedKm = 0;
    let accumulatedMinutes = 0;
    let validDetour = true;
    const currentStops: RouteStop[] = [];

    for (let i = 0; i < perm.length; i++) {
      const rider = perm[i];
      const legKm = estimateRoadDistanceKm(currentCoords, rider.destinationCoords);
      const legMin = estimateDurationMinutes(legKm);

      accumulatedKm += legKm;
      accumulatedMinutes += legMin;

      const solo = riderSoloStats.get(rider.id)!;
      const detour = accumulatedMinutes - solo.soloMin;

      if (detour > maxDetourMinutes) {
        validDetour = false;
      }

      currentStops.push({
        riderId: rider.id,
        userId: rider.userId,
        userName: rider.userName,
        destinationAddress: rider.destinationAddress,
        destinationZone: rider.destinationZone,
        coords: rider.destinationCoords,
        soloDistanceKm: solo.soloKm,
        soloDurationMinutes: solo.soloMin,
        routeArrivalMinutes: accumulatedMinutes,
        detourMinutes: Math.max(0, detour),
        dropoffOrder: i + 1,
      });

      currentCoords = rider.destinationCoords;
    }

    if (validDetour && accumulatedMinutes < minTotalMinutes) {
      minTotalMinutes = accumulatedMinutes;
      bestRoute = {
        stops: currentStops,
        totalKm: Number(accumulatedKm.toFixed(2)),
        totalDurationMin: accumulatedMinutes,
        isValidDetour: true,
      };
    }
  }

  // If no combination satisfied detour limit, return the least-detour one with isValidDetour = false
  if (!bestRoute && allPerms.length > 0) {
    // Pick first permutation to inspect
    return null;
  }

  return bestRoute;
}

/**
 * Pure Matching Engine
 * Groups requests by:
 * - Terminal (T1 vs T2)
 * - Flight arrival window (within flightWindowMinutes or same flight)
 * - Gender / Women-only compatibility
 * - Luggage capacity
 * - Route detour <= maxDetourMinutes
 * - Max riders per cab (default 3 or 4)
 * - Wait cap check
 */
export function matchRiderRequests(
  requests: RiderRequest[],
  currentTime: Date = new Date(),
  constraints: MatchingConstraints = DEFAULT_MATCHING_CONSTRAINTS
): MatchingEngineResult {
  const matchedPools: MatchedPoolResult[] = [];
  const processedRiderIds = new Set<string>();
  const waitCapExpiredRequests: RiderRequest[] = [];

  // Filter only active / pooling / ready requests
  const eligibleRequests = requests.filter(
    (r) => !r.status || r.status === "SEARCHING" || r.status === "POOLING"
  );

  // Group by terminal first
  const terminalBuckets = new Map<string, RiderRequest[]>();
  for (const req of eligibleRequests) {
    const list = terminalBuckets.get(req.terminal) || [];
    list.push(req);
    terminalBuckets.set(req.terminal, list);
  }

  let poolCounter = 1;

  for (const [terminal, terminalReqs] of terminalBuckets.entries()) {
    // Separate into women-only requested and general
    const womenOnlyList = terminalReqs.filter((r) => r.womenOnly);
    const standardList = terminalReqs.filter((r) => !r.womenOnly);

    const matchCandidateGroup = (candidates: RiderRequest[], isWomenPool: boolean) => {
      // Sort candidates by ready time or arrival time
      const sorted = [...candidates].sort((a, b) => {
        const timeA = a.readyTime ? a.readyTime.getTime() : a.flightArrivalTime.getTime();
        const timeB = b.readyTime ? b.readyTime.getTime() : b.flightArrivalTime.getTime();
        return timeA - timeB;
      });

      for (let i = 0; i < sorted.length; i++) {
        const leader = sorted[i];
        if (processedRiderIds.has(leader.id)) continue;

        const candidatePoolRiders: RiderRequest[] = [leader];
        let currentLuggage = leader.luggageCount;

        for (let j = 0; j < sorted.length; j++) {
          if (i === j) continue;
          const candidate = sorted[j];
          if (processedRiderIds.has(candidate.id)) continue;
          if (candidatePoolRiders.length >= constraints.maxRidersPerVehicle) break;

          // Check flight window
          const arrivalDiffMin =
            Math.abs(leader.flightArrivalTime.getTime() - candidate.flightArrivalTime.getTime()) /
            (1000 * 60);
          if (
            leader.flightId !== candidate.flightId &&
            arrivalDiffMin > constraints.flightWindowMinutes
          ) {
            continue;
          }

          // Check cluster compatibility
          if (!areDestinationsCompatible(leader, candidate)) {
            continue;
          }

          // Check luggage capacity
          if (currentLuggage + candidate.luggageCount > constraints.maxLuggageCapacity) {
            continue;
          }

          // Check if women-only constraint holds
          if (isWomenPool && candidate.gender && candidate.gender.toUpperCase() === "MALE") {
            continue;
          }

          // Test route detour with this candidate added
          const testGroup = [...candidatePoolRiders, candidate];
          const testRoute = optimizeDropoffRoute(
            terminal as "T1" | "T2",
            testGroup,
            constraints.maxDetourMinutes
          );

          if (testRoute && testRoute.isValidDetour) {
            candidatePoolRiders.push(candidate);
            currentLuggage += candidate.luggageCount;
          }
        }

        // Evaluate pool viability
        const leaderReady = leader.readyTime || leader.flightArrivalTime;
        const minutesWaiting = (currentTime.getTime() - leaderReady.getTime()) / (1000 * 60);
        const waitCapExpiry = new Date(leaderReady.getTime() + constraints.maxWaitMinutes * 60 * 1000);
        const isWaitCapExpired = minutesWaiting >= constraints.maxWaitMinutes;

        if (candidatePoolRiders.length >= 2) {
          // Valid multi-rider pool formed!
          const route = optimizeDropoffRoute(
            terminal as "T1" | "T2",
            candidatePoolRiders,
            constraints.maxDetourMinutes
          )!;

          matchedPools.push({
            id: `POOL-${terminal}-${Date.now().toString().slice(-4)}-${poolCounter++}`,
            terminal: terminal as "T1" | "T2",
            destinationCluster: leader.destinationZone,
            riders: candidatePoolRiders,
            stops: route.stops,
            totalLuggageCount: currentLuggage,
            totalRouteKm: route.totalKm,
            totalRouteDurationMinutes: route.totalDurationMin,
            earliestReadyTime: leaderReady,
            waitCapExpiry,
            isWaitCapExpired,
            isWomenOnly: isWomenPool,
            status: "FORMING",
          });

          for (const r of candidatePoolRiders) {
            processedRiderIds.add(r.id);
          }
        } else if (isWaitCapExpired) {
          // Single rider whose wait cap has expired
          waitCapExpiredRequests.push(leader);
          processedRiderIds.add(leader.id);
        }
      }
    };

    // First process women-only groups strictly
    matchCandidateGroup(womenOnlyList, true);
    // Then process standard groups
    matchCandidateGroup(standardList, false);
  }

  const unmatchedRequests = eligibleRequests.filter(
    (r) => !processedRiderIds.has(r.id)
  );

  return {
    matchedPools,
    unmatchedRequests,
    waitCapExpiredRequests,
  };
}

/**
 * Handle rider cancellation mid-pool.
 * Recalculates route and validates whether remaining pool is still viable.
 */
export function handleRiderCancellation(
  currentPool: MatchedPoolResult,
  cancellingRiderId: string,
  constraints: MatchingConstraints = DEFAULT_MATCHING_CONSTRAINTS
): {
  updatedPool: MatchedPoolResult | null;
  status: "POOL_UPDATED" | "POOL_COLLAPSED" | "OFFER_SOLO";
  remainingRiders: RiderRequest[];
} {
  const remaining = currentPool.riders.filter((r) => r.id !== cancellingRiderId);

  if (remaining.length === 0) {
    return {
      updatedPool: null,
      status: "POOL_COLLAPSED",
      remainingRiders: [],
    };
  }

  if (remaining.length === 1) {
    // Only 1 rider remaining - pool collapsed into solo fallback
    return {
      updatedPool: null,
      status: "OFFER_SOLO",
      remainingRiders: remaining,
    };
  }

  // Recalculate route for remaining riders
  const route = optimizeDropoffRoute(
    currentPool.terminal,
    remaining,
    constraints.maxDetourMinutes
  );

  if (!route || !route.isValidDetour) {
    return {
      updatedPool: null,
      status: "POOL_COLLAPSED",
      remainingRiders: remaining,
    };
  }

  const updatedLuggage = remaining.reduce((sum, r) => sum + r.luggageCount, 0);

  const updatedPool: MatchedPoolResult = {
    ...currentPool,
    riders: remaining,
    stops: route.stops,
    totalLuggageCount: updatedLuggage,
    totalRouteKm: route.totalKm,
    totalRouteDurationMinutes: route.totalDurationMin,
  };

  return {
    updatedPool,
    status: "POOL_UPDATED",
    remainingRiders: remaining,
  };
}
