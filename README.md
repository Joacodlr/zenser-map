# Building Intelligence Map — Ibiza (Retiro, Madrid) · Vite MVP

Mapa interactivo de edificios. Haz clic en un edificio y consulta datos del
**Catastro**, **anuncios** (mock), **energía** (oficial + estimada) y **potencial
solar** (PVGIS) — con la **fuente y confianza de cada dato** siempre visibles.

Área de estudio: **Barrio de Ibiza, Distrito de Retiro, Madrid** (`AREA_OF_INTEREST = IBIZA_MADRID`).

## Arranque

```bash
cp .env.example .env.local     # VITE_DEMO_MODE=true por defecto
npm install
npm run dev                    # http://localhost:5173
```

Funciona **sin ninguna API key**. En demo verás mapa, zona Ibiza con precio
(`DEMO DATA`), edificios de ejemplo y las 5 pestañas. El solar usa **PVGIS real**.

## Vite ≠ backend — qué cambia respecto a la spec

Vite es solo frontend, así que no hay servidor. Consecuencias, ya resueltas:

| Fuente | En este proyecto |
|---|---|
| **Catastro** (gratis) | Real. En `npm run dev` pasa por el **proxy de Vite** (`/catastro`) para evitar CORS. |
| **PVGIS** (gratis) | Real, vía proxy `/pvgis`. Funciona incluso en modo demo. |
| **Idealista** | **Solo mock.** Su API necesita OAuth con secreto → requiere un backend. Sin él no se puede (y su acceso está muy restringido de todas formas). |
| **Secretos** | No hay secretos en el cliente. Cuando añadas Idealista, hazlo en un backend/serverless. |
| **Producción estática** | El proxy solo existe en `dev`. Para desplegar estático, pon un proxy/serverless delante de Catastro y PVGIS. |

Cambiar demo↔real vive en un único sitio: las *factories* de `src/lib/data-sources/*`.

## Cómo está montado

En la versión Next esto eran API routes; aquí colapsan en **una capa de servicios
cliente** (`src/lib/api.ts`) que los componentes llaman con React Query:

```
getZones() · getBuildings(bbox) · getBuildingDetails(id,lat,lng)
getListings(...) · getEnergy(...) · getSolar(...)
```

`getBuildings` valida el bbox con Zod y lanza `BboxTooLargeError` (>3,5 km²) →
el mapa muestra "Acerca el mapa para cargar edificios."

### Provenance (el corazón del proyecto)

Cada valor lleva `{ value, source, sourceType }` con
`OFFICIAL · ESTIMATED · SIMULATED · EXTERNAL_API · DEMO`, renderizado por
`<DataSourceBadge>`. Nunca se mezcla oficial con estimado; lo que falta es
**"No disponible"** (no se inventa nada).

## Pasar a real

1. `VITE_DEMO_MODE=false` en `.env.local`.
2. **Edificios (por defecto: `catastro-snapshot`)**: footprints + atributos
   **oficiales del Catastro** desde un **fichero estático empaquetado** —
   `src/lib/fixtures/ibiza-catastro-buildings.geojson`. Cero llamadas de red en
   runtime, así que **cero 429/CORS** al mover/hacer zoom. El bbox se filtra
   localmente. Ver "Snapshot de edificios" abajo para regenerarlo y para las
   fuentes alternativas (`snapshot` OSM, `osm` en vivo).
3. **PVGIS 5.3**: ya funciona.
4. **Idealista**: monta un backend proxy que guarde las credenciales y devuelva
   anuncios; luego implementa un `RealEstateListingDataSource` que llame a TU proxy.

### Snapshot de edificios (fuente real por defecto)

El área de estudio es fija (un barrio), así que en vez de llamar a un servicio en
vivo en cada `moveend` (Catastro WFS bloquea bots + CORS; Overpass da `HTTP 429`),
se descarga **una sola vez** y se empaqueta un GeoJSON que el runtime filtra por
bbox localmente. **Cero llamadas de red en runtime.**

**Por defecto: datos OFICIALES del Catastro** (`catastro-snapshot`).

```bash
node scripts/fetch-catastro.mjs
```

Este script usa el **servicio de descarga masiva INSPIRE ATOM** del Catastro
(el mismo origen que usa Idealista Maps) — NO el WFS en vivo. Descarga tres capas
oficiales del municipio de Madrid (28900): `BuildingExtended2D` (~583 MB),
`Addresses` (~232 MB) y `buildingpart` (~1,9 GB, para las plantas), las *streamea*,
recorta a `STUDY_BBOX`, reproyecta EPSG:25830 → WGS84, **une direcciones y plantas
a cada edificio por referencia catastral**, y escribe
`src/lib/fixtures/ibiza-catastro-buildings.geojson` con atributos **oficiales**:

| Campo | Cobertura (barrio Ibiza) |
|---|---|
| Referencia catastral (14 díg.) | 100 % |
| Dirección (calle + nº + CP) | ~100 % (unida desde el fichero AD) |
| Nº de plantas | ~100 % (máx. de las `buildingpart`) |
| Uso (`currentUse`) | ~99 % |
| Año de construcción | ~99 % |
| Superficie construida oficial (m²) | ~99 % |
| Nº de viviendas | ~88 % |

Atribución requerida: **"Dirección General del Catastro"**. Regenera cuando cambie
`STUDY_BBOX` o quieras datos frescos. (Las uniones de dirección y plantas son
opcionales y resilientes: si un fichero falla, se escriben los edificios sin ese
campo. Las plantas = máximo `numberOfFloorsAboveGround` entre las partes del
edificio; el fichero `buildingpart` es grande, así que este paso es el más lento.)

**Alternativa: snapshot de OSM** (`snapshot`) — footprints reales + direcciones:

```bash
npm run fetch:buildings      # = node scripts/fetch-buildings.mjs
```

Consulta Overpass por `way["building"]` dentro de `STUDY_BBOX`, rota *mirrors*
(overpass-api.de, kumi.systems, private.coffee) con *backoff* en 429/timeout, y
escribe `src/lib/fixtures/ibiza-buildings.geojson` (`building`, `building:levels`,
`start_date`, `addr:*`, `ref:catastro`).

**Provenance honesto:** cada valor lleva su propia fuente. Catastro →
`source: "Catastro"` / `OFFICIAL`; OSM → `"OpenStreetMap"` / `EXTERNAL_API`. Un
atributo se muestra **solo si existe**; si no, **"No disponible"** (nada inventado).
La choropleth verde de precio sigue siendo un **ESTIMATE** etiquetado.

**Fuentes (`VITE_REAL_SOURCE`):**

| Valor | Fuente | Red en runtime |
|---|---|---|
| `catastro-snapshot` *(por defecto)* | Fichero oficial del Catastro empaquetado. | No |
| `snapshot` | Fichero de OSM empaquetado. | No |
| `osm` | Overpass en vivo. Rota *mirrors* + *backoff* en 429. | Sí (limitado) |
| `catastro` | WFS INSPIRE en vivo. Suele bloquear bots + CORS. | Sí (frágil) |

## Crear MiniStore en Deanna (integración deanna2u)

Desde la pestaña **Resumen** de un edificio, el botón **"Crear MiniStore de este
edificio"** guarda toda la info que reúne la app (Catastro oficial + energía y
solar estimados + anuncios) como una **MiniStore** en la plataforma Deanna. Cada
dato es un *clipping* distinto, con su fuente y confianza incluidas.

**Flujo (la API key nunca llega al navegador):**

```
navegador → POST /api/deanna/create-ministore   (proxy dev de Vite, en Node)
             ↳ añade la cabecera secreta x-api-key
             → POST {DEANNA_API_BASE}/api/external/create-ministore  (deanna2u)
             ← { success, slug, bookId, url }
```

El endpoint `external/create-ministore` de deanna2u ya existe; aquí no se toca su
código. Configúralo con dos variables **sin prefijo `VITE_`** (para que NO se
expongan al cliente) en `.env.local`:

```env
CREATE_MINISTORE_API_KEY=   # mismo valor que en deanna2u
DEANNA_API_BASE=            # opcional; por defecto https://deanna.pro
                            # usa http://localhost:3000 para deanna2u en local
```

Como el resto de proxies, esto **solo existe en `npm run dev`**. Para un despliegue
estático, mueve el reenvío de `deannaProxy` (en `vite.config.ts`) a una función
serverless. Sin la key, el botón responde "Falta CREATE_MINISTORE_API_KEY…".

### Imágenes del edificio en la MiniStore

Todo se hace **desde este mapa** (usa la API+BD de Deanna para crear la MiniStore,
pero **no toca el código de deanna2u**):

1. **Fachada a pie de calle (Google Street View):** servida por el **propio endpoint
   de esta app**, `/api/facade` — proxy de Vite en dev y **función serverless**
   (`api/facade.js`) en producción, ambos con el mismo núcleo (`api/_facade-core.mjs`).
   La **key de Google vive en el entorno de ESTA app**, nunca en el navegador ni en
   deanna2u. Hace primero una comprobación *metadata* (gratuita) y solo añade la foto
   si existe imagen real.
2. **Vista aérea (siempre):** ortofoto oficial **IGN PNOA** (WMS, sin key), como
   respaldo/segunda imagen.

**Requisito clave:** para que la fachada se vea *dentro* de una MiniStore alojada en
`deanna.pro`, la URL de la imagen debe ser **pública** — apunta al origen de esta app.
Por eso en **local (localhost) la fachada se omite** (deanna.pro no puede acceder a tu
localhost); aparece al **desplegar** la app (con la función `api/facade.js` y la key),
o si defines `VITE_MAP_PUBLIC_BASE` a una URL pública (p. ej. un túnel).

Variables (en el entorno de ESTA app, no en deanna2u):

```env
GOOGLE_MAPS_API_KEY=       # Maps Platform con "Street View Static API" activada
                           # (dev: .env.local · prod: variables del hosting)
VITE_MAP_PUBLIC_BASE=      # opcional; por defecto el origen actual (window.origin)
```

## Estructura

```
index.html · vite.config.ts (proxies Catastro/PVGIS) · tailwind/postcss
src/
  main.tsx · App.tsx · providers.tsx · index.css
  lib/      api.ts (servicios), config, data-sources/, calculations/,
            validation/, cache/, geo/ (proj, gml, geometry), fixtures/, matching
  components/ map/ (BuildingMap, ZoneLayer, BuildingLayer)
              building/ (panel + 5 tabs)  data/ (DataSourceBadge)
  types/    building, listing, energy, solar, zone, common (provenance)
```

## Estado / calidad

- `npm run build` compila limpio (tsc estricto + Vite; 264 módulos).
- Modo demo: flujo completo end-to-end.
- El parser GML de Catastro necesita afinado contra payloads reales.
- Estimaciones de energía y ahorro son heurísticas transparentes, siempre
  etiquetadas como estimadas; el ahorro incluye el descargo:
  *"Este cálculo no sustituye un estudio técnico o financiero profesional."*
