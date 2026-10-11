/**
 * Driver Virtual Queue & Airport Geofence Engine
 *
 * Implements a FIFO queue for commercial drivers staging at CSMIA Mumbai.
 * Reduces curbside terminal congestion, enforces geographic staging boundaries,
 * and computes deterministic queue telemetry and bay assignments.
 */

export interface TerminalGeofence {
  code: "T1" | "T2";
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  bays: string[];
}

export const AIRPORT_GEOFENCES: Record<"T1" | "T2", TerminalGeofence> = {
  T2: {
    code: "T2",
    name: "CSMIA Terminal 2 (Sahar / International & Domestic)",
    lat: 19.0968,
    lng: 72.8745,
    radiusKm: 2.5,
    bays: ["P4 Bay A", "P4 Bay B", "P4 Bay C", "P4 Bay D"],
  },
  T1: {
    code: "T1",
    name: "CSMIA Terminal 1 (Santacruz / Domestic)",
    lat: 19.0886,
    lng: 72.8679,
    radiusKm: 2.5,
    bays: ["Lane 1 Bay A", "Lane 1 Bay B"],
  },
};

/**
 * Calculates Great-Circle distance using Haversine formula in kilometers.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100; // Round to 2 decimal places (meters precision)
}

/**
 * Verifies if coordinates fall within terminal staging boundary.
 */
export function verifyAirportGeofence(
  lat: number,
  lng: number,
  preferredTerminal?: "T1" | "T2"
): { inGeofence: boolean; distanceKm: number; nearestTerminal: "T1" | "T2" } {
  const distT2 = calculateHaversineDistanceKm(lat, lng, AIRPORT_GEOFENCES.T2.lat, AIRPORT_GEOFENCES.T2.lng);
  const distT1 = calculateHaversineDistanceKm(lat, lng, AIRPORT_GEOFENCES.T1.lat, AIRPORT_GEOFENCES.T1.lng);

  const nearestTerminal: "T1" | "T2" = distT2 <= distT1 ? "T2" : "T1";
  const targetTerminal = preferredTerminal || nearestTerminal;
  const targetDistance = targetTerminal === "T2" ? distT2 : distT1;
  const threshold = AIRPORT_GEOFENCES[targetTerminal].radiusKm;

  return {
    inGeofence: targetDistance <= threshold,
    distanceKm: targetDistance,
    nearestTerminal: targetTerminal,
  };
}

import { prisma } from "./prisma";

export interface DriverQueueEntry {
  driverId: string;
  driverName: string;
  phone: string;
  vehiclePlate: string;
  terminalCode: "T1" | "T2";
  joinedAt: Date;
  lastHeartbeatAt: Date;
  assignedBay: string;
  lat: number;
  lng: number;
}

// In-memory fallback registry indexed by terminal
const queueRegistry: Record<"T1" | "T2", DriverQueueEntry[]> = {
  T1: [],
  T2: [],
};

/**
 * Joins a driver to the airport virtual queue if within geofence.
 * Persists to PostgreSQL via Prisma with in-memory fallback.
 */
export async function joinDriverQueue(params: {
  driverId: string;
  driverName: string;
  phone: string;
  vehiclePlate: string;
  terminalCode?: "T1" | "T2";
  lat: number;
  lng: number;
}): Promise<{
  success: boolean;
  position: number;
  totalInQueue: number;
  estimatedWaitMin: number;
  assignedBay: string;
  terminalCode: "T1" | "T2";
  error?: string;
}> {
  const geofenceCheck = verifyAirportGeofence(params.lat, params.lng, params.terminalCode);
  if (!geofenceCheck.inGeofence) {
    return {
      success: false,
      position: 0,
      totalInQueue: 0,
      estimatedWaitMin: 0,
      assignedBay: "",
      terminalCode: geofenceCheck.nearestTerminal,
      error: `Outside airport staging area (${geofenceCheck.distanceKm} km from ${geofenceCheck.nearestTerminal}). Must be within 2.5 km.`,
    };
  }

  const terminal = geofenceCheck.nearestTerminal;
  const availableBays = AIRPORT_GEOFENCES[terminal].bays;
  const now = new Date();

  // Try DB persistence first
  try {
    // Ensure driver record exists in DB to satisfy foreign key constraint
    let driverRecord = await prisma.driver.findFirst({
      where: {
        OR: [{ id: params.driverId }, { phone: params.phone }],
      },
    });

    if (!driverRecord) {
      driverRecord = await prisma.driver.create({
        data: {
          id: params.driverId,
          name: params.driverName,
          phone: params.phone,
          isAvailable: true,
          rating: 5.0,
        },
      }).catch(() => null);
    }

    const resolvedDriverId = driverRecord?.id || params.driverId;

    // Remove any previous active queue entry for this driver
    await prisma.driverQueueEntry.deleteMany({
      where: { driverId: resolvedDriverId },
    }).catch(() => {});

    const activeQueueCount = await prisma.driverQueueEntry.count({
      where: { terminalCode: terminal, status: "QUEUED" },
    });

    const assignedBay = availableBays[activeQueueCount % availableBays.length];

    await prisma.driverQueueEntry.create({
      data: {
        driverId: resolvedDriverId,
        driverName: params.driverName,
        phone: params.phone,
        vehiclePlate: params.vehiclePlate,
        terminalCode: terminal,
        assignedBay,
        lat: params.lat,
        lng: params.lng,
        status: "QUEUED",
        joinedAt: now,
        lastHeartbeatAt: now,
      },
    });

    const position = activeQueueCount + 1;
    const totalInQueue = activeQueueCount + 1;
    const estimatedWaitMin = Math.max(3, position * 4);

    // Keep fallback in sync
    syncInMemoryJoin(terminal, {
      driverId: params.driverId,
      driverName: params.driverName,
      phone: params.phone,
      vehiclePlate: params.vehiclePlate,
      terminalCode: terminal,
      joinedAt: now,
      lastHeartbeatAt: now,
      assignedBay,
      lat: params.lat,
      lng: params.lng,
    });

    return {
      success: true,
      position,
      totalInQueue,
      estimatedWaitMin,
      assignedBay,
      terminalCode: terminal,
    };
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[DriverQueue] Database write failure during joinDriverQueue:", err);
      return {
        success: false,
        position: 0,
        totalInQueue: 0,
        estimatedWaitMin: 0,
        assignedBay: "",
        terminalCode: terminal,
        error: "Database error: unable to queue driver. Please retry.",
      };
    }

    // In-memory fallback ONLY when NODE_ENV is "test"
    const queue = queueRegistry[terminal];
    leaveInMemory(params.driverId);

    const bayIndex = queue.length % availableBays.length;
    const assignedBay = availableBays[bayIndex];

    const entry: DriverQueueEntry = {
      driverId: params.driverId,
      driverName: params.driverName,
      phone: params.phone,
      vehiclePlate: params.vehiclePlate,
      terminalCode: terminal,
      joinedAt: now,
      lastHeartbeatAt: now,
      assignedBay,
      lat: params.lat,
      lng: params.lng,
    };
    queue.push(entry);

    const position = queue.length;
    return {
      success: true,
      position,
      totalInQueue: queue.length,
      estimatedWaitMin: Math.max(3, position * 4),
      assignedBay,
      terminalCode: terminal,
    };
  }
}

function syncInMemoryJoin(terminal: "T1" | "T2", entry: DriverQueueEntry) {
  leaveInMemory(entry.driverId);
  queueRegistry[terminal].push(entry);
}

function leaveInMemory(driverId: string): boolean {
  for (const t of ["T2", "T1"] as const) {
    const q = queueRegistry[t];
    const idx = q.findIndex((e) => e.driverId === driverId);
    if (idx !== -1) {
      q.splice(idx, 1);
      return true;
    }
  }
  return false;
}

/**
 * Returns current virtual queue status for a driver.
 */
export async function getDriverQueueStatus(driverId: string): Promise<{
  inQueue: boolean;
  position?: number;
  totalInQueue?: number;
  estimatedWaitMin?: number;
  assignedBay?: string;
  terminalCode?: "T1" | "T2";
  joinedAt?: string;
}> {
  try {
    const entry = await prisma.driverQueueEntry.findFirst({
      where: { driverId, status: "QUEUED" },
    });

    if (entry) {
      // Update heartbeat
      await prisma.driverQueueEntry.update({
        where: { id: entry.id },
        data: { lastHeartbeatAt: new Date() },
      }).catch(() => {});

      const aheadCount = await prisma.driverQueueEntry.count({
        where: {
          terminalCode: entry.terminalCode,
          status: "QUEUED",
          joinedAt: { lt: entry.joinedAt },
        },
      });

      const position = aheadCount + 1;
      const totalInQueue = await prisma.driverQueueEntry.count({
        where: { terminalCode: entry.terminalCode, status: "QUEUED" },
      });

      return {
        inQueue: true,
        position,
        totalInQueue,
        estimatedWaitMin: Math.max(3, position * 4),
        assignedBay: entry.assignedBay,
        terminalCode: entry.terminalCode as "T1" | "T2",
        joinedAt: entry.joinedAt.toISOString(),
      };
    }
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[DriverQueue] Database query failure during getDriverQueueStatus:", err);
      return { inQueue: false };
    }
  }

  // Fallback to in-memory check ONLY when NODE_ENV is "test"
  if (process.env.NODE_ENV === "test") {
    for (const terminal of ["T2", "T1"] as const) {
      const queue = queueRegistry[terminal];
      const index = queue.findIndex((e) => e.driverId === driverId);
      if (index !== -1) {
        const entry = queue[index];
        entry.lastHeartbeatAt = new Date();
        const position = index + 1;
        return {
          inQueue: true,
          position,
          totalInQueue: queue.length,
          estimatedWaitMin: Math.max(3, position * 4),
          assignedBay: entry.assignedBay,
          terminalCode: terminal,
          joinedAt: entry.joinedAt.toISOString(),
        };
      }
    }
  }

  return { inQueue: false };
}

/**
 * Removes a driver from the virtual queue.
 */
export async function leaveDriverQueue(driverId: string): Promise<{ success: boolean }> {
  let dbRemoved = false;
  try {
    const deleted = await prisma.driverQueueEntry.deleteMany({
      where: { driverId },
    });
    dbRemoved = deleted.count > 0;
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[DriverQueue] Database delete failure during leaveDriverQueue:", err);
      return { success: false };
    }
  }

  const memRemoved = process.env.NODE_ENV === "test" ? leaveInMemory(driverId) : false;
  return { success: dbRemoved || memRemoved };
}

/**
 * Retrieves the complete FIFO queue for a terminal (for ops / dispatch views).
 */
export async function getTerminalQueue(terminalCode: "T1" | "T2"): Promise<DriverQueueEntry[]> {
  try {
    const entries = await prisma.driverQueueEntry.findMany({
      where: { terminalCode, status: "QUEUED" },
      orderBy: { joinedAt: "asc" },
    });
    if (entries.length > 0) {
      return entries.map((e) => ({
        driverId: e.driverId,
        driverName: e.driverName,
        phone: e.phone,
        vehiclePlate: e.vehiclePlate,
        terminalCode: e.terminalCode as "T1" | "T2",
        joinedAt: e.joinedAt,
        lastHeartbeatAt: e.lastHeartbeatAt,
        assignedBay: e.assignedBay,
        lat: e.lat,
        lng: e.lng,
      }));
    }
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[DriverQueue] Database query failure during getTerminalQueue:", err);
      return [];
    }
  }

  return process.env.NODE_ENV === "test" ? [...queueRegistry[terminalCode]] : [];
}

/**
 * Resets queues (strictly for testing isolation).
 */
export async function resetDriverQueues(terminalCode?: "T1" | "T2"): Promise<void> {
  if (terminalCode) {
    queueRegistry[terminalCode] = [];
    try {
      await prisma.driverQueueEntry.deleteMany({ where: { terminalCode } });
    } catch {
      // fallback
    }
  } else {
    queueRegistry.T1 = [];
    queueRegistry.T2 = [];
    try {
      await prisma.driverQueueEntry.deleteMany({});
    } catch {
      // fallback
    }
  }
}
