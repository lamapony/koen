# Lighthouse, 2026-11-26

Lighthouse 13.6.0 on `vite preview` of the production build (`npm run build`), headless Chrome for Testing 159 from Playwright (`CHROME_PATH`), WebGL through SwiftShader (`--use-gl=angle --use-angle=swiftshader`). Desktop uses `--preset=desktop`; mobile uses Lighthouse's default mobile emulation (simulated slow 4G, 4x CPU throttling). The basemap tiles come from OpenFreeMap over the network. Raw JSON is not committed. Rerun with `npm run build && node scripts/lighthouse.mjs <outDir> <label>` in `site/`.

"Before" is the build after the bundle split (commit f010de0), before the fixes below.

| | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Desktop, before | 44 | 98 | 100 | 91 |
| Desktop, after | 42 | **100** | 100 | **100** |
| Mobile, before | 35 | 92 | 100 | 91 |
| Mobile, after | 35 | **100** | 100 | **100** |

Metrics after: desktop FCP 0.2 s, LCP 3.2 s, TBT 6,740 ms, CLS 0.033; mobile FCP 4.6 s, LCP 4.6 s, TBT 14,420 ms, CLS 0.

## Fixed

- **skip-link** (both): the skip link pointed at `#explorer-table`, which does not exist until the Explorer opens. It now points at `#explorer` (always in the DOM); the click handler opens the table and focuses it.
- **label-content-name-mismatch** (both): the language button showed "EN" but was named "Switch to English". The name now starts with the visible text ("EN, Switch to English" / "DA, Skift til dansk").
- **button-name** (mobile): the Explorer button hides its text label on small screens and had no other name. It now has `aria-label`.
- **heading-order** (mobile): the mobile CSS hid the visually hidden h2 of the mode rail, so the legend's h3 followed the h1. The sr-only h2 now stays.
- **robots-txt** (both): there was no `robots.txt`, so the preview server returned `index.html`. Added `site/public/robots.txt` (allow all). No sitemap line, because the production URL is not decided.

Already in place, checked: `lang="da"` on `<html>` (switched with the language), meta description, viewport, the map region's `aria-label`, MapLibre's own canvas label.

## Not fixed, with reason

- **Performance (TBT, LCP).** Almost all main-thread time is script evaluation inside `vendor-maplibre` and `vendor-deck` (mobile: 28.8 s and 22.8 s of 51.5 s; the longest task is 10 s inside MapLibre). That is WebGL work running on SwiftShader, a software GPU, plus 4x CPU throttling on mobile, during the terrain rise animation. On a real GPU these calls are far cheaper, so these numbers mostly measure the test machine. Bringing them down for real would mean rendering fewer hexes or skipping the intro animation, which changes what the site shows; that is the owner's call, not a hardening fix.
- **render-blocking-insight**: the one blocking file is the 7 KB (gzip) app stylesheet, which the first paint needs. Not inlined.
- **unused-javascript**: MapLibre ships as a prebuilt UMD bundle and cannot be tree-shaken (see BUILD-NOTES, bundle).
- **valid-source-maps, llms-txt, ard-schema, bf-cache**: no source maps are shipped on purpose; the last three are not part of the four scored categories here.
