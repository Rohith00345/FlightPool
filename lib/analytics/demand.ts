import { prisma } from "../prisma";
import { MUMBAI_ZONES } from "../geo";

export interface CorridorDemandProjection {
  zone: string;
  expectedRiders: number;
  projectedPools: number;
  availableDrivers: number;
  supplyDeficit: number; // positive if shortage, 0 if balanced
  demandLevel: "LOW" | "MODERATE" | "HIGH" | "SURGE";
  estimatedAvgSavingsRupees: number;
  recommendedDriverPositioning: number;
}

export interface ArrivalWaveForecast {
  waveWindow: string; // e.g. "18:00 - 18:30"
  flightCount: number;
  totalArrivalPassengers: number;
  expectedPoolDemandCount: number;
  corridors: CorridorDemandProjection[];
}

export interface DemandForecastResponse {
  forecastTime: string;
  totalIncomingFlights: number;
  peakWaveWindow: string;
  activeDriverCount: number;
  corridorSummary: Record<string, { expectedRiders: number; recommendedDrivers: number; demandLevel: string }>;
  hourlyWaves: ArrivalWaveForecast[];
}

// Typical historical corridor split at BOM Airport
const CORRIDOR_SHARE: Record<string, number> = {
  Thane: 0.28,
  Powai: 0.22,
  Bandra: 0.18,
  Andheri: 0.14,
  "Navi Mumbai": 0.12,
  Mulund: 0.06,
};

/**
 * Computes predictive pre-matching corridor demand forecast from scheduled flight arrivals.
 */
export async function computeCorridorDemandForecast(): Promise<DemandForecastResponse> {
  const flights = await prisma.flight.findMany({
    where: {
      status: { in: ["SCHEDULED", "ON_TIME", "DELAYED"] },
    },
    orderBy: { arrivalTime: "asc" },
  });

  const activeDriverCount = await prisma.driver.count({
    where: { isAvailable: true },
  });

  // Assume avg 160 passengers per narrowbody flight, ~15% market capture for airport cab pooling
  const totalFlights = flights.length;
  const estimatedRidersPerFlight = Math.round(160 * 0.15); // ~24 pooled riders per flight

  const corridorTotals: Record<string, { expectedRiders: number; recommendedDrivers: number; demandLevel: string }> = {};
  for (const zone of Object.keys(MUMBAI_ZONES)) {
    corridorTotals[zone] = { expectedRiders: 0, recommendedDrivers: 0, demandLevel: "LOW" };
  }

  // Group flights into 1-hour waves
  const waveMap = new Map<string, { count: number; passengers: number }>();
  for (const f of flights) {
    const d = new Date(f.arrivalTime);
    const hour = d.getUTCHours();
    const waveKey = `${String(hour).padStart(2, "0")}:00 - ${String((hour + 1) % 24).padStart(2, "0")}:00`;

    const current = waveMap.get(waveKey) || { count: 0, passengers: 0 };
    waveMap.set(waveKey, {
      count: current.count + 1,
      passengers: current.passengers + 160,
    });
  }

  let peakWave = "None";
  let peakCount = -1;

  const hourlyWaves: ArrivalWaveForecast[] = [];
  for (const [windowKey, data] of waveMap.entries()) {
    if (data.count > peakCount) {
      peakCount = data.count;
      peakWave = windowKey;
    }

    const waveRiders = data.count * estimatedRidersPerFlight;
    const corridors: CorridorDemandProjection[] = [];

    for (const zone of Object.keys(MUMBAI_ZONES)) {
      const share = CORRIDOR_SHARE[zone] || 0.1;
      const expectedZoneRiders = Math.round(waveRiders * share);
      const projectedPools = Math.ceil(expectedZoneRiders / 2.5);
      const allocatedDrivers = Math.floor((activeDriverCount * share) || 1);
      const supplyDeficit = Math.max(0, projectedPools - allocatedDrivers);

      let demandLevel: "LOW" | "MODERATE" | "HIGH" | "SURGE" = "LOW";
      if (expectedZoneRiders >= 20) demandLevel = "SURGE";
      else if (expectedZoneRiders >= 12) demandLevel = "HIGH";
      else if (expectedZoneRiders >= 6) demandLevel = "MODERATE";

      corridors.push({
        zone,
        expectedRiders: expectedZoneRiders,
        projectedPools,
        availableDrivers: allocatedDrivers,
        supplyDeficit,
        demandLevel,
        estimatedAvgSavingsRupees: Math.round(180 + share * 100),
        recommendedDriverPositioning: Math.max(projectedPools, 2),
      });

      // Accumulate
      corridorTotals[zone].expectedRiders += expectedZoneRiders;
      corridorTotals[zone].recommendedDrivers += projectedPools;
      if (demandLevel === "SURGE" || (demandLevel === "HIGH" && corridorTotals[zone].demandLevel !== "SURGE")) {
        corridorTotals[zone].demandLevel = demandLevel;
      }
    }

    hourlyWaves.push({
      waveWindow: windowKey,
      flightCount: data.count,
      totalArrivalPassengers: data.passengers,
      expectedPoolDemandCount: waveRiders,
      corridors,
    });
  }

  return {
    forecastTime: new Date().toISOString(),
    totalIncomingFlights: totalFlights,
    peakWaveWindow: peakWave,
    activeDriverCount,
    corridorSummary: corridorTotals,
    hourlyWaves,
  };
}
