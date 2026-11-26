// UTM builder for every outbound Ventelistevalg link (PLAN.md section 8).
export const VV = "https://ventelistevalg.dk";

export function utm(path: string, content: string, medium = "map"): string {
  const u = new URL(path, VV);
  u.searchParams.set("utm_source", "koen");
  u.searchParams.set("utm_medium", medium);
  u.searchParams.set("utm_campaign", "launch");
  u.searchParams.set("utm_content", content);
  return u.toString();
}

export const fornyelsesradar = (kode: string) => utm("/fornyelsesradar", `kommune-${kode}`);
export const listerAndels = (kode: string) => utm("/lister/andels", `kommune-${kode}-andels`);
export const listerAlmene = (kode: string) => utm("/lister/almene", `kommune-${kode}-almene`);
export const legendLink = () => utm("/", "legend-rigtige-koeer", "legend");
export const footerLink = () => utm("/", "footer", "footer");

export const FLAGS = {
  // Ventelistevalg catalog layer: off until the author approves (PLAN.md open question 1).
  ventelistevalg: import.meta.env.VITE_FLAG_VENTELISTEVALG === "1",
};
