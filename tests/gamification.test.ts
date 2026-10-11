import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { signSessionToken } from "../lib/auth";
import {
  getScoreTier,
  getRankForXp,
  getGamificationProvider,
  getGamificationState,
  MockGamificationProvider,
  UnavailableGamificationProvider,
} from "../lib/gamification/provider";

describe("Phase UI-3: Gamification System & Provider", () => {
  describe("Flight Score Tier Mapping (0 - 1000)", () => {
    it("maps 0-299 to Taxi tier", () => {
      expect(getScoreTier(0).tier).toBe("Taxi");
      expect(getScoreTier(150).tier).toBe("Taxi");
      expect(getScoreTier(299).tier).toBe("Taxi");
    });

    it("maps 300-499 to Takeoff tier", () => {
      expect(getScoreTier(300).tier).toBe("Takeoff");
      expect(getScoreTier(400).tier).toBe("Takeoff");
      expect(getScoreTier(499).tier).toBe("Takeoff");
    });

    it("maps 500-699 to Cruise tier", () => {
      expect(getScoreTier(500).tier).toBe("Cruise");
      expect(getScoreTier(600).tier).toBe("Cruise");
      expect(getScoreTier(699).tier).toBe("Cruise");
    });

    it("maps 700-849 to Jet Stream tier", () => {
      expect(getScoreTier(700).tier).toBe("Jet Stream");
      expect(getScoreTier(800).tier).toBe("Jet Stream");
      expect(getScoreTier(849).tier).toBe("Jet Stream");
    });

    it("maps 850+ to Supersonic tier", () => {
      expect(getScoreTier(850).tier).toBe("Supersonic");
      expect(getScoreTier(950).tier).toBe("Supersonic");
      expect(getScoreTier(1000).tier).toBe("Supersonic");
    });
  });

  describe("Aviation XP to Rank Mapping", () => {
    it("maps XP to correct rank and next level threshold", () => {
      expect(getRankForXp(0).rank).toBe("Ground Crew");
      expect(getRankForXp(500).rank).toBe("Cadet");
      expect(getRankForXp(1200).rank).toBe("First Officer");
      expect(getRankForXp(2400).rank).toBe("Captain");
      expect(getRankForXp(3500).rank).toBe("Commander");
      expect(getRankForXp(5000).rank).toBe("Ace");
    });
  });

  describe("Gamification Provider Switching (Demo vs Production)", () => {
    it("provides UnavailableGamificationProvider when demo is disabled", async () => {
      const provider = getGamificationProvider(false);
      expect(provider).toBeInstanceOf(UnavailableGamificationProvider);

      const state = provider.getState();
      expect(state.enabled).toBe(false);
      expect(state.flightScore).toBe(0);
      expect(state.tierPerk).toContain("coming soon");
      expect(state.scoreCategories).toHaveLength(0);
      expect(state.badges).toHaveLength(0);
      expect(state.quests).toHaveLength(0);

      const scoreRes = await provider.getScore();
      expect(scoreRes.score).toBe(0);
      const miles = await provider.getMiles();
      expect(miles).toBe(0);
    });

    it("provides MockGamificationProvider when demo is enabled", async () => {
      const provider = getGamificationProvider(true);
      expect(provider).toBeInstanceOf(MockGamificationProvider);

      const state = provider.getState();
      expect(state.enabled).toBe(true);
      expect(state.flightScore).toBeGreaterThanOrEqual(800);
      expect(state.scoreCategories).toHaveLength(5);
      expect(state.badges.length).toBeGreaterThanOrEqual(6);
      expect(state.quests.length).toBeGreaterThanOrEqual(2);

      const scoreRes = await provider.getScore();
      expect(scoreRes.score).toBe(840);
      expect(scoreRes.categories).toHaveLength(5);

      const miles = await provider.getMiles();
      expect(miles).toBe(1420);

      const badges = await provider.getBadges();
      expect(badges.some((b) => b.title === "First Landing")).toBe(true);
    });

    it("getGamificationState helper respects explicit demo parameter", () => {
      const prodState = getGamificationState(false);
      expect(prodState.enabled).toBe(false);

      const demoState = getGamificationState(true);
      expect(demoState.enabled).toBe(true);
    });
  });

  describe("Rewards API Endpoints (/api/rewards & /api/rewards/redeem)", () => {
    // Dynamic import to prevent hoisting issues
    const validToken = signSessionToken({
      userId: "user_rewards_tester_123",
      role: "RIDER",
      name: "Pilot Rider",
      phone: "+919988776655",
    });

    it("GET /api/rewards rejects unauthenticated requests with 401", async () => {
      const { GET } = await import("../app/api/rewards/route");
      const req = new NextRequest("http://localhost:3000/api/rewards");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("GET /api/rewards returns gamification state for authenticated rider", async () => {
      const { GET } = await import("../app/api/rewards/route");
      const req = new NextRequest("http://localhost:3000/api/rewards", {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.userId).toBe("user_rewards_tester_123");
      expect(json.gamification).toBeDefined();
    });

    it("POST /api/rewards/redeem rejects unauthenticated requests with 401", async () => {
      const { POST } = await import("../app/api/rewards/redeem/route");
      const req = new NextRequest("http://localhost:3000/api/rewards/redeem", {
        method: "POST",
        body: JSON.stringify({ rewardId: "rw_100" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("POST /api/rewards/redeem rejects missing rewardId with 400", async () => {
      const { POST } = await import("../app/api/rewards/redeem/route");
      const req = new NextRequest("http://localhost:3000/api/rewards/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("POST /api/rewards/redeem rejects non-existent rewardId with 404 in demo mode", async () => {
      const originalDemo = process.env.DEMO_MODE;
      try {
        process.env.DEMO_MODE = "true";
        const { POST } = await import("../app/api/rewards/redeem/route");
        const req = new NextRequest("http://localhost:3000/api/rewards/redeem", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${validToken}`,
          },
          body: JSON.stringify({ rewardId: "rw_invalid_nonexistent" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(404);
      } finally {
        process.env.DEMO_MODE = originalDemo;
      }
    });

    it("POST /api/rewards/redeem successfully issues voucher code in demo mode", async () => {
      const originalDemo = process.env.DEMO_MODE;
      try {
        process.env.DEMO_MODE = "true";
        const { POST } = await import("../app/api/rewards/redeem/route");
        const req = new NextRequest("http://localhost:3000/api/rewards/redeem", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${validToken}`,
          },
          body: JSON.stringify({ rewardId: "rw_100" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.rewardId).toBe("rw_100");
        expect(json.voucherCode).toContain("FP-CREDIT-");
        expect(json.remainingMilesBalance).toBeDefined();
      } finally {
        process.env.DEMO_MODE = originalDemo;
      }
    });

    it("POST /api/rewards/redeem fails closed with 503 when production mode is active", async () => {
      const originalDemo = process.env.DEMO_MODE;
      try {
        process.env.DEMO_MODE = "false";
        const { POST } = await import("../app/api/rewards/redeem/route");
        const req = new NextRequest("http://localhost:3000/api/rewards/redeem", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${validToken}`,
          },
          body: JSON.stringify({ rewardId: "rw_100" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(503);
      } finally {
        process.env.DEMO_MODE = originalDemo;
      }
    });
  });
});

