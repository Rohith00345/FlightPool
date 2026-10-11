import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { auditNightRideSafety } from "../../../../lib/safety/emergency-contacts";

export const dynamic = "force-dynamic";

/**
 * POST /api/rides/safety-check
 * Evaluates night ride safety window, checks registered emergency contacts,
 * and generates live tracking dispatch notifications for trusted family/contacts.
 */
export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { tripId, simulatedHour } = body;

    // Optional simulated time for testing/demo night rides
    let currentTime: Date | undefined = undefined;
    if (typeof simulatedHour === "number") {
      const d = new Date();
      // Set UTC hours so that in Asia/Kolkata (+5:30) it resolves to simulatedHour
      // UTC = IST - 5.5 hours
      const istOffsetMinutes = 330;
      const targetUtcMinutes = simulatedHour * 60 - istOffsetMinutes;
      d.setUTCHours(Math.floor(targetUtcMinutes / 60), (targetUtcMinutes % 60 + 60) % 60, 0, 0);
      currentTime = d;
    }

    // Lookup trip details if provided, or fallback to sensible defaults
    let tripDetails = {
      originTerminal: "T2",
      corridor: "Thane",
      driverName: "Commercial FlightPool Driver",
      vehiclePlate: "MH-02-CP-8899",
      shareToken: `token_${Date.now()}`,
    };

    if (tripId) {
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        include: {
          driver: { include: { vehicle: true } },
          pool: {
            include: {
              members: {
                include: {
                  rideRequest: { include: { flight: true } },
                },
              },
            },
          },
          shareTokens: { take: 1 },
        },
      });

      if (trip) {
        const member = trip.pool.members.find((m) => m.userId === session.userId);
        tripDetails = {
          originTerminal: member?.rideRequest?.flight?.terminal || "T2",
          corridor: trip.pool.corridor || "Mumbai Central",
          driverName: trip.driver?.name || "Assigned Driver",
          vehiclePlate: trip.driver?.vehicle?.licensePlate || "MH-02-CP-0000",
          shareToken: trip.shareTokens[0]?.token || `token_${trip.id}`,
        };
      }
    }

    const audit = auditNightRideSafety({
      userId: session.userId,
      riderName: session.name || "Aviation Passenger",
      originTerminal: tripDetails.originTerminal,
      corridor: tripDetails.corridor,
      driverName: tripDetails.driverName,
      vehiclePlate: tripDetails.vehiclePlate,
      shareToken: tripDetails.shareToken,
      currentTime,
    });

    return NextResponse.json({
      success: true,
      userId: session.userId,
      audit,
    });
  } catch (error) {
    console.error("Safety check error:", error);
    return NextResponse.json(
      { error: "Internal server error performing safety audit" },
      { status: 500 }
    );
  }
}
