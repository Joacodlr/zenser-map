import { XMLParser } from "fast-xml-parser";
import { utm30ToWgs84 } from "./proj";
import type { BuildingFeature, BuildingGeometry } from "@/types";
import type { Position } from "geojson";
import { estimatePricePerM2 } from "@/lib/calculations/price";

// Parser for the Catastro INSPIRE Buildings WFS (GML 3.2.1, BuildingExtended2D).
// Strategy: don't hard-code the exact nesting (it varies). Instead, walk the tree
// generically by LOCAL tag name (ignoring namespace prefixes), harvest every
// <posList> as a polygon ring, and pull the standard INSPIRE attributes wherever
// they appear. Coordinates arrive in EPSG:25830 and are reprojected to WGS84.

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
  parseTagValue: false, // keep raw strings; we parse numbers ourselves
});

const local = (k: string) => k.split(":").pop() ?? k;

// Collect every value whose LOCAL tag name === name, anywhere in the tree.
function findAll(node: unknown, name: string, out: unknown[] = []): unknown[] {
  if (node == null) return out;
  if (Array.isArray(node)) {
    for (const n of node) findAll(n, name, out);
    return out;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (local(k) === name) out.push(v);
      else findAll(v, name, out);
    }
  }
  return out;
}

function textOf(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)["#text"]);
  }
  return null;
}

function firstText(member: unknown, name: string): string | null {
  for (const h of findAll(member, name)) {
    const t = textOf(Array.isArray(h) ? h[0] : h);
    if (t != null && t !== "") return t;
  }
  return null;
}

function toInt(s: string | null): number | null {
  if (s == null) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

function yearFrom(member: unknown): number | null {
  const blob = JSON.stringify(findAll(member, "dateOfConstruction"));
  const m = blob.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function ringsFrom(member: unknown): Position[][] {
  const rings: Position[][] = [];
  for (const h of findAll(member, "posList")) {
    const item = Array.isArray(h) ? h[0] : h;
    let text: string | null = null;
    let dims = 2;
    if (typeof item === "string") text = item;
    else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      text = obj["#text"] != null ? String(obj["#text"]) : null;
      const d = obj["@_srsDimension"];
      if (d) dims = parseInt(String(d), 10) || 2;
    }
    if (!text) continue;
    const nums = text.trim().split(/\s+/).map(Number).filter((n) => !Number.isNaN(n));
    const ring: Position[] = [];
    for (let i = 0; i + 1 < nums.length; i += dims) {
      const [lng, lat] = utm30ToWgs84(nums[i], nums[i + 1]);
      ring.push([lng, lat]);
    }
    if (ring.length >= 3) {
      const a = ring[0];
      const b = ring[ring.length - 1];
      if (a[0] !== b[0] || a[1] !== b[1]) ring.push([a[0], a[1]]);
      rings.push(ring);
    }
  }
  return rings;
}

function rcFromGmlId(id: string | null): string | null {
  if (!id) return null;
  const m = id.match(/[0-9A-Z]{14}/); // 14-char cadastral parcel reference
  return m ? m[0] : null;
}

export interface ParsedBuilding {
  feature: BuildingFeature;
  year: number | null;
  floors: number | null;
  dwellings: number | null;
  units: number | null;
  currentUse: string | null;
  cadastralReference: string | null;
}

export function parseBuildingsGml(xml: string): ParsedBuilding[] {
  let root: unknown;
  try {
    root = parser.parse(xml);
  } catch {
    return [];
  }

  // Prefer feature wrappers; fall back to Building nodes directly.
  const wrappers = [
    ...findAll(root, "member"),
    ...findAll(root, "featureMember"),
  ].flatMap((h) => (Array.isArray(h) ? h : [h]));
  const nodes = wrappers.length ? wrappers : findAll(root, "Building").flatMap((h) => (Array.isArray(h) ? h : [h]));

  const out: ParsedBuilding[] = [];
  nodes.forEach((member, idx) => {
    const rings = ringsFrom(member);
    if (!rings.length) return;
    const geometry: BuildingGeometry = { type: "Polygon", coordinates: rings };

    const buildingNode = (findAll(member, "Building")[0] as Record<string, unknown>) ?? (member as Record<string, unknown>);
    const gmlId = (buildingNode?.["@_gml:id"] ?? (member as Record<string, unknown>)?.["@_gml:id"] ?? null) as string | null;
    const rc = rcFromGmlId(typeof gmlId === "string" ? gmlId : null);
    const year = yearFrom(member);
    const floors = toInt(firstText(member, "numberOfFloorsAboveGround"));
    const dwellings = toInt(firstText(member, "numberOfDwellings"));
    const units = toInt(firstText(member, "numberOfBuildingUnits"));
    const currentUse = firstText(member, "currentUse");
    const id = rc || (typeof gmlId === "string" ? gmlId : `catastro-${idx}`);

    out.push({
      feature: {
        type: "Feature",
        id,
        geometry,
        properties: {
          buildingId: id,
          cadastralReference: rc,
          source: "CATASTRO",
          sourceType: "OFFICIAL",
          // Colour only. The €/m² is OUR estimate (badge ESTIMATED), never Catastro.
          estPricePerM2: estimatePricePerM2(year),
        },
      },
      year,
      floors,
      dwellings,
      units,
      currentUse,
      cadastralReference: rc,
    });
  });

  return out;
}