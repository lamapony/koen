// Client-side Køtryk, mirrors pipeline/30_index.py so the weight sliders are exact.
import type { Kommune } from "./data";

export function combine(kommuner: Kommune[], ids: string[], weights: Record<string, number>): number[] {
  return kommuner.map((k) => {
    let s = 0;
    let ws = 0;
    for (const id of ids) {
      const z = k.z[id];
      const w = weights[id] ?? 0;
      if (z !== null && z !== undefined && w > 0) {
        s += w * z;
        ws += w;
      }
    }
    return ws ? s / ws : 0;
  });
}

/** Percentile rank in [0, 1], ties averaged; nulls stay null. */
export function pctRank(xs: (number | null)[]): (number | null)[] {
  const idx = xs.map((v, i) => [v, i] as const).filter(([v]) => v !== null && Number.isFinite(v)) as [number, number][];
  idx.sort((a, b) => a[0] - b[0]);
  const n = idx.length;
  const out: (number | null)[] = xs.map(() => null);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
    const r = n > 1 ? (i + j) / 2 / (n - 1) : 0.5;
    for (let t = i; t <= j; t++) out[idx[t][1]] = r;
    i = j + 1;
  }
  return out;
}

export function koetryk(kommuner: Kommune[], ids: string[], weights: Record<string, number>): number[] {
  return pctRank(combine(kommuner, ids, weights)) as number[];
}

export function weightsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const sa = Object.values(a).reduce((x, y) => x + y, 0) || 1;
  const sb = Object.values(b).reduce((x, y) => x + y, 0) || 1;
  return Object.keys(b).every((k) => Math.abs((a[k] ?? 0) / sa - b[k] / sb) < 1e-6);
}

/** Quantile breaks (7 classes) for legends. */
export function quantileBreaks(values: (number | null)[], classes = 7): number[] {
  const v = values.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (!v.length) return [];
  const out: number[] = [];
  for (let c = 0; c <= classes; c++) {
    const pos = (c / classes) * (v.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    out.push(v[lo] + (v[hi] - v[lo]) * (pos - lo));
  }
  return out;
}
