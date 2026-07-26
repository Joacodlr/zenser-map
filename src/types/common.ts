// Provenance is the intellectual core of this app: every value carries where it
// came from and how trustworthy it is. Never mix OFFICIAL with ESTIMATED silently.
export type DataSourceType =
  | "OFFICIAL"      // straight from an authoritative registry (Catastro)
  | "ESTIMATED"     // computed by our own models
  | "SIMULATED"     // produced by an external simulator (PVGIS)
  | "EXTERNAL_API"  // third-party API data (Idealista)
  | "DEMO";         // placeholder / fixture data, not real

export interface Sourced<T> {
  value: T | null;          // null => "No disponible" in the UI
  source: string;           // human label, e.g. "Catastro", "PVGIS"
  sourceType: DataSourceType;
}

export function sourced<T>(
  value: T | null,
  source: string,
  sourceType: DataSourceType
): Sourced<T> {
  return { value, source, sourceType };
}

export function unavailable(source = "Catastro", sourceType: DataSourceType = "OFFICIAL") {
  return { value: null, source, sourceType };
}

// [minLng, minLat, maxLng, maxLat]
export type BBox = [number, number, number, number];

export interface LngLat {
  lng: number;
  lat: number;
}
