import { PrismaClient } from "@prisma/client";
import { matchRiderRequests, RiderRequest } from "../lib/matching";
import { calculatePoolPricing } from "../lib/pricing";

const prisma = new PrismaClient();

async function runSimulation() {
  const flightArg = process.argv[2] || "6E-204";
  console.log(`\n======================================================`);
  console.log(`✈️  FLIGHTPOOL MATCHING ENGINE SIMULATION: ${flightArg}`);
  console.log(`======================================================\n`);

  const flight = await prisma.flight.findUnique({
    where: { flightNumber: flightArg },
    include: {
      rideRequests: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!flight) {
    console.error(`Flight ${flightArg} not found in database.`);
    const available = await prisma.flight.findMany({ select: { flightNumber: true } });
    console.log(`Available flights: ${available.map((f) => f.flightNumber).join(", ")}`);
    process.exit(1);
  }

  console.log(`Flight: ${flight.airline} ${flight.flightNumber}`);
  console.log(`Route: ${flight.origin} -> BOM (Terminal ${flight.terminal})`);
  console.log(`Status: ${flight.status}`);
  console.log(`Total Ride Requests: ${flight.rideRequests.length}`);
  console.log(`------------------------------------------------------\n`);

  const riderRequests: RiderRequest[] = flight.rideRequests.map((r) => ({
    id: r.id,
    userId: r.user.id,
    userName: r.user.name,
    flightId: flight.id,
    flightNumber: flight.flightNumber,
    flightArrivalTime: flight.arrivalTime,
    terminal: flight.terminal as "T1" | "T2",
    destinationZone: r.destinationZone,
    destinationAddress: r.destinationAddress,
    destinationCoords: { lat: r.destinationLat, lng: r.destinationLng },
    luggageCount: r.luggageCount,
    womenOnly: r.womenOnly,
    gender: r.user.gender,
    readyTime: r.readyTime,
    status: r.status,
  }));

  const simulationTime = new Date();
  const result = matchRiderRequests(riderRequests, simulationTime, {
    maxRidersPerVehicle: 3,
    maxLuggageCapacity: 4,
    maxDetourMinutes: 20,
    maxWaitMinutes: 20,
    flightWindowMinutes: 30,
  });

  console.log(`🎯 MATCHING RESULTS`);
  console.log(`Matched Pools Formed: ${result.matchedPools.length}`);
  console.log(`Unmatched / Waiting: ${result.unmatchedRequests.length}`);
  console.log(`Wait-Cap Expired (Offered Solo): ${result.waitCapExpiredRequests.length}\n`);

  result.matchedPools.forEach((pool, index) => {
    console.log(`========================================`);
    console.log(`🚕 POOL #${index + 1} [${pool.destinationCluster}] - Terminal ${pool.terminal}`);
    console.log(`   Riders: ${pool.riders.length} | Bags: ${pool.totalLuggageCount}/4 | Women-Only: ${pool.isWomenOnly ? "YES 🌸" : "No"}`);
    console.log(`   Total Route: ${pool.totalRouteKm} km (~${pool.totalRouteDurationMinutes} mins)`);
    console.log(`   Route Order:`);

    pool.stops.forEach((stop) => {
      console.log(
        `     Drop #${stop.dropoffOrder}: ${stop.userName} -> ${stop.destinationAddress} (Detour: +${stop.detourMinutes.toFixed(1)}m)`
      );
    });

    const pricing = calculatePoolPricing(
      pool.stops.map((s) => ({
        riderId: s.riderId,
        soloDistanceKm: s.soloDistanceKm,
      })),
      pool.totalRouteKm
    );

    console.log(`\n   💰 FARE & SAVINGS BREAKDOWN:`);
    pricing.riderShares.forEach((share, sIdx) => {
      const stop = pool.stops[sIdx];
      console.log(
        `     • ${stop.userName}: Pool ₹${share.poolFare} (Solo was ₹${share.soloFare}) => Saved ₹${share.savingsAmount} (${share.savingsPct}%)`
      );
    });
    console.log(`   Total Pool Fare: ₹${pricing.totalPoolFare}`);
    console.log(`   Driver Payout (85%): ₹${pricing.driverPayout}`);
    console.log(`   Platform Fee (15%): ₹${pricing.platformFee}`);
    console.log(`========================================\n`);
  });

  if (result.unmatchedRequests.length > 0) {
    console.log(`⏳ Unmatched / Looking for matching riders:`);
    result.unmatchedRequests.forEach((req) => {
      console.log(`   • ${req.userName} -> ${req.destinationZone} (${req.luggageCount} bags, WomenOnly: ${req.womenOnly})`);
    });
    console.log(``);
  }

  // Summary Metrics
  const totalRidersInPools = result.matchedPools.reduce((sum, p) => sum + p.riders.length, 0);
  const matchRate = riderRequests.length > 0 ? ((totalRidersInPools / riderRequests.length) * 100).toFixed(1) : "0";
  const fillRate = result.matchedPools.length > 0 ? (totalRidersInPools / result.matchedPools.length).toFixed(1) : "0";

  console.log(`📊 SIMULATION PERFORMANCE METRICS`);
  console.log(`   Match Rate: ${matchRate}%`);
  console.log(`   Fill Rate (avg riders/cab): ${fillRate}`);
  console.log(`   Flight Window: 30 mins`);
  console.log(`======================================================\n`);
}

runSimulation()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
