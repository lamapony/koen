"""Køtryk (modelled queue pressure index), PLAN.md section 2.3.

z_i = clamp((x_i - median_i) / (1.4826 * MAD_i), -2.5, 2.5), sign-flipped for S1, S2
raw = sum(w_i * z_i) over non-null indicators, weights renormalised
koetryk = percentile rank of raw in [0, 1]
Uncertainty band: min..max percentile across 200 Dirichlet weight draws around the defaults (seeded).
Leave-one-out: Spearman(full, index without indicator i) must be >= 0.8 for every i, else exit 1.

Output: data/raw/clean/index.json
"""

from __future__ import annotations

import json
import random
import statistics
import sys

from common import RAW

INDEX_IDS = ["D1", "D2", "D3", "D4", "P1", "S1", "S2"]
CLAMP = 2.5
N_DRAWS = 200
DIRICHLET_CONCENTRATION = 20.0
LOO_MIN = 0.8
SEED = 20261126


def robust_z(xs: list[float | None], direction: int) -> list[float | None]:
    vals = [x for x in xs if x is not None]
    if not vals:
        return [None for _ in xs]
    med = statistics.median(vals)
    mad = statistics.median([abs(x - med) for x in vals]) * 1.4826
    if mad == 0:
        mad = statistics.pstdev(vals) or 1.0
    out = []
    for x in xs:
        if x is None:
            out.append(None)
        else:
            z = max(-CLAMP, min(CLAMP, (x - med) / mad)) * direction
            out.append(z)
    return out


def combine(zcols: dict[str, list], weights: dict[str, float], n: int) -> list[float]:
    raw = []
    for i in range(n):
        s = wsum = 0.0
        for k, w in weights.items():
            z = zcols[k][i]
            if z is not None and w > 0:
                s += w * z
                wsum += w
        raw.append(s / wsum if wsum else 0.0)
    return raw


def pct_rank(xs: list[float]) -> list[float]:
    n = len(xs)
    order = sorted(range(n), key=lambda i: xs[i])
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        r = (i + j) / 2
        for t in range(i, j + 1):
            ranks[order[t]] = r / (n - 1) if n > 1 else 0.5
        i = j + 1
    return ranks


def spearman(a: list[float], b: list[float]) -> float:
    ra, rb = pct_rank(a), pct_rank(b)
    ma, mb = statistics.mean(ra), statistics.mean(rb)
    cov = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    va = sum((x - ma) ** 2 for x in ra) ** 0.5
    vb = sum((y - mb) ** 2 for y in rb) ** 0.5
    return cov / (va * vb)


def main() -> int:
    ind = json.loads((RAW / "clean" / "indicators.json").read_text("utf-8"))
    meta = {m["id"]: m for m in ind["meta"]}
    codes = [k["kode"] for k in ind["kommuner"]]
    n = len(codes)
    W = {k: meta[k]["w"] for k in INDEX_IDS}
    assert abs(sum(W.values()) - 1) < 1e-9

    zcols = {k: robust_z([ind["values"][c][k] for c in codes], meta[k]["dir"]) for k in INDEX_IDS}
    raw = combine(zcols, W, n)
    pct = pct_rank(raw)

    rng = random.Random(SEED)
    lo, hi = pct[:], pct[:]
    for _ in range(N_DRAWS):
        g = {k: rng.gammavariate(W[k] * DIRICHLET_CONCENTRATION, 1.0) for k in INDEX_IDS}
        s = sum(g.values())
        p = pct_rank(combine(zcols, {k: v / s for k, v in g.items()}, n))
        for i in range(n):
            lo[i] = min(lo[i], p[i])
            hi[i] = max(hi[i], p[i])

    loo = {}
    for k in INDEX_IDS:
        w2 = {j: W[j] for j in INDEX_IDS if j != k}
        loo[k] = round(spearman(raw, combine(zcols, w2, n)), 4)
    print("leave-one-out Spearman:", loo)
    failed = {k: v for k, v in loo.items() if v < LOO_MIN}

    used = [sum(1 for k in INDEX_IDS if zcols[k][i] is not None) for i in range(n)]
    out = {
        "ids": INDEX_IDS,
        "weights": W,
        "z": {c: {k: (round(zcols[k][i], 4) if zcols[k][i] is not None else None) for k in INDEX_IDS} for i, c in enumerate(codes)},
        "raw": {c: round(raw[i], 5) for i, c in enumerate(codes)},
        "koetryk": {c: round(pct[i], 4) for i, c in enumerate(codes)},
        "band": {c: [round(lo[i], 4), round(hi[i], 4)] for i, c in enumerate(codes)},
        "used": {c: used[i] for i, c in enumerate(codes)},
        "loo": loo,
        "params": {"clamp": CLAMP, "draws": N_DRAWS, "concentration": DIRICHLET_CONCENTRATION, "seed": SEED, "looMin": LOO_MIN},
    }
    (RAW / "clean" / "index.json").write_text(json.dumps(out, ensure_ascii=False), "utf-8")

    names = {k["kode"]: k["navn"] for k in ind["kommuner"]}
    top = sorted(codes, key=lambda c: -out["koetryk"][c])
    print("Top 10 Køtryk:")
    for c in top[:10]:
        print(f"  {names[c]:<18} {out['koetryk'][c]:.3f}  band {out['band'][c]}")
    print("Bottom 5:", [names[c] for c in top[-5:]])
    if failed:
        print(f"FAIL: leave-one-out below {LOO_MIN}: {failed}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
