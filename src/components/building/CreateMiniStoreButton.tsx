import { useState } from "react";
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

  async function handleClick() {
    setState({ kind: "loading" });
    try {
      // "All tabs at once" — but resilient: if energy/solar/listings fail
      // (e.g. PVGIS down), we still build the store from what we have.
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

  if (state.kind === "done") {
    return (
      <div className="mt-4 rounded-lg border border-teal/30 bg-teal/5 px-3 py-3 text-sm">
        <div className="font-semibold text-teal-deep">MiniStore creado ✓</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {state.count} datos guardados en Deanna.
        </div>
        <a
          href={state.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block font-medium text-teal-deep underline underline-offset-2"
        >
          Abrir MiniStore →
        </a>
        <button
          onClick={() => setState({ kind: "idle" })}
          className="ml-3 text-xs text-slate-400 hover:text-slate-600"
        >
          Crear otra
        </button>
      </div>
    );
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
    </div>
  );
}
