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
// Bundled one-time snapshot of OFFICIAL Catastro footprints + attributes for the
// study area (see scripts/fetch-catastro.mjs). Imported as a raw string and parsed
// once — zero runtime Catastro calls (the live WFS is CORS-blocked / bot-throttled).
// Regenerate with: node scripts/fetch-catastro.mjs
import raw from "@/lib/fixtures/ibiza-catastro-buildings.geojson?raw";

// Shape of one feature in the bundled Catastro snapshot.
interface CatastroProperties {
  reference: string | null;
  currentUse: string | null; // INSPIRE code, e.g. "1_residential"
  yearBuilt: number | null;
  conditionOfConstruction: string | null;
  numberOfDwellings: number | null;
  numberOfBuildingUnits: number | null;
  numberOfFloorsAboveGround: number | null;
  officialAreaM2: number | null; // official constructed area (suma superficies)
  // Joined from the INSPIRE Addresses (AD) dataset by cadastral reference.
  addrStreet?: string | null;
  addrHouseNumber?: string | null;
  addrPostcode?: string | null;
}
interface CatastroFeature {
  type: "Feature";
  id?: string;
  geometry: BuildingGeometry;
  properties: CatastroProperties;
}
interface CatastroCollection {
  type: "FeatureCollection";
  features: CatastroFeature[];
}

const SRC = "Catastro";
const OFF = "OFFICIAL" as const;

// INSPIRE currentUse codes → human labels (Spanish), matching Catastro/Idealista.
const USE_LABELS: Record<string, string> = {
  "1_residential": "Residencial",
  "2_agriculture": "Agrario",
  "3_industrial": "Industrial",
  "4_1_office": "Oficinas",
  "4_2_retail": "Comercial",
  "4_3_publicServices": "Servicios públicos",
};
function useLabel(code: string | null): string | null {
  if (!code) return null;
  return USE_LABELS[code] ?? code;
}

interface Entry {
  feature: BuildingFeature;
  props: CatastroProperties;
  centroid: { lat: number; lng: number };
}

function buildIndex(): Entry[] {
  const parsed = JSON.parse(raw) as CatastroCollection;
  return (parsed.features ?? []).map((cf) => {
    const id = cf.properties.reference || cf.id || `catastro-${Math.random()}`;
    const feature: BuildingFeature = {
      type: "Feature",
      id,
      geometry: cf.geometry,
      properties: {
        buildingId: id,
        cadastralReference: cf.properties.reference,
        source: SRC,
        sourceType: OFF,
        // Colour only — the €/m² is OUR estimate (badge ESTIMATED), never Catastro.
        estPricePerM2: estimatePricePerM2(cf.properties.yearBuilt),
      },
    };
    return { feature, props: cf.properties, centroid: centroidOf(cf.geometry) };
  });
}

const INDEX: Entry[] = buildIndex();

function composeAddress(p: CatastroProperties): string | null {
  if (!p.addrStreet) return null;
  const base = p.addrHouseNumber ? `${p.addrStreet}, ${p.addrHouseNumber}` : p.addrStreet;
  return p.addrPostcode ? `${base}, ${p.addrPostcode}` : base;
}

function detailsFrom(e: Entry): BuildingDetails {
  const p = e.props;
  const footprint = polygonAreaM2(e.feature.geometry);
  const address = composeAddress(p);
  return {
    buildingId: e.feature.properties.buildingId,
    centroid: e.centroid,
    geometry: e.feature.geometry,
    // Official address, joined from the INSPIRE Addresses (AD) dataset by
    // cadastral reference; "No disponible" for the rare building with no match.
    address: address ? sourced(address, SRC, OFF) : unavailable(SRC, OFF),
    municipality: sourced("Madrid", SRC, OFF),
    province: sourced("Madrid", SRC, OFF),
    cadastralReference: p.reference ? sourced(p.reference, SRC, OFF) : unavailable(SRC, OFF),
    // Official constructed area (what Catastro/Idealista call "superficie construida").
    buildingAreaM2: p.officialAreaM2 ? sourced(p.officialAreaM2, SRC, OFF) : unavailable(SRC, OFF),
    // Footprint area, measured from the official geometry.
    parcelAreaM2: sourced(footprint, SRC, OFF),
    yearBuilt: p.yearBuilt ? sourced(p.yearBuilt, SRC, OFF) : unavailable(SRC, OFF),
    // numberOfFloorsAboveGround is unpopulated in the Catastro building file
    // (it lives in the 3D buildingpart file), so floors is usually "No disponible".
    floors: p.numberOfFloorsAboveGround ? sourced(p.numberOfFloorsAboveGround, SRC, OFF) : unavailable(SRC, OFF),
    dwellings: p.numberOfDwellings ? sourced(p.numberOfDwellings, SRC, OFF) : unavailable(SRC, OFF),
    buildingType: p.currentUse ? sourced(useLabel(p.currentUse), SRC, OFF) : unavailable(SRC, OFF),
  };
}

// --------------------------------------------------------------------------- //
// CATASTRO SNAPSHOT — official footprints + attributes from a bundled file.
// Zero runtime network calls, filtered by bbox locally. Default real source.
// --------------------------------------------------------------------------- //
export class SnapshotCatastroBuildingDataSource {
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
    return e ? detailsFrom(e) : null;
  }

  async getBuildingByPoint(lat: number, lng: number): Promise<BuildingDetails | null> {
    const hit = INDEX.find((e) => pointInPolygon(lng, lat, e.feature.geometry));
    if (hit) return detailsFrom(hit);

    let best: Entry | null = null;
    let bestD = Infinity;
    for (const e of INDEX) {
      const d = (e.centroid.lat - lat) ** 2 + (e.centroid.lng - lng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best ? detailsFrom(best) : null;
  }
}
