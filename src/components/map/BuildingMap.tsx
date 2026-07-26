import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASE_STYLE, buildingInsertBeforeId, hideBasemapBuildingIds } from "./mapStyle";
import { zoneCentroid } from "./ZoneLayer";
import { addBuildingLayers, setBuildings, setSelected } from "./BuildingLayer";
import { INITIAL_VIEW } from "@/lib/config";
import { ZONES } from "@/lib/fixtures/zones";
import { getBuildings, BboxTooLargeError } from "@/lib/api";
import type { BBox } from "@/types";

export interface Selection {
  buildingId: string;
  lat: number;
  lng: number;
}

type Status = "idle" | "loading" | "error" | "zoom-in" | "empty" | "rate-limit";

export function BuildingMap({
  selected,
  onSelect,
}: {
  selected: Selection | null;
  onSelect: (s: Selection) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const reqIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [ready, setReady] = useState(false);

  const loadBuildings = useCallback(async (map: MLMap) => {
    const b = map.getBounds();
    // Round to ~3 decimals (~100 m) so small pans reuse the same request + cache.
    const r = (n: number) => Math.round(n * 1000) / 1000;
    const bbox: BBox = [
      r(b.getWest()),
      r(b.getSouth()),
      r(b.getEast()),
      r(b.getNorth()),
    ];
    const key = bbox.join(",");
    if (key === lastKeyRef.current) return; // same view — nothing to do
    const reqId = ++reqIdRef.current; // guards against out-of-order responses
    setStatus("loading");
    try {
      const fc = await getBuildings(bbox);
      if (reqId !== reqIdRef.current) return; // a newer request superseded this one
      lastKeyRef.current = key;
      setBuildings(map, fc);
      setStatus(fc.features.length === 0 ? "empty" : "idle");
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      if (e instanceof BboxTooLargeError) {
        setBuildings(map, { type: "FeatureCollection", features: [] });
        setStatus("zoom-in");
      } else if (e instanceof Error && e.message.includes("429")) {
        setStatus("rate-limit");
      } else {
        setStatus("error");
      }
    }
  }, []);

  const scheduleLoad = useCallback(
    (map: MLMap, delay = 600) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => loadBuildings(map), delay);
    },
    [loadBuildings],
  );

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: INITIAL_VIEW.center,
      zoom: INITIAL_VIEW.zoom,
      minZoom: INITIAL_VIEW.minZoom,
      maxZoom: INITIAL_VIEW.maxZoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    map.on("load", () => {
      const styleLayers = map.getStyle().layers ?? [];
      // Hide the basemap's own grey buildings so our official footprints are the
      // only buildings — otherwise they'd render on top and hide ours.
      for (const id of hideBasemapBuildingIds(styleLayers)) {
        map.setLayoutProperty(id, "visibility", "none");
      }
      const beforeId = buildingInsertBeforeId(styleLayers);
      addBuildingLayers(map, beforeId);

      // Zone label cards (white tooltip with name + price).
      for (const zone of ZONES) {
        const el = document.createElement("div");
        const price = zone.properties.avgPricePerM2;
        el.className =
          "rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-center pointer-events-none";
        el.innerHTML =
          `<div class="text-sm font-semibold text-ink">${zone.properties.name}</div>` +
          (price != null
            ? `<div class="text-base font-bold text-teal-deep">${price.toLocaleString("es-ES", { minimumFractionDigits: 1 })} €/m²</div>`
            : "") +
          (zone.properties.priceSourceType === "DEMO"
            ? `<div class="mt-1 text-[10px] font-semibold tracking-wide text-slate-400">DEMO DATA</div>`
            : "");
        new Marker({ element: el }).setLngLat(zoneCentroid(zone)).addTo(map);
      }

      // Hover feedback.
      let hovered: string | number | undefined;
      map.on("mousemove", "buildings-fill", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        if (hovered !== undefined)
          map.setFeatureState(
            { source: "buildings", id: hovered },
            { hover: false },
          );
        hovered = f.id as string | number;
        map.setFeatureState(
          { source: "buildings", id: hovered },
          { hover: true },
        );
      });
      map.on("mouseleave", "buildings-fill", () => {
        map.getCanvas().style.cursor = "";
        if (hovered !== undefined)
          map.setFeatureState(
            { source: "buildings", id: hovered },
            { hover: false },
          );
        hovered = undefined;
      });

      // Selection.
      map.on("click", "buildings-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const buildingId = (f.properties?.buildingId as string) ?? String(f.id);
        onSelect({ buildingId, lat: e.lngLat.lat, lng: e.lngLat.lng });
      });

      setReady(true);
      loadBuildings(map);
      map.on("moveend", () => scheduleLoad(map));
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect external selection into the highlight layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setSelected(map, selected?.buildingId ?? null);
  }, [selected, ready]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <StatusPill status={status} />
      <PriceLegend />
    </div>
  );
}

function PriceLegend() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[11px] font-semibold text-ink">
          Precio estimado €/m²
        </span>
        <span className="rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
          ESTIMATED · DEMO
        </span>
      </div>
      <div
        className="h-2 w-40 rounded"
        style={{
          background:
            "linear-gradient(90deg,#d3f8e8,#7cecc0,#22d69a,#00b478,#0b7a54)",
        }}
      />
      <div className="mt-0.5 flex justify-between text-[9px] text-slate-400">
        <span>7.000</span>
        <span>13.000+</span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  if (status === "idle") return null;
  const text =
    status === "loading"
      ? "Cargando edificios…"
      : status === "zoom-in"
        ? "Acerca el mapa para cargar edificios."
        : status === "empty"
          ? "No se encontraron edificios."
          : status === "rate-limit"
            ? "Demasiadas peticiones — espera unos segundos y mueve el mapa."
            : "Datos temporalmente no disponibles.";
  const tone =
    status === "error" || status === "rate-limit"
      ? "text-rose-600"
      : "text-slate-600";
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-slate-200 bg-white/95 px-4 py-1.5 text-xs font-medium shadow-sm">
      <span className={tone}>{text}</span>
    </div>
  );
}
