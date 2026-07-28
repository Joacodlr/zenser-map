import { useState } from "react";
import { BuildingMap, type Selection } from "@/components/map/BuildingMap";
import { BuildingDetailsPanel } from "@/components/building/BuildingDetailsPanel";
import { Hero } from "@/components/landing/Hero";
import { StatsBand } from "@/components/landing/StatsBand";
import { DEMO_MODE } from "@/lib/config";

export default function App() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const scrollToMap = () =>
    document.getElementById("mapa")?.scrollIntoView({ behavior: "smooth" });
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Sticky top nav */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur">
        <button onClick={scrollToTop} className="flex items-center gap-2.5" aria-label="Inicio">
          <div className="flex h-8 w-8 flex-col items-center justify-center rounded-md bg-zen-navy font-extrabold leading-[0.82] text-zen-green">
            <span className="text-[10px]">zen</span>
            <span className="text-[10px]">ser.</span>
          </div>
          <span className="text-sm font-extrabold tracking-tight text-ink">
            Zenser <span className="text-zen-green-deep">Map</span>
          </span>
        </button>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              DEMO_MODE ? "bg-slate-100 text-slate-500" : "bg-zen-green/15 text-zen-green-deep"
            }`}
          >
            {DEMO_MODE ? "DEMO MODE" : "DATOS REALES"}
          </span>
          <button
            onClick={scrollToMap}
            className="hidden rounded-full bg-zen-navy px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ink sm:inline-flex"
          >
            Ver mapa
          </button>
        </div>
      </header>

      {/* Landing hero */}
      <Hero onExplore={scrollToMap} />

      {/* Animated stats (real Catastro-snapshot numbers) */}
      <StatsBand />

      {/* Intro line */}
      <section className="mx-auto max-w-3xl px-6 py-12 text-center sm:py-16">
        <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Selecciona un edificio del mapa para obtener su información
        </h2>
        <p className="mt-3 text-slate-500">
          Haz clic en cualquier edificio para ver sus datos catastrales, su estimación
          energética y su potencial solar.
        </p>
      </section>

      {/* The map — unchanged capabilities, just placed below the landing. */}
      <section id="mapa" className="scroll-mt-16 border-t border-slate-200">
        <div className="flex h-[88vh] min-h-[520px] flex-col sm:flex-row">
          <div className="relative min-h-0 flex-1">
            <BuildingMap selected={selection} onSelect={setSelection} />
          </div>
          {selection && (
            <div className="h-[55%] sm:h-auto">
              <BuildingDetailsPanel
                selection={selection}
                onClose={() => setSelection(null)}
              />
            </div>
          )}
        </div>
      </section>

      {/* Footer with honest data attribution */}
      <footer className="border-t border-slate-200 bg-slate-50 px-6 py-6 text-center text-xs text-slate-400">
        Datos: Dirección General del Catastro · IGN PNOA · OpenStreetMap · PVGIS.
        Precios y estimaciones energéticas/solares: modelos propios (estimados).
        <div className="mt-1 font-semibold text-slate-500">Zenser Map — Barrio de Ibiza, Retiro (Madrid)</div>
      </footer>
    </div>
  );
}
