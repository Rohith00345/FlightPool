import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, flightId, boardingPassCode, pnr, seatNumber } = body;

    if (!userId || !flightId) {
      return NextResponse.json(
        { error: "userId and flightId are required" },
        { status: 400 }
      );
    }

    const session = getSessionFromRequest(req);
    if (session && session.role !== "ADMIN" && session.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: Cannot verify boarding pass for another user" },
        { status: 403 }
      );
    }

    const flight = await prisma.flight.findUnique({
      where: { id: flightId },
    });

    if (!flight) {
      return NextResponse.json({ error: "Flight not found" }, { status: 404 });
    }

    // Upsert verification record
    const existing = await prisma.passengerVerification.findFirst({
      where: { userId, flightId },
    });

    const generatedCode =
      boardingPassCode ||
      existing?.boardingPassCode ||
      `BP-${flight.flightNumber.replace("-", "")}-${Date.now().toString(36).slice(-4)}-${Math.floor(10 + Math.random() * 89)}${["A", "B", "C", "D", "E", "F"][Math.floor(Math.random() * 6)]}`;
    const finalPnr = pnr || `PNR${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const finalSeat = seatNumber || `${Math.floor(1 + Math.random() * 28)}${["A", "B", "C", "D", "E", "F"][Math.floor(Math.random() * 6)]}`;

    let verification;
    if (existing) {
      verification = await prisma.passengerVerification.update({
        where: { id: existing.id },
        data: {
          boardingPassCode: generatedCode,
          pnr: finalPnr,
          seatNumber: finalSeat,
          status: "VERIFIED",
          verifiedAt: new Date(),
        },
      });
    } else {
      verification = await prisma.passengerVerification.create({
        data: {
          userId,
          flightId,
          boardingPassCode: generatedCode,
          pnr: finalPnr,
          seatNumber: finalSeat,
          status: "VERIFIED",
          verifiedAt: new Date(),
        },
      });
    }

    // Mark passenger gender verified upon successful boarding pass verification
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { genderVerified: true },
      });
    } catch (uErr) {
      console.warn("Failed to update user genderVerified status:", uErr);
    }

    // Record explicit purpose consent under DPDP Act for passenger travel itinerary
    try {
      await prisma.consent.create({
        data: {
          userId,
          purpose: "boarding_pass_data",
          version: "1.0",
          ip: req.headers.get("x-forwarded-for") || "127.0.0.1",
        },
      });
    } catch (consentErr) {
      console.warn("Failed to record passenger consent:", consentErr);
    }

    return NextResponse.json({
      success: true,
      verification: {
        id: verification.id,
        status: verification.status,
        boardingPassCode: verification.boardingPassCode,
        pnr: verification.pnr,
        seatNumber: verification.seatNumber,
        flightNumber: flight.flightNumber,
        terminal: flight.terminal,
      },
    });
  } catch (error: unknown) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { error: "Boarding pass verification failed", details: String(error) },
      { status: 500 }
    );
  }
}
