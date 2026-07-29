import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { BuildingDetails, EnergyResult, SolarResult, ListingsResult } from "@/types";
import type { Selection } from "@/components/map/BuildingMap";
import { load } from "./api";
import {
  assembleBuildingMiniStore,
  createBuildingMiniStore,
} from "@/lib/deanna/ministore";
import { buildingFacadeUrl, facadeAvailable } from "@/lib/deanna/building-image";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; url: string; count: number }
  | { kind: "error"; message: string };

export function CreateMiniStoreButton({
  sel,
  details,
}: {
  sel: Selection;
  details: BuildingDetails;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const close = () => setState({ kind: "idle" });

  // While the success modal is open: block map scroll and allow Escape to close.
  useEffect(() => {
    if (state.kind !== "done") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [state.kind]);

  async function handleClick() {
    setState({ kind: "loading" });
    try {
      const [energy, solar, listings, hasFacade] = await Promise.all([
        load.energy(sel).catch(() => null as EnergyResult | null),
        load.solar(sel).catch(() => null as SolarResult | null),
        load.listings(sel).catch(() => null as ListingsResult | null),
        facadeAvailable(details.centroid).catch(() => false),
      ]);
      const facadeUrl = hasFacade ? buildingFacadeUrl(details.centroid) : null;
      const payload = assembleBuildingMiniStore(details, energy, solar, listings, facadeUrl);
      const result = await createBuildingMiniStore(payload);
      setState({ kind: "done", url: result.url, count: payload.clippings.length });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Error inesperado" });
    }
  }

  return (
    <div className="mt-4">
      <button
        onClick={handleClick}
        disabled={state.kind === "loading"}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-deep px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state.kind === "loading" ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
            Creando MiniStore…
          </>
        ) : (
          "Crear MiniStore de este edificio"
        )}
      </button>
      {state.kind === "error" && (
        <p className="mt-1.5 text-xs text-rose-600">{state.message}</p>
      )}
      <p className="mt-1.5 text-[11px] text-slate-400">
        Guarda todos los datos del edificio (Catastro, energía, solar y anuncios) como
        una MiniStore en Deanna.
      </p>

      {state.kind === "done" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="MiniStore creada"
          >
            {/* Backdrop — clicking it closes and returns to the map. */}
            <div
              className="absolute inset-0 bg-zen-navy/60 backdrop-blur-sm"
              onClick={close}
            />

            {/* Card */}
            <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
              <button
                onClick={close}
                aria-label="Cerrar"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zen-green/15">
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-zen-green-deep" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>

              <h3 className="mt-4 text-lg font-bold text-ink">¡MiniStore creada!</h3>
              <p className="mt-1 text-sm text-slate-500">
                Se han guardado {state.count} elementos del edificio en Deanna.
              </p>

              <a
                href={state.url}
                target="_blank"
                rel="noreferrer"
                className="mt-5 block w-full rounded-lg bg-zen-green-deep px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal"
              >
                Abrir MiniStore →
              </a>
              <button
                onClick={close}
                className="mt-2 w-full text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                Seguir explorando el mapa
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
