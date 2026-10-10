import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { calculatePoolPricing } from "@/lib/pricing";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poolId } = await params;
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        members: {
          include: { rideRequest: true, user: true },
        },
      },
    });

    if (!pool) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }

    const remainingMembers = pool.members.filter((m) => m.status !== "CANCELLED");
    const activeCount = remainingMembers.length;

    const reQuotes = [];

    for (const member of remainingMembers) {
      const riders = [
        { riderId: member.userId, soloDistanceKm: 25 },
        { riderId: "peer_member", soloDistanceKm: 25 },
      ];
      const pricing = calculatePoolPricing(riders, 28);
      const share = pricing.riderShares[0];

      const soloFarePaise = Math.round((share?.soloFare || 350) * 100);
      const poolFarePaise = Math.round((share?.poolFare || 245) * 100);
      const savingsPct = share?.savingsPct || 30.0;

      const quote = await prisma.fareQuote.create({
        data: {
          userId: member.userId,
          rideRequestId: member.rideRequestId,
          destinationZone: pool.destinationCluster || "Bandra",
          soloFarePaise,
          poolFarePaise,
          minSavingPct: savingsPct,
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min lock
        },
      });

      reQuotes.push({
        memberId: member.id,
        userId: member.userId,
        userName: member.user.name,
        quoteId: quote.id,
        poolFarePaise: quote.poolFarePaise,
        soloFarePaise: quote.soloFarePaise,
        savingsPct: quote.minSavingPct,
        expiresAt: quote.expiresAt,
      });
    }

    return NextResponse.json({
      success: true,
      poolId,
      activeMembersCount: activeCount,
      reQuotes,
    });
  } catch (error: unknown) {
    console.error("Pool re-quote error:", error);
    return NextResponse.json(
      { error: "Failed to recalculate pool fares", details: String(error) },
      { status: 500 }
    );
  }
}
