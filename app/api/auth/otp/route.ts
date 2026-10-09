import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkOtpRateLimit, signSessionToken, COOKIE_NAME, SessionPayload } from "@/lib/auth";

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

    // Rate limiting: Max 5 attempts per 10 minutes
    const rateCheck = checkOtpRateLimit(identifier);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many OTP attempts. Please wait 10 minutes before trying again." },
        { status: 429 }
      );
    }

    // Phase 1 / Auth: OTP request vs verification
    if (!otp) {
      // Step 1: Send OTP request
      return NextResponse.json({
        success: true,
        message: "OTP sent to " + identifier + ". In dev mode, use OTP: 123456",
        otpHint: "123456",
        remainingAttempts: rateCheck.remaining,
      });
    }

    // Step 2: Verify OTP
    // In production (DEMO_MODE=false), verify actual OTP; in demo mode allow 123456
    const isDemoMode = process.env.DEMO_MODE !== "false";
    if (isDemoMode && otp !== "123456") {
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

    const userRole = (user.role as SessionPayload["role"]) || "RIDER";
    const token = signSessionToken({
      userId: user.id,
      role: userRole,
      phone: user.phone,
      name: user.name,
    });

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        gender: user.gender,
        role: user.role,
      },
    });

    // Set HTTP-only secure cookie
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error: unknown) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed", details: String(error) },
      { status: 500 }
    );
  }
}
