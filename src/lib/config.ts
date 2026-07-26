// Central configuration. In a Vite SPA these are read from import.meta.env at build
// time (only VITE_* vars are exposed to the client).
const env = import.meta.env;

export const DEMO_MODE = env.VITE_DEMO_MODE !== "false"; // defaults to true
// Which real source to use when DEMO_MODE=false:
//   "catastro-snapshot" (default) — bundled OFFICIAL Catastro export (footprints +
//                                    use/year/area/dwellings). ZERO runtime calls.
//   "snapshot"          — bundled OSM export (footprints + addresses). Zero calls.
//   "osm"               — live Overpass (rate-limited; opt-in fallback).
//   "catastro"          — live WFS, for when you have an unblocked/proxied route.
export type RealSource = "catastro-snapshot" | "snapshot" | "osm" | "catastro";
export const REAL_SOURCE: RealSource =
  (env.VITE_REAL_SOURCE as RealSource) || "catastro-snapshot";

export const AREA_OF_INTEREST = "IBIZA_MADRID" as const;

// Barrio de Ibiza, Distrito de Retiro, Madrid.
export const INITIAL_VIEW = {
  center: [-3.6745, 40.4188] as [number, number], // [lng, lat]
  zoom: 15.2,
  minZoom: 12,
  maxZoom: 19,
};

// [minLng, minLat, maxLng, maxLat]
export const STUDY_BBOX: [number, number, number, number] = [
  -3.6870, 40.4120, -3.6600, 40.4260,
];

export const MAX_BBOX_AREA_KM2 = 3.5;
export const MIN_BBOX_DELTA_DEG = 0.00005;

// In dev these go through Vite's proxy (see vite.config.ts) to dodge browser CORS.
// In a static production build you'd point them at your own proxy / serverless fn.
export const CATASTRO = {
  buildingsWfs: (env.VITE_CATASTRO_PROXY ?? "/catastro") + "/INSPIRE/wfsBU.aspx",
  parcelsWfs: (env.VITE_CATASTRO_PROXY ?? "/catastro") + "/INSPIRE/wfsCP.aspx",
  addressesWfs: (env.VITE_CATASTRO_PROXY ?? "/catastro") + "/INSPIRE/wfsAD.aspx",
  coordToRc:
    (env.VITE_CATASTRO_OVC_PROXY ?? "/catastro-ovc") +
    "/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_RCCOOR",
};

export const PVGIS_BASE = env.VITE_PVGIS_PROXY ?? "/pvgis/api/v5_3";

export const CACHE_TTL_MS = {
  buildings: 5 * 60 * 1000,
  buildingDetails: 10 * 60 * 1000,
  listings: 5 * 60 * 1000,
  solar: 60 * 60 * 1000,
};

export const SOLAR_DEFAULTS = {
  electricityPriceEurKwh: 0.16,
  exportPriceEurKwh: 0.06,
  selfConsumptionRate: 0.65,
  installCostEurPerKwp: 1100,
  panelPowerWp: 450,
  panelAreaM2: 2.0,
  usableRoofFraction: 0.6,
};
