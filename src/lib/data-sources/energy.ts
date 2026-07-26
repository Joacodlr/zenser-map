import type { EnergyCertificate } from "@/types";
import { unavailable } from "@/types";

// EnergyDataSource — official energy-performance certificates.
// There is no free national API for these in Spain, so this returns "not available"
// by default. The estimate (lib/calculations/energy.ts) is always kept separate.
export interface EnergyDataSource {
  getCertificate(buildingId: string): Promise<EnergyCertificate>;
}

class NoOfficialEnergyDataSource implements EnergyDataSource {
  async getCertificate(): Promise<EnergyCertificate> {
    return {
      rating: unavailable("Certificado energético"),
      consumptionKwhM2Year: unavailable("Certificado energético"),
      co2KgM2Year: unavailable("Certificado energético"),
      certificateDate: unavailable("Certificado energético"),
      available: false,
    };
  }
}

export function getEnergyDataSource(): EnergyDataSource {
  return new NoOfficialEnergyDataSource();
}
