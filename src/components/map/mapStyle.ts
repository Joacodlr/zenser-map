// Clean vector basemap (CARTO Positron): light background, thin grey streets, labels
// on top — very close to the Idealista-Maps aesthetic. Free, hosted, no token.
// Swap for a Mapbox style URL if you add VITE_MAPBOX_TOKEN.
export const BASE_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// Where to insert our building fills. We want them ABOVE the basemap's own
// building layers (so our official footprints cover the grey basemap buildings)
// but BELOW the text labels (so street/place names stay readable on top).
//
// The basemap draws its buildings well above its *first* symbol layer
// (waterway_label), so anchoring to "first symbol" would bury our fills under the
// grey buildings — that's the bug that made only scattered bits show through.
// Instead: find the last basemap building layer, then the first symbol AFTER it.
export function buildingInsertBeforeId(
  layers: { id: string; type: string }[],
): string | undefined {
  let lastBuilding = -1;
  layers.forEach((l, i) => {
    if (/building/i.test(l.id)) lastBuilding = i;
  });
  for (let i = lastBuilding + 1; i < layers.length; i++) {
    if (layers[i].type === "symbol") return layers[i].id;
  }
  return layers.find((l) => l.type === "symbol")?.id; // fallback
}

// Basemap building fill layers (in the reference style: "building", "building-top").
// We hide these so our OFFICIAL Catastro footprints are the single source of truth
// for buildings — no grey/green mismatch where the two datasets disagree.
export function hideBasemapBuildingIds(
  layers: { id: string; type: string }[],
): string[] {
  return layers.filter((l) => l.type === "fill" && /building/i.test(l.id)).map((l) => l.id);
}
