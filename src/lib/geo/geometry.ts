import type { Position } from "geojson";
import type { BuildingGeometry } from "@/types";

// Centroid of a (multi)polygon's first ring — good enough for point queries.
export function centroidOf(geom: BuildingGeometry): { lat: number; lng: number } {
  const ring: Position[] =
    geom.type === "Polygon" ? geom.coordinates[0] : geom.coordinates[0][0];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  const n = ring.length || 1;
  return { lng: sx / n, lat: sy / n };
}

// Planar area in m^2 via the shoelace formula, using a local equirectangular
// projection at the ring's latitude. Fine for building-scale footprints.
export function polygonAreaM2(geom: BuildingGeometry): number {
  const rings: Position[][] =
    geom.type === "Polygon" ? [geom.coordinates[0]] : geom.coordinates.map((p) => p[0]);
  let total = 0;
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const lat0 = ring[0][1];
    const mPerDegLat = 111_320;
    const mPerDegLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const x1 = ring[i][0] * mPerDegLng;
      const y1 = ring[i][1] * mPerDegLat;
      const x2 = ring[i + 1][0] * mPerDegLng;
      const y2 = ring[i + 1][1] * mPerDegLat;
      sum += x1 * y2 - x2 * y1;
    }
    total += Math.abs(sum) / 2;
  }
  return Math.round(total);
}

// Ray-casting point-in-polygon on the outer ring.
export function pointInPolygon(
  lng: number,
  lat: number,
  geom: BuildingGeometry
): boolean {
  const polys: Position[][][] =
    geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys) {
    const ring = poly[0];
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      const intersect =
        yi > lat !== yj > lat &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

// Haversine distance in metres.
export function distanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
