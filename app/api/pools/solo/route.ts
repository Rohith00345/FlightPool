import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AIRPORT_TERMINALS, estimateRoadDistanceKm, estimateDurationMinutes } from "@/lib/geo";
import { calculateSoloFare, getTimeOfDayMultiplier } from "@/lib/pricing";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, rideRequestId, action } = body;

    if (!userId || !rideRequestId) {
      return NextResponse.json(
        { error: "userId and rideRequestId are required" },
        { status: 400 }
      );
    }

    const session = getSessionFromRequest(req);
    if (session && session.role !== "ADMIN" && session.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: Cannot trigger solo fallback for another rider" },
        { status: 403 }
      );
    }

    const request = await prisma.rideRequest.findUnique({
      where: { id: rideRequestId },
      include: { flight: true },
    });

    if (!request) {
      return NextResponse.json({ error: "Ride request not found" }, { status: 404 });
    }

    if (request.userId !== userId && (!session || session.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Forbidden: Ride request belongs to another user" },
        { status: 403 }
      );
    }

    if (request.status === "COMPLETED" || request.status === "CANCELLED") {
      return NextResponse.json(
        { error: `Cannot trigger solo fallback from terminal status '${request.status}'` },
        { status: 400 }
      );
    }

    if (action === "KEEP_WAITING") {
      // Extend wait time by setting readyTime to now
      await prisma.rideRequest.update({
        where: { id: rideRequestId },
        data: {
          readyTime: new Date(),
          status: "POOLING",
        },
      });

      return NextResponse.json({
        success: true,
        action: "KEEP_WAITING",
        message: "Wait window extended by 15 minutes. Searching for matching riders.",
      });
    }

    // Action is GO_SOLO
    const terminalKey = request.flight.terminal === "T1" ? "T1" : "T2";
    const terminalCoords = AIRPORT_TERMINALS[terminalKey].coords;
    const destCoords = { lat: request.destinationLat, lng: request.destinationLng };
    const distanceKm = estimateRoadDistanceKm(terminalCoords, destCoords);
    const durationMin = estimateDurationMinutes(distanceKm);
    const soloFare = calculateSoloFare(distanceKm, getTimeOfDayMultiplier());

    // Find available driver
    const driver = await prisma.driver.findFirst({
      where: { isAvailable: true },
      include: { vehicle: true },
    });

    if (!driver || !driver.vehicle) {
      return NextResponse.json(
        { error: "No available driver at terminal. Please try in 2 minutes." },
        { status: 503 }
      );
    }

    // Create a solo pool/trip
    const soloPool = await prisma.pool.create({
      data: {
        targetFlightId: request.flightId,
        destinationCluster: request.destinationZone,
        terminal: request.flight.terminal,
        status: "CONFIRMED",
        vehicleId: driver.vehicle.id,
        driverId: driver.id,
      },
    });

    await prisma.poolMember.create({
      data: {
        poolId: soloPool.id,
        rideRequestId: request.id,
        userId,
        pickupOrder: 1,
        dropoffOrder: 1,
        soloFare,
        poolFare: soloFare,
        savingsPct: 0,
        detourMinutes: 0,
        status: "CONFIRMED",
      },
    });

    const platformFee = Math.round(soloFare * 0.15);
    const driverPayout = soloFare - platformFee;

    const trip = await prisma.trip.create({
      data: {
        poolId: soloPool.id,
        driverId: driver.id,
        vehicleId: driver.vehicle.id,
        status: "ASSIGNED",
        otpCode: Math.floor(1000 + Math.random() * 9000).toString(),
        totalFare: soloFare,
        driverPayout,
        platformFee,
        totalDistanceKm: distanceKm,
        totalDurationMin: durationMin,
      },
    });

    await prisma.rideRequest.update({
      where: { id: request.id },
      data: { status: "SOLO" },
    });

    return NextResponse.json({
      success: true,
      action: "GO_SOLO",
      trip: {
        id: trip.id,
        status: trip.status,
        otpCode: trip.otpCode,
        soloFare,
        driver: {
          name: driver.name,
          phone: driver.phone,
          rating: driver.rating,
        },
        vehicle: {
          make: driver.vehicle.make,
          model: driver.vehicle.model,
          licensePlate: driver.vehicle.licensePlate,
          color: driver.vehicle.color,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Solo ride error:", error);
    return NextResponse.json(
      { error: "Failed to switch to solo ride", details: String(error) },
      { status: 500 }
    );
  }
}
