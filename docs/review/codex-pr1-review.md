# Codex review of PR #1, verified

Source: `../orch3/codex-review.md` (Codex, read-only review of `git diff main...HEAD`, 2026-11-26). Every item was checked against the code before it was acted on. Status: fixed, rejected or deferred.

## Must fix

| # | Item | Verified | Status | What was done |
| --- | --- | --- | --- | --- |
| 1 | Leave-one-anchor-out leaks the held-out kommune (it counted as a negative in the training AUC) | Yes, `auc()` used all other codes as negatives | Fixed | `pipeline/55_validate.py` drops the held-out kommune from the training AUC entirely. Rerun: same choice ("kun pris") and same held-out ranks 2 / 2 / 4; train AUC 0.992 / 0.992 / 0.995. METHOD.md says so. |
| 2 | Method panel states "the three cities have the longest queues" as fact | Yes, it is the owner's statement; the Ventelistevalg anchor is catalog coverage | Fixed | Panel (da and en) now attributes the statement to the people behind Ventelistevalg, calls catalog coverage coverage, and says only Aarhusbolig 2017 has measured numbers (sign-ups per list). |
| 3 | `observedAt: 2017-11-21` asserted without evidence | Yes, 2017-11-21 is the CKAN `last_modified` of the files; the publisher gives no observation date | Fixed | Field renamed `fileModifiedAt`, read from the cached CKAN `package.json`; `99_check.py` and the Python test assert no `observedAt`. Not shown in the UI before or after. |
| 4 | Bundled fonts ship without licence notices | Yes | Fixed (step 2, separate commit) | OFL texts fetched from upstream next to the fonts. |
| 5 | Skip link targets a table that does not exist on load and wipes the hash | Yes | Fixed | Click handler opens the Explorer table, focuses it (`tabindex="-1"`), keeps the permalink. Smoke test covers it. |
| 6 | Malformed shared URL (`#mode=bogus`, `x=bogus`) breaks rendering | Yes, `readHash` took any string | Fixed | `initState` gets the known modes, indicators and kommune codes; unknown values fall back to defaults. Smoke test loads a bad URL. |
| 7 | All-zero weights give an arbitrary ranking | Yes, via sliders or `w=0,...` | Fixed | Hash with all zeros (or any weight above the slider max 50) is ignored; the last non-zero slider stops at 1. |
| 8 | CI runs neither the regression suites nor the smoke test | Yes | Fixed, one part deferred | CI now runs Python unit tests, Vitest and the Playwright smoke test (with `playwright install --with-deps chromium`). Deferred: `tests/recompute_validation.py` needs `data/raw` (gitignored, network), so it stays a local check. |

## Should fix

| # | Item | Verified | Status | What was done |
| --- | --- | --- | --- | --- |
| 1 | Modal dialogs do not contain focus | Yes | Fixed | `trapTab` in `ui/util.ts` keeps Tab and Shift+Tab inside the intro and the method/sources panel. Focus return on close already existed for the panel. |
| 2 | Explorer tabs and mode chips lose focus on rebuild; no arrow keys on tabs | Yes | Fixed | Tabs: roving tabindex, Left/Right/Home/End, focus restored after rebuild. Mode chips: focus restored on the chip after the rail is rebuilt. |
| 3 | `make refresh` loses geocoder provenance | Yes, it kept `data/raw/nominatim` but dropped `_fetchlog.json` | Fixed | `refresh` now drops the Nominatim cache too, so it is refetched (paced at 1.2 s per request) and logged. |
| 4 | Licence with `url: null` renders as a link to the current page | Yes (Ventelistevalg entry) | Fixed | Plain text when there is no URL; type allows `null`. |
| 5 | METHOD.md says Køen measures how many people queue | Yes, also in the in-app method panel | Fixed | METHOD.md (Limits, rejected-items note, Dansk kort) and the panel now call it a modelled relative pressure that does not count people. |

## Nits

None listed by Codex.

## Rejected

None. Every item matched the code.
