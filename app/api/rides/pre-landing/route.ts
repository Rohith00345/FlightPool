import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { MUMBAI_ZONES, AIRPORT_TERMINALS, estimateRoadDistanceKm, estimateDurationMinutes } from "../../../../lib/geo";
import { calculateSoloFare, getTimeOfDayMultiplier } from "../../../../lib/pricing";
import { getSessionFromRequest } from "../../../../lib/auth";

/**
 * Phase 2: In-Flight Wi-Fi Pre-Landing Booking Queue
 * Allows airborne passengers to reserve shared cab matching before touchdown.
 * Status: QUEUED_IN_FLIGHT (not dispatched to active drivers until touchdown).
 */

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
      luggageCount = 1,
      womenOnly = false,
      pnr,
      seatNumber,
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
        { error: "Forbidden: Cannot pre-queue ride request for another user" },
        { status: 403 }
      );
    }

    // Verify women-only pool eligibility
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

    // Upfront pricing and duration metrics
    const estDistanceKm = estimateRoadDistanceKm(terminalCoords, { lat, lng });
    const estDurationMin = estimateDurationMinutes(estDistanceKm);
    const soloFare = calculateSoloFare(estDistanceKm, getTimeOfDayMultiplier());
    const estPoolFare = Math.round(soloFare * 0.55); // 45% savings estimate
    const estSavings = soloFare - estPoolFare;

    // Check for existing request for this user and flight
    const existing = await prisma.rideRequest.findFirst({
      where: {
        userId,
        flightId,
        status: { in: ["QUEUED_IN_FLIGHT", "SEARCHING", "POOLING"] },
      },
    });

    let rideRequest;
    if (existing) {
      rideRequest = await prisma.rideRequest.update({
        where: { id: existing.id },
        data: {
          destinationZone,
          destinationAddress: address,
          destinationLat: lat,
          destinationLng: lng,
          luggageCount,
          womenOnly,
          status: "QUEUED_IN_FLIGHT",
          readyAt: null,
          readyTime: null,
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
          luggageCount,
          womenOnly,
          status: "QUEUED_IN_FLIGHT",
          readyAt: null,
          readyTime: null,
        },
      });
    }

    // Update passenger verification with PNR/seat if provided
    if (pnr || seatNumber) {
      const existingVerification = await prisma.passengerVerification.findFirst({
        where: { userId, flightId },
      });
      if (existingVerification) {
        await prisma.passengerVerification.update({
          where: { id: existingVerification.id },
          data: {
            pnr: pnr || existingVerification.pnr,
            seatNumber: seatNumber || existingVerification.seatNumber,
          },
        });
      }
    }

    // Count other in-flight co-passengers queued for this flight
    const queuedCoRidersCount = await prisma.rideRequest.count({
      where: {
        flightId,
        status: "QUEUED_IN_FLIGHT",
        id: { not: rideRequest.id },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Queued for in-flight pooling upon arrival at BOM",
      rideRequest: {
        ...rideRequest,
        soloFare,
        estimatedPoolFare: estPoolFare,
        estimatedSavings: estSavings,
        estDurationMin,
      },
      queuedCoRidersCount,
      flight: {
        flightNumber: flight.flightNumber,
        airline: flight.airline,
        origin: flight.origin,
        terminal: flight.terminal,
        status: flight.status,
      },
    });
  } catch (error) {
    console.error("In-flight pre-landing booking error:", error);
    return NextResponse.json(
      { error: "Internal server error creating pre-landing queue request" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId parameter required" }, { status: 400 });
    }

    const session = getSessionFromRequest(req);
    if (session && session.role !== "ADMIN" && session.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: Cannot view queue status for another rider" },
        { status: 403 }
      );
    }

    const queuedRequest = await prisma.rideRequest.findFirst({
      where: {
        userId,
        status: "QUEUED_IN_FLIGHT",
      },
      include: {
        flight: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!queuedRequest) {
      return NextResponse.json({ hasQueuedRequest: false });
    }

    const coRidersCount = await prisma.rideRequest.count({
      where: {
        flightId: queuedRequest.flightId,
        status: "QUEUED_IN_FLIGHT",
        id: { not: queuedRequest.id },
      },
    });

    const isFlightLanded =
      queuedRequest.flight.status === "LANDED" || queuedRequest.flight.status === "ARRIVED";

    return NextResponse.json({
      hasQueuedRequest: true,
      rideRequest: queuedRequest,
      coRidersCount,
      isFlightLanded,
      canConfirmTouchdown: true,
    });
  } catch (error) {
    console.error("Fetch pre-landing status error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching pre-landing status" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestId, action } = body;

    if (!requestId || !action) {
      return NextResponse.json({ error: "requestId and action are required" }, { status: 400 });
    }

    const request = await prisma.rideRequest.findUnique({
      where: { id: requestId },
      include: { flight: true },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const session = getSessionFromRequest(req);
    if (session && session.role !== "ADMIN" && session.userId !== request.userId) {
      return NextResponse.json(
        { error: "Forbidden: Cannot modify request for another rider" },
        { status: 403 }
      );
    }

    if (action === "TOUCHDOWN_CONFIRMED") {
      // Transition from in-flight queue to active pooling
      const updated = await prisma.rideRequest.update({
        where: { id: requestId },
        data: {
          status: "POOLING",
          readyAt: new Date(),
          readyTime: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        status: "POOLING",
        message: "Touchdown confirmed! Request transitioned to active airport pooling.",
        rideRequest: updated,
      });
    }

    if (action === "CANCEL") {
      const updated = await prisma.rideRequest.update({
        where: { id: requestId },
        data: {
          status: "CANCELLED",
        },
      });

      return NextResponse.json({
        success: true,
        status: "CANCELLED",
        message: "In-flight pre-booking cancelled with zero penalty.",
        rideRequest: updated,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Update pre-landing status error:", error);
    return NextResponse.json(
      { error: "Internal server error updating pre-landing request" },
      { status: 500 }
    );
  }
}
