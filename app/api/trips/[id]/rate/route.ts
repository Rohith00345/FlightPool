import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { raterUserId, ratedUserIdOrDriverId, score, tags, comment } = body;

    if (!raterUserId || !score) {
      return NextResponse.json(
        { error: "raterUserId and score are required" },
        { status: 400 }
      );
    }

    const session = getSessionFromRequest(req);
    if (session && session.role !== "ADMIN" && session.userId !== raterUserId) {
      return NextResponse.json(
        { error: "Forbidden: Cannot submit rating on behalf of another user" },
        { status: 403 }
      );
    }

    const trip = await prisma.trip.findUnique({
      where: { id },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    let targetId = ratedUserIdOrDriverId;
    if (targetId) {
      const validTarget = await prisma.user.findUnique({ where: { id: targetId } });
      if (!validTarget) {
        targetId = raterUserId;
      }
    } else {
      targetId = raterUserId;
    }

    const rating = await prisma.rating.create({
      data: {
        tripId: trip.id,
        raterUserId,
        ratedUserIdOrDriverId: targetId,
        score: Math.min(5, Math.max(1, score)),
        tags: Array.isArray(tags) ? tags.join(",") : (tags || ""),
        comment: comment || null,
      },
    });

    if (trip.driverId) {
      const driverRatings = await prisma.rating.findMany({
        where: { trip: { driverId: trip.driverId } },
        select: { score: true },
      });
      if (driverRatings.length > 0) {
        const avg = driverRatings.reduce((sum, r) => sum + r.score, 0) / driverRatings.length;
        await prisma.driver.update({
          where: { id: trip.driverId },
          data: { rating: Math.round(avg * 10) / 10 },
        });
      }
    }

    return NextResponse.json({
      success: true,
      rating: {
        id: rating.id,
        score: rating.score,
        tags: rating.tags,
        comment: rating.comment,
      },
    });
  } catch (error: unknown) {
    console.error("Rating error:", error);
    return NextResponse.json(
      { error: "Failed to submit rating", details: String(error) },
      { status: 500 }
    );
  }
}
