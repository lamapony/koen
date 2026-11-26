// First-visit explainer, method note and sources panel.
import { ctx } from "../ctx";
import { t, label, lang, period } from "../i18n";
import { num } from "../format";
import { $, esc, icon } from "./util";

const SEEN = "koen-intro-seen"; // localStorage, not a cookie

export function maybeIntro(onClose: () => void, onMethod: () => void): boolean {
  let seen = false;
  try {
    seen = localStorage.getItem(SEEN) === "1";
  } catch {
    /* storage blocked: show it */
  }
  if (seen || location.hash.includes("k=")) return false;
  showIntro(onClose, onMethod);
  return true;
}

export function showIntro(onClose: () => void, onMethod: () => void): void {
  const c = t();
  const el = $("intro");
  el.hidden = false;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-labelledby", "intro-title");
  el.setAttribute("aria-modal", "true");
  el.innerHTML = `<h2 id="intro-title">${esc(c.intro.title)}</h2>${c.intro.body.map((p) => `<p>${esc(p)}</p>`).join("")}
    <div class="legend-mini">
      <span><span class="swatch" style="background:linear-gradient(90deg,var(--t1),var(--t4),var(--t7));width:36px"></span>${esc(c.modelled)}</span>
      <span><span class="swatch needle"></span>${esc(c.measured)}</span>
      <span><span class="swatch hatch"></span>${esc(c.noData)}</span>
    </div>
    <div class="row"><button class="btn solid" type="button" id="intro-go">${esc(c.intro.cta)}</button><button class="btn" type="button" id="intro-method">${esc(c.intro.more)}</button></div>`;
  const close = () => {
    el.hidden = true;
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      /* ignore */
    }
    onClose();
  };
  $("intro-go").onclick = close;
  $("intro-method").onclick = () => (close(), onMethod());
  el.addEventListener("keydown", (e) => e.key === "Escape" && close());
  requestAnimationFrame(() => $("intro-go").focus());
}

let lastFocus: HTMLElement | null = null;
function openPanel(html: string, labelId: string): void {
  const el = $("panel");
  lastFocus = document.activeElement as HTMLElement;
  el.hidden = false;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-labelledby", labelId);
  el.setAttribute("aria-modal", "true");
  el.innerHTML = `<button class="btn icon x" type="button" id="panel-close" aria-label="${esc(t().close)}">${icon.close}</button>${html}`;
  const close = () => {
    el.hidden = true;
    lastFocus?.focus();
  };
  $("panel-close").onclick = close;
  el.onkeydown = (e) => e.key === "Escape" && close();
  $("panel-close").focus();
}

export function showMethod(): void {
  const d = ctx.d;
  const ids = d.meta.index.ids;
  const loo = d.meta.index.loo;
  const da = lang() === "da";
  const rows = ids
    .map((id) => {
      const m = d.ind.get(id)!;
      return `<li><b>${esc(id)} ${esc(label(m))}</b> (${Math.round((m.w ?? 0) * 100)} %${m.dir === -1 ? (da ? ", trækker ned" : ", lowers the index") : ""}): ${esc(da ? m.formula_da : m.formula_en)} <span class="mono" style="color:var(--graa)">${esc(period(m.period))}</span></li>`;
    })
    .join("");
  const looTxt = ids.map((id) => `${id} ${num(loo[id], 2)}`).join(" · ");
  const html = da
    ? `<h2 id="m-title">${esc(t().methodTitle)}</h2>
      <p><b>To lag, holdt adskilt.</b> Bjergene er et <b>modelleret køtryk</b> for alle 98 kommuner, bygget kun af åbne tal fra Danmarks Statistik. De blå nåle er <b>målte</b> ventelister, og de findes kun, hvor nogen har offentliggjort dem: i dag Aarhusbolig, et øjebliksbillede fra 2017.</p>
      <p><b>Hvorfor modelleret?</b> Ventelister til andelsboliger og de fleste almene lister er ikke offentlige. Der findes intet nationalt register. Køen opfinder ingen kølængder.</p>
      <h3>Indikatorerne</h3><ul>${rows}</ul>
      <h3>Beregningen</h3>
      <pre>z = (x − median) / (1,4826 × MAD), begrænset til ±2,5
råt = Σ vægt × z   (manglende tal udelades, vægte normaliseres)
køtryk = percentil af råt blandt 98 kommuner (0 til 1)</pre>
      <p>Robuste z-værdier gør, at én ekstrem kommune ikke trækker skalaen. Højden er <code>køtryk^1,6</code>, så toppen står tydeligt frem.</p>
      <h3>Usikkerhed</h3>
      <p>Vi regner indekset om med 200 tilfældige vægtsæt omkring standardvægtene. Kortet viser spændet for hver kommune, og visningen Usikkerhed gør det til terræn. Hver indikator er testet ved at fjerne den: rangfølgen ændrer sig kun lidt (Spearman ${esc(looTxt)}; kravet er mindst 0,8).</p>
      <h3>Det ved vi ikke</h3>
      <p>Kommunegrænserne er grove (geoBoundaries, Public Domain) og skal erstattes af DAGI. EJDFOE1 er en formuestatistik, ikke salgspriser. Aarhusbolig dækker én kommune og kan ikke validere en national rangering. Én person kan stå på flere lister, så tilmeldinger er ikke personer.</p>
      <p>Du kan selv ændre vægtene under <b>Udforsk</b>, Byg dit eget køtryk.</p>`
    : `<h2 id="m-title">${esc(t().methodTitle)}</h2>
      <p><b>Two layers, kept apart.</b> The mountains are a <b>modelled queue pressure</b> for all 98 kommuner, built only from open Statistics Denmark data. The blue needles are <b>measured</b> waiting lists and exist only where someone published them: today Aarhusbolig, a 2017 snapshot.</p>
      <p><b>Why modelled?</b> Co-op waiting lists and most social housing lists are not public. There is no national register. Køen invents no queue lengths.</p>
      <h3>Indicators</h3><ul>${rows}</ul>
      <h3>Calculation</h3>
      <pre>z = (x − median) / (1.4826 × MAD), clamped to ±2.5
raw = Σ weight × z   (missing values dropped, weights renormalised)
pressure = percentile of raw among 98 kommuner (0 to 1)</pre>
      <p>Robust z-scores keep one extreme kommune from stretching the scale. Height is <code>pressure^1.6</code> so the top stands out.</p>
      <h3>Uncertainty</h3>
      <p>We recompute the index with 200 random weight sets around the defaults. The card shows the range per kommune, and the Uncertainty view turns it into terrain. Each indicator was tested by leaving it out: the ranking barely moves (Spearman ${esc(looTxt)}; the threshold is 0.8).</p>
      <h3>What we do not know</h3>
      <p>Kommune boundaries are coarse (geoBoundaries, Public Domain) and will be replaced by DAGI. EJDFOE1 is a wealth statistic, not sales prices. Aarhusbolig covers one kommune and cannot validate a national ranking. One person can be on several lists, so sign-ups are not people.</p>
      <p>You can change the weights yourself under <b>Explore</b>, Build your own index.</p>`;
  openPanel(html, "m-title");
}

export function showSources(): void {
  const c = t().sourcesUi;
  const items = ctx.d.sources
    .map(
      (s) => `<div class="src-item"><b>${esc(s.title)} <span class="status ${esc(s.status)}">${esc(c.status[s.status] ?? s.status)}</span></b>
      <span style="color:var(--graa);font-size:12.5px">${esc(s.publisher ?? "")}</span>
      <dl>
        ${s.url ? `<dt>URL</dt><dd><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https?:\/\//, ""))}</a></dd>` : ""}
        ${s.licence ? `<dt>${esc(c.licence)}</dt><dd><a href="${esc(s.licence.url)}" target="_blank" rel="noopener">${esc(s.licence.name)}</a></dd>` : ""}
        ${s.period ? `<dt>${esc(c.period)}</dt><dd>${esc(s.period)}</dd>` : ""}
        ${s.fetchedAt ? `<dt>${esc(c.fetched)}</dt><dd>${esc(s.fetchedAt.slice(0, 10))}</dd>` : ""}
        ${s.rows ? `<dt>${esc(c.rows)}</dt><dd>${num(s.rows)}</dd>` : ""}
        ${s.note ? `<dt>Note</dt><dd>${esc(s.note)}</dd>` : ""}
        ${s.attribution ? `<dt>Attr.</dt><dd>${esc(s.attribution)}</dd>` : ""}
      </dl></div>`,
    )
    .join("");
  openPanel(`<h2 id="s-title">${esc(c.title)}</h2><p>${esc(c.intro)}</p><p><a href="${import.meta.env.BASE_URL}data/sources.json" target="_blank" rel="noopener">sources.json</a></p>${items}`, "s-title");
}
