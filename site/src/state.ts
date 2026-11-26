// App state with permalink sync: #mode=koetryk&k=0101&x=B1&y=P2&w=30,20,10,10,10,10,10&e=table&l=en
export interface State {
  mode: string;
  alt: boolean;
  k: string | null; // selected kommune
  hover: string | null;
  brushed: Set<string>;
  x: string;
  y: string;
  w: Record<string, number>; // weights in percent units (not normalised)
  explorer: "" | "table" | "scatter" | "weights";
  lang: "da" | "en";
  theme: "day" | "night";
  cols: string[];
  sort: [string, 1 | -1];
  cam: string; // "lng,lat,zoom,pitch,bearing" or ""
}

type Listener = (s: State, changed: Set<keyof State>) => void;

const listeners: Listener[] = [];
export let state: State;
let defaultW: Record<string, number> = {};
let indexIds: string[] = [];

export function initState(ids: string[], weights: Record<string, number>): State {
  indexIds = ids;
  defaultW = Object.fromEntries(ids.map((i) => [i, Math.round(weights[i] * 100)]));
  state = {
    mode: "koetryk",
    alt: false,
    k: null,
    hover: null,
    brushed: new Set(),
    x: "B1",
    y: "P2",
    w: { ...defaultW },
    explorer: "",
    lang: "da",
    theme: matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day",
    cols: ["B1", "P2", "D4", "D2"],
    sort: ["koetryk", -1],
    cam: "",
  };
  readHash();
  return state;
}

export function defaultWeights(): Record<string, number> {
  return { ...defaultW };
}

export function subscribe(l: Listener): void {
  listeners.push(l);
}

let pending: Set<keyof State> | null = null;
export function set(patch: Partial<State>): void {
  const changed = new Set<keyof State>();
  for (const [k, v] of Object.entries(patch) as [keyof State, unknown][]) {
    if (state[k] !== v) {
      (state as unknown as Record<string, unknown>)[k] = v;
      changed.add(k);
    }
  }
  if (!changed.size) return;
  if (pending) {
    changed.forEach((c) => pending!.add(c));
    return;
  }
  pending = changed;
  queueMicrotask(() => {
    const c = pending!;
    pending = null;
    for (const l of listeners) l(state, c);
    writeHash();
  });
}

function readHash(): void {
  const p = new URLSearchParams(location.hash.slice(1));
  const mode = p.get("mode");
  if (mode) state.mode = mode;
  if (p.get("alt") === "1") state.alt = true;
  const k = p.get("k");
  if (k && /^\d{4}$/.test(k)) state.k = k;
  if (p.get("x")) state.x = p.get("x")!;
  if (p.get("y")) state.y = p.get("y")!;
  const w = p.get("w");
  if (w) {
    const parts = w.split(",").map(Number);
    if (parts.length === indexIds.length && parts.every((n) => Number.isFinite(n) && n >= 0)) {
      state.w = Object.fromEntries(indexIds.map((id, i) => [id, parts[i]]));
    }
  }
  const e = p.get("e");
  if (e === "table" || e === "scatter" || e === "weights") state.explorer = e;
  if (p.get("l") === "en") state.lang = "en";
  if (p.get("t") === "night") state.theme = "night";
  if (p.get("t") === "day") state.theme = "day";
  const cam = p.get("c");
  if (cam && cam.split(",").length === 5 && cam.split(",").every((x) => Number.isFinite(Number(x)))) state.cam = cam;
  const b = p.get("b");
  if (b) state.brushed = new Set(b.split(",").filter((s) => /^\d{4}$/.test(s)));
}

export function permalink(): string {
  const p = new URLSearchParams();
  p.set("mode", state.mode);
  if (state.alt) p.set("alt", "1");
  if (state.k) p.set("k", state.k);
  if (state.x !== "B1" || state.y !== "P2" || state.explorer === "scatter") {
    p.set("x", state.x);
    p.set("y", state.y);
  }
  const wd = indexIds.some((id) => state.w[id] !== defaultW[id]);
  if (wd) p.set("w", indexIds.map((id) => state.w[id]).join(","));
  if (state.explorer) p.set("e", state.explorer);
  if (state.lang === "en") p.set("l", "en");
  if (state.theme === "night") p.set("t", "night");
  if (state.brushed.size) p.set("b", [...state.brushed].join(","));
  if (state.cam) p.set("c", state.cam);
  return p.toString();
}

export function writeHash(): void {
  const h = permalink();
  if (location.hash.slice(1) !== h) history.replaceState(null, "", `#${h}`);
}
