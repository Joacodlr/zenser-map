import { useState } from "react";
import type { Selection } from "@/components/map/BuildingMap";
import { BuildingSummary } from "./BuildingSummary";
import { BuildingProperty } from "./BuildingProperty";
import { BuildingEnergy } from "./BuildingEnergy";
import { BuildingSolar } from "./BuildingSolar";

const TABS = [
  { id: "summary", label: "Resumen" },
  { id: "property", label: "Inmueble" },
  { id: "energy", label: "Energía" },
  { id: "solar", label: "Solar" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function BuildingDetailsPanel({
  selection,
  onClose,
}: {
  selection: Selection;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>("summary");

  return (
    <aside className="flex h-full w-full flex-col bg-white sm:w-[380px] sm:border-l sm:border-slate-200">
      <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-deep">
            Edificio seleccionado
          </div>
          <div className="font-mono text-xs text-slate-400">{selection.buildingId}</div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Cerrar panel"
        >
          ✕
        </button>
      </header>

      <nav className="flex border-b border-slate-100 text-[13px]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 border-b-2 px-1.5 py-2.5 font-medium transition-colors ${
              tab === t.id
                ? "border-teal text-teal-deep"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto pb-6">
        {tab === "summary" && <BuildingSummary sel={selection} />}
        {tab === "property" && <BuildingProperty sel={selection} />}
        {tab === "energy" && <BuildingEnergy sel={selection} />}
        {tab === "solar" && <BuildingSolar sel={selection} />}
      </div>
    </aside>
  );
}
