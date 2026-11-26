// Shared derived state: current Køtryk (with the visitor's weights) and the active mode result.
import type { AppData } from "./data";
import type { Geo } from "./map/geometry";
import { koetryk, weightsEqual } from "./model";
import { MODE_BY_ID, MODES, type ModeDef, type ModeResult } from "./modes/modes";
import { state } from "./state";

export const ctx = {
  d: null as unknown as AppData,
  geo: null as unknown as Geo,
  koetryk: [] as number[],
  customWeights: false,
  mode: null as unknown as ModeResult,
  modeDef: MODES[0] as ModeDef,
  mobile: false,
  reducedMotion: false,
};

export function recomputeIndex(): void {
  const d = ctx.d;
  const def = Object.fromEntries(d.meta.index.ids.map((i) => [i, d.meta.index.weights[i]]));
  ctx.customWeights = !weightsEqual(state.w, def);
  ctx.koetryk = ctx.customWeights ? koetryk(d.kommuner, d.meta.index.ids, state.w) : d.kommuner.map((k) => k.koetryk);
}

export function recomputeMode(): void {
  ctx.modeDef = MODE_BY_ID.get(state.mode) ?? MODES[0];
  ctx.mode = ctx.modeDef.compute(ctx.d, { koetryk: ctx.koetryk, alt: state.alt });
}

/** 1-based rank of each kommune by current Køtryk (1 = highest). */
export function koetrykRanks(): number[] {
  const order = ctx.koetryk.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
  const r = new Array<number>(order.length);
  order.forEach(([, i], pos) => (r[i] = pos + 1));
  return r;
}
