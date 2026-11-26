# Køen as a funnel for Ventelistevalg

Status: 2026-11-26. Built locally, nothing deployed or pushed. Every Ventelistevalg URL below was checked two ways: it exists in the routes of `../andelplan/src/app` (or `src/lib/public-paths.ts`), and it answered HTTP 200 on https://ventelistevalg.dk on 2026-11-26 (bydel pages and `/lister/*` are also in the live sitemap, 292 URLs).

## What Ventelistevalg offers (from its source and live pages)

| Page | What it is | Price (live, 2026-11-26) |
| --- | --- | --- |
| `/lister/andels` | Catalog of andelsboligforeninger in København and Frederiksberg with dated status and sources | Free |
| `/lister/andels/bydel/<slug>` | The same catalog per bydel: indre-by, noerrebro, oesterbro, vesterbro, amager, valby, vanloese, nordvest (København) and frederiksberg | Free |
| `/lister/almene` | "Almene og ungdomslister": official lists with annual fee and renewal rules (KAB, AAB, VIBO, CIU, 3B, Lejerbo, Domea København, fsb, Bo-Vita, KKIK and others) | Free |
| `/fornyelsesradar` | Remembers the renewal date from a queue letter. Calendar file free; email 14 days before | **99 kr/år inkl. moms**, "99 kr for 12 måneder · fornyes ikke automatisk" |
| `/vejledning` | "Sådan fungerer ventelister", every statement with a source | Free |
| `/datakilder` | Ventelistevalg's own source list | Free |
| `/pricing` | Interest check only ("Vi spørger kun om interesse. Du betaler ikke noget."): personligt forslag 149 kr. én gang, Mine ventelister 69 kr./md., gennemgang af dokumenter 399 kr. anslået | Not sold yet |

**Fornyelsesradar price check.** Live page: "99 kr/år inkl. moms" and "99 kr for 12 måneder · fornyes ikke automatisk". Source: `../andelplan/src/lib/copy/da.ts` lines 2028 to 2030 and `DESIGN.md` say the same. Køen's 99 kr. was right; the card copy now also says the calendar file is free, that the price includes moms and that it does not renew automatically.

**Not linked, on purpose.** `/ko-vagt`, `/ventelistetjek` and `/foreningsroentgen` exist in the source but return 404 live (feature flags, e.g. `readReopenWatchProbeFlag()` in `src/app/ko-vagt/page.tsx`). `/pricing` is an interest check, not a product, so Køen does not send people there.

## Link map

All links: `utm_source=koen`, `utm_medium=map`, `utm_campaign=<view>`, `utm_content=<placement>`. `<view>` is the Køen view id (`koetryk`, `maalt`, `almen`, `unge`, ...) at the moment of the click: links are rendered with the current view, and a capture-phase listener (`installCampaignTracking` in `site/src/funnel/utm.ts`) rewrites `utm_campaign` right before the browser follows the link, so a card opened under one view and clicked under another still reports the right one. Code: `site/src/funnel/utm.ts`, `site/src/ui/card.ts`.

| Where in Køen | Kommuner | Ventelistevalg page | `utm_content` |
| --- | --- | --- | --- |
| Kommune card, bydel chips | København (8), Frederiksberg (1) | `/lister/andels/bydel/<slug>` | `kommune-0101-bydel-noerrebro` etc. |
| Kommune card, "Alle andelsforeninger" | København, Frederiksberg | `/lister/andels` | `kommune-XXXX-andels` |
| Kommune card, almene line | København, Frederiksberg and the rest of Region Hovedstaden | `/lister/almene` | `kommune-XXXX-almene` |
| Kommune card, the one filled button | All 98 | `/fornyelsesradar` | `kommune-XXXX-fornyelsesradar` |
| Kommune card, "Sådan fungerer ventelister" | All 98 | `/vejledning` | `kommune-XXXX-vejledning` |
| Rigtige køer legend | View `maalt` | `/lister/andels` | `legend-rigtige-koeer` |
| Masthead "Et projekt fra Ventelistevalg" | Always | `/` | `masthead` |
| Footer | Always | `/` | `footer` |
| Method panel, "Datakilder" | Always | `/datakilder` | `method-datakilder` |

Map cells (hexes and the KK afdeling polygons) select their kommune, which opens the card with the links above. There is no direct link from a hex: a hover target that navigates away would fight the map.

Why almene only for Region Hovedstaden: the almene desk mostly lists capital-area providers, and Køen should not suggest those lists cover Aalborg or Odense. Outside the catalog, the card says plainly that Ventelistevalg has no lists for the kommune yet and offers Fornyelsesradar, which works for any list because the user types the date from the letter.

## Brand alignment

From `../andelplan/DESIGN.md` and `src/app/globals.css`:

- Type: Source Sans 3 (UI) and Source Serif 4 (display), copied as self-hosted WOFF2 from `../andelplan/src/fonts`. Fraunces and Atkinson Hyperlegible are gone, so Køen no longer ships a second family set. IBM Plex Mono stays for spot heights and numbers, because the mono labels are part of the map's look.
- Colour: text `--blaek #1c1e21`, `--blaek-2 #3e4650`, muted `--graa #5c6570` (Ventelistevalg `--ink`, `--ink-secondary`, `--muted`); focus ring `#1557b0` at 3 px, as in Ventelistevalg; the one filled action is brick `#940024` with a 0.98 press scale and 8 px radius (Ventelistevalg's simplicity contract: one filled brick action). Paper, terrain ramp, water and the blue "Målt" colour are unchanged: that is Køen's map identity.
- Copy: du-form, dated facts, the disclosure line ("Fornyelsesradar er en betalt tjeneste fra Ventelistevalg, som laver Køen.") under the button.

## Hosting options

| | A. Subpath via Next rewrite (`ventelistevalg.dk/koen`) | B. Subpath via the Cloudflare Worker | C. Separate host (`koen.ventelistevalg.dk` or own domain) |
| --- | --- | --- | --- |
| How | Static Køen build on any static host; Next proxies `/koen/*` to it | Worker in front of Railway routes `/koen/*` to a static origin (e.g. Cloudflare Pages) | Static host with its own DNS record |
| SEO | Køen's links and press land on ventelistevalg.dk | Same as A | Authority split across two hosts |
| Cost to Railway | Every map request (2 MB JS, tiles are external) passes through the Next server | None, served at the edge | None |
| Security headers | Site CSP applies; must add the OpenFreeMap tile origin for `/koen` | Køen can send its own headers | Own headers |
| Needs | `KOEN_ORIGIN` env var, branch below | Worker change plus a static deployment | **A DNS change, which needs Dima's yes** |
| Analytics | Same Cloudflare Web Analytics site as Ventelistevalg | Same | Separate site |

**Recommendation: A first, B later if traffic grows.** A is already written (below), off by default, and keeps every Køen visit on ventelistevalg.dk with no DNS change. Køen's build uses `base: "./"` and hash permalinks, so it works under `/koen/` without changes. If the proxy load on Railway shows up in metrics after a press moment, move the same `/koen/*` route into the Cloudflare Worker (B). C only if Køen should stand as its own brand.

### Code in `../andelplan`, branch `koen-integration` (commit 41db3646, not pushed)

- `src/lib/koen-subpath.ts`: `koenRewrites(KOEN_ORIGIN)` returns rewrites `/koen` to `<origin>/koen/` and `/koen/:path*` to `<origin>/koen/:path*`; `koenSecurityHeaders(...)` returns a `/koen/:path*` header rule with the site CSP plus `https://tiles.openfreemap.org` in `img-src` and `connect-src` (Køen's basemap and glyphs). Both return `[]` unless `KOEN_ORIGIN` is an https origin with no path, so production is unchanged until someone sets it.
- `next.config.ts`: spreads both into `rewrites()` and `headers()`; the `/koen` header rule comes after the site rule, so it wins for the same keys.
- `src/lib/koen-subpath.test.ts`: off without a valid origin, rewrite shape, CSP adds only the tile origin and keeps other headers.

Verified: the 3 new tests pass (run with Køen's vitest against copies of the two files, because `../andelplan` has no `node_modules` here). Not verified: `next build`, lint and the full andelplan test suite on that branch.

To switch it on (needs Dima's yes, it changes production): deploy `site/dist` so it is served at `https://<static-host>/koen/`, set `KOEN_ORIGIN=https://<static-host>` on Railway, redeploy, then check `/koen/` loads tiles with no CSP errors in the console. No Ventelistevalg page links to Køen yet; add a link (for example in `/om` or the footer) only after `/koen` is live.

## Analytics plan

Køen itself has no analytics, no cookies and no third-party calls except the basemap. Measurement happens where the value is, on Ventelistevalg:

1. **Arrivals from Køen.** UTM on every outbound link (table above). `utm_campaign` says which view sent the visit, `utm_content` which placement and kommune.
2. **What to check first (not verified here).** Whether Ventelistevalg's analytics keep query strings. Cloudflare Web Analytics is in its CSP; the PostHog events for Fornyelsesradar (`rr_view`, `rr_ics_download`, `rr_pay_click`, ...) are scrubbed to `{product: "ventelistevalg"}` by `scrubRenewRadarCapture`, so UTM values do not reach PostHog through event properties as the code stands. If UTM attribution is wanted in PostHog, add a single allowlisted `utm_campaign` property (values are Køen view ids, no personal data) in `renewRadarEventProperties`. That is a product decision for Ventelistevalg and is not in the branch.
3. **Køen page views.** With option A or B, Køen is a path on ventelistevalg.dk, so the existing Cloudflare Web Analytics site counts `/koen/` page views without adding a script to Køen.
4. **Funnel to watch.** `/koen/` views, then Ventelistevalg landings with `utm_source=koen` by `utm_content` (bydel vs almene vs fornyelsesradar), then `rr_pay_click` on Fornyelsesradar.
5. **No email capture and no tracking inside the map.** Hover, view switching and weight sliders stay unmeasured on purpose.
