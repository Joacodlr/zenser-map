import type { Selection } from "@/components/map/BuildingMap";
import { getBuildingDetails, getListings, getEnergy, getSolar } from "@/lib/api";

// Thin loaders bound to a map Selection, used as React Query queryFns.
export const load = {
  building: (s: Selection) => getBuildingDetails(s.buildingId, s.lat, s.lng),
  listings: (s: Selection) => getListings(s.buildingId, s.lat, s.lng),
  energy: (s: Selection) => getEnergy(s.buildingId, s.lat, s.lng),
  solar: (s: Selection) => getSolar(s.buildingId, s.lat, s.lng),
};
