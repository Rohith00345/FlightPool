import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MUMBAI_ZONES, AIRPORT_TERMINALS, estimateRoadDistanceKm, estimateDurationMinutes } from "@/lib/geo";
import { calculateSoloFare, getTimeOfDayMultiplier } from "@/lib/pricing";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      flightId,
      destinationZone,
      destinationAddress,
      destinationLat,
      destinationLng,
      luggageCount,
      womenOnly,
      isReady,
    } = body;

    if (!userId || !flightId || !destinationZone) {
      return NextResponse.json(
        { error: "userId, flightId, and destinationZone are required" },
        { status: 400 }
      );
    }

    const session = getSessionFromRequest(req);
    if (session && session.role !== "ADMIN" && session.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: Cannot create ride request for another user" },
        { status: 403 }
      );
    }

    // Verification check for women-only pools
    if (womenOnly) {
      const rider = await prisma.user.findUnique({ where: { id: userId } });
      if (!rider || rider.gender !== "FEMALE" || !rider.genderVerified) {
        return NextResponse.json(
          { error: "Women-only pools are exclusively available to verified female passengers" },
          { status: 400 }
        );
      }
    }

    const flight = await prisma.flight.findUnique({
      where: { id: flightId },
    });

    if (!flight) {
      return NextResponse.json({ error: "Flight not found" }, { status: 404 });
    }

    const zoneInfo = MUMBAI_ZONES[destinationZone] || MUMBAI_ZONES["Thane"];
    const lat = destinationLat ?? zoneInfo.center.lat;
    const lng = destinationLng ?? zoneInfo.center.lng;
    const address = destinationAddress || zoneInfo.popularDropoffs[0];
    const terminalKey = flight.terminal === "T1" ? "T1" : "T2";
    const terminalCoords = AIRPORT_TERMINALS[terminalKey].coords;

    // Calculate estimated distance and duration
    const estDistanceKm = estimateRoadDistanceKm(terminalCoords, { lat, lng });
    const estDurationMin = estimateDurationMinutes(estDistanceKm);
    const soloFare = calculateSoloFare(estDistanceKm, getTimeOfDayMultiplier());
    const estPoolFareMin = Math.round(soloFare * 0.65); // 35% savings estimate
    const estSavings = soloFare - estPoolFareMin;

    // Find if user already has an active request for this flight
    const existing = await prisma.rideRequest.findFirst({
      where: {
        userId,
        flightId,
        status: { in: ["SEARCHING", "POOLING"] },
      },
    });

    let rideRequest;
    const readyTime = isReady ? new Date() : (existing?.readyTime || null);
    const status = isReady ? "POOLING" : (existing?.status || "SEARCHING");

    if (existing) {
      rideRequest = await prisma.rideRequest.update({
        where: { id: existing.id },
        data: {
          destinationZone,
          destinationAddress: address,
          destinationLat: lat,
          destinationLng: lng,
          luggageCount: luggageCount ?? existing.luggageCount,
          womenOnly: womenOnly ?? existing.womenOnly,
          readyTime,
          status,
        },
      });
    } else {
      rideRequest = await prisma.rideRequest.create({
        data: {
          userId,
          flightId,
          destinationZone,
          destinationAddress: address,
          destinationLat: lat,
          destinationLng: lng,
          luggageCount: luggageCount ?? 1,
          womenOnly: womenOnly ?? false,
          readyTime,
          status,
        },
      });
    }

    return NextResponse.json({
      success: true,
      rideRequest: {
        id: rideRequest.id,
        status: rideRequest.status,
        readyTime: rideRequest.readyTime,
        destinationZone: rideRequest.destinationZone,
        destinationAddress: rideRequest.destinationAddress,
        luggageCount: rideRequest.luggageCount,
        womenOnly: rideRequest.womenOnly,
      },
      estimates: {
        distanceKm: estDistanceKm,
        durationMinutes: estDurationMin,
        soloFare,
        estimatedPoolFare: estPoolFareMin,
        estimatedSavings: estSavings,
        savingsPct: 35,
      },
    });
  } catch (error: unknown) {
    console.error("Ride request error:", error);
    return NextResponse.json(
      { error: "Failed to create/update ride request", details: String(error) },
      { status: 500 }
    );
  }
}
