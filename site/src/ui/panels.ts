// First-visit explainer, method note and sources panel.
import { ctx } from "../ctx";
import { t, label, lang, period } from "../i18n";
import { num } from "../format";
import { $, esc, icon } from "./util";
import { methodLink } from "../funnel/utm";

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
  const looMin = num(d.meta.index.params?.looMin ?? 0.85, 2);
  const looTxt = ids.map((id) => `${id} ${num(loo[id], 2)}`).join(" · ");
  const v = d.meta.index.validation;
  // One city per line, so the numbers line up in the column instead of wrapping mid-list.
  const rk = (e: NonNullable<typeof v>["after"]) =>
    [["København", "0101"], ["Frederiksberg", "0147"], ["Aarhus", "0751"]]
      .map(([n, k]) => `${esc(n)} <b>${num(e.ranks[k], 0)}</b>`)
      .join("<br>");
  const valDa = v
    ? `<h3>Kontrol mod rigtige køer</h3>
      <p>Der findes ingen national opgørelse af ventelister, så vi tjekker mod det lidt, der findes: København, Frederiksberg og Aarhus har de længste køer; Ventelistevalgs andelskatalog med offentlige kølængder dækker København og Frederiksberg; Aarhusbolig 2017 har rigtige kølængder for Aarhus, Skanderborg og Favrskov.</p>
      <table class="valtab"><thead><tr><th></th><th>v1</th><th>v2</th></tr></thead><tbody>
      <tr><th>Placering</th><td>${rk(v.before)}</td><td>${rk(v.after)}</td></tr>
      <tr><th>AUC, de tre byer</th><td>${num(v.before.owner3.auc, 2)}</td><td>${num(v.after.owner3.auc, 2)}</td></tr>
      <tr><th>Spearman, Aarhusbolig (3 kommuner)</th><td>${num(v.before.aarhusbolig.rho, 2)}</td><td>${num(v.after.aarhusbolig.rho, 2)}</td></tr>
      </tbody></table>
      <p>AUC er sandsynligheden for, at en af de tre byer ligger over en tilfældig anden kommune (1 er perfekt, 0,5 er tilfældigt). Med kun tre ankre er det en grov kontrol, ikke et bevis. Vægtene er runde tal valgt ud fra hvad der skaber kø, ikke tilpasset ankrene.</p>`
    : "";
  const valEn = v
    ? `<h3>Checked against real queues</h3>
      <p>There is no national count of waiting lists, so we check against the little that exists: København, Frederiksberg and Aarhus have the longest queues; Ventelistevalg's co-op catalog with public queue lengths covers København and Frederiksberg; Aarhusbolig 2017 has real queue lengths for Aarhus, Skanderborg and Favrskov.</p>
      <table class="valtab"><thead><tr><th></th><th>v1</th><th>v2</th></tr></thead><tbody>
      <tr><th>Rank</th><td>${rk(v.before)}</td><td>${rk(v.after)}</td></tr>
      <tr><th>AUC, the three cities</th><td>${num(v.before.owner3.auc, 2)}</td><td>${num(v.after.owner3.auc, 2)}</td></tr>
      <tr><th>Spearman, Aarhusbolig (3 kommuner)</th><td>${num(v.before.aarhusbolig.rho, 2)}</td><td>${num(v.after.aarhusbolig.rho, 2)}</td></tr>
      </tbody></table>
      <p>AUC is the probability that one of the three cities ranks above a random other kommune (1 is perfect, 0.5 is chance). With three anchors this is a rough check, not proof. The weights are round numbers chosen from what creates queues, not fitted to the anchors.</p>`
    : "";
  const html = da
    ? `<h2 id="m-title">${esc(t().methodTitle)}</h2>
      <p><b>To lag, holdt adskilt.</b> Bjergene er et <b>modelleret køtryk</b> for alle 98 kommuner, bygget kun af åbne tal fra Danmarks Statistik. De blå nåle er <b>målte</b> ventelister, og de findes kun, hvor nogen har offentliggjort dem: i dag Aarhusbolig, et øjebliksbillede fra 2017.</p>
      <p><b>Hvorfor modelleret?</b> Ventelister til andelsboliger og de fleste almene lister er ikke offentlige. Der findes intet nationalt register. Køen opfinder ingen kølængder.</p>
      <p><b>Hvad måler køtrykket?</b> Hvor mange der står i kø i forhold til kommunens størrelse. Det stiger med tre ting: hvor mange almen- og andelsboliger der er pr. voksen (flere boliger med venteliste giver flere i kø), hvor stor efterspørgslen er (unge voksne, tilflyttere fra udlandet, vækst), og hvor dyrt det er at købe sig ud af køen (bolig mod indkomst). Tomme boliger trækker ned. Version 2 fra november 2026; version 1 vendte boligbestanden den anden vej.</p>
      <h3>Indikatorerne</h3><ul>${rows}</ul>
      <h3>Beregningen</h3>
      <pre>z = (x − median) / (1,4826 × MAD), begrænset til ±2,5
råt = Σ vægt × z   (manglende tal udelades, vægte normaliseres)
køtryk = percentil af råt blandt 98 kommuner (0 til 1)</pre>
      <p>Robuste z-værdier gør, at én ekstrem kommune ikke trækker skalaen. Højden er <code>køtryk^1,6</code>, så toppen står tydeligt frem.</p>
      ${valDa}
      <h3>Usikkerhed</h3>
      <p>Vi regner indekset om med 200 tilfældige vægtsæt omkring standardvægtene. Kortet viser spændet for hver kommune, og visningen Usikkerhed gør det til terræn. Hver indikator er testet ved at fjerne den: rangfølgen ændrer sig kun lidt (Spearman ${esc(looTxt)}; kravet er mindst ${esc(looMin)}).</p>
      <h3>Det ved vi ikke</h3>
      <p>Køtrykket siger ikke, hvor lang den enkelte liste er, og de mest almene forstæder (fx Brøndby, Ishøj, Albertslund) ligger højt, fordi de har mange boliger med venteliste. Kommunegrænserne er grove (geoBoundaries, Public Domain) og skal erstattes af DAGI. EJDFOE1 er en formuestatistik, ikke salgspriser. Huslejer indgår ikke, fordi Køen ikke har en åben huslejekilde pr. kommune. Én person kan stå på flere lister, så tilmeldinger er ikke personer.</p>
      <p>Du kan selv ændre vægtene under <b>Udforsk</b>, Byg dit eget køtryk. Ventelistevalg beskriver sine egne kilder på <a href="${esc(methodLink())}" target="_blank" rel="noopener">Datakilder</a>.</p>`
    : `<h2 id="m-title">${esc(t().methodTitle)}</h2>
      <p><b>Two layers, kept apart.</b> The mountains are a <b>modelled queue pressure</b> for all 98 kommuner, built only from open Statistics Denmark data. The blue needles are <b>measured</b> waiting lists and exist only where someone published them: today Aarhusbolig, a 2017 snapshot.</p>
      <p><b>Why modelled?</b> Co-op waiting lists and most social housing lists are not public. There is no national register. Køen invents no queue lengths.</p>
      <p><b>What does it measure?</b> How many people queue relative to the size of the kommune. It rises with three things: how many social and co-op dwellings there are per adult (more dwellings with a waiting list means more people queuing), how strong demand is (young adults, arrivals from abroad, growth), and how expensive it is to buy your way out of the queue (home value to income). Empty dwellings lower it. Version 2 from November 2026; version 1 counted the housing stock the other way round.</p>
      <h3>Indicators</h3><ul>${rows}</ul>
      <h3>Calculation</h3>
      <pre>z = (x − median) / (1.4826 × MAD), clamped to ±2.5
raw = Σ weight × z   (missing values dropped, weights renormalised)
pressure = percentile of raw among 98 kommuner (0 to 1)</pre>
      <p>Robust z-scores keep one extreme kommune from stretching the scale. Height is <code>pressure^1.6</code> so the top stands out.</p>
      ${valEn}
      <h3>Uncertainty</h3>
      <p>We recompute the index with 200 random weight sets around the defaults. The card shows the range per kommune, and the Uncertainty view turns it into terrain. Each indicator was tested by leaving it out: the ranking barely moves (Spearman ${esc(looTxt)}; the threshold is ${esc(looMin)}).</p>
      <h3>What we do not know</h3>
      <p>The index does not say how long a single list is, and the suburbs with the most social housing (e.g. Brøndby, Ishøj, Albertslund) rank high because they have many dwellings with a waiting list. Kommune boundaries are coarse (geoBoundaries, Public Domain) and will be replaced by DAGI. EJDFOE1 is a wealth statistic, not sales prices. Rents are not included because Køen has no open rent source per kommune. One person can be on several lists, so sign-ups are not people.</p>
      <p>You can change the weights yourself under <b>Explore</b>, Build your own index. Ventelistevalg documents its own sources on <a href="${esc(methodLink())}" target="_blank" rel="noopener">Datakilder</a>.</p>`;
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
