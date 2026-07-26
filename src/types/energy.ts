import type { Sourced } from "./common";

export type EnergyRating = "A" | "B" | "C" | "D" | "E" | "F" | "G";

// Official certificate data (may be entirely unavailable).
export interface EnergyCertificate {
  rating: Sourced<EnergyRating>;
  consumptionKwhM2Year: Sourced<number>;
  co2KgM2Year: Sourced<number>;
  certificateDate: Sourced<string>;
  available: boolean; // false => "Datos energéticos oficiales no disponibles"
}

// Our own estimate — always kept separate from the certificate above.
export interface EnergyEstimate {
  estimatedAnnualConsumptionKwh: number;
  consumptionPerM2: number;
  estimatedCo2Kg: number;
  assumptions: string[];
}

export interface EnergyResult {
  certificate: EnergyCertificate;
  estimate: EnergyEstimate | null;
}
