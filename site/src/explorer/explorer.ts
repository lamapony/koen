// Explorer: table (keyboard equivalent of the map), scatter with linked brushing, weight sliders, CSV, permalink.
import { ctx, koetrykRanks } from "../ctx";
import { t, label, lang, to } from "../i18n";
import { state, set, defaultWeights, permalink } from "../state";
import { num, withUnit } from "../format";
import { $, esc, icon, toast, sparkline } from "../ui/util";
import { THEME, rampColor, css } from "../map/palette";
import { pctRank, koetryk as computeKoetryk } from "../model";
import { unitLabel } from "../ui/chrome";
import { loadHistory, type History } from "../data";

let history: History | null = null;

export function renderExplorer(): void {
  const el = $("explorer");
  const btn = document.getElementById("btn-explorer");
  btn?.setAttribute("aria-expanded", state.explorer ? "true" : "false");
  btn?.setAttribute("aria-pressed", state.explorer ? "true" : "false");
  if (!state.explorer) {
    el.hidden = true;
    return;
  }
  if (!history) loadHistory().then((h) => ((history = h), state.explorer === "table" && renderBody()));
  const c = t().explorerUi;
  el.hidden = false;
  el.setAttribute("aria-label", c.title);
  const tab = (id: string, name: string) =>
    `<button role="tab" type="button" id="tab-${id}" aria-selected="${state.explorer === id}" aria-controls="ex-pane" data-tab="${id}">${esc(name)}</button>`;
  el.innerHTML = `
    <div class="ex-head">
      <h2>${esc(c.title)}</h2>
      <div class="tabs" role="tablist">${tab("table", c.tableTab)}${tab("scatter", c.scatterTab)}${tab("weights", c.weightsTab)}</div>
      <span class="spacer"></span>
      <span id="ex-brushinfo" class="caps" style="color:var(--graa)"></span>
      <button class="btn" type="button" id="ex-share">${icon.link}<span>${esc(t().share)}</span></button>
      <button class="btn" type="button" id="ex-csv">${icon.download}<span>${esc(t().csv)}</span></button>
      <button class="btn icon" type="button" id="ex-close" aria-label="${esc(t().explorerClose)}">${icon.close}</button>
    </div>
    <div class="ex-body"><div class="ex-pane" id="ex-pane" role="tabpanel" aria-labelledby="tab-${state.explorer}"></div></div>`;
  el.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => (b.onclick = () => set({ explorer: b.dataset.tab as typeof state.explorer })));
  $("ex-close").onclick = () => set({ explorer: "" });
  $("ex-share").onclick = async () => {
    const url = `${location.origin}${location.pathname}#${permalink()}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard may be blocked; the URL is in the address bar anyway */
    }
    toast(t().copied);
  };
  $("ex-csv").onclick = downloadCsv;
  renderBody();
}

export function renderBody(): void {
  if (!state.explorer) return;
  const pane = document.getElementById("ex-pane");
  if (!pane) return;
  const info = document.getElementById("ex-brushinfo");
  if (info) info.textContent = state.brushed.size ? t().explorerUi.selected(state.brushed.size) : "";
  if (state.explorer === "table") renderTable(pane);
  else if (state.explorer === "scatter") renderScatter(pane);
  else renderWeights(pane);
}

/* ---------- Table ---------- */

function cell(id: string, k: (typeof ctx.d.kommuner)[number]): string {
  const m = ctx.d.ind.get(id)!;
  const v = k.ind[id];
  return v === null ? `<span class="nd">${esc(t().noData)}</span>` : esc(num(v, m.dec));
}

function renderTable(pane: HTMLElement): void {
  const c = t().explorerUi;
  const d = ctx.d;
  const T = THEME[state.theme];
  const ranks = koetrykRanks();
  const [sk, sdir] = state.sort;
  const val = (k: (typeof d.kommuner)[number]): number | string | null =>
    sk === "navn" ? k.navn : sk === "koetryk" ? ctx.koetryk[k.i] : sk === "band" ? k.koetrykBand[1] - k.koetrykBand[0] : k.ind[sk] ?? null;
  const rows = [...d.kommuner].sort((a, b) => {
    const va = val(a), vb = val(b);
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === "string") return va.localeCompare(vb as string, "da") * sdir;
    return ((va as number) - (vb as number)) * sdir;
  });
  const th = (id: string, name: string, title = name) => {
    const sorted = sk === id;
    return `<th scope="col" ${sorted ? `aria-sort="${sdir === 1 ? "ascending" : "descending"}"` : ""}><button type="button" data-sort="${id}" title="${esc(c.sortBy(title))}">${esc(name)}</button></th>`;
  };
  const cols = state.cols.filter((id) => d.ind.has(id));
  const unitHint = (id: string) => {
    const m = d.ind.get(id)!;
    return m.unit ? ` (${unitLabel(m.unit)})` : "";
  };
  const options = d.meta.indicators.filter((m) => !cols.includes(m.id)).map((m) => `<option value="${m.id}">${esc(label(m))}</option>`).join("");
  pane.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--graa-line);flex-wrap:wrap">
      <label class="colpick">${esc(c.addColumn)} <select class="sel" id="addcol"><option value="">…</option>${options}</select></label>
      <span class="caps" style="color:var(--graa)">${esc(c.trend)}: ${esc(lang() === "da" ? "befolkning" : "population")} ${history?.POP ? `${history.POP.periods[0].slice(0, 4)} ${to()} ${history.POP.periods.at(-1)!.slice(0, 4)}` : ""}</span>
    </div>
    <table class="kt" id="explorer-table">
      <caption class="sr-only">${esc(c.title)}</caption>
      <thead><tr><th scope="col"><span class="sr-only">#</span></th>${th("navn", c.kommune)}${th("koetryk", c.koetryk + " · " + t().modelled)}${th("band", c.band)}${cols
        .map((id) => th(id, `${id}${unitHint(id)}`, label(d.ind.get(id)!)))
        .join("")}<th scope="col"><span style="display:block;padding:8px 10px;font-family:var(--f-mono);font-size:12px">${esc(c.trend.toUpperCase())}</span></th></tr></thead>
      <tbody>${rows
        .map((k) => {
          const kt = ctx.koetryk[k.i];
          const cls = [state.k === k.kode ? "sel" : "", state.hover === k.kode ? "hl" : "", state.brushed.has(k.kode) ? "br" : ""].join(" ");
          const spark = history?.POP ? sparkline(history.POP.values[k.kode] ?? [], 64, 16) : "";
          return `<tr data-k="${k.kode}" class="${cls}"><td>${ranks[k.i]}</td>
            <td class="name"><button type="button" data-select="${k.kode}" aria-label="${esc(c.rowSelect(k.navn))}">${esc(k.navn)}</button></td>
            <td><span class="kt-pill"><i style="left:0;width:${kt * 100}%;background:${css(rampColor(T.ramp, kt))}"></i></span>${num(kt, 2)}</td>
            <td>${ctx.customWeights ? "" : `${num(k.koetrykBand[0], 2)} ${to()} ${num(k.koetrykBand[1], 2)}`}</td>
            ${cols.map((id) => `<td>${cell(id, k)}</td>`).join("")}<td>${spark}</td></tr>`;
        })
        .join("")}</tbody>
    </table>`;
  pane.querySelectorAll<HTMLButtonElement>("[data-sort]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.sort!;
      set({ sort: [id, state.sort[0] === id ? ((-state.sort[1]) as 1 | -1) : id === "navn" ? 1 : -1] });
    };
  });
  pane.querySelectorAll<HTMLButtonElement>("[data-select]").forEach((b) => (b.onclick = () => set({ k: b.dataset.select! })));
  pane.querySelectorAll<HTMLTableRowElement>("tr[data-k]").forEach((tr) => {
    tr.onmouseenter = () => set({ hover: tr.dataset.k! });
    tr.onmouseleave = () => state.hover === tr.dataset.k && set({ hover: null });
  });
  const add = $("addcol") as HTMLSelectElement;
  add.onchange = () => add.value && set({ cols: [...state.cols, add.value].slice(-6) });
  if (state.k) pane.querySelector(`tr[data-k="${state.k}"]`)?.scrollIntoView({ block: "nearest" });
}

/** Light update: highlight classes without rebuilding the table. */
export function syncTableHighlight(): void {
  document.querySelectorAll<HTMLTableRowElement>("#explorer-table tr[data-k]").forEach((tr) => {
    tr.classList.toggle("hl", state.hover === tr.dataset.k);
    tr.classList.toggle("sel", state.k === tr.dataset.k);
  });
  document.querySelectorAll<SVGCircleElement>("#scatter circle.dot").forEach((c) => {
    c.classList.toggle("hl", state.hover === c.dataset.k || state.k === c.dataset.k);
  });
}

/* ---------- Scatter ---------- */

function renderScatter(pane: HTMLElement): void {
  const c = t().explorerUi;
  const d = ctx.d;
  const T = THEME[state.theme];
  const opts = (sel: string) =>
    d.meta.indicators.map((m) => `<option value="${m.id}" ${m.id === sel ? "selected" : ""}>${esc(label(m))}</option>`).join("");
  pane.innerHTML = `<div class="scatter-wrap">
      <div class="scatter" id="scatter-box" style="position:relative;min-height:0"></div>
      <div class="scatter-side">
        <label>${esc(c.x)}<select class="sel" id="sx">${opts(state.x)}</select></label>
        <label>${esc(c.y)}<select class="sel" id="sy">${opts(state.y)}</select></label>
        <span style="color:var(--graa)">${esc(c.size)}</span>
        <span style="color:var(--blaek-2)">${esc(c.brushHint)}</span>
        <button class="btn" type="button" id="clear-brush" ${state.brushed.size ? "" : "disabled"}>${esc(c.clearBrush)}</button>
      </div></div>`;
  ($("sx") as HTMLSelectElement).onchange = (e) => set({ x: (e.target as HTMLSelectElement).value });
  ($("sy") as HTMLSelectElement).onchange = (e) => set({ y: (e.target as HTMLSelectElement).value });
  $("clear-brush").onclick = () => set({ brushed: new Set() });

  const box = $("scatter-box");
  const W = Math.max(320, box.clientWidth || 600);
  const H = Math.max(200, box.clientHeight || 300);
  const P = { l: 58, r: 18, t: 16, b: 38 };
  const mx = d.ind.get(state.x)!, my = d.ind.get(state.y)!;
  const pts = d.kommuner.map((k) => ({ k, x: k.ind[state.x], y: k.ind[state.y], p: k.ind.POP ?? 0 })).filter((p) => p.x !== null && p.y !== null) as { k: (typeof d.kommuner)[number]; x: number; y: number; p: number }[];
  const ext = (a: number[]) => {
    const lo = Math.min(...a), hi = Math.max(...a), pad = (hi - lo) * 0.06 || 1;
    return [lo - pad, hi + pad];
  };
  const [x0, x1] = ext(pts.map((p) => p.x));
  const [y0, y1] = ext(pts.map((p) => p.y));
  const sx = (v: number) => P.l + ((v - x0) / (x1 - x0)) * (W - P.l - P.r);
  const sy = (v: number) => H - P.b - ((v - y0) / (y1 - y0)) * (H - P.t - P.b);
  const maxPop = Math.max(...pts.map((p) => p.p));
  const ticks = (a: number, b: number) => Array.from({ length: 5 }, (_, i) => a + ((b - a) * (i + 0.5)) / 5);
  const tickFmt = (v: number, dec: number) => num(v, Math.abs(v) >= 1000 ? 0 : Math.min(dec, 1));
  const order = [...pts].sort((a, b) => b.p - a.p);
  box.innerHTML = `<svg id="scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label(mx))} / ${esc(label(my))}">
    ${ticks(x0, x1).map((v) => `<line x1="${sx(v)}" x2="${sx(v)}" y1="${P.t}" y2="${H - P.b}" stroke="var(--graa-line)"/><text x="${sx(v)}" y="${H - P.b + 14}" text-anchor="middle">${tickFmt(v, mx.dec)}</text>`).join("")}
    ${ticks(y0, y1).map((v) => `<line x1="${P.l}" x2="${W - P.r}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--graa-line)"/><text x="${P.l - 6}" y="${sy(v) + 3}" text-anchor="end">${tickFmt(v, my.dec)}</text>`).join("")}
    <text x="${W - P.r}" y="${H - 6}" text-anchor="end" style="fill:var(--blaek-2)">${esc(label(mx))} →</text>
    <text x="${P.l}" y="${P.t - 4}" style="fill:var(--blaek-2)">↑ ${esc(label(my))}</text>
    ${order
      .map(({ k, x, y, p }) => {
        const r = 2.5 + Math.sqrt(p / maxPop) * 14;
        const cls = ["dot", state.hover === k.kode || state.k === k.kode ? "hl" : "", state.brushed.size && !state.brushed.has(k.kode) ? "dim" : ""].join(" ");
        return `<circle class="${cls}" data-k="${k.kode}" cx="${sx(x).toFixed(1)}" cy="${sy(y).toFixed(1)}" r="${r.toFixed(1)}" fill="${css(rampColor(T.ramp, ctx.koetryk[k.i]), 0.9)}"><title>${esc(k.navn)}: ${esc(withUnit(x, unitLabel(mx.unit), mx.dec))}, ${esc(withUnit(y, unitLabel(my.unit), my.dec))}</title></circle>`;
      })
      .join("")}
    ${order
      .filter(({ k }) => state.brushed.has(k.kode) || state.k === k.kode || k.ind.POP! > 150000)
      .map(({ k, x, y }) => `<text x="${sx(x) + 8}" y="${sy(y) - 6}" style="fill:var(--blaek);font-size:10.5px">${esc(k.navn)}</text>`)
      .join("")}
    <rect class="brush" id="brush" x="0" y="0" width="0" height="0" visibility="hidden"/>
  </svg>`;

  const svg = box.querySelector("svg")!;
  const toSvg = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  let start: number[] | null = null;
  const brush = svg.querySelector<SVGRectElement>("#brush")!;
  svg.addEventListener("pointerdown", (e) => {
    const target = e.target as SVGElement;
    if (target.classList.contains("dot")) return;
    start = toSvg(e);
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", (e) => {
    const target = e.target as SVGElement;
    if (!start) {
      const k = target.classList.contains("dot") ? target.dataset.k! : null;
      if (k !== state.hover) set({ hover: k });
      return;
    }
    const p = toSvg(e);
    brush.setAttribute("x", String(Math.min(start[0], p[0])));
    brush.setAttribute("y", String(Math.min(start[1], p[1])));
    brush.setAttribute("width", String(Math.abs(p[0] - start[0])));
    brush.setAttribute("height", String(Math.abs(p[1] - start[1])));
    brush.setAttribute("visibility", "visible");
  });
  svg.addEventListener("pointerup", (e) => {
    if (!start) return;
    const p = toSvg(e);
    const [ax, bx] = [Math.min(start[0], p[0]), Math.max(start[0], p[0])];
    const [ay, by] = [Math.min(start[1], p[1]), Math.max(start[1], p[1])];
    start = null;
    if (bx - ax < 4 && by - ay < 4) {
      brush.setAttribute("visibility", "hidden");
      return;
    }
    const sel = new Set(pts.filter((q) => sx(q.x) >= ax && sx(q.x) <= bx && sy(q.y) >= ay && sy(q.y) <= by).map((q) => q.k.kode));
    set({ brushed: sel });
  });
  svg.addEventListener("pointerleave", () => state.hover && set({ hover: null }));
  svg.querySelectorAll<SVGCircleElement>("circle.dot").forEach((cEl) => (cEl.onclick = () => set({ k: cEl.dataset.k! })));
}

/* ---------- Weights ---------- */

function renderWeights(pane: HTMLElement): void {
  const c = t().explorerUi;
  const d = ctx.d;
  const ids = d.meta.index.ids;
  const total = ids.reduce((s, id) => s + state.w[id], 0) || 1;
  const def = defaultWeights();
  const defaultK = computeKoetryk(d.kommuner, ids, def);
  const defRanks = pctRank(defaultK);
  const top = d.kommuner.map((k) => k).sort((a, b) => ctx.koetryk[b.i] - ctx.koetryk[a.i]).slice(0, 10);
  const defOrder = [...d.kommuner].sort((a, b) => (defRanks[b.i] ?? 0) - (defRanks[a.i] ?? 0)).map((k) => k.kode);
  pane.innerHTML = `<div class="weights">
    <div>
      <p>${esc(c.weightsIntro)} ${esc(c.weightsSum)}</p>
      ${ids
        .map((id) => {
          const m = d.ind.get(id)!;
          const pct = Math.round((state.w[id] / total) * 100);
          return `<div class="wrow"><label for="w-${id}">${esc(label(m))}<span class="dir">${m.dir === -1 ? (lang() === "da" ? "trækker ned" : "lowers") : ""}</span></label>
            <input type="range" id="w-${id}" data-w="${id}" min="0" max="50" step="1" value="${state.w[id]}" aria-valuetext="${pct} %"/>
            <output for="w-${id}">${pct} %</output></div>`;
        })
        .join("")}
      <div style="margin-top:12px"><button class="btn" type="button" id="w-reset">${esc(t().reset)}</button></div>
    </div>
    <div class="wtop"><div class="caps" style="color:var(--graa)">Top 10 · ${esc(t().modelled)}</div>
      <ol>${top
        .map((k, i) => {
          const was = defOrder.indexOf(k.kode) + 1;
          const delta = was - (i + 1);
          return `<li><button type="button" class="linklike" data-select="${k.kode}" style="all:unset;cursor:pointer;font-weight:600">${esc(k.navn)}</button><span class="delta">${num(ctx.koetryk[k.i], 2)}${delta ? ` · ${delta > 0 ? "▲" : "▼"}${Math.abs(delta)}` : ""}</span></li>`;
        })
        .join("")}</ol>
    </div></div>`;
  pane.querySelectorAll<HTMLInputElement>("[data-w]").forEach((inp) => {
    inp.oninput = () => set({ w: { ...state.w, [inp.dataset.w!]: Number(inp.value) } });
  });
  pane.querySelectorAll<HTMLButtonElement>("[data-select]").forEach((b) => (b.onclick = () => set({ k: b.dataset.select! })));
  $("w-reset").onclick = () => set({ w: defaultWeights() });
}

/** Keep slider focus while re-rendering on input. */
export function rerenderWeightsKeepFocus(): void {
  const active = document.activeElement as HTMLInputElement | null;
  const id = active?.dataset?.w;
  renderBody();
  if (id) (document.getElementById(`w-${id}`) as HTMLInputElement | null)?.focus();
}

/* ---------- CSV ---------- */

function downloadCsv(): void {
  const d = ctx.d;
  const ids = d.meta.indicators.map((m) => m.id);
  const head = ["kode", "navn", "region", "koetryk_modelleret", "koetryk_band_min", "koetryk_band_max", ...ids];
  const q = (s: unknown) => {
    const v = s === null || s === undefined ? "" : String(s);
    return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lines = [
    `# Køen. Kilde: Danmarks Statistik (CC 4.0 BY), egne beregninger. Køtryk er modelleret, ikke antal personer i kø. Tom celle = ingen åbne data. Indikatorer: ${d.meta.indicators.map((m) => `${m.id}=${m.da} (${m.tables.join("+")}, ${m.period})`).join("; ")}`,
    ctx.customWeights ? `# Egne vægte: ${d.meta.index.ids.map((i) => `${i}=${state.w[i]}`).join(", ")}` : `# Standardvægte`,
    head.join(","),
    ...d.kommuner.map((k) =>
      [k.kode, k.navn, k.region, ctx.koetryk[k.i].toFixed(4), ctx.customWeights ? "" : k.koetrykBand[0], ctx.customWeights ? "" : k.koetrykBand[1], ...ids.map((id) => k.ind[id])].map(q).join(","),
    ),
  ];
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "koen-kommuner.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
