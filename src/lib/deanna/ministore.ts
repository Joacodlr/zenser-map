import type {
  BuildingDetails,
  EnergyResult,
  SolarResult,
  ListingsResult,
} from "@/types";
import { buildingAerialImageUrl } from "./building-image";

// Turns a building into a Deanna MiniStore. Instead of one clipping per field,
// the data is consolidated into THREE well-written paragraph clippings (Catastro,
// Energía, Solar), plus the two building photos and two reference links. Posted
// through the same-origin proxy (/api/deanna/create-ministore), which injects the
// secret API key server-side — the key never touches the browser.

type ClippingType = "webpage" | "image" | "video" | "text" | "product";

export interface MiniStoreClipping {
  type: ClippingType;
  caption?: string;
  text?: string;
  url?: string;
  image?: string;
  price?: string;
}

export interface MiniStorePayload {
  name: string;
  description?: string;
  clippings: MiniStoreClipping[];
}

export interface MiniStoreResult {
  success: boolean;
  slug: string;
  bookId: number;
  url: string;
}

// Spanish number formatting (1.754,6 etc.).
const nf = (n: number, dec = 0) =>
  n.toLocaleString("es-ES", { maximumFractionDigits: dec });

// Official Sede Catastro record link for a 14-char cadastral reference.
function sedeCatastroUrl(ref: string | null): string | null {
  if (!ref || ref.length !== 14) return null;
  const rc1 = ref.slice(0, 7);
  const rc2 = ref.slice(7, 14);
  return `https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCListaBienes.aspx?rc1=${rc1}&rc2=${rc2}`;
}

// --- One flowing paragraph with the official Catastro data (the "Resumen"). ----
function catastroParagraph(d: BuildingDetails): MiniStoreClipping | null {
  const parts: string[] = [];

  const addr = d.address.value;
  const muni = d.municipality.value;
  const prov = d.province.value;
  const loc = muni && prov ? `${muni} (provincia de ${prov})` : muni || prov || null;
  if (addr) parts.push(`El edificio se ubica en ${addr}${loc ? `, en ${loc}` : ""}.`);
  else if (loc) parts.push(`El edificio se ubica en ${loc}.`);

  if (d.cadastralReference.value) {
    parts.push(`Su referencia catastral es ${d.cadastralReference.value}.`);
  }

  const year = d.yearBuilt.value;
  const floors = d.floors.value;
  if (year && floors) {
    parts.push(`Fue construido en ${year} y cuenta con ${floors} ${floors === 1 ? "planta" : "plantas"}.`);
  } else if (year) {
    parts.push(`Fue construido en ${year}.`);
  } else if (floors) {
    parts.push(`Cuenta con ${floors} ${floors === 1 ? "planta" : "plantas"}.`);
  }

  if (d.buildingType.value) parts.push(`Su uso principal es ${d.buildingType.value.toLowerCase()}.`);

  const built = d.buildingAreaM2.value;
  const foot = d.parcelAreaM2.value;
  if (built && foot) {
    parts.push(`Tiene una superficie construida de ${nf(built)} m² sobre una huella de ${nf(foot)} m².`);
  } else if (built) {
    parts.push(`Su superficie construida es de ${nf(built)} m².`);
  } else if (foot) {
    parts.push(`La huella del edificio es de ${nf(foot)} m².`);
  }

  const dw = d.dwellings.value;
  if (dw && dw > 0) parts.push(`Consta de ${nf(dw)} ${dw === 1 ? "vivienda" : "viviendas"}.`);

  if (!parts.length) return null;
  parts.push("Datos oficiales de la Dirección General del Catastro.");
  return { type: "text", caption: "Datos catastrales (oficial)", text: parts.join(" ") };
}

// --- One paragraph with the energy data (official certificate + estimate). -----
function energyParagraph(e: EnergyResult | null): MiniStoreClipping | null {
  if (!e) return null;
  const parts: string[] = [];

  if (e.certificate.available) {
    const c = e.certificate;
    const bits: string[] = [];
    if (c.rating.value) bits.push(`calificación ${c.rating.value}`);
    if (c.consumptionKwhM2Year.value != null) bits.push(`consumo ${nf(c.consumptionKwhM2Year.value)} kWh/m²·año`);
    if (c.co2KgM2Year.value != null) bits.push(`emisiones ${nf(c.co2KgM2Year.value)} kg CO₂/m²·año`);
    if (bits.length) parts.push(`Certificado energético oficial: ${bits.join(", ")}.`);
  }

  if (e.estimate) {
    const est = e.estimate;
    parts.push(
      `Estimación energética propia (a partir de la superficie y el año de construcción; ` +
        `no es un certificado oficial): consumo anual aproximado de ${nf(est.estimatedAnnualConsumptionKwh)} kWh ` +
        `(~${nf(est.consumptionPerM2)} kWh/m²·año) y unas emisiones estimadas de ${nf(est.estimatedCo2Kg)} kg de CO₂ al año.`,
    );
  }

  if (!parts.length) return null;
  return { type: "text", caption: "Energía (estimación)", text: parts.join(" ") };
}

// --- One paragraph with the solar potential (our estimate + PVGIS). ------------
function solarParagraph(s: SolarResult | null): MiniStoreClipping | null {
  if (!s) return null;
  const parts: string[] = [];
  const p = s.panelEstimate;
  parts.push(
    `Potencial solar estimado: una instalación de unos ${nf(p.installedPowerKw, 1)} kWp ` +
      `(${nf(p.panelCount)} paneles) sobre aproximadamente ${nf(p.usableAreaM2)} m² de cubierta útil.`,
  );

  if (s.production) {
    parts.push(
      `Produciría alrededor de ${nf(s.production.annualProductionKwh)} kWh al año ` +
        `(irradiación de ${nf(s.production.annualIrradiationKwhM2)} kWh/m²·año, simulación con PVGIS).`,
    );
  }

  if (s.savings) {
    const sv = s.savings;
    const clause = [`un ahorro anual estimado de ${nf(sv.annualSavings)} €`, `un beneficio anual de unos ${nf(sv.annualBenefit)} €`];
    if (sv.paybackYears != null) clause.push(`una amortización aproximada de ${nf(sv.paybackYears, 1)} años`);
    parts.push(`Supondría ${clause.join(", ")}.`);
  }

  parts.push("Estimaciones propias; producción simulada con PVGIS.");
  return { type: "text", caption: "Solar (estimación · PVGIS)", text: parts.join(" ") };
}

export function assembleBuildingMiniStore(
  details: BuildingDetails,
  energy: EnergyResult | null,
  solar: SolarResult | null,
  listings: ListingsResult | null,
  facadeUrl?: string | null,
): MiniStorePayload {
  const clippings: MiniStoreClipping[] = [];
  const push = (c: MiniStoreClipping | null) => { if (c) clippings.push(c); };

  // --- Cover images: street-level facade first (if available), then aerial -----
  if (facadeUrl) {
    clippings.push({
      type: "image",
      caption: "Fachada del edificio (Google Street View)",
      image: facadeUrl,
    });
  }
  clippings.push({
    type: "image",
    caption: "Vista aérea del edificio (IGN PNOA · OFICIAL)",
    image: buildingAerialImageUrl(details.centroid, details.geometry),
  });

  // --- Location + official record links --------------------------------------
  clippings.push({
    type: "webpage",
    caption: "Ubicación en el mapa",
    url: `https://www.google.com/maps/search/?api=1&query=${details.centroid.lat},${details.centroid.lng}`,
  });
  const sede = sedeCatastroUrl(details.cadastralReference.value);
  if (sede) {
    clippings.push({ type: "webpage", caption: "Ficha oficial (Sede Catastro)", url: sede });
  }

  // --- Three consolidated paragraphs ------------------------------------------
  push(catastroParagraph(details));
  push(energyParagraph(energy));
  push(solarParagraph(solar));

  // Real in-building listings (with a link) become product cards; mock/empty skipped.
  if (listings) {
    for (const l of listings.inBuilding) {
      if (!l.url) continue;
      const bits = [l.propertyType, l.sizeM2 ? `${l.sizeM2} m²` : null, l.operation === "rent" ? "alquiler" : "venta"]
        .filter(Boolean)
        .join(" · ");
      clippings.push({
        type: "product",
        caption: `${bits || "Anuncio"} — ${nf(l.price)} €`,
        url: l.url,
        price: String(l.price),
      });
    }
  }

  const name =
    details.address.value ??
    (details.cadastralReference.value ? `Edificio ${details.cadastralReference.value}` : details.buildingId);
  const description =
    "Ficha de edificio (Catastro oficial + energía y solar estimados) generada por Zenser Electricity Map — Barrio de Ibiza, Madrid.";

  return { name, description, clippings };
}

export async function createBuildingMiniStore(payload: MiniStorePayload): Promise<MiniStoreResult> {
  const res = await fetch("/api/deanna/create-ministore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<MiniStoreResult> & { error?: string };
  if (!res.ok || !json.success) {
    const detail =
      json.error === "DEANNA_NOT_CONFIGURED"
        ? "Falta CREATE_MINISTORE_API_KEY en el entorno (.env.local)."
        : json.error ?? `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return json as MiniStoreResult;
}
