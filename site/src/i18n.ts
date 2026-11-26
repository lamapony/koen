import { da, type Copy } from "./copy/da";
import { en } from "./copy/en";

let current: "da" | "en" = "da";

export function lang(): "da" | "en" {
  return current;
}

export function t(): Copy {
  return current === "da" ? da : en;
}

export function setLang(l: "da" | "en"): void {
  current = l;
  document.documentElement.lang = l;
}

/** Range word ("til" / "to"). */
export function to(): string {
  return current === "da" ? "til" : "to";
}

/** Periods from the pipeline are written in Danish ("2021K4 til 2026K4", "december 2025"). */
export function period(s: string): string {
  if (current === "da") return s;
  return s.replace(/ til /g, " to ").replace(/^december /, "December ").replace(/(\d{4})K(\d)/g, "$1Q$2");
}

/** Indicator label in the current language, from indicators.json. */
export function label(m: { da: string; en: string }): string {
  return current === "da" ? m.da : m.en;
}
