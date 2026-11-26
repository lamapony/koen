"""Assemble the site data files (site/public/data).

kommuner.json   98 kommuner: raw indicator values, z-scores, Køtryk percentile and band
indicators.json indicator metadata (labels, units, formula, source tables, periods) and index params
history.json    short time series for sparklines (lazy-loaded)
flows.json      top internal migration partners per kommune (FLY66)
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict

from common import RAW, SITE_DATA, write_json

TOP_FLOWS = 10


def r(v, d=4):
    return None if v is None else round(v, d)


def main() -> int:
    ind = json.loads((RAW / "clean" / "indicators.json").read_text("utf-8"))
    ix = json.loads((RAW / "clean" / "index.json").read_text("utf-8"))
    measured = json.loads((SITE_DATA / "measured.json").read_text("utf-8"))

    maalt = defaultdict(list)
    a = measured["aarhusbolig"]
    for p in a["points"]:
        maalt[p["kode"]].append(p)

    kommuner = []
    for k in ind["kommuner"]:
        c = k["kode"]
        row = {
            "kode": c,
            "navn": k["navn"],
            "region": k["region"].replace("Region ", ""),
            "ind": {i: r(v) for i, v in ind["values"][c].items()},
            "z": ix["z"][c],
            "koetryk": ix["koetryk"][c],
            "koetrykBand": ix["band"][c],
            "used": ix["used"][c],
        }
        if c in maalt:
            pts = maalt[c]
            row["maalt"] = [{
                "source": a["source"], "sourceUrl": a["sourceUrl"], "observedAt": a["observedAt"],
                "lists": sum(p["lists"] for p in pts), "peopleOnLists": sum(p["signups"] for p in pts),
                "maxList": max(p["maxList"] for p in pts), "postnumre": [p["postnummer"] for p in pts],
            }]
        kommuner.append(row)

    val = json.loads((RAW / "clean" / "validation.json").read_text("utf-8"))
    validation = {k: val[k] for k in ("before", "after", "leaveOneAnchorOut", "weightDrawsTop15", "topN", "maxOwner3Rho")}
    meta = {
        "indicators": ind["meta"],
        "index": {"ids": ix["ids"], "weights": ix["weights"], "loo": ix["loo"], "params": ix["params"],
                  "version": 2, "validation": validation},
    }

    codes = [k["kode"] for k in ind["kommuner"]]
    pos = {c: i for i, c in enumerate(codes)}
    out_by = defaultdict(list)
    in_by = defaultdict(list)
    for fr, to, v in ind["flows"]["rows"]:
        out_by[fr].append((v, to))
        in_by[to].append((v, fr))
    keep = set()
    for c in codes:
        for v, t in sorted(out_by[c], reverse=True)[:TOP_FLOWS]:
            keep.add((pos[c], pos[t], int(v)))
        for v, f in sorted(in_by[c], reverse=True)[:TOP_FLOWS]:
            keep.add((pos[f], pos[c], int(v)))
    flows = {"period": ind["flows"]["period"], "table": "FLY66",
             "in": {c: int(v) for c, v in ind["netflow"]["in"].items()},
             "out": {c: int(v) for c, v in ind["netflow"]["out"].items()},
             "rows": sorted(keep)}

    sizes = {
        "kommuner.json": write_json(SITE_DATA / "kommuner.json", kommuner),
        "indicators.json": write_json(SITE_DATA / "indicators.json", meta),
        "history.json": write_json(SITE_DATA / "history.json", ind["history"]),
        "flows.json": write_json(SITE_DATA / "flows.json", flows),
    }
    for k, v in sizes.items():
        print(f"{k}: {v/1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
