import type { Listing } from "@/types";
import { centroidOf } from "@/lib/geo/geometry";
import { demoBuildingsCollection } from "./demo-buildings";

// Build raw mock listings scattered near the demo buildings. Matching (exact vs
// nearby) is decided later by geometry, exactly as it would be for real API data.
const M_LAT = 1 / 111_320;
const M_LNG = 1 / (111_320 * Math.cos((40.4188 * Math.PI) / 180));

interface Raw {
  buildingIdx: number;
  offsetM: [number, number]; // metres from that building's centroid
  operation: "sale" | "rent";
  price: number;
  sizeM2: number;
  rooms: number;
  bathrooms: number;
  propertyType: string;
}

const RAW: Raw[] = [
  { buildingIdx: 0, offsetM: [2, 3], operation: "sale", price: 650000, sizeM2: 120, rooms: 3, bathrooms: 2, propertyType: "piso" },
  { buildingIdx: 0, offsetM: [-4, 5], operation: "rent", price: 1800, sizeM2: 85, rooms: 2, bathrooms: 1, propertyType: "piso" },
  { buildingIdx: 2, offsetM: [6, -2], operation: "sale", price: 890000, sizeM2: 150, rooms: 4, bathrooms: 2, propertyType: "piso" },
  { buildingIdx: 2, offsetM: [22, 10], operation: "rent", price: 2400, sizeM2: 110, rooms: 3, bathrooms: 2, propertyType: "ático" },
  { buildingIdx: 4, offsetM: [3, -3], operation: "sale", price: 540000, sizeM2: 95, rooms: 2, bathrooms: 1, propertyType: "piso" },
  { buildingIdx: 6, offsetM: [40, 15], operation: "sale", price: 720000, sizeM2: 130, rooms: 3, bathrooms: 2, propertyType: "piso" },
  { buildingIdx: 10, offsetM: [1, 1], operation: "sale", price: 1150000, sizeM2: 180, rooms: 4, bathrooms: 3, propertyType: "ático" },
  { buildingIdx: 10, offsetM: [80, 30], operation: "rent", price: 1500, sizeM2: 70, rooms: 2, bathrooms: 1, propertyType: "estudio" },
];

export function getDemoListingsNear(): Listing[] {
  const feats = demoBuildingsCollection.features;
  return RAW.map((r, i) => {
    const c = centroidOf(feats[r.buildingIdx].geometry);
    const lng = c.lng + r.offsetM[0] * M_LNG;
    const lat = c.lat + r.offsetM[1] * M_LAT;
    return {
      id: `demo-listing-${i + 1}`,
      operation: r.operation,
      price: r.price,
      sizeM2: r.sizeM2,
      rooms: r.rooms,
      bathrooms: r.bathrooms,
      propertyType: r.propertyType,
      addressOrArea: "Barrio de Ibiza, Madrid",
      url: null,
      updatedAt: new Date().toISOString().slice(0, 10),
      location: { lat, lng },
      source: "Mock",
      sourceType: "DEMO" as const,
      match: "LOW" as const, // recomputed by the matcher against the selected building
    };
  });
}
