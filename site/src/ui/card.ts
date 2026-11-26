// Kommune card: rank, band, every indicator with source, measured queues, Ventelistevalg touchpoint.
import { ctx, koetrykRanks } from "../ctx";
import { t, label, lang, period } from "../i18n";
import { state, set } from "../state";
import { num, withUnit, topPct, signed } from "../format";
import { $, esc, icon, sparkline } from "./util";
import { fornyelsesradar, listerAndels, listerAlmene } from "../funnel/utm";
import { unitLabel } from "./chrome";
import { loadHistory, type History } from "../data";

let history: History | null = null;

export function renderCard(): void {
  const el = $("card");
  const k = state.k ? ctx.d.byKode.get(state.k) : undefined;
  if (!k) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  if (!history) loadHistory().then((h) => ((history = h), state.k === k.kode && renderCard()));
  const c = t();
  const d = ctx.d;
  const kt = ctx.koetryk[k.i];
  const ranks = koetrykRanks();
  const lo = k.koetrykBand[0];
  const hi = k.koetrykBand[1];
  const rankLine = kt >= 0.5 ? c.card.rankTop(topPct(kt)) : c.card.rankBottom(`${Math.max(1, Math.round(kt * 100) + 1)} %`);
  const bandLine = !ctx.customWeights ? c.card.band(topPct(hi), topPct(lo)) : lang() === "da" ? "Usikkerhedsbåndet gælder standardvægtene." : "The uncertainty band applies to the default weights.";

  const indexIds = d.meta.index.ids;
  const zbar = (z: number | null) => {
    if (z === null) return "";
    const w = (Math.abs(z) / 2.5) * 50;
    return `<span class="zbar" title="z = ${num(z, 2)}"><i class="${z < 0 ? "neg" : ""}" style="${z >= 0 ? `left:50%;width:${w}%` : `right:50%;width:${w}%`}"></i></span>`;
  };
  const row = (id: string, withZ: boolean) => {
    const m = d.ind.get(id)!;
    const v = k.ind[id];
    const val = v === null ? `<span class="nd">${esc(c.noData)}</span>` : esc(withUnit(v, unitLabel(m.unit), m.dec));
    const src = m.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.table)}</a>`).join(", ");
    const hk = id === "POP" ? "POP" : id === "ANDELSVAERDI" ? "ANDELSVAERDI" : id === "INDKOMST" ? "INDKOMST" : id === "ALMEN_N" ? "ALMEN_N" : id === "ANDEL_N" ? "ANDEL_N" : null;
    const spark = hk && history?.[hk] ? sparkline(history[hk].values[k.kode] ?? []) : "";
    return `<div class="ind-row"><span>${esc(label(m))}</span><span class="v">${val}</span>
      <span class="m">${withZ ? zbar(k.z[id]) : ""}${spark}<span>${esc(c.card.source)}: ${src} · ${esc(period(m.period))}</span></span></div>`;
  };

  const ma = k.maalt?.[0];
  const measured = ma
    ? `<div class="measured-box">
        <div class="lead">${esc(c.card.measuredLongest(num(ma.maxList)))}</div>
        <div class="meta">${esc(c.card.measuredMeta)}</div>
        <p>${esc(c.card.measuredTotals(num(ma.lists), num(ma.peopleOnLists)))}</p>
        <p>${esc(c.card.measuredPostnumre(ma.postnumre.join(", ")))} · <a href="${esc(ma.sourceUrl)}" target="_blank" rel="noopener">Open Data DK</a>, CC BY 4.0</p>
      </div>`
    : `<p class="measured-none">${esc(c.card.noMeasured)}</p>`;

  // Migration partners (FLY66) for context.
  const fl = d.flows.rows;
  const outs = fl.filter((r) => r[0] === k.i).sort((a, b) => b[2] - a[2]).slice(0, 4);
  const ins = fl.filter((r) => r[1] === k.i).sort((a, b) => b[2] - a[2]).slice(0, 4);
  const flowList = (rows: [number, number, number][], idx: 0 | 1) =>
    rows.map((r) => `<li><span>${esc(d.kommuner[r[idx]].navn)}</span><span class="mono">${num(r[2])}</span></li>`).join("");

  const kbh = k.kode === "0101" || k.kode === "0147";
  el.hidden = false;
  el.setAttribute("aria-label", k.navn);
  el.innerHTML = `
    <button class="sheet-handle" type="button" id="card-handle" aria-label="${esc(lang() === "da" ? "Udvid kommunekortet" : "Expand the kommune card")}" aria-expanded="false"></button>
    <div class="card-head">
      <div class="caps region">${esc(k.region)} · ${esc(c.card.rankOf(ranks[k.i], d.kommuner.length))}</div>
      <h2>${esc(k.navn)}</h2>
      <button class="btn icon x" type="button" id="card-close" aria-label="${esc(c.card.close)}">${icon.close}</button>
    </div>
    <div class="score">
      <div class="big">${num(kt, 2)}<small>${esc(c.modelled.toUpperCase())}</small></div>
      <div>
        <p><b>${esc(rankLine)}</b></p>
        <p>${esc(bandLine)} ${k.used < 7 ? esc(c.card.used(k.used)) : ""}</p>
        <div class="bandbar" aria-hidden="true"><span class="track"></span>
          ${!ctx.customWeights ? `<span class="rng" style="left:${lo * 100}%;width:${Math.max(1, (hi - lo) * 100)}%"></span>` : ""}
          <span class="pt" style="left:calc(${kt * 100}% - 1px)"></span></div>
      </div>
    </div>
    <div class="sec"><h3 class="caps">${esc(c.card.measuredTitle)}</h3>${measured}</div>
    <div class="sec"><h3 class="caps">${esc(c.card.indexPart)}</h3>${indexIds.map((id) => row(id, true)).join("")}</div>
    <div class="sec"><h3 class="caps">${esc(c.card.extra)}</h3>${["POP", "ANDEL_N", "ANDEL_PCT", "ALMEN_N", "ALMEN_PCT", "ANDELSVAERDI", "INDKOMST", "NETFLYT", "BOLIGSTOETTE", "M2_PERSON"].map((id) => row(id, false)).join("")}</div>
    <div class="sec"><h3 class="caps">${esc(lang() === "da" ? "Flytninger" : "Moves")} ${esc(d.flows.period)} · FLY66</h3>
      <p style="margin:0 0 6px;font-size:13px">${esc(lang() === "da" ? "Netto" : "Net")}: <span class="mono">${esc(signed(d.flows.in[k.kode] - d.flows.out[k.kode], 0))}</span></p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px">
        <div><div class="caps" style="color:var(--graa);margin-bottom:4px">${esc(c.card.flowsIn)}</div><ul class="flows-list" style="columns:1">${flowList(ins, 0)}</ul></div>
        <div><div class="caps" style="color:var(--graa);margin-bottom:4px">${esc(c.card.flowsOut)}</div><ul class="flows-list" style="columns:1">${flowList(outs, 1)}</ul></div>
      </div>
    </div>
    <div class="cta">
      <p>${esc(c.card.ctaText)}</p>
      <p class="disclosure">${esc(c.card.ctaDisclosure)}</p>
      <a class="go" href="${esc(fornyelsesradar(k.kode))}" target="_blank" rel="noopener">${esc(c.card.ctaButton)} ${icon.arrow}</a>
      ${kbh ? `<p class="kbh">${esc(c.card.kbhLine)}: <a href="${esc(listerAndels(k.kode))}" target="_blank" rel="noopener">${esc(c.card.kbhAndels)}</a> · <a href="${esc(listerAlmene(k.kode))}" target="_blank" rel="noopener">${esc(c.card.kbhAlmene)}</a></p>` : ""}
    </div>`;
  $("card-close").onclick = () => set({ k: null });
  $("card-handle").onclick = () => {
    const full = el.classList.toggle("full");
    $("card-handle").setAttribute("aria-expanded", String(full));
  };
}
