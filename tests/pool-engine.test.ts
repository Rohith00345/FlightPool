import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  OptimisticLockError,
  CapacityExceededError,
} from "../lib/pool-engine";

describe("Pool Engine & Optimistic Locking", () => {
  it("validates permissible pool state transitions", () => {
    // FORMING can transition to CONFIRMED, CANCELLED, EXPIRED
    expect(isValidTransition("FORMING", "CONFIRMED")).toBe(true);
    expect(isValidTransition("FORMING", "CANCELLED")).toBe(true);
    expect(isValidTransition("FORMING", "EXPIRED")).toBe(true);

    // CONFIRMED can transition to DISPATCHED or CANCELLED
    expect(isValidTransition("CONFIRMED", "DISPATCHED")).toBe(true);
    expect(isValidTransition("CONFIRMED", "CANCELLED")).toBe(true);

    // DISPATCHED can transition to COMPLETED or CANCELLED
    expect(isValidTransition("DISPATCHED", "COMPLETED")).toBe(true);
    expect(isValidTransition("DISPATCHED", "CANCELLED")).toBe(true);

    // Terminal states cannot transition
    expect(isValidTransition("COMPLETED", "FORMING")).toBe(false);
    expect(isValidTransition("COMPLETED", "CANCELLED")).toBe(false);
    expect(isValidTransition("CANCELLED", "CONFIRMED")).toBe(false);
    expect(isValidTransition("EXPIRED", "FORMING")).toBe(false);

    // Illegal skipping transitions
    expect(isValidTransition("FORMING", "COMPLETED")).toBe(false);
    expect(isValidTransition("FORMING", "DISPATCHED")).toBe(false);
  });

  it("constructs and throws OptimisticLockError with relevant context", () => {
    const error = new OptimisticLockError("pool_123", 4);
    expect(error.name).toBe("OptimisticLockError");
    expect(error.poolId).toBe("pool_123");
    expect(error.expectedVersion).toBe(4);
    expect(error.message).toContain("Optimistic lock collision");
  });

  it("constructs CapacityExceededError when vehicle limits are exceeded", () => {
    const error = new CapacityExceededError("Vehicle is full");
    expect(error.name).toBe("CapacityExceededError");
    expect(error.message).toBe("Vehicle is full");
  });

  it("concurrency test: 20 simultaneous joins to one pool never exceed capacity (max 3)", async () => {
    const { prisma } = await import("../lib/prisma");
    const { joinPoolWithRetry } = await import("../lib/pool-engine");

    // Create a target flight
    const flight = await prisma.flight.upsert({
      where: { flightNumber: "6E-CONCUR" },
      update: {},
      create: {
        flightNumber: "6E-CONCUR",
        airline: "IndiGo",
        origin: "DEL",
        destination: "BOM",
        terminal: "T2",
        arrivalTime: new Date(),
        status: "LANDED",
      },
    });

    // Create a target pool with capacity 3
    const testPool = await prisma.pool.create({
      data: {
        targetFlightId: flight.id,
        destinationCluster: "Andheri",
        terminal: "T2",
        status: "FORMING",
        version: 1,
      },
    });

    try {
      // Create 20 unique riders and requests
      const ridersData = Array.from({ length: 20 }, (_, idx) => ({
        id: `concur_user_${Date.now()}_${idx}`,
        name: `Concur Rider ${idx}`,
        phone: `+91981${Math.floor(1000000 + Math.random() * 9000000)}`,
      }));

      for (const r of ridersData) {
        await prisma.user.create({ data: r });
      }

      const rideRequests = [];
      for (const r of ridersData) {
        const req = await prisma.rideRequest.create({
          data: {
            userId: r.id,
            flightId: flight.id,
            destinationZone: "Andheri",
            destinationAddress: "Andheri West, Mumbai",
            destinationLat: 19.1136,
            destinationLng: 72.8697,
            luggageCount: 1,
            status: "SEARCHING",
          },
        });
        rideRequests.push(req);
      }

      const quote = {
        solo: 35000,
        pool: 24500,
        savingsPct: 30,
        detourMin: 8,
      };

      // Fire 20 simultaneous join attempts concurrently
      const joinPromises = rideRequests.map((req) =>
        joinPoolWithRetry(testPool.id, req, quote)
      );

      const results = await Promise.allSettled(joinPromises);

      // Verify outcomes
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Pool capacity invariant: strictly at most 3 seats can be accepted
      expect(fulfilled.length).toBeLessThanOrEqual(3);
      expect(fulfilled.length).toBe(3);
      expect(rejected.length).toBe(17);

      // Verify in database: Pool must have exactly 3 members, never exceeding capacity
      const finalMembers = await prisma.poolMember.findMany({
        where: { poolId: testPool.id },
      });
      expect(finalMembers.length).toBe(3);

      // Verify rejected reasons include CapacityExceededError
      const capacityErrors = rejected.filter(
        (r) =>
          r.status === "rejected" &&
          (r.reason?.name === "CapacityExceededError" ||
            String(r.reason).includes("capacity"))
      );
      expect(capacityErrors.length).toBeGreaterThan(0);
    } finally {
      // Clean up test pool
      await prisma.poolMember.deleteMany({ where: { poolId: testPool.id } });
      await prisma.pool.delete({ where: { id: testPool.id } });
    }
  });

  it("wait cap test: proves a pool expires after the cap with no cron", async () => {
    const { prisma } = await import("../lib/prisma");
    const { processWaitCapExpiries } = await import("../lib/pool-engine");

    // 1. Create a lone rider and request
    const loneUser = await prisma.user.create({
      data: {
        id: `lone_user_${Date.now()}`,
        name: "Lone Rider",
        phone: `+91982${Math.floor(1000000 + Math.random() * 9000000)}`,
      },
    });

    const flight = await prisma.flight.findFirstOrThrow();

    const loneRequest = await prisma.rideRequest.create({
      data: {
        userId: loneUser.id,
        flightId: flight.id,
        destinationZone: "Powai",
        destinationAddress: "Hiranandani, Powai",
        destinationLat: 19.1197,
        destinationLng: 72.9056,
        status: "POOLING",
        autoSoloConsent: false, // Rider has NOT consented to auto-solo
      },
    });

    // 2. Create a FORMING pool with waitCapExpiry 5 minutes in the PAST
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const expiredPool = await prisma.pool.create({
      data: {
        targetFlightId: flight.id,
        destinationCluster: "Powai",
        terminal: "T2",
        status: "FORMING",
        waitCapExpiry: fiveMinutesAgo,
        version: 1,
      },
    });

    const poolMember = await prisma.poolMember.create({
      data: {
        poolId: expiredPool.id,
        rideRequestId: loneRequest.id,
        userId: loneUser.id,
        status: "CONFIRMED",
        soloFare: 300,
        poolFare: 210,
      },
    });

    try {
      // 3. Proves expiry without invoking any cron route:
      const { evaluatePoolWaitCap } = await import("../lib/pool-engine");
      const expiryResult = await evaluatePoolWaitCap(expiredPool.id, new Date());

      expect(expiryResult.transitioned).toBe(true);
      expect(expiryResult.newStatus).toBe("EXPIRED");
      expect(expiryResult.autoSoloApplied).toBe(false);

      // 4. Assert pool is now EXPIRED
      const refreshedPool = await prisma.pool.findUniqueOrThrow({
        where: { id: expiredPool.id },
      });
      expect(refreshedPool.status).toBe("EXPIRED");

      // 5. Assert lone rider is NOT auto-converted to solo: transitions to WAIT_CAP_EXPIRED
      const refreshedReq = await prisma.rideRequest.findUniqueOrThrow({
        where: { id: loneRequest.id },
      });
      expect(refreshedReq.status).toBe("WAIT_CAP_EXPIRED");
    } finally {
      // Clean up test records
      await prisma.poolMember.deleteMany({ where: { poolId: expiredPool.id } });
      await prisma.pool.delete({ where: { id: expiredPool.id } });
      await prisma.rideRequest.delete({ where: { id: loneRequest.id } });
      await prisma.user.delete({ where: { id: loneUser.id } });
    }
  });

  it("wait cap consent test: auto-converts to SOLO only when rider previously opted in", async () => {
    const { prisma } = await import("../lib/prisma");
    const { evaluatePoolWaitCap } = await import("../lib/pool-engine");

    const user = await prisma.user.create({
      data: {
        id: `optin_user_${Date.now()}`,
        name: "Opt-In Rider",
        phone: `+91983${Math.floor(1000000 + Math.random() * 9000000)}`,
      },
    });

    const flight = await prisma.flight.findFirstOrThrow();
    const req = await prisma.rideRequest.create({
      data: {
        userId: user.id,
        flightId: flight.id,
        destinationZone: "Bandra",
        destinationAddress: "Bandra West",
        destinationLat: 19.0596,
        destinationLng: 72.8295,
        status: "POOLING",
        autoSoloConsent: true, // Rider explicitly opted in to auto-solo earlier
      },
    });

    const pool = await prisma.pool.create({
      data: {
        targetFlightId: flight.id,
        destinationCluster: "Bandra",
        terminal: "T2",
        status: "FORMING",
        waitCapExpiry: new Date(Date.now() - 60000),
        version: 1,
      },
    });

    const member = await prisma.poolMember.create({
      data: {
        poolId: pool.id,
        rideRequestId: req.id,
        userId: user.id,
        status: "CONFIRMED",
        soloFare: 350,
        poolFare: 245,
      },
    });

    try {
      const res = await evaluatePoolWaitCap(pool.id, new Date());
      expect(res.transitioned).toBe(true);
      expect(res.autoSoloApplied).toBe(true);

      const refreshedReq = await prisma.rideRequest.findUniqueOrThrow({
        where: { id: req.id },
      });
      expect(refreshedReq.status).toBe("SOLO");
    } finally {
      await prisma.poolMember.deleteMany({ where: { poolId: pool.id } });
      await prisma.pool.delete({ where: { id: pool.id } });
      await prisma.rideRequest.delete({ where: { id: req.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("concurrency & idempotency test: 20 simultaneous status reads at expiry cause exactly one transition", async () => {
    const { prisma } = await import("../lib/prisma");
    const { transitionPoolStatus } = await import("../lib/pool-engine");

    const flight = await prisma.flight.findFirstOrThrow();
    const concurrentPool = await prisma.pool.create({
      data: {
        targetFlightId: flight.id,
        destinationCluster: "Andheri",
        terminal: "T2",
        status: "FORMING",
        waitCapExpiry: new Date(Date.now() - 10000),
        version: 1,
      },
    });

    try {
      // 20 concurrent attempts to transition the pool state from FORMING to EXPIRED
      const attempts = Array.from({ length: 20 }, () =>
        transitionPoolStatus(concurrentPool.id, 1, "EXPIRED").catch((err) => err)
      );

      const results = await Promise.all(attempts);

      // Exactly ONE attempt succeeds and returns the updated pool object
      const successful = results.filter((r) => !(r instanceof Error) && r.status === "EXPIRED");
      const lockedErrors = results.filter((r) => r instanceof Error && r.name === "OptimisticLockError");

      expect(successful.length).toBe(1);
      expect(lockedErrors.length).toBe(19);

      // Final version in database is exactly incremented by 1 (version 2)
      const finalPool = await prisma.pool.findUniqueOrThrow({
        where: { id: concurrentPool.id },
      });
      expect(finalPool.status).toBe("EXPIRED");
      expect(finalPool.version).toBe(2);
    } finally {
      await prisma.pool.delete({ where: { id: concurrentPool.id } });
    }
  });

  it("derives user journey state and enforces invariants on impossible combinations", async () => {
    const { deriveJourneyState, InvalidStateCombinationError } = await import("../lib/pool-engine");

    // Valid state derivations
    expect(deriveJourneyState({})).toBe("IDLE");
    expect(deriveJourneyState({ rideRequest: { status: "SEARCHING" } })).toBe("SEARCHING");
    expect(deriveJourneyState({ rideRequest: { status: "POOLING" }, pool: { status: "FORMING" } })).toBe("FORMING");
    expect(deriveJourneyState({ rideRequest: { status: "WAIT_CAP_EXPIRED" } })).toBe("WAIT_CAP_EXPIRED");
    expect(deriveJourneyState({ rideRequest: { status: "CONFIRMED" } })).toBe("CONFIRMED");
    expect(deriveJourneyState({
      rideRequest: { status: "CONFIRMED" },
      trip: { status: "ASSIGNED" },
    })).toBe("DRIVER_ASSIGNED");
    expect(deriveJourneyState({
      rideRequest: { status: "CONFIRMED" },
      trip: { status: "EN_ROUTE_PICKUP" },
    })).toBe("DRIVER_EN_ROUTE");
    expect(deriveJourneyState({
      rideRequest: { status: "CONFIRMED" },
      trip: { status: "EN_ROUTE_PICKUP", driverAtBayAt: new Date() },
    })).toBe("AT_BAY");
    expect(deriveJourneyState({
      rideRequest: { status: "CONFIRMED" },
      trip: { status: "AT_BAY" },
    })).toBe("AT_BAY");
    expect(deriveJourneyState({
      rideRequest: { status: "CONFIRMED" },
      trip: { status: "IN_TRANSIT" },
    })).toBe("ON_TRIP");
    expect(deriveJourneyState({
      rideRequest: { status: "COMPLETED" },
      trip: { status: "COMPLETED" },
    })).toBe("COMPLETED");

    // Invariant violations (impossible combinations)
    expect(() =>
      deriveJourneyState({
        rideRequest: { status: "SEARCHING" },
        trip: { status: "IN_TRANSIT" },
      })
    ).toThrow(InvalidStateCombinationError);

    expect(() =>
      deriveJourneyState({
        rideRequest: { status: "CANCELLED" },
        trip: { status: "IN_TRANSIT" },
      })
    ).toThrow(InvalidStateCombinationError);

    expect(() =>
      deriveJourneyState({
        rideRequest: { status: "SEARCHING" },
        pool: { status: "COMPLETED" },
      })
    ).toThrow(InvalidStateCombinationError);
  });
});

