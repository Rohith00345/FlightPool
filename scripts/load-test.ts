import { prisma } from "../lib/prisma";

const BASE_URL = process.env.APP_URL || "http://localhost:3000";
const TOTAL_RIDERS = 500;
const CONCURRENCY = 25; // Concurrent HTTP in-flight requests
const ZONES = ["Thane", "Mulund", "Powai", "Bandra", "Andheri", "Navi Mumbai"];

interface RequestResult {
  riderIndex: number;
  statusCode: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}

async function runRealHttpLoadBenchmark() {
  console.log("================================================================================");
  console.log("🚀 FLIGHTPOOL PRODUCTION HTTP LOAD TEST (500 RIDERS, 1 LANDING WAVE)");
  console.log(`🎯 Target Endpoint: ${BASE_URL} (Local PostgreSQL Database)`);
  console.log("================================================================================\n");

  // 1. Healthcheck to make sure production build server is running
  try {
    const healthCheck = await fetch(`${BASE_URL}/api/flights`);
    if (!healthCheck.ok) {
      throw new Error(`Server returned HTTP ${healthCheck.status}`);
    }
  } catch (err) {
    console.error(`❌ Error connecting to production server at ${BASE_URL}:`, err);
    console.error("Please ensure the production build is running: 'npm run build' followed by 'npm start'.");
    process.exit(1);
  }

  // 2. Prepare Wave Flight in Database
  console.log("📦 Preparing wave flight and test rider identities in local database...");
  const waveFlight = await prisma.flight.upsert({
    where: { flightNumber: "AI-WAVE-500" },
    update: {
      status: "LANDED",
      arrivalTime: new Date(),
    },
    create: {
      flightNumber: "AI-WAVE-500",
      airline: "Air India",
      origin: "DEL (Delhi)",
      destination: "BOM",
      terminal: "T2",
      status: "LANDED",
      arrivalTime: new Date(),
    },
  });

  // Ensure test users exist in the database
  const userIds: string[] = [];
  const BATCH_USER_SIZE = 100;
  for (let i = 0; i < TOTAL_RIDERS; i += BATCH_USER_SIZE) {
    const batchUsers = Array.from({ length: Math.min(BATCH_USER_SIZE, TOTAL_RIDERS - i) }, (_, idx) => {
      const overallIdx = i + idx;
      const isFemale = overallIdx % 2 === 0;
      return {
        id: `load_user_${overallIdx}`,
        name: `Wave Rider ${overallIdx}`,
        phone: `+9197${String(10000000 + overallIdx).padStart(8, "0")}`,
        gender: isFemale ? "FEMALE" : "MALE",
        genderVerified: isFemale,
        role: "RIDER",
      };
    });

    for (const u of batchUsers) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: { phone: u.phone },
        create: u,
      });
      userIds.push(u.id);
    }
  }

  // Clear any previous ride requests / pool memberships for this test flight
  const existingReqs = await prisma.rideRequest.findMany({
    where: { flightId: waveFlight.id },
    select: { id: true },
  });
  if (existingReqs.length > 0) {
    const reqIds = existingReqs.map((r) => r.id);
    await prisma.poolMember.deleteMany({ where: { rideRequestId: { in: reqIds } } });
    await prisma.rideRequest.deleteMany({ where: { id: { in: reqIds } } });
  }

  console.log(`✅ Flight ${waveFlight.flightNumber} ready with ${userIds.length} seeded rider identities.\n`);
  console.log(`⚡ Dispatching 500 HTTP ride requests over wire (concurrency: ${CONCURRENCY})...`);

  const results: RequestResult[] = [];
  const wallClockStart = performance.now();

  // Helper worker pool to dispatch with controlled concurrency
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < TOTAL_RIDERS) {
      const idx = currentIndex++;
      const userId = userIds[idx];
      const zone = ZONES[idx % ZONES.length];
      const isFemale = idx % 2 === 0;
      const womenOnly = isFemale && idx % 4 === 0;

      const payload = {
        userId,
        flightId: waveFlight.id,
        destinationZone: zone,
        destinationAddress: `${zone} Gateway Area, Mumbai`,
        destinationLat: 19.1 + (idx % 20) * 0.005,
        destinationLng: 72.85 + (idx % 20) * 0.005,
        luggageCount: (idx % 2) + 1,
        womenOnly,
        isReady: true,
      };

      const reqStart = performance.now();
      try {
        const response = await fetch(`${BASE_URL}/api/rides/request`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const reqEnd = performance.now();
        const latencyMs = reqEnd - reqStart;

        results.push({
          riderIndex: idx,
          statusCode: response.status,
          latencyMs,
          success: response.ok,
        });
      } catch (err: unknown) {
        const reqEnd = performance.now();
        results.push({
          riderIndex: idx,
          statusCode: 0,
          latencyMs: reqEnd - reqStart,
          success: false,
          error: (err as Error).message,
        });
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const wallClockEnd = performance.now();
  const totalDurationSec = (wallClockEnd - wallClockStart) / 1000;

  console.log("⚡ Triggering pool matching engine over HTTP...");
  const matchStart = performance.now();
  const matchRes = await fetch(`${BASE_URL}/api/pools/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flightId: waveFlight.id }),
  });
  const matchEnd = performance.now();
  const matchTimeMs = matchEnd - matchStart;
  const matchJson = await matchRes.json();
  console.log(`✅ Matching engine completed in ${matchTimeMs.toFixed(1)}ms (${matchJson.formedPoolsCount || 0} pools formed).\n`);

  // Latency metrics calculation
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  const minLatency = latencies[0] || 0;
  const maxLatency = latencies[latencies.length - 1] || 0;
  const meanLatency = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const throughput = Math.round(TOTAL_RIDERS / totalDurationSec);

  // Inspect database for final pool and fare state
  const poolsInDb = await prisma.pool.findMany({
    where: { targetFlightId: waveFlight.id },
    include: {
      members: true,
    },
  });

  const totalMembers = poolsInDb.reduce((sum, p) => sum + p.members.length, 0);
  const allPoolFares = poolsInDb.flatMap((p) => p.members.map((m) => m.poolFare));
  const allSoloFares = poolsInDb.flatMap((p) => p.members.map((m) => m.soloFare));
  const allSavings = poolsInDb.flatMap((p) => p.members.map((m) => m.savingsPct));

  const avgPoolFare = allPoolFares.length > 0 ? (allPoolFares.reduce((a, b) => a + b, 0) / allPoolFares.length).toFixed(2) : "0.00";
  const avgSoloFare = allSoloFares.length > 0 ? (allSoloFares.reduce((a, b) => a + b, 0) / allSoloFares.length).toFixed(2) : "0.00";
  const avgSavingsPct = allSavings.length > 0 ? (allSavings.reduce((a, b) => a + b, 0) / allSavings.length).toFixed(1) : "0.0";

  console.log("================================================================================");
  console.log("📊 REAL HTTP LOAD TEST BENCHMARK RESULTS (ONE LANDING WAVE)");
  console.log("================================================================================");
  console.log(`Total HTTP Requests Sent: ${TOTAL_RIDERS}`);
  console.log(`Successful Requests:      ${successCount} (200 OK)`);
  console.log(`Error Count:              ${errorCount}`);
  console.log(`Total Wall Clock Time:    ${totalDurationSec.toFixed(2)}s`);
  console.log(`HTTP Throughput:          ${throughput} requests/sec`);
  console.log("--------------------------------------------------------------------------------");
  console.log(`Latency min:              ${minLatency.toFixed(2)} ms`);
  console.log(`Latency mean:             ${meanLatency.toFixed(2)} ms`);
  console.log(`Latency p50:              ${p50.toFixed(2)} ms`);
  console.log(`Latency p95:              ${p95.toFixed(2)} ms`);
  console.log(`Latency p99:              ${p99.toFixed(2)} ms`);
  console.log(`Latency max:              ${maxLatency.toFixed(2)} ms`);
  console.log("--------------------------------------------------------------------------------");
  console.log("🚕 FINAL POOL & FARE STATE (FROM LOCAL DATABASE):");
  console.log(`Total Formed Pools:       ${poolsInDb.length}`);
  console.log(`Matched Riders:           ${totalMembers} / ${TOTAL_RIDERS}`);
  console.log(`Average Pool Occupancy:   ${(totalMembers / (poolsInDb.length || 1)).toFixed(2)} riders/pool`);
  console.log(`Average Solo Fare:        ₹${avgSoloFare}`);
  console.log(`Average Pooled Fare:      ₹${avgPoolFare}`);
  console.log(`Average Rider Savings:    ${avgSavingsPct}%`);
  console.log("================================================================================\n");

  if (errorCount > 0) {
    console.error(`⚠️ Benchmark completed with ${errorCount} errors.`);
    process.exit(1);
  } else {
    console.log("✅ Real HTTP load test successfully verified against production build!");
  }
}

runRealHttpLoadBenchmark().catch((err) => {
  console.error("Fatal benchmark runner error:", err);
  process.exit(1);
});
