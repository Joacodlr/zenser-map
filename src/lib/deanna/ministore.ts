import type {
  BuildingDetails,
  EnergyResult,
  SolarResult,
  ListingsResult,
  Sourced,
} from "@/types";
import { buildingAerialImageUrl } from "./building-image";

// Turns a building (all the data the app gathers) into a Deanna MiniStore:
// one "book" whose clippings are the individual pieces of info. Posted through
// the same-origin dev proxy (/api/deanna/create-ministore), which injects the
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

// A single info clipping. Keeps provenance honest: the source + confidence ride
// along in the text, exactly as the app shows them on screen.
function infoClip<T>(
  label: string,
  s: Sourced<T> | undefined,
  fmt?: (v: T) => string,
): MiniStoreClipping | null {
  if (!s || s.value == null) return null; // skip "No disponible" — only real data
  const shown = fmt ? fmt(s.value) : String(s.value);
  return {
    type: "text",
    caption: label,
    text: `${label}: ${shown}\nFuente: ${s.source} · ${s.sourceType}`,
  };
}

// A plain estimated/simulated value (not a Sourced<T> but our own calc/PVGIS).
function calcClip(label: string, shown: string, source: string): MiniStoreClipping {
  return { type: "text", caption: label, text: `${label}: ${shown}\nFuente: ${source}` };
}

const eur = (n: number) => `${Math.round(n).toLocaleString("es-ES")} €`;
const kwh = (n: number) => `${Math.round(n).toLocaleString("es-ES")} kWh`;

// Official Sede Catastro record link for a 14-char cadastral reference.
function sedeCatastroUrl(ref: string | null): string | null {
  if (!ref || ref.length !== 14) return null;
  const rc1 = ref.slice(0, 7);
  const rc2 = ref.slice(7, 14);
  return `https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCListaBienes.aspx?rc1=${rc1}&rc2=${rc2}`;
}

export function assembleBuildingMiniStore(
  details: BuildingDetails,
  energy: EnergyResult | null,
  solar: SolarResult | null,
  listings: ListingsResult | null,
  facadeUrl?: string | null,
): MiniStorePayload {
  const clippings: MiniStoreClipping[] = [];

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

  // --- Location + official record links (genuinely useful, not invented) ------
  clippings.push({
    type: "webpage",
    caption: "Ubicación en el mapa",
    url: `https://www.google.com/maps/search/?api=1&query=${details.centroid.lat},${details.centroid.lng}`,
  });
  const sede = sedeCatastroUrl(details.cadastralReference.value);
  if (sede) {
    clippings.push({ type: "webpage", caption: "Ficha oficial (Sede Catastro)", url: sede });
  }

  // --- Resumen / Inmueble (Catastro) -----------------------------------------
  const push = (c: MiniStoreClipping | null) => { if (c) clippings.push(c); };
  push(infoClip("Dirección", details.address));
  push(infoClip("Municipio", details.municipality));
  push(infoClip("Provincia", details.province));
  push(infoClip("Referencia catastral", details.cadastralReference));
  push(infoClip("Superficie construida", details.buildingAreaM2, (v) => `${v.toLocaleString("es-ES")} m²`));
  push(infoClip("Superficie de la huella", details.parcelAreaM2, (v) => `${v.toLocaleString("es-ES")} m²`));
  push(infoClip("Año de construcción", details.yearBuilt));
  push(infoClip("Plantas", details.floors));
  push(infoClip("Viviendas", details.dwellings));
  push(infoClip("Uso / tipo", details.buildingType));

  // --- Energía ----------------------------------------------------------------
  if (energy?.certificate.available) {
    push(infoClip("Calificación energética", energy.certificate.rating));
    push(infoClip("Consumo (certificado)", energy.certificate.consumptionKwhM2Year, (v) => `${v} kWh/m²·año`));
    push(infoClip("Emisiones (certificado)", energy.certificate.co2KgM2Year, (v) => `${v} kg CO₂/m²·año`));
  }
  if (energy?.estimate) {
    const e = energy.estimate;
    clippings.push(calcClip("Consumo anual estimado", kwh(e.estimatedAnnualConsumptionKwh), "Estimación propia · ESTIMATED"));
    clippings.push(calcClip("Consumo por m² (estimado)", `${e.consumptionPerM2} kWh/m²·año`, "Estimación propia · ESTIMATED"));
    clippings.push(calcClip("CO₂ anual estimado", `${e.estimatedCo2Kg.toLocaleString("es-ES")} kg/año`, "Estimación propia · ESTIMATED"));
  }

  // --- Solar ------------------------------------------------------------------
  if (solar) {
    const p = solar.panelEstimate;
    clippings.push(calcClip("Potencia solar instalable", `${p.installedPowerKw} kWp (${p.panelCount} paneles)`, "Estimación propia · ESTIMATED"));
    clippings.push(calcClip("Área útil de cubierta", `${p.usableAreaM2.toLocaleString("es-ES")} m²`, "Estimación propia · ESTIMATED"));
    if (solar.production) {
      clippings.push(calcClip("Producción solar anual", kwh(solar.production.annualProductionKwh), `${solar.production.source} · ${solar.production.sourceType}`));
      clippings.push(calcClip("Irradiación anual", `${solar.production.annualIrradiationKwhM2.toLocaleString("es-ES")} kWh/m²`, `${solar.production.source} · ${solar.production.sourceType}`));
    }
    if (solar.savings) {
      clippings.push(calcClip("Ahorro anual estimado", eur(solar.savings.annualSavings), "Estimación propia · ESTIMATED"));
      clippings.push(calcClip("Beneficio anual estimado", eur(solar.savings.annualBenefit), "Estimación propia · ESTIMATED"));
      if (solar.savings.paybackYears != null) {
        clippings.push(calcClip("Amortización estimada", `${solar.savings.paybackYears} años`, "Estimación propia · ESTIMATED"));
      }
    }
  }

  // --- Anuncios ---------------------------------------------------------------
  if (listings) {
    const total = listings.inBuilding.length + listings.nearby.length;
    if (total > 0) {
      clippings.push(
        calcClip(
          "Anuncios",
          `${listings.inBuilding.length} en el edificio · ${listings.nearby.length} cercanos`,
          `${listings.source} · ${listings.sourceType}`,
        ),
      );
    }
    // Each real in-building listing with a link becomes its own product clipping.
    for (const l of listings.inBuilding) {
      if (!l.url) continue;
      const bits = [l.propertyType, l.sizeM2 ? `${l.sizeM2} m²` : null, l.operation === "rent" ? "alquiler" : "venta"]
        .filter(Boolean)
        .join(" · ");
      clippings.push({
        type: "product",
        caption: `${bits || "Anuncio"} — ${l.price.toLocaleString("es-ES")} €`,
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
