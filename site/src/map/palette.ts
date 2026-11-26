// PLAN.md section 10 palette. Terrain ramp: sand to oxblood.
export type RGB = [number, number, number];

export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Lowest stop darkened from the plan's #EEE6D2: it was almost the paper land colour (#F2EDE3), so the lowest kommuner vanished.
export const RAMP_DAY = ["#E7DABB","#E2D0A2", "#D6B176", "#C98B52", "#B2603F", "#863A35", "#4A1F2C"].map(hex);

function lighten([r, g, b]: RGB, f: number): RGB {
  return [r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f].map(Math.round) as RGB;
}
// Nattekort: same ramp lifted 8 % in lightness; the darkest step is lifted more so it reads on #1A2128.
export const RAMP_NIGHT = RAMP_DAY.map((c, i) => lighten(c, i >= 5 ? 0.16 : 0.08));

export const THEME = {
  day: {
    papir: "#F2EDE3",
    land: "#F2EDE3",
    hav: "#D3DEE0",
    blaek: "#1E242B",
    graa: "#8A8F93",
    maalt: "#2747E8",
    nodata: "#C9C2B4",
    ramp: RAMP_DAY,
    flat: hex("#E6DFD0"),
    road: "rgba(30,36,43,0.13)",
    label: "#5E6469",
    inflow: hex("#863A35"),
    outflow: hex("#1E242B"),
  },
  night: {
    papir: "#10151A",
    land: "#1A2128",
    hav: "#10151A",
    blaek: "#E8E2D6",
    graa: "#8A9096",
    maalt: "#7C93FF",
    nodata: "#3A434C",
    ramp: RAMP_NIGHT,
    flat: hex("#2A323A"),
    road: "rgba(232,226,214,0.10)",
    label: "#9AA1A8",
    inflow: hex("#E0806E"),
    outflow: hex("#E8E2D6"),
  },
};

export type ThemeName = keyof typeof THEME;

/** Continuous colour along the ramp for t in [0, 1]. */
export function rampColor(ramp: RGB[], t: number): RGB {
  const x = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(x));
  const f = x - i;
  const a = ramp[i];
  const b = ramp[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f].map(Math.round) as RGB;
}

export const css = (c: RGB, a = 1): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
