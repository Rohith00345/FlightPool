import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchRiderRequests, RiderRequest } from "@/lib/matching";
import { calculatePoolPricing } from "@/lib/pricing";
import { requireRole } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ["ADMIN"]);
  if (auth.response) {
    return auth.response;
  }

  if (!isDemoMode()) {
    return NextResponse.json(
      { error: "Forbidden", message: "Flight simulation is only permitted when DEMO_MODE=true" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { flightNumber } = body;

    // Find the requested flight or first scheduled flight
    let flight = await prisma.flight.findFirst({
      where: flightNumber ? { flightNumber } : { status: { not: "LANDED" } },
      include: {
        rideRequests: {
          include: { user: true },
        },
      },
    });

    if (!flight) {
      flight = await prisma.flight.findFirst({
        include: {
          rideRequests: {
            include: { user: true },
          },
        },
      });
    }

    if (!flight) {
      return NextResponse.json({ error: "No flights found to simulate" }, { status: 404 });
    }

    const normalizedTerminal: "T1" | "T2" = flight.terminal === "T1" ? "T1" : "T2";

    // B2: Idempotency per flight: if flight already has active FORMING or CONFIRMED pools, do not create duplicate pools
    const existingActivePools = await prisma.pool.findMany({
      where: {
        targetFlightId: flight.id,
        status: { in: ["FORMING", "CONFIRMED"] },
      },
      include: {
        members: true,
        driver: true,
        vehicle: true,
      },
    });

    if (existingActivePools.length > 0) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: `Flight ${flight.flightNumber} simulation is idempotent: already active with ${existingActivePools.length} pool(s).`,
        terminal: normalizedTerminal,
        passengersProcessed: existingActivePools.reduce((sum, p) => sum + p.members.length, 0),
        newPoolsFormed: 0,
        activePoolsCount: existingActivePools.length,
      });
    }

    // 1. Mark flight as LANDED
    await prisma.flight.update({
      where: { id: flight.id },
      data: {
        status: "LANDED",
        terminal: normalizedTerminal,
        arrivalTime: new Date(),
      },
    });

    // 2. Mark existing requests on this flight as ready / pooling
    await prisma.rideRequest.updateMany({
      where: { flightId: flight.id },
      data: {
        readyTime: new Date(),
        readyAt: new Date(),
        status: "POOLING",
      },
    });

    // If flight had fewer than 3 requests, add 3 simulated passengers looking for cabs
    const currentCount = await prisma.rideRequest.count({ where: { flightId: flight.id } });
    if (currentCount < 3) {
      const demoNames = [
        { name: "Kunal Shah", zone: "Powai", gender: "MALE", bags: 1 },
        { name: "Smriti Mandhana", zone: "Powai", gender: "FEMALE", bags: 1, womenOnly: true },
        { name: "Rishabh Pant", zone: "Powai", gender: "MALE", bags: 2 },
      ];

      for (const d of demoNames) {
        const u = await prisma.user.create({
          data: {
            name: d.name,
            phone: "+919833" + Math.floor(100000 + Math.random() * 900000),
            gender: d.gender,
            role: "RIDER",
          },
        });

        await prisma.rideRequest.create({
          data: {
            userId: u.id,
            flightId: flight.id,
            destinationZone: d.zone,
            destinationAddress: "Central Avenue, Powai",
            destinationLat: 19.1176,
            destinationLng: 72.9060,
            luggageCount: d.bags,
            womenOnly: !!d.womenOnly,
            readyTime: new Date(),
            readyAt: new Date(),
            status: "POOLING",
          },
        });
      }
    }

    // 3. Run matching engine on all unassigned requests
    const unassigned = await prisma.rideRequest.findMany({
      where: {
        flightId: flight.id,
        poolMembers: { none: {} },
      },
      include: { user: true, flight: true },
    });

    const riderRequests: RiderRequest[] = unassigned.map((r) => ({
      id: r.id,
      userId: r.user.id,
      userName: r.user.name,
      flightId: flight.id,
      flightNumber: flight.flightNumber,
      flightArrivalTime: flight.arrivalTime,
      terminal: normalizedTerminal,
      destinationZone: r.destinationZone,
      destinationAddress: r.destinationAddress,
      destinationCoords: { lat: r.destinationLat, lng: r.destinationLng },
      luggageCount: r.luggageCount,
      womenOnly: r.womenOnly,
      gender: r.user.gender,
      readyTime: r.readyTime,
      readyAt: r.readyAt,
      status: r.status,
    }));

    const matchResult = matchRiderRequests(riderRequests, new Date(), {
      maxRidersPerVehicle: 3,
      maxLuggageCapacity: 4,
      maxDetourMinutes: 20,
      maxWaitMinutes: 20,
      flightWindowMinutes: 30,
    });

    // B2: Prevent one driver being in two overlapping active pools
    // 1. Identify all drivers currently assigned to active pools (FORMING, CONFIRMED, DISPATCHED)
    const occupiedPools = await prisma.pool.findMany({
      where: {
        status: { in: ["FORMING", "CONFIRMED", "DISPATCHED"] },
        driverId: { not: null },
      },
      select: { driverId: true },
    });
    const occupiedDriverIds = new Set(
      occupiedPools.map((p) => p.driverId).filter((id): id is string => Boolean(id))
    );

    // 2. Fetch available drivers excluding anyone already occupied in an active pool
    const availableDrivers = await prisma.driver.findMany({
      where: {
        isAvailable: true,
        id: { notIn: Array.from(occupiedDriverIds) },
      },
      include: { vehicle: true },
    });

    let newPoolsFormed = 0;
    let driverCursor = 0;

    for (let i = 0; i < matchResult.matchedPools.length; i++) {
      const matched = matchResult.matchedPools[i];
      // Allocate each free driver at most once
      const assignedDriver = driverCursor < availableDrivers.length ? availableDrivers[driverCursor++] : null;
      if (assignedDriver) {
        occupiedDriverIds.add(assignedDriver.id);
      }

      const pool = await prisma.pool.create({
        data: {
          targetFlightId: flight.id,
          destinationCluster: matched.destinationCluster,
          terminal: matched.terminal === "T1" ? "T1" : "T2",
          status: "FORMING",
          maxDetourMinutes: 20,
          waitCapExpiry: new Date(Date.now() + 15 * 60 * 1000),
          vehicleId: assignedDriver?.vehicleId || null,
          driverId: assignedDriver?.id || null,
          version: 1,
        },
      });
      newPoolsFormed++;

      const pricing = calculatePoolPricing(
        matched.stops.map((s) => ({
          riderId: s.riderId,
          soloDistanceKm: s.soloDistanceKm,
        })),
        matched.totalRouteKm
      );

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

        await prisma.rideRequest.update({
          where: { id: stop.riderId },
          data: { status: "POOLING" },
        });
      }
    }

    // Persist Audit Log for administrative action
    try {
      await prisma.auditLog.create({
        data: {
          actorId: auth.session?.userId || "admin",
          action: "SIMULATE_FLIGHT",
          entityType: "FLIGHT",
          entityId: flight.id,
          after: JSON.stringify({
            flightNumber: flight.flightNumber,
            terminal: normalizedTerminal,
            passengersMatched: riderRequests.length,
            poolsFormed: newPoolsFormed,
          }),
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return NextResponse.json({
      success: true,
      message: `Flight ${flight.flightNumber} simulated successfully at Terminal ${normalizedTerminal}.`,
      terminal: normalizedTerminal,
      passengersProcessed: riderRequests.length,
      newPoolsFormed,
    });
  } catch (error: unknown) {
    console.error("Flight simulation error:", error);
    return NextResponse.json(
      { error: "Simulation failed", details: String(error) },
      { status: 500 }
    );
  }
}
