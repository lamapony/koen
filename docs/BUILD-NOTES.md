# Build notes: Køen v1 with Køtryk v2 (local build, 2026-11-26)

Status: runs locally. Nothing is deployed, pushed or published. No analytics, no email capture, no cookies.

## Pass 4: final pass, review fixes and design quick wins (2026-11-26, night)

Commits on `build/v1`, nothing pushed, merged or deployed.

### Inputs and what came of them

- `../orch2/agy-review.md` (independent QA review) holds one line of intent ("I'll QA the built site ...") and no findings. There were no must-fix items in it to verify.
- `docs/review/codex-pass2.md`: all items checked. Its fixes (Brøndby "six" to "five" in METHOD.md, the route fixture and `site/tests/ventelistevalg.test.ts`, `tests/recompute_validation.py`) were in the working tree uncommitted; they are committed now. The audit script crashed after the n filter below (a kommune with no price input divided by zero); it now scores such a kommune 0 like `30_index.combine`, and its numbers match `55_validate.py`. Its smoke-test block was a sandbox limit; `npm run test:smoke` passes here.
- `../orch2/agy-method.md` (independent method cross-check, now with content; in pass 3 it held one line): every claim re-run on the cached DST data. What was adopted and rejected, with numbers, is in `docs/METHOD.md`, section "Independent cross-check".

### Method and data changes

- P1 and P2 need at least 50 EJDFOE1 holdings (drops Læsø, Ærø, Samsø from P1 and Læsø, Morsø, Ærø from P2). No top-15 rank changed.
- Leave-one-out floor 0.8 to 0.85, plus a new `make check` gate: at least 7 of the top 10 survive when any one indicator is dropped (v2: 9 or 10).
- `55_validate.py` reports clamp sensitivity (3.5, 4.0, none) and the leave-one-out top-10 overlap; both go to `indicators.json`.
- Net migration (B07 + B10) re-checked and still rejected: the review's +9.9 per 1,000 for København is B10 alone; with B07 it is +1.2, rank 87.
- S2 label corrected (only unoccupied holiday homes are excluded). Intro copy (DA, EN) names the actual v2 parts. `peopleOnLists` renamed `signups` (pipeline, site, PLAN.md). EJDFOE1 sources get separate titles. Aarhusbolig 8520 Lystrup and 8680 Ry no longer lose their town name. KK almene source shows the Open Data DK resource date (2015-12-08).
- Method panel reads the LOO threshold from the data instead of hardcoding 0.8.

### Design critique of the pass 3 screenshots (short)

1. **The map did not say where the story is.** At country zoom only one spot label survived ("BRØNDBY 1,00"), because the top 8 sit within a few pixels in the Copenhagen suburbs. A reader could not find København, Frederiksberg or Aarhus, the three cities the copy talks about, and had no rank to compare. *Fixed:* labels carry their rank ("2. KØBENHAVN ▲ 0,99"); the no. 1 and the four largest cities (København, Aarhus, Odense, Aalborg) are always candidates; neighbouring labels stack on up to four leader heights instead of being dropped; leader heights are in screen pixels so the stack also works on a phone; near a side edge a label hangs inward; labels stay out from under the desktop card.
2. **Validation table wrapped mid-list** ("Frederiksberg 16, Aarhus / 6") in a narrow mono column, so v1 and v2 could not be read across. *Fixed:* one city per line, ranks in bold.
3. **Shot 06 showed only the bottom of the card**, so the København rank and band were not in any desktop shot. *Fixed:* 06 now shows the top of the card; 14 (Frederiksberg) still shows the CTA end.
4. Not changed (bigger than a quick win): the default pitch still hides part of the Copenhagen suburbs behind North Zealand; at 390 px the Frederiksberg label touches the Aarhus label; label width is estimated (7 px per character), so very long names can still crowd.

### Checks

`npm run build`, `npm test` (9 Python + 6 Vitest), `npm run test:smoke` and `make check` (0 failures) pass at the end of this pass. `make data-offline` was re-run from the local cache. All 16 shots in `docs/shots/` retaken.

### Ventelistevalg URLs used (all with utm_source=koen, utm_medium=map, utm_campaign=<view at click time>, utm_content=<placement>)

`https://ventelistevalg.dk/`, `/fornyelsesradar`, `/vejledning`, `/datakilder`, `/lister/andels`, `/lister/almene`, `/lister/andels/bydel/` + `indre-by`, `noerrebro`, `oesterbro`, `vesterbro`, `amager`, `valby`, `vanloese`, `nordvest`, `frederiksberg`. Not linked because they answered 404 live in pass 3: `/ko-vagt`, `/ventelistetjek`, `/foreningsroentgen`.

### What is left

- Clamp: ±2.5 kept. With 4.0 København is no. 1, with no clamp København, Frederiksberg, Brøndby are 1 to 3 (top 10 unchanged in every case). Changing it is an owner call, see below.
- Fonts: OFL licence files still missing next to the WOFF2 files. (Done in pass 5, see below.)
- Map chunk 554 KB gzip; Lighthouse and screen-reader passes not done; no full focus trap in dialogs.
- DAGI boundaries, LBF data (needs permission), Eurostat population mask, press kit.
- Fornyelsesradar price (99 kr/år) to re-check right before launch.

### What the owner must approve

1. Brøndby as no. 1 in the default ranking (it is a property of B1, see METHOD.md), or the clamp at 4.0 (København no. 1, Spearman 0.9995 against today), knowing that the second option was found after looking at the anchors.
2. Whether P1 should stay "andel value against local income" (current) or change construct, as the cross-check proposes.
3. Serving Køen at `ventelistevalg.dk/koen` via the `koen-integration` branch in `../andelplan` (rewrite plus CSP rule, off unless `KOEN_ORIGIN` is set), or a subdomain (needs a DNS change).
4. Push, merge and deploy of `build/v1`. Second-model review before merge per the merge gate.
5. The Ventelistevalg catalog layer (flag off; Waitly reuse rights not cleared).

## Pass 3: Køtryk v2, Ventelistevalg funnel, first screen (2026-11-26, evening)

Owner decisions were delegated to the builder for this pass. Commits on `build/v1`, nothing pushed.

Inputs: at the time of pass 3, `../orch2/agy-method.md` held one line ("I am starting by inspecting the files...") and no findings. It has content now; see pass 4. `docs/review/*.md` as before.

### 1. Ranking method (details in `docs/METHOD.md`)

- D1 (adults per almen/andel dwelling) pointed the wrong way for "how many people queue". v2 uses **B1 = almen + andel dwellings per 100 adults**, direction up. D1, D3 and S1 stay as lenses without weight.
- New DST inputs, fetched and cached through the pipeline: **BEV107** (immigrants, moves; 2021 to 2025) and **EJDFOE1 type B** (owner-occupied flat values). New indicators D5 (immigrants per 1,000) and P2 (flat value to income). Net inflow was tested and rejected (København no. 87), and gross domestic inflow is size-biased; both reasons are in METHOD.md. DST has no kommune-level sales prices or rents.
- Weights: B1 30, D4 20, D5 10, D2 10, P1 10, P2 10, S2 10 (round, set before validation).
- `pipeline/55_validate.py` (new, runs in `make process`): AUC and Spearman vs three anchors for v1 and v2, leave-one-anchor-out over a fixed family of 8 specs, share of weight draws keeping the anchors in the top 15, and a KK almene count check. `make check` fails if v2 AUC drops below 0.9 or below v1.
- Result: København / Frederiksberg / Aarhus at **2 / 3 / 10** (v1: 19 / 16 / 6). Owner3 AUC 0.877 to 0.968; Ventelistevalg AUC 0.833 to 0.990; Aarhusbolig Spearman 0.50 to 1.00 (n = 3). Leave-one-anchor-out puts the held-out city at rank 2, 2 and 4. "Price only" scores higher on the anchors and was not adopted (METHOD.md says why).
- Brøndby is no. 1. It is first or tied first in five of eight specs (corrected from six in pass 4), so it is a property of the data, not a weight artefact, and it was not tuned away. The method panel says that the most almen suburbs rank high.
- `pipeline/common.py` imports `requests` lazily, so offline steps run with the system Python.

### 2. Ventelistevalg integration (details in `docs/INTEGRATION.md`)

- Kommune card links to real Ventelistevalg pages only: 8 København bydel pages plus Frederiksberg, `/lister/andels`, `/lister/almene` (Region Hovedstaden), `/fornyelsesradar` and `/vejledning` for all. `utm_source=koen&utm_medium=map&utm_campaign=<view>`, with the campaign rewritten at click time to the current view.
- `/ko-vagt`, `/ventelistetjek` and `/foreningsroentgen` exist in the source but answer 404 live, so they are not linked.
- Fornyelsesradar price checked live and in source: **99 kr/år inkl. moms, 12 months, no automatic renewal**. 99 kr. kept; the copy now also says the calendar file is free.
- Brand: Source Sans 3 and Source Serif 4 from `../andelplan/src/fonts` replace Atkinson and Fraunces; ink, muted, focus and the brick action follow Ventelistevalg tokens; the CTA is the one filled brick button. Map palette and Plex Mono labels unchanged. "Et projekt fra Ventelistevalg" under the tagline.
- `../andelplan` branch `koen-integration`, commit 41db3646 (not pushed): optional `/koen` rewrite plus a `/koen` CSP rule that adds the OpenFreeMap tile origin, both off unless `KOEN_ORIGIN` is set. Its 3 unit tests pass; andelplan's own build and suite were not run (no `node_modules` there).
- Recommendation: serve Køen at `ventelistevalg.dk/koen` through that rewrite first; move the route to the Cloudflare Worker if proxy load shows up. A subdomain needs a DNS change and Dima's yes.

### 3. First screen views

Ten lenses on the first screen, eight behind a native "Flere visninger" disclosure (opens by itself when a hidden lens is active, for example from a permalink). The rail fits at 1440 x 900 with no scroll; `npm run test:smoke` checks this.

| First screen | Why |
| --- | --- |
| Køtryk | The product |
| Rigtige køer | The only measured queues; the honesty layer |
| Usikkerhed | Shows how far to trust the ranking |
| Andelsboliger, Almene boliger | The two stocks people queue for; also the Ventelistevalg catalog topics |
| Boliger med kø (B1) | Biggest weight in v2 (30 %) |
| Værdi mod indkomst (P1) | Price side of the index, people know andel prices |
| Unge voksne (D4) | Second biggest weight, the clearest city signal |
| Vækst (D2) | Demand people recognise |
| Flyttestrømme | The most visual lens (arcs), and context for the suburbs |

Under Flere: Ejerlejlighed mod indkomst (P2) and Indvandring (D5), both new index parts with 10 %; Tomme boliger (S2, 10 %); Nybyggeri, Andelsværdi, Boligstøtte and 2036 (context, not in the index); Voksne pr. bolig (the old D1, kept so v1 can be compared). Explorer defaults to B1 vs P2.

### 4. Checks and screenshots

`npm run build`, `npm test` (9 Python + 4 Vitest), `npm run test:smoke` (now also checks the rail at 1440 x 900, UTM tags, the click-time campaign and that Odense gets no andels links) and `make check` (0 failures) pass at the end of this pass. Root `package.json` got a `test:smoke` script. All shots in `docs/shots/` retaken (01 to 13 plus new 14 Frederiksberg card, 15 Flere open, 16 method validation table).

Note on running: Vite allows one dev server per project, so stop `npm run dev` before `npm run test:smoke`.

## How to run

```sh
make data-offline     # rebuild site/public/data from the local cache (data/raw, git-ignored)
make data             # same, but fetches anything not cached (DST, geoBoundaries, opendata.dk, Nominatim)
make check            # schema, coverage, leave-one-out, size budget, sources, no em/en dashes
cd site && npm install && npm run dev      # http://localhost:5173
cd site && npm run build                   # static output in site/dist
cd site && npm run shots                   # Playwright screenshots into docs/shots (needs npm run dev)
```

`make check` result at the end of this build: 0 failures. `npm run build`: passes (tsc + vite).

## What was built

### Data pipeline (`pipeline/`, Python 3.12 via uv)

| Script | Does |
| --- | --- |
| `00_fetch_dst.py` | 14 StatBank queries over 10 tables (BOL101, FOLK1A, FRKM126, EJDFOE1, INDKP106, BYGV33, BOST63, FLY66, BOL106, BEV107; BEV107 and the second EJDFOE1 query added in pass 3). Periods are resolved from `/tableinfo` at fetch time, never hardcoded. |
| `01_fetch_boundaries.py` | geoBoundaries DNK ADM2 (Public Domain), names mapped to DST kommunekoder (3 name fixes). **Adapter seam**: `BOUNDARY_SOURCE=dagi` calls `fetch_dagi()`, a clear TODO for Datafordeler DAGI with credentials from env vars only. |
| `02_fetch_queues.py` | Aarhusbolig XML (Ventelister, Afdelinger, Selskaber) and the KK almene boliger GeoJSON, both resolved through the CKAN API. 28 postcode centroids from OSM Nominatim (one request per postcode, cached, 1.2 s apart). |
| `10_clean.py` | Tidy per-kommune series. DST `..` becomes null, nothing is zero-filled. |
| `20_indicators.py` | The 7 index indicators from PLAN.md 2.3 plus 11 lens indicators, with labels (DA/EN), units, formula text, tables and periods. |
| `30_index.py` | Robust z (median/MAD, clamp ±2.5), weighted mean, percentile rank, 200-draw Dirichlet uncertainty band (seeded), leave-one-out Spearman check (fails the build below 0.8). |
| `40_hexes.py` | H3 res 7 (10,523 cells, desktop) and res 6 (1,503 cells, mobile), cell centre in polygon, every kommune guaranteed at least one cell. Binary `hex7.bin` / `hex6.bin`. Simplified kommune outlines. |
| `50_measured.py` | Aarhusbolig aggregates per postnummer and per afdeling (nothing person-level), KK afdeling polygons. |
| `60_export.py` | `kommuner.json`, `indicators.json`, `history.json` (sparklines, lazy), `flows.json` (top 10 in and out partners per kommune). |
| `90_manifest.py` | `sources.json`: 20 entries with publisher, URL, licence, period, fetch date, sha256, rows, status. |
| `99_check.py` | `make check`. |

Spot values match PLAN.md: BOL101 København EJER 20 occupied 2026 = 61,847; EJER 41 = 94,824; EJDFOE1 andelsbolig 2025 København 1,736,991 kr. and Frederiksberg 2,422,337 kr.

Leave-one-out Spearman (v1, first build): D1 0.93, D2 0.97, D3 0.99, D4 0.93, P1 0.93, S1 0.98, S2 0.98. For v2 see METHOD.md.

Output size: `site/public/data` is 664 KB on disk (kommuner.json 49 KB raw, hex7.bin 92 KB, kk_almene.geojson 205 KB loaded only in the almene lens).

### Site (`site/`, Vite + TypeScript, no framework)

- MapLibre GL basemap on OpenFreeMap tiles with a custom paper and ink style (water with a 1 px hatch at low zoom, a few roads, OSM kommune lines from zoom 9, uppercase place labels).
- deck.gl `H3HexagonLayer` interleaved via `MapboxOverlay`: extruded hex columns with a 7 % gap, north-west light, ramp from PLAN.md section 10, height `køtryk^1.6`, ink contour lines on the ground where the decile changes plus the hex coastline, ink outline on top of the hovered or selected mesa, spot-height labels in Plex Mono with leader lines (screen-space collision), Bornholm in a circular inset (its own small deck canvas).
- Motion: intro rise over about 1.6 s staggered outward from København (or the selected kommune), 450 ms height and colour morph on mode or weight change, `prefers-reduced-motion` gives a flat 2D map with instant changes.
- 15 view modes from PLAN.md section 4, each with a legend that states the kind (Modelleret, Målt, Afledt, Fremskrivning, Usikkerhed), the DST tables with links and the period. Toggles for count vs share (Andelsboliger, Almene boliger) and all vs almene+andels (Nybyggeri).
- **Køtryk** is labelled "Modelleret" in the mode rail, the legend, the card, the table header, the CSV header and the intro, with a method panel one click away.
- **Rigtige køer**: cobalt needles at 28 postnummer centroids, height on its own log scale, labelled "Aarhusbolig · 2017" in the legend, tooltip and card. The card says plainly that sign-ups across lists are not people.
- **Almene boliger** at zoom 10+ around København: hexes for København and Frederiksberg give way to the 507 real KK afdeling polygons (extruded by dwelling count, tooltip with afdeling and selskab).
- **Flyttestrømme**: arcs for the top 8 in and out flows of the selected or hovered kommune.
- **Explorer** (bottom drawer, full screen on mobile): sortable table of all 98 kommuner with add-a-column and population sparklines (keyboard equivalent of the map, skip link targets it), SVG scatter (default D1 vs P1, dot size by population, drag to brush, brushed kommuner rise on the map and the rest fade), "Byg dit eget køtryk" with 7 sliders that re-rank live and a Nulstil button, CSV download with a licence header line, copy-link button.
- **Permalinks**: `#mode=…&k=0101&x=D1&y=P1&w=25,15,10,15,15,10,10&e=scatter&b=…&l=en&t=night&c=lng,lat,zoom,pitch,bearing`.
- **Kommune card**: rank, value, uncertainty band as text and bar, every indicator with z-bar, source table link and period, measured queue block or "no open data" line, migration partners, and the Fornyelsesradar CTA with `utm_source=koen&utm_medium=map&utm_campaign=launch&utm_content=kommune-XXXX`. København and Frederiksberg add links to `/lister/andels` and `/lister/almene` with UTM tags. The Rigtige køer legend and the footer also link to ventelistevalg.dk with UTM tags.
- First-visit explainer "Hvad betyder bjergene?" (remembered in localStorage, not a cookie), method panel (DA/EN), sources panel rendered from `sources.json`, Fortællinger tour with 5 stops templated from the data at runtime, Danish-first copy with an EN toggle (`copy/da.ts`, `copy/en.ts`), Nattekort (dark mode), kommune search.
- Ventelistevalg catalog layer: behind `VITE_FLAG_VENTELISTEVALG=1`, off. With the flag on, the legend only says the layer is on but has no data. The pipeline does not fetch it.
- Fonts self-hosted (Fraunces, Atkinson Hyperlegible Next, IBM Plex Mono; Latin subset WOFF2 in `site/public/fonts`).
- CI: `.github/workflows/ci.yml` runs `make check` on the committed data and `npm run build`. No deploy job.

### Screenshots (`docs/shots/`)

01 country view (Køtryk), 02 Aarhus with Rigtige køer 2017, 03 København almene afdelinger at close zoom, 04 Explorer scatter with brushing, 05 weight sliders, 06 kommune card with CTA (København), 07 mobile country view, 08 mobile kommune card (Aarhus), 09 Usikkerhed, 10 Andelsværdi, 11 Nattekort with Flyttestrømme, 12 first-visit explainer, 13 English table. Rendered headless with SwiftShader, so GPU antialiasing is softer than on a real machine.

## Deviations from PLAN.md, and why

| Plan | Built | Why |
| --- | --- | --- |
| Outputs in `data/build/`, copied to the site | Outputs written straight to `site/public/data/` | Your brief asked for processed outputs under the site's public data dir; one copy avoids drift. |
| polars | Python stdlib `csv` | 98 rows per table; one dependency fewer. shapely, h3 and requests are used as planned. |
| 15 DST tables fetched | 9 tables fetched | Only tables that feed an indicator or a mode are fetched. POSTNR1, BOL201, EJ99, EJ56, EJEN77 and HUS1 have no consumer yet (no postnummer polygons, national or regional only). BOL106 was added as a lens column. |
| `hex.bin` with per-hex Float32 indicator columns and popMask | `hex7.bin`/`hex6.bin` with H3 index + kommune index only | Without the population mask every hex in a kommune has the same value, so per-hex floats would duplicate `kommuner.json`. The client looks values up per kommune (also makes the weight sliders cheap). |
| Kommune outlines as TopoJSON | Simplified GeoJSON (148 KB raw, under the gzip budget) | No TopoJSON tooling needed; within budget. Contours are drawn from hex edges, not from these outlines. |
| Aarhusbolig points | Postnummer centroids from OSM Nominatim | The Aarhusbolig files have no coordinates and DAWA is gone (410). Nominatim is ODbL like the basemap; 28 cached lookups. Afdelinger with only a postnummer and no town name show only the number. |
| MapLibre GL JS (latest) | maplibre-gl 5.24 | deck.gl 9.4's `MapboxOverlay` reads `map.transform`, which MapLibre 6 no longer exposes; with v6 the overlay throws on every frame. |
| deck.gl attribute transitions for the 450 ms morph | Own requestAnimationFrame morph of ranks | deck.gl transitions corrupted the hex buffers when a transition was interrupted (camera ease plus mode change). The custom morph is deterministic and also cross-fades colour along the ramp. |
| Labels for the top 8 kommuner | Top 8 candidates with screen-space collision | In the Copenhagen suburbs many of the top 8 sit within a few pixels, so overlapping labels are dropped. Usually 3 to 6 show at country zoom. |
| Lighthouse targets (mobile performance at least 85) | Not measured | JS bundle is 2.3 MB raw / 641 KB gzip (MapLibre + deck.gl). Needs code splitting or a lighter deck import before launch. |
| Camera in permalink | Added `c=lng,lat,zoom,pitch,bearing` | Needed to reproduce close-zoom views (and for the screenshots). Not in the plan; harmless. |

## Honest notes on the data

- **The default ranking needed a human read.** v1 put Vallensbæk, Brøndby and Høje-Taastrup on top and København at no. 19. Fixed in pass 3 (Køtryk v2, `docs/METHOD.md`).
- Uncertainty bands are wide for many kommuner (København: top 6 % to top 89 %). The UI shows this rather than hiding it.
- EJDFOE1 has no andelsbolig value for one kommune: shown hatched as "Ingen åbne data", never as zero. BOL101 reports 0 andelsboliger for one kommune: that is a real DST zero and is shown as such.
- Aarhusbolig: 1,357 lists, 393 afdelinger, longest single list 22,875 people (Marselisgården I, 2 rum). Some afdelinger are in Favrskov and Skanderborg, so those kommuner also get a measured block.
- geoBoundaries polygons are coarse (from a Wikimedia SVG, year 2018); hexes along coasts sometimes sit in the sea or miss small islands.

## Design pass (2026-11-26)

Full critique: `docs/review/design-critique.md`. The Gemini data review (`docs/review/gemini-data-review.md`) is a short note saying the review was not run (no Gemini auth on the build Mac), so there were no findings from it to apply; the data and licence fixes below come from my own check against `sources.json`.

Applied:

- **Honesty and licences.** New lens kind "Registertal" (neutral badge) for DST counts and rates; blue "Målt" is now only used for real waiting lists. Card headline says "Målt i 2017: ...". Footer credits wrap instead of being cut with an ellipsis. Mobile legend now has a data credit plus Metode and Kilder links (before, mobile showed no attribution and had no way to reach method or sources). Almene boliger legend credits Københavns Kommune via Open Data DK (CC BY 4.0) and says the dataset gives no period. Andelsværdi and Værdi mod indkomst legends say EJDFOE1 is a wealth statistic, not sales prices. Tour stop "Hvor ingen står i kø" renamed "Hvor presset er lavest".
- **CTA.** Disclosure line ("Fornyelsesradar er en betalt tjeneste fra Ventelistevalg, som laver Køen.") and an outline button instead of a solid one.
- **Hierarchy and legends.** Mode rail grouped (Køen, Boliger, Pris og støtte, Befolkning), MODES reordered to match (numbering follows the rail), kind tag on every non-register lens, fade cue at the scroll edge, active lens kept clear of the fade. Height note visible in the legend; Køtryk scale explained as a percentile; needle legend states its log scale; "Ingen åbne data" moved to its own legend line.
- **Terrain.** Full hex coverage below zoom 8 (the 7 % gaps made a dot screen at country zoom). Lowest ramp stop #EEE6D2 to #E7DABB so the lowest kommuner do not vanish into the paper land. Spot-height labels only inside the visible map box (not under the sheet, the card or past the screen edge). Needle labels get greedy collision, longest list first.
- **Mobile.** Selecting a kommune eases it into the top part above the half sheet. Group headers hidden in the chip row. Legend compacted.
- **Desktop card.** Pans only when the kommune would end up under the card or the sheet.
- **Accessibility.** `aria-modal` on the intro and on the method/sources panel; sr-only scale sentence for the legend ramp; small mono text raised to 10 to 11 px.
- **Performance.** Map module loaded with a dynamic `import()` in parallel with the data: app chunk 273 KB / 89 KB gzip, map chunk 2.05 MB / 554 KB gzip. Intro fallback timer tracks the `load` event instead of `map.loaded()`.
- **Screenshots.** `npm run shots` waits for the intro dialog instead of a fixed 9 s. All 13 shots in `docs/shots/` retaken after the fixes.

## Left after the design pass

- Mode rail still scrolls at 1440 x 900 (about 10 of 15 lenses visible). Fixed in pass 3: ten lenses plus Flere visninger.
- Default 3D pitch hides part of the Copenhagen suburbs behind North Zealand (table and 2D view cover it).
- deck.gl TextLayer label backgrounds are slightly narrow for values with a unit word ("2,42 mio.").
- Map chunk is still 554 KB gzip. Next step: replace `H3HexagonLayer` (`@deck.gl/geo-layers`) with a `SolidPolygonLayer` of precomputed hex rings, then measure Lighthouse mobile on real hardware.
- No screen-reader pass with VoiceOver or NVDA yet; dialogs are `aria-modal` but have no full focus trap.
- The self-hosted fonts in `site/public/fonts` (since pass 3: Source Sans 3, Source Serif 4, IBM Plex Mono; SIL Open Font License per their upstream projects, to be confirmed) ship without their licence files. The OFL asks for the licence to travel with the font files, so copy each upstream `OFL.txt` next to the WOFF2 files before launch. Not done here because no local copy of the licence texts was available and I did not want to write them from memory. Done in pass 5: the upstream licence files were fetched with curl and copied unchanged (`site/public/fonts/OFL-*.txt`, sources in `site/public/fonts/README.txt`).
- Fornyelsesradar price re-checked live on 2026-11-26 in pass 3: 99 kr/år inkl. moms. Re-check again before launch.

## What is missing

- **Git commits.** (Resolved: the first build and design pass were committed before pass 3, and pass 3 is committed in small commits.) In the design pass, `git add` and `git commit` were again refused by the tool permission layer ("requires approval"), so nothing from the first build or the design pass is committed. The working tree holds everything. Planned commits, in order:
  1. `pipeline/ Makefile pyproject.toml uv.lock .gitignore`: data pipeline.
  2. `site/public/data/`: processed data outputs.
  3. `site/index.html site/src site/scripts site/public/fonts site/tsconfig.json site/vite.config.ts`: the site, including the design-pass fixes (they cannot be split from the first build because none of it was tracked).
  4. `docs/method.md .github/workflows/ci.yml README.md`: method note, CI, README.
  5. `docs/review/design-critique.md`: design critique.
  6. `docs/shots/ docs/BUILD-NOTES.md`: retaken screenshots and these notes.
- DAGI boundaries (needs a Datafordeler user; seam is ready in `01_fetch_boundaries.py`).
- Ventelistevalg aggregate layer (needs your yes on PLAN.md open question 1; flag exists, no data).
- Eurostat population mask (licence not reviewed; mesas stay flat).
- Postnummer layer, `POSTNR1`, LBF data (needs permission), press kit and trailer (`docs/press/` is empty), share images, Lighthouse and screen-reader passes, a fixtures sample under `data/raw/fixtures/` for CI (CI checks the committed outputs instead).
- `site/package.json` has Playwright as a dev dependency (for `npm run shots`). Installing its Chromium removed older cached Playwright browser builds from `~/Library/Caches/ms-playwright`.
