// Danish-first number formatting: 1.736.991 kr., 12,5 %.
import { lang } from "./i18n";

const cache = new Map<string, Intl.NumberFormat>();
function nf(dec: number): Intl.NumberFormat {
  const key = `${lang()}:${dec}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(lang() === "da" ? "da-DK" : "en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    cache.set(key, f);
  }
  return f;
}

export function num(v: number | null | undefined, dec = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return nf(dec).format(v);
}

export function withUnit(v: number | null | undefined, unit: string, dec = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  const s = num(v, dec);
  if (unit === "%") return `${s} %`;
  if (unit === "kr.") return `${s} kr.`;
  if (unit === "x") return `${s}×`;
  if (unit === "m²") return `${s} m²`;
  return `${s} ${unit}`;
}

/** "10 %" style share for top-percent statements. */
export function topPct(p: number): string {
  const v = Math.max(1, Math.round((1 - p) * 100));
  return `${v} %`;
}

export function signed(v: number | null, dec = 1): string {
  if (v === null) return "";
  const s = num(Math.abs(v), dec);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}
