// Derived hex geometry: centres, kommune centroids, border and coast edges (computed once).
import { cellToLatLng, cellsToDirectedEdge, directedEdgeToBoundary, gridDisk, cellToBoundary } from "h3-js";
import type { AppData } from "../data";

export interface HexDatum {
  h: string;
  k: number; // kommune index
  lng: number;
  lat: number;
  delay: number; // intro stagger 0..1
}

export interface Edge {
  a: number; // kommune index
  b: number; // kommune index, or -1 for coast
  path: [number, number][];
}

export interface Geo {
  hexes: HexDatum[];
  centroid: [number, number][];
  edges: Edge[];
  perimeter: Map<number, Edge[]>;
}

export function buildGeo(d: AppData): Geo {
  const { ids, owner } = d.hexes;
  const n = ids.length;
  const nk = d.kommuner.length;
  const sum = Array.from({ length: nk }, () => [0, 0, 0]);
  const hexes: HexDatum[] = new Array(n);
  const ownerOf = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const [lat, lng] = cellToLatLng(ids[i]);
    hexes[i] = { h: ids[i], k: owner[i], lng, lat, delay: 0 };
    ownerOf.set(ids[i], owner[i]);
    const s = sum[owner[i]];
    s[0] += lng;
    s[1] += lat;
    s[2] += 1;
  }
  const centroid = sum.map((s) => [s[0] / s[2], s[1] / s[2]] as [number, number]);
  d.kommuner.forEach((k, i) => (k.centroid = centroid[i]));

  const edges: Edge[] = [];
  for (let i = 0; i < n; i++) {
    const h = ids[i];
    const a = owner[i];
    for (const nb of gridDisk(h, 1)) {
      if (nb === h) continue;
      const b = ownerOf.get(nb);
      if (b === a) continue;
      if (b !== undefined && nb < h) continue; // each interior edge once
      const e = cellsToDirectedEdge(h, nb);
      const path = directedEdgeToBoundary(e).map(([la, lo]) => [lo, la] as [number, number]);
      edges.push({ a, b: b ?? -1, path });
    }
  }
  const perimeter = new Map<number, Edge[]>();
  for (const e of edges) {
    for (const k of [e.a, e.b]) {
      if (k < 0) continue;
      let arr = perimeter.get(k);
      if (!arr) perimeter.set(k, (arr = []));
      arr.push(e);
    }
  }
  return { hexes, centroid, edges, perimeter };
}

/** Intro stagger: distance from an origin kommune, normalised to 0..1. */
export function setDelays(geo: Geo, origin: [number, number]): void {
  let max = 0;
  const cos = Math.cos((56 * Math.PI) / 180);
  for (const h of geo.hexes) {
    const dx = (h.lng - origin[0]) * cos;
    const dy = h.lat - origin[1];
    h.delay = Math.sqrt(dx * dx + dy * dy);
    if (h.delay > max) max = h.delay;
  }
  for (const h of geo.hexes) h.delay /= max || 1;
}

export function hexPolygon(h: string): [number, number][] {
  return cellToBoundary(h).map(([la, lo]) => [lo, la] as [number, number]);
}
