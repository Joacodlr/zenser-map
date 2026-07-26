import { useQuery } from "@tanstack/react-query";
import type { ListingsResult } from "@/types";
import type { Selection } from "@/components/map/BuildingMap";
import { load } from "./api";
import { DataSourceBadge } from "@/components/data/DataSourceBadge";
import { Loading, Stat, SectionTitle } from "./ui";
import { IBIZA_ZONE } from "@/lib/fixtures/zones";

// TAB INMUEBLE — market overview: zone price + a headline of what's listed.
export function BuildingProperty({ sel }: { sel: Selection }) {
  const { data, isLoading } = useQuery({
    queryKey: ["listings", sel.buildingId, sel.lat, sel.lng],
    queryFn: () => load.listings(sel),
  });

  const price = IBIZA_ZONE.properties.avgPricePerM2;
  const sale = data ? [...data.inBuilding, ...data.nearby].filter((l) => l.operation === "sale") : [];
  const rent = data ? [...data.inBuilding, ...data.nearby].filter((l) => l.operation === "rent") : [];

  return (
    <div>
      <div className="mx-4 mt-4 rounded-xl border border-teal/20 bg-teal/5 p-4 text-center">
        <div className="text-xs uppercase tracking-wide text-slate-400">Precio medio de la zona · Ibiza</div>
        <div className="mt-1 text-3xl font-bold text-teal-deep">
          {price?.toLocaleString("es-ES", { minimumFractionDigits: 1 })} €/m²
        </div>
        <div className="mt-2 flex justify-center">
          <DataSourceBadge source="Demo" sourceType="DEMO" />
        </div>
      </div>

      {isLoading ? (
        <Loading label="Cargando mercado…" />
      ) : (
        <>
          <SectionTitle>Resumen de anuncios</SectionTitle>
          <div className="grid grid-cols-2 gap-2 px-4">
            <Stat label="En venta (zona)" value={sale.length} />
            <Stat label="En alquiler (zona)" value={rent.length} />
            <Stat label="En este edificio" value={data?.inBuilding.length ?? 0} />
            <Stat label="Cerca" value={data?.nearby.length ?? 0} />
          </div>
          <p className="px-4 pt-3 text-xs text-slate-400">
            Detalle completo y nivel de confianza en la pestaña <span className="font-medium">Anuncios</span>.
          </p>
        </>
      )}
    </div>
  );
}
