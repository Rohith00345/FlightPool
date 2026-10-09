import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { defaultPaymentProvider } from "@/lib/payments/provider";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poolId, userId } = body;

    if (!poolId || !userId) {
      return NextResponse.json(
        { error: "poolId and userId are required" },
        { status: 400 }
      );
    }

    const session = getSessionFromRequest(req);
    if (session && session.role !== "ADMIN" && session.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: Cannot cancel or leave pool for another rider" },
        { status: 403 }
      );
    }

    const member = await prisma.poolMember.findFirst({
      where: { poolId, userId },
      include: {
        pool: {
          include: {
            trip: true,
            members: {
              include: {
                rideRequest: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found in pool" },
        { status: 404 }
      );
    }

    // Safety constraint: rider can leave freely without penalty if trip hasn't started or driver unassigned
    if (member.pool.trip && member.pool.trip.status === "IN_TRANSIT") {
      return NextResponse.json(
        { error: "Trip is already in transit. Cannot leave pool." },
        { status: 400 }
      );
    }

    // 1. Refund any authorized/captured payments
    const payments = await prisma.payment.findMany({
      where: { poolMemberId: member.id, status: { in: ["AUTHORIZED", "CAPTURED"] } },
    });
    for (const p of payments) {
      await defaultPaymentProvider.refund({
        paymentId: p.id,
        reason: "Rider left pool prior to trip start",
      });
      await prisma.payment.update({
        where: { id: p.id },
        data: { status: "REFUNDED" },
      });
    }

    // 2. Remove pool member
    await prisma.poolMember.delete({
      where: { id: member.id },
    });

    // 3. Reset rider's ride request status back to SEARCHING
    await prisma.rideRequest.update({
      where: { id: member.rideRequestId },
      data: { status: "SEARCHING" },
    });

    // 4. Check remaining members
    const remainingMembers = await prisma.poolMember.findMany({
      where: { poolId },
      include: { rideRequest: true },
    });

    let poolStatus = "POOL_UPDATED";
    if (remainingMembers.length < 2) {
      // Pool collapsed
      poolStatus = "POOL_COLLAPSED";
      await prisma.pool.update({
        where: { id: poolId },
        data: { status: "CANCELLED" },
      });

      // Update remaining member to SEARCHING or offer solo
      if (remainingMembers.length === 1) {
        await prisma.rideRequest.update({
          where: { id: remainingMembers[0].rideRequestId },
          data: { status: "SEARCHING" },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Successfully left the pool without penalty.",
      poolStatus,
      remainingCount: remainingMembers.length,
    });
  } catch (error: unknown) {
    console.error("Pool leave error:", error);
    return NextResponse.json(
      { error: "Failed to leave pool", details: String(error) },
      { status: 500 }
    );
  }
}
