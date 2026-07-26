export type PvTechnology = "crystSi" | "CIS" | "CdTe" | "Unknown";

export interface SolarInput {
  latitude: number;
  longitude: number;
  installedPowerKw: number;
  tilt: number;       // degrees from horizontal
  azimuth: number;    // 0 = south, -90 = east, 90 = west (PVGIS convention)
  technology: PvTechnology;
  systemLossPct?: number;
}

export interface SolarProduction {
  annualProductionKwh: number;
  monthlyProductionKwh: number[];   // 12 values
  annualIrradiationKwhM2: number;
  specificYieldKwhPerKwp: number;   // production / installed power
  source: string;                   // "PVGIS"
  sourceType: "SIMULATED";
  inputs: SolarInput;
}

// Rooftop / panel estimation when we have no real roof geometry.
export interface PanelEstimate {
  footprintAreaM2: number;      // building footprint used
  estimatedRoofAreaM2: number;
  usableAreaM2: number;
  panelCount: number;
  installedPowerKw: number;
  estimated: true;
  assumptions: string[];
}

export interface SolarSavings {
  selfConsumedKwh: number;
  exportedKwh: number;
  annualSavings: number;      // € saved on the bill
  exportRevenue: number;      // € from surplus
  annualBenefit: number;      // savings + revenue
  estimatedCost: number;      // € install cost
  paybackYears: number | null;
  estimated: true;
  disclaimer: string;
}

export interface SolarResult {
  panelEstimate: PanelEstimate;
  production: SolarProduction | null;   // null if PVGIS unavailable
  savings: SolarSavings | null;
}
