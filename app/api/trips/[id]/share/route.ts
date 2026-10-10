import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getSessionFromRequest(req);

    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        pool: { include: { members: true } },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const isMember = trip.pool.members.some((m) => m.userId === session.userId);
    const isAdmin = session.role === "ADMIN";

    if (!isMember && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only trip riders can generate share links" },
        { status: 403 }
      );
    }

    // Generate cryptographic token valid for 24 hours
    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const shareRecord = await prisma.shareTripToken.create({
      data: {
        tripId: trip.id,
        token,
        expiresAt,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareUrl = `${appUrl}/trip/share/${token}`;

    return NextResponse.json({
      success: true,
      token: shareRecord.token,
      shareUrl,
      expiresAt: shareRecord.expiresAt,
    });
  } catch (error: unknown) {
    console.error("Share token generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate share link", details: String(error) },
      { status: 500 }
    );
  }
}
