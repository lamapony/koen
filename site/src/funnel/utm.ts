// Every outbound Ventelistevalg link goes through here (docs/INTEGRATION.md has the full link map).
// Only paths that exist in the Ventelistevalg routes and answered 200 live on 2026-11-26 are used.
// utm_source=koen, utm_medium=map, utm_campaign=<the view the visitor is on>, utm_content=<placement>.
export const VV = "https://ventelistevalg.dk";

let currentView = (): string => "koetryk";

export function utm(path: string, content: string, view = currentView()): string {
  const u = new URL(path, VV);
  u.searchParams.set("utm_source", "koen");
  u.searchParams.set("utm_medium", "map");
  u.searchParams.set("utm_campaign", view);
  u.searchParams.set("utm_content", content);
  return u.toString();
}

/** Andels bydel pages in Ventelistevalg (src/lib/district-slug.ts, all in the live sitemap). */
export const BYDELE: Record<string, { slug: string; navn: string }[]> = {
  "0101": [
    { slug: "indre-by", navn: "Indre By" },
    { slug: "noerrebro", navn: "Nørrebro" },
    { slug: "oesterbro", navn: "Østerbro" },
    { slug: "vesterbro", navn: "Vesterbro" },
    { slug: "amager", navn: "Amager" },
    { slug: "valby", navn: "Valby" },
    { slug: "vanloese", navn: "Vanløse" },
    { slug: "nordvest", navn: "Nordvest" },
  ],
  "0147": [{ slug: "frederiksberg", navn: "Frederiksberg" }],
};

export interface VvLink {
  id: string;
  href: string;
}

/** The Ventelistevalg pages that match one kommune. Fornyelsesradar and the guide apply to any queue. */
export function kommuneLinks(kode: string, region: string): {
  radar: string;
  guide: string;
  andels: string | null;
  bydele: { navn: string; href: string }[];
  almene: string | null;
} {
  const c = `kommune-${kode}`;
  const bydele = (BYDELE[kode] ?? []).map((b) => ({ navn: b.navn, href: utm(`/lister/andels/bydel/${b.slug}`, `${c}-bydel-${b.slug}`) }));
  const hasCatalog = kode in BYDELE;
  return {
    radar: utm("/fornyelsesradar", `${c}-fornyelsesradar`),
    guide: utm("/vejledning", `${c}-vejledning`),
    andels: hasCatalog ? utm("/lister/andels", `${c}-andels`) : null,
    bydele,
    // The almene desk lists capital-area providers (KAB, AAB, 3B, fsb, ...). Shown for Region Hovedstaden only.
    almene: hasCatalog || /hovedstaden/i.test(region) ? utm("/lister/almene", `${c}-almene`) : null,
  };
}

export const legendLink = () => utm("/lister/andels", "legend-rigtige-koeer");
export const footerLink = () => utm("/", "footer");
export const mastheadLink = () => utm("/", "masthead");
export const methodLink = () => utm("/datakilder", "method-datakilder");

/**
 * Keep utm_campaign equal to the view at click time, even if the link was rendered under another view.
 * Runs in the capture phase before the browser follows the link.
 */
export function installCampaignTracking(view: () => string): void {
  currentView = view;
  const rewrite = (e: Event) => {
    const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || !a.href.startsWith(VV)) return;
    const u = new URL(a.href);
    if (u.searchParams.get("utm_source") !== "koen") return;
    u.searchParams.set("utm_campaign", view());
    a.href = u.toString();
  };
  for (const type of ["pointerdown", "click", "auxclick", "keydown", "focusin"]) document.addEventListener(type, rewrite, true);
}

export const FLAGS = {
  // Ventelistevalg catalog layer: off until the author approves (PLAN.md open question 1).
  ventelistevalg: import.meta.env.VITE_FLAG_VENTELISTEVALG === "1",
};
