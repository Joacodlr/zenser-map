import type { SolarInput, SolarProduction } from "@/types";
import { PVGIS_BASE } from "@/lib/config";

// SolarDataSource — production via PVGIS (free, no key). Always SIMULATED.
export interface SolarDataSource {
  getProduction(input: SolarInput): Promise<SolarProduction>;
}

class PvgisSolarDataSource implements SolarDataSource {
  async getProduction(input: SolarInput): Promise<SolarProduction> {
    const params = new URLSearchParams({
      lat: String(input.latitude),
      lon: String(input.longitude),
      peakpower: String(input.installedPowerKw),
      loss: String(input.systemLossPct ?? 14),
      angle: String(input.tilt),
      aspect: String(input.azimuth), // PVGIS: 0=south, -90=east, 90=west
      pvtechchoice: input.technology,
      mountingplace: "building",
      outputformat: "json",
    });
    const res = await fetch(`${PVGIS_BASE}/PVcalc?${params}`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`PVGIS_${res.status}`);
    const json = (await res.json()) as any;

    const monthly: number[] = (json?.outputs?.monthly?.fixed ?? []).map((m: any) => Number(m.E_m));
    const annualProductionKwh = Number(json?.outputs?.totals?.fixed?.E_y ?? 0);
    const annualIrradiationKwhM2 = Number(json?.outputs?.totals?.fixed?.["H(i)_y"] ?? 0);
    const specificYieldKwhPerKwp =
      input.installedPowerKw > 0 ? Math.round(annualProductionKwh / input.installedPowerKw) : 0;

    return {
      annualProductionKwh: Math.round(annualProductionKwh),
      monthlyProductionKwh: monthly.map((v) => Math.round(v)),
      annualIrradiationKwhM2: Math.round(annualIrradiationKwhM2),
      specificYieldKwhPerKwp,
      source: "PVGIS",
      sourceType: "SIMULATED",
      inputs: input,
    };
  }
}

export function getSolarDataSource(): SolarDataSource {
  // PVGIS is used in demo mode too — it's free and gives real, useful numbers.
  return new PvgisSolarDataSource();
}
