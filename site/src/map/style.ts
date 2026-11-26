// Custom MapLibre style on OpenFreeMap vector tiles (OpenMapTiles schema), stripped to
// water, a few roads, kommune lines from OSM and place labels. Paper and ink.
import type { StyleSpecification } from "maplibre-gl";
import { THEME, type ThemeName } from "./palette";

export const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

export function mapStyle(theme: ThemeName): StyleSpecification {
  const c = THEME[theme];
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      omt: { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: ATTRIBUTION },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": c.land } },
      { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": c.hav } },
      {
        id: "water-hatch",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        maxzoom: 9,
        paint: { "fill-pattern": "hav-hatch", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.9, 9, 0] },
      },
      {
        id: "water-edge",
        type: "line",
        source: "omt",
        "source-layer": "water",
        paint: { "line-color": c.blaek, "line-opacity": 0.22, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.3, 12, 0.8] },
      },
      {
        id: "roads",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary"]]],
        minzoom: 6,
        paint: { "line-color": c.road, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.4, 12, 1.6] },
      },
      {
        id: "kommune-lines",
        type: "line",
        source: "omt",
        "source-layer": "boundary",
        filter: ["all", ["==", ["get", "admin_level"], 7], ["!=", ["get", "maritime"], 1]],
        minzoom: 9,
        paint: { "line-color": c.blaek, "line-opacity": 0.35, "line-width": 0.6, "line-dasharray": [3, 2] },
      },
      {
        id: "place-labels",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
        minzoom: 7.5,
        layout: {
          "text-field": ["upcase", ["coalesce", ["get", "name:da"], ["get", "name"]]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 7, 9, 12, 12],
          "text-letter-spacing": 0.18,
          "text-max-width": 8,
        },
        paint: { "text-color": c.label, "text-halo-color": c.land, "text-halo-width": 1.4 },
      },
    ],
  };
}

/** 1 px hatch for the sea at low zoom, generated at runtime (no sprite file). */
export function hatchImage(theme: ThemeName): ImageData {
  const s = 8;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const g = cv.getContext("2d")!;
  g.fillStyle = THEME[theme].hav;
  g.fillRect(0, 0, s, s);
  g.strokeStyle = theme === "day" ? "rgba(30,36,43,0.10)" : "rgba(232,226,214,0.06)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, s - 0.5);
  g.lineTo(s, s - 0.5);
  g.stroke();
  return g.getImageData(0, 0, s, s);
}
