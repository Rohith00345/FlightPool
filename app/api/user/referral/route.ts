import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth";
import { generateUserReferralCode } from "../../../../lib/pricing/promo";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/referral
 * Returns the current rider's unique referral code and referral stats.
 */
export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Active session required" }, { status: 401 });
    }

    const referralCode = generateUserReferralCode(session.userId, session.name);
    const origin = req.nextUrl.origin || "http://localhost:3000";

    return NextResponse.json({
      success: true,
      userId: session.userId,
      referralCode,
      shareUrl: `${origin}/?ref=${referralCode}`,
      perk: "Give ₹100, Get ₹100 on your next airport shared pool",
      creditPerReferralRupees: 100,
      totalReferralsCount: 0,
      walletCreditsRupees: 0,
    });
  } catch (error) {
    console.error("Referral fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching referral profile" },
      { status: 500 }
    );
  }
}
