import { useQuery } from "@tanstack/react-query";
import type { BuildingDetails } from "@/types";
import type { Selection } from "@/components/map/BuildingMap";
import { load } from "./api";
import { SourcedRow } from "@/components/data/DataSourceBadge";
import { Panel, Loading, ErrorNote } from "./ui";
import { CreateMiniStoreButton } from "./CreateMiniStoreButton";

export function BuildingSummary({ sel }: { sel: Selection }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["building", sel.buildingId, sel.lat, sel.lng],
    queryFn: () => load.building(sel),
  });

  if (isLoading) return <Loading label="Cargando datos catastrales…" />;
  if (error) return <ErrorNote message="Datos catastrales temporalmente no disponibles." />;
  if (!data) return null;

  return (
    <Panel>
      <SourcedRow label="Dirección" value={data.address.value} source={data.address.source} sourceType={data.address.sourceType} />
      <SourcedRow label="Municipio" value={data.municipality.value} source={data.municipality.source} sourceType={data.municipality.sourceType} />
      <SourcedRow label="Provincia" value={data.province.value} source={data.province.source} sourceType={data.province.sourceType} />
      <SourcedRow label="Referencia catastral" value={data.cadastralReference.value} source={data.cadastralReference.source} sourceType={data.cadastralReference.sourceType} />
      <SourcedRow label="Superficie construida" value={data.buildingAreaM2.value} suffix=" m²" source={data.buildingAreaM2.source} sourceType={data.buildingAreaM2.sourceType} />
      <SourcedRow label="Parcela" value={data.parcelAreaM2.value} suffix=" m²" source={data.parcelAreaM2.source} sourceType={data.parcelAreaM2.sourceType} />
      <SourcedRow label="Año de construcción" value={data.yearBuilt.value} source={data.yearBuilt.source} sourceType={data.yearBuilt.sourceType} />
      <SourcedRow label="Plantas" value={data.floors.value} source={data.floors.source} sourceType={data.floors.sourceType} />
      <SourcedRow label="Viviendas" value={data.dwellings.value} source={data.dwellings.source} sourceType={data.dwellings.sourceType} />
      <SourcedRow label="Tipo" value={data.buildingType.value} source={data.buildingType.source} sourceType={data.buildingType.sourceType} />
      <CreateMiniStoreButton sel={sel} details={data} />
    </Panel>
  );
}
