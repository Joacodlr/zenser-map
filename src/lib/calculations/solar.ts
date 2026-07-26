import type { PanelEstimate } from "@/types";
import { SOLAR_DEFAULTS } from "@/lib/config";

// Estimate rooftop capacity when we have no real roof geometry — only the footprint.
export function estimatePanels(footprintM2: number): PanelEstimate {
  const { usableRoofFraction, panelPowerWp, panelAreaM2 } = SOLAR_DEFAULTS;
  const estimatedRoofAreaM2 = Math.round(footprintM2); // flat-roof assumption
  const usableAreaM2 = Math.round(estimatedRoofAreaM2 * usableRoofFraction);
  const panelCount = Math.max(0, Math.floor(usableAreaM2 / panelAreaM2));
  const installedPowerKw = Math.round(((panelCount * panelPowerWp) / 1000) * 10) / 10;
  return {
    footprintAreaM2: Math.round(footprintM2),
    estimatedRoofAreaM2,
    usableAreaM2,
    panelCount,
    installedPowerKw,
    estimated: true,
    assumptions: [
      `Fracción útil de cubierta: ${Math.round(usableRoofFraction * 100)}%`,
      `Panel: ${panelPowerWp} Wp / ${panelAreaM2} m²`,
      "Sin geometría real de cubierta — superficie derivada de la huella del edificio.",
    ],
  };
}
