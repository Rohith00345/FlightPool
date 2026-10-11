import { describe, it, expect } from "vitest";
import { validatePromoCode, generateUserReferralCode } from "../lib/pricing/promo";
import { signSessionToken } from "../lib/auth";
import { NextRequest } from "next/server";

describe("Promo Code Engine & Referral Validation", () => {
  describe("Unit: Promo Code Rules & Anti-Abuse Checks", () => {
    it("rejects empty promo code", () => {
      const result = validatePromoCode({
        code: "",
        fareRupees: 400,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });

    it("rejects invalid promo code", () => {
      const result = validatePromoCode({
        code: "INVALID_CODE_99",
        fareRupees: 400,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid promo code");
    });

    it("applies FLYPOOL50 flat ₹50 discount when meeting min fare ₹250", () => {
      const result = validatePromoCode({
        code: "FLYPOOL50",
        fareRupees: 350,
      });
      expect(result.valid).toBe(true);
      expect(result.discountRupees).toBe(50);
      expect(result.discountPaise).toBe(5000);
      expect(result.finalFareRupees).toBe(300);
      expect(result.finalFarePaise).toBe(30000);
    });

    it("rejects FLYPOOL50 when fare is below minFareRupees ₹250", () => {
      const result = validatePromoCode({
        code: "FLYPOOL50",
        fareRupees: 200,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("minimum fare of ₹250");
    });

    it("applies BOMWELCOME 25% discount with ₹150 cap for first ride", () => {
      // 25% of ₹800 is ₹200, but cap is ₹150
      const result = validatePromoCode({
        code: "BOMWELCOME",
        fareRupees: 800,
        completedRidesCount: 0,
      });
      expect(result.valid).toBe(true);
      expect(result.discountRupees).toBe(150);
      expect(result.finalFareRupees).toBe(650);
    });

    it("rejects BOMWELCOME for rider who has already completed 1 ride", () => {
      const result = validatePromoCode({
        code: "BOMWELCOME",
        fareRupees: 400,
        completedRidesCount: 1,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("first shared ride");
    });

    it("enforces THANEEXPRESS corridor restrictions", () => {
      // Allowed corridor: Thane
      const thaneResult = validatePromoCode({
        code: "THANEEXPRESS",
        fareRupees: 500,
        destinationZone: "Thane",
      });
      expect(thaneResult.valid).toBe(true);
      expect(thaneResult.discountRupees).toBe(100);

      // Disallowed corridor: Bandra
      const bandraResult = validatePromoCode({
        code: "THANEEXPRESS",
        fareRupees: 500,
        destinationZone: "Bandra",
      });
      expect(bandraResult.valid).toBe(false);
      expect(bandraResult.error).toContain("only applicable to: Thane, Navi Mumbai");
    });

    it("generates deterministic user referral code", () => {
      const ref = generateUserReferralCode("cuid_user_12345", "Aarav Sharma");
      expect(ref).toBe("FP-AARA-2345");
    });
  });

  describe("API: /api/promos/validate", () => {
    const validToken = signSessionToken({
      userId: "user_promo_tester",
      role: "RIDER",
      name: "Promo Tester",
      phone: "+919911223344",
    });

    it("rejects unauthenticated request with 401", async () => {
      const { POST } = await import("../app/api/promos/validate/route");
      const req = new NextRequest("http://localhost:3000/api/promos/validate", {
        method: "POST",
        body: JSON.stringify({ code: "FLYPOOL50", fareRupees: 400 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("rejects missing code with 400", async () => {
      const { POST } = await import("../app/api/promos/validate/route");
      const req = new NextRequest("http://localhost:3000/api/promos/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ fareRupees: 400 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 422 for invalid promo code", async () => {
      const { POST } = await import("../app/api/promos/validate/route");
      const req = new NextRequest("http://localhost:3000/api/promos/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ code: "FAKECODE", fareRupees: 400 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.valid).toBe(false);
      expect(json.error).toContain("Invalid");
    });

    it("successfully validates promo code with 200", async () => {
      const { POST } = await import("../app/api/promos/validate/route");
      const req = new NextRequest("http://localhost:3000/api/promos/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ code: "GREENMUMBAI", fareRupees: 450 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.valid).toBe(true);
      expect(json.discountRupees).toBe(75);
      expect(json.finalFareRupees).toBe(375);
    });
  });

  describe("API: /api/user/referral", () => {
    it("returns user referral profile for authenticated rider", async () => {
      const token = signSessionToken({
        userId: "user_ref_test_888",
        role: "RIDER",
        name: "Priya Nair",
        phone: "+919922334455",
      });

      const { GET } = await import("../app/api/user/referral/route");
      const req = new NextRequest("http://localhost:3000/api/user/referral", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.referralCode).toBe("FP-PRIY-T888");
      expect(json.creditPerReferralRupees).toBe(100);
    });
  });
});
