// Loads the static data built by the pipeline (site/public/data). No runtime API calls.

export type IndicatorId = string;

export interface Indicator {
  id: IndicatorId;
  da: string;
  en: string;
  unit: string;
  dec: number;
  dir?: number;
  w?: number;
  kind: "measured" | "derived" | "projection";
  tables: string[];
  period: string;
  formula_da: string;
  formula_en: string;
  sources: { table: string; url: string; updated: string | null }[];
}

export interface MeasuredQueue {
  source: string;
  sourceUrl: string;
  observedAt: string;
  lists: number;
  peopleOnLists: number;
  maxList: number;
  postnumre: string[];
}

export interface Kommune {
  kode: string;
  navn: string;
  region: string;
  ind: Record<IndicatorId, number | null>;
  z: Record<IndicatorId, number | null>;
  koetryk: number;
  koetrykBand: [number, number];
  used: number;
  maalt?: MeasuredQueue[];
  // client-side
  i: number;
  centroid: [number, number];
}

export interface Meta {
  indicators: Indicator[];
  index: { ids: string[]; weights: Record<string, number>; loo: Record<string, number>; params: Record<string, number> };
}

export interface MeasuredPoint {
  postnummer: string;
  by: string;
  lat: number;
  lon: number;
  kode: string;
  lists: number;
  signups: number;
  maxList: number;
  afdelinger: number;
}

export interface Measured {
  aarhusbolig: {
    label_da: string;
    label_en: string;
    sourceUrl: string;
    licence: string;
    observedAt: string;
    fetchedAt: string;
    totals: { lists: number; signups: number; afdelinger: number; maxList: number };
    points: MeasuredPoint[];
    topAfdelinger: { navn: string; selskab: string; postnummer: string; lists: number; maxList: number; maxType: string }[];
  };
  kk: null | { label_da: string; label_en: string; sourceUrl: string; licence: string; features: number; dwellings: number };
  ventelistevalg: null;
}

export interface Flows {
  period: string;
  table: string;
  in: Record<string, number>;
  out: Record<string, number>;
  rows: [number, number, number][];
}

export interface Source {
  id: string;
  kind?: string;
  publisher?: string;
  title: string;
  url?: string;
  licence?: { name: string; url: string } | null;
  attribution?: string;
  period?: string;
  fetchedAt?: string | null;
  rows?: number | null;
  status: string;
  note?: string;
}

export interface Hexes {
  res: number;
  ids: string[];
  owner: Uint8Array;
}

export interface History {
  [id: string]: { periods: string[]; values: Record<string, (number | null)[]> };
}

const base = `${import.meta.env.BASE_URL}data/`;

async function json<T>(name: string): Promise<T> {
  const r = await fetch(base + name);
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export async function loadHexes(res: 6 | 7): Promise<Hexes> {
  const r = await fetch(`${base}hex${res}.bin`);
  if (!r.ok) throw new Error(`hex${res}.bin: HTTP ${r.status}`);
  const buf = await r.arrayBuffer();
  const dv = new DataView(buf);
  const n = dv.getUint32(0, true);
  const big = new BigUint64Array(buf, 8, n);
  const owner = new Uint8Array(buf, 8 + 8 * n, n);
  const ids = new Array<string>(n);
  for (let i = 0; i < n; i++) ids[i] = big[i].toString(16);
  return { res: dv.getUint8(4), ids, owner };
}

export interface AppData {
  kommuner: Kommune[];
  byKode: Map<string, Kommune>;
  meta: Meta;
  ind: Map<string, Indicator>;
  measured: Measured;
  flows: Flows;
  sources: Source[];
  hexes: Hexes;
  outlines: GeoJSON.FeatureCollection;
}

export async function loadAll(res: 6 | 7): Promise<AppData> {
  const [kommuner, meta, measured, flows, sources, hexes, outlines] = await Promise.all([
    json<Kommune[]>("kommuner.json"),
    json<Meta>("indicators.json"),
    json<Measured>("measured.json"),
    json<Flows>("flows.json"),
    json<{ sources: Source[] }>("sources.json"),
    loadHexes(res),
    json<GeoJSON.FeatureCollection>("kommuner.geojson"),
  ]);
  kommuner.forEach((k, i) => (k.i = i));
  return {
    kommuner,
    byKode: new Map(kommuner.map((k) => [k.kode, k])),
    meta,
    ind: new Map(meta.indicators.map((m) => [m.id, m])),
    measured,
    flows,
    sources: sources.sources,
    hexes,
    outlines,
  };
}

let historyPromise: Promise<History> | null = null;
export function loadHistory(): Promise<History> {
  historyPromise ??= json<History>("history.json");
  return historyPromise;
}

let kkPromise: Promise<GeoJSON.FeatureCollection> | null = null;
export function loadKK(): Promise<GeoJSON.FeatureCollection> {
  kkPromise ??= json<GeoJSON.FeatureCollection>("kk_almene.geojson");
  return kkPromise;
}
