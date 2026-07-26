import type { ListingsResult, BuildingGeometry, Listing } from "@/types";
import { classifyListing, splitByConfidence } from "@/lib/matching";
import { getDemoListingsNear } from "@/lib/fixtures/demo-listings";

interface BuildingContext {
  lat: number;
  lng: number;
  geometry: BuildingGeometry | null;
  address?: string | null;
}

export interface RealEstateListingDataSource {
  getListingsForBuilding(ctx: BuildingContext): Promise<ListingsResult>;
}

function assemble(
  raw: Listing[],
  ctx: BuildingContext,
  source: string,
  sourceType: Listing["sourceType"]
): ListingsResult {
  const classified = raw.map((l) => ({
    ...l,
    match: classifyListing(l, {
      geometry: ctx.geometry,
      centroid: { lat: ctx.lat, lng: ctx.lng },
      address: ctx.address,
    }),
  }));
  const { inBuilding, nearby } = splitByConfidence(classified);
  return { inBuilding, nearby, source, sourceType };
}

// ---------------------------------------------------------------------------
// MOCK — deterministic fixtures. Used by default and as a fallback.
// ---------------------------------------------------------------------------
class MockIdealistaDataSource implements RealEstateListingDataSource {
  async getListingsForBuilding(ctx: BuildingContext): Promise<ListingsResult> {
    return assemble(getDemoListingsNear(), ctx, "Mock", "DEMO");
  }
}

// ---------------------------------------------------------------------------
// REAL — calls the SAME-ORIGIN dev proxy (/api/idealista) implemented in
// vite.config.ts. The browser never sees your Idealista secret, and there is no
// CORS issue. If the proxy is not configured or Idealista errors (401/quota),
// we fall back to mock so the UI keeps working.
// ---------------------------------------------------------------------------
class RealIdealistaDataSource implements RealEstateListingDataSource {
  async getListingsForBuilding(ctx: BuildingContext): Promise<ListingsResult> {
    const params = new URLSearchParams({
      lat: String(ctx.lat),
      lng: String(ctx.lng),
      distance: "150",
    });
    let json: { elementList?: any[]; error?: string };
    try {
      const res = await fetch(`/api/idealista?${params.toString()}`);
      json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
    } catch (e) {
      // No creds / quota / network — show mock but label it clearly.
      console.warn("[idealista] falling back to mock:", e);
      return assemble(getDemoListingsNear(), ctx, "Mock (Idealista no disponible)", "DEMO");
    }

    const raw: Listing[] = (json.elementList ?? []).map((el: any, i: number) => ({
      id: String(el.propertyCode ?? `idealista-${i}`),
      operation: el.operation === "rent" ? "rent" : "sale",
      price: Number(el.price ?? 0),
      sizeM2: el.size ?? null,
      rooms: el.rooms ?? null,
      bathrooms: el.bathrooms ?? null,
      propertyType: el.propertyType ?? null,
      addressOrArea: el.address ?? el.district ?? el.neighborhood ?? null,
      url: el.url ?? null,
      updatedAt: null,
      location:
        el.latitude != null && el.longitude != null
          ? { lat: Number(el.latitude), lng: Number(el.longitude) }
          : null,
      source: "Idealista API",
      sourceType: "EXTERNAL_API" as const,
      match: "LOW" as const,
    }));

    return assemble(raw, ctx, "Idealista API", "EXTERNAL_API");
  }
}

// Flip to real by setting VITE_IDEALISTA_ENABLED=true in .env.local
// (AND providing IDEALISTA_API_KEY / IDEALISTA_API_SECRET for the dev proxy).
export function getListingDataSource(): RealEstateListingDataSource {
  const enabled = import.meta.env.VITE_IDEALISTA_ENABLED === "true";
  return enabled ? new RealIdealistaDataSource() : new MockIdealistaDataSource();
}