import { describe, it, expect } from "vitest";
import {
  matchRiderRequests,
  optimizeDropoffRoute,
  handleRiderCancellation,
  areDestinationsCompatible,
  RiderRequest,
  DEFAULT_MATCHING_CONSTRAINTS,
} from "../lib/matching";
import { MUMBAI_ZONES } from "../lib/geo";

const BASE_TIME = new Date("2026-10-09T20:00:00.000Z");

function createRider(overrides: Partial<RiderRequest> = {}): RiderRequest {
  const zone = overrides.destinationZone || "Thane";
  const zoneInfo = MUMBAI_ZONES[zone] || MUMBAI_ZONES["Thane"];
  return {
    id: `req-${Math.random().toString(36).slice(2, 7)}`,
    userId: `user-${Math.random().toString(36).slice(2, 7)}`,
    userName: "Test Rider",
    flightId: "fl-6e204",
    flightNumber: "6E-204",
    flightArrivalTime: new Date(BASE_TIME.getTime() - 10 * 60 * 1000),
    terminal: "T2",
    destinationZone: zone,
    destinationAddress: zoneInfo.popularDropoffs[0],
    destinationCoords: zoneInfo.center,
    luggageCount: 1,
    womenOnly: false,
    gender: "MALE",
    readyTime: new Date(BASE_TIME.getTime() - 5 * 60 * 1000),
    status: "POOLING",
    ...overrides,
  };
}

describe("FlightPool Matching Engine", () => {
  // Test 1: Basic 2-rider matching in same zone
  it("1. matches 2 compatible riders from the same flight into a pool", () => {
    const r1 = createRider({ id: "r1", userName: "Aarav", destinationZone: "Thane" });
    const r2 = createRider({ id: "r2", userName: "Rohan", destinationZone: "Thane" });

    const result = matchRiderRequests([r1, r2], BASE_TIME);
    expect(result.matchedPools.length).toBe(1);
    expect(result.matchedPools[0].riders.length).toBe(2);
    expect(result.unmatchedRequests.length).toBe(0);
  });

  // Test 2: Corridor compatibility (Thane & Mulund share Eastern Express Highway)
  it("2. matches riders in compatible adjacent zones along the same corridor", () => {
    const r1 = createRider({ id: "r1", userName: "Vikram", destinationZone: "Mulund" });
    const r2 = createRider({ id: "r2", userName: "Rohan", destinationZone: "Thane" });

    expect(areDestinationsCompatible(r1, r2)).toBe(true);
    const result = matchRiderRequests([r1, r2], BASE_TIME);
    expect(result.matchedPools.length).toBe(1);
    expect(result.matchedPools[0].riders.length).toBe(2);
  });

  // Test 3: Incompatible distant zones rejected from same pool
  it("3. does not match riders headed in opposite directions (Bandra vs Thane)", () => {
    const r1 = createRider({ id: "r1", userName: "Arjun", destinationZone: "Bandra" });
    const r2 = createRider({ id: "r2", userName: "Aarav", destinationZone: "Thane" });

    const result = matchRiderRequests([r1, r2], BASE_TIME);
    expect(result.matchedPools.length).toBe(0);
    expect(result.unmatchedRequests.length).toBe(2);
  });

  // Test 4: Max riders per cab constraint
  it("4. enforces max riders per vehicle capacity (caps at 3 by default)", () => {
    const r1 = createRider({ id: "r1", destinationZone: "Powai" });
    const r2 = createRider({ id: "r2", destinationZone: "Powai" });
    const r3 = createRider({ id: "r3", destinationZone: "Powai" });
    const r4 = createRider({ id: "r4", destinationZone: "Powai" });

    const result = matchRiderRequests([r1, r2, r3, r4], BASE_TIME, {
      ...DEFAULT_MATCHING_CONSTRAINTS,
      maxRidersPerVehicle: 3,
    });
    expect(result.matchedPools.length).toBe(1);
    expect(result.matchedPools[0].riders.length).toBe(3);
    expect(result.unmatchedRequests.length).toBe(1);
  });

  // Test 5: Luggage overflow constraint
  it("5. rejects candidate rider when combined luggage exceeds vehicle luggage capacity (max 4)", () => {
    const r1 = createRider({ id: "r1", destinationZone: "Powai", luggageCount: 2 });
    const r2 = createRider({ id: "r2", destinationZone: "Powai", luggageCount: 2 });
    const r3 = createRider({ id: "r3", destinationZone: "Powai", luggageCount: 2 }); // Total 6 > 4

    const result = matchRiderRequests([r1, r2, r3], BASE_TIME, {
      ...DEFAULT_MATCHING_CONSTRAINTS,
      maxLuggageCapacity: 4,
    });
    expect(result.matchedPools.length).toBe(1);
    expect(result.matchedPools[0].riders.length).toBe(2);
    expect(result.matchedPools[0].totalLuggageCount).toBe(4);
    expect(result.unmatchedRequests.length).toBe(1);
  });

  // Test 6: Exactly at luggage capacity limit
  it("6. permits riders when luggage exactly equals vehicle capacity (e.g. 4 bags)", () => {
    const r1 = createRider({ id: "r1", destinationZone: "Bandra", luggageCount: 2 });
    const r2 = createRider({ id: "r2", destinationZone: "Bandra", luggageCount: 2 });

    const result = matchRiderRequests([r1, r2], BASE_TIME, {
      ...DEFAULT_MATCHING_CONSTRAINTS,
      maxLuggageCapacity: 4,
    });
    expect(result.matchedPools.length).toBe(1);
    expect(result.matchedPools[0].totalLuggageCount).toBe(4);
  });

  // Test 7: Women-only pool strict enforcement (excludes male riders)
  it("7. strictly enforces women-only pools and prevents male riders from joining", () => {
    const r1 = createRider({ id: "r1", userName: "Priya", gender: "FEMALE", womenOnly: true, destinationZone: "Powai" });
    const r2 = createRider({ id: "r2", userName: "Neha", gender: "FEMALE", womenOnly: true, destinationZone: "Powai" });
    const r3 = createRider({ id: "r3", userName: "Rahul", gender: "MALE", womenOnly: false, destinationZone: "Powai" });

    const result = matchRiderRequests([r1, r2, r3], BASE_TIME);
    expect(result.matchedPools.length).toBe(1);
    const pool = result.matchedPools[0];
    expect(pool.isWomenOnly).toBe(true);
    expect(pool.riders.map((r) => r.userName)).toEqual(["Priya", "Neha"]);
    expect(result.unmatchedRequests.map((r) => r.userName)).toContain("Rahul");
  });

  // Test 8: Non-women-only female rider can pool with male riders
  it("8. allows female riders who did not request women-only to pool in standard pools", () => {
    const r1 = createRider({ id: "r1", userName: "Divya", gender: "FEMALE", womenOnly: false, destinationZone: "Powai" });
    const r2 = createRider({ id: "r2", userName: "Amit", gender: "MALE", womenOnly: false, destinationZone: "Powai" });

    const result = matchRiderRequests([r1, r2], BASE_TIME);
    expect(result.matchedPools.length).toBe(1);
    expect(result.matchedPools[0].isWomenOnly).toBe(false);
    expect(result.matchedPools[0].riders.length).toBe(2);
  });

  // Test 9: Terminal separation (T1 rider never grouped with T2 rider)
  it("9. never groups Terminal 1 riders with Terminal 2 riders", () => {
    const r1 = createRider({ id: "r1", terminal: "T1", destinationZone: "Powai" });
    const r2 = createRider({ id: "r2", terminal: "T2", destinationZone: "Powai" });

    const result = matchRiderRequests([r1, r2], BASE_TIME);
    expect(result.matchedPools.length).toBe(0);
    expect(result.unmatchedRequests.length).toBe(2);
  });

  // Test 10: Flight arrival window constraint
  it("10. rejects matching riders whose flights arrived more than 30 mins apart", () => {
    const r1 = createRider({
      id: "r1",
      flightId: "fl-1",
      flightArrivalTime: new Date(BASE_TIME.getTime() - 45 * 60 * 1000),
      destinationZone: "Andheri",
    });
    const r2 = createRider({
      id: "r2",
      flightId: "fl-2",
      flightArrivalTime: new Date(BASE_TIME.getTime() - 5 * 60 * 1000), // 40 mins difference
      destinationZone: "Andheri",
    });

    const result = matchRiderRequests([r1, r2], BASE_TIME, {
      ...DEFAULT_MATCHING_CONSTRAINTS,
      flightWindowMinutes: 30,
    });
    expect(result.matchedPools.length).toBe(0);
  });

  // Test 11: Detour optimization orders stops logically
  it("11. orders drop-offs from nearest to farthest to minimise total detour", () => {
    // Mulund is ~17km from T2, Thane is ~24km from T2 along same highway
    const rMulund = createRider({ id: "r-mulund", destinationZone: "Mulund" });
    const rThane = createRider({ id: "r-thane", destinationZone: "Thane" });

    const route = optimizeDropoffRoute("T2", [rThane, rMulund], 20);
    expect(route).not.toBeNull();
    expect(route!.stops[0].destinationZone).toBe("Mulund");
    expect(route!.stops[1].destinationZone).toBe("Thane");
    expect(route!.stops[0].dropoffOrder).toBe(1);
    expect(route!.stops[1].dropoffOrder).toBe(2);
  });

  // Test 12: Rejects pool if detour exceeds maxDetourMinutes
  it("12. rejects a pool when excessive detour would be imposed (> 20 min cap)", () => {
    // Artificial points with excessive detour
    const r1 = createRider({
      id: "r1",
      destinationZone: "South",
      destinationCoords: { lat: 18.9220, lng: 72.8347 }, // Colaba (~28km South)
    });
    const r2 = createRider({
      id: "r2",
      destinationZone: "North",
      destinationCoords: { lat: 19.2813, lng: 72.8561 }, // Mira Road (~26km North)
    });

    const route = optimizeDropoffRoute("T2", [r1, r2], 15);
    // Travelling south then all the way north creates > 40 min detour
    expect(route).toBeNull();
  });

  // Test 13: Wait-cap expiry detection and solo offer
  it("13. detects wait cap expiration when rider has waited > 20 mins with no match", () => {
    const expiredRider = createRider({
      id: "r-lonely",
      destinationZone: "Navi Mumbai",
      readyTime: new Date(BASE_TIME.getTime() - 25 * 60 * 1000), // 25 mins ago
    });

    const result = matchRiderRequests([expiredRider], BASE_TIME, {
      ...DEFAULT_MATCHING_CONSTRAINTS,
      maxWaitMinutes: 20,
    });
    expect(result.matchedPools.length).toBe(0);
    expect(result.waitCapExpiredRequests.length).toBe(1);
    expect(result.waitCapExpiredRequests[0].id).toBe("r-lonely");
  });

  // Test 14: Mid-pool cancellation with 3 riders shrinking to 2 viable riders
  it("14. recalculates route when 1 rider cancels from a 3-rider pool", () => {
    const r1 = createRider({ id: "r1", userName: "Aarav", destinationZone: "Thane" });
    const r2 = createRider({ id: "r2", userName: "Rohan", destinationZone: "Thane" });
    const r3 = createRider({ id: "r3", userName: "Vikram", destinationZone: "Mulund" });

    const initialMatch = matchRiderRequests([r1, r2, r3], BASE_TIME);
    expect(initialMatch.matchedPools.length).toBe(1);
    const pool = initialMatch.matchedPools[0];

    const cancelResult = handleRiderCancellation(pool, "r3");
    expect(cancelResult.status).toBe("POOL_UPDATED");
    expect(cancelResult.updatedPool).not.toBeNull();
    expect(cancelResult.updatedPool!.riders.length).toBe(2);
    expect(cancelResult.remainingRiders.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  // Test 15: Mid-pool cancellation with 2 riders collapsing into solo offer
  it("15. triggers solo fallback offer when 1 rider cancels from a 2-rider pool", () => {
    const r1 = createRider({ id: "r1", userName: "Aarav", destinationZone: "Thane" });
    const r2 = createRider({ id: "r2", userName: "Rohan", destinationZone: "Thane" });

    const initialMatch = matchRiderRequests([r1, r2], BASE_TIME);
    const pool = initialMatch.matchedPools[0];

    const cancelResult = handleRiderCancellation(pool, "r2");
    expect(cancelResult.status).toBe("OFFER_SOLO");
    expect(cancelResult.updatedPool).toBeNull();
    expect(cancelResult.remainingRiders.length).toBe(1);
    expect(cancelResult.remainingRiders[0].id).toBe("r1");
  });

  // Test 16: Empty and single-request graceful handling
  it("16. handles empty inputs and single request gracefully without throwing", () => {
    const emptyResult = matchRiderRequests([]);
    expect(emptyResult.matchedPools.length).toBe(0);
    expect(emptyResult.unmatchedRequests.length).toBe(0);

    const singleRider = createRider({ readyTime: BASE_TIME });
    const singleResult = matchRiderRequests([singleRider], BASE_TIME);
    expect(singleResult.matchedPools.length).toBe(0);
    expect(singleResult.unmatchedRequests.length).toBe(1);
  });
});
