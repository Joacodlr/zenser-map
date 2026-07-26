import type { DataSourceType } from "./common";

export type MatchConfidence = "EXACT" | "HIGH" | "MEDIUM" | "LOW";
export type Operation = "sale" | "rent";

export interface Listing {
  id: string;
  operation: Operation;
  price: number;                 // € (sale) or €/month (rent)
  sizeM2: number | null;
  rooms: number | null;
  bathrooms: number | null;
  propertyType: string | null;   // "flat", "penthouse", ...
  addressOrArea: string | null;
  url: string | null;            // official listing URL
  updatedAt: string | null;      // ISO date
  location: { lat: number; lng: number } | null;
  source: string;                // "Idealista API" | "Mock"
  sourceType: DataSourceType;    // EXTERNAL_API | DEMO
  match: MatchConfidence;
}

export interface ListingsResult {
  inBuilding: Listing[];   // EXACT / HIGH
  nearby: Listing[];       // MEDIUM / LOW
  source: string;
  sourceType: DataSourceType;
}
