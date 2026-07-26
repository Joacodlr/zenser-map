import type { ZoneFeature } from "@/types";

// Approximate polygon of the Barrio de Ibiza (Retiro, Madrid). Demo geometry.
export const IBIZA_ZONE: ZoneFeature = {
  type: "Feature",
  properties: {
    zoneId: "ibiza-retiro",
    name: "Ibiza",
    avgPricePerM2: 9520.0,
    priceSource: "Demo",
    priceSourceType: "DEMO",
  },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [-3.6840, 40.4235],
      [-3.6690, 40.4245],
      [-3.6635, 40.4205],
      [-3.6650, 40.4150],
      [-3.6740, 40.4130],
      [-3.6835, 40.4160],
      [-3.6855, 40.4200],
      [-3.6840, 40.4235],
    ]],
  },
};

export const ZONES: ZoneFeature[] = [IBIZA_ZONE];
