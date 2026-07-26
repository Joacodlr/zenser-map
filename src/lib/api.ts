// Client-side service layer. In the Next version this logic lived in API routes;
// in the Vite SPA the components call these functions directly (via React Query).
import type {
  BBox,
  BuildingFeatureCollection,
  BuildingDetails,
  ListingsResult,
  EnergyResult,
  SolarResult,
  ZoneFeature,
} from "@/types";
import { bboxSchema } from "@/lib/validation/schemas";
import { withCache } from "@/lib/cache/memory-cache";
import { CACHE_TTL_MS } from "@/lib/config";
import { getBuildingDataSource } from "@/lib/data-sources/catastro";
import { getListingDataSource } from "@/lib/data-sources/idealista";
import { getSolarDataSource } from "@/lib/data-sources/pvgis";
import { getEnergyDataSource } from "@/lib/data-sources/energy";
import { estimateEnergy } from "@/lib/calculations/energy";
import { estimatePanels } from "@/lib/calculations/solar";
import { estimateSavings } from "@/lib/calculations/savings";
import { polygonAreaM2 } from "@/lib/geo/geometry";
import { getDemoBuildingFootprintM2 } from "@/lib/fixtures/demo-buildings";
import { ZONES } from "@/lib/fixtures/zones";

export class BboxTooLargeError extends Error {
  constructor() {
    super("Acerca el mapa para cargar edificios.");
    this.name = "BboxTooLargeError";
  }
}

export async function getZones(): Promise<ZoneFeature[]> {
  return ZONES;
}

export async function getBuildings(bbox: BBox): Promise<BuildingFeatureCollection> {
  const parsed = bboxSchema.safeParse(bbox.join(","));
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.message === "BBOX_TOO_LARGE")) {
      throw new BboxTooLargeError();
    }
    throw new Error(parsed.error.issues[0]?.message ?? "bbox inválido");
  }
  const source = getBuildingDataSource();
  const key = `buildings:${parsed.data.map((n) => n.toFixed(5)).join(",")}`;
  return withCache(key, CACHE_TTL_MS.buildings, () =>
    source.getBuildingsByBoundingBox(parsed.data)
  );
}

export async function getBuildingDetails(
  id: string,
  lat: number,
  lng: number
): Promise<BuildingDetails | null> {
  const source = getBuildingDataSource();
  return withCache(`building:${id}:${lat}:${lng}`, CACHE_TTL_MS.buildingDetails, async () => {
    const byId = await source.getBuildingById(id);
    if (byId) return byId;
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return source.getBuildingByPoint(lat, lng);
    }
    return null;
  });
}

export async function getListings(
  id: string,
  lat: number,
  lng: number
): Promise<ListingsResult> {
  const details = await getBuildingDetails(id, lat, lng);
  const centroid = details?.centroid ?? { lat, lng };
  const listings = getListingDataSource();
  return withCache(
    `listings:${id}:${centroid.lat.toFixed(5)}:${centroid.lng.toFixed(5)}`,
    CACHE_TTL_MS.listings,
    () =>
      listings.getListingsForBuilding({
        lat: centroid.lat,
        lng: centroid.lng,
        geometry: details?.geometry ?? null,
        address: details?.address.value ?? null,
      })
  );
}

export async function getEnergy(
  id: string,
  lat: number,
  lng: number
): Promise<EnergyResult> {
  const details = await getBuildingDetails(id, lat, lng);
  const certificate = await getEnergyDataSource().getCertificate(id);
  let estimate = null;
  const area = details?.buildingAreaM2.value ?? details?.parcelAreaM2.value ?? null;
  if (area) {
    estimate = estimateEnergy({
      buildingAreaM2: area,
      yearBuilt: details?.yearBuilt.value ?? null,
      numberOfUnits: details?.dwellings.value ?? null,
      buildingType: details?.buildingType.value ?? null,
    });
  }
  return { certificate, estimate };
}

export async function getSolar(
  id: string,
  lat: number,
  lng: number
): Promise<SolarResult> {
  const details = await getBuildingDetails(id, lat, lng);
  const footprint =
    getDemoBuildingFootprintM2(id) ??
    (details?.geometry ? polygonAreaM2(details.geometry) : details?.parcelAreaM2.value ?? null);
  if (!footprint) throw new Error("Sin geometría para estimar potencial solar.");

  const centroid = details?.centroid ?? { lat, lng };
  const panelEstimate = estimatePanels(footprint);

  let production = null;
  try {
    production = await withCache(
      `solar:${centroid.lat.toFixed(4)}:${centroid.lng.toFixed(4)}:${panelEstimate.installedPowerKw}`,
      CACHE_TTL_MS.solar,
      () =>
        getSolarDataSource().getProduction({
          latitude: centroid.lat,
          longitude: centroid.lng,
          installedPowerKw: panelEstimate.installedPowerKw,
          tilt: 30,
          azimuth: 0,
          technology: "crystSi",
        })
    );
  } catch {
    production = null;
  }

  let savings = null;
  if (production) {
    const area = details?.buildingAreaM2.value ?? footprint * (details?.floors.value ?? 6);
    const energy = estimateEnergy({
      buildingAreaM2: area,
      yearBuilt: details?.yearBuilt.value ?? null,
      numberOfUnits: details?.dwellings.value ?? null,
      buildingType: details?.buildingType.value ?? null,
    });
    savings = estimateSavings({
      annualConsumptionKwh: energy.estimatedAnnualConsumptionKwh,
      annualSolarProductionKwh: production.annualProductionKwh,
      installedPowerKw: panelEstimate.installedPowerKw,
    });
  }

  return { panelEstimate, production, savings };
}
