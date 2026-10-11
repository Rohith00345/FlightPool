import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { validatePromoCode } from "../../../../lib/pricing/promo";

export const dynamic = "force-dynamic";

/**
 * POST /api/promos/validate
 * Validates a promo coupon code against a quoted fare for the current rider.
 */
export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { code, fareRupees, destinationZone } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Promo code string is required." }, { status: 400 });
    }

    if (typeof fareRupees !== "number" || fareRupees <= 0) {
      return NextResponse.json({ error: "Valid numeric fareRupees is required." }, { status: 400 });
    }

    // Query user's prior completed rides to verify first-ride eligibility
    const completedRidesCount = await prisma.rideRequest.count({
      where: {
        userId: session.userId,
        status: "COMPLETED",
      },
    });

    const result = validatePromoCode({
      code,
      fareRupees,
      destinationZone,
      completedRidesCount,
    });

    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          code: result.code,
          error: result.error,
          discountRupees: 0,
          discountPaise: 0,
          finalFareRupees: result.finalFareRupees,
          finalFarePaise: result.finalFarePaise,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      valid: true,
      code: result.code,
      description: result.description,
      discountRupees: result.discountRupees,
      discountPaise: result.discountPaise,
      finalFareRupees: result.finalFareRupees,
      finalFarePaise: result.finalFarePaise,
    });
  } catch (error) {
    console.error("Promo validation error:", error);
    return NextResponse.json(
      { error: "Internal server error validating promo code" },
      { status: 500 }
    );
  }
}
