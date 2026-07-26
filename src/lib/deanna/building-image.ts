import type { BuildingGeometry } from "@/types";
import type { Position } from "geojson";

// Building imagery for the MiniStore cover.
//
// AERIAL (active): IGN PNOA "máxima actualidad" orthophoto — official Spanish
// national aerial imagery, free, no API key. Returns a direct image URL (a WMS
// GetMap request) that Deanna can store and render as-is. Honest provenance:
// "IGN PNOA · OFICIAL".
//
// STREET VIEW (hook, not yet enabled): a street-level facade photo needs a
// Google Maps key, which must be proxied server-side so it never leaks (like the
// Idealista/Deanna proxies). See buildingStreetViewUrl() below.

const PNOA_WMS = "https://www.ign.es/wms-inspire/pnoa-ma";
const IMG_W = 512;
const IMG_H = 384; // 4:3

function geomBounds(geom: BuildingGeometry) {
  const rings: Position[][] =
    geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minLng) minLng = x;
      if (x > maxLng) maxLng = x;
      if (y < minLat) minLat = y;
      if (y > maxLat) maxLat = y;
    }
  }
  return { minLng, minLat, maxLng, maxLat };
}

// Aerial orthophoto framed on the building, centred on its centroid, with a
// sensible minimum frame and 4:3 aspect so the WMS image isn't distorted.
export function buildingAerialImageUrl(
  centroid: { lat: number; lng: number },
  geometry?: BuildingGeometry | null,
): string {
  const { lat, lng } = centroid;
  const mPerDegLat = 110_540;
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);

  // Default frame ≈ 120 m × 160 m of ground; grow it if the footprint is larger.
  let halfLatM = 60;
  let halfLngM = 80;
  if (geometry) {
    const b = geomBounds(geometry);
    halfLatM = Math.max(halfLatM, ((b.maxLat - b.minLat) * mPerDegLat) * 0.7 + 25);
    halfLngM = Math.max(halfLngM, ((b.maxLng - b.minLng) * mPerDegLng) * 0.7 + 25);
  }
  // Match the image aspect ratio to avoid stretching.
  const aspect = IMG_W / IMG_H;
  if (halfLngM / halfLatM < aspect) halfLngM = halfLatM * aspect;
  else halfLatM = halfLngM / aspect;

  const dLat = halfLatM / mPerDegLat;
  const dLng = halfLngM / mPerDegLng;
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  const bbox = [round(lng - dLng), round(lat - dLat), round(lng + dLng), round(lat + dLat)].join(",");

  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1", // 1.1.1 keeps BBOX in lng,lat order (no axis-order surprises)
    REQUEST: "GetMap",
    LAYERS: "OI.OrthoimageCoverage",
    SRS: "EPSG:4326",
    BBOX: bbox,
    WIDTH: String(IMG_W),
    HEIGHT: String(IMG_H),
    FORMAT: "image/jpeg",
    STYLES: "",
  });
  return `${PNOA_WMS}?${params.toString()}`;
}

// Street-level facade photo (Google Street View) served by THIS app's own
// endpoint — /api/facade (Vite proxy in dev, serverless function in prod, both
// sharing api/_facade-core.mjs). The Google key stays in this app's server env;
// Deanna just stores the resulting public URL. deanna2u is never touched.
//
// The URL must be absolute so it renders inside a Deanna-hosted MiniStore, so it
// points at this app's public origin. Defaults to the current origin (set
// VITE_MAP_PUBLIC_BASE to the deployed domain if the app is embedded elsewhere).
const MAP_PUBLIC_BASE = (
  import.meta.env.VITE_MAP_PUBLIC_BASE ||
  (typeof window !== "undefined" ? window.location.origin : "")
).replace(/\/$/, "");

export function buildingFacadeUrl(centroid: { lat: number; lng: number }): string {
  return `${MAP_PUBLIC_BASE}/api/facade?lat=${centroid.lat}&lng=${centroid.lng}`;
}

// A facade URL only renders inside a Deanna-hosted MiniStore if this app is at a
// public origin (deanna.pro can't reach your localhost). So in local dev we skip
// the facade rather than store a broken image — it appears once the app is
// deployed (or VITE_MAP_PUBLIC_BASE points at a public URL / tunnel).
function isPubliclyReachable(): boolean {
  if (import.meta.env.VITE_MAP_PUBLIC_BASE) return true;
  if (typeof window === "undefined") return false;
  return !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|\/|$)/i.test(window.location.origin);
}

// Free metadata pre-check so we only add a facade clipping when Street View
// imagery actually exists. Degrades to false if the endpoint isn't reachable
// (e.g. no key configured, or the app isn't deployed with its serverless fn yet).
export async function facadeAvailable(centroid: { lat: number; lng: number }): Promise<boolean> {
  if (!isPubliclyReachable()) return false;
  try {
    const res = await fetch(
      `${MAP_PUBLIC_BASE}/api/facade?meta=1&lat=${centroid.lat}&lng=${centroid.lng}`,
    );
    if (!res.ok) return false;
    const json = (await res.json()) as { available?: boolean };
    return !!json.available;
  } catch {
    return false;
  }
}
