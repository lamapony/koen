// The map: MapLibre basemap + deck.gl terrain interleaved via MapboxOverlay.
import * as maplibregl from "maplibre-gl";
import type { Map as MLMap, MapStyleImageMissingEvent, ErrorEvent as MLErrorEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { Deck, MapView, LightingEffect, AmbientLight, DirectionalLight, type Layer, type PickingInfo } from "@deck.gl/core";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { PathLayer, PolygonLayer, ColumnLayer, TextLayer, LineLayer, ArcLayer, GeoJsonLayer } from "@deck.gl/layers";
import { FillStyleExtension } from "@deck.gl/extensions";
import type { AppData, MeasuredPoint } from "../data";
import type { Geo, HexDatum, Edge } from "./geometry";
import { hexPolygon } from "./geometry";
import { mapStyle, hatchImage } from "./style";
import { THEME, rampColor, hex as hexToRgb, type RGB, type ThemeName } from "./palette";

export const H_MAX = 48000; // deck elevation units at country zoom; tuned visually, no real-world meaning
const BASE = 0.025; // thin plinth so the lowest kommuner still read as land

export interface RenderInput {
  theme: ThemeName;
  modeId: string;
  rank: (number | null)[];
  labels: { k: number; text: string }[];
  hover: number;
  selected: number;
  brushed: Set<number>;
  flows: { from: number; to: number; v: number; dir: "in" | "out" }[];
  kk: GeoJSON.FeatureCollection | null;
  needles: MeasuredPoint[] | null;
  needleLabel: (p: MeasuredPoint) => string;
  reducedMotion: boolean;
}

export interface MapController {
  map: MLMap;
  render(input: RenderInput): void;
  intro(): Promise<void>;
  setTheme(t: ThemeName): void;
  flyTo(opts: { center: [number, number]; zoom: number; pitch?: number; bearing?: number }): void;
  home(): void;
  zoom(): number;
  setCardOpen(open: boolean, k?: number): void;
  onPick(cb: (k: number | null, info: { x: number; y: number } | null, kind: "hover" | "click") => void): void;
  onTip(cb: (layer: string | null, obj: unknown, at: { x: number; y: number } | null) => void): void;
}

const lighting = new LightingEffect({
  ambient: new AmbientLight({ color: [255, 255, 255], intensity: 1.0 }),
  // North-west light (cartographic convention): points towards south-east and down.
  sun: new DirectionalLight({ color: [255, 248, 236], intensity: 0.9, direction: [1, -1.2, -1.4] }),
});

const material = { ambient: 0.74, diffuse: 0.42, shininess: 4, specularColor: [20, 20, 20] as [number, number, number] };

function hatchAtlas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#000";
  g.lineWidth = 2;
  g.beginPath();
  for (let i = -16; i <= 32; i += 6) {
    g.moveTo(i, 16);
    g.lineTo(i + 16, 0);
  }
  g.stroke();
  return c;
}

export function homeView(mobile: boolean) {
  return mobile
    ? { center: [10.35, 56.05] as [number, number], zoom: 5.55, pitch: 35, bearing: -8 }
    : { center: [10.55, 55.95] as [number, number], zoom: 6.55, pitch: 52, bearing: -14 };
}

export function createMap(container: HTMLElement, inset: HTMLElement, d: AppData, geo: Geo, opts: { theme: ThemeName; mobile: boolean; reducedMotion: boolean; cam?: string }): MapController {
  let theme = opts.theme;
  const home = homeView(opts.mobile);
  // prefers-reduced-motion: 2D map by default (heights still carry the data as colour + contours).
  let view = opts.reducedMotion ? { ...home, pitch: 0, bearing: 0 } : home;
  if (opts.cam) {
    const [lng, lat, zoom, pitch, bearing] = opts.cam.split(",").map(Number);
    view = { center: [lng, lat], zoom, pitch, bearing };
  }
  const map = new maplibregl.Map({
    container,
    style: mapStyle(theme),
    center: view.center,
    zoom: view.zoom,
    pitch: view.pitch,
    bearing: view.bearing,
    maxPitch: 70,
    minZoom: 4.5,
    maxZoom: 14,
    attributionControl: false,
    dragRotate: true,
    touchPitch: true,
    cooperativeGestures: false,
  });
  if (!opts.mobile) map.setPadding({ left: 312, top: 0, right: 0, bottom: 0 }); // the paper sheet column
  map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
  map.on("styleimagemissing", (e: MapStyleImageMissingEvent) => {
    if (e.id === "hav-hatch" && !map.hasImage("hav-hatch")) map.addImage("hav-hatch", hatchImage(theme));
  });
  map.on("style.load", () => {
    if (!map.hasImage("hav-hatch")) map.addImage("hav-hatch", hatchImage(theme));
  });
  map.on("error", (e: MLErrorEvent) => {
    const msg = String(e.error?.message ?? "");
    if (/tiles|fetch|Failed|NetworkError|glyph/i.test(msg)) container.dispatchEvent(new CustomEvent("tiles-error"));
  });

  const overlay = new MapboxOverlay({ interleaved: true, effects: [lighting], layers: [] });
  map.addControl(overlay as unknown as maplibregl.IControl);

  // Bornholm inset: its own small deck canvas so Bornholm is never cut off.
  const bornholm = d.byKode.get("0400")!;
  const insetDeck = new Deck({
    parent: inset as HTMLDivElement,
    views: new MapView({ repeat: false }),
    initialViewState: { longitude: 14.92, latitude: 55.14, zoom: opts.mobile ? 6.35 : 6.95, pitch: Math.min(view.pitch, 45), bearing: view.bearing },
    controller: false,
    effects: [lighting],
    layers: [],
    useDevicePixels: true,
    getCursor: () => "pointer",
    onClick: () => pickCb?.(bornholm.i, null, "click"),
  });

  let targetPadding = opts.mobile ? { left: 0, top: 0, right: 0, bottom: 0 } : { left: 312, top: 0, right: 0, bottom: 0 };
  let pickCb: ((k: number | null, info: { x: number; y: number } | null, kind: "hover" | "click") => void) | null = null;
  let tipCb: ((layer: string | null, obj: unknown, at: { x: number; y: number } | null) => void) | null = null;
  let last: RenderInput | null = null;
  let introT = opts.reducedMotion ? Infinity : -1; // -1 = not started (flat)
  const pattern = hatchAtlas();
  const bornholmHexes = geo.hexes.filter((h) => h.k === bornholm.i);
  const bornholmCoast = geo.edges.filter((e) => e.a === bornholm.i || e.b === bornholm.i);
  const kkKommuner = new Set([d.byKode.get("0101")!.i, d.byKode.get("0147")!.i]);
  const hexesNoKK = geo.hexes.filter((h) => !kkKommuner.has(h.k));

  function es(): number {
    const z = map.getZoom();
    // Shrink faster than the zoom grows, so city views read as gentle relief instead of towers.
    return Math.max(0.02, Math.min(1.25, Math.pow(2, -(z - 6.55) * 1.3)));
  }

  function introFactor(h: HexDatum): number {
    if (introT === Infinity) return 1;
    if (introT < 0) return 0;
    const x = Math.max(0, Math.min(1, (introT - h.delay * 0.6) / 1.0));
    return 1 - Math.pow(1 - x, 5); // close to cubic-bezier(0.23, 1, 0.32, 1)
  }

  // Mode switch morph: heights and colours interpolate from the previous ranks (450 ms).
  let fromRank: (number | null)[] | null = null;
  let morphT = 1;
  let morphRaf = 0;
  function rankOf(inp: RenderInput, k: number): number | null {
    const to = inp.rank[k];
    if (morphT >= 1 || !fromRank) return to;
    const from = fromRank[k];
    if (from === null || to === null) return to;
    const e = 1 - Math.pow(1 - morphT, 3);
    return from + (to - from) * e;
  }
  function startMorph(prev: (number | null)[]): void {
    if (opts.reducedMotion || introT !== Infinity) return;
    fromRank = prev;
    morphT = 0;
    const t0 = performance.now();
    cancelAnimationFrame(morphRaf);
    const tick = () => {
      morphT = Math.min(1, (performance.now() - t0) / 450);
      draw();
      if (morphT < 1) morphRaf = requestAnimationFrame(tick);
    };
    morphRaf = requestAnimationFrame(tick);
  }

  function elevOf(inp: RenderInput, k: number): number {
    const r = rankOf(inp, k);
    let h = inp.modeId === "maalt" ? BASE * 0.6 : r === null ? 0 : BASE + (1 - BASE) * Math.pow(r, 1.6);
    if (k === inp.hover) h *= 1.04;
    if (k === inp.selected) h *= 1.04;
    if (inp.brushed.has(k)) h = h * 1.12 + 0.04;
    return h * H_MAX;
  }

  function colorOf(inp: RenderInput, k: number): [number, number, number, number] {
    const T = THEME[inp.theme];
    const r = rankOf(inp, k);
    let c: RGB = inp.modeId === "maalt" ? T.flat : r === null ? hexToRgb(T.papir) : rampColor(T.ramp, r);
    let a = 255;
    if (inp.brushed.size && !inp.brushed.has(k)) a = 110;
    if (k === inp.hover || k === inp.selected) c = c.map((v) => Math.min(255, v + 14)) as RGB;
    return [c[0], c[1], c[2], a];
  }

  function decile(r: number | null): number {
    return r === null ? -1 : Math.min(9, Math.floor(r * 10));
  }

  /** Screen box not covered by the paper sheet, the card, the toolbar or the bottom chrome. */
  function visibleBox(): { x0: number; y0: number; x1: number; y1: number } {
    const c = map.getContainer();
    const pad = map.getPadding();
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (opts.mobile) return { x0: 8, y0: 84, x1: w - 8, y1: h - (pad.bottom || 90) - 8 };
    return { x0: (pad.left ?? 0) + 24, y0: 70, x1: w - (pad.right ?? 0) - 24, y1: h - 48 };
  }
  function inBox(p: { x: number; y: number }, halfW: number, box = visibleBox()): boolean {
    return p.x - halfW >= box.x0 && p.x + halfW <= box.x1 && p.y >= box.y0 && p.y <= box.y1;
  }

  function layers(inp: RenderInput, forInset = false): Layer[] {
    const T = THEME[inp.theme];
    const ink = hexToRgb(T.blaek);
    const scale = forInset ? 1 : es();
    // Close zoom on København/Frederiksberg in the almene lens: hexes give way to the real afdeling polygons.
    const kkZoom = !forInset && !!inp.kk && map.getZoom() >= 10;
    const hexData = forInset ? bornholmHexes : kkZoom ? hexesNoKK : geo.hexes;
    const trig = [inp.rank, inp.hover, inp.selected, inp.brushed, inp.modeId, inp.theme, introT, morphT];
    const out: Layer[] = [];
    const before = forInset ? {} : { beforeId: "place-labels" };

    out.push(
      new H3HexagonLayer<HexDatum>({
        id: "hex",
        data: hexData,
        getHexagon: (h) => h.h,
        extruded: true,
        // Gaps between cells only once a cell is big enough to read as one; at country zoom they become a dot screen.
        coverage: forInset || map.getZoom() < 8 ? 1 : 0.93,
        elevationScale: scale,
        getElevation: (h) => elevOf(inp, h.k) * introFactor(h),
        getFillColor: (h) => colorOf(inp, h.k),
        material,
        pickable: true,
        highPrecision: false,
        updateTriggers: { getElevation: trig, getFillColor: trig },
        ...before,
      }) as unknown as Layer,
    );

    // Unknown values: flat hatched hexes, never zero-height terrain pretending to be data.
    if (inp.modeId !== "maalt") {
      const nulls = hexData.filter((h) => inp.rank[h.k] === null);
      if (nulls.length) {
        out.push(
          new PolygonLayer<HexDatum>({
            id: "nodata",
            data: nulls,
            getPolygon: (h: HexDatum) => hexPolygon(h.h),
            getFillColor: hexToRgb(T.nodata),
            filled: true,
            stroked: false,
            fillPatternAtlas: pattern,
            fillPatternMapping: { hatch: { x: 0, y: 0, width: 16, height: 16, mask: true } },
            getFillPattern: () => "hatch",
            getFillPatternScale: 0.5,
            extensions: [new FillStyleExtension({ pattern: true })],
            updateTriggers: { getFillColor: [inp.theme] },
            ...before,
          } as never) as unknown as Layer,
        );
      }
    }

    // Contours: ink lines on the ground where the decile changes, plus the hex coastline.
    const edges = forInset ? bornholmCoast : geo.edges;
    const contourEdges = inp.modeId === "maalt" ? edges.filter((e) => e.b < 0) : edges.filter((e) => e.b < 0 || decile(inp.rank[e.a]) !== decile(inp.rank[e.b]));
    out.push(
      new PathLayer<Edge>({
        id: "contours",
        data: contourEdges,
        getPath: (e) => e.path,
        getColor: (e) => [...ink, e.b < 0 ? 150 : 95] as [number, number, number, number],
        getWidth: (e) => (e.b < 0 ? 0.9 : 0.5 + 0.35 * Math.abs(decile(inp.rank[e.a]) - decile(inp.rank[e.b]))),
        widthUnits: "pixels",
        capRounded: true,
        updateTriggers: { getColor: [inp.theme], getWidth: [inp.rank] },
        ...before,
      }),
    );

    if (forInset) return out;

    // Hover and selection: ink outline on top of the mesa.
    const outlined = [...new Set([inp.hover, inp.selected, ...inp.brushed])].filter((k) => k >= 0);
    const outlineEdges: { path: [number, number, number][]; w: number }[] = [];
    for (const k of outlined) {
      const z = elevOf(inp, k) * scale + 30;
      const w = k === inp.selected ? 2.4 : k === inp.hover ? 1.8 : 1.4;
      for (const e of geo.perimeter.get(k) ?? []) {
        if (e.a === k && e.b === k) continue;
        outlineEdges.push({ path: e.path.map(([x, y]) => [x, y, z]), w });
      }
    }
    out.push(
      new PathLayer<{ path: [number, number, number][]; w: number }>({
        id: "outline",
        data: outlineEdges,
        getPath: (e) => e.path,
        getColor: [...ink, 235],
        getWidth: (e) => e.w,
        widthUnits: "pixels",
        capRounded: true,
        parameters: { depthTest: false } as never,
      }),
    );

    if (inp.kk && map.getZoom() >= 10) {
      out.push(
        new GeoJsonLayer({
          id: "kk",
          data: inp.kk,
          extruded: true,
          getElevation: (f: GeoJSON.Feature) => 8 + Math.sqrt(Number(f.properties?.tot ?? 0)) * 6,
          getFillColor: (f: GeoJSON.Feature) => [...rampColor(T.ramp, Math.min(1, Math.sqrt(Number(f.properties?.tot ?? 0)) / 40)), 235] as [number, number, number, number],
          getLineColor: [...ink, 160],
          lineWidthMinPixels: 0.5,
          material,
          pickable: true,
        }),
      );
    }

    if (inp.needles) {
      const maalt = hexToRgb(T.maalt);
      // Greedy screen-space collision, longest list first, so the Aarhus postcodes do not stack into one blot.
      const needleLabels = (pts: MeasuredPoint[]): MeasuredPoint[] => {
        const box = visibleBox();
        const kept: { x0: number; x1: number; y: number }[] = [];
        return [...pts]
          .filter((p) => p.maxList >= 5000 || map.getZoom() > 9.5)
          .sort((a, b) => b.maxList - a.maxList)
          .filter((p) => {
            const q = map.project([p.lon, p.lat]);
            const w = inp.needleLabel(p).length * 7 + 14;
            const x0 = q.x + 6;
            const x1 = x0 + w;
            if (x0 < box.x0 || x1 > box.x1 || q.y < box.y0 || q.y > box.y1) return false;
            const clash = kept.some((o) => x0 < o.x1 + 4 && x1 > o.x0 - 4 && Math.abs(o.y - q.y) < 30);
            if (!clash) kept.push({ x0, x1, y: q.y });
            return !clash;
          });
      };
      // Own scale (log of people on the longest list), independent of the modelled terrain.
      const ns = Math.max(0.05, Math.min(1.2, Math.pow(2, -(map.getZoom() - 6.55) * 0.95)));
      const z = (p: MeasuredPoint) => Math.log10(p.maxList + 1) * 11000 * ns;
      out.push(
        new ColumnLayer<MeasuredPoint>({
          id: "needles",
          data: inp.needles,
          getPosition: (p) => [p.lon, p.lat],
          diskResolution: 12,
          radius: 4.5,
          radiusUnits: "pixels",
          extruded: true,
          getElevation: (p) => z(p),
          getFillColor: [...maalt, 255],
          material,
          pickable: true,
          updateTriggers: { getElevation: [scale] },
        }),
        new TextLayer<MeasuredPoint>({
          id: "needle-labels",
          data: needleLabels(inp.needles),
          getPosition: (p) => [p.lon, p.lat, z(p) + 300 * ns],
          getText: (p) => inp.needleLabel(p),
          getColor: [...maalt, 255],
          getSize: 11,
          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          fontWeight: 500,
          characterSet: "auto",
          getTextAnchor: "start",
          getAlignmentBaseline: "bottom",
          getPixelOffset: [6, 0],
          background: true,
          getBackgroundColor: [...hexToRgb(T.land), 215] as [number, number, number, number],
          backgroundPadding: [3, 1, 3, 1],
          parameters: { depthTest: false } as never,
          updateTriggers: { getPosition: [scale], getText: [inp.needleLabel] },
        }),
      );
    }

    if (inp.flows.length) {
      out.push(
        new ArcLayer<{ from: number; to: number; v: number; dir: "in" | "out" }>({
          id: "arcs",
          data: inp.flows,
          getSourcePosition: (f) => [...geo.centroid[f.from], elevOf(inp, f.from) * scale] as [number, number, number],
          getTargetPosition: (f) => [...geo.centroid[f.to], elevOf(inp, f.to) * scale] as [number, number, number],
          getSourceColor: (f) => [...(f.dir === "in" ? T.inflow : T.outflow), 70] as [number, number, number, number],
          getTargetColor: (f) => [...(f.dir === "in" ? T.inflow : T.outflow), 235] as [number, number, number, number],
          getWidth: (f) => 1 + Math.sqrt(f.v) / 9,
          getHeight: 0.6,
          widthUnits: "pixels",
          parameters: { depthTest: false } as never,
        }),
      );
    }

    // Spot-height labels for the top kommuner of the current mode.
    if (inp.labels.length) {
      const pos = (k: number): [number, number, number] => [...geo.centroid[k], elevOf(inp, k) * scale];
      // Stagger leader heights so neighbouring spot heights (e.g. the Copenhagen suburbs) separate.
      const lift = (i: number) => (7000 + (i % 4) * 9000) * scale;
      // Greedy screen-space collision: keep higher-ranked labels, drop ones whose anchors crowd them.
      const kept: { x: number; y: number }[] = [];
      const box = visibleBox();
      const lab = inp.labels
        .map((l, i) => ({ ...l, i }))
        .filter((l) => {
          const p = map.project(geo.centroid[l.k] as [number, number]);
          const w = l.text.length * 7 + 12;
          // Never under the sheet, the card or past the screen edge.
          if (!inBox(p, w / 2, box)) return false;
          const clash = kept.some((q) => Math.abs(q.x - p.x) < w && Math.abs(q.y - p.y) < 48);
          if (!clash) kept.push(p);
          return !clash;
        })
        .map((l, i) => ({ ...l, i }));
      out.push(
        new LineLayer<{ k: number; i: number }>({
          id: "leaders",
          data: lab,
          getSourcePosition: (l) => pos(l.k),
          getTargetPosition: (l) => {
            const p = pos(l.k);
            return [p[0], p[1], p[2] + lift(l.i)];
          },
          getColor: [...ink, 200],
          getWidth: 1,
          widthUnits: "pixels",
          parameters: { depthTest: false } as never,
          updateTriggers: { getSourcePosition: trig.concat(scale), getTargetPosition: trig.concat(scale) },
        }),
        new TextLayer<{ k: number; text: string; i: number }>({
          id: "labels",
          data: lab,
          getPosition: (l) => {
            const p = pos(l.k);
            return [p[0], p[1], p[2] + lift(l.i)];
          },
          getText: (l) => l.text,
          getColor: [...ink, 255],
          getSize: 11,
          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          fontWeight: 500,
          characterSet: "auto",
          getTextAnchor: "middle",
          getAlignmentBaseline: "bottom",
          getPixelOffset: [0, -3],
          background: true,
          getBackgroundColor: [...hexToRgb(T.land), 225] as [number, number, number, number],
          backgroundPadding: [4, 2, 4, 1],
          parameters: { depthTest: false } as never,
          updateTriggers: { getPosition: trig.concat(scale), getText: [inp.labels], getColor: [inp.theme], getBackgroundColor: [inp.theme] },
        }),
      );
    }
    return out;
  }

  function draw(): void {
    if (!last) return;
    overlay.setProps({ layers: layers(last) });
    insetDeck.setProps({ layers: layers(last, true) });
  }

  overlay.setProps({
    onHover: (info: PickingInfo) => {
      const id = info.layer?.id;
      if ((id === "kk" || id === "needles") && info.object) {
        tipCb?.(id, info.object, { x: info.x, y: info.y });
        return;
      }
      tipCb?.(null, null, null);
      const obj = info.object as HexDatum | undefined;
      const k = id === "hex" && obj ? obj.k : null;
      pickCb?.(k, info.picked ? { x: info.x, y: info.y } : null, "hover");
    },
    onClick: (info: PickingInfo) => {
      const obj = info.object as HexDatum | MeasuredPoint | undefined;
      if (info.layer?.id === "hex" && obj) pickCb?.((obj as HexDatum).k, { x: info.x, y: info.y }, "click");
      else if (info.layer?.id === "needles" && obj) {
        const k = d.byKode.get((obj as MeasuredPoint).kode);
        if (k) pickCb?.(k.i, { x: info.x, y: info.y }, "click");
      } else if (!info.picked) pickCb?.(null, null, "click");
    },
    getCursor: ({ isHovering, isDragging }: { isHovering: boolean; isDragging: boolean }) => (isDragging ? "grabbing" : isHovering ? "pointer" : "grab"),
  } as never);

  let zoomRaf = 0;
  map.on("zoom", () => {
    cancelAnimationFrame(zoomRaf);
    zoomRaf = requestAnimationFrame(draw);
  });
  map.on("moveend", () => draw());
  map.on("rotate", () => insetDeck.setProps({ viewState: { ...insetView(), bearing: map.getBearing() } }));
  map.on("pitch", () => insetDeck.setProps({ viewState: { ...insetView(), pitch: Math.min(45, map.getPitch()) } }));
  function insetView() {
    return { longitude: 14.92, latitude: 55.14, zoom: opts.mobile ? 6.35 : 6.95, pitch: Math.min(45, map.getPitch()), bearing: map.getBearing() };
  }

  return {
    map,
    render(input) {
      const prev = last;
      last = input;
      if (prev && prev.rank !== input.rank && prev.modeId !== "maalt" && input.modeId !== "maalt") {
        // Start from what is on screen right now (mid-morph included).
        const shown = prev.rank.map((_, k) => rankOf(prev, k));
        startMorph(shown);
      }
      draw();
    },
    intro() {
      return new Promise((resolve) => {
        if (introT === Infinity) return resolve();
        const t0 = performance.now();
        const tick = () => {
          introT = (performance.now() - t0) / 1000;
          if (introT >= 1.65) {
            introT = Infinity;
            draw();
            return resolve();
          }
          draw();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },
    setTheme(t) {
      theme = t;
      if (map.hasImage("hav-hatch")) map.removeImage("hav-hatch");
      map.setStyle(mapStyle(t), { diff: false });
    },
    flyTo(o) {
      // Carry the padding the card wants, so an interrupted card ease cannot leave it half way.
      const p = { ...o, padding: targetPadding };
      if (opts.reducedMotion) map.jumpTo(p);
      else map.flyTo({ ...p, duration: 1600, essential: false });
    },
    home() {
      const h = homeView(opts.mobile);
      if (opts.reducedMotion) map.jumpTo({ ...h, pitch: 0, bearing: 0 });
      else map.flyTo({ ...h, duration: 1200 });
    },
    zoom: () => map.getZoom(),
    setCardOpen(open: boolean, k?: number) {
      const duration = opts.reducedMotion ? 0 : 450;
      if (opts.mobile) {
        // The half sheet covers the lower 56 % of the screen: bring the selected kommune into the top part.
        const bottom = open ? Math.round(map.getContainer().clientHeight * 0.56) : 0;
        targetPadding = { top: open ? 70 : 0, left: 0, right: 0, bottom };
        if (open && k !== undefined && k >= 0) map.easeTo({ center: geo.centroid[k] as [number, number], padding: targetPadding, duration });
        else if (map.getPadding().bottom !== bottom) map.easeTo({ padding: targetPadding, duration });
        return;
      }
      const right = open ? 400 : 0;
      const padding = { left: 312, top: 0, right, bottom: 0 };
      targetPadding = padding;
      // Pan only when the kommune would sit under the card or the sheet.
      let center: [number, number] | undefined;
      if (open && k !== undefined && k >= 0) {
        const c = geo.centroid[k] as [number, number];
        // Where it will be once the new padding has shifted the view (half the padding change).
        const x = map.project(c).x - (right - (map.getPadding().right ?? 0)) / 2;
        const w = map.getContainer().clientWidth;
        if (x < 312 + 40 || x > w - right - 40) center = c;
      }
      if (map.getPadding().right === right && !center) return;
      map.easeTo({ padding, ...(center ? { center } : {}), duration });
    },
    onPick(cb) {
      pickCb = cb;
    },
    onTip(cb) {
      tipCb = cb;
    },
  };
}
