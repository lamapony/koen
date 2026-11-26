"""Fetch Danmarks Statistik tables via the StatBank API (https://api.statbank.dk/v1).

Writes data/raw/dst/{TABLE}.tableinfo.json and data/raw/dst/{TABLE}_{query}.csv.
Licence: CC 4.0 BY (https://www.dst.dk/da/presse/kildeangivelse).
Periods are resolved from tableinfo at fetch time, never hardcoded.
"""

from __future__ import annotations

import json
import sys

from common import RAW, fetch

API = "https://api.statbank.dk/v1"

# Each query: table, name, variables. Special value "LATEST" / "LATEST:n" means the
# n latest periods of Tid; "ALL" means every value ("*").
QUERIES: list[dict] = [
    {"table": "BOL101", "name": "ejer", "vars": {"OMRÅDE": "ALL", "BEBO": ["1000", "2000"], "EJER": ["20", "41"], "Tid": "ALL"}},
    {"table": "BOL101", "name": "total", "vars": {"OMRÅDE": "ALL", "BEBO": ["1000", "2000"], "Tid": "ALL"}},
    {"table": "FOLK1A", "name": "alder", "vars": {"OMRÅDE": "ALL", "ALDER": "ALL", "Tid": "LATEST_AND_5Y"}},
    {"table": "FOLK1A", "name": "hist", "vars": {"OMRÅDE": "ALL", "Tid": "ALL"}},
    {"table": "FRKM126", "name": "total", "vars": {"KOMMUNEDK": "ALL", "Tid": ["2026", "2036"]}},
    {"table": "EJDFOE1", "name": "andel", "vars": {"VAERDI": ["100"], "BOPKOM": "ALL", "ENHED": ["100", "120"], "EJENTYP": ["D"], "Tid": "ALL"}},
    {"table": "INDKP106", "name": "gns", "vars": {"OMRÅDE": "ALL", "ENHED": ["118"], "KOEN": ["MOK"], "ALDER1": ["00"], "INDKINTB": ["000"], "Tid": "LATEST:12"}},
    {"table": "BYGV33", "name": "fuldfoert", "vars": {"OMRÅDE": "ALL", "BYGFASE": ["3"], "Tid": "LATEST:24"}},
    {"table": "BYGV33", "name": "fuldfoert_bygherre", "vars": {"OMRÅDE": "ALL", "BYGFASE": ["3"], "BYGHERRE": ["20", "41"], "Tid": "LATEST:24"}},
    {"table": "BOST63", "name": "husstande", "vars": {"OMRÅDE": "ALL", "YDELSESTYPE": ["1000"], "MND": ["012"], "ENHED": ["3000"], "Tid": "LATEST:10"}},
    {"table": "FLY66", "name": "matrix", "vars": {"TILKOMMUNE": "ALL", "FRAKOMMUNE": "ALL", "Tid": "LATEST:1"}},
    {"table": "BOL106", "name": "m2", "vars": {"OMRÅDE": "ALL", "ENHED": ["GNSAP", "GNSPB"], "ANVENDELSE": ["TOT"], "Tid": "LATEST:1"}},
    # Method v2 (demand side): moves in from other kommuner plus immigration, last 5 years. KØN is eliminated (both sexes).
    {"table": "BEV107", "name": "flyt", "vars": {"OMRÅDE": "ALL", "BEVÆGELSE": ["B01A", "B05", "B06", "B07", "B08AA", "B09BA", "B10", "B11"], "Tid": "LATEST:5"}},
    # Method v2 (price side): average market value of owner-occupied flats held by residents (wealth statistic).
    {"table": "EJDFOE1", "name": "ejerlejl", "vars": {"VAERDI": ["100"], "BOPKOM": "ALL", "ENHED": ["100", "120"], "EJENTYP": ["B"], "Tid": "LATEST:1"}},
]


def tableinfo(table: str) -> dict:
    raw = fetch(
        f"dst/{table}.tableinfo.json",
        f"{API}/tableinfo",
        method="POST",
        json_body={"table": table, "format": "JSON", "lang": "da"},
    )
    return json.loads(raw)


def resolve(info: dict, var: str, spec) -> list[str]:
    v = next(x for x in info["variables"] if x["id"] == var)
    ids = [x["id"] for x in v["values"]]
    if spec == "ALL":
        return ["*"]
    if spec == "LATEST_AND_5Y":
        last = ids[-1]  # e.g. 2026K4
        year, q = last.split("K")
        back = f"{int(year) - 5}K{q}"
        assert back in ids, back
        return [back, last]
    if isinstance(spec, str) and spec.startswith("LATEST:"):
        n = int(spec.split(":")[1])
        return ids[-n:]
    for s in spec:
        assert s in ids, f"{info['id']} {var} has no value {s}"
    return list(spec)


def main() -> int:
    infos = {}
    for q in QUERIES:
        t = q["table"]
        if t not in infos:
            infos[t] = tableinfo(t)
        info = infos[t]
        variables = [{"code": var, "values": resolve(info, var, spec)} for var, spec in q["vars"].items()]
        body = {"table": t, "format": "CSV", "delimiter": "Semicolon", "lang": "da", "valuePresentation": "Code", "variables": variables}
        key = f"dst/{t}_{q['name']}.csv"
        data = fetch(key, f"{API}/data", method="POST", json_body=body)
        lines = data.decode("utf-8-sig").splitlines()
        print(f"{key}: {len(lines) - 1} rows, header {lines[0]}")
    # Record the query plan so later steps know what was asked.
    (RAW / "dst" / "_queries.json").write_text(json.dumps(QUERIES, ensure_ascii=False, indent=2), "utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
