import type { SolarSavings } from "@/types";
import { SOLAR_DEFAULTS } from "@/lib/config";

export interface SavingsInput {
  annualConsumptionKwh: number;
  annualSolarProductionKwh: number;
  installedPowerKw: number;
  electricityPrice?: number;
  exportPrice?: number;
  selfConsumptionRate?: number;
  installCostPerKwp?: number;
}

// SolarSavingsService — economic estimate only. Always flagged, never a promise.
export function estimateSavings(input: SavingsInput): SolarSavings {
  const electricityPrice = input.electricityPrice ?? SOLAR_DEFAULTS.electricityPriceEurKwh;
  const exportPrice = input.exportPrice ?? SOLAR_DEFAULTS.exportPriceEurKwh;
  const selfRate = input.selfConsumptionRate ?? SOLAR_DEFAULTS.selfConsumptionRate;
  const costPerKwp = input.installCostPerKwp ?? SOLAR_DEFAULTS.installCostEurPerKwp;

  const production = input.annualSolarProductionKwh;
  // Self-consumption is capped by actual demand.
  const selfConsumedKwh = Math.min(production * selfRate, input.annualConsumptionKwh);
  const exportedKwh = Math.max(0, production - selfConsumedKwh);

  const annualSavings = Math.round(selfConsumedKwh * electricityPrice);
  const exportRevenue = Math.round(exportedKwh * exportPrice);
  const annualBenefit = annualSavings + exportRevenue;
  const estimatedCost = Math.round(input.installedPowerKw * costPerKwp);
  const paybackYears = annualBenefit > 0 ? Math.round((estimatedCost / annualBenefit) * 10) / 10 : null;

  return {
    selfConsumedKwh: Math.round(selfConsumedKwh),
    exportedKwh: Math.round(exportedKwh),
    annualSavings,
    exportRevenue,
    annualBenefit,
    estimatedCost,
    paybackYears,
    estimated: true,
    disclaimer:
      "Este cálculo no sustituye un estudio técnico o financiero profesional.",
  };
}
