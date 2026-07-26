// One-time OFFICIAL snapshot generator — Dirección General del Catastro.
//
// Downloads the official INSPIRE "BuildingExtended2D" bulk file for the
// municipality of Madrid, streams it (it is ~583 MB uncompressed), clips to the
// study area, reprojects EPSG:25830 → WGS84, and writes a small bundled GeoJSON
// with OFFICIAL attributes (cadastral reference, use, year, dwellings, units,
// official constructed area). The app reads that file at runtime — zero live
// Catastro calls (which are CORS-blocked and bot-throttled anyway).
//
// Regenerate with:  node scripts/fetch-catastro.mjs
//
// Source: https://www.catastro.hacienda.gob.es/INSPIRE/buildings/... (ATOM bulk
// download service). Free reuse with attribution: "Dirección General del Catastro".

import { createReadStream } from "node:fs";
import { writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import proj4 from "proj4";

// Keep in sync with STUDY_BBOX in src/lib/config.ts — [minLng, minLat, maxLng, maxLat].
const STUDY_BBOX = [-3.687, 40.412, -3.66, 40.426];

const MUNICIPALITY_ZIP =
  "https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/28/28900-MADRID/A.ES.SDGC.BU.28900.zip";
const GML_ENTRY = "A.ES.SDGC.BU.28900.building.gml";
// Official INSPIRE Addresses (AD) for the same municipality, joined by cadastral
// reference to give each building an official street + house number + postcode.
const AD_ZIP =
  "https://www.catastro.hacienda.gob.es/INSPIRE/Addresses/28/28900-MADRID/A.ES.SDGC.AD.28900.zip";
const AD_ENTRY = "A.ES.SDGC.AD.28900.gml";
// Floors live in the 3D building-part file (numberOfFloorsAboveGround per part).
// Same zip as the buildings, joined by parent cadastral reference.
const PART_ENTRY = "A.ES.SDGC.BU.28900.buildingpart.gml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../src/lib/fixtures/ibiza-catastro-buildings.geojson");
const WORK = path.join(os.tmpdir(), "catastro-madrid");
const ZIP_PATH = process.env.CATASTRO_ZIP || path.join(WORK, "madrid-bu.zip");
const GML_PATH = process.env.CATASTRO_GML || path.join(WORK, GML_ENTRY);
const AD_ZIP_PATH = process.env.CATASTRO_AD_ZIP || path.join(WORK, "madrid-ad.zip");
const AD_GML_PATH = process.env.CATASTRO_AD_GML || path.join(WORK, AD_ENTRY);
const PART_GML_PATH = process.env.CATASTRO_PART_GML || path.join(WORK, PART_ENTRY);

// EPSG:25830 (ETRS89 / UTM 30N) → WGS84.
proj4.defs(
  "EPSG:25830",
  "+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
);
const toWgs84 = (x, y) => proj4("EPSG:25830", "EPSG:4326", [x, y]);

// Study bbox in UTM30, padded a touch, for the fast envelope pre-filter.
const utmBounds = (() => {
  const [minLng, minLat, maxLng, maxLat] = STUDY_BBOX;
  const c = [
    proj4("EPSG:4326", "EPSG:25830", [minLng, minLat]),
    proj4("EPSG:4326", "EPSG:25830", [maxLng, minLat]),
    proj4("EPSG:4326", "EPSG:25830", [maxLng, maxLat]),
    proj4("EPSG:4326", "EPSG:25830", [minLng, maxLat]),
  ];
  const xs = c.map((p) => p[0]);
  const ys = c.map((p) => p[1]);
  const pad = 50;
  return { minX: Math.min(...xs) - pad, maxX: Math.max(...xs) + pad, minY: Math.min(...ys) - pad, maxY: Math.max(...ys) + pad };
})();

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

// --- 1. Ensure a GML is on disk (download zip + extract just the one entry) -----
async function ensureExtracted({ url, zipPath, entry, gmlPath }) {
  if (await exists(gmlPath)) {
    console.log(`Using cached GML: ${gmlPath}`);
    return;
  }
  spawnSync("node", ["-e", `require('fs').mkdirSync(${JSON.stringify(WORK)},{recursive:true})`]);
  if (!(await exists(zipPath))) {
    console.log(`Downloading ${url} …`);
    const res = await fetch(url, {
      headers: { "User-Agent": "building-intelligence-map/snapshot" },
      signal: AbortSignal.timeout(600_000),
    });
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(zipPath, buf);
    console.log(`Saved zip (${(buf.length / 1e6).toFixed(0)} MB).`);
  }
  console.log(`Extracting ${entry} …`);
  // Extract ONLY the one entry (building archive is ~2.5 GB) — cross-platform-ish.
  if (process.platform === "win32") {
    const ps =
      `Add-Type -AssemblyName System.IO.Compression.FileSystem;` +
      `$z=[System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/\\/g, "\\\\")}');` +
      `$e=$z.Entries|Where-Object{$_.Name -eq '${entry}'};` +
      `[System.IO.Compression.ZipFileExtensions]::ExtractToFile($e,'${gmlPath.replace(/\\/g, "\\\\")}',$true);` +
      `$z.Dispose()`;
    const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("PowerShell extraction failed");
  } else {
    const r = spawnSync("unzip", ["-o", zipPath, entry, "-d", WORK], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("unzip failed (is `unzip` installed?)");
  }
}

// --- 2. Per-building parsing (each chunk is one <gml:featureMember>) ----------
function textBetween(s, open, close) {
  const i = s.indexOf(open);
  if (i < 0) return null;
  const j = s.indexOf(close, i + open.length);
  if (j < 0) return null;
  return s.slice(i + open.length, j);
}

function tagValue(s, tag) {
  // Matches <ns:tag ...>value</ns:tag>, skipping xsi:nil placeholders.
  const re = new RegExp(`<[\\w-]+:${tag}(?:\\s[^>]*)?>([^<]*)</[\\w-]+:${tag}>`);
  const m = s.match(re);
  return m ? m[1].trim() : null;
}

function ringFromPosList(posText, dims = 2) {
  const nums = posText.trim().split(/\s+/).map(Number).filter((n) => !Number.isNaN(n));
  const ring = [];
  for (let i = 0; i + 1 < nums.length; i += dims) {
    const [lng, lat] = toWgs84(nums[i], nums[i + 1]);
    ring.push([Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6]);
  }
  if (ring.length >= 3) {
    const a = ring[0], b = ring[ring.length - 1];
    if (a[0] !== b[0] || a[1] !== b[1]) ring.push([a[0], a[1]]);
  }
  return ring.length >= 4 ? ring : null;
}

// Fast envelope pre-filter using the feature's <gml:Envelope>.
function envelopeInBounds(chunk) {
  const lc = textBetween(chunk, "<gml:lowerCorner>", "</gml:lowerCorner>");
  const uc = textBetween(chunk, "<gml:upperCorner>", "</gml:upperCorner>");
  if (!lc || !uc) return true; // no envelope → don't reject
  const [minX, minY] = lc.trim().split(/\s+/).map(Number);
  const [maxX, maxY] = uc.trim().split(/\s+/).map(Number);
  return !(maxX < utmBounds.minX || minX > utmBounds.maxX || maxY < utmBounds.minY || minY > utmBounds.maxY);
}

function yearFrom(chunk) {
  const doc = textBetween(chunk, "<bu-core2d:dateOfConstruction>", "</bu-core2d:dateOfConstruction>");
  if (!doc) return null;
  const m = doc.match(/\b(1[0-9]{3}|20[0-9]{2})\b/); // ignore the "--01-01" nil form
  return m ? parseInt(m[1], 10) : null;
}

function geometryFrom(chunk) {
  const geo = textBetween(chunk, "<bu-ext2d:geometry>", "</bu-ext2d:geometry>");
  if (!geo) return null;
  // Split into patches so a Building made of several surfaces becomes a MultiPolygon.
  const patches = geo.split(/<gml:PolygonPatch>|<gml:Polygon[\s>]/).slice(1);
  const source = patches.length ? patches : [geo];
  const polygons = [];
  for (const p of source) {
    const ext = textBetween(p, "<gml:exterior>", "</gml:exterior>");
    if (!ext) continue;
    const outerPos = textBetween(ext, ">", "</gml:posList>");
    const outer = outerPos ? ringFromPosList(afterPosListOpen(ext)) : null;
    if (!outer) continue;
    const rings = [outer];
    let rest = p;
    let ii;
    while ((ii = rest.indexOf("<gml:interior>")) >= 0) {
      const jj = rest.indexOf("</gml:interior>", ii);
      const inner = rest.slice(ii, jj < 0 ? undefined : jj);
      const hole = ringFromPosList(afterPosListOpen(inner));
      if (hole) rings.push(hole);
      rest = rest.slice(jj < 0 ? rest.length : jj + 1);
    }
    polygons.push(rings);
  }
  if (!polygons.length) return null;
  if (polygons.length === 1) return { type: "Polygon", coordinates: polygons[0] };
  return { type: "MultiPolygon", coordinates: polygons.map((rings) => rings) };
}

// Return the text inside the first <gml:posList ...> … </gml:posList> of a block.
function afterPosListOpen(block) {
  const open = block.indexOf("<gml:posList");
  if (open < 0) return "";
  const gt = block.indexOf(">", open);
  const end = block.indexOf("</gml:posList>", gt);
  return gt < 0 || end < 0 ? "" : block.slice(gt + 1, end);
}

function cleanRef(chunk, gmlId) {
  const ref = tagValue(chunk, "reference") || tagValue(chunk, "localId");
  const raw = (ref ?? gmlId ?? "").replace(/^ES\.SDGC\.BU\./, "").trim();
  return raw || null;
}

function parseBuilding(chunk) {
  const geometry = geometryFrom(chunk);
  if (!geometry) return null;
  const gmlId = (chunk.match(/gml:id="([^"]*)"/) || [])[1] ?? null;
  const reference = cleanRef(chunk, gmlId);
  const currentUseRaw = tagValue(chunk, "currentUse"); // e.g. "1_residential" or null
  const areaText = (chunk.match(/<bu-ext2d:value\s+uom="m2">([\d.]+)/) || [])[1];
  const toIntOrNull = (v) => (v == null || v === "" ? null : Number.isNaN(+v) ? null : parseInt(v, 10));

  return {
    type: "Feature",
    id: reference || gmlId || undefined,
    geometry,
    properties: {
      reference,
      currentUse: currentUseRaw || null,
      yearBuilt: yearFrom(chunk),
      conditionOfConstruction: tagValue(chunk, "conditionOfConstruction"),
      numberOfDwellings: toIntOrNull(tagValue(chunk, "numberOfDwellings")),
      numberOfBuildingUnits: toIntOrNull(tagValue(chunk, "numberOfBuildingUnits")),
      numberOfFloorsAboveGround: toIntOrNull(tagValue(chunk, "numberOfFloorsAboveGround")),
      officialAreaM2: areaText != null ? parseInt(areaText, 10) : null,
    },
  };
}

// Generic streaming splitter over <gml:featureMember> chunks.
async function streamMembers(gmlPath, onChunk) {
  let scanned = 0;
  let buffer = "";
  const OPEN = "<gml:featureMember>";
  const CLOSE = "</gml:featureMember>";
  await new Promise((resolve, reject) => {
    const rs = createReadStream(gmlPath, { encoding: "latin1" }); // files are ISO-8859-1
    rs.on("data", (piece) => {
      buffer += piece;
      let end;
      while ((end = buffer.indexOf(CLOSE)) >= 0) {
        const start = buffer.indexOf(OPEN);
        if (start < 0 || start > end) { buffer = buffer.slice(end + CLOSE.length); continue; }
        const chunk = buffer.slice(start, end + CLOSE.length);
        buffer = buffer.slice(end + CLOSE.length);
        scanned++;
        onChunk(chunk, scanned);
      }
    });
    rs.on("end", () => resolve(scanned));
    rs.on("error", reject);
  });
  return scanned;
}

// --- 3. Stream the building GML, keep the ones inside the study area -----------
async function parseBuildings() {
  const features = [];
  const scanned = await streamMembers(GML_PATH, (chunk, n) => {
    if (envelopeInBounds(chunk)) {
      try {
        const f = parseBuilding(chunk);
        if (f) features.push(f);
      } catch { /* skip malformed */ }
    }
    if (n % 100000 === 0) process.stdout.write(`  scanned ${n}, kept ${features.length}\r`);
  });
  console.log(`\nScanned ${scanned} buildings, kept ${features.length} inside the study area.`);
  if (!features.length) throw new Error("No buildings in study area — refusing to write empty snapshot.");
  return features;
}

// --- 4. Official addresses (AD): join street + number + postcode by cadastral ref
const VIA_TYPES = {
  CL: "Calle", AV: "Avenida", PZ: "Plaza", PS: "Paseo", CR: "Carretera",
  CM: "Camino", TR: "Travesía", GL: "Glorieta", RD: "Ronda", PJ: "Pasaje",
  CJ: "Callejón", PQ: "Parque", AU: "Autovía", VI: "Vía", BO: "Barrio",
};
const SMALL = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "en"]);
function titleCase(s) {
  return s.toLowerCase().split(/\s+/).map((w, i) =>
    i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
  ).join(" ");
}
function prettyStreet(raw) {
  if (!raw) return null;
  const t = raw.trim().replace(/\s+/g, " ");
  const m = t.match(/^([A-ZÑ]{2})\s+(.*)$/); // "CL ABARDERO" → type + name
  if (m && VIA_TYPES[m[1]]) return `${VIA_TYPES[m[1]]} ${titleCase(m[2])}`;
  return titleCase(t);
}
function rcFromLocalId(localId) {
  if (!localId) return null;
  const seg = localId.trim().split(".").pop() ?? "";
  return /^[0-9A-Z]{14}$/.test(seg) ? seg : null;
}

async function joinAddresses(features) {
  const wanted = new Set(features.map((f) => f.properties.reference).filter(Boolean));
  const tnName = new Map();   // TN gml:id → raw street text
  const pdCode = new Map();   // PD gml:id → postcode
  const byRc = new Map();     // cadastral ref → { street, number, postcode }

  await streamMembers(AD_GML_PATH, (chunk) => {
    if (chunk.includes("<AD:ThoroughfareName ")) {
      const id = (chunk.match(/gml:id="([^"]*)"/) || [])[1];
      const txt = (chunk.match(/<GN:text>([^<]*)<\/GN:text>/) || [])[1];
      if (id && txt && txt.trim()) tnName.set(id, txt);
      return;
    }
    if (chunk.includes("<AD:PostalDescriptor ")) {
      const id = (chunk.match(/gml:id="([^"]*)"/) || [])[1];
      const code = (chunk.match(/<AD:postCode>([^<]*)<\/AD:postCode>/) || [])[1];
      if (id && code) pdCode.set(id, code.trim());
      return;
    }
    if (chunk.includes("<AD:Address ")) {
      const localId = (chunk.match(/<base:localId>([^<]*)<\/base:localId>/) || [])[1];
      const rc = rcFromLocalId(localId);
      if (!rc || !wanted.has(rc) || byRc.has(rc)) return; // first address per building
      // House number: LocatorDesignator whose <AD:type> is 1.
      let number = null;
      const re = /<AD:LocatorDesignator>[\s\S]*?<AD:designator>([^<]*)<\/AD:designator>[\s\S]*?<AD:type>([^<]*)<\/AD:type>[\s\S]*?<\/AD:LocatorDesignator>/g;
      let m;
      while ((m = re.exec(chunk))) { if (m[2].trim() === "1") { number = m[1].trim(); break; } }
      const tnId = (chunk.match(/xlink:href="#([^"]*\.TN\.[^"]*)"/) || [])[1];
      const pdId = (chunk.match(/xlink:href="#([^"]*\.PD\.[^"]*)"/) || [])[1];
      byRc.set(rc, { tnId, pdId, number });
    }
  });

  let matched = 0;
  for (const f of features) {
    const a = byRc.get(f.properties.reference);
    if (!a) continue;
    const street = prettyStreet(tnName.get(a.tnId));
    const postcode = pdCode.get(a.pdId) || null;
    if (street || a.number || postcode) {
      f.properties.addrStreet = street;
      f.properties.addrHouseNumber = a.number || null;
      f.properties.addrPostcode = postcode;
      if (street) matched++;
    }
  }
  console.log(`Addresses joined: ${matched}/${features.length} buildings got an official street.`);
}

// --- 5. Floors (buildingpart): max numberOfFloorsAboveGround per building ------
async function joinFloors(features) {
  const wanted = new Set(features.map((f) => f.properties.reference).filter(Boolean));
  const maxFloors = new Map(); // cadastral ref → max floors above ground
  let scanned = 0;

  scanned = await streamMembers(PART_GML_PATH, (chunk, n) => {
    // Parent building RC is the 14-char code before "_part" in the part id.
    const rc = (chunk.match(/([0-9A-Z]{14})_part/) || [])[1];
    if (!rc || !wanted.has(rc)) return;
    const fl = (chunk.match(/<bu-ext2d:numberOfFloorsAboveGround>(\d+)<\/bu-ext2d:numberOfFloorsAboveGround>/) || [])[1];
    if (fl == null) return;
    const f = parseInt(fl, 10);
    if (Number.isNaN(f)) return;
    const prev = maxFloors.get(rc) ?? 0;
    if (f > prev) maxFloors.set(rc, f);
    if (n % 200000 === 0) process.stdout.write(`  scanned ${n} parts, matched ${maxFloors.size}\r`);
  });

  let filled = 0;
  for (const f of features) {
    const fl = maxFloors.get(f.properties.reference);
    if (fl && fl > 0) {
      f.properties.numberOfFloorsAboveGround = fl;
      filled++;
    }
  }
  console.log(`\nScanned ${scanned} building parts; floors filled for ${filled}/${features.length} buildings.`);
}

async function writeOut(features) {
  const collection = {
    type: "FeatureCollection",
    metadata: {
      generatedAt: new Date().toISOString(),
      source: "Dirección General del Catastro — INSPIRE BuildingExtended2D + Addresses (28900 Madrid)",
      license: "Free reuse with attribution: Dirección General del Catastro",
      studyBbox: STUDY_BBOX,
      count: features.length,
    },
    features,
  };
  await writeFile(OUT, JSON.stringify(collection));
  console.log(`✓ Wrote ${features.length} official buildings → ${path.relative(process.cwd(), OUT)}`);
}

async function main() {
  await ensureExtracted({ url: MUNICIPALITY_ZIP, zipPath: ZIP_PATH, entry: GML_ENTRY, gmlPath: GML_PATH });
  const features = await parseBuildings();
  try {
    await ensureExtracted({ url: AD_ZIP, zipPath: AD_ZIP_PATH, entry: AD_ENTRY, gmlPath: AD_GML_PATH });
    await joinAddresses(features);
  } catch (e) {
    console.warn(`⚠ Address join skipped (${e.message}). Buildings still written without addresses.`);
  }
  try {
    // Floors are in the building-part entry of the SAME buildings zip (ZIP_PATH).
    await ensureExtracted({ url: MUNICIPALITY_ZIP, zipPath: ZIP_PATH, entry: PART_ENTRY, gmlPath: PART_GML_PATH });
    await joinFloors(features);
  } catch (e) {
    console.warn(`⚠ Floors join skipped (${e.message}). Buildings still written without floors.`);
  }
  await writeOut(features);
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
