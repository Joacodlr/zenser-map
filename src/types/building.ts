import type { Sourced } from "./common";
import type { Feature, Polygon, MultiPolygon, FeatureCollection } from "geojson";

export interface BuildingProperties {
  buildingId: string;
  cadastralReference: string | null;
  source: string;       // "CATASTRO" | "DEMO"
  sourceType: string;   // "OFFICIAL" | "DEMO"
  // Estimated market price (EUR/m2). NOT official — a model, shown as ESTIMATED/DEMO.
  // This is the value the choropleth colours by, mimicking the Idealista-Maps look
  // without using Idealista's proprietary price data.
  estPricePerM2?: number;
}

export type BuildingGeometry = Polygon | MultiPolygon;
export type BuildingFeature = Feature<BuildingGeometry, BuildingProperties>;
export type BuildingFeatureCollection = FeatureCollection<BuildingGeometry, BuildingProperties>;

// Rich per-building detail returned by /api/buildings/[id]
export interface BuildingDetails {
  buildingId: string;
  centroid: { lat: number; lng: number };
  geometry: BuildingGeometry | null;
  address: Sourced<string>;
  municipality: Sourced<string>;
  province: Sourced<string>;
  cadastralReference: Sourced<string>;
  buildingAreaM2: Sourced<number>;
  parcelAreaM2: Sourced<number>;
  yearBuilt: Sourced<number>;
  floors: Sourced<number>;
  dwellings: Sourced<number>;
  buildingType: Sourced<string>;
}
