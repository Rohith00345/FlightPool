import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { defaultPaymentProvider } from "@/lib/payments/provider";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        driver: true,
        vehicle: true,
        pool: {
          include: {
            members: {
              include: {
                user: true,
                rideRequest: true,
              },
              orderBy: {
                dropoffOrder: "asc",
              },
            },
          },
        },
        payments: true,
        incidents: true,
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json({
      trip: {
        id: trip.id,
        status: trip.status,
        otpCode: trip.otpCode,
        totalFare: trip.totalFare,
        driverPayout: trip.driverPayout,
        platformFee: trip.platformFee,
        totalDistanceKm: trip.totalDistanceKm,
        totalDurationMin: trip.totalDurationMin,
        startTime: trip.startTime,
        endTime: trip.endTime,
        driver: {
          id: trip.driver.id,
          name: trip.driver.name,
          phone: trip.driver.phone,
          rating: trip.driver.rating,
        },
        vehicle: {
          make: trip.vehicle.make,
          model: trip.vehicle.model,
          licensePlate: trip.vehicle.licensePlate,
          color: trip.vehicle.color,
          type: trip.vehicle.type,
        },
        stops: trip.pool.members.map((m) => ({
          memberId: m.id,
          riderName: m.user.name,
          destinationZone: m.rideRequest.destinationZone,
          destinationAddress: m.rideRequest.destinationAddress,
          dropoffOrder: m.dropoffOrder,
          poolFare: m.poolFare,
          status: m.status,
        })),
        payments: trip.payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          status: p.status,
          method: p.paymentMethod,
        })),
        incidents: trip.incidents,
      },
    });
  } catch (error: unknown) {
    console.error("Trip GET error:", error);
    return NextResponse.json(
      { error: "Failed to get trip", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, action } = body;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        pool: {
          include: {
            members: {
              include: {
                payments: true,
              },
            },
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    let nextStatus = status;
    if (action === "START_PICKUP") nextStatus = "EN_ROUTE_PICKUP";
    if (action === "START_TRIP") nextStatus = "IN_TRANSIT";
    if (action === "COMPLETE_TRIP") nextStatus = "COMPLETED";

    const updateData: {
      status?: string;
      startTime?: Date;
      endTime?: Date;
    } = { status: nextStatus };

    if (nextStatus === "IN_TRANSIT" && !trip.startTime) {
      updateData.startTime = new Date();
    }

    if (nextStatus === "COMPLETED") {
      updateData.endTime = new Date();

      // Capture all authorized payments
      for (const member of trip.pool.members) {
        for (const payment of member.payments) {
          if (payment.status === "AUTHORIZED") {
            await defaultPaymentProvider.capture({
              paymentId: payment.id,
              amount: payment.amount,
            });
            await prisma.payment.update({
              where: { id: payment.id },
              data: { status: "CAPTURED" },
            });
          }
        }
        await prisma.poolMember.update({
          where: { id: member.id },
          data: { status: "DROPPED_OFF" },
        });
        await prisma.rideRequest.update({
          where: { id: member.rideRequestId },
          data: { status: "COMPLETED" },
        });
      }

      await prisma.pool.update({
        where: { id: trip.poolId },
        data: { status: "COMPLETED" },
      });
    }

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      trip: {
        id: updatedTrip.id,
        status: updatedTrip.status,
      },
    });
  } catch (error: unknown) {
    console.error("Trip PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update trip", details: String(error) },
      { status: 500 }
    );
  }
}
