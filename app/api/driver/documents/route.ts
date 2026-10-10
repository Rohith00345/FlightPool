import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (session.role !== "DRIVER" && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Driver role required" }, { status: 403 });
    }

    const body = await req.json();
    const { docType, docNumber, fileUrl } = body;

    if (!docType || !docNumber || !fileUrl) {
      return NextResponse.json(
        { error: "docType, docNumber, and fileUrl are required" },
        { status: 400 }
      );
    }

    // Resolve driver profile for this user
    let driver = await prisma.driver.findFirst({
      where: {
        OR: [{ id: session.userId }, { phone: session.phone }],
      },
    });

    if (!driver) {
      // Auto-create driver record if session is DRIVER role
      driver = await prisma.driver.create({
        data: {
          name: session.name || "Driver",
          phone: session.phone,
          isAvailable: true,
        },
      });
    }

    const document = await prisma.driverDocument.upsert({
      where: {
        driverId_docType: {
          driverId: driver.id,
          docType,
        },
      },
      update: {
        docNumber,
        fileUrl,
        status: "PENDING",
        verifiedAt: null,
      },
      create: {
        driverId: driver.id,
        docType,
        docNumber,
        fileUrl,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      document,
      message: "Document submitted successfully for verification.",
    });
  } catch (error: unknown) {
    console.error("Driver document upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload document", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (session.role !== "DRIVER" && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Driver role required" }, { status: 403 });
    }

    const driver = await prisma.driver.findFirst({
      where: {
        OR: [{ id: session.userId }, { phone: session.phone }],
      },
      include: {
        documents: true,
      },
    });

    if (!driver) {
      return NextResponse.json({ documents: [] });
    }

    return NextResponse.json({ documents: driver.documents });
  } catch (error: unknown) {
    console.error("Fetch driver documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents", details: String(error) },
      { status: 500 }
    );
  }
}
