import { useQuery } from "@tanstack/react-query";
import type { EnergyResult } from "@/types";
import type { Selection } from "@/components/map/BuildingMap";
import { load } from "./api";
import { DataSourceBadge, SourcedRow } from "@/components/data/DataSourceBadge";
import { Loading, ErrorNote, EmptyNote, SectionTitle, Stat } from "./ui";

export function BuildingEnergy({ sel }: { sel: Selection }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["energy", sel.buildingId, sel.lat, sel.lng],
    queryFn: () => load.energy(sel),
  });

  if (isLoading) return <Loading label="Cargando datos energéticos…" />;
  if (error) return <ErrorNote message="Datos energéticos no disponibles." />;
  if (!data) return null;

  return (
    <div>
      <SectionTitle>Certificado oficial</SectionTitle>
      {data.certificate.available ? (
        <div className="px-4">
          <SourcedRow label="Calificación" value={data.certificate.rating.value} source={data.certificate.rating.source} sourceType={data.certificate.rating.sourceType} />
          <SourcedRow label="Consumo" value={data.certificate.consumptionKwhM2Year.value} suffix=" kWh/m²·año" source={data.certificate.consumptionKwhM2Year.source} sourceType={data.certificate.consumptionKwhM2Year.sourceType} />
          <SourcedRow label="Emisiones" value={data.certificate.co2KgM2Year.value} suffix=" kg CO₂/m²·año" source={data.certificate.co2KgM2Year.source} sourceType={data.certificate.co2KgM2Year.sourceType} />
        </div>
      ) : (
        <EmptyNote message="Datos energéticos oficiales no disponibles." />
      )}

      {data.estimate && (
        <>
          <SectionTitle>Estimación del sistema</SectionTitle>
          <div className="grid grid-cols-2 gap-2 px-4">
            <Stat label="Consumo estimado" value={`${data.estimate.consumptionPerM2} kWh/m²·año`} />
            <Stat label="Anual estimado" value={`${data.estimate.estimatedAnnualConsumptionKwh.toLocaleString("es-ES")} kWh`} />
            <Stat label="CO₂ estimado" value={`${data.estimate.estimatedCo2Kg.toLocaleString("es-ES")} kg/año`} />
            <div className="flex items-center rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <DataSourceBadge source="System Calculation" sourceType="ESTIMATED" />
            </div>
          </div>
          <p className="px-4 pt-2 text-xs italic text-slate-400">
            Este valor no representa necesariamente el consumo real.
          </p>
        </>
      )}
    </div>
  );
}
