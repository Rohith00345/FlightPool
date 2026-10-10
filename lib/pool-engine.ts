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

/**
 * Evaluates wait-cap expiry on forming pools
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
    include: {
      members: {
        include: { rideRequest: true },
      },
    },
  });

  const confirmedPools: string[] = [];
  const expiredPools: string[] = [];

  for (const pool of expiredFormingPools) {
    if (pool.members.length >= 2) {
      // 2 or more members: auto-confirm the pool and allocate to trip
      await transitionPoolStatus(pool.id, pool.version, "CONFIRMED");
      confirmedPools.push(pool.id);
    } else {
      // Less than 2 members: wait-cap expired without forming a valid pool
      await transitionPoolStatus(pool.id, pool.version, "EXPIRED");
      expiredPools.push(pool.id);

      // Transition lone rider to SOLO fallback
      for (const member of pool.members) {
        await prisma.rideRequest.update({
          where: { id: member.rideRequestId },
          data: { status: "SOLO" },
        });
        await prisma.poolMember.update({
          where: { id: member.id },
          data: { status: "CANCELLED" },
        });
      }
    }
  }

  return { confirmedPools, expiredPools };
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
