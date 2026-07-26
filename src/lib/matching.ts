import type { Listing, MatchConfidence, BuildingGeometry } from "@/types";
import { pointInPolygon, distanceM, centroidOf } from "@/lib/geo/geometry";

// Classify how confidently a listing belongs to a specific building.
//   EXACT  — coordinates fall inside the building footprint
//   HIGH   — very close (<25 m) and address hints agree
//   MEDIUM — nearby (<80 m) but address unconfirmed
//   LOW    — within a wider radius only
export function classifyListing(
  listing: Listing,
  building: { geometry: BuildingGeometry | null; centroid: { lat: number; lng: number }; address?: string | null }
): MatchConfidence {
  if (!listing.location) return "LOW";
  const { lat, lng } = listing.location;

  if (building.geometry && pointInPolygon(lng, lat, building.geometry)) {
    return "EXACT";
  }
  const ref = building.geometry ? centroidOf(building.geometry) : building.centroid;
  const d = distanceM(ref, { lat, lng });

  const addressAgrees =
    !!building.address &&
    !!listing.addressOrArea &&
    building.address.toLowerCase().split(",")[0].trim().length > 0 &&
    listing.addressOrArea.toLowerCase().includes("ibiza"); // demo heuristic

  if (d < 25 && addressAgrees) return "HIGH";
  if (d < 80) return "MEDIUM";
  return "LOW";
}

export function splitByConfidence(listings: Listing[]) {
  const inBuilding = listings.filter((l) => l.match === "EXACT" || l.match === "HIGH");
  const nearby = listings.filter((l) => l.match === "MEDIUM" || l.match === "LOW");
  return { inBuilding, nearby };
}
