import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { generateTripReceipt } from "../../../../../lib/invoice";
import { rupeesToPaise } from "../../../../../lib/pricing";

export const dynamic = "force-dynamic";

/**
 * GET /api/trips/[id]/receipt
 * Generates an official GST tax invoice receipt for a trip.
 * Strictly protected against cross-user IDOR access.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const { id: tripId } = await params;
    if (!tripId) {
      return NextResponse.json({ error: "Trip ID is required" }, { status: 400 });
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        pool: {
          include: {
            members: {
              include: {
                rideRequest: {
                  include: {
                    user: true,
                    flight: true,
                  },
                },
              },
            },
          },
        },
        driver: {
          include: {
            vehicle: true,
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Identify current user's membership on this trip
    const userMember = trip.pool.members.find((m) => m.userId === session.userId);
    const isDriver = trip.driverId === session.userId;
    const isAdmin = session.role === "ADMIN";

    if (!userMember && !isDriver && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view this receipt" },
        { status: 403 }
      );
    }

    // Determine target passenger details for invoice
    const targetMember = userMember || trip.pool.members[0];
    const passengerName = targetMember?.rideRequest?.user?.name || session.name || "Aviation Passenger";
    const dropoffAddress = targetMember?.rideRequest?.destinationAddress || targetMember?.rideRequest?.destinationZone || "Mumbai";
    const terminal = targetMember?.rideRequest?.flight?.terminal || "T2";
    const pickupLocation = `CSMIA Terminal ${terminal}, Sahar, Andheri East`;

    const fareRupees = targetMember?.poolFare || 350;
    const totalPaidPaise = rupeesToPaise(fareRupees);

    const receipt = generateTripReceipt({
      tripId: trip.id,
      completedAt: trip.endTime || trip.createdAt,
      passengerName,
      pickupLocation,
      dropoffLocation: dropoffAddress,
      corridor: trip.pool.corridor || targetMember?.rideRequest?.destinationZone || "Thane",
      driverName: trip.driver?.name || "Assigned Commercial Driver",
      vehiclePlate: trip.driver?.vehicle?.licensePlate || "MH-02-CP-8899",
      coRidersCount: trip.pool.members.length,
      totalPaidPaise,
      convenienceFeePaise: 2500, // ₹25 platform fee
    });

    return NextResponse.json({
      success: true,
      receipt,
    });
  } catch (error) {
    console.error("Receipt generation error:", error);
    return NextResponse.json(
      { error: "Internal server error generating trip receipt" },
      { status: 500 }
    );
  }
}
