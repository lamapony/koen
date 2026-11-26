# Køen: build plan

> Køen (Danish for "the queue") is an open-source, static, interactive map of Denmark that shows housing waiting lists as terrain. The longer the queue, the higher the mountain. It is a free showcase that sends interested visitors to Ventelistevalg (ventelistevalg.dk).

Status: planning. Nothing is built, deployed or posted. Plan written 2026-11-26.

Spirit: Karpathy's USA Civ (karpathy.ai/usaciv, verified reachable 2026-11-26) was built in about 7 hours by one person with Claude Code: the agent fetched and processed the open datasets itself, then built one map with many view modes and an Explorer. Køen borrows the recipe (agent-run data pipeline, one map, many lenses, linked Explorer, a short trailer). It does not borrow the look, the game framing or any Civilization elements. Køen's identity is Danish print cartography: paper, ink, contour lines.

---

## 0. The honest premise (read first)

The product idea is "queue length as mountain height". The hard truth, verified while writing this plan:

1. **Andelsbolig queue lengths are not public data.** They sit with each association, its administrator, or a queue provider. Some lists are closed, some open, many publish nothing. No national register exists. Køen will not invent them.
2. **Almene queue lengths are mostly not public either.** Each boligorganisation runs its own lists. The one open dataset found with real counts is Aarhusbolig on opendata.dk (CC BY 4.0), and its files are a 2017 snapshot.
3. **DAWA is gone.** `https://api.dataforsyningen.dk/kommuner` and `/postnumre` returned HTTP 410 Gone on 2026-11-26. Many tutorials still point at DAWA. Køen must not.

So Køen has two layers, kept visually and verbally apart:

- **Køtryk (modelleret)**: a "queue pressure" index for all 98 kommuner, built only from verified open data (Danmarks Statistik, CC BY 4.0). It is the default terrain. It is always labelled as modelled, with the formula one click away.
- **Rigtige køer (målt)**: real queue numbers, only where a source publishes them, shown with source and date on every number. In v1 that is Aarhusbolig (2017 snapshot) plus, if the author approves, aggregate public status data from Ventelistevalg's own catalog for København and Frederiksberg.

The mountain is a metaphor for pressure, not a measurement of people in line. The UI says so in plain Danish.

---

## 1. Datasets

Legend: **verified 2026-11-26** means fetched from this machine on that date (HTTP 200 and the content checked as described). **reachable** means the URL answered but the data or licence was not fully confirmed. **unverified** means not confirmed. Nothing below is invented; where a fact was not confirmed it says so.

### 1.1 Danmarks Statistik (StatBank API)

- API: `https://api.statbank.dk/v1` with endpoints `/tables`, `/tableinfo/{id}`, `/data` (POST, JSON body, CSV out). **Verified 2026-11-26**: table list, metadata for every table below, and live data pulls for BOL101 and EJDFOE1 returned values.
- Licence: DST states its data reuse "svarer til den licens, der benævnes Creative Commons, CC 4.0 BY" at `https://www.dst.dk/da/presse/kildeangivelse`. **Verified 2026-11-26.** Attribution example: "Kilde: Danmarks Statistik" with a link to the table; for derived numbers "Kilde: Egne beregninger baseret på tal fra Danmarks Statistik". The DST logo may not be used.

| Table | What it gives Køen | Geography | Latest period (per API) | Status |
| --- | --- | --- | --- | --- |
| `BOL101` Boliger | Dwellings by owner type: `20` Almene boligselskaber, `41` Private andelsboligforeninger; occupied vs unoccupied (`BEBO` 1000/2000) | 98 kommuner | 2026 | verified 2026-11-26 (data pulled: København 61,847 almene and 94,824 andels occupied dwellings, 2026) |
| `BOL106` Boliger | Average m2 per dwelling and per person, persons per dwelling | kommuner | 2026 | verified 2026-11-26 (metadata) |
| `BOL201` Beboere | Occupants by owner type and age | kommuner | 2026 | verified 2026-11-26 (metadata) |
| `FOLK1A` Befolkning | Population by age, quarterly | kommuner | 2026Q4 | verified 2026-11-26 (metadata) |
| `POSTNR1` Befolkning | Population by postnummer and age band | postnumre | 2026 | verified 2026-11-26 (metadata) |
| `FRKM126` Befolkningsfremskrivning 2026 | Projected population to 2050 | kommuner | 2050 | verified 2026-11-26 (metadata) |
| `FLY66` Flytninger mellem kommuner | Internal migration matrix, by age | kommuner | 2025 | verified 2026-11-26 (metadata) |
| `BYGV33` Boligbyggeri | Dwellings started, completed, under construction, permits, by builder type incl. almene and andels | kommuner | 2026Q3 | verified 2026-11-26 (metadata) |
| `EJDFOE1` Formue i fast ejendom | Average market value of andelsboliger (`EJENTYP` D) owned by residents of each kommune | bopælskommune | 2025 | verified 2026-11-26 (data pulled: Frederiksberg 2,422,337 kr., København 1,736,991 kr.) |
| `INDKP106` Disponibel indkomst | Average disposable income | kommuner | 2025 | verified 2026-11-26 (metadata) |
| `BOST63` Boligstøtte | Households with housing benefit, incl. andels and rental | kommuner | 2025 | verified 2026-11-26 (metadata) |
| `EJ99` Prisindeks andels- og ejerboliger | Price index for housing cooperatives | national and Byen København only | 2026Q2 | verified 2026-11-26 (metadata) |
| `EJ56` Prisindeks ejendomssalg | Price index by property type | 11 landsdele | 2026Q2 | verified 2026-11-26 (metadata) |
| `EJEN77` Ejendomssalg | Sales count, average price, price per m2 | landsdele | 2026Q2 | verified 2026-11-26 (metadata) |
| `HUS1` Huslejeindeks | Rent index incl. "Social housing" and "Cooperative housing" | 5 regioner | 2026Q3 | verified 2026-11-26 (metadata) |

Gap to state plainly: DST has no kommune-level sales price table for andelsboliger. `EJDFOE1` (assessed market value of andelsboliger held by residents of a kommune) is the best open kommune-level price proxy. It is a wealth statistic, not a transaction price, and the UI must call it "gennemsnitlig markedsværdi" not "pris".

### 1.2 Boundaries and grids

| Source | URL | Licence | Status |
| --- | --- | --- | --- |
| DAWA (Dataforsyningen) kommuner/postnumre | `https://api.dataforsyningen.dk/kommuner` | was CC BY 4.0 | **Gone**: HTTP 410 verified 2026-11-26. Do not use. |
| Datafordeler DAGI (official kommune and postnummer polygons) | `https://wfs.datafordeler.dk/DAGIM/...` (GeoServer WFS) and file download via `https://datafordeler.dk/dataoversigt/` | Klimadatastyrelsen free data terms; exact wording unverified | **reachable**: WFS answered HTTP 401 without credentials on 2026-11-26. Needs a free Datafordeler user ("kendt adgang"). Preferred source once the author creates the account. |
| geoBoundaries DNK ADM2 (kommuner) | `https://www.geoboundaries.org/api/current/gbOpen/DNK/ADM2/` | Public Domain (per API metadata, derived from Wikimedia Commons) | **verified 2026-11-26**: simplified GeoJSON has 98 features. Coarse (year represented 2018). Fallback only, for the day-one prototype. |
| Eurostat GISCO LAU 2024 | `https://gisco-services.ec.europa.eu/distribution/v2/lau/` | Eurostat administrative units page sets a non-commercial condition; general Eurostat copyright allows reuse. Conflict. | reachable 2026-11-26. **Not used**: Køen funnels to a paid product, so a non-commercial clause is a risk. |
| Eurostat Census GRID 2021 (1 km population) | `https://gisco-services.ec.europa.eu/pub/population-grid/2021/` (zip, 178 MB) | Specific download rules must be accepted; rules not reviewed | reachable 2026-11-26; licence **unverified**. Used only for the optional hex "population mask" (section 2), only after the rules are read and accepted. |
| DST kvadratnet population | `https://www.dst.dk/da/TilSalg/produkter/geodata/kvadratnet` | Paid product | Not used. |
| Danmarks Højdemodel (DHM) | via Datafordeler / Dataforsyningen | needs account | Not needed. Køen's terrain is data, not real elevation. A real-relief hillshade would compete with the data mountains. |

### 1.3 Queue and almene data

| Source | What it holds | Licence | Status |
| --- | --- | --- | --- |
| **Aarhusbolig** on opendata.dk, dataset `01e0ac24-ac3c-4d04-81b7-cb193df334f9` (`https://admin.opendata.dk/api/3/action/package_search?q=venteliste`) | `Ventelister.xml`: 1,357 rows with `AntalPaaVenteliste` per afdeling, room count and dwelling type. `Afdelinger.xml`: afdeling name, address, postnummer. Also `Lejemaal.xml` (rent, area), `TilOgFraflytninger.xml` | Creative Commons Attribution 4.0 | **verified 2026-11-26** (downloaded and parsed; resource files last modified 2017-11-21, ISO-8859-1 XML). The only real almene queue counts found. Must be labelled "Aarhusbolig, øjebliksbillede 2017". |
| **Københavns Kommune: Almene boligforeninger** (`https://admin.opendata.dk/api/3/action/package_show?id=almene-boligforeninger`, WFS `https://wfs-kbhkort.kk.dk/k101/ows?...typeName=k101:almene_boliger_kk&outputFormat=json`) | 507 almene afdelinger as polygons with counts of family, youth, elderly and care dwellings | CC BY 4.0 | **verified 2026-11-26**. Supply, not queues. Great for the close zoom on København. |
| Landsbyggefonden: *Anvendelse af almene boliger til kommunal anvisning 2026* (`https://lbf.dk/media/i1mg3xqi/anvendelse-af-almene-boliger-til-kommunal-anvisning-2026.pdf`) | Kommune tables of almene family and youth dwellings by rent band, kommunal anvisning share; Huslejeregister as of 1 January 2026. Notes e.g. 3 adults per almen familiebolig in Ballerup and Herlev vs 44 in Gentofte | Licence not stated | **verified 2026-11-26** (PDF read, pages 1 to 4). Use for validation and cited facts only. Ask LBF before extracting tables into the repo. |
| Landsbyggefonden: Ledige boliger (`https://ledigeboliger.lbf.dk/`) | Monthly vacant almene dwellings by region, kommune, organisation, afdeling ("pr. 1. november 2026") | No licence or export stated; page says it "kan ikke anvendes til boligsøgning" | reachable 2026-11-26. Strong inverse-pressure signal (low vacancy, high pressure). **Not used without written permission from LBF.** |
| Landsbyggefonden: Huslejestatistik 2026 (`https://www.lbf.dk/media/fplnqrwm/huslejestatistik-2026.pdf`) | Almene rent levels | Licence not stated | reachable 2026-11-26; per-kommune content **unverified**. |
| Altinget, 27 Oct 2016 (`https://www.altinget.dk/artikel/151660-...`) | Context: København more than 20 almene lists, Aarhus one shared list; 2016 fees | Article, copyright | reachable 2026-11-26. Background reading only; figures are from 2016. |
| **Ventelistevalg public catalog** (`https://ventelistevalg.dk/lister/andels`, `https://ventelistevalg.dk/lister/almene`) | Andelsbolig and almene lists in København and Frederiksberg with dated, sourced signup status | Author's own product | reachable 2026-11-26. Use only aggregate, already-public fields, and only with the author's explicit yes (open question 1). |
| Andelsbolig queue lengths, nationally | Held by associations, administrators and queue providers | n/a | **Not open.** Not scraped. Crowdsourcing is out of scope for v1 (needs consent, moderation, GDPR process). |
| Boliga / Boligsiden prices | Listings and sold prices | No open licence found | **Not used.** |
| Finans Danmark Boligmarkedsstatistik | Kommune m2 prices for houses and flats | Reuse terms not confirmed | **Not used** until terms are confirmed in writing. |

### 1.4 Basemap and tooling

| Item | URL | Licence | Status |
| --- | --- | --- | --- |
| OpenFreeMap hosted vector tiles | `https://openfreemap.org/` | MIT project, OSM data (ODbL). ToS (updated 2026-11-24): no view limits, commercial use allowed, attribution "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" required | verified 2026-11-26 |
| PMTiles (self-hosted Denmark extract, fallback) | `https://docs.protomaps.com/pmtiles/` | OSM ODbL for data | docs verified 2026-11-26; `build.protomaps.com` returned 404, so the source build URL for `pmtiles extract` is **unverified** |
| MapLibre GL JS | `https://maplibre.org/maplibre-gl-js/docs/` | BSD-3 | docs verified 2026-11-26 |
| deck.gl `H3HexagonLayer` | `https://deck.gl/docs/api-reference/geo-layers/h3-hexagon-layer` | MIT | docs verified 2026-11-26 |
| H3 resolution table | `https://h3geo.org/docs/core-library/restable/` | Apache 2.0 | docs verified 2026-11-26 |

---

## 2. Data model

### 2.1 Decision: hex terrain on top of kommune truth

- **Truth lives at kommune level** (98 units). Almost every verified dataset is kommune-level. Pretending to finer precision would be false.
- **Rendering is an H3 hex grid**, resolution 7 (average cell about 5 km2, so roughly 8,000 to 9,000 land cells for Denmark's about 43,000 km2). Hex columns give the terrain look, a clean mobile hit target at country zoom, and a texture that polygons cannot.
- Each hex is assigned to one kommune (cell centre in polygon). A hex shows its kommune's value. The kommune is the plateau; the hexes are the "people in line" that make up the mountain.
- Optional **population mask**: if the Eurostat 2021 grid licence is accepted, hex height is scaled down where nobody lives (fields, forest, heath). This uses real data and makes Jutland's empty interior read as lowland. Without the mask, kommuner are flat mesas, which is honest and still beautiful.
- **Close zoom on København/Frederiksberg** (zoom 11+): switch from hexes to the 507 real almene afdeling polygons (KK WFS) and, if approved, Ventelistevalg's association points. This is where measured data exists, so this is where the map gets precise.
- Postnummer polygons (DAGI) are a stretch layer for `POSTNR1` density, once the Datafordeler account exists.

Why not plain kommune polygons: 98 extruded polygons look like a bar chart glued to a map, København and Frederiksberg become slivers, and big rural kommuner dominate visually. Hexes equalise visual weight per area and still keep values honest.

### 2.2 Schema (build outputs)

```ts
// data/build/kommuner.json  (about 40 KB gzip)
type Kommune = {
  kode: string;            // DST/DAGI kommunekode, e.g. "0101"
  navn: string;            // "København"
  region: string;
  ind: Record<IndicatorId, number | null>; // raw values, null = unknown, never 0-filled
  z: Record<IndicatorId, number | null>;   // winsorised z-scores
  koetryk: number;         // 0..1 percentile of the modelled index
  koetrykBand: [number, number]; // min..max percentile across weight sets (uncertainty)
  maalt?: MeasuredQueue[]; // only where a real source exists
};

type MeasuredQueue = {
  source: "aarhusbolig-2017" | "ventelistevalg";
  sourceUrl: string;
  observedAt: string;      // ISO date of the source snapshot
  postnummer?: string;
  lists: number;           // count of lists in this aggregate
  peopleOnLists?: number;  // only if the source publishes it (Aarhusbolig does)
  openShare?: number;      // only if the source publishes signup status
};

// data/build/indicators.json: id, label_da, label_en, unit, direction, source table, period, licence, formula text

// data/build/hex.bin: columnar binary
// header: count, resolution, indicator order
// columns: h3 index (BigUint64), kommune index (Uint8), popMask (Uint8 0..255), then one Float32 per indicator
```

Rule: `null` means unknown and renders as hatched "ingen data", never as zero height.

### 2.3 Queue pressure index (Køtryk, modelled)

Per kommune, from DST tables only:

| Id | Indicator | Formula | Direction | Weight |
| --- | --- | --- | --- | --- |
| D1 | Voksne pr. almen- eller andelsbolig | FOLK1A adults 18+ / BOL101 (EJER 20 + 41, occupied) | more = more pressure | 0.25 |
| D2 | Befolkningsvækst 5 år | FOLK1A latest vs same quarter 5 years earlier | + | 0.15 |
| D3 | Forventet vækst til 2036 | FRKM126 2036 vs 2026 | + | 0.10 |
| D4 | Unge voksne | FOLK1A share aged 20 to 34 | + | 0.15 |
| P1 | Andelsværdi mod indkomst | EJDFOE1 avg andelsbolig market value / INDKP106 avg disposable income | + | 0.15 |
| S1 | Nybyggeri | BYGV33 dwellings completed, last 4 quarters, per 1,000 residents | more = less pressure | 0.10 |
| S2 | Tomme boliger | BOL101 BEBO 2000 / all dwellings | more = less pressure | 0.10 |

```
z_i   = clamp((x_i - median_i) / (1.4826 * MAD_i), -2.5, 2.5)   // robust z, sign-flipped for S1, S2
raw   = Σ w_i * z_i   (indicators with null are dropped and weights renormalised; count shown in UI)
koetryk = percentile_rank(raw) in [0, 1]
```

Terrain height for a hex in kommune k:

```
h = H_MAX * koetryk_k ^ 1.6 * m_hex
m_hex = 0.35 + 0.65 * log1p(pop_hex) / log1p(pop_p99)   // if population mask is licensed, else m_hex = 1
H_MAX = 9000 (deck.gl elevation units at country zoom, tuned visually; no real-world meaning)
```

The exponent 1.6 makes the top decile read as real peaks and keeps the long tail as rolling lowland, which matches how pressure concentrates around the big cities.

Honesty mechanics:

- **Uncertainty band**: recompute the index for 200 random weight vectors (Dirichlet around the defaults) and store the min to max percentile per kommune. The "Usikkerhed" mode shows it; the kommune card prints it ("Køtryk: top 10 %, men mellem top 4 % og top 18 % afhængigt af vægtene").
- **Leave-one-out check** in CI: Spearman correlation between the full index and each leave-one-indicator-out index must be at least 0.8, or the build fails loudly.
- **Validation, stated modestly**: compare against LBF's published "voksne pr. almen familiebolig" ranking (cited, not copied) and, inside København/Frederiksberg, against Ventelistevalg's share of closed lists if approved. Aarhusbolig 2017 covers one kommune, so it can show within-city variation but cannot validate a national ranking. The method note says this.
- **Real queue layer heights** use their own scale (log of people on list) and their own colour, so they are never confused with the modelled terrain.

---

## 3. Processing pipeline

Python 3.12 managed with `uv`, polars, shapely, h3 (Python bindings), requests with a file cache. Every script is idempotent and runnable alone.

```
pipeline/
  00_fetch_dst.py        # POST /v1/data per table -> data/raw/dst/{table}_{period}.csv
  01_fetch_boundaries.py # geoBoundaries now; DAGI via Datafordeler when credentials exist (env var, never committed)
  02_fetch_queues.py     # Aarhusbolig XML (ISO-8859-1 -> UTF-8), KK WFS GeoJSON
  03_fetch_popgrid.py    # optional, behind a flag, only after licence acceptance
  10_clean.py            # code lists, kommunekode joins, unit checks
  20_indicators.py       # formulas from section 2.3, writes indicators.json
  30_index.py            # z-scores, weights, percentiles, uncertainty band, leave-one-out test
  40_hexes.py            # H3 res 7 polyfill per kommune, pop mask, hex.bin
  50_measured.py         # aggregate real queues to postnummer/kommune; drop anything person-level
  90_manifest.py         # sources.json: url, fetchedAt, sha256, licence, rows, period
Makefile                 # make data (all), make data-offline (from cache), make check
```

Reproducibility:

- Raw downloads are cached under `data/raw/` with a sha256 manifest. `data/raw/` is git-ignored except a small `fixtures/` sample for tests. Build outputs in `data/build/` are committed so the site builds without network.
- Every number in the UI traces to `sources.json` (URL, table, period, fetch date, licence).
- `make check`: schema validation, 98 kommuner present, no indicator silently zero, leave-one-out threshold, output size budget.
- DST rate limits: sequential requests, a descriptive User-Agent with a generic project name (no personal email), cache hits on re-run.

Output budget (static site, gzip): `kommuner.json` under 60 KB, `hex.bin` under 350 KB, kommune outlines TopoJSON under 150 KB, København afdelinger under 250 KB loaded on zoom only. First meaningful paint under 600 KB of data plus basemap tiles.

---

## 4. View modes and the Explorer

One map, one terrain, many lenses. Mode chips in Danish with English in the tooltip. Each mode states its source and period in the legend.

| # | Mode (DA) | Shows | Source | Type |
| --- | --- | --- | --- | --- |
| 1 | **Køtryk** | Default terrain, modelled pressure index | DST, section 2.3 | modelled |
| 2 | **Rigtige køer** | People on Aarhusbolig lists (2017), Ventelistevalg list status in København/Frederiksberg if approved | Aarhusbolig, Ventelistevalg | measured |
| 3 | **Andelsboliger** | Count and share of dwellings owned by andelsboligforeninger | BOL101 | measured |
| 4 | **Almene boliger** | Count and share of almene dwellings; afdeling polygons at København zoom | BOL101, KK WFS | measured |
| 5 | **Voksne pr. bolig** | Adults per almen or andels dwelling (D1) | FOLK1A, BOL101 | derived |
| 6 | **Andelsværdi** | Average market value of andelsboliger held by residents | EJDFOE1 | measured |
| 7 | **Værdi mod indkomst** | P1 ratio | EJDFOE1, INDKP106 | derived |
| 8 | **Tomme boliger** | Unoccupied dwelling share | BOL101 | measured |
| 9 | **Nybyggeri** | Completions per 1,000 residents; toggle for almene and andels builders | BYGV33 | measured |
| 10 | **Vækst** | 5-year population growth | FOLK1A | measured |
| 11 | **2036** | Projected growth to 2036 | FRKM126 | projection |
| 12 | **Unge voksne** | Share aged 20 to 34 | FOLK1A | measured |
| 13 | **Flyttestrømme** | Net internal migration, with arcs for the top flows from a selected kommune | FLY66 | measured |
| 14 | **Boligstøtte** | Households on housing benefit per 1,000 residents | BOST63 | measured |
| 15 | **Usikkerhed** | Width of the Køtryk uncertainty band; tall = we are less sure | derived | meta |

**Explorer** (bottom drawer on desktop, full screen on mobile):

- Table of 98 kommuner, any indicator as a column, sortable, with sparkline of history where the table has it.
- Scatter: pick X and Y (default D1 vs P1), point size by population, brushing selects kommuner and lifts them on the map; hovering the map highlights the dot.
- **"Byg dit eget køtryk"**: sliders for the seven weights. The terrain re-rises live. A "Nulstil" button restores defaults. This turns the modelled index from a claim into an argument the visitor can inspect.
- Kommune card: rank, band, every indicator with source link, measured queue data if any, and the Ventelistevalg touchpoint (section 8).
- Permalinks: `#mode=koetryk&k=0101&x=D1&y=P1&w=...` so journalists can link the exact view.
- CSV download of `kommuner.json` with a licence header line.

**Fortællinger** (guided tour, 5 stops, no LLM at runtime): "Hovedstadens højland", "Aarhus i tal fra 2017", "Hvor ingen står i kø", "Byggeriet der ikke når op", "Usikkerheden". Text is templated from data at build time and edited by hand.

---

## 5. Stack, hosting, repo layout

- **Site**: Vite + TypeScript, no framework (or Preact if UI state grows). MapLibre GL JS for the basemap; deck.gl `H3HexagonLayer` (extruded) via `MapboxOverlay` interleaved with MapLibre; `h3-js` client side for picking. Charts in plain SVG (Explorer scatter and sparklines), no chart library.
- **Basemap**: custom MapLibre style on OpenFreeMap tiles, stripped to coastline, water, major roads at low opacity and place labels. Fallback: self-hosted Denmark PMTiles extract on the same static host.
- **Fonts**: self-hosted WOFF2, subset to Latin + Danish.
- **No backend**, no cookies, no accounts.
- **Hosting options** (no deploy now): GitHub Pages (simplest, free), Cloudflare Pages (fast edge, free analytics without cookies), Vercel static. Any of them works because the output is `dist/`. Domain is an open question; buying one is a spend and needs the author's yes.

```
koen/
  PLAN.md  README.md  LICENSE
  pipeline/            # Python, section 3
  data/
    raw/               # git-ignored cache (+ fixtures/)
    build/             # committed outputs: kommuner.json, hex.bin, indicators.json, sources.json
  site/
    index.html
    src/
      map/             # maplibre style, deck layers, camera, intro motion
      modes/           # one file per view mode
      explorer/        # table, scatter, weights
      copy/da.ts en.ts # all UI strings
      funnel/          # CTA components and UTM builder
    public/fonts/
  docs/
    method.md          # the published method note (DA + EN)
    press/             # press kit sources (text only until approved)
  .github/workflows/   # make check + site build on PR; no deploy job yet
```

---

## 6. Milestones by the hour

Target: about 9 hours of focused agent work plus 1 hour buffer. Each milestone ends with a check that a person can run.

| Hour | Milestone | Acceptance check |
| --- | --- | --- |
| 0:00 to 0:45 | Repo scaffold, `uv` env, Vite site shell, Makefile, CI running `make check` on fixtures | `make check` green in CI; `npm run dev` shows a blank map of Denmark on OpenFreeMap |
| 0:45 to 2:00 | `00_fetch_dst.py` for all 15 tables, cached, manifest written | `sources.json` lists 15 tables with periods matching the API; spot values: BOL101 København EJER 20 occupied 2026 = 61,847 |
| 2:00 to 2:45 | Boundaries (geoBoundaries fallback), H3 res 7 polyfill, kommune assignment | 98 kommuner, every land hex has exactly one kommune, hex.bin under 350 KB |
| 2:45 to 3:45 | Indicators and Køtryk index with uncertainty band and leave-one-out test | Leave-one-out Spearman at least 0.8 for every indicator; top 10 printed and sanity-read by a human; no null rendered as 0 |
| 3:45 to 5:00 | Terrain on the map: extrusion, palette, lighting, intro rise, hover and kommune card | Country view renders at 60 fps on a 2020 MacBook Air; card shows rank, band and sources |
| 5:00 to 6:00 | View modes 3 to 15 wired to the same layer with per-mode legend | Every mode switch under 150 ms; each legend shows source table and period |
| 6:00 to 7:00 | Explorer: table, scatter with linked brushing, weight sliders, permalinks, CSV | Brushing 5 kommuner lifts exactly those 5; a copied permalink restores the same view in a new tab |
| 7:00 to 7:45 | Rigtige køer: Aarhusbolig 2017 aggregates, KK afdelinger at close zoom; Ventelistevalg layer behind a flag until approved | Every measured number shows source and date; no row below aggregate level leaves the pipeline |
| 7:45 to 8:30 | Funnel touchpoints, Danish copy pass, English fallback, method note | All CTAs carry UTM tags; method note explains modelled vs measured in under 400 words |
| 8:30 to 9:15 | Mobile, accessibility, reduced motion, performance budget | Lighthouse mobile performance at least 85, accessibility at least 95; keyboard-only user can pick a kommune and read its card |
| 9:15 to 10:00 | Buffer; trailer capture (30 s screen recording script), press kit text drafts | Trailer storyboard and press kit text in `docs/press/`, nothing published |

---

## 7. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| **The data gap**: people expect real queue lengths everywhere | Modelled vs measured split in name, colour, legend and card; "Hvad betyder bjergene?" explainer on first visit; method note; uncertainty mode. Never print a modelled number as "people in line". |
| Media reports the index as fact ("Gentofte har Danmarks længste kø") | Press kit gives approved phrasing ("højest modelleret køtryk"); every share image carries "modelleret" in the image itself. |
| Index weights look arbitrary | Defaults justified in method note; weights are user-adjustable; uncertainty band shown; leave-one-out test in CI. |
| Licences | Only CC BY 4.0, public domain, ODbL and MIT inputs in v1. LBF and Finans Danmark data used only after written permission. Eurostat grid only after its rules are read. Full attribution panel and `sources.json`. |
| Stale sources (Aarhusbolig is 2017) | Year shown on every measured number and in the legend title; stale data drawn with a hatched texture. Ask Aarhusbolig for a newer export (open question). |
| Dependence on retiring Danish services (DAWA 410, Datafordeler transitions) | No runtime API calls at all; everything is fetched at build time and committed. Boundaries have a public-domain fallback. |
| GDPR / personal data | No personal data collected or published. No names, no queue positions, no addresses of individuals. Aggregates only (afdeling, postnummer, kommune). No cookies. Analytics, if approved, must be cookieless and aggregate. |
| Accuracy claims about Ventelistevalg | Køen never claims Ventelistevalg data is complete; it shows "Ventelistevalg dækker København og Frederiksberg" next to that layer. |
| Funnel feels like an ad and hurts credibility | One quiet CTA per surface, factual tone, the map is complete without clicking through. |
| Performance on old phones | Res 6 hexes on mobile (about 1,200 cells), 2D default with mild pitch, data under 600 KB. |
| Scope creep in a 9-hour build | Stretch items (postnummer layer, population mask, flow arcs) are cut first; the cut list is fixed before hour 5. |

---

## 8. Funnel to Ventelistevalg

Principle: Køen is useful on its own. Ventelistevalg is the next step for someone who is personally in a queue.

Touchpoints:

1. **Kommune card, bottom** (every kommune): "Står du selv på en venteliste? Fornyelsesradar husker fornyelsesdatoen fra brevet, så du ikke mister din plads. 99 kr. for et år." Button: "Se Fornyelsesradar". Link: `https://ventelistevalg.dk/fornyelsesradar?utm_source=koen&utm_medium=map&utm_campaign=launch&utm_content=kommune-0101` (route verified reachable 2026-11-26; price as shown on the live product copy).
2. **København and Frederiksberg cards**: an extra line "Se dateret status for andelsforeninger i København og Frederiksberg" linking to `https://ventelistevalg.dk/lister/andels` and `https://ventelistevalg.dk/lister/almene` with UTM tags. Per-forening or per-bydel deep links only if Ventelistevalg supports such query parameters; that is not confirmed here (open question 4).
3. **Rigtige køer mode legend**: "Data om rigtige køer findes kun få steder. Ventelistevalg samler dateret status med kilde." with a link.
4. **Footer and About**: "Køen er lavet af folkene bag Ventelistevalg. Koden er open source." No banner, no popup, no modal.
5. **Share images**: small "ventelistevalg.dk" wordmark in the corner, nothing else.

Not built: email capture, newsletters, accounts, retargeting pixels. Any of these needs the author's explicit approval first.

Tone: calm, factual, du-form, no urgency tricks, no "før det er for sent".

Measurement (only with the author's approval of the analytics tool):

- Cookieless aggregate counter (for example Cloudflare Web Analytics or a self-hosted GoatCounter): page views, mode switches, Explorer opens, outbound CTA clicks by `utm_content`.
- On the Ventelistevalg side: sessions and Fornyelsesradar purchases with `utm_source=koen`, read from whatever Ventelistevalg already measures.
- Success after 30 days: outbound click rate from kommune cards, and paid conversions attributed to `koen`. Targets set by the author.

---

## 9. Launch plan (plans only, nothing is posted)

Every post, pitch and email below needs the author's own yes before it is sent.

- **Timing**: Tuesday to Thursday, 07:30 to 09:00 Danish time. Avoid December holidays. Suggested window: second or third week of January 2027 (new year, moving and housing plans on people's minds), or tie to DST's next BOL101 release in spring as a news hook. Final date is the author's call.
- **Sequence**: soft launch to 5 to 10 trusted readers (data people, one journalist, one housing person) for a week of corrections, then LinkedIn and press on the same morning, then Hacker News "Show HN" and r/Denmark the next day in English.
- **LinkedIn** (author's account): Danish post, 120 to 180 words, the 30 s trailer as native video, the built-with-an-agent story in two sentences, link in first comment. Angle: "Jeg byggede et kort over Danmarks boligkøer på en dag med en AI-agent, og det vigtigste var det, vi ikke kunne finde."
- **Danish media targets and angles**:
  - DR (Nyheder, data desk): "Hvor er presset på boligkøerne størst, og hvorfor ved ingen, hvor lange køerne er?"
  - Politiken (Bolig, Byen): København vs rest of Denmark; the gap in public queue data.
  - Ingeniøren and Version2: open data, DAWA's shutdown, an agent-built open-source map.
  - Børsen (privatøkonomi): andelsværdi vs income by kommune.
  - Boligmagasinet: almene and andels sector angle; invite boligorganisationer to publish queue counts like Aarhusbolig did.
  - Altinget Bolig: policy angle, the 2016 queue-fee story revisited with what is and is not public now.
  - Local outlets in Aarhus: the Aarhusbolig open data example.
- **Press kit** (`docs/press/`): one-page release in Danish and English; method note; 6 high-resolution screenshots (country, København zoom, Explorer, uncertainty mode, mobile, dark mode); 30 s trailer and 9:16 cut; CSV of the index with licence; approved phrasings ("modelleret køtryk", never "køens længde" for modelled values); data sources and licences table; author bio and contact (author supplies); logo files.

---

## 10. Visual direction

Concept: **"Kø-kort"**: a Danish topographic sheet printed on warm paper, where the hills are made of people waiting. Calm, exact, a bit poetic. Not a dashboard, not a game.

**Palette** (light, default)

| Token | Hex | Use |
| --- | --- | --- |
| `papir` | `#F2EDE3` | page and land base |
| `hav` | `#D3DEE0` | sea, with a faint 1 px hatch at low zoom |
| `blaek` | `#1E242B` | text, contour lines, outlines |
| `graa` | `#8A8F93` | secondary text, inactive chips |
| terrain ramp 1 to 7 | `#EEE6D2` `#E2D0A2` `#D6B176` `#C98B52` `#B2603F` `#863A35` `#4A1F2C` | sand to oxblood, the Køtryk ramp |
| `maalt` | `#2747E8` | measured queue needles and labels only (cobalt, never used for modelled data) |
| `ingen-data` | `#F2EDE3` with `#C9C2B4` 45° hatch | unknown |

Dark mode ("Nattekort"): background `#10151A`, land `#1A2128`, same ramp lifted 8 % in lightness, `maalt` becomes `#7C93FF`. The ramp is sequential and checked for deuteranopia and protanopia; height doubles every colour cue.

**Typography**

- Display: **Fraunces** (SIL OFL), optical size high, soft axis 0, for the wordmark "Køen", kommune names on cards and big numbers. The "ø" in the wordmark gets the slash extended into a contour line motif.
- UI and body: **Atkinson Hyperlegible Next** (SIL OFL), chosen for legibility on maps and for low-vision users.
- Numbers and map labels: **IBM Plex Mono** (OFL), tabular figures, small caps style labels in letterspaced uppercase for legends.
- Scale: 12 / 14 / 16 / 20 / 28 / 44 / 72 px. Danish number formatting everywhere (1.736.991 kr., 12,5 %).

**Terrain rendering**

- Extruded hex columns with a 7 % inset gap so the surface reads as many individuals, not a solid block. Top faces take the ramp colour; side walls are 22 % darker; a directional light from the north-west (cartographic convention) plus soft ambient.
- Thin ink contour lines at Køtryk deciles drawn on the 2D view and as a ground shadow in 3D.
- Camera: pitch 52°, bearing -14°, framed so Jutland, Fyn and Sjælland fit with Bornholm in an inset circle (Bornholm is never cut off).
- Labels: only the top 8 kommuner by current mode get a leader-line label in Plex Mono, like spot heights on a survey map ("KØBENHAVN  ▲ 0,97").

**Motion**

- Intro: the land starts flat; columns rise over 1.6 s, staggered outward by distance from the visitor's selected kommune or from København by default ("køen vokser"). Ease `cubic-bezier(0.23, 1, 0.32, 1)`.
- Mode switch: heights morph over 450 ms; colours cross-fade; no camera jump.
- Hover: column lifts 4 % and gets an ink outline in 120 ms.
- `prefers-reduced-motion`: no rise, no morph, instant state changes, 2D map default.

**Mobile**

- 2D first with 35° pitch, res 6 hexes, bottom sheet with three snap points (peek: mode chips; half: kommune card; full: Explorer).
- Mode chips in a horizontal scroller, 44 px tap targets, one-finger pan, two-finger tilt.

**Copy, Danish first** (English toggle "EN" in the header, all strings in `copy/da.ts` and `copy/en.ts`)

- Hero: "Køen. Danmarks boligkøer som landskab."
- Sub: "Jo højere bjerget, jo større presset på ventelisterne. Bjergene er modelleret ud fra åbne data. Rigtige kølængder er vist med blåt, der hvor de findes."
- First-visit explainer title: "Hvad betyder bjergene?"
- Unknown: "Ingen åbne data"
- Measured label: "Målt: 3.205 personer på venteliste · Aarhusbolig · 2017"
- Modelled label: "Modelleret køtryk: top 10 % i Danmark"
- Weight panel: "Byg dit eget køtryk"

**Accessibility**

- WCAG 2.2 AA contrast for all text; the map is never the only way in: the Explorer table is a full, keyboard-navigable equivalent with the same data.
- Selection announced via `aria-live`; focus rings visible on map controls; skip link to the table.
- No meaning by colour alone: height, value labels and patterns (hatch for unknown and stale) carry the same information.
- `lang="da"` with `lang="en"` on toggled content.

---

## 11. Open questions for the author

1. May Køen show aggregate data from Ventelistevalg's public catalog (for example count of lists and share open per bydel, with dates)? Which fields exactly?
2. Which product is the main CTA: Fornyelsesradar (99 kr. per year) as this plan assumes, or another Ventelistevalg product?
3. Analytics: which cookieless tool, if any, may Køen use?
4. Does Ventelistevalg support (or want) deep links filtered by bydel or kommune, and with which URL parameters?
5. Will you create a free Datafordeler user so Køen can use official DAGI boundaries instead of the coarse public-domain fallback?
6. Should we write to Landsbyggefonden for permission to use Ledige boliger and the anvisning tables, and to Aarhusbolig for a newer waiting-list export?
7. Domain and hosting: a subpath of an existing site, a GitHub Pages URL, or a new domain (a spend, needs your yes)?
8. Launch date, and whose name goes on the press release and LinkedIn post?
9. Is the Eurostat 2021 population grid worth the licence review for the population mask, or do we keep honest flat kommune mesas?
10. English name for the international posts: keep "Køen" with a gloss ("Køen, the queue"), or add an English subtitle?
