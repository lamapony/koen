"""Independent reproducible audit of METHOD.md using cached cleaned inputs.

Run: python tests/recompute_validation.py (after make process). No pipeline code imported.
"""
import json
import math
import statistics as st
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ind = json.loads((ROOT / 'data/raw/clean/indicators.json').read_text())
measured = json.loads((ROOT / 'site/public/data/measured.json').read_text())
codes = [k['kode'] for k in ind['kommuner']]
values = ind['values']
meta = {m['id']: m for m in ind['meta']}
v1 = {'D1': (.25, 1), 'D2': (.15, 1), 'D3': (.10, 1), 'D4': (.15, 1), 'P1': (.15, 1), 'S1': (.10, -1), 'S2': (.10, -1)}
v2 = {k: (m['w'], m['dir']) for k, m in meta.items() if 'w' in m}

def scores(spec):
    cols = {}
    for key, (_, direction) in spec.items():
        xs = [values[c][key] for c in codes]
        present = [x for x in xs if x is not None]
        median = st.median(present)
        scale = 1.4826 * st.median(abs(x - median) for x in present) or st.pstdev(present) or 1
        cols[key] = [None if x is None else direction * max(-2.5, min(2.5, (x - median) / scale)) for x in xs]
    out = []
    for i in range(len(codes)):
        wsum = sum(spec[k][0] for k in spec if cols[k][i] is not None)
        # Same rule as pipeline/30_index.combine: a kommune with no known input scores 0 (the median).
        out.append(sum(spec[k][0] * cols[k][i] for k in spec if cols[k][i] is not None) / wsum if wsum else 0.0)
    return out

def ranks(xs):
    return [1 + sum(y > x for y in xs) + (sum(y == x for y in xs) - 1) / 2 for x in xs]

def rho(xs, ys):
    a, b = ranks(xs), ranks(ys)
    ma, mb = st.mean(a), st.mean(b)
    return sum((x-ma)*(y-mb) for x,y in zip(a,b)) / math.sqrt(sum((x-ma)**2 for x in a)*sum((y-mb)**2 for y in b))

def auc(xs, positive):
    pos = [x for c,x in zip(codes,xs) if c in positive]
    neg = [x for c,x in zip(codes,xs) if c not in positive]
    return sum((p > n) + .5 * (p == n) for p in pos for n in neg) / (len(pos)*len(neg))

owner = ['0101', '0147', '0751']
vv = owner[:2]
aggs = {}
for p in measured['aarhusbolig']['points']:
    total, count = aggs.get(p['kode'], (0, 0))
    aggs[p['kode']] = total + p['signups'], count + p['lists']
ab = {k: s/n for k, (s,n) in aggs.items() if n}
print('Aarhusbolig means:', {k: round(v, 1) for k,v in ab.items()})
for label, spec in [('v1', v1), ('v2', v2)]:
    xs = scores(spec)
    bycode = dict(zip(codes, xs))
    rank = dict(zip(codes, ranks(xs)))
    print(label, 'ranks', [rank[c] for c in owner + ['0746', '0710']])
    for name, group in [('owner3', owner), ('Ventelistevalg', vv)]:
        print(name, 'AUC', round(auc(xs, group), 3), 'rho', round(rho(xs, [int(c in group) for c in codes]), 3))
    print('Aarhusbolig rho', round(rho([bycode[c] for c in ab], list(ab.values())), 3))
    if label == 'v2':
        print('leave-one-indicator-out:', {k: round(rho(xs, scores({j:v for j,v in spec.items() if j != k})), 2) for k in spec})

# Repeat the fixed model family, hold-out choice and seeded Dirichlet draws.
import random
family = {
    'v1': v1,
    'v1 inverted': {**v1, 'D1': (.25, -1)},
    'stock': {'B1': (1, 1)},
    'demand': {k: (1/3, 1) for k in ('D4', 'D5', 'D2')},
    'price': {'P1': (.5, 1), 'P2': (.5, 1)},
    'equal': {k: (1/7, direction) for k, (_, direction) in v2.items()},
    'pillars': {'B1': (1/3, 1), 'D4': (1/9, 1), 'D5': (1/9, 1), 'D2': (1/9, 1), 'P1': (1/6, 1), 'P2': (1/6, 1)},
    'v2': v2,
}
family_scores = {name: scores(spec) for name, spec in family.items()}
for held in owner:
    train = [c for c in owner if c != held]
    chosen = max(family_scores, key=lambda name: (auc(family_scores[name], train), name == 'v2'))
    print('held out', held, chosen, 'rank', dict(zip(codes, ranks(family_scores[chosen])))[held])
print('price AUC', round(auc(family_scores['price'], owner), 3), 'ranks', [dict(zip(codes, ranks(family_scores['price'])))[c] for c in owner])
print('Brøndby family ranks', {name: dict(zip(codes, ranks(xs)))['0153'] for name, xs in family_scores.items()})
rng = random.Random(20261126)
hits = {c: 0 for c in owner}
for _ in range(200):
    draw = {k: rng.gammavariate(w * 20, 1) for k, (w, _) in v2.items()}
    spec = {k: (draw[k], direction) for k, (_, direction) in v2.items()}
    rr = dict(zip(codes, ranks(scores(spec))))
    for c in owner:
        hits[c] += rr[c] <= 15
print('top-15 draws', hits)
