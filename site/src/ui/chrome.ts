// Masthead, mode rail, legend and footer.
import { ctx } from "../ctx";
import { t, label, lang, to, period as per } from "../i18n";
import { state, set } from "../state";
import { MODES } from "../modes/modes";
import { THEME, rampColor, css } from "../map/palette";
import { quantileBreaks } from "../model";
import { num, withUnit } from "../format";
import { $, esc, icon } from "./util";
import { legendLink, footerLink, mastheadLink, FLAGS } from "../funnel/utm";
import { en } from "../copy/en";

export function fmtModeValue(v: number | null, m = ctx.mode, modeId = state.mode): string {
  if (v === null || v === undefined) return t().noData;
  if (modeId === "koetryk") return num(v, 2);
  if (modeId === "usikkerhed") return `${num(v, 0)} ${lang() === "da" ? "pp" : "pp"}`;
  if (modeId === "maalt") return withUnit(v, lang() === "da" ? "personer" : "people", 0);
  return withUnit(v, unitLabel(m.unit), m.dec);
}

export function unitLabel(u: string): string {
  if (lang() === "da") return u;
  return ({ voksne: "adults", personer: "people", boliger: "dwellings", "pr. 1.000": "per 1,000" } as Record<string, string>)[u] ?? u;
}

export function kindLabel(kind: string): string {
  const c = t();
  return ({ modelled: c.modelled, measured: c.measured, register: c.register, derived: c.derived, projection: c.projection, meta: c.meta } as Record<string, string>)[kind] ?? kind;
}

export function renderMasthead(): void {
  const c = t();
  $("masthead").innerHTML = `
    <div class="brand">
      <h1 class="wordmark" aria-label="Køen">K<span class="oe">ø<svg class="contour" viewBox="0 0 120 70" aria-hidden="true">
        <path d="M30 20 L54 -2 C70 -14, 96 -10, 118 -20" fill="none" stroke="var(--oxblod)" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M58 2 C76 -6, 98 -4, 118 -12" fill="none" stroke="var(--oxblod)" stroke-width="0.8" opacity="0.6" stroke-linecap="round"/>
      </svg></span>en</h1>
      <p class="tagline">${esc(c.tagline)}</p>
      <p class="by">${esc(c.by)} <a href="${esc(mastheadLink())}" target="_blank" rel="noopener">Ventelistevalg</a></p>
      <p class="sub">${esc(c.sub).replace(lang() === "da" ? "med blåt" : "in blue", `<span class="blue">${lang() === "da" ? "med blåt" : "in blue"}</span>`)}</p>
    </div>`;
  const tools = $("tools");
  tools.setAttribute("aria-label", lang() === "da" ? "Værktøjer" : "Tools");
  tools.innerHTML = `
      <label class="search"><span class="sr-only">${lang() === "da" ? "Find kommune" : "Find kommune"}</span>${icon.search}
        <input id="search" list="kommune-list" type="search" placeholder="${lang() === "da" ? "Find kommune" : "Find kommune"}" autocomplete="off" />
        <datalist id="kommune-list">${ctx.d.kommuner.map((k) => `<option value="${esc(k.navn)}"></option>`).join("")}</datalist>
      </label>
      <button class="btn wide" id="btn-tour" type="button">${esc(c.tour.button)}</button>
      <button class="btn" id="btn-explorer" type="button" aria-expanded="${state.explorer ? "true" : "false"}" aria-controls="explorer" aria-pressed="${state.explorer ? "true" : "false"}" aria-label="${esc(c.explorer)}">${icon.table}<span>${esc(c.explorer)}</span></button>
      <button class="btn wide" id="btn-method" type="button">${esc(c.method)}</button>
      <button class="btn wide" id="btn-sources" type="button">${esc(c.sources)}</button>
      <button class="btn icon" id="btn-theme" type="button" aria-label="${esc(c.themeLabel)}" title="${esc(state.theme === "day" ? c.themeNight : c.themeDay)}">${state.theme === "day" ? icon.moon : icon.sun}</button>
      <button class="btn icon" id="btn-lang" type="button" lang="${c.lang === "da" ? "en" : "da"}" aria-label="${esc(`${c.langToggle}, ${c.langToggleLabel}`)}">${esc(c.langToggle)}</button>`;
  const search = $("search") as HTMLInputElement;
  const go = () => {
    const q = search.value.trim().toLowerCase();
    const k = ctx.d.kommuner.find((x) => x.navn.toLowerCase() === q) ?? ctx.d.kommuner.find((x) => x.navn.toLowerCase().startsWith(q) && q.length > 1);
    if (k) {
      set({ k: k.kode });
      search.value = "";
      search.blur();
    }
  };
  search.addEventListener("change", go);
  search.addEventListener("keydown", (e) => e.key === "Enter" && go());
  $("btn-explorer").onclick = () => set({ explorer: state.explorer ? "" : "table" });
  $("btn-theme").onclick = () => set({ theme: state.theme === "day" ? "night" : "day" });
  $("btn-lang").onclick = () => set({ lang: state.lang === "da" ? "en" : "da" });
}

let moreModesOpen = false;

export function renderModes(): void {
  const c = t();
  const el = $("modes");
  el.setAttribute("aria-label", c.modesLabel);
  let lastGroup = "";
  const chip = (m: (typeof MODES)[number], i: number, withHead: boolean) => {
    const [name, tip] = c.modes[m.id];
    // Every lens that is not a plain DST register count says what kind of number it is.
    const k = m.kind === "register" ? "" : kindLabel(m.kind);
    const cls = m.id === "maalt" ? "chip measured" : "chip";
    const head = withHead && m.group !== lastGroup ? `<h3 class="caps group">${esc(c.modeGroups[m.group])}</h3>` : "";
    lastGroup = m.group;
    return `${head}<button type="button" class="${cls}" data-mode="${m.id}" aria-pressed="${state.mode === m.id}" title="${esc(lang() === "da" ? `${tip} (EN: ${en.modes[m.id][0]})` : tip)}">
        <span class="n">${String(i + 1).padStart(2, "0")}</span><span class="l">${esc(name)}</span><span class="k">${esc(k)}</span></button>`;
  };
  // First screen: the strongest lenses (docs/BUILD-NOTES.md, "First screen views"). The rest sit behind a native disclosure.
  const primary = MODES.filter((m) => !m.more);
  const more = MODES.filter((m) => m.more);
  const moreOpen = moreModesOpen || more.some((m) => m.id === state.mode);
  const focusedMode = (document.activeElement as HTMLElement | null)?.closest?.("#modes button.chip")?.getAttribute("data-mode");
  el.innerHTML =
    `<h2 class="sr-only">${esc(c.modesLabel)}</h2>` +
    primary.map((m, i) => chip(m, i, true)).join("") +
    `<details class="more-modes" id="more-modes"${moreOpen ? " open" : ""}><summary class="chip more-sum"><span class="n">+</span><span class="l">${esc(c.moreModes(more.length))}</span></summary>
      <div class="more-list">${more.map((m, i) => chip(m, primary.length + i, false)).join("")}</div></details>`;
  el.querySelectorAll<HTMLButtonElement>("button.chip").forEach((b) => {
    b.onclick = () => set({ mode: b.dataset.mode!, alt: false });
  });
  // The rail is rebuilt on every switch; keep keyboard focus on the chip that was focused.
  if (focusedMode) el.querySelector<HTMLElement>(`button.chip[data-mode="${focusedMode}"]`)?.focus();
  const det = el.querySelector<HTMLDetailsElement>("#more-modes")!;
  det.addEventListener("toggle", () => (moreModesOpen = det.open));
  // Keep the active lens clear of the rail's bottom fade (vertical rail) or in view (mobile chip row).
  const active = el.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (active) {
    requestAnimationFrame(() => {
      const r = active.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      if (el.scrollHeight > el.clientHeight) {
        const fade = 30;
        if (r.bottom > box.bottom - fade) el.scrollTop += r.bottom - box.bottom + fade + r.height;
        else if (r.top < box.top) el.scrollTop -= box.top - r.top + 8;
      } else active.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
}

export function renderLegend(onMethod: () => void, onSources?: () => void): void {
  const c = t();
  const m = ctx.mode;
  const def = ctx.modeDef;
  const T = THEME[state.theme];
  const [name, tip] = c.modes[state.mode];
  const ind = m.indicator ? ctx.d.ind.get(m.indicator) : undefined;
  const title = ind ? label(ind) : tip;
  const badge = `<span class="badge ${def.kind}">${esc(kindLabel(def.kind))}</span>`;
  let body = "";

  if (state.mode === "maalt") {
    const a = ctx.d.measured.aarhusbolig;
    body = `
      <div class="extra" style="margin-top:4px">
        <span><span class="swatch needle"></span>${esc(c.legend.needle)}</span>
        <span><span class="swatch stale"></span>${esc(c.legend.stale)}: 2017</span>
      </div>
      <p class="note dim">${esc(c.legend.needleScale)}</p>
      <div class="src"><span>${esc(c.legend.source)}: <a href="${esc(a.sourceUrl)}" target="_blank" rel="noopener">${esc(lang() === "da" ? a.label_da : a.label_en)}</a>, ${esc(a.licence)}</span></div>
      <p class="note">${esc(c.legend.measuredNote)} <a href="${esc(legendLink())}" target="_blank" rel="noopener">${esc(c.legend.measuredLink)}</a></p>
      ${FLAGS.ventelistevalg ? `<p class="note">${esc(c.legend.vvFlag)}</p>` : ""}`;
  } else {
    const breaks = quantileBreaks(m.values);
    const fmt = (v: number) => (state.mode === "koetryk" ? num(v, 2) : state.mode === "usikkerhed" ? num(v, 0) : num(v, Math.min(m.dec, Math.abs(v) >= 100 ? 0 : m.dec)));
    const bars = T.ramp.map((_col, i) => `<span style="background:${css(rampColor(T.ramp, i / 6))};height:${6 + i * 3.3}px" title="${esc(fmt(breaks[i] ?? 0))} ${to()} ${esc(fmt(breaks[i + 1] ?? 0))}"></span>`).join("");
    const hasNull = m.values.some((v) => v === null);
    const lo = breaks.length ? fmt(breaks[0]) : "";
    const hi = breaks.length ? fmt(breaks[7]) : "";
    // Only where the numbers on the ramp need a unit word: Køtryk is a percentile, Usikkerhed is in percentage points.
    const unitTxt = state.mode === "koetryk" ? c.legend.pctScale : state.mode === "usikkerhed" ? c.modeExtra.usikkerhedUnit : "";
    const kkSrc = state.mode === "almen" && ctx.d.measured.kk ? `<p class="note dim">${esc(c.legend.kkSource)}</p>` : "";
    const wealth = state.mode === "andelsvaerdi" || state.mode === "vaerdiIndkomst" ? `<p class="note dim">${esc(c.legend.wealthNote)}</p>` : "";
    const alt = def.alt
      ? `<label class="toggle"><input type="checkbox" id="mode-alt" ${state.alt ? "checked" : ""}/> ${esc(state.mode === "nybyggeri" ? c.modeExtra.nybygAA : c.modeExtra.andelPct)}</label>`
      : "";
    const tables = m.tables.map((tb) => `<a href="https://www.statistikbanken.dk/${tb}" target="_blank" rel="noopener">${tb}</a>`).join(", ");
    const period = state.mode === "usikkerhed" ? (lang() === "da" ? "200 tilfældige vægtsæt" : "200 random weight sets") : per(m.period);
    body = `
      <div class="ramp" aria-hidden="true">${bars}</div>
      <div class="ramp-labels"><span>${esc(c.legend.low)} ${esc(lo)}</span><span>${esc(hi)} ${esc(c.legend.high)}</span></div>
      ${hasNull ? `<div class="extra nulls"><span><span class="swatch hatch"></span>${esc(c.legend.unknown)}</span></div>` : ""}
      <p class="sr-only">${esc(c.legend.srScale(lo, hi))}${unitTxt ? ` ${esc(unitTxt)}.` : ""}</p>
      <p class="note dim scale">${unitTxt ? `${esc(unitTxt[0].toUpperCase() + unitTxt.slice(1))}. ` : ""}${esc(c.legend.heightNote)}</p>
      ${state.mode === "flyt" ? `<p class="note">${esc(c.modeExtra.flowsHint)}</p>` : ""}
      ${state.mode === "almen" ? `<p class="note">${esc(c.legend.kkPolys)}</p>` : ""}
      ${wealth}
      ${alt}
      <div class="src"><span>${esc(c.legend.source)}: Danmarks Statistik, ${tables}</span><span>${esc(c.legend.period)}: ${esc(period)}</span></div>
      ${kkSrc}
      ${state.mode === "koetryk" || state.mode === "usikkerhed" ? `<p class="note"><a href="#" id="legend-method">${esc(c.legend.methodLink)}</a>${ctx.customWeights ? (lang() === "da" ? " · egne vægte" : " · custom weights") : ""}</p>` : ""}`;
  }
  const mobileLinks = `<p class="mobile-credit">${esc(c.legend.mobileCredit)} <button type="button" class="linkish" data-open="method">${esc(c.method)}</button> · <button type="button" class="linkish" data-open="sources">${esc(c.sources)}</button></p>`;
  $("legend").innerHTML = `<h3>${esc(name)} ${badge}</h3><p class="desc">${esc(title)}</p>${body}${mobileLinks}`;
  const altEl = document.getElementById("mode-alt") as HTMLInputElement | null;
  if (altEl) altEl.onchange = () => set({ alt: altEl.checked });
  const lm = document.getElementById("legend-method");
  if (lm) lm.onclick = (e) => (e.preventDefault(), onMethod());
  $("legend").querySelectorAll<HTMLButtonElement>("[data-open]").forEach((b) => {
    b.onclick = () => (b.dataset.open === "method" ? onMethod() : onSources?.());
  });
}

export function renderFooter(): void {
  const c = t();
  $("foot").innerHTML = `<span>${esc(c.footer.made)} <a href="${esc(footerLink())}" target="_blank" rel="noopener">ventelistevalg.dk</a></span>
    <span title="${esc(c.footer.data)}">${esc(c.footer.data)}</span>`;
}
