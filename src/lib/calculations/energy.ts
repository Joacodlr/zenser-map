import type { EnergyEstimate } from "@/types";

// EnergyCalculationService — a transparent, defensible estimate. Clearly ESTIMATED,
// never presented as an official certificate.
export interface EnergyCalcInput {
  buildingAreaM2: number;
  yearBuilt: number | null;
  numberOfUnits: number | null;
  buildingType: string | null;
}

// Baseline specific consumption (kWh/m^2·year) by construction era. These are
// coarse Spanish residential heuristics, not measured values.
function baselineByYear(year: number | null): number {
  if (year == null) return 110;
  if (year < 1960) return 160;
  if (year < 1980) return 140;
  if (year < 2007) return 110; // pre-CTE
  if (year < 2019) return 85;  // CTE 2006
  return 60;                   // CTE 2019 / nZEB
}

const CO2_KG_PER_KWH = 0.19; // Spanish grid mix, approximate

export function estimateEnergy(input: EnergyCalcInput): EnergyEstimate {
  const consumptionPerM2 = baselineByYear(input.yearBuilt);
  const area = Math.max(input.buildingAreaM2, 1);
  const estimatedAnnualConsumptionKwh = Math.round(consumptionPerM2 * area);
  const estimatedCo2Kg = Math.round(estimatedAnnualConsumptionKwh * CO2_KG_PER_KWH);
  return {
    estimatedAnnualConsumptionKwh,
    consumptionPerM2,
    estimatedCo2Kg,
    assumptions: [
      `Consumo base por era de construcción: ${consumptionPerM2} kWh/m²·año`,
      `Factor de emisión de red: ${CO2_KG_PER_KWH} kg CO₂/kWh`,
      "Estimación estadística — no representa el consumo real del edificio.",
    ],
  };
}
