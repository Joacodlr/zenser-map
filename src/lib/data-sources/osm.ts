import type {
  BBox,
  BuildingFeature,
  BuildingFeatureCollection,
  BuildingGeometry,
  BuildingDetails,
} from "@/types";
import { sourced, unavailable } from "@/types";
import { centroidOf, polygonAreaM2, pointInPolygon } from "@/lib/geo/geometry";
import { estimatePricePerM2 } from "@/lib/calculations/price";

// Real building footprints via the OpenStreetMap Overpass API. In Madrid, OSM
// buildings were bulk-imported from Catastro, so footprints (and often ref:catastro,
// building:levels, start_date, addresses) are real. Overpass has CORS and no bot
// blocking, so it works straight from the browser — no proxy needed.
//
// NOTE: The DEFAULT real source is the bundled static snapshot (see snapshot.ts),
// which makes zero runtime Overpass calls. This live source is kept as an opt-in
// fallback (VITE_REAL_SOURCE=osm) and shares its tag→provenance mapping with the
// snapshot via the exported helpers below, so both stay identical and honest.
//
// Attribution required by OSM: "© OpenStreetMap contributors" (ODbL).

// Overpass mirrors, tried in order on 429/timeout/failure.
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

interface OsmNode { lat: number; lon: number }
interface OsmElement {
  type: string;
  id: number;
  geometry?: OsmNode[];
  tags?: Record<string, string>;
}

async function overpass(bbox: BBox): Promise<OsmElement[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  // Overpass bbox order is (south,west,north,east).
  const q =
    `[out:json][timeout:25];` +
    `way["building"](${minLat},${minLng},${maxLat},${maxLng});` +
    `out geom;`;
  const body = "data=" + encodeURIComponent(q);

  let lastErr: unknown;
  // Rotate across mirrors; on each 429/timeout back off then try the next one.
  for (let i = 0; i < MIRRORS.length; i++) {
    try {
      const res = await fetch(MIRRORS[i], {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(25_000),
      });
      if (res.status === 429 || res.status === 504) {
        // Exponential-ish backoff before falling through to the next mirror.
        await new Promise((r) => setTimeout(r, 800 * (i + 1)));
        lastErr = new Error("OVERPASS_429");
        continue;
      }
      if (!res.ok) throw new Error(`OVERPASS_${res.status}`);
      const json = (await res.json()) as { elements?: OsmElement[] };
      return json.elements ?? [];
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("OVERPASS_429");
}

// --------------------------------------------------------------------------- //
// Shared tag → provenance mapping. Used by BOTH the live source (from an
// OsmElement) and the static snapshot source (from a bundled GeoJSON feature),
// so a building looks identical however it was loaded, and stays honest: an
// attribute shows only when the tag exists, otherwise "No disponible".
// --------------------------------------------------------------------------- //
export function parseYear(v?: string): number | null {
  if (!v) return null;
  const m = v.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

export function buildingFeatureFromTags(
  id: string,
  geometry: BuildingGeometry,
  tags: Record<string, string>,
): BuildingFeature {
  const year = parseYear(tags["start_date"] ?? tags["year_of_construction"]);
  return {
    type: "Feature",
    id,
    geometry,
    properties: {
      buildingId: id,
      cadastralReference: tags["ref:catastro"] ?? null,
      source: "OpenStreetMap",
      sourceType: "EXTERNAL_API",
      estPricePerM2: estimatePricePerM2(year), // colour only, ESTIMATED
    },
  };
}

export function buildingDetailsFromTags(
  feature: BuildingFeature,
  tags: Record<string, string>,
): BuildingDetails {
  const footprint = polygonAreaM2(feature.geometry);
  const centroid = centroidOf(feature.geometry);
  const src = "OpenStreetMap";
  const T = "EXTERNAL_API" as const;

  const floorsRaw = tags["building:levels"] ? parseInt(tags["building:levels"], 10) : null;
  const floors = floorsRaw != null && !Number.isNaN(floorsRaw) ? floorsRaw : null;
  const year = parseYear(tags["start_date"] ?? tags["year_of_construction"]);
  const flatsRaw = tags["building:flats"] ? parseInt(tags["building:flats"], 10) : null;
  const dwellings = flatsRaw != null && !Number.isNaN(flatsRaw) ? flatsRaw : null;
  const street = tags["addr:street"];
  const number = tags["addr:housenumber"];
  const address = street ? `${street}${number ? ", " + number : ""}` : null;
  const rc = tags["ref:catastro"] ?? null;
  const use = tags["building"] && tags["building"] !== "yes" ? tags["building"] : null;

  return {
    buildingId: feature.properties.buildingId,
    centroid,
    geometry: feature.geometry,
    address: address ? sourced(address, src, T) : unavailable(src, T),
    municipality: sourced("Madrid", src, T),
    province: sourced("Madrid", src, T),
    cadastralReference: rc ? sourced(rc, src, T) : unavailable(src, T),
    buildingAreaM2: floors ? sourced(footprint * floors, src, T) : unavailable(src, T),
    parcelAreaM2: sourced(footprint, src, T),
    yearBuilt: year ? sourced(year, src, T) : unavailable(src, T),
    floors: floors ? sourced(floors, src, T) : unavailable(src, T),
    dwellings: dwellings ? sourced(dwellings, src, T) : unavailable(src, T),
    buildingType: use ? sourced(use, src, T) : unavailable(src, T),
  };
}

function toFeature(el: OsmElement): BuildingFeature | null {
  if (!el.geometry || el.geometry.length < 3) return null;
  const ring = el.geometry.map((g) => [g.lon, g.lat] as [number, number]);
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) ring.push([a[0], a[1]]);
  const id = `osm-${el.type}-${el.id}`;
  const geometry: BuildingGeometry = { type: "Polygon", coordinates: [ring] };
  return buildingFeatureFromTags(id, geometry, el.tags ?? {});
}

export class OsmBuildingDataSource {
  async getBuildingsByBoundingBox(bbox: BBox): Promise<BuildingFeatureCollection> {
    const els = await overpass(bbox);
    const features = els
      .map(toFeature)
      .filter((f): f is BuildingFeature => f !== null);
    return { type: "FeatureCollection", features };
  }

  async getBuildingById(): Promise<BuildingDetails | null> {
    return null;
  }

  async getBuildingByPoint(lat: number, lng: number): Promise<BuildingDetails | null> {
    const d = 0.0006; // ~60 m
    let els: OsmElement[];
    try {
      els = await overpass([lng - d, lat - d, lng + d, lat + d]);
    } catch {
      return null;
    }
    let picked: { el: OsmElement; f: BuildingFeature } | null = null;
    for (const el of els) {
      const f = toFeature(el);
      if (f && pointInPolygon(lng, lat, f.geometry)) {
        picked = { el, f };
        break;
      }
    }
    if (!picked) {
      const el0 = els.find((e) => toFeature(e) !== null);
      const f0 = el0 ? toFeature(el0) : null;
      if (f0 && el0) picked = { el: el0, f: f0 };
    }
    return picked ? buildingDetailsFromTags(picked.f, picked.el.tags ?? {}) : null;
  }
}
