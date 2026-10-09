export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ZoneCluster {
  id: string;
  name: string;
  nameHi: string;
  center: Coordinates;
  corridor: string; // Used for clustering compatible corridors
  approxDistanceKmFromT2: number;
  popularDropoffs: string[];
}

export const AIRPORT_TERMINALS: Record<
  "T1" | "T2",
  { name: string; nameHi: string; coords: Coordinates }
> = {
  T1: {
    name: "Mumbai Airport Terminal 1 (Domestic / Santacruz)",
    nameHi: "मुंबई हवाई अड्डा टर्मिनल १ (सांताक्रूज़)",
    coords: { lat: 19.0896, lng: 72.8656 },
  },
  T2: {
    name: "Mumbai Airport Terminal 2 (International & Domestic / Sahar)",
    nameHi: "मुंबई हवाई अड्डा टर्मिनल २ (सहार)",
    coords: { lat: 19.0968, lng: 72.8750 },
  },
};

export const MUMBAI_ZONES: Record<string, ZoneCluster> = {
  Thane: {
    id: "Thane",
    name: "Thane",
    nameHi: "ठाणे",
    center: { lat: 19.2183, lng: 72.9781 },
    corridor: "Eastern_Express",
    approxDistanceKmFromT2: 24.5,
    popularDropoffs: [
      "Hiranandani Estate, Ghodbunder Rd",
      "Majiwada Junction",
      "Viviana Mall Area",
      "Vasant Vihar, Pokhran Rd No 2",
    ],
  },
  Mulund: {
    id: "Mulund",
    name: "Mulund",
    nameHi: "मुलुंड",
    center: { lat: 19.1726, lng: 72.9425 },
    corridor: "Eastern_Express",
    approxDistanceKmFromT2: 17.5,
    popularDropoffs: [
      "LBS Marg / Nirmal Lifestyle",
      "Sarvodaya Nagar, Mulund West",
      "Mulund East Station",
      "Devidayal Road",
    ],
  },
  Powai: {
    id: "Powai",
    name: "Powai",
    nameHi: "पवई",
    center: { lat: 19.1176, lng: 72.9060 },
    corridor: "JVLR_Central",
    approxDistanceKmFromT2: 8.5,
    popularDropoffs: [
      "Hiranandani Gardens, Central Avenue",
      "IIT Bombay Main Gate / JVLR",
      "Galleria Shopping Mall",
      "Raheja Vihar, Chandivali",
    ],
  },
  Bandra: {
    id: "Bandra",
    name: "Bandra",
    nameHi: "बांद्रा",
    center: { lat: 19.0596, lng: 72.8295 },
    corridor: "Western_South",
    approxDistanceKmFromT2: 11.2,
    popularDropoffs: [
      "Bandra Kurla Complex (BKC) G Block",
      "Hill Road, Bandra West",
      "Carter Road Promenade",
      "Pali Hill",
    ],
  },
  Andheri: {
    id: "Andheri",
    name: "Andheri",
    nameHi: "अंधेरी",
    center: { lat: 19.1363, lng: 72.8277 },
    corridor: "Western_North",
    approxDistanceKmFromT2: 7.8,
    popularDropoffs: [
      "Lokhandwala Complex, Andheri West",
      "Versova Metro / Link Road",
      "DN Nagar Metro",
      "Four Bungalows",
    ],
  },
  "Navi Mumbai": {
    id: "Navi Mumbai",
    name: "Navi Mumbai",
    nameHi: "नवी मुंबई",
    center: { lat: 19.0771, lng: 72.9986 },
    corridor: "Sion_Panvel",
    approxDistanceKmFromT2: 23.8,
    popularDropoffs: [
      "Vashi Sector 17",
      "Palm Beach Road, Nerul",
      "Kopar Khairane Sector 5",
      "Seawoods Grand Central",
    ],
  },
};

/**
 * Haversine formula calculates the great-circle distance between two points in km.
 */
export function haversineDistanceKm(p1: Coordinates, p2: Coordinates): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Calculates road distance by applying Mumbai road circuity factor (~1.32x)
 */
export function estimateRoadDistanceKm(
  origin: Coordinates,
  destination: Coordinates,
  circuityMultiplier = 1.32
): number {
  const straightLine = haversineDistanceKm(origin, destination);
  return Number((straightLine * circuityMultiplier).toFixed(2));
}

/**
 * Estimates duration in minutes given road distance and average Mumbai traffic speed (~25 km/h).
 * Adds 3 minutes buffer for traffic junctions/signals.
 */
export function estimateDurationMinutes(
  roadDistanceKm: number,
  trafficMultiplier = 1.0,
  avgSpeedKmph = 24
): number {
  const rawMinutes = (roadDistanceKm / avgSpeedKmph) * 60;
  const total = rawMinutes * trafficMultiplier + 2;
  return Math.round(total);
}
