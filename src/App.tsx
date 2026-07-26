import { useState } from "react";
import { BuildingMap, type Selection } from "@/components/map/BuildingMap";
import { BuildingDetailsPanel } from "@/components/building/BuildingDetailsPanel";
import { DEMO_MODE } from "@/lib/config";

export default function App() {
  const [selection, setSelection] = useState<Selection | null>(null);

  return (
    <main className="flex h-screen flex-col">
      <header className="z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          {/* Zenser logo mark — navy square, green "zen ser." wordmark. */}
          <div className="flex h-9 w-9 flex-col items-center justify-center rounded-md bg-zen-navy font-extrabold leading-[0.82] text-zen-green">
            <span className="text-[11px]">zen</span>
            <span className="text-[11px]">ser.</span>
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-extrabold tracking-tight text-ink">
              Zenser <span className="text-zen-green-deep">Electricity Map</span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Barrio de Ibiza · Retiro, Madrid
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            DEMO_MODE
              ? "bg-slate-100 text-slate-500"
              : "bg-zen-green/15 text-zen-green-deep"
          }`}
        >
          {DEMO_MODE ? "DEMO MODE" : "DATOS REALES"}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <div className="relative min-h-0 flex-1">
          <BuildingMap selected={selection} onSelect={setSelection} />
        </div>
        {selection && (
          <div className="h-[55%] sm:h-auto">
            <BuildingDetailsPanel selection={selection} onClose={() => setSelection(null)} />
          </div>
        )}
      </div>
    </main>
  );
}
