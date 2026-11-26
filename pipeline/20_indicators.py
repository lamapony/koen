"""Compute per-kommune indicators (PLAN.md section 2.3 plus the extra view-mode indicators).

Input: data/raw/clean/dst.json
Output: data/raw/clean/indicators.json  {meta: [...], values: {kode: {id: value|None}}, history: {...}, flows: ...}
Rule: None means unknown. Never zero-filled.
"""

from __future__ import annotations

import json
import sys

from common import RAW

DST_TABLE_URL = "https://www.statistikbanken.dk/"


def latest(d: dict) -> str:
    return sorted(d)[-1]


def main() -> int:
    c = json.loads((RAW / "clean" / "dst.json").read_text("utf-8"))
    T = c["tables"]
    kommuner = c["kommuner"]

    def series(name):
        return T[name]

    def any_period(name):
        return latest(next(iter(T[name].values())))

    bol_per = any_period("bol101_bebo1000_total")
    folk_per = any_period("folk1a_pop")
    folk_back = sorted(next(iter(T["folk1a_pop"].values())))[0]
    ejd_per = any_period("ejdfoe1_andel_gns")
    ind_per = any_period("indkp106_gns")
    bost_per = any_period("bost63_husstande")
    bol106_per = any_period("bol106_gnsap")
    byg_periods = sorted(next(iter(T["bygv33_fuldfoert"].values())))[-4:]
    fly_per = c["flows"]["period"]
    bev_periods = sorted(next(iter(T["bev107_b05"].values())))
    ejl_per = any_period("ejdfoe1_ejerlejl_gns")

    def div(a, b, scale=1.0):
        if a is None or b is None or b == 0:
            return None
        return a / b * scale

    def g(name, k, per):
        return T[name].get(k, {}).get(per)

    values: dict[str, dict] = {}
    netflow: dict[str, float] = {k["kode"]: 0.0 for k in kommuner}
    inflow: dict[str, float] = {k["kode"]: 0.0 for k in kommuner}
    outflow: dict[str, float] = {k["kode"]: 0.0 for k in kommuner}
    for fr, to, v in c["flows"]["rows"]:
        netflow[to] += v
        netflow[fr] -= v
        inflow[to] += v
        outflow[fr] += v

    for km in kommuner:
        k = km["kode"]
        pop = g("folk1a_pop", k, folk_per)
        pop_back = g("folk1a_pop", k, folk_back)
        adults = g("folk1a_adults", k, folk_per)
        young = g("folk1a_young", k, folk_per)
        almen = g("bol101_bebo1000_ejer20", k, bol_per)
        andel = g("bol101_bebo1000_ejer41", k, bol_per)
        occ = g("bol101_bebo1000_total", k, bol_per)
        unocc = g("bol101_bebo2000_total", k, bol_per)
        andel_n_ejd = g("ejdfoe1_andel_antal", k, ejd_per)
        andel_val = g("ejdfoe1_andel_gns", k, ejd_per)
        if not andel_n_ejd or not andel_val:
            andel_val = None
        income = g("indkp106_gns", k, ind_per)
        comp = [g("bygv33_fuldfoert", k, p) for p in byg_periods]
        comp_sum = None if any(x is None for x in comp) else sum(comp)
        comp_aa = [(g("bygv33_fuldfoert_20", k, p), g("bygv33_fuldfoert_41", k, p)) for p in byg_periods]
        comp_aa_sum = None if any(a is None or b is None for a, b in comp_aa) else sum(a + b for a, b in comp_aa)
        p26, p36 = g("frkm126_pop", k, "2026"), g("frkm126_pop", k, "2036")
        bost = g("bost63_husstande", k, bost_per)
        aa = None if almen is None or andel is None else almen + andel
        imm = [g("bev107_b08aa", k, p) for p in bev_periods]
        imm_avg = None if any(x is None for x in imm) else sum(imm) / len(imm)
        ejl_n = g("ejdfoe1_ejerlejl_antal", k, ejl_per)
        ejl_val = g("ejdfoe1_ejerlejl_gns", k, ejl_per)
        if not ejl_n or not ejl_val:
            ejl_val = None
        values[k] = {
            "B1": div(aa, adults, 100),
            "D1": div(adults, aa),
            "D2": None if pop is None or not pop_back else (pop / pop_back - 1) * 100,
            "D3": None if p26 is None or not p36 else (p36 / p26 - 1) * 100,
            "D4": div(young, pop, 100),
            "D5": div(imm_avg, pop, 1000),
            "P1": div(andel_val, income),
            "P2": div(ejl_val, income),
            "S1": div(comp_sum, pop, 1000),
            "S2": None if occ is None or unocc is None else unocc / (occ + unocc) * 100,
            # Extra lenses (not in the index)
            "POP": pop,
            "ANDEL_N": andel,
            "ANDEL_PCT": div(andel, occ, 100),
            "ALMEN_N": almen,
            "ALMEN_PCT": div(almen, occ, 100),
            "ANDELSVAERDI": andel_val,
            "EJERLEJL_VAERDI": ejl_val,
            "INDKOMST": income,
            "NYBYG_AA": div(comp_aa_sum, pop, 1000),
            "NETFLYT": div(netflow[k], pop, 1000),
            "BOLIGSTOETTE": div(bost, pop, 1000),
            "M2_PERSON": g("bol106_gnsap", k, bol106_per),
        }

    def src(table):
        return {"table": table, "url": f"https://www.statistikbanken.dk/{table}", "updated": c["updated"].get(table)}

    meta = [
        # Køtryk v2 (docs/METHOD.md). Index members carry "dir" and "w"; the rest are lenses.
        {"id": "B1", "da": "Almen- og andelsboliger pr. 100 voksne", "en": "Social and co-op dwellings per 100 adults", "unit": "pr. 100", "dec": 1,
         "dir": 1, "w": 0.30, "kind": "derived", "tables": ["BOL101", "FOLK1A"], "period": f"{bol_per} / {folk_per}",
         "formula_da": "Beboede boliger ejet af almene boligselskaber og andelsboligforeninger (BOL101, ejerforhold 20 og 41) pr. 100 personer på 18 år og derover (FOLK1A). Flere boliger med venteliste betyder flere, der står i kø.",
         "formula_en": "Occupied dwellings owned by social housing companies and housing co-ops (BOL101, owner 20 and 41) per 100 residents aged 18+ (FOLK1A). More dwellings with a waiting list means more people in a queue."},
        {"id": "D4", "da": "Unge voksne (20 til 34 år)", "en": "Young adults (20 to 34)", "unit": "%", "dec": 1,
         "dir": 1, "w": 0.20, "kind": "measured", "tables": ["FOLK1A"], "period": folk_per,
         "formula_da": "Andel af befolkningen i alderen 20 til 34 år (FOLK1A). Den aldersgruppe, der oftest søger bolig.",
         "formula_en": "Share of residents aged 20 to 34 (FOLK1A). The age group that most often looks for a home."},
        {"id": "D5", "da": "Indvandrede pr. 1.000 indbyggere", "en": "Immigrants per 1,000 residents", "unit": "pr. 1.000", "dec": 1,
         "dir": 1, "w": 0.10, "kind": "measured", "tables": ["BEV107", "FOLK1A"], "period": f"{bev_periods[0]} til {bev_periods[-1]}",
         "formula_da": f"Indvandrede pr. år, gennemsnit {bev_periods[0]} til {bev_periods[-1]} (BEV107), pr. 1.000 indbyggere (FOLK1A). Nye tilflyttere fra udlandet skal finde en bolig.",
         "formula_en": f"Immigrants per year, average {bev_periods[0]} to {bev_periods[-1]} (BEV107), per 1,000 residents (FOLK1A). New arrivals from abroad need a home."},
        {"id": "D2", "da": "Befolkningsvækst, 5 år", "en": "Population growth, 5 years", "unit": "%", "dec": 1,
         "dir": 1, "w": 0.10, "kind": "measured", "tables": ["FOLK1A"], "period": f"{folk_back} til {folk_per}",
         "formula_da": f"Befolkning {folk_per} mod {folk_back} (FOLK1A).", "formula_en": f"Population {folk_per} vs {folk_back} (FOLK1A)."},
        {"id": "P1", "da": "Andelsværdi mod indkomst", "en": "Co-op value to income", "unit": "x", "dec": 1,
         "dir": 1, "w": 0.10, "kind": "derived", "tables": ["EJDFOE1", "INDKP106"], "period": f"{ejd_per} / {ind_per}",
         "formula_da": "Gennemsnitlig markedsværdi af andelsboliger ejet af kommunens beboere (EJDFOE1) delt med gennemsnitlig disponibel indkomst (INDKP106). En formuestatistik, ikke en salgspris.",
         "formula_en": "Average market value of co-op dwellings held by residents (EJDFOE1) divided by average disposable income (INDKP106). A wealth statistic, not a sales price."},
        {"id": "P2", "da": "Ejerlejlighedsværdi mod indkomst", "en": "Flat value to income", "unit": "x", "dec": 1,
         "dir": 1, "w": 0.10, "kind": "derived", "tables": ["EJDFOE1", "INDKP106"], "period": f"{ejl_per} / {ind_per}",
         "formula_da": "Gennemsnitlig markedsværdi af ejerlejligheder ejet af kommunens beboere (EJDFOE1) delt med gennemsnitlig disponibel indkomst (INDKP106). Dyre ejerlejligheder skubber flere over i køerne. En formuestatistik, ikke en salgspris.",
         "formula_en": "Average market value of owner-occupied flats held by residents (EJDFOE1) divided by average disposable income (INDKP106). Expensive flats push more people into the queues. A wealth statistic, not a sales price."},
        {"id": "S2", "da": "Tomme boliger", "en": "Empty dwellings", "unit": "%", "dec": 1,
         "dir": -1, "w": 0.10, "kind": "measured", "tables": ["BOL101"], "period": bol_per,
         "formula_da": "Boliger uden CPR-tilmeldte personer som andel af alle boliger, ekskl. fritidshuse (BOL101). Flere tomme boliger trækker køtrykket ned.",
         "formula_en": "Dwellings with no registered residents as a share of all dwellings, excluding holiday homes (BOL101). More empty dwellings lower the pressure."},
        # Lenses that were in the v1 index (kept for the map and the explorer, no longer weighted).
        {"id": "D1", "da": "Voksne pr. almen- eller andelsbolig", "en": "Adults per social or co-op dwelling", "unit": "voksne", "dec": 1,
         "kind": "derived", "tables": ["FOLK1A", "BOL101"], "period": f"{folk_per} / {bol_per}",
         "formula_da": "Personer 18+ (FOLK1A) delt med beboede boliger ejet af almene boligselskaber og andelsboligforeninger (BOL101, ejerforhold 20 og 41). Det omvendte af B1; var med i Køtryk v1.",
         "formula_en": "Residents aged 18+ (FOLK1A) divided by occupied dwellings owned by social housing companies and housing co-ops (BOL101, owner 20 and 41). The inverse of B1; part of Køtryk v1."},
        {"id": "D3", "da": "Forventet vækst til 2036", "en": "Projected growth to 2036", "unit": "%", "dec": 1,
         "kind": "projection", "tables": ["FRKM126"], "period": "2026 til 2036",
         "formula_da": "Befolkningsfremskrivning 2036 mod 2026 (FRKM126).", "formula_en": "Population projection 2036 vs 2026 (FRKM126)."},
        {"id": "S1", "da": "Nybyggeri pr. 1.000 indbyggere", "en": "New dwellings per 1,000 residents", "unit": "pr. 1.000", "dec": 1,
         "kind": "measured", "tables": ["BYGV33"], "period": f"{byg_periods[0]} til {byg_periods[-1]}",
         "formula_da": "Fuldførte boliger de seneste 4 kvartaler (BYGV33) pr. 1.000 indbyggere.",
         "formula_en": "Dwellings completed in the last 4 quarters (BYGV33) per 1,000 residents."},
        {"id": "EJERLEJL_VAERDI", "da": "Gennemsnitlig markedsværdi af ejerlejlighed", "en": "Average market value of owner-occupied flat", "unit": "kr.", "dec": 0, "kind": "measured", "tables": ["EJDFOE1"], "period": ejl_per,
         "formula_da": "Gennemsnitlig markedsværdi af ejerlejligheder ejet af personer med bopæl i kommunen (EJDFOE1). Ikke en salgspris.",
         "formula_en": "Average market value of owner-occupied flats owned by residents of the kommune (EJDFOE1). Not a sales price."},
        {"id": "POP", "da": "Befolkning", "en": "Population", "unit": "personer", "dec": 0, "kind": "measured", "tables": ["FOLK1A"], "period": folk_per,
         "formula_da": "Befolkningen den 1. i kvartalet (FOLK1A).", "formula_en": "Population on the first day of the quarter (FOLK1A)."},
        {"id": "ANDEL_N", "da": "Andelsboliger (antal)", "en": "Co-op dwellings (count)", "unit": "boliger", "dec": 0, "kind": "measured", "tables": ["BOL101"], "period": bol_per,
         "formula_da": "Beboede boliger ejet af private andelsboligforeninger (BOL101, ejerforhold 41).", "formula_en": "Occupied dwellings owned by housing co-ops (BOL101, owner 41)."},
        {"id": "ANDEL_PCT", "da": "Andelsboliger (andel)", "en": "Co-op dwellings (share)", "unit": "%", "dec": 1, "kind": "measured", "tables": ["BOL101"], "period": bol_per,
         "formula_da": "Andelsboliger som andel af alle beboede boliger (BOL101).", "formula_en": "Co-op dwellings as a share of all occupied dwellings (BOL101)."},
        {"id": "ALMEN_N", "da": "Almene boliger (antal)", "en": "Social housing (count)", "unit": "boliger", "dec": 0, "kind": "measured", "tables": ["BOL101"], "period": bol_per,
         "formula_da": "Beboede boliger ejet af almene boligselskaber (BOL101, ejerforhold 20).", "formula_en": "Occupied dwellings owned by social housing companies (BOL101, owner 20)."},
        {"id": "ALMEN_PCT", "da": "Almene boliger (andel)", "en": "Social housing (share)", "unit": "%", "dec": 1, "kind": "measured", "tables": ["BOL101"], "period": bol_per,
         "formula_da": "Almene boliger som andel af alle beboede boliger (BOL101).", "formula_en": "Social housing as a share of all occupied dwellings (BOL101)."},
        {"id": "ANDELSVAERDI", "da": "Gennemsnitlig markedsværdi af andelsbolig", "en": "Average market value of co-op dwelling", "unit": "kr.", "dec": 0, "kind": "measured", "tables": ["EJDFOE1"], "period": ejd_per,
         "formula_da": "Gennemsnitlig markedsværdi af andelsboliger ejet af personer med bopæl i kommunen (EJDFOE1). Ikke en salgspris.",
         "formula_en": "Average market value of co-op dwellings owned by residents of the kommune (EJDFOE1). Not a sales price."},
        {"id": "INDKOMST", "da": "Gennemsnitlig disponibel indkomst", "en": "Average disposable income", "unit": "kr.", "dec": 0, "kind": "measured", "tables": ["INDKP106"], "period": ind_per,
         "formula_da": "Gennemsnitlig disponibel indkomst for personer 15+ (INDKP106).", "formula_en": "Average disposable income, persons 15+ (INDKP106)."},
        {"id": "NYBYG_AA", "da": "Nye almen- og andelsboliger pr. 1.000", "en": "New social and co-op dwellings per 1,000", "unit": "pr. 1.000", "dec": 2, "kind": "measured", "tables": ["BYGV33"], "period": f"{byg_periods[0]} til {byg_periods[-1]}",
         "formula_da": "Fuldførte boliger med almene boligselskaber eller andelsboligforeninger som bygherre, seneste 4 kvartaler, pr. 1.000 indbyggere (BYGV33).",
         "formula_en": "Dwellings completed by social housing companies or co-ops, last 4 quarters, per 1,000 residents (BYGV33)."},
        {"id": "NETFLYT", "da": "Nettotilflytning pr. 1.000", "en": "Net internal migration per 1,000", "unit": "pr. 1.000", "dec": 1, "kind": "measured", "tables": ["FLY66"], "period": fly_per,
         "formula_da": "Tilflyttere minus fraflyttere mellem kommuner (FLY66) pr. 1.000 indbyggere. Kun flytninger inden for Danmark.",
         "formula_en": "Moves in minus moves out between kommuner (FLY66) per 1,000 residents. Domestic moves only."},
        {"id": "BOLIGSTOETTE", "da": "Husstande med boligstøtte pr. 1.000", "en": "Households on housing benefit per 1,000", "unit": "pr. 1.000", "dec": 1, "kind": "measured", "tables": ["BOST63"], "period": f"december {bost_per}",
         "formula_da": "Husstande med boligstøtte i december (BOST63, alle typer) pr. 1.000 indbyggere.",
         "formula_en": "Households receiving housing benefit in December (BOST63, all types) per 1,000 residents."},
        {"id": "M2_PERSON", "da": "Boligareal pr. person", "en": "Floor area per person", "unit": "m²", "dec": 1, "kind": "measured", "tables": ["BOL106"], "period": bol106_per,
         "formula_da": "Gennemsnitligt boligareal pr. person (BOL106).", "formula_en": "Average floor area per person (BOL106)."},
    ]
    for m in meta:
        m["sources"] = [src(t) for t in m["tables"]]

    # History for sparklines (kept separate from kommuner.json to respect the size budget).
    def hist(name, keep=None):
        out = {}
        for k, d in T[name].items():
            ps = sorted(d)
            if keep:
                ps = [p for p in ps if keep(p)]
            out[k] = [d[p] for p in ps]
        return {"periods": ps, "values": out}

    def annual_completions():
        per = sorted(next(iter(T["bygv33_fuldfoert"].values())))
        years = sorted({p[:4] for p in per if all(f"{p[:4]}K{q}" in per for q in range(1, 5))})
        out = {}
        for k, d in T["bygv33_fuldfoert"].items():
            row = []
            for y in years:
                vs = [d.get(f"{y}K{q}") for q in range(1, 5)]
                row.append(None if any(v is None for v in vs) else sum(vs))
            out[k] = row
        return {"periods": years, "values": out}

    history = {
        "POP": hist("folk1a_pop_hist", lambda p: p.endswith("K1")),
        "ALMEN_N": hist("bol101_bebo1000_ejer20"),
        "ANDEL_N": hist("bol101_bebo1000_ejer41"),
        "ANDELSVAERDI": hist("ejdfoe1_andel_gns"),
        "INDKOMST": hist("indkp106_gns"),
        "BOLIGSTOETTE_ABS": hist("bost63_husstande"),
        "NYBYG_ABS": annual_completions(),
    }
    out = {"meta": meta, "values": values, "history": history,
           "flows": c["flows"], "kommuner": kommuner,
           "netflow": {"in": inflow, "out": outflow}}
    (RAW / "clean" / "indicators.json").write_text(json.dumps(out, ensure_ascii=False), "utf-8")
    nulls = {m["id"]: sum(1 for v in values.values() if v[m["id"]] is None) for m in meta}
    print("nulls per indicator:", {k: n for k, n in nulls.items() if n})
    print("København:", {k: round(v, 3) if v is not None else None for k, v in values["0101"].items()})
    return 0


if __name__ == "__main__":
    sys.exit(main())
