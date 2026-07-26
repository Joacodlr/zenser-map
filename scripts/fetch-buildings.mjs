// One-time snapshot generator. Queries the OpenStreetMap Overpass API for every
// building inside the study area and writes a bundled GeoJSON that the app loads
// at runtime — so the browser makes ZERO Overpass calls (no 429s) during normal use.
//
// Regenerate with:  node scripts/fetch-buildings.mjs
//
// In Madrid OSM buildings were bulk-imported from Catastro, so the footprints and
// many tags (ref:catastro, building:levels, start_date, addr:*) are real.
// Attribution required by OSM: "© OpenStreetMap contributors" (ODbL).

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Keep in sync with STUDY_BBOX in src/lib/config.ts — [minLng, minLat, maxLng, maxLat].
const STUDY_BBOX = [-3.687, 40.412, -3.66, 40.426];

// Overpass mirrors, tried in order on failure/timeout/429.
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

// Only these tags are worth bundling — keeps the snapshot small and honest.
const KEEP_TAGS = [
  "building",
  "building:levels",
  "building:flats",
  "start_date",
  "year_of_construction",
  "addr:street",
  "addr:housenumber",
  "addr:postcode",
  "ref:catastro",
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../src/lib/fixtures/ibiza-buildings.geojson");

function overpassQuery([minLng, minLat, maxLng, maxLat]) {
  // Overpass bbox order is (south,west,north,east).
  return (
    `[out:json][timeout:90];` +
    `way["building"](${minLat},${minLng},${maxLat},${maxLng});` +
    `out geom;`
  );
}

async function fetchElements() {
  const body = "data=" + encodeURIComponent(overpassQuery(STUDY_BBOX));
  let lastErr;
  for (const url of MIRRORS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        process.stdout.write(`→ ${url} (attempt ${attempt + 1})… `);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            // Overpass 406s requests with no User-Agent; identify politely.
            "User-Agent": "building-intelligence-map/snapshot (github; contact via repo)",
            Accept: "application/json",
          },
          body,
          signal: AbortSignal.timeout(120_000),
        });
        if (res.status === 429 || res.status === 504) {
          console.log(`rate-limited (${res.status})`);
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        console.log(`ok (${json.elements?.length ?? 0} elements)`);
        return json.elements ?? [];
      } catch (err) {
        lastErr = err;
        console.log(`failed: ${err.message}`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw new Error(`All Overpass mirrors failed: ${lastErr?.message ?? "unknown"}`);
}

function pickTags(tags = {}) {
  const out = {};
  for (const k of KEEP_TAGS) if (tags[k] != null) out[k] = tags[k];
  return out;
}

function toFeature(el) {
  if (!el.geometry || el.geometry.length < 3) return null;
  const ring = el.geometry.map((g) => [
    Math.round(g.lon * 1e6) / 1e6,
    Math.round(g.lat * 1e6) / 1e6,
  ]);
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) ring.push([a[0], a[1]]);
  return {
    type: "Feature",
    id: `osm-${el.type}-${el.id}`,
    geometry: { type: "Polygon", coordinates: [ring] },
    properties: { osmId: el.id, osmType: el.type, tags: pickTags(el.tags) },
  };
}

async function main() {
  const elements = await fetchElements();
  const features = elements.map(toFeature).filter(Boolean);
  if (!features.length) throw new Error("No buildings returned — refusing to write empty snapshot.");

  const collection = {
    type: "FeatureCollection",
    metadata: {
      generatedAt: new Date().toISOString(),
      source: "OpenStreetMap / Overpass API (ODbL)",
      studyBbox: STUDY_BBOX,
      count: features.length,
    },
    features,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(collection));
  console.log(`✓ Wrote ${features.length} buildings → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
