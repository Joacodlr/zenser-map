/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_REAL_SOURCE?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_CATASTRO_PROXY?: string;
  readonly VITE_CATASTRO_OVC_PROXY?: string;
  readonly VITE_PVGIS_PROXY?: string;
  readonly VITE_IDEALISTA_ENABLED?: string;
  readonly VITE_MAP_PUBLIC_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

