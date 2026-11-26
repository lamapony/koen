export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

/** Keep Tab and Shift+Tab inside a modal dialog. Call from its keydown handler. */
export function trapTab(e: KeyboardEvent, el: HTMLElement): void {
  if (e.key !== "Tab") return;
  const f = [...el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')].filter(
    (x) => x.offsetParent !== null,
  );
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  const a = document.activeElement;
  if (e.shiftKey && (a === first || !el.contains(a))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (a === last || !el.contains(a))) {
    e.preventDefault();
    first.focus();
  }
}

export const icon = {
  search: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.4 10.4 14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  table: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3.5h12M2 8h12M2 12.5h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 9.8A5.5 5.5 0 0 1 6.2 3a5.5 5.5 0 1 0 6.8 6.8Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  sun: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  link: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5l3-3M7 4.5l1.2-1.2a2.6 2.6 0 0 1 3.7 3.7L10.7 8.2M9 11.5l-1.2 1.2a2.6 2.6 0 0 1-3.7-3.7L5.3 7.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  download: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  home: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 13.5 6 6l3 4.5 2-3 2.5 6Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
};

let toastTimer = 0;
export function toast(msg: string): void {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("on"), 1800);
}

export function announce(msg: string): void {
  const el = $("live");
  el.textContent = "";
  requestAnimationFrame(() => (el.textContent = msg));
}

/** Small SVG sparkline. */
export function sparkline(values: (number | null)[], w = 72, h = 18): string {
  const pts = values.map((v, i) => [i, v] as const).filter(([, v]) => v !== null) as [number, number][];
  if (pts.length < 2) return "";
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x: number) => 1 + ((x - x0) / (x1 - x0 || 1)) * (w - 4);
  const sy = (y: number) => h - 2 - ((y - y0) / (y1 - y0 || 1)) * (h - 4);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join("");
  const [lx, ly] = pts[pts.length - 1];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}"/><circle cx="${sx(lx).toFixed(1)}" cy="${sy(ly).toFixed(1)}" r="1.8"/></svg>`;
}
