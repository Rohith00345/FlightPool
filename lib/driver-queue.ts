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

// In-memory FIFO queue registry indexed by terminal
const queueRegistry: Record<"T1" | "T2", DriverQueueEntry[]> = {
  T1: [],
  T2: [],
};

/**
 * Joins a driver to the airport virtual queue if within geofence.
 */
export function joinDriverQueue(params: {
  driverId: string;
  driverName: string;
  phone: string;
  vehiclePlate: string;
  terminalCode?: "T1" | "T2";
  lat: number;
  lng: number;
}): {
  success: boolean;
  position: number;
  totalInQueue: number;
  estimatedWaitMin: number;
  assignedBay: string;
  terminalCode: "T1" | "T2";
  error?: string;
} {
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
  const queue = queueRegistry[terminal];

  // Check if driver is already in any queue; if so, update their entry
  leaveDriverQueue(params.driverId);

  const availableBays = AIRPORT_GEOFENCES[terminal].bays;
  const bayIndex = queue.length % availableBays.length;
  const assignedBay = availableBays[bayIndex];

  const now = new Date();
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
  const estimatedWaitMin = Math.max(3, position * 4); // 4 minutes per car ahead

  return {
    success: true,
    position,
    totalInQueue: queue.length,
    estimatedWaitMin,
    assignedBay,
    terminalCode: terminal,
  };
}

/**
 * Returns current virtual queue status for a driver.
 */
export function getDriverQueueStatus(driverId: string): {
  inQueue: boolean;
  position?: number;
  totalInQueue?: number;
  estimatedWaitMin?: number;
  assignedBay?: string;
  terminalCode?: "T1" | "T2";
  joinedAt?: string;
} {
  for (const terminal of ["T2", "T1"] as const) {
    const queue = queueRegistry[terminal];
    const index = queue.findIndex((entry) => entry.driverId === driverId);
    if (index !== -1) {
      const entry = queue[index];
      // Update heartbeat on check
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

  return { inQueue: false };
}

/**
 * Removes a driver from the virtual queue.
 */
export function leaveDriverQueue(driverId: string): { success: boolean } {
  for (const terminal of ["T2", "T1"] as const) {
    const queue = queueRegistry[terminal];
    const index = queue.findIndex((entry) => entry.driverId === driverId);
    if (index !== -1) {
      queue.splice(index, 1);
      return { success: true };
    }
  }
  return { success: false };
}

/**
 * Retrieves the complete FIFO queue for a terminal (for ops / dispatch views).
 */
export function getTerminalQueue(terminalCode: "T1" | "T2"): DriverQueueEntry[] {
  return [...queueRegistry[terminalCode]];
}

/**
 * Resets queues (strictly for testing isolation).
 */
export function resetDriverQueues(): void {
  queueRegistry.T1 = [];
  queueRegistry.T2 = [];
}
