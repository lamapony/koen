# Design critique: Køen v1 (2026-11-26)

Reviewer stance: a data-visualisation editor at a Danish newsroom, holding the work to the bar of The Pudding and of single-purpose explainers that make one idea land in five seconds. Based on fresh headless screenshots of the local build (1440 x 900 desktop, 390 x 844 mobile at 2x) and on a read of `site/src`.

## 0. The Gemini data review

`docs/review/gemini-data-review.md` is an empty file (0 bytes; committed empty in 73ca64d). It contains no findings, so there was nothing from it to verify or fix. I did my own pass on data labels and licences against `site/public/data/sources.json`; those findings are in section 6 and 7 below and are marked **[data]**.

## 1. Verdict

The concept is strong and the craft is above average: a paper survey sheet, one ramp, an honest modelled layer next to a sparse measured layer, a method panel one click away. The first screen already says "modelled" four times. What holds it back from the top bar is not the idea but a set of mid-level choices that blur the one distinction the whole product depends on (modelled vs measured), plus licence credits that are cut off or missing on mobile, plus terrain noise at country zoom.

Score before fixes: 7/10. The fixes below are applied in the same commit series. My read after the fixes: 8/10. What still keeps it from 9 is in section 12.

## 2. Hierarchy

- **15 lenses at equal weight.** The rail lists 15 modes with the same type size, numbering and spacing. The lead story (Køtryk vs Rigtige køer) competes visually with Boligstøtte and Unge voksne. At 900 px height the rail scrolls and cuts "13 Flyttestrømme" in half with no sign that more is below. **Fix:** group the rail (Køen / Boliger / Pris og støtte / Befolkning), tighten rows, and add a fade at the scroll edge so overflow is visible.
- **Kind tags are inconsistent.** Chips show "Modelleret", "Målt" (only on Rigtige køer), "Fremskrivning" and "Usikkerhed", but nothing on the "Afledt" lenses (Voksne pr. bolig, Værdi mod indkomst). A reader cannot tell a ratio we computed from a count DST published. **Fix:** every lens that is not a plain DST register count carries its kind tag.
- **The CTA is the heaviest object in the card.** A solid ink pill button outweighs the score, the uncertainty band and the measured block. On a page whose credibility rests on restraint this reads as the point of the page. **Fix:** outline button, same size, below a disclosure line (section 8).
- **Card head.** "Nr. 19 af 98" next to "top 19 %" for København is a coincidence that looks like a typo. Left as is: both numbers are correct, and the band line right below explains the spread.

## 3. Typography

- Fraunces display + Atkinson Hyperlegible + Plex Mono is a good, legible trio; the italic tagline is a nice editorial touch.
- Mono caps at 9.5 to 10.5 px with 0.1em tracking (chip kind tags, ramp labels, inset label) are below comfortable reading size, and in grey. **Fix:** 10.5 px minimum for kind tags and ramp labels, and a darker grey for the kind tags.
- Footer text at 11.5 px is truncated with an ellipsis (section 7). Fixed by wrapping, not by shrinking.

## 4. Palette

- Sand to oxblood is a calm, print-like sequential ramp and reads in both themes. Blue is reserved for measured queues, which is exactly right.
- **The lowest ramp stop (#EEE6D2) is almost the paper colour (#F2EDE3).** Lolland, Langeland and the lowest Jutland kommuner dissolve into the basemap land at country zoom. **Fix:** lowest stop darkened to #E7DABB so "low" still reads as data, not as background.
- **[data] Blue is leaking.** The legend badge "MÅLT" is drawn in the measured-queue blue for every DST register lens (Almene boliger, Andelsboliger, Vækst, Flyttestrømme...). A reader who learned "blue = real queues" from the subtitle is told that the count of social dwellings is a measured queue. **Fix:** new kind "Registertal" (neutral ink badge) for DST counts and rates; blue "Målt" only for real waiting lists.

## 5. Terrain legibility

- **Stipple moiré at country zoom.** Hexes are drawn with 7 % gaps (`coverage 0.93`). At zoom 6.5 a hex is 3 to 4 px, so the gaps become a dot screen over the whole country (visible in the default view and worst on the low, pale mesas). It reads as texture noise and lowers contrast between deciles. **Fix:** full coverage below zoom 8, gaps only when hexes are large enough to read as cells.
- **Labels under chrome.** Spot-height labels are placed by screen-space collision only against each other, so they can sit under the paper sheet (Flyttestrømme shows "NØ ▲ 21,3" clipped at the sheet edge) or off the right edge on mobile ("VALLENSBÆK ▲ 1,0" clipped). **Fix:** labels are only kept when their anchor is inside the visible map area (sheet, card and margins excluded).
- **Needle labels collide.** In Rigtige køer around Aarhus, eight postnummer labels overlap into an unreadable stack ("8381 ▲ 5.1" under "8200 ▲ 18.285"). **Fix:** the same greedy collision as the spot heights, highest list first.
- Occlusion of the Copenhagen suburbs behind North Zealand at the default pitch is inherent to 3D and acceptable because the table and the 2D reduced-motion view give the same data; not changed.

## 6. Legends

- **Height encoding is only in a tooltip.** "Højde og farve følger rangen blandt de 98 kommuner" sits in a `title` attribute, so nobody sees it. For Køtryk the ramp ends "0,00 / 1,00" with no unit. **Fix:** the height note is visible text; for Køtryk the scale says it is a percentile among 98 kommuner.
- **Needles have no scale statement.** Needle height is on its own log scale, but the legend does not say so. **Fix:** "Højde: logaritmisk skala, uafhængig af bjergene."
- **[data] Almene boliger legend credits only DST.** At zoom 10+ the lens shows 507 Københavns Kommune afdeling polygons, but the legend source line says only "Danmarks Statistik, BOL101". The KK data is CC BY 4.0, which requires attribution where it is shown. **Fix:** legend names Københavns Kommune via Open Data DK, CC BY 4.0, and says the dataset gives no period (as `sources.json` records: "ikke angivet i datasættet").
- **[data] Andelsværdi is a wealth statistic.** The method panel says EJDFOE1 is "en formuestatistik, ikke salgspriser", but the Andelsværdi and Værdi mod indkomst legends present it as "markedsværdi" without the caveat. **Fix:** caveat note in those two legends.

## 7. Honesty of modelled vs measured, and licences

- The modelled label discipline is good: legend badge, card score subtitle, table header, CSV header and intro all say "Modelleret".
- **[data] The measured number in the card drops its year.** The headline reads "Målt: 22.875 personer på den længste venteliste" in big blue; the year 2017 is in a smaller line below. A nine year old snapshot must carry its date in the same sentence. **Fix:** "Målt i 2017: ..." in DA and EN, also in the needle tooltip.
- **[data] Footer attribution is truncated.** Both footer spans use `white-space: nowrap; text-overflow: ellipsis`, so the DST / Aarhusbolig / KK / geoBoundaries / OSM credit is cut at "Open Data D...". CC BY 4.0 and ODbL require the attribution to be legible. **Fix:** the credit wraps onto two lines; nothing is cut.
- **[data] Mobile shows no attribution and no way to the method or sources.** `.foot` is `display: none` on mobile and the Metode, Kilder and Fortællinger buttons are hidden (`.tools .wide`). The only route is the "Sådan er det beregnet" link, and only in two modes. **Fix:** the mobile legend carries a short data credit plus Metode and Kilder links.
- **[data] A tour stop overclaims.** "Hvor ingen står i kø" (Where nobody queues) states a fact about queues that the data cannot support: low modelled pressure is not an empty queue. **Fix:** "Hvor presset er lavest" / "Where pressure is lowest".
- Licence strings checked against `sources.json`: DST "CC 4.0 BY", Aarhusbolig and KK "CC BY 4.0", geoBoundaries "Public Domain", Nominatim "ODbL 1.0", OpenFreeMap tiles "ODbL (OSM data), MIT". The footer and the CSV header match. No licence string was wrong; the problems were visibility.

## 8. CTA tone

- The copy itself is good: du-form, factual, a real price, no urgency.
- Missing: a disclosure that Fornyelsesradar is a paid product from the same people who make the map. Readers trust a commercial link more when it says what it is. **Fix:** one short line, "Fornyelsesradar er en betalt tjeneste fra Ventelistevalg, som laver Køen.", and the button becomes an outline button. Still exactly one CTA per card, still at the bottom.

## 9. Mobile

- **The selected kommune is hidden behind the half sheet.** Opening Aarhus puts the card over the map and Aarhus stays underneath. **Fix:** on mobile the map eases the selected kommune into the visible top area (bottom padding = sheet height); on desktop it pans only when the kommune would be hidden behind the card or sheet.
- Labels clipped at the screen edge: fixed by the visible-area rule in section 5.
- Method, sources and attribution unreachable: fixed in section 7.
- The legend card covers a fifth of the map; acceptable at this size, slightly compacted.

## 10. Accessibility

- Good: skip link to the table, table as the keyboard equivalent of the map, `aria-pressed` on modes, live region announcements, reduced-motion 2D map, AA grey.
- **Dialogs are not marked modal.** The intro and the method/sources panel have `role="dialog"` but no `aria-modal`, so screen readers can wander behind them. **Fix:** `aria-modal="true"`.
- **The legend ramp is `aria-hidden` with values only in `title`.** **Fix:** an sr-only sentence with the low and high values and the unit.
- Small mono text raised to 10.5 px (section 3).

## 11. Performance

- One 2.32 MB JS chunk (641 KB gzip): MapLibre + deck.gl + app. Data fetching only starts after that whole chunk has downloaded and parsed.
- **Fix applied:** the map module (MapLibre, deck.gl) is loaded with a dynamic `import()` that starts in parallel with the data fetch. Build result: app chunk 273 KB raw / 89 KB gzip, map chunk 2.05 MB raw / 554 KB gzip, fetched in parallel with the data instead of before it. Total bytes are about the same; the critical path is shorter.
- **Fix applied:** the intro fallback timer used `map.loaded()`, which is false whenever tiles are still streaming, so the terrain could start rising behind the open intro dialog. Now it tracks the `load` event.
- Not done (left in BUILD-NOTES): dropping `@deck.gl/geo-layers` for a plain `SolidPolygonLayer` of precomputed hex rings, and a Lighthouse run on real hardware.

## 12. What is left after this pass

- The rail still scrolls at 1440 x 900 (about 10 of 15 lenses visible). It now has groups and a fade cue, and the active lens is scrolled clear of the fade, but a true fix means fewer lenses on the first screen (for example, folding Befolkning into a "Flere lag" disclosure). That is an editorial call, not mine.
- Default 3D pitch still hides parts of the Copenhagen suburbs behind North Zealand. The table and the 2D view cover it.
- Spot-height label boxes for values with a unit word ("2,42 mio.") are a little too narrow in deck.gl's TextLayer background; cosmetic.
- No Lighthouse or screen-reader pass on real hardware yet.

Details and the full open list are in `docs/BUILD-NOTES.md`, section "Left after the design pass".
