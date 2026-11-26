"""Validate Køtryk against the little real queue evidence there is (docs/METHOD.md, section Validation).

Anchors (none of them is a national queue register, which does not exist):
  owner3          København, Frederiksberg and Aarhus have the longest queues (owner's statement, 2026-11-26).
  ventelistevalg  Ventelistevalg's andels catalog with public queue data covers only København and Frederiksberg
                  (../andelplan src/lib/district-slug.ts: 9 bydele, districtMunicipality returns only those two).
  aarhusbolig     Aarhusbolig 2017 (CC BY 4.0): mean sign-ups per waiting list per kommune, the only real
                  per-kommune queue numbers in open data. Three kommuner: Aarhus, Skanderborg, Favrskov.
  kk-almene       Københavns Kommune almene afdelinger: dwelling counts, no queue numbers. Used only as a
                  consistency check of the BOL101 almen count, not as a ranking anchor.

Metrics per anchor, for Køtryk v1 (PLAN.md weights, frozen here) and v2 (index.json):
  ranks, AUC (probability that an anchor kommune ranks above a random other kommune), Spearman between the
  index and anchor membership (0/1; with 3 of 98 positives the maximum possible is about 0.30), and for
  Aarhusbolig the Spearman between the index and the measured value (n = 3, so only 1.0, 0.5, -0.5, -1.0 occur).
Held-out checks:
  leave-one-anchor-out: from a fixed family of simple specs, pick the one with the best AUC on two of the three
  owner3 kommuner and report where the third lands. Aarhusbolig is never used to choose weights.
  weight draws: share of the 200 Dirichlet weight sets (same seed as 30_index) that keep each owner3 kommune
  in the top 15.

Output: data/raw/clean/validation.json (60_export copies a summary into indicators.json, meta.index.validation)
"""

from __future__ import annotations

import importlib.util
import json
import random
import sys
from collections import defaultdict
from pathlib import Path

from common import RAW, SITE_DATA, write_json

_spec = importlib.util.spec_from_file_location("ix", Path(__file__).with_name("30_index.py"))
ix = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ix)

V1 = {"D1": (0.25, 1), "D2": (0.15, 1), "D3": (0.10, 1), "D4": (0.15, 1), "P1": (0.15, 1), "S1": (0.10, -1), "S2": (0.10, -1)}

# Fixed family for the leave-one-anchor-out check. Written down before the check runs; not tuned per run.
FAMILY = {
    "v1": V1,
    "v1, D1 vendt": {**V1, "D1": (0.25, -1)},
    "kun bestand": {"B1": (1.0, 1)},
    "kun efterspørgsel": {"D4": (1 / 3, 1), "D5": (1 / 3, 1), "D2": (1 / 3, 1)},
    "kun pris": {"P1": (0.5, 1), "P2": (0.5, 1)},
    "lige vægte": {k: (1 / 7, d) for k, d in [("B1", 1), ("D4", 1), ("D5", 1), ("D2", 1), ("P1", 1), ("P2", 1), ("S2", -1)]},
    "tre søjler": {"B1": (1 / 3, 1), "D4": (1 / 9, 1), "D5": (1 / 9, 1), "D2": (1 / 9, 1), "P1": (1 / 6, 1), "P2": (1 / 6, 1)},
    "v2": None,  # filled from the indicator meta
}

OWNER3 = ["0101", "0147", "0751"]
VV = ["0101", "0147"]
TOP_N = 15


def score(values: dict, codes: list[str], spec: dict) -> list[float]:
    z = {i: ix.robust_z([values[c][i] for c in codes], d) for i, (_, d) in spec.items()}
    return ix.combine(z, {i: w for i, (w, _) in spec.items()}, len(codes))


def ranks(raw: list[float], codes: list[str]) -> dict[str, float]:
    """Rank 1 = highest. Ties (common when z hits the ±2.5 clamp) share their mean rank, so list order never decides."""
    return {c: 1 + sum(1 for y in raw if y > x) + 0.5 * (sum(1 for y in raw if y == x) - 1) for c, x in zip(codes, raw)}


def auc(raw: list[float], codes: list[str], pos: list[str]) -> float:
    s = dict(zip(codes, raw))
    neg = [c for c in codes if c not in pos]
    return sum((s[p] > s[n]) + 0.5 * (s[p] == s[n]) for p in pos for n in neg) / (len(pos) * len(neg))


def member_rho(raw: list[float], codes: list[str], pos: list[str]) -> float:
    return ix.spearman(raw, [1.0 if c in pos else 0.0 for c in codes])


def aarhusbolig_anchor() -> dict[str, float]:
    m = json.loads((SITE_DATA / "measured.json").read_text("utf-8"))["aarhusbolig"]
    agg = defaultdict(lambda: [0, 0])
    for p in m["points"]:
        agg[p["kode"]][0] += p["signups"]
        agg[p["kode"]][1] += p["lists"]
    return {k: s / n for k, (s, n) in agg.items() if n}


def evaluate(raw: list[float], codes: list[str], ab: dict[str, float]) -> dict:
    r = ranks(raw, codes)
    s = dict(zip(codes, raw))
    ab_codes = sorted(ab)
    return {
        "ranks": {c: r[c] for c in OWNER3 + ab_codes},
        "owner3": {"auc": round(auc(raw, codes, OWNER3), 3), "rho": round(member_rho(raw, codes, OWNER3), 3),
                   "allTop15": all(r[c] <= TOP_N for c in OWNER3)},
        "ventelistevalg": {"auc": round(auc(raw, codes, VV), 3), "rho": round(member_rho(raw, codes, VV), 3)},
        "aarhusbolig": {"n": len(ab_codes), "rho": round(ix.spearman([s[c] for c in ab_codes], [ab[c] for c in ab_codes]), 3)},
    }


def main() -> int:
    ind = json.loads((RAW / "clean" / "indicators.json").read_text("utf-8"))
    idx = json.loads((RAW / "clean" / "index.json").read_text("utf-8"))
    codes = [k["kode"] for k in ind["kommuner"]]
    names = {k["kode"]: k["navn"] for k in ind["kommuner"]}
    values = ind["values"]
    meta = {m["id"]: m for m in ind["meta"]}
    v2 = {i: (meta[i]["w"], meta[i]["dir"]) for i in idx["ids"]}
    FAMILY["v2"] = v2
    ab = aarhusbolig_anchor()

    raw_v1 = score(values, codes, V1)
    raw_v2 = [idx["raw"][c] for c in codes]
    before, after = evaluate(raw_v1, codes, ab), evaluate(raw_v2, codes, ab)
    perfect = [1.0 if c in OWNER3 else 0.0 for c in codes]

    # Leave-one-anchor-out model choice over the fixed family.
    fam_raw = {n: score(values, codes, s) for n, s in FAMILY.items()}
    loao = []
    for held in OWNER3:
        train = [c for c in OWNER3 if c != held]
        best = max(fam_raw, key=lambda n: (auc(fam_raw[n], codes, train), n == "v2"))
        loao.append({"heldOut": held, "navn": names[held], "chosen": best,
                     "trainAuc": round(auc(fam_raw[best], codes, train), 3),
                     "heldOutRank": ranks(fam_raw[best], codes)[held]})
    family = {n: {"owner3Auc": round(auc(r, codes, OWNER3), 3), "ranks": {c: ranks(r, codes)[c] for c in OWNER3},
                  "aarhusboligRho": evaluate(r, codes, ab)["aarhusbolig"]["rho"]} for n, r in fam_raw.items()}

    # Weight draws, same generator as 30_index.
    zcols = {k: ix.robust_z([values[c][k] for c in codes], v2[k][1]) for k in v2}
    W = {k: w for k, (w, _) in v2.items()}
    rng = random.Random(idx["params"]["seed"])
    top_hits = {c: 0 for c in OWNER3}
    draws = idx["params"]["draws"]
    for _ in range(draws):
        gv = {k: rng.gammavariate(W[k] * idx["params"]["concentration"], 1.0) for k in W}
        tot = sum(gv.values())
        rr = ranks(ix.combine(zcols, {k: v / tot for k, v in gv.items()}, len(codes)), codes)
        for c in OWNER3:
            top_hits[c] += rr[c] <= TOP_N

    kk = json.loads((SITE_DATA / "measured.json").read_text("utf-8")).get("kk") or {}
    c_dst = json.loads((RAW / "clean" / "dst.json").read_text("utf-8"))["tables"]
    bolp = sorted(c_dst["bol101_bebo1000_ejer20"]["0101"])[-1]
    almen_kbh = (c_dst["bol101_bebo1000_ejer20"]["0101"][bolp] or 0) + (c_dst["bol101_bebo2000_ejer20"]["0101"].get(bolp) or 0)

    out = {
        "anchors": {
            "owner3": {"kommuner": OWNER3, "source": "Ejerens udsagn 2026-11-26: København, Frederiksberg og Aarhus har de længste køer."},
            "ventelistevalg": {"kommuner": VV, "source": "Ventelistevalg (../andelplan): andelskatalog med offentlige ventelistedata dækker kun København og Frederiksberg."},
            "aarhusbolig": {"values": {c: round(v, 1) for c, v in ab.items()}, "unit": "tilmeldinger pr. venteliste",
                            "source": "Aarhusbolig 2017, Open Data DK, CC BY 4.0"},
            "kkAlmene": {"dwellingsKk": kk.get("dwellings"), "almenBol101": almen_kbh, "bol101Period": bolp,
                         "ratio": round(kk["dwellings"] / almen_kbh, 3) if kk.get("dwellings") and almen_kbh else None,
                         "note": "Ingen kø-tal i datasættet; kun en kontrol af BOL101's almene boliger i København."},
        },
        # Best possible Spearman for an index without ties: the three anchors on top, everything else below.
        "maxOwner3Rho": round(member_rho([p + 1e-6 * i for i, p in enumerate(perfect)], codes, OWNER3), 3),
        "before": before,
        "after": after,
        "leaveOneAnchorOut": loao,
        "family": family,
        "weightDrawsTop15": {c: round(top_hits[c] / draws, 3) for c in OWNER3},
        "topN": TOP_N,
    }
    write_json(RAW / "clean" / "validation.json", out, compact=False)

    def line(lbl, e):
        rk = e["ranks"]
        print(f"{lbl:<7} KBH {rk['0101']:>2}  FRB {rk['0147']:>2}  AAR {rk['0751']:>2} | owner3 AUC {e['owner3']['auc']:.3f} rho {e['owner3']['rho']:.3f}"
              f" | VV AUC {e['ventelistevalg']['auc']:.3f} rho {e['ventelistevalg']['rho']:.3f} | Aarhusbolig rho {e['aarhusbolig']['rho']:.2f} (n={e['aarhusbolig']['n']})")
    line("v1", before)
    line("v2", after)
    print(f"max owner3 rho possible: {out['maxOwner3Rho']}")
    for x in loao:
        print(f"leave-one-anchor-out: hold {x['navn']:<14} chose {x['chosen']:<18} rank {x['heldOutRank']}")
    print("weight draws, share in top 15:", {names[c]: v for c, v in out["weightDrawsTop15"].items()})
    print(f"KK almene check: {kk.get('dwellings')} vs BOL101 {almen_kbh:.0f} ({bolp})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
