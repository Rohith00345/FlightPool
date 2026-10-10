import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchRiderRequests, RiderRequest } from "@/lib/matching";
import { calculatePoolPricing } from "@/lib/pricing";
import { getSessionFromRequest } from "@/lib/auth";

const matchRateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const cronHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCron = Boolean(cronSecret && cronHeader === `Bearer ${cronSecret}`);

    if (!session && !isCron) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isCron && session && !["RIDER", "MARSHAL", "ADMIN"].includes(session.role)) {
      return NextResponse.json(
        { error: "Forbidden: Rider, Marshal, or Admin role required." },
        { status: 403 }
      );
    }

    // Rate limiting (max 10 calls / 60 seconds per user)
    const rateLimitKey = session ? session.userId : "cron";
    const now = Date.now();
    const rateData = matchRateLimitMap.get(rateLimitKey);
    if (rateData && now < rateData.resetAt) {
      if (rateData.count >= 10) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please wait before triggering pool matching again." },
          { status: 429 }
        );
      }
      rateData.count++;
    } else {
      matchRateLimitMap.set(rateLimitKey, { count: 1, resetAt: now + 60000 });
    }

    const body = await req.json();
    const { flightId, terminal } = body;

    const whereClause: {
      status: { in: string[] };
      flightId?: string;
      flight?: { terminal: string };
      poolMembers: { none: { pool: { status: { not: string } } } };
    } = {
      status: { in: ["SEARCHING", "POOLING"] },
      poolMembers: {
        none: {
          pool: {
            status: { not: "CANCELLED" },
          },
        },
      },
    };

    if (flightId) {
      whereClause.flightId = flightId;
    }
    if (terminal) {
      whereClause.flight = { terminal };
    }

    const unassignedRequests = await prisma.rideRequest.findMany({
      where: whereClause,
      include: {
        user: true,
        flight: true,
      },
    });

    if (unassignedRequests.length === 0) {
      return NextResponse.json({
        message: "No unassigned requests to match",
        formedPoolsCount: 0,
      });
    }

    const riderRequests: RiderRequest[] = unassignedRequests.map((r) => ({
      id: r.id,
      userId: r.user.id,
      userName: r.user.name,
      flightId: r.flight.id,
      flightNumber: r.flight.flightNumber,
      flightArrivalTime: r.flight.arrivalTime,
      terminal: r.flight.terminal as "T1" | "T2",
      destinationZone: r.destinationZone,
      destinationAddress: r.destinationAddress,
      destinationCoords: { lat: r.destinationLat, lng: r.destinationLng },
      luggageCount: r.luggageCount,
      womenOnly: r.womenOnly,
      gender: r.user.gender,
      readyTime: r.readyTime,
      status: r.status,
    }));

    const matchResult = matchRiderRequests(riderRequests, new Date(), {
      maxRidersPerVehicle: 3,
      maxLuggageCapacity: 4,
      maxDetourMinutes: 20,
      maxWaitMinutes: 20,
      flightWindowMinutes: 30,
    });

    const drivers = await prisma.driver.findMany({
      where: { isAvailable: true },
      include: { vehicle: true },
    });

    const createdPoolIds: string[] = [];

    for (let i = 0; i < matchResult.matchedPools.length; i++) {
      const matched = matchResult.matchedPools[i];
      const assignedDriver = drivers[i % drivers.length];
      const vehicleId = assignedDriver?.vehicleId || null;

      // Create Pool in database
      const pool = await prisma.pool.create({
        data: {
          targetFlightId: flightId || null,
          destinationCluster: matched.destinationCluster,
          terminal: matched.terminal,
          status: "FORMING",
          maxDetourMinutes: 20,
          waitCapExpiry: matched.waitCapExpiry,
          vehicleId,
          driverId: assignedDriver?.id || null,
        },
      });
      createdPoolIds.push(pool.id);

      // Calculate pricing
      const pricing = calculatePoolPricing(
        matched.stops.map((s) => ({
          riderId: s.riderId,
          soloDistanceKm: s.soloDistanceKm,
        })),
        matched.totalRouteKm
      );

      // Create PoolMember records
      for (let sIdx = 0; sIdx < matched.stops.length; sIdx++) {
        const stop = matched.stops[sIdx];
        const share = pricing.riderShares[sIdx];

        await prisma.poolMember.create({
          data: {
            poolId: pool.id,
            rideRequestId: stop.riderId,
            userId: stop.userId,
            pickupOrder: 1,
            dropoffOrder: stop.dropoffOrder,
            soloFare: share.soloFare,
            poolFare: share.poolFare,
            savingsPct: share.savingsPct,
            detourMinutes: stop.detourMinutes,
            status: "WAITING",
          },
        });

        // Update request status
        await prisma.rideRequest.update({
          where: { id: stop.riderId },
          data: { status: "POOLING" },
        });
      }
    }

    return NextResponse.json({
      success: true,
      formedPoolsCount: matchResult.matchedPools.length,
      createdPoolIds,
      unmatchedCount: matchResult.unmatchedRequests.length,
      waitCapExpiredCount: matchResult.waitCapExpiredRequests.length,
    });
  } catch (error: unknown) {
    console.error("Match error:", error);
    return NextResponse.json(
      { error: "Matching run failed", details: String(error) },
      { status: 500 }
    );
  }
}
