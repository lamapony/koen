# Metode / Method: Køtryk v2

Status: version 2, 2026-11-26. Replaces the v1 method note (PLAN.md section 2.3). Numbers below are from `make process` on 2026-11-26 (`data/raw/clean/validation.json`, summary in `site/public/data/indicators.json` under `index.validation`). The in-app method panel shows the same table, read from the data.

## What changed and why

v1 put Vallensbæk, Brøndby and Høje-Taastrup on top and København at no. 19, Frederiksberg at no. 16. The people who run Ventelistevalg see the opposite every day: København, Frederiksberg and Aarhus have the longest queues. Two things in v1 caused it.

1. **D1 pointed the wrong way for this question.** v1 used adults per almen or andel dwelling, so a kommune with many such dwellings (København, Frederiksberg) scored low. That reads the index as "seekers per vacancy". But Køen is about how many people stand in a queue, and people can only queue where the lists exist. More almen and andel stock per adult means more lists and more people on them. v2 inverts it: **B1 = almen + andel dwellings per 100 adults**, direction up. D1 stays as a lens ("Voksne pr. bolig", under Flere visninger).
2. **v1 had little demand and price signal and two supply terms that worked against the cities.** S1 (new building) follows demand, so in a cross-section of kommuner it partly cancels the demand signal instead of measuring slack. D3 (projection) repeats D2. v2 drops S1 and D3 from the index (both stay as lenses) and adds demand and price terms from DST.

| Id | Indikator | Kilde | Vægt v1 | Vægt v2 | Retning |
| --- | --- | --- | --- | --- | --- |
| B1 | Almen- og andelsboliger pr. 100 voksne (18+) | BOL101, FOLK1A | (D1 vendt: 25 %) | 30 % | mere = højere |
| D4 | Andel 20 til 34 år | FOLK1A | 15 % | 20 % | mere = højere |
| D5 | Indvandrede pr. 1.000 indbyggere, gennemsnit 2021 til 2025 | BEV107, FOLK1A | ny | 10 % | mere = højere |
| D2 | Befolkningsvækst over 5 år | FOLK1A | 15 % | 10 % | mere = højere |
| P1 | Markedsværdi af andelsboliger mod disponibel indkomst (mindst 50 andelsboliger i opgørelsen) | EJDFOE1, INDKP106 | 15 % | 10 % | mere = højere |
| P2 | Markedsværdi af ejerlejligheder mod disponibel indkomst (mindst 50 ejerlejligheder i opgørelsen) | EJDFOE1 (type B), INDKP106 | ny | 10 % | mere = højere |
| S2 | Boliger uden tilmeldte beboere (ubeboede fritidshuse er en egen gruppe og tæller ikke med; beboede fritidshuse er i nævneren) | BOL101 | 10 % | 10 % | mere = lavere |
| D1, D3, S1 | Voksne pr. bolig, fremskrivning 2036, nybyggeri | | 25 / 10 / 10 % | linse, ingen vægt | |

Three groups, round weights: stock 30 %, demand 40 % (D4 20, D5 10, D2 10), price 20 % (P1 10, P2 10), slack 10 % (S2). The weights were set from what creates queues, not searched for. The validation below was run afterwards and is reported as is.

**Demand terms tried and not used.** Net inflow (BEV107 B07 + B10, domestic plus international) puts København at no. 87 and Frederiksberg at no. 93, because families move from the cities to the suburbs. That outflow is a symptom of pressure, not a lack of it, so net inflow measures the wrong thing here. Gross moves in from other kommuner (B05) is biased against big kommuner (moves inside København do not count), so Aarhus lands at no. 27. Immigration (B08AA) has neither problem and is the one inflow term kept (D5).

**Prices and rents.** DST publishes realised sales prices (EJ56, EJEN77, EJ131) only by landsdel or region, not by kommune. The kommune-level price signal is EJDFOE1: the average market value of andelsboliger (P1) and ejerlejligheder (P2) held by residents of the kommune, divided by income. It is a wealth statistic, not a sales price. Andel values are also capped by the valuation rules, which is why P2 is added next to P1. Køen has no open rent source per kommune, so rents are not in the index.

## Formula

```
z_i     = clamp((x_i - median_i) / (1.4826 * MAD_i), -2.5, 2.5) * dir_i      (dir = -1 for S2)
raw     = sum(w_i * z_i) / sum(w_i)      over indicators that are not missing
køtryk  = percentile rank of raw among the 98 kommuner, 0 to 1 (ties averaged)
height  = køtryk ^ 1.6
```

Uncertainty: 200 Dirichlet weight draws around the defaults (concentration 20, seed 20261126), min to max percentile per kommune. Leave-one-indicator-out Spearman must stay at or above 0.85 (`make check`, raised from 0.8); v2 values: B1 0.96, D4 0.98, D5 0.99, D2 0.99, P1 0.99, P2 0.99, S2 0.99. Because a full-98 Spearman can hide changes at the top, `make check` also requires that at least 7 of the top 10 survive when any one indicator is dropped; v2 keeps 9 or 10 (B1 9, D4 9, D2 9, the rest 10).

P1 and P2 are left out (and their weight renormalised) where EJDFOE1 counts fewer than 50 holdings, because an average over a handful of dwellings is noise: P1 drops Læsø (0), Ærø (8) and Samsø (24); P2 drops Læsø (18), Morsø (38) and Ærø (44). The value lenses (Andelsværdi, Ejerlejlighedsværdi) still show the raw average. No top-15 rank changed.

Code: `pipeline/20_indicators.py` (indicators and weights), `pipeline/30_index.py` (index), `pipeline/55_validate.py` (validation), `site/src/model.ts` (same index in the browser for the weight sliders).

## Validation

There is no national register of waiting lists, so every anchor is small. All of them are reported.

| Anchor | What it is | n |
| --- | --- | --- |
| Owner3 | København, Frederiksberg and Aarhus have the longest queues (the owner's statement, 2026-11-26) | 3 of 98 |
| Ventelistevalg | Ventelistevalg's andels catalog with public queue data covers only København and Frederiksberg (`../andelplan/src/lib/district-slug.ts`, 9 bydele) | 2 of 98 |
| Aarhusbolig 2017 | Mean sign-ups per waiting list per kommune, from the Aarhusbolig open data (CC BY 4.0): Aarhus 2,466.5, Skanderborg 456.1, Favrskov 318.6 | 3 |
| KK almene | Københavns Kommune almene afdelinger: dwelling counts only, no queue numbers. Used as a data check, not as a ranking anchor | 1 |

AUC = probability that an anchor kommune ranks above a random other kommune (1 is perfect, 0.5 is chance). Spearman vs membership = rank correlation between the index and a 0/1 anchor flag; with 3 of 98 positives the best possible value is 0.298, so read it against that ceiling. Ranks are 1 = highest, ties share their mean rank.

| | v1 | v2 |
| --- | --- | --- |
| Rank København / Frederiksberg / Aarhus | 19 / 16 / 6 | **2 / 3 / 10** |
| Owner3 AUC | 0.877 | **0.968** |
| Owner3 Spearman vs membership (max 0.298) | 0.225 | **0.280** |
| Ventelistevalg AUC | 0.833 | **0.990** |
| Ventelistevalg Spearman vs membership | 0.163 | **0.240** |
| Aarhusbolig Spearman (n = 3) | 0.50 | **1.00** |
| Rank Aarhus / Skanderborg / Favrskov | 6 / 32 / 25 | 10 / 63 / 69 |
| All three owner3 kommuner in the top 15 | no | yes |

**Held-out checks.**

- *Aarhusbolig is never used to set weights.* v2 orders the three Aarhusbolig kommuner the same way as the measured queues (Spearman 1.00 against 0.50 for v1). With n = 3 only the values 1, 0.5, -0.5 and -1 are possible, so this is weak evidence.
- *Leave one anchor out.* From a fixed family of eight simple specs (v1, v1 with D1 inverted, stock only, demand only, price only, equal weights, three equal pillars, v2) the check picks the spec with the best AUC on two of the three owner3 kommuner and reports where the third lands. Held out København: rank 2. Held out Frederiksberg: rank 2. Held out Aarhus: rank 4. In all three folds the chosen spec is "price only" (P1 + P2). So the anchor signal does not hang on one kommune, and the price terms carry most of it.
- *Weight draws.* In all 200 weight draws København, Frederiksberg and Aarhus stay in the top 15.
- *KK almene data check.* The KK dataset has 65,997 almene dwellings in København; BOL101 2026 has 65,553 (occupied plus empty, owner 20). Ratio 1.007, so B1's almen count agrees with an independent source.

**Why v2 and not "price only".** Price only scores higher on these anchors (owner3 AUC 0.993, ranks 2 / 2 / 4). It was not chosen because three anchors are too few to justify dropping stock and demand, which are what the owner and the domain say drive queues, and because a price-only index would not be a queue index at all. v2 keeps price at 20 % and the anchors still land at 2, 3 and 10. Moving more weight to price because it fits three points better is exactly the overfitting we want to avoid.

## Top 15 (default weights)

| # | Kommune | Køtryk | Band (200 draws) |
| --- | --- | --- | --- |
| 1 | Brøndby | 1.00 | 0.99 to 1.00 |
| 2 | København | 0.99 | 0.93 to 0.99 |
| 3 | Frederiksberg | 0.98 | 0.90 to 0.99 |
| 4 | Ishøj | 0.97 | 0.91 to 1.00 |
| 5 | Glostrup | 0.96 | 0.91 to 0.99 |
| 6 | Albertslund | 0.95 | 0.91 to 0.99 |
| 7 | Herlev | 0.94 | 0.90 to 0.99 |
| 8 | Rødovre | 0.93 | 0.91 to 0.99 |
| 9 | Ballerup | 0.92 | 0.87 to 0.96 |
| 10 | Aarhus | 0.91 | 0.88 to 0.96 |
| 11 | Gladsaxe | 0.90 | 0.86 to 0.92 |
| 12 | Hvidovre | 0.89 | 0.84 to 0.92 |
| 13 | Lyngby-Taarbæk | 0.88 | 0.81 to 0.92 |
| 14 | Høje-Taastrup | 0.87 | 0.77 to 0.95 |
| 15 | Tårnby | 0.86 | 0.72 to 0.90 |

Brøndby is first or tied first in five of the eight specs in the family, and second in v1. It has 30.7 almen and andel dwellings per 100 adults, 15 % population growth over five years, and andel and flat values that are high against local incomes. That is a real pattern in the data, not a bug, and it was not tuned away.

## Independent cross-check (Antigravity/Gemini, 2026-11-26)

`../orch2/agy-method.md` is an independent read-only review of the method. Every claim below was re-run on `data/raw/clean/dst.json` before it was adopted or rejected. Its section 2.1 describes v1 (D1 at weight 25 %), so points that v2 already handles are marked as such.

**Adopted (verified)**

- *Small-n EJDFOE1 averages.* Verified: andel n is 0 / 8 / 24 on Læsø / Ærø / Samsø, flat n is 18 / 38 / 44 on Læsø / Morsø / Ærø. P1 and P2 now need at least 50 holdings. The proposed empirical-Bayes shrinkage was not adopted: it adds a tuning constant (k = 300) for little gain once the n filter is in.
- *Top-10 gate and a higher LOO floor.* Verified that full-98 Spearman is insensitive to the top tail (v1 passed with København at no. 19). Added the top-10 overlap check (at least 7 of 10) and raised the floor to 0.85. v2 passes both (min 0.96, overlap at least 9).
- *Clamp sensitivity, as a report.* Verified: with the ±2.5 clamp, D4 (20 to 34 year olds) ties København (34.7 %, unclamped z 7.1) with Brøndby (22.2 %, z 2.7). `55_validate.py` now reports the index with the clamp at 3.5, 4.0 and none: Spearman against the default 0.9996, 0.9995 and 0.9993, and the same top 10 in all three. What changes is the very top: at 4.0 København is no. 1 and Brøndby no. 2; with no clamp København, Frederiksberg, Brøndby are 1 to 3 and Aarhus moves from 10 to 6. The default stays at 2.5. Widening it now, after seeing that it lifts the owner's three cities, would be choosing a parameter by the anchors, which is what this note says we do not do. It is listed for the owner to decide (BUILD-NOTES).
- *Wording.* S2 said "ekskl. fritidshuse"; BOL101 only puts unoccupied holiday homes in their own group (BEBO 5000), occupied ones stay in. Label fixed. Intro copy now names the v2 parts (immigrants, growth, andel and flat value against income) instead of "nye tilflyttere" and "købe sig ud af køen". The export field `peopleOnLists` (it holds sign-ups, not people) is renamed `signups`. The two EJDFOE1 entries in `sources.json` now have their own titles. Aarhusbolig 8520 and 8680 lost their town name because a row with only the postnummer overwrote it; fixed (Lystrup, Ry). The KK almene entry in `sources.json` now gives the Open Data DK resource date (2015-12-08).

**Rejected, with reason**

- *Net migration (BEV107 B07 + B10) as the demand term.* The review says København has +9.9 per 1,000. That is B10 (net immigration) alone. B07 (net domestic moves) is negative for København every year 2021 to 2025 (-3,839 to -6,868), and B07 + B10 averages +1.2 per 1,000, rank 87 of 98 (Frederiksberg -0.4, rank 93). This confirms the reason it was not used above.
- *Remove B1 (almen + andel stock).* The review shows correctly that inverting D1 puts Brøndby first (this note says the same: Brøndby is first or tied first in five of eight specs). The disagreement is about the question, not the data: Køen measures how many people queue, and people can only queue where the lists are. B1 stays; the limit is stated below.
- *P1 over national instead of local income, and P1 switched to flats.* Dividing by one national number makes P1 the plain average value; that is a different construct (wealth level, not affordability), and P2 already carries the flat price. Not changed without the owner.
- *Log transform of S2, floor area per person (BOL106) as S1, 20-quarter completions.* Each is defensible, none fixes a verified error, and together they would make v2 a different index on the day it was set. Kept as candidates.
- *The review's own top 15 and LOO values* were computed for its proposed index, not for v2, so they are not comparable with the numbers here.

## Limits

- The index measures how many people queue relative to the size of the kommune. It does not say how long one list is or how long the wait is. The most almen suburbs (Brøndby, Ishøj, Albertslund, Herlev, Ballerup) rank high because they have many dwellings with a list, even if a single list there may move faster than in København.
- The anchors are three kommuner, two kommuner and three kommuner. They can catch a wrong direction (as with v1's D1); they cannot calibrate weights.
- EJDFOE1 is a wealth statistic (valued market value of property held by residents), not sales prices. Rents are not included.
- D5 uses immigration only; domestic gross inflow is biased by kommune size and net inflow measures the wrong thing (see above).
- Coarse boundaries (geoBoundaries, Public Domain) until DAGI is wired in. One person can be on many lists, so sign-ups are not people.

## Dansk kort

Køtryk v2 måler, hvor mange der står i kø i forhold til kommunens størrelse. Det stiger med boligbestanden med venteliste (almen- og andelsboliger pr. 100 voksne, 30 %), efterspørgslen (unge voksne 20 %, indvandrede 10 %, vækst 10 %) og prisen på at købe sig ud af køen (andels- og ejerlejlighedsværdi mod indkomst, 10 % hver). Tomme boliger trækker ned (10 %). Mod de få rigtige kø-data der findes, rammer v2 bedre end v1: København, Frederiksberg og Aarhus ligger nr. 2, 3 og 10 (før 19, 16 og 6), og rækkefølgen i Aarhusbolig 2017 passer. Tre ankre er for lidt til at tilpasse vægte, så vægtene er runde tal, og alle tal står ovenfor.
