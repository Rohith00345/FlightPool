import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../lib/auth";
import { isDemoMode } from "../../../lib/demo";
import { getGamificationState } from "../../../lib/gamification/provider";

export const dynamic = "force-dynamic";

/**
 * GET /api/rewards
 * Returns authenticated rider's Gamification & FlightDeck Rewards state.
 * Dual-mode: Demo mode delivers simulated flight scores, quests, and perks.
 * Production mode gracefully fails closed with standard tier and coming soon status.
 */
export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const demo = isDemoMode();
    const state = getGamificationState(demo);

    return NextResponse.json({
      success: true,
      demoMode: demo,
      userId: session.userId,
      gamification: state,
    });
  } catch (error) {
    console.error("Failed to retrieve rewards state:", error);
    return NextResponse.json(
      { error: "Internal server error fetching rewards state" },
      { status: 500 }
    );
  }
}
