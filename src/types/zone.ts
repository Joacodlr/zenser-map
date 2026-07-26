import type { Feature, Polygon } from "geojson";
import type { DataSourceType } from "./common";

export interface ZoneProperties {
  zoneId: string;
  name: string;
  avgPricePerM2: number | null;
  priceSource: string;
  priceSourceType: DataSourceType;  // DEMO until wired to a real price source
}

export type ZoneFeature = Feature<Polygon, ZoneProperties>;
