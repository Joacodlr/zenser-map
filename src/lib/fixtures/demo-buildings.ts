import type {
  BuildingFeature,
  BuildingFeatureCollection,
  BuildingDetails,
} from "@/types";
import { sourced } from "@/types";
import { centroidOf, polygonAreaM2, pointInPolygon } from "@/lib/geo/geometry";
import { IBIZA_ZONE } from "./zones";
import { estimatePricePerM2 } from "@/lib/calculations/price";

// Fill the whole Ibiza zone with a grid of demo "parcels" so the map reads like a
// full neighbourhood (à la Idealista Maps) instead of a dozen loose squares. All
// deterministic, all clearly DEMO. Real footprints come from Catastro (DEMO_MODE=false).

const ADDRESSES = [
  "Calle de Ibiza", "Calle de Menorca", "Calle de Narváez", "Calle de Fernán González",
  "Calle de Máiquez", "Calle de Sainz de Baranda", "Calle de Duque de Sesto",
  "Avenida de Menéndez Pelayo", "Calle de Lope de Rueda", "Calle del Doce de Octubre",
];
const TYPES = ["Residencial", "Residencial", "Residencial", "Mixto"];

// Deterministic pseudo-random in [0,1) from an integer seed.
function rnd(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const [minLng, minLat] = [Math.min(...IBIZA_ZONE.geometry.coordinates[0].map((c) => c[0])),
                          Math.min(...IBIZA_ZONE.geometry.coordinates[0].map((c) => c[1]))];
const [maxLng, maxLat] = [Math.max(...IBIZA_ZONE.geometry.coordinates[0].map((c) => c[0])),
                          Math.max(...IBIZA_ZONE.geometry.coordinates[0].map((c) => c[1]))];

const COLS = 14;
const ROWS = 12;
const M_LAT = 1 / 111_320;

function buildFeatures(): BuildingFeature[] {
  const feats: BuildingFeature[] = [];
  const cellW = (maxLng - minLng) / COLS;
  const cellH = (maxLat - minLat) / ROWS;
  let n = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const seed = r * COLS + c + 1;
      // Cell centre, jittered a touch.
      const cx = minLng + (c + 0.5) * cellW + (rnd(seed) - 0.5) * cellW * 0.2;
      const cy = minLat + (r + 0.5) * cellH + (rnd(seed + 99) - 0.5) * cellH * 0.2;
      if (!pointInPolygon(cx, cy, IBIZA_ZONE.geometry)) continue;

      // Parcel roughly fills the cell with a gap → "manzana" look.
      const wLng = cellW * (0.62 + rnd(seed + 7) * 0.22);
      const hLat = cellH * (0.62 + rnd(seed + 13) * 0.22);
      const geometry: BuildingFeature["geometry"] = {
        type: "Polygon",
        coordinates: [[
          [cx - wLng / 2, cy - hLat / 2],
          [cx + wLng / 2, cy - hLat / 2],
          [cx + wLng / 2, cy + hLat / 2],
          [cx - wLng / 2, cy + hLat / 2],
          [cx - wLng / 2, cy - hLat / 2],
        ]],
      };

      const year = 1900 + Math.floor(rnd(seed + 21) * 125);
      const estPricePerM2 = estimatePricePerM2(year);
      n += 1;
      const id = `demo-building-${String(n).padStart(3, "0")}`;
      feats.push({
        type: "Feature",
        id,
        geometry,
        properties: {
          buildingId: id,
          cadastralReference: `${String(1000000 + seed)}VK47`,
          source: "DEMO",
          sourceType: "DEMO",
          estPricePerM2,
        },
      });
    }
  }
  return feats;
}

const features = buildFeatures();

export const demoBuildingsCollection: BuildingFeatureCollection = {
  type: "FeatureCollection",
  features,
};

function seedFromId(id: string): number {
  const idx = features.findIndex((f) => f.properties.buildingId === id);
  return idx;
}

export function getDemoBuildingDetails(id: string): BuildingDetails | null {
  const idx = seedFromId(id);
  if (idx === -1) return null;
  const f = features[idx];
  const seed = idx + 1;
  const footprint = polygonAreaM2(f.geometry);
  const centroid = centroidOf(f.geometry);
  const src = "Demo";
  const T = "DEMO" as const;
  const year = 1900 + Math.floor(rnd(seed + 21) * 125);
  const floors = 4 + Math.floor(rnd(seed + 31) * 6);
  const dwellings = floors * (2 + Math.floor(rnd(seed + 41) * 4));
  return {
    buildingId: id,
    centroid,
    geometry: f.geometry,
    address: sourced(`${ADDRESSES[idx % ADDRESSES.length]}, ${1 + (seed % 60)}`, src, T),
    municipality: sourced("Madrid", src, T),
    province: sourced("Madrid", src, T),
    cadastralReference: sourced(f.properties.cadastralReference, src, T),
    buildingAreaM2: sourced(footprint * floors, src, T),
    parcelAreaM2: sourced(footprint, src, T),
    yearBuilt: sourced(year, src, T),
    floors: sourced(floors, src, T),
    dwellings: sourced(dwellings, src, T),
    buildingType: sourced(TYPES[seed % TYPES.length], src, T),
  };
}

export function getDemoBuildingFootprintM2(id: string): number | null {
  const f = features.find((x) => x.properties.buildingId === id);
  return f ? polygonAreaM2(f.geometry) : null;
}
