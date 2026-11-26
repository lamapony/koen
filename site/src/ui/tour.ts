// Fortællinger: a five-stop guided tour. Text is templated from the data, no LLM at runtime.
import { ctx } from "../ctx";
import { t, lang } from "../i18n";
import { set } from "../state";
import { num } from "../format";
import { $, esc } from "./util";
import type { MapController } from "../map/map";

interface Stop {
  mode: string;
  k: string | null;
  cam: { center: [number, number]; zoom: number; pitch?: number; bearing?: number };
  title: string;
  body: string;
}

function stops(): Stop[] {
  const d = ctx.d;
  const da = lang() === "da";
  const by = (kode: string) => d.byKode.get(kode)!;
  const sorted = [...d.kommuner].sort((a, b) => b.koetryk - a.koetryk);
  const top3 = sorted.slice(0, 3).map((k) => k.navn).join(", ");
  const capital = sorted.filter((k) => k.region === "Hovedstaden").length;
  const capTop = sorted.slice(0, 10).filter((k) => k.region === "Hovedstaden").length;
  const a = d.measured.aarhusbolig;
  const low = [...d.kommuner].sort((x, y) => x.koetryk - y.koetryk).slice(0, 3);
  const S1 = d.kommuner.map((k) => k.ind.S1 ?? 0);
  const median = [...S1].sort((x, y) => x - y)[49];
  const aa = d.kommuner.filter((k) => (k.ind.NYBYG_AA ?? 0) === 0).length;
  const widest = [...d.kommuner].sort((x, y) => (y.koetrykBand[1] - y.koetrykBand[0]) - (x.koetrykBand[1] - x.koetrykBand[0]))[0];
  const aarhus = by("0751");
  const s2med = [...d.kommuner.map((k) => k.ind.S2 ?? 0)].sort((x, y) => x - y)[49];
  const shrinking = low.every((k) => (k.ind.D2 ?? 0) < 0 && (k.ind.S2 ?? 0) > s2med);
  return [
    {
      mode: "koetryk", k: null, cam: { center: [12.35, 55.72], zoom: 8.6, pitch: 55, bearing: -20 },
      title: da ? "Hovedstadens højland" : "The capital highlands",
      body: da
        ? `${capTop} af de 10 kommuner med højest modelleret køtryk ligger i Region Hovedstaden (${capital} kommuner i alt). Toppen lige nu: ${top3}.`
        : `${capTop} of the 10 kommuner with the highest modelled pressure are in the Capital Region (${capital} kommuner in total). The top right now: ${top3}.`,
    },
    {
      mode: "maalt", k: "0751", cam: { center: [10.17, 56.16], zoom: 10.2, pitch: 50, bearing: -10 },
      title: da ? "Aarhus i tal fra 2017" : "Aarhus in 2017 numbers",
      body: da
        ? `Aarhusbolig offentliggjorde i 2017 ${num(a.totals.lists)} ventelister. Den længste havde ${num(a.totals.maxList)} personer. Det er de eneste åbne kølængder, vi har fundet. Aarhus har et modelleret køtryk på ${num(aarhus.koetryk, 2)}.`
        : `In 2017 Aarhusbolig published ${num(a.totals.lists)} waiting lists. The longest had ${num(a.totals.maxList)} people. These are the only open queue lengths we found. Aarhus has a modelled pressure of ${num(aarhus.koetryk, 2)}.`,
    },
    {
      mode: "tomme", k: low[0].kode, cam: { center: [11.2, 55.1], zoom: 7.4, pitch: 50, bearing: -14 },
      title: da ? "Hvor presset er lavest" : "Where pressure is lowest",
      body: da
        ? `Lavest modelleret køtryk: ${low.map((k) => k.navn).join(", ")}.${shrinking ? " I alle tre står flere boliger tomme end i medianen, og befolkningen er faldet over 5 år." : ""} ${low[0].navn} har ${num(low[0].ind.S2, 1)} % boliger uden tilmeldte beboere.`
        : `Lowest modelled pressure: ${low.map((k) => k.navn).join(", ")}.${shrinking ? " All three have more empty dwellings than the median and a population that fell over 5 years." : ""} ${low[0].navn} has ${num(low[0].ind.S2, 1)} % dwellings with no registered residents.`,
    },
    {
      mode: "nybyggeri", k: null, cam: { center: [10.55, 55.95], zoom: 6.55, pitch: 52, bearing: -14 },
      title: da ? "Byggeriet der ikke når op" : "Building that does not keep up",
      body: da
        ? `Medianen er ${num(median, 1)} nye boliger pr. 1.000 indbyggere det seneste år. I ${aa} kommuner blev der ikke færdiggjort én eneste almen- eller andelsbolig.`
        : `The median is ${num(median, 1)} new dwellings per 1,000 residents over the last year. In ${aa} kommuner not a single social or co-op dwelling was completed.`,
    },
    {
      mode: "usikkerhed", k: widest.kode, cam: { center: [10.55, 55.95], zoom: 6.55, pitch: 52, bearing: -14 },
      title: da ? "Usikkerheden" : "The uncertainty",
      body: da
        ? `Køtrykket afhænger af vægtene. ${widest.navn} svinger mest: mellem ${num(widest.koetrykBand[0], 2)} og ${num(widest.koetrykBand[1], 2)}. Prøv selv under Udforsk.`
        : `The index depends on the weights. ${widest.navn} moves the most: between ${num(widest.koetrykBand[0], 2)} and ${num(widest.koetrykBand[1], 2)}. Try it under Explore.`,
    },
  ];
}

export function startTour(mc: MapController): void {
  const el = $("tour");
  const list = stops();
  let i = 0;
  const show = () => {
    const s = list[i];
    const c = t().tour;
    set({ mode: s.mode, k: s.k, alt: false, explorer: "" });
    mc.flyTo(s.cam);
    el.hidden = false;
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", c.button);
    el.innerHTML = `<div class="caps" style="opacity:.7">${esc(c.button)} · ${esc(c.stop(i + 1, list.length))}</div>
      <h3>${esc(s.title)}</h3><p>${esc(s.body)}</p>
      <div class="row"><button class="btn" type="button" id="tour-prev" ${i === 0 ? "disabled" : ""}>${esc(c.prev)}</button>
      <button class="btn solid" type="button" id="tour-next">${esc(i === list.length - 1 ? c.end : c.next)}</button></div>`;
    $("tour-prev").onclick = () => (i--, show());
    $("tour-next").onclick = () => {
      if (i === list.length - 1) {
        el.hidden = true;
        set({ mode: "koetryk", k: null });
        mc.home();
        return;
      }
      i++;
      show();
    };
    $("tour-next").focus();
  };
  el.onkeydown = (e) => {
    if (e.key === "Escape") {
      el.hidden = true;
    }
  };
  show();
}
