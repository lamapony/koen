import "./styles.css";
import { loadAll, loadKK } from "./data";
import { ctx, recomputeIndex, recomputeMode } from "./ctx";
import { initState, state, set, subscribe, writeHash, type State } from "./state";
import { setLang, t, lang } from "./i18n";
import type { MapController } from "./map/map";
import { renderMasthead, renderModes, renderLegend, renderFooter, fmtModeValue } from "./ui/chrome";
import { renderCard } from "./ui/card";
// Secondary views load on first use, so the first chunk carries only the shell (docs/review/lighthouse.md).
const panels = () => import("./ui/panels");
const explorerMod = () => import("./explorer/explorer");
let explorer: Awaited<ReturnType<typeof explorerMod>> | null = null;
const showMethod = (): void => void panels().then((m) => m.showMethod());
const showSources = (): void => void panels().then((m) => m.showSources());
/** Run fn with the Explorer module; loads it the first time the Explorer opens. */
function withExplorer(fn: (m: NonNullable<typeof explorer>) => void): void {
  if (explorer) fn(explorer);
  else if (state.explorer) explorerMod().then((m) => ((explorer = m), fn(m)));
}
import { $, esc, announce, toast } from "./ui/util";
import { num } from "./format";
import { installCampaignTracking } from "./funnel/utm";
import { MODES } from "./modes/modes";

const mobile = matchMedia("(max-width: 760px)").matches;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

async function boot(): Promise<void> {
  // MapLibre + deck.gl are most of the bytes: fetch that chunk in parallel with the data, not before it.
  const mapModule = import("./map/map");
  // h3-js (geometry) is the largest piece of app code; fetch it in parallel with the data too.
  const geoModule = import("./map/geometry");
  let d;
  try {
    d = await loadAll(mobile ? 6 : 7);
  } catch (e) {
    $("loading-text").textContent = t().loadError;
    console.error(e);
    return;
  }
  ctx.d = d;
  ctx.mobile = mobile;
  ctx.reducedMotion = reducedMotion;
  initState(d.meta.index.ids, d.meta.index.weights, {
    modes: new Set(MODES.map((m) => m.id)),
    indicators: new Set(d.meta.indicators.map((m) => m.id)),
    kommuner: new Set(d.kommuner.map((k) => k.kode)),
  });
  installCampaignTracking(() => state.mode);
  setLang(state.lang);
  applyTheme();
  const { buildGeo, setDelays } = await geoModule;
  ctx.geo = buildGeo(d);
  const originK = (state.k && d.byKode.get(state.k)) || d.byKode.get("0101")!;
  setDelays(ctx.geo, originK.centroid);
  recomputeIndex();
  recomputeMode();

  // Map labels use Plex Mono; make sure the font is ready before deck builds its atlas.
  await Promise.race([document.fonts.load('500 11px "IBM Plex Mono"'), new Promise((r) => setTimeout(r, 1500))]);

  const { createMap } = await mapModule;
  const mc = createMap($("map"), $("inset"), d, ctx.geo, { theme: state.theme, mobile, reducedMotion, cam: state.cam });
  mc.map.on("moveend", () => {
    const m = mc.map;
    const c = m.getCenter();
    state.cam = [c.lng.toFixed(4), c.lat.toFixed(4), m.getZoom().toFixed(2), m.getPitch().toFixed(0), m.getBearing().toFixed(0)].join(",");
    writeHash();
  });
  wire(mc);
  (window as unknown as { __koen: Record<string, unknown> }).__koen.map = mc.map;
  renderAll(mc);
  if (state.k) mc.setCardOpen(true, d.byKode.get(state.k)?.i);
  $("app").dataset.loading = "false";

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    mc.intro().then(() => (document.documentElement.dataset.ready = "1"));
  };
  let loadFired = false;
  mc.map.once("load", () => {
    loadFired = true;
    panels().then((m) => {
      const shown = m.maybeIntro(start, showMethod);
      if (!shown) start();
    }, start);
  });
  // If the basemap never loads (offline), still rise. map.loaded() is false while tiles stream,
  // which used to start the rise behind an open intro dialog, so track the load event instead.
  setTimeout(() => {
    if (!loadFired) start();
  }, 4000);
}

function applyTheme(): void {
  document.documentElement.dataset.theme = state.theme;
  document.body.dataset.theme = state.theme;
}

function labelsFor(): { k: number; text: string }[] {
  const m = ctx.mode;
  if (state.mode === "maalt") return [];
  const n = mobile ? 4 : 8;
  const ranked = m.values
    .map((v, i) => [v, i] as const)
    .filter(([v]) => v !== null)
    .sort((a, b) => (b[0] as number) - (a[0] as number));
  // The top of the ranking sits in the Copenhagen suburbs, so collision used to leave one label and no way to
  // find the big cities. Order for collision (earlier entries win): the no. 1, then the four largest cities as
  // reference points, then the rest of the top n. Every label carries its rank so readers can compare.
  const REF = ["0101", "0751", "0461", "0851"];
  const isRef = (i: number) => REF.includes(ctx.d.kommuner[i].kode);
  const refs = ranked.filter(([, i], r) => r > 0 && isRef(i));
  const rest = ranked.slice(1, n).filter(([, i]) => !isRef(i));
  const rankOf = new Map(ranked.map(([, i], r) => [i, r + 1]));
  return [...ranked.slice(0, 1), ...refs, ...rest].map(([v, i]) => ({
    k: i,
    text: `${rankOf.get(i)}. ${ctx.d.kommuner[i].navn.toUpperCase()}  ▲ ${shortVal(v as number)}`,
  }));
}

function shortVal(v: number): string {
  const m = ctx.mode;
  if (state.mode === "koetryk") return num(v, 2);
  if (state.mode === "usikkerhed") return `${num(v, 0)} pp`;
  if (m.unit === "kr.") return `${num(v / 1e6, 2)} mio.`;
  if (m.unit === "boliger" || m.unit === "personer") return num(v, 0);
  if (m.unit === "%") return `${num(v, 1)} %`;
  return num(v, m.dec);
}

let kkData: GeoJSON.FeatureCollection | null = null;

function renderMap(mc: MapController): void {
  const d = ctx.d;
  const kIdx = state.k ? d.byKode.get(state.k)?.i ?? -1 : -1;
  const hIdx = state.hover ? d.byKode.get(state.hover)?.i ?? -1 : -1;
  const brushed = new Set([...state.brushed].map((k) => d.byKode.get(k)?.i ?? -1).filter((i) => i >= 0));
  let flows: { from: number; to: number; v: number; dir: "in" | "out" }[] = [];
  const focus = kIdx >= 0 ? kIdx : hIdx;
  if (state.mode === "flyt" && focus >= 0) {
    const rows = d.flows.rows;
    flows = [
      ...rows.filter((r) => r[0] === focus).sort((a, b) => b[2] - a[2]).slice(0, 8).map((r) => ({ from: r[0], to: r[1], v: r[2], dir: "out" as const })),
      ...rows.filter((r) => r[1] === focus).sort((a, b) => b[2] - a[2]).slice(0, 8).map((r) => ({ from: r[0], to: r[1], v: r[2], dir: "in" as const })),
    ];
  }
  if ((state.mode === "almen") && !kkData && d.measured.kk) {
    loadKK().then((g) => ((kkData = g), renderMap(mc)));
  }
  mc.render({
    theme: state.theme,
    modeId: state.mode,
    rank: ctx.mode.rank,
    labels: labelsFor(),
    hover: hIdx,
    selected: kIdx,
    brushed,
    flows,
    kk: state.mode === "almen" ? kkData : null,
    needles: state.mode === "maalt" ? d.measured.aarhusbolig.points : null,
    needleLabel,
    reducedMotion,
  });
}

const needleLabel = (p: { postnummer: string; maxList: number }) => `${p.postnummer}  ▲ ${num(p.maxList)}`;

function renderAll(mc: MapController): void {
  renderMasthead();
  renderModes();
  renderLegend(showMethod, showSources);
  renderFooter();
  renderCard();
  withExplorer((m) => m.renderExplorer());
  renderMap(mc);
  $("skip-link").textContent = t().skip;
  wireMasthead(mc);
}

function wireMasthead(mc: MapController): void {
  $("btn-method")!.onclick = showMethod;
  $("btn-sources")!.onclick = showSources;
  $("btn-tour")!.onclick = () => void import("./ui/tour").then((m) => m.startTour(mc));
}

function wire(mc: MapController): void {
  const tip = $("tooltip");
  mc.onPick((k, info, kind) => {
    const kode = k === null ? null : ctx.d.kommuner[k].kode;
    if (kind === "hover") {
      if (state.hover !== kode) set({ hover: kode });
      if (kode && info && !mobile) {
        const km = ctx.d.kommuner[k!];
        const [name] = t().modes[state.mode];
        tip.hidden = false;
        tip.style.left = `${info.x}px`;
        tip.style.top = `${info.y}px`;
        const v = ctx.mode.values[k!];
        tip.innerHTML = `<b>${esc(km.navn)}</b><span class="v">${esc(name)}: ${esc(fmtModeValue(v))}</span>`;
      } else tip.hidden = true;
    } else {
      set({ k: kode });
    }
  });
  mc.onTip((layer, obj, at) => {
    if (!layer || !at || mobile) return;
    const da = lang() === "da";
    let html = "";
    if (layer === "kk") {
      const p = (obj as GeoJSON.Feature).properties ?? {};
      html = `<b>${esc(p.afd)}</b><span class="v">${esc(p.sel)} · ${num(p.tot)} ${da ? "almene boliger" : "social dwellings"}</span><span class="v">${da ? "Københavns Kommune, Open Data DK" : "City of Copenhagen, Open Data DK"}</span>`;
    } else {
      const p = obj as { postnummer: string; by: string; maxList: number; lists: number; signups: number; afdelinger: number };
      html = `<b>${esc(p.postnummer)} ${esc(p.by)}</b><span class="v">${esc(t().card.measuredLongest(num(p.maxList)))}</span><span class="v">${num(p.lists)} ${da ? "lister" : "lists"} · ${num(p.afdelinger)} ${da ? "afdelinger" : "estates"} · Aarhusbolig</span>`;
    }
    tip.hidden = false;
    tip.style.left = `${at.x}px`;
    tip.style.top = `${at.y}px`;
    tip.innerHTML = html;
  });
  $("map").addEventListener("mouseleave", () => {
    tip.hidden = true;
    if (state.hover) set({ hover: null });
  });
  $("map").addEventListener("tiles-error", () => toast(t().tilesError), { once: true });
  // The table only exists once the Explorer is open, and a plain #explorer-table jump would wipe the permalink hash.
  $("skip-link").addEventListener("click", (e) => {
    e.preventDefault();
    // The Explorer module loads on first use, so wait (up to about 3 s) for the table to exist.
    let tries = 0;
    const focusTable = (): void => {
      const tbl = document.getElementById("explorer-table");
      if (tbl) tbl.focus();
      else if (tries++ < 180) requestAnimationFrame(focusTable);
    };
    if (state.explorer !== "table") set({ explorer: "table" });
    requestAnimationFrame(focusTable);
  });
  $("inset").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      set({ k: "0400" });
    }
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !(e.target as HTMLElement).closest?.(".panel,.intro")) {
      if (state.k) set({ k: null });
      else if (state.explorer) set({ explorer: "" });
    }
  });

  subscribe((s: State, ch) => {
    if (ch.has("lang")) {
      setLang(s.lang);
      renderAll(mc);
      return;
    }
    if (ch.has("theme")) {
      applyTheme();
      mc.setTheme(s.theme);
      renderMasthead();
      wireMasthead(mc);
    }
    if (ch.has("w")) recomputeIndex();
    if (ch.has("w") || ch.has("mode") || ch.has("alt")) recomputeMode();
    if (ch.has("mode")) {
      renderModes();
      announce(t().announce.mode(t().modes[s.mode][0]));
    }
    if (ch.has("mode") || ch.has("alt") || ch.has("w") || ch.has("theme")) renderLegend(showMethod, showSources);
    if (ch.has("k") || ch.has("w") || ch.has("lang")) {
      renderCard();
      if (ch.has("k")) mc.setCardOpen(!!s.k, s.k ? ctx.d.byKode.get(s.k)?.i : undefined);
      if (ch.has("k") && s.k) {
        const k = ctx.d.byKode.get(s.k)!;
        announce(t().announce.selected(k.navn, `${t().modelled} ${num(ctx.koetryk[k.i], 2)}`));
        if (mobile && s.explorer) set({ explorer: "" });
      }
    }
    if (ch.has("explorer")) withExplorer((m) => m.renderExplorer());
    else if (ch.has("w") && s.explorer === "weights") withExplorer((m) => m.rerenderWeightsKeepFocus());
    else if (ch.has("x") || ch.has("y") || ch.has("cols") || ch.has("sort") || ch.has("brushed") || ch.has("w") || ch.has("theme") || (ch.has("k") && s.explorer === "scatter")) withExplorer((m) => m.renderBody());
    else if (ch.has("hover") || ch.has("k")) withExplorer((m) => m.syncTableHighlight());
    renderMap(mc);
  });
}

boot();

// Exposed for screenshots and debugging only.
(window as unknown as { __koen: unknown }).__koen = {
  get state() {
    return state; // live binding: state is only created in boot()
  },
  set,
  ctx,
  lang,
};
