import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId || session?.userId;

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Authentication required to request data deletion" },
        { status: 401 }
      );
    }

    // Ensure users can only delete their own data unless admin
    if (session && session.role !== "ADMIN" && session.userId !== targetUserId) {
      return NextResponse.json(
        { error: "Forbidden: You can only delete your own data" },
        { status: 403 }
      );
    }

    // 1. Delete consents
    await prisma.consent.deleteMany({ where: { userId: targetUserId } });

    // 2. Delete verifications (boarding pass data scrubbed)
    await prisma.passengerVerification.deleteMany({ where: { userId: targetUserId } });

    // 3. Anonymize user profile
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        name: "Anonymous User (Deleted)",
        email: null,
        phone: `+9100${Math.floor(10000000 + Math.random() * 90000000)}`,
        gender: "UNSPECIFIED",
      },
    });

    // 4. Record Audit Log for DPDP compliance
    await prisma.auditLog.create({
      data: {
        actorId: session?.userId || targetUserId,
        action: "DPDP_DATA_DELETION",
        entityType: "USER",
        entityId: targetUserId,
        after: JSON.stringify({ anonymized: true, scrubbedAt: new Date().toISOString() }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Personal travel and identification data purged in compliance with DPDP regulations.",
    });
  } catch (error: unknown) {
    console.error("Data deletion error:", error);
    return NextResponse.json(
      { error: "Failed to process data deletion request", details: String(error) },
      { status: 500 }
    );
  }
}
