import proj4 from "proj4";

// ETRS89 / UTM zone 30N — the SRS the Catastro WFS is happiest with around Madrid.
// Querying in 25830 sidesteps a known axis-order bug on the WFS for EPSG:4326.
proj4.defs(
  "EPSG:25830",
  "+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
);

const WGS84 = "EPSG:4326";
const UTM30 = "EPSG:25830";

export function wgs84ToUtm30(lng: number, lat: number): [number, number] {
  return proj4(WGS84, UTM30, [lng, lat]) as [number, number];
}

export function utm30ToWgs84(x: number, y: number): [number, number] {
  return proj4(UTM30, WGS84, [x, y]) as [number, number];
}
