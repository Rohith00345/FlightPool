import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, otp, name, gender, role } = body;

    if (!identifier) {
      return NextResponse.json(
        { error: "Phone number or email is required" },
        { status: 400 }
      );
    }

    // Phase 1 / Auth: OTP request vs verification
    if (!otp) {
      // Step 1: Send OTP request
      return NextResponse.json({
        success: true,
        message: "OTP sent to " + identifier + ". In dev mode, use OTP: 123456",
        otpHint: "123456",
      });
    }

    // Step 2: Verify OTP
    if (otp !== "123456") {
      return NextResponse.json(
        { error: "Invalid OTP code. Please enter 123456" },
        { status: 400 }
      );
    }

    const isEmail = identifier.includes("@");
    const phone = isEmail ? "+9198" + Math.floor(10000000 + Math.random() * 90000000) : identifier;
    const email = isEmail ? identifier : null;

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          email,
          name: name || (isEmail ? identifier.split("@")[0] : "Mumbai Traveler"),
          gender: gender || "UNSPECIFIED",
          role: role || "RIDER",
        },
      });
    } else if (gender && user.gender === "UNSPECIFIED") {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { gender },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        gender: user.gender,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed", details: String(error) },
      { status: 500 }
    );
  }
}
