// View modes (PLAN.md section 4). One map, one terrain, many lenses.
import type { AppData } from "../data";
import { pctRank } from "../model";

// "measured" is reserved for real waiting lists (drawn in blue). Published DST counts and rates are "register".
export type ModeKind = "modelled" | "measured" | "register" | "derived" | "projection" | "meta";
export type ModeGroup = "koen" | "boliger" | "pris" | "befolkning";

export interface ModeResult {
  values: (number | null)[]; // value per kommune (display)
  rank: (number | null)[]; // 0..1 per kommune, drives height and colour
  unit: string;
  dec: number;
  tables: string[];
  period: string;
  indicator?: string; // indicator id for labels/formula
}

export interface ModeDef {
  id: string;
  kind: ModeKind;
  /** Section in the mode rail. MODES is ordered by group, so numbering follows the rail. */
  group: ModeGroup;
  /** Optional toggle (e.g. count vs share). */
  alt?: boolean;
  compute(d: AppData, ctx: { koetryk: number[]; alt: boolean }): ModeResult;
}

function fromIndicator(id: string, d: AppData): ModeResult {
  const m = d.ind.get(id)!;
  const values = d.kommuner.map((k) => k.ind[id] ?? null);
  return { values, rank: pctRank(values), unit: m.unit, dec: m.dec, tables: m.tables, period: m.period, indicator: id };
}

const ind = (id: string, altId?: string): ((d: AppData, c: { alt: boolean }) => ModeResult) =>
  (d, c) => fromIndicator(c.alt && altId ? altId : id, d);

export const MODES: ModeDef[] = [
  {
    id: "koetryk",
    kind: "modelled",
    group: "koen",
    compute(d, { koetryk }) {
      const ids = d.meta.index.ids;
      const tables = [...new Set(ids.flatMap((i) => d.ind.get(i)!.tables))];
      const per = d.ind.get("D1")!.period;
      return { values: koetryk, rank: koetryk, unit: "", dec: 2, tables, period: per };
    },
  },
  {
    id: "maalt",
    kind: "measured",
    group: "koen",
    compute(d) {
      const values = d.kommuner.map((k) => (k.maalt ? k.maalt[0].maxList : null));
      return { values, rank: values.map(() => null), unit: "personer", dec: 0, tables: ["Aarhusbolig"], period: "2017" };
    },
  },
  {
    id: "usikkerhed",
    kind: "meta",
    group: "koen",
    compute(d) {
      const values = d.kommuner.map((k) => (k.koetrykBand[1] - k.koetrykBand[0]) * 100);
      return { values, rank: pctRank(values), unit: "pp", dec: 0, tables: ["FOLK1A", "BOL101", "FRKM126", "EJDFOE1", "INDKP106", "BYGV33"], period: "200 vægtsæt" };
    },
  },
  { id: "andel", kind: "register", group: "boliger", alt: true, compute: ind("ANDEL_N", "ANDEL_PCT") },
  { id: "almen", kind: "register", group: "boliger", alt: true, compute: ind("ALMEN_N", "ALMEN_PCT") },
  { id: "voksne", kind: "derived", group: "boliger", compute: ind("D1") },
  { id: "tomme", kind: "register", group: "boliger", compute: ind("S2") },
  { id: "nybyggeri", kind: "register", group: "boliger", alt: true, compute: ind("S1", "NYBYG_AA") },
  { id: "andelsvaerdi", kind: "register", group: "pris", compute: ind("ANDELSVAERDI") },
  { id: "vaerdiIndkomst", kind: "derived", group: "pris", compute: ind("P1") },
  { id: "boligstoette", kind: "register", group: "pris", compute: ind("BOLIGSTOETTE") },
  { id: "vaekst", kind: "register", group: "befolkning", compute: ind("D2") },
  { id: "y2036", kind: "projection", group: "befolkning", compute: ind("D3") },
  { id: "unge", kind: "register", group: "befolkning", compute: ind("D4") },
  { id: "flyt", kind: "register", group: "befolkning", compute: ind("NETFLYT") },
];

export const MODE_BY_ID = new Map(MODES.map((m) => [m.id, m]));
