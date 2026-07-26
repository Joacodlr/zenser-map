import { useQuery } from "@tanstack/react-query";
import type { SolarResult } from "@/types";
import type { Selection } from "@/components/map/BuildingMap";
import { load } from "./api";
import { DataSourceBadge } from "@/components/data/DataSourceBadge";
import { Loading, ErrorNote, EmptyNote, SectionTitle, Stat } from "./ui";

const MONTHS = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function BuildingSolar({ sel }: { sel: Selection }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["solar", sel.buildingId, sel.lat, sel.lng],
    queryFn: () => load.solar(sel),
  });

  if (isLoading) return <Loading label="Calculando potencial solar (PVGIS)…" />;
  if (error) return <ErrorNote message="No se pudo calcular el potencial solar." />;
  if (!data) return null;

  const { panelEstimate: p, production, savings } = data;
  const maxMonth = production ? Math.max(...production.monthlyProductionKwh, 1) : 1;

  return (
    <div>
      <div className="mx-4 mt-3 flex items-center gap-2">
        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          Estimated
        </span>
        <span className="text-xs text-slate-400">Sin geometría real de cubierta</span>
      </div>

      <SectionTitle>Dimensionado estimado</SectionTitle>
      <div className="grid grid-cols-2 gap-2 px-4">
        <Stat label="Cubierta estimada" value={`${p.estimatedRoofAreaM2.toLocaleString("es-ES")} m²`} />
        <Stat label="Área útil" value={`${p.usableAreaM2.toLocaleString("es-ES")} m²`} />
        <Stat label="Paneles" value={p.panelCount} />
        <Stat label="Potencia" value={`${p.installedPowerKw} kWp`} />
      </div>

      <SectionTitle>Producción (PVGIS)</SectionTitle>
      {production ? (
        <div className="px-4">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Producción anual" value={`${production.annualProductionKwh.toLocaleString("es-ES")} kWh`} />
            <Stat label="Rendimiento" value={`${production.specificYieldKwhPerKwp} kWh/kWp`} />
          </div>
          <div className="mt-3 flex items-end gap-1">
            {production.monthlyProductionKwh.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-teal"
                  style={{ height: `${Math.max(4, (v / maxMonth) * 56)}px` }}
                  title={`${v.toLocaleString("es-ES")} kWh`}
                />
                <span className="text-[9px] text-slate-400">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
          <div className="mt-2"><DataSourceBadge source="PVGIS" sourceType="SIMULATED" /></div>
        </div>
      ) : (
        <EmptyNote message="Producción no disponible (PVGIS sin respuesta). Se muestra solo el dimensionado." />
      )}

      {savings && (
        <>
          <SectionTitle>Ahorro estimado</SectionTitle>
          <div className="grid grid-cols-2 gap-2 px-4">
            <Stat label="Ahorro anual" value={`${savings.annualBenefit.toLocaleString("es-ES")} €`} />
            <Stat label="Coste estimado" value={`${savings.estimatedCost.toLocaleString("es-ES")} €`} />
            <Stat label="Autoconsumo" value={`${savings.selfConsumedKwh.toLocaleString("es-ES")} kWh`} />
            <Stat label="Retorno" value={savings.paybackYears ? `${savings.paybackYears} años` : "—"} />
          </div>
          <div className="px-4 pt-2"><DataSourceBadge source="System Calculation" sourceType="ESTIMATED" /></div>
          <p className="px-4 pt-2 text-xs italic text-slate-400">{savings.disclaimer}</p>
        </>
      )}
    </div>
  );
}
