import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { defaultPaymentProvider } from "@/lib/payments/provider";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poolId, userId, paymentMethod } = body;

    if (!poolId || !userId) {
      return NextResponse.json(
        { error: "poolId and userId are required" },
        { status: 400 }
      );
    }

    const session = getSessionFromRequest(req);
    if (session && session.role !== "ADMIN" && session.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: Cannot confirm pool for another rider" },
        { status: 403 }
      );
    }

    const member = await prisma.poolMember.findFirst({
      where: { poolId, userId },
      include: {
        pool: {
          include: {
            members: true,
            vehicle: true,
            driver: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Rider is not a member of this pool" },
        { status: 404 }
      );
    }

    // 1. Authorize mock payment using payment provider with idempotency key
    const idempotencyKey = `idem_auth_${poolId}_${userId}_${member.poolFare}`;
    const paymentIntent = await defaultPaymentProvider.authorize({
      amount: member.poolFare,
      currency: "INR",
      userId,
      poolMemberId: member.id,
      idempotencyKey,
      paymentMethod: paymentMethod || "UPI",
      metadata: { poolId, fare: member.poolFare, savings: member.savingsPct },
    });

    // 2. Upsert payment record in database
    await prisma.payment.upsert({
      where: { idempotencyKey },
      update: {
        status: "AUTHORIZED",
        amount: member.poolFare,
        transactionRef: paymentIntent.transactionRef,
      },
      create: {
        userId,
        poolMemberId: member.id,
        amount: member.poolFare,
        currency: "INR",
        status: "AUTHORIZED",
        provider: "RAZORPAY_MOCK",
        idempotencyKey,
        paymentMethod: paymentMethod || "UPI",
        transactionRef: paymentIntent.transactionRef,
      },
    });

    // 3. Update member status to CONFIRMED
    await prisma.poolMember.update({
      where: { id: member.id },
      data: { status: "CONFIRMED" },
    });

    // Check if all members in the pool are now confirmed (or at least 2)
    const updatedMembers = await prisma.poolMember.findMany({
      where: { poolId },
    });
    const confirmedCount = updatedMembers.filter((m) => m.status === "CONFIRMED").length;

    let trip = null;
    if (confirmedCount === updatedMembers.length || confirmedCount >= 2) {
      // Mark pool as confirmed
      await prisma.pool.update({
        where: { id: poolId },
        data: { status: "CONFIRMED" },
      });

      // Update all confirmed ride requests
      await prisma.rideRequest.updateMany({
        where: { id: { in: updatedMembers.map((m) => m.rideRequestId) } },
        data: { status: "CONFIRMED" },
      });

      // Create or fetch Trip
      const existingTrip = await prisma.trip.findUnique({
        where: { poolId },
      });

      if (!existingTrip && member.pool.driverId && member.pool.vehicleId) {
        const totalFare = updatedMembers.reduce((s, m) => s + m.poolFare, 0);
        const platformFee = Math.round(totalFare * 0.15);
        const driverPayout = totalFare - platformFee;
        const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

        trip = await prisma.trip.create({
          data: {
            poolId,
            driverId: member.pool.driverId,
            vehicleId: member.pool.vehicleId,
            status: "ASSIGNED",
            otpCode,
            totalFare,
            driverPayout,
            platformFee,
            totalDistanceKm: 24,
            totalDurationMin: 45,
          },
        });
      } else {
        trip = existingTrip;
      }
    }

    return NextResponse.json({
      success: true,
      poolStatus: confirmedCount >= 2 ? "CONFIRMED" : "WAITING_FOR_OTHERS",
      payment: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        transactionRef: paymentIntent.transactionRef,
      },
      trip: trip
        ? {
            id: trip.id,
            status: trip.status,
            otpCode: trip.otpCode,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error("Pool confirm error:", error);
    return NextResponse.json(
      { error: "Failed to confirm pool", details: String(error) },
      { status: 500 }
    );
  }
}
