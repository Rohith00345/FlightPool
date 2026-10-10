import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export function getAuthSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("FATAL: SESSION_SECRET or AUTH_SECRET environment variable is required with no fallback.");
  }
  return secret;
}

export const COOKIE_NAME = "flightpool_session";

export interface SessionPayload {
  userId: string;
  role: "RIDER" | "DRIVER" | "ADMIN" | "MARSHAL" | "SUPPORT";
  phone: string;
  name?: string;
  exp: number; // Unix timestamp in ms
}

import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";

/**
 * Generates SHA-256 hash of an OTP code for secure storage
 */
export function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function checkOtpRateLimit(
  identifier: string,
  ip?: string
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // 1. Rate limit by phone / identifier (max 5 per 10 minutes)
    const recentPhoneAttempts = await prisma.otpRequest.count({
      where: {
        phone: identifier,
        consumedAt: null,
        createdAt: { gte: tenMinutesAgo },
      },
    });

    if (recentPhoneAttempts >= 5) {
      return { allowed: false, remaining: 0 };
    }

    // 2. Rate limit by IP address (max 10 per 10 minutes)
    if (ip && ip !== "127.0.0.1" && ip !== "::1") {
      const recentIpAttempts = await prisma.otpRequest.count({
        where: {
          ip,
          consumedAt: null,
          createdAt: { gte: tenMinutesAgo },
        },
      });

      if (recentIpAttempts >= 10) {
        return { allowed: false, remaining: 0 };
      }
    }

    // Persist this attempt in the database with a non-colliding token for rate tracking
    await prisma.otpRequest.create({
      data: {
        phone: identifier,
        codeHash: hashOtp(crypto.randomBytes(16).toString("hex")),
        purpose: "rate_limit_attempt",
        ip: ip || null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return { allowed: true, remaining: Math.max(0, 4 - recentPhoneAttempts) };
  } catch (err) {
    console.error("Database OTP rate limit check error:", err);
    // Fail open safely if DB transient error, but log it
    return { allowed: true, remaining: 5 };
  }
}

/**
 * Creates a valid OTP record for dispatching to the user
 */
export async function createOtpRequestInDatabase(
  identifier: string,
  ip?: string
): Promise<string> {
  const code = isDemoMode() ? "123456" : crypto.randomInt(100000, 999999).toString();
  await prisma.otpRequest.create({
    data: {
      phone: identifier,
      codeHash: hashOtp(code),
      purpose: "login",
      ip: ip || null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return code;
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
  const signature = crypto.createHmac("sha256", getAuthSecret()).update(payloadB64).digest("base64url");

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
      .createHmac("sha256", getAuthSecret())
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
 * Validates Cross-Site Request Forgery (CSRF) for cookie-authenticated mutating requests.
 * Explicit Authorization Bearer tokens are immune to ambient cookie CSRF attacks.
 */
export function validateCsrf(req: NextRequest | Request): boolean {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return true;
  }

  // If there is no session cookie, there are no ambient credentials to forge
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader || !cookieHeader.includes(COOKIE_NAME)) {
    return true;
  }

  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return true;
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");

  if (origin && host) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  if (referer && host) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  return process.env.NODE_ENV !== "production";
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

  if (!validateCsrf(req)) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Forbidden", message: "Cross-Site Request Forgery validation failed" },
        { status: 403 }
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
