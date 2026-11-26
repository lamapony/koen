"""Parse cached DST CSVs into one tidy structure keyed by kommune.

Output: data/raw/clean/dst.json
  kommuner: [{kode, navn, region}]
  tables: {name: {kode: {period: value|None}}}
  periods: {table: updated timestamp}
DST missing marker ".." becomes None. Nothing is zero-filled.
"""

from __future__ import annotations

import csv
import io
import json
import sys
from collections import defaultdict

from common import RAW, is_kommune_code


def read(name: str) -> list[dict]:
    text = (RAW / "dst" / f"{name}.csv").read_text("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text), delimiter=";"))


def num(s: str):
    s = s.strip()
    if s in ("..", "", "-"):
        return None
    return float(s.replace(",", "."))


def kommuner_and_regions() -> list[dict]:
    info = json.loads((RAW / "dst" / "BOL101.tableinfo.json").read_text("utf-8"))
    omr = next(v for v in info["variables"] if v["id"] == "OMRÅDE")["values"]
    region = None
    out = []
    for x in omr:
        c = x["id"]
        if c.startswith("08") and len(c) == 3:
            region = x["text"]
        elif is_kommune_code(c):
            out.append({"kode": c.zfill(4), "navn": x["text"], "region": region})
    assert len(out) == 98, len(out)
    return out


def main() -> int:
    t: dict[str, dict] = defaultdict(lambda: defaultdict(dict))

    def put(series: str, code: str, period: str, value):
        if is_kommune_code(code):
            t[series][code.zfill(4)][period] = value

    for r in read("BOL101_ejer"):
        put(f"bol101_bebo{r['BEBO']}_ejer{r['EJER']}", r["OMRÅDE"], r["TID"], num(r["INDHOLD"]))
    for r in read("BOL101_total"):
        put(f"bol101_bebo{r['BEBO']}_total", r["OMRÅDE"], r["TID"], num(r["INDHOLD"]))

    # FOLK1A by age: adults 18+, aged 20-34, total, for two periods.
    agg: dict = defaultdict(lambda: defaultdict(float))
    for r in read("FOLK1A_alder"):
        a, code, per, v = r["ALDER"], r["OMRÅDE"], r["TID"], num(r["INDHOLD"])
        if v is None:
            continue
        if a == "IALT":
            agg[("pop", code)][per] += v
            continue
        age = int(a)
        if age >= 18:
            agg[("adults", code)][per] += v
        if 20 <= age <= 34:
            agg[("young", code)][per] += v
    for (series, code), d in agg.items():
        for per, v in d.items():
            put(f"folk1a_{series}", code, per, v)
    for r in read("FOLK1A_hist"):
        put("folk1a_pop_hist", r["OMRÅDE"], r["TID"], num(r["INDHOLD"]))

    for r in read("FRKM126_total"):
        put("frkm126_pop", r["KOMMUNEDK"], r["TID"], num(r["INDHOLD"]))

    for r in read("EJDFOE1_andel"):
        series = "ejdfoe1_andel_gns" if r["ENHED"] == "120" else "ejdfoe1_andel_antal"
        put(series, r["BOPKOM"], r["TID"], num(r["INDHOLD"]))

    for r in read("INDKP106_gns"):
        put("indkp106_gns", r["OMRÅDE"], r["TID"], num(r["INDHOLD"]))

    for r in read("BYGV33_fuldfoert"):
        put("bygv33_fuldfoert", r["OMRÅDE"], r["TID"], num(r["INDHOLD"]))
    for r in read("BYGV33_fuldfoert_bygherre"):
        put(f"bygv33_fuldfoert_{r['BYGHERRE']}", r["OMRÅDE"], r["TID"], num(r["INDHOLD"]))

    for r in read("BOST63_husstande"):
        put("bost63_husstande", r["OMRÅDE"], r["TID"], num(r["INDHOLD"]))

    for r in read("BOL106_m2"):
        put(f"bol106_{r['ENHED'].lower()}", r["OMRÅDE"], r["TID"], num(r["INDHOLD"]))

    flows = []
    for r in read("FLY66_matrix"):
        to, fr, v = r["TILKOMMUNE"], r["FRAKOMMUNE"], num(r["INDHOLD"])
        if is_kommune_code(to) and is_kommune_code(fr) and to != fr and v:
            flows.append([fr.zfill(4), to.zfill(4), v])
    fly_period = read("FLY66_matrix")[0]["TID"]

    updated = {}
    for f in (RAW / "dst").glob("*.tableinfo.json"):
        info = json.loads(f.read_text("utf-8"))
        updated[info["id"]] = info.get("updated")

    out = {
        "kommuner": kommuner_and_regions(),
        "tables": t,
        "flows": {"period": fly_period, "rows": flows},
        "updated": updated,
    }
    p = RAW / "clean" / "dst.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, ensure_ascii=False), "utf-8")
    for k, v in sorted(t.items()):
        print(f"{k}: {len(v)} kommuner")
    print(f"flows {fly_period}: {len(flows)} pairs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
