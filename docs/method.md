# Metode / Method

Kort version af metodenoten, som også står i appen under "Metode". Tal og perioder kommer fra `site/public/data/indicators.json` og `sources.json`.

## Dansk

**To lag, holdt adskilt.** Bjergene er et *modelleret køtryk* for alle 98 kommuner, bygget kun af åbne tal fra Danmarks Statistik (CC 4.0 BY). De blå nåle er *målte* ventelister, og de findes kun, hvor nogen har offentliggjort dem: i dag Aarhusbolig, et øjebliksbillede fra 2017 (Open Data DK, CC BY 4.0).

**Hvorfor modelleret?** Ventelister til andelsboliger og de fleste almene lister er ikke offentlige. Der findes intet nationalt register. Køen opfinder ingen kølængder.

**Indikatorer og standardvægte**

| Id | Indikator | Kilde | Vægt | Retning |
| --- | --- | --- | --- | --- |
| D1 | Voksne (18+) pr. beboet almen- eller andelsbolig | FOLK1A, BOL101 | 25 % | mere = højere |
| D2 | Befolkningsvækst over 5 år | FOLK1A | 15 % | mere = højere |
| D3 | Forventet vækst 2026 til 2036 | FRKM126 | 10 % | mere = højere |
| D4 | Andel 20 til 34 år | FOLK1A | 15 % | mere = højere |
| P1 | Gennemsnitlig markedsværdi af andelsboliger mod disponibel indkomst | EJDFOE1, INDKP106 | 15 % | mere = højere |
| S1 | Fuldførte boliger seneste 4 kvartaler pr. 1.000 indbyggere | BYGV33 | 10 % | mere = lavere |
| S2 | Boliger uden tilmeldte beboere (ekskl. fritidshuse) | BOL101 | 10 % | mere = lavere |

**Beregning.** For hver indikator: robust z-værdi `z = (x - median) / (1,4826 × MAD)`, begrænset til ±2,5 og vendt for S1 og S2. Råt indeks = vægtet gennemsnit af z (manglende tal udelades, vægtene normaliseres). Køtryk = percentilrang blandt de 98 kommuner (0 til 1). Højden på kortet er `køtryk^1,6`.

**Usikkerhed.** Indekset regnes om med 200 tilfældige vægtsæt (Dirichlet omkring standardvægtene, fast seed). Spændet fra laveste til højeste percentil vises på kommunekortet og i visningen Usikkerhed. Leave-one-out: Spearman-korrelationen mellem det fulde indeks og indekset uden hver enkelt indikator skal være mindst 0,8; ellers fejler `make check`.

**Begrænsninger.** Kommunegrænserne er grove (geoBoundaries, Public Domain) og skal erstattes af DAGI. EJDFOE1 er en formuestatistik, ikke salgspriser. Aarhusbolig dækker én kommune og kan ikke validere en national rangering. Én person kan stå på flere lister, så summen af tilmeldinger er ikke antal personer. Et højt køtryk betyder ikke, at der står flest personer i kø.

## English

**Two layers, kept apart.** The mountains are a *modelled queue pressure* for all 98 kommuner, built only from open Statistics Denmark data (CC 4.0 BY). The blue needles are *measured* waiting lists and exist only where someone published them: today Aarhusbolig, a 2017 snapshot (Open Data DK, CC BY 4.0).

**Why modelled?** Co-op waiting lists and most social housing lists are not public, and there is no national register. Køen invents no queue lengths.

**Calculation.** Robust z-scores per indicator (median and MAD, clamped to ±2.5, sign flipped for S1 and S2), a weighted mean with the default weights above, then the percentile rank among the 98 kommuner. Map height is `pressure^1.6`.

**Uncertainty.** 200 random weight sets around the defaults give a min to max percentile band per kommune. A leave-one-out check (Spearman at least 0.8 for every indicator) runs in `make check`.

**Limits.** Coarse boundaries (to be replaced by DAGI), EJDFOE1 is a wealth statistic and not a sales price, Aarhusbolig covers one kommune and cannot validate a national ranking, and sign-ups across lists are not people. A high modelled pressure does not mean the longest queue.
