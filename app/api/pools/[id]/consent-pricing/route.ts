import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

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

    const body = await req.json();
    const { fareQuoteId, accepted } = body;

    if (!fareQuoteId || typeof accepted !== "boolean") {
      return NextResponse.json(
        { error: "fareQuoteId and accepted (boolean) are required." },
        { status: 400 }
      );
    }

    const quote = await prisma.fareQuote.findUnique({
      where: { id: fareQuoteId },
    });

    if (!quote || quote.userId !== session.userId) {
      return NextResponse.json(
        { error: "Fare quote not found or does not belong to you." },
        { status: 404 }
      );
    }

    if (quote.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This fare quote has expired. Please request a refreshed quote." },
        { status: 410 }
      );
    }

    if (!accepted) {
      // Rider declined updated fare -> Transition rider to solo fallback or leave pool
      await prisma.fareQuote.update({
        where: { id: quote.id },
        data: { status: "EXPIRED" },
      });

      return NextResponse.json({
        success: true,
        accepted: false,
        message: "You have declined the updated fare. Switching to solo fallback options.",
      });
    }

    // Accept updated fare
    await prisma.fareQuote.update({
      where: { id: quote.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });

    // Update pool member fare
    if (quote.rideRequestId) {
      const member = await prisma.poolMember.findFirst({
        where: {
          poolId,
          rideRequestId: quote.rideRequestId,
        },
      });

      if (member) {
        await prisma.poolMember.update({
          where: { id: member.id },
          data: {
            poolFare: quote.poolFarePaise / 100,
            soloFare: quote.soloFarePaise / 100,
            savingsPct: quote.minSavingPct,
          },
        });
      }
    }

    // Record explicit consent record
    await prisma.consent.create({
      data: {
        userId: session.userId,
        purpose: `pricing_repricing_quote_${quote.id}`,
        version: "1.0",
      },
    });

    return NextResponse.json({
      success: true,
      accepted: true,
      farePaise: quote.poolFarePaise,
      message: "Updated fare consented and locked in.",
    });
  } catch (error: unknown) {
    console.error("Pricing consent error:", error);
    return NextResponse.json(
      { error: "Failed to record pricing consent", details: String(error) },
      { status: 500 }
    );
  }
}
