import { prisma } from "./prisma";
import { calculatePoolPricing } from "./pricing";
import { Pool, PoolMember, RideRequest } from "@prisma/client";

export type PoolStatus =
  | "FORMING"
  | "CONFIRMED"
  | "DISPATCHED"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

export class OptimisticLockError extends Error {
  public readonly poolId: string;
  public readonly expectedVersion: number;

  constructor(poolId: string, expectedVersion: number) {
    super(
      `Optimistic lock collision on Pool '${poolId}': expected version ${expectedVersion}, but pool was concurrently modified.`
    );
    this.name = "OptimisticLockError";
    this.poolId = poolId;
    this.expectedVersion = expectedVersion;
  }
}

export class CapacityExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapacityExceededError";
  }
}

/**
 * Valid transitions for the Pool state machine
 */
const VALID_TRANSITIONS: Record<PoolStatus, PoolStatus[]> = {
  FORMING: ["CONFIRMED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

/**
 * Validates whether state transition is allowed
 */
export function isValidTransition(from: PoolStatus, to: PoolStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}

/**
 * Atomically transitions pool state using optimistic locking on `version`.
 * Throws OptimisticLockError if another process modified the pool concurrently.
 */
export async function transitionPoolStatus(
  poolId: string,
  expectedVersion: number,
  targetStatus: PoolStatus,
  extraData: {
    driverId?: string;
    vehicleId?: string;
    waitCapExpiry?: Date | null;
  } = {}
): Promise<Pool> {
  const current = await prisma.pool.findUnique({
    where: { id: poolId },
  });

  if (!current) {
    throw new Error(`Pool not found: ${poolId}`);
  }

  const currentStatus = current.status as PoolStatus;
  if (!isValidTransition(currentStatus, targetStatus)) {
    throw new Error(
      `Illegal pool state transition from '${currentStatus}' to '${targetStatus}'.`
    );
  }

  const result = await prisma.pool.updateMany({
    where: {
      id: poolId,
      version: expectedVersion,
    },
    data: {
      status: targetStatus,
      version: { increment: 1 },
      ...extraData,
    },
  });

  if (result.count === 0) {
    throw new OptimisticLockError(poolId, expectedVersion);
  }

  return prisma.pool.findUniqueOrThrow({ where: { id: poolId } });
}

/**
 * Adds a rider to a pool with optimistic concurrency lock verification
 */
export async function addRiderToPoolWithLock(
  poolId: string,
  expectedVersion: number,
  riderRequest: RideRequest,
  fareQuotePaise: { solo: number; pool: number; savingsPct: number; detourMin: number }
): Promise<{ pool: Pool; member: PoolMember }> {
  return await prisma.$transaction(async (tx) => {
    const currentPool = await tx.pool.findUnique({
      where: { id: poolId },
      include: {
        members: {
          include: { rideRequest: true },
        },
      },
    });

    if (!currentPool) {
      throw new Error(`Pool ${poolId} not found`);
    }

    if (currentPool.status !== "FORMING") {
      throw new Error(`Cannot join pool with status '${currentPool.status}'`);
    }

    if (currentPool.version !== expectedVersion) {
      throw new OptimisticLockError(poolId, expectedVersion);
    }

    const currentSeats = currentPool.members.length;
    const currentLuggage = currentPool.members.reduce(
      (sum, m) => sum + (m.rideRequest?.luggageCount || 1),
      0
    );

    if (currentSeats >= 3) {
      throw new CapacityExceededError(
        `Pool capacity reached (max 3 passengers per vehicle).`
      );
    }

    if (currentLuggage + riderRequest.luggageCount > 4) {
      throw new CapacityExceededError(
        `Luggage capacity exceeded (max 4 bags total).`
      );
    }

    // Atomically increment version
    const updated = await tx.pool.updateMany({
      where: {
        id: poolId,
        version: expectedVersion,
      },
      data: {
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new OptimisticLockError(poolId, expectedVersion);
    }

    const newMember = await tx.poolMember.create({
      data: {
        poolId: poolId,
        rideRequestId: riderRequest.id,
        userId: riderRequest.userId,
        pickupOrder: 1,
        dropoffOrder: currentPool.members.length + 1,
        soloFare: fareQuotePaise.solo / 100,
        poolFare: fareQuotePaise.pool / 100,
        savingsPct: fareQuotePaise.savingsPct,
        detourMinutes: fareQuotePaise.detourMin,
        status: "CONFIRMED",
      },
    });

    await tx.rideRequest.update({
      where: { id: riderRequest.id },
      data: { status: "POOLING" },
    });

    const refreshedPool = await tx.pool.findUniqueOrThrow({
      where: { id: poolId },
    });

    return { pool: refreshedPool, member: newMember };
  });
}

/**
 * Attempts to join a pool with automatic optimistic locking retry and backoff.
 * Throws CapacityExceededError if vehicle capacity is reached.
 */
export async function joinPoolWithRetry(
  poolId: string,
  riderRequest: RideRequest,
  fareQuotePaise: { solo: number; pool: number; savingsPct: number; detourMin: number },
  maxRetries = 25
): Promise<{ pool: Pool; member: PoolMember }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const current = await prisma.pool.findUniqueOrThrow({ where: { id: poolId } });
    try {
      return await addRiderToPoolWithLock(poolId, current.version, riderRequest, fareQuotePaise);
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        await new Promise((r) => setTimeout(r, 10 + Math.random() * 30));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Exceeded max retries joining pool ${poolId}`);
}

/**
 * Creates a binding FareQuote record with 15-minute lock-in
 */
export async function createBindingFareQuote(params: {
  userId: string;
  rideRequestId?: string;
  destinationZone: string;
  distanceKm: number;
  minutes: number;
  poolRidersCount?: number;
}): Promise<{
  id: string;
  soloFarePaise: number;
  poolFarePaise: number;
  savingsPct: number;
  expiresAt: Date;
}> {
  const riders = [
    { riderId: params.userId, soloDistanceKm: params.distanceKm },
    { riderId: "peer_1", soloDistanceKm: params.distanceKm },
  ];
  const pricing = calculatePoolPricing(riders, params.distanceKm + 4);
  const riderShare = pricing.riderShares[0];

  const soloFarePaise = Math.round((riderShare?.soloFare || 300) * 100);
  const poolFarePaise = Math.round((riderShare?.poolFare || 210) * 100);
  const savingsPct = riderShare?.savingsPct || 30.0;

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins validity

  const quote = await prisma.fareQuote.create({
    data: {
      userId: params.userId,
      rideRequestId: params.rideRequestId || null,
      destinationZone: params.destinationZone,
      soloFarePaise,
      poolFarePaise,
      minSavingPct: savingsPct,
      surgeMultiplier: 1.0,
      currency: "INR",
      status: "ACTIVE",
      expiresAt,
    },
  });

  return {
    id: quote.id,
    soloFarePaise: quote.soloFarePaise,
    poolFarePaise: quote.poolFarePaise,
    savingsPct: quote.minSavingPct,
    expiresAt: quote.expiresAt,
  };
}

const poolEvaluationCooldown = new Map<string, number>();

/**
 * Evaluates wait-cap expiry on a specific pool (on-read evaluation scoped to caller's pool).
 * Safe, idempotent via optimistic locking, and rate-limited per pool.
 */
export async function evaluatePoolWaitCap(
  poolId: string,
  referenceTime = new Date()
): Promise<{
  poolId: string;
  transitioned: boolean;
  newStatus?: PoolStatus;
  autoSoloApplied?: boolean;
}> {
  const lastEval = poolEvaluationCooldown.get(poolId) || 0;
  const now = referenceTime.getTime();
  if (now - lastEval < 1500) {
    return { poolId, transitioned: false };
  }
  poolEvaluationCooldown.set(poolId, now);

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      members: {
        include: { rideRequest: true },
      },
    },
  });

  if (!pool || pool.status !== "FORMING" || !pool.waitCapExpiry || pool.waitCapExpiry > referenceTime) {
    return { poolId, transitioned: false };
  }

  try {
    if (pool.members.length >= 2) {
      // 2 or more members: auto-confirm the pool for dispatch
      await transitionPoolStatus(pool.id, pool.version, "CONFIRMED");
      return { poolId, transitioned: true, newStatus: "CONFIRMED" };
    } else {
      // Fewer than 2 members: wait-cap expired without forming a multi-rider pool
      await transitionPoolStatus(pool.id, pool.version, "EXPIRED");

      let autoSoloApplied = false;
      for (const member of pool.members) {
        if (member.rideRequest.autoSoloConsent) {
          // Rider explicitly opted in to auto-solo earlier
          await prisma.rideRequest.update({
            where: { id: member.rideRequestId },
            data: { status: "SOLO" },
          });
          await prisma.poolMember.update({
            where: { id: member.id },
            data: { status: "CANCELLED" },
          });
          autoSoloApplied = true;
        } else {
          // Never auto-convert or auto-charge without consent
          // Present options: keep waiting (bounded), go solo, or cancel free
          await prisma.rideRequest.update({
            where: { id: member.rideRequestId },
            data: { status: "WAIT_CAP_EXPIRED" },
          });
          await prisma.poolMember.update({
            where: { id: member.id },
            data: { status: "WAITING" },
          });
        }
      }

      return { poolId, transitioned: true, newStatus: "EXPIRED", autoSoloApplied };
    }
  } catch (err) {
    if (err instanceof OptimisticLockError) {
      // Another concurrent read or cron already transitioned this pool
      return { poolId, transitioned: false };
    }
    throw err;
  }
}

/**
 * Evaluates wait-cap expiry on forming pools (Cron backstop)
 */
export async function processWaitCapExpiries(referenceTime = new Date()): Promise<{
  confirmedPools: string[];
  expiredPools: string[];
}> {
  const expiredFormingPools = await prisma.pool.findMany({
    where: {
      status: "FORMING",
      waitCapExpiry: { lte: referenceTime },
    },
    select: { id: true },
  });

  const confirmedPools: string[] = [];
  const expiredPools: string[] = [];

  for (const p of expiredFormingPools) {
    const res = await evaluatePoolWaitCap(p.id, referenceTime);
    if (res.transitioned) {
      if (res.newStatus === "CONFIRMED") confirmedPools.push(p.id);
      if (res.newStatus === "EXPIRED") expiredPools.push(p.id);
    }
  }

  return { confirmedPools, expiredPools };
}

export type JourneyState =
  | "IDLE"
  | "SEARCHING"
  | "FORMING"
  | "WAIT_CAP_EXPIRED"
  | "CONFIRMED"
  | "DRIVER_ASSIGNED"
  | "DRIVER_EN_ROUTE"
  | "AT_BAY"
  | "ON_TRIP"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED"
  | "SOLO_REQUESTED";

export class InvalidStateCombinationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateCombinationError";
  }
}

/**
 * Canonical function deriving user journey state across RideRequest + Pool + Trip
 * Throws InvalidStateCombinationError for impossible lifecycle combinations.
 */
export function deriveJourneyState(params: {
  rideRequest?: { status: string } | null;
  pool?: { status: string } | null;
  trip?: { status: string; driverAtBayAt?: Date | null } | null;
}): JourneyState {
  const { rideRequest, pool, trip } = params;

  if (!rideRequest) {
    return "IDLE";
  }

  const reqStatus = rideRequest.status;
  const poolStatus = pool?.status;
  const tripStatus = trip?.status;

  // Invariant validation for impossible state combinations
  if (tripStatus === "IN_TRANSIT" && reqStatus !== "CONFIRMED" && reqStatus !== "POOLING" && reqStatus !== "SOLO") {
    throw new InvalidStateCombinationError(
      `Trip cannot be 'IN_TRANSIT' when RideRequest is '${reqStatus}'.`
    );
  }

  if (tripStatus === "COMPLETED" && reqStatus !== "COMPLETED" && reqStatus !== "CONFIRMED" && reqStatus !== "SOLO") {
    throw new InvalidStateCombinationError(
      `Trip cannot be 'COMPLETED' when RideRequest is '${reqStatus}'.`
    );
  }

  if (trip && reqStatus === "SEARCHING") {
    throw new InvalidStateCombinationError(
      `Trip cannot exist when RideRequest is still 'SEARCHING'.`
    );
  }

  if (poolStatus === "COMPLETED" && reqStatus === "SEARCHING") {
    throw new InvalidStateCombinationError(
      `Pool cannot be 'COMPLETED' while RideRequest is 'SEARCHING'.`
    );
  }

  if (reqStatus === "CANCELLED") {
    if (tripStatus === "IN_TRANSIT" || tripStatus === "COMPLETED") {
      throw new InvalidStateCombinationError(
        `Active trip cannot exist when RideRequest is 'CANCELLED'.`
      );
    }
    return "CANCELLED";
  }

  if (reqStatus === "COMPLETED" || tripStatus === "COMPLETED") {
    return "COMPLETED";
  }

  if (tripStatus === "IN_TRANSIT") {
    return "ON_TRIP";
  }

  if (tripStatus === "AT_BAY" || (tripStatus === "EN_ROUTE_PICKUP" && trip?.driverAtBayAt)) {
    return "AT_BAY";
  }

  if (tripStatus === "EN_ROUTE_PICKUP") {
    return "DRIVER_EN_ROUTE";
  }

  if (tripStatus === "ASSIGNED") {
    return "DRIVER_ASSIGNED";
  }

  if (reqStatus === "CONFIRMED" || poolStatus === "CONFIRMED" || poolStatus === "DISPATCHED") {
    return "CONFIRMED";
  }

  if (reqStatus === "WAIT_CAP_EXPIRED") {
    return "WAIT_CAP_EXPIRED";
  }

  if (reqStatus === "SOLO") {
    return "SOLO_REQUESTED";
  }

  if (poolStatus === "EXPIRED") {
    return "EXPIRED";
  }

  if (poolStatus === "FORMING" || reqStatus === "POOLING") {
    return "FORMING";
  }

  if (reqStatus === "SEARCHING") {
    return "SEARCHING";
  }

  return "IDLE";
}

/**
 * Handles flight status updates (delays, landing, cancellations)
 */
export async function handleFlightStatusChange(params: {
  flightNumber: string;
  newStatus: "SCHEDULED" | "LANDED" | "DELAYED" | "CANCELLED";
  delayMinutes?: number;
}): Promise<{
  affectedRequests: number;
  autoCancelledRequests: number;
  message: string;
}> {
  const flight = await prisma.flight.findUnique({
    where: { flightNumber: params.flightNumber },
    include: {
      rideRequests: {
        include: {
          user: true,
          poolMembers: {
            include: { pool: true },
          },
        },
      },
    },
  });

  if (!flight) {
    throw new Error(`Flight not found: ${params.flightNumber}`);
  }

  await prisma.flight.update({
    where: { id: flight.id },
    data: { status: params.newStatus },
  });

  if (params.newStatus === "CANCELLED") {
    let cancelledCount = 0;
    for (const req of flight.rideRequests) {
      await prisma.rideRequest.update({
        where: { id: req.id },
        data: { status: "CANCELLED" },
      });

      for (const pm of req.poolMembers) {
        await prisma.poolMember.update({
          where: { id: pm.id },
          data: { status: "CANCELLED" },
        });
      }
      cancelledCount++;
    }

    return {
      affectedRequests: flight.rideRequests.length,
      autoCancelledRequests: cancelledCount,
      message: `Flight ${params.flightNumber} marked CANCELLED. ${cancelledCount} ride requests cancelled with full refund guarantee.`,
    };
  }

  if (params.newStatus === "DELAYED" && params.delayMinutes) {
    const delayMs = params.delayMinutes * 60 * 1000;
    for (const req of flight.rideRequests) {
      const baseReady = req.readyTime || flight.arrivalTime;
      const updatedReady = new Date(baseReady.getTime() + delayMs);
      await prisma.rideRequest.update({
        where: { id: req.id },
        data: { readyTime: updatedReady },
      });
    }

    return {
      affectedRequests: flight.rideRequests.length,
      autoCancelledRequests: 0,
      message: `Flight ${params.flightNumber} delay of ${params.delayMinutes}m propagated to ${flight.rideRequests.length} passenger ready times.`,
    };
  }

  return {
    affectedRequests: flight.rideRequests.length,
    autoCancelledRequests: 0,
    message: `Flight ${params.flightNumber} status updated to ${params.newStatus}.`,
  };
}
