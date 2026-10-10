import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const roleCheck = requireRole(req, ["ADMIN"]);
    if (roleCheck.response) return roleCheck.response;

    const { id: driverId } = await params;
    const body = await req.json();
    const { docType, status } = body;

    if (!docType || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "docType and valid status ('APPROVED' | 'REJECTED') are required." },
        { status: 400 }
      );
    }

    const document = await prisma.driverDocument.update({
      where: {
        driverId_docType: {
          driverId,
          docType,
        },
      },
      data: {
        status,
        verifiedAt: status === "APPROVED" ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      document,
      message: `Document ${docType} has been ${status}.`,
    });
  } catch (error: unknown) {
    console.error("Admin document review error:", error);
    return NextResponse.json(
      { error: "Failed to update document status", details: String(error) },
      { status: 500 }
    );
  }
}
