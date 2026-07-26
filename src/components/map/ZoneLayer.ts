import type { ZoneFeature } from "@/types";

// We no longer tint the zone (the price choropleth carries the colour now, matching
// the reference). We keep the centroid helper for the floating price card.
export function zoneCentroid(zone: ZoneFeature): [number, number] {
  const ring = zone.geometry.coordinates[0];
  let x = 0;
  let y = 0;
  for (const [lng, lat] of ring) {
    x += lng;
    y += lat;
  }
  return [x / ring.length, y / ring.length];
}
