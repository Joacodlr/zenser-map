import type {
  BBox,
  BuildingFeature,
  BuildingFeatureCollection,
  BuildingGeometry,
  BuildingDetails,
} from "@/types";
import { centroidOf, pointInPolygon } from "@/lib/geo/geometry";
import {
  buildingFeatureFromTags,
  buildingDetailsFromTags,
} from "./osm";
// Bundled one-time snapshot of real OSM (Catastro-derived) footprints for the
// study area. Imported as a raw string and parsed once — Vite's JSON handling is
// scoped to `.json`, and `?raw` avoids depending on it for `.geojson`.
// Regenerate with: node scripts/fetch-buildings.mjs
import raw from "@/lib/fixtures/ibiza-buildings.geojson?raw";

// Shape of one feature in the bundled snapshot (see scripts/fetch-buildings.mjs).
interface SnapshotFeature {
  type: "Feature";
  id: string;
  geometry: BuildingGeometry;
  properties: {
    osmId: number;
    osmType: string;
    tags: Record<string, string>;
  };
}
interface SnapshotCollection {
  type: "FeatureCollection";
  features: SnapshotFeature[];
}

// Parse the snapshot exactly once, into map-ready features plus a lookup of the
// original tags (kept out of the map features so the tiles stay light).
interface Entry {
  feature: BuildingFeature;
  tags: Record<string, string>;
  centroid: { lat: number; lng: number };
}

function buildIndex(): Entry[] {
  const parsed = JSON.parse(raw) as SnapshotCollection;
  return (parsed.features ?? []).map((sf) => {
    const feature = buildingFeatureFromTags(sf.id, sf.geometry, sf.properties.tags ?? {});
    return { feature, tags: sf.properties.tags ?? {}, centroid: centroidOf(sf.geometry) };
  });
}

const INDEX: Entry[] = buildIndex();

// --------------------------------------------------------------------------- //
// SNAPSHOT — real OSM footprints from a bundled file. Zero runtime Overpass
// calls (so zero 429s), filtered by bbox locally. Default real source.
// --------------------------------------------------------------------------- //
export class SnapshotBuildingDataSource {
  async getBuildingsByBoundingBox(bbox: BBox): Promise<BuildingFeatureCollection> {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const features = INDEX.filter(
      (e) =>
        e.centroid.lng >= minLng &&
        e.centroid.lng <= maxLng &&
        e.centroid.lat >= minLat &&
        e.centroid.lat <= maxLat,
    ).map((e) => e.feature);
    return { type: "FeatureCollection", features };
  }

  async getBuildingById(id: string): Promise<BuildingDetails | null> {
    const e = INDEX.find((x) => x.feature.properties.buildingId === id);
    return e ? buildingDetailsFromTags(e.feature, e.tags) : null;
  }

  async getBuildingByPoint(lat: number, lng: number): Promise<BuildingDetails | null> {
    // Prefer the polygon that actually contains the click; else the nearest centroid.
    const hit = INDEX.find((e) => pointInPolygon(lng, lat, e.feature.geometry));
    if (hit) return buildingDetailsFromTags(hit.feature, hit.tags);

    let best: Entry | null = null;
    let bestD = Infinity;
    for (const e of INDEX) {
      const d = (e.centroid.lat - lat) ** 2 + (e.centroid.lng - lng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best ? buildingDetailsFromTags(best.feature, best.tags) : null;
  }
}
