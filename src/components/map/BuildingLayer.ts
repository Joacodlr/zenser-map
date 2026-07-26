import type { Map as MLMap, ExpressionSpecification } from "maplibre-gl";
import type { BuildingFeatureCollection } from "@/types";
import { PRICE_COLOR_STOPS } from "@/lib/calculations/price";

const EMPTY: BuildingFeatureCollection = { type: "FeatureCollection", features: [] };

// Green price choropleth (Idealista-Maps aesthetic) — colours by the ESTIMATED
// price. Falls back to the mid stop when a feature has no estimate (e.g. raw Catastro).
function priceColorExpression(): ExpressionSpecification {
  const mid = PRICE_COLOR_STOPS[Math.floor(PRICE_COLOR_STOPS.length / 2)][0];
  const stops = PRICE_COLOR_STOPS.flatMap(([v, c]) => [v, c]);
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "estPricePerM2"], mid],
    ...stops,
  ] as unknown as ExpressionSpecification;
}

export function addBuildingLayers(map: MLMap, beforeId?: string) {
  if (map.getSource("buildings")) return;
  map.addSource("buildings", { type: "geojson", data: EMPTY, promoteId: "buildingId" });

  map.addLayer(
    {
      id: "buildings-fill",
      type: "fill",
      source: "buildings",
      paint: {
        "fill-color": priceColorExpression(),
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.95,
          0.82,
        ],
      },
    },
    beforeId
  );
  map.addLayer(
    {
      id: "buildings-outline",
      type: "line",
      source: "buildings",
      paint: { "line-color": "#ffffff", "line-width": 1, "line-opacity": 0.9 },
    },
    beforeId
  );
  // Selected building — magenta outline, on top of everything (like the reference).
  map.addLayer({
    id: "buildings-selected",
    type: "line",
    source: "buildings",
    paint: { "line-color": "#e5007d", "line-width": 3 },
    filter: ["==", ["get", "buildingId"], "___none___"],
  });
}

export function setBuildings(map: MLMap, fc: BuildingFeatureCollection) {
  const src = map.getSource("buildings");
  if (src && "setData" in src) (src as { setData: (d: unknown) => void }).setData(fc);
}

export function setSelected(map: MLMap, buildingId: string | null) {
  if (!map.getLayer("buildings-selected")) return;
  map.setFilter("buildings-selected", ["==", ["get", "buildingId"], buildingId ?? "___none___"]);
}
