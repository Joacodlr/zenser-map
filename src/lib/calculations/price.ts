import { IBIZA_ZONE } from "@/lib/fixtures/zones";

// Very rough per-building price ESTIMATE, so the map can be coloured like a price
// heatmap WITHOUT real market data. Never presented as official.
// Base = zone average; nudged by construction era (newer/renovated = pricier here).
export function estimatePricePerM2(yearBuilt: number | null): number {
  const base = IBIZA_ZONE.properties.avgPricePerM2 ?? 9000;
  let factor = 1;
  if (yearBuilt != null) {
    if (yearBuilt < 1940) factor = 1.08;      // "casas señoriales"
    else if (yearBuilt < 1970) factor = 0.9;
    else if (yearBuilt < 2000) factor = 0.95;
    else factor = 1.12;                        // obra nueva
  }
  return Math.round(base * factor);
}

// Green colour scale used by the map — Zenser mint → deep green.
export const PRICE_COLOR_STOPS: Array<[number, string]> = [
  [7000, "#d3f8e8"],
  [8500, "#7cecc0"],
  [9500, "#22d69a"],
  [11000, "#00b478"],
  [13000, "#0b7a54"],
];
