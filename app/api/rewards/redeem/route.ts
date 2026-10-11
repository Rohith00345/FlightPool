import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth";
import { isDemoMode } from "../../../../lib/demo";
import { getGamificationState } from "../../../../lib/gamification/provider";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/rewards/redeem
 * Processes redemption of Green Miles for cab credits or airport perks.
 * In Demo Mode: Validates catalog item & balance, issues simulated voucher code.
 * In Production: Fails closed with 503 unavailable status until live loyalty integration.
 */
export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { rewardId } = body;

    if (!rewardId) {
      return NextResponse.json({ error: "rewardId is required" }, { status: 400 });
    }

    if (!isDemoMode()) {
      return NextResponse.json(
        { error: "Rewards redemption is currently unavailable in production mode" },
        { status: 503 }
      );
    }

    const state = getGamificationState(true);
    const reward = state.rewardsCatalog.find((r) => r.id === rewardId);

    if (!reward) {
      return NextResponse.json(
        { error: "Invalid reward ID: Reward not found in catalog" },
        { status: 404 }
      );
    }

    if (state.milesBalance < reward.costMiles) {
      return NextResponse.json(
        {
          error: `Insufficient Green Miles. Required: ${reward.costMiles}, Available: ${state.milesBalance}`,
        },
        { status: 400 }
      );
    }

    const voucherCode = `FP-${reward.type === "RIDE_CREDIT" ? "CREDIT" : "PERK"}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const remainingBalance = state.milesBalance - reward.costMiles;

    return NextResponse.json({
      success: true,
      rewardId: reward.id,
      title: reward.title,
      costMiles: reward.costMiles,
      voucherCode,
      remainingMilesBalance: remainingBalance,
      redeemedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Rewards redemption error:", error);
    return NextResponse.json(
      { error: "Internal server error processing redemption" },
      { status: 500 }
    );
  }
}
