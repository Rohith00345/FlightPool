import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const trip = await prisma.trip.findUnique({
      where: { id },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const targetId = ratedUserIdOrDriverId || trip.driverId;

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
