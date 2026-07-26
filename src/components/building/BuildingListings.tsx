import { useQuery } from "@tanstack/react-query";
import type { ListingsResult, Listing } from "@/types";
import type { Selection } from "@/components/map/BuildingMap";
import { load } from "./api";
import { DataSourceBadge } from "@/components/data/DataSourceBadge";
import { Loading, ErrorNote, EmptyNote, SectionTitle } from "./ui";
import { IBIZA_ZONE } from "@/lib/fixtures/zones";

const CONF_LABEL: Record<Listing["match"], string> = {
  EXACT: "Coincidencia exacta",
  HIGH: "Alta confianza",
  MEDIUM: "Confianza media",
  LOW: "Confianza baja",
};

function ListingCard({ l }: { l: Listing }) {
  const isRent = l.operation === "rent";
  return (
    <div className="mx-4 mb-2 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-deep">
          {isRent ? "Alquiler" : "Venta"}
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {CONF_LABEL[l.match]}
        </span>
      </div>
      <div className="mt-1 text-lg font-bold text-ink">
        {l.price.toLocaleString("es-ES")} {isRent ? "€/mes" : "€"}
      </div>
      <div className="text-sm text-slate-500">
        {[l.sizeM2 && `${l.sizeM2} m²`, l.rooms && `${l.rooms} hab.`, l.bathrooms && `${l.bathrooms} baños`]
          .filter(Boolean)
          .join(" · ")}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs text-slate-400">{l.addressOrArea}</span>
        <DataSourceBadge source={l.source} sourceType={l.sourceType} />
      </div>
      {l.url && (
        <a href={l.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-teal-deep underline">
          Ver anuncio oficial
        </a>
      )}
    </div>
  );
}

export function BuildingListings({ sel }: { sel: Selection }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["listings", sel.buildingId, sel.lat, sel.lng],
    queryFn: () => load.listings(sel),
  });

  const price = IBIZA_ZONE.properties.avgPricePerM2;

  return (
    <div>
      <div className="mx-4 mt-3 mb-1 flex items-center justify-between rounded-lg bg-teal/5 px-3 py-2">
        <span className="text-sm text-slate-500">Precio medio de la zona</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">{price?.toLocaleString("es-ES")} €/m²</span>
          <DataSourceBadge source="Demo" sourceType="DEMO" />
        </div>
      </div>

      {isLoading && <Loading label="Buscando anuncios…" />}
      {error && <ErrorNote message="No hay anuncios encontrados." />}

      {data && (
        <>
          <SectionTitle>Anuncios en este edificio</SectionTitle>
          {data.inBuilding.length === 0 ? (
            <EmptyNote message="Sin anuncios asociados a este edificio con suficiente evidencia." />
          ) : (
            data.inBuilding.map((l) => <ListingCard key={l.id} l={l} />)
          )}

          <SectionTitle>Anuncios cerca del edificio</SectionTitle>
          {data.nearby.length === 0 ? (
            <EmptyNote message="Sin anuncios cercanos." />
          ) : (
            data.nearby.map((l) => <ListingCard key={l.id} l={l} />)
          )}
        </>
      )}
    </div>
  );
}
