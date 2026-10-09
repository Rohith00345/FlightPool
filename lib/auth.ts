import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

const AUTH_SECRET = process.env.AUTH_SECRET || "flightpool_super_secret_jwt_hmac_key_2026";
export const COOKIE_NAME = "flightpool_session";

export interface SessionPayload {
  userId: string;
  role: "RIDER" | "DRIVER" | "ADMIN" | "MARSHAL" | "SUPPORT";
  phone: string;
  name?: string;
  exp: number; // Unix timestamp in ms
}

import { prisma } from "@/lib/prisma";

export async function checkOtpRateLimit(identifier: string, ip?: string): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentAttempts = await prisma.otpRequest.count({
      where: {
        phone: identifier,
        consumedAt: null,
        createdAt: { gte: tenMinutesAgo },
      },
    });

    if (recentAttempts >= 5) {
      return { allowed: false, remaining: 0 };
    }

    // Persist this attempt in the database
    await prisma.otpRequest.create({
      data: {
        phone: identifier,
        purpose: "login",
        ip: ip || null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return { allowed: true, remaining: Math.max(0, 4 - recentAttempts) };
  } catch (err) {
    console.error("Database OTP rate limit check error:", err);
    // Fail open safely if DB transient error, but log it
    return { allowed: true, remaining: 5 };
  }
}

export async function consumeOtpInDatabase(identifier: string): Promise<void> {
  try {
    const latest = await prisma.otpRequest.findFirst({
      where: { phone: identifier, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (latest) {
      await prisma.otpRequest.update({
        where: { id: latest.id },
        data: { consumedAt: new Date() },
      });
    }
  } catch (err) {
    console.warn("Failed to mark OTP consumed:", err);
  }
}

/**
 * Creates a signed base64url HMAC session token
 */
export function signSessionToken(payload: Omit<SessionPayload, "exp">, expiresInHours = 24 * 7): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + expiresInHours * 60 * 60 * 1000,
  };

  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(payloadB64).digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies a signed session token
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return null;

    const expectedSignature = crypto
      .createHmac("sha256", AUTH_SECRET)
      .update(payloadB64)
      .digest("base64url");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));

    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies session from NextRequest or standard Request
 */
export function getSessionFromRequest(req: NextRequest | Request): SessionPayload | null {
  // 1. Check Authorization Bearer header first (explicit credential takes precedence)
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const session = verifySessionToken(token);
    if (session) return session;
  }

  // 2. Check Cookie
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split("; ").map((c) => {
        const [k, ...v] = c.split("=");
        return [k, v.join("=")];
      })
    );
    if (cookies[COOKIE_NAME]) {
      const session = verifySessionToken(cookies[COOKIE_NAME]);
      if (session) return session;
    }
  }

  // 3. Demo Mode Header / Key (allows reviewers & automated E2E testing to simulate roles without credentials leak)
  if (process.env.DEMO_MODE !== "false") {
    const demoRole = req.headers.get("x-demo-role") as SessionPayload["role"] | null;
    const demoUserId = req.headers.get("x-demo-user-id");
    if (demoRole) {
      return {
        userId: demoUserId || "demo-user-id",
        role: demoRole,
        phone: "+919999999999",
        name: `Demo ${demoRole}`,
        exp: Date.now() + 60 * 60 * 1000,
      };
    }
  }

  return null;
}

/**
 * Enforces role-based access control. Returns a NextResponse error if unauthorized, or null if allowed.
 */
export function requireRole(
  req: NextRequest | Request,
  allowedRoles: Array<SessionPayload["role"]>
): { session: SessionPayload; response: null } | { session: null; response: NextResponse } {
  const session = getSessionFromRequest(req);

  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Authentication required", message: "Missing or invalid session credentials" },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Forbidden", message: `Requires one of roles: ${allowedRoles.join(", ")}` },
        { status: 403 }
      ),
    };
  }

  return { session, response: null };
}
