import type {
  BBox,
  BuildingFeatureCollection,
  BuildingDetails,
} from "@/types";
import { sourced, unavailable } from "@/types";
import { DEMO_MODE, REAL_SOURCE, CATASTRO } from "@/lib/config";
import { wgs84ToUtm30 } from "@/lib/geo/proj";
import { parseBuildingsGml, type ParsedBuilding } from "@/lib/geo/gml";
import { centroidOf, polygonAreaM2, pointInPolygon } from "@/lib/geo/geometry";
import { OsmBuildingDataSource } from "./osm";
import { SnapshotBuildingDataSource } from "./snapshot";
import { SnapshotCatastroBuildingDataSource } from "./catastro-snapshot";
import {
  demoBuildingsCollection,
  getDemoBuildingDetails,
} from "@/lib/fixtures/demo-buildings";

export interface BuildingDataSource {
  getBuildingsByBoundingBox(bbox: BBox): Promise<BuildingFeatureCollection>;
  getBuildingByPoint(lat: number, lng: number): Promise<BuildingDetails | null>;
  getBuildingById(id: string): Promise<BuildingDetails | null>;
}

// --------------------------------------------------------------------------- //
// DEMO — fixtures only. Default path.
// --------------------------------------------------------------------------- //
class DemoBuildingDataSource implements BuildingDataSource {
  async getBuildingsByBoundingBox(bbox: BBox): Promise<BuildingFeatureCollection> {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const features = demoBuildingsCollection.features.filter((f) => {
      const c = centroidOf(f.geometry);
      return c.lng >= minLng && c.lng <= maxLng && c.lat >= minLat && c.lat <= maxLat;
    });
    return { type: "FeatureCollection", features };
  }

  async getBuildingById(id: string): Promise<BuildingDetails | null> {
    return getDemoBuildingDetails(id);
  }

  async getBuildingByPoint(lat: number, lng: number): Promise<BuildingDetails | null> {
    let best = demoBuildingsCollection.features[0] ?? null;
    let bestD = Infinity;
    for (const f of demoBuildingsCollection.features) {
      const c = centroidOf(f.geometry);
      const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best ? getDemoBuildingDetails(best.properties.buildingId) : null;
  }
}

// --------------------------------------------------------------------------- //
// REAL — official Catastro INSPIRE WFS (free, no key). Now also reads the
// standard INSPIRE attributes (year, floors, dwellings, use) straight from the
// same GML response, so the panel shows REAL data — not "No disponible".
// --------------------------------------------------------------------------- //
class CatastroBuildingDataSource implements BuildingDataSource {
  private async fetchParsed(bbox: BBox): Promise<ParsedBuilding[]> {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const [minX, minY] = wgs84ToUtm30(minLng, minLat);
    const [maxX, maxY] = wgs84ToUtm30(maxLng, maxLat);
    const url =
      `${CATASTRO.buildingsWfs}?service=wfs&version=2.0.0&request=getfeature` +
      `&typenames=BU.BUILDING&srsname=EPSG::25830` +
      `&bbox=${minX},${minY},${maxX},${maxY}`;
    const res = await fetch(url, {
      headers: { Accept: "application/gml+xml, text/xml" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`CATASTRO_WFS_${res.status}`);
    const xml = await res.text();
    return parseBuildingsGml(xml);
  }

  async getBuildingsByBoundingBox(bbox: BBox): Promise<BuildingFeatureCollection> {
    const parsed = await this.fetchParsed(bbox);
    return { type: "FeatureCollection", features: parsed.map((p) => p.feature) };
  }

  async getBuildingById(): Promise<BuildingDetails | null> {
    // Ids aren't directly queryable for rich attrs here — callers fall back to
    // getBuildingByPoint, which resolves the exact building containing the click.
    return null;
  }

  async getBuildingByPoint(lat: number, lng: number): Promise<BuildingDetails | null> {
    // Small box around the click, then pick the polygon that actually contains it.
    const d = 0.0006; // ~60 m
    let parsed: ParsedBuilding[];
    try {
      parsed = await this.fetchParsed([lng - d, lat - d, lng + d, lat + d]);
    } catch {
      return null;
    }
    if (!parsed.length) return null;

    const hit =
      parsed.find((p) => pointInPolygon(lng, lat, p.feature.geometry)) ?? parsed[0];

    const footprint = polygonAreaM2(hit.feature.geometry);
    const centroid = centroidOf(hit.feature.geometry);
    const O = "OFFICIAL" as const;
    const src = "Catastro";

    return {
      buildingId: hit.feature.properties.buildingId,
      centroid,
      geometry: hit.feature.geometry,
      // Address lives in the AD (Addresses) WFS, not BU — left as unavailable for now.
      address: unavailable(),
      municipality: sourced("Madrid", src, O),
      province: sourced("Madrid", src, O),
      cadastralReference: hit.cadastralReference
        ? sourced(hit.cadastralReference, src, O)
        : unavailable(),
      buildingAreaM2: hit.floors ? sourced(footprint * hit.floors, src, O) : unavailable(),
      parcelAreaM2: sourced(footprint, src, O),
      yearBuilt: hit.year ? sourced(hit.year, src, O) : unavailable(),
      floors: hit.floors ? sourced(hit.floors, src, O) : unavailable(),
      dwellings:
        hit.dwellings ? sourced(hit.dwellings, src, O)
        : hit.units ? sourced(hit.units, src, O)
        : unavailable(),
      buildingType: hit.currentUse ? sourced(hit.currentUse, src, O) : unavailable(),
    };
  }
}

// The ONLY place that decides demo vs real.
export function getBuildingDataSource(): BuildingDataSource {
  if (DEMO_MODE) return new DemoBuildingDataSource();
  // Default real source is the bundled OFFICIAL Catastro snapshot: real footprints
  // + official attributes (use, year, area, dwellings) with ZERO runtime calls, so
  // no 429s/CORS under pan/zoom. Opt into other sources with VITE_REAL_SOURCE:
  //   "snapshot" → bundled OSM export (footprints + addresses).
  //   "osm"      → live Overpass (fallback; mirror-rotating, backoff on 429).
  //   "catastro" → live WFS, only if you have an unblocked route to it.
  switch (REAL_SOURCE) {
    case "catastro":
      return new CatastroBuildingDataSource();
    case "osm":
      return new OsmBuildingDataSource();
    case "snapshot":
      return new SnapshotBuildingDataSource();
    default:
      return new SnapshotCatastroBuildingDataSource();
  }
}