import { defineConfig } from "vite";

// Vendor code in its own long-lived chunks: MapLibre (a prebuilt UMD bundle, cannot be tree-shaken),
// deck.gl with luma.gl and friends, and h3-js. They download in parallel and stay cached across app releases.
const groups = [
  // Vite's dynamic-import helper is shared by the app and deck.gl; without its own group it lands in vendor-deck
  // and the entry would have to wait for the whole deck chunk.
  { name: "preload-helper", test: /vite\/preload-helper/, priority: 40 },
  { name: "vendor-h3", test: /node_modules[\\/]h3-js[\\/]/, priority: 30 },
  { name: "vendor-maplibre", test: /node_modules[\\/]maplibre-gl[\\/]/, priority: 20 },
  { name: "vendor-deck", test: /node_modules[\\/](@deck\.gl|@luma\.gl|@math\.gl|@loaders\.gl|@probe\.gl|mjolnir\.js|earcut|@mapbox)[\\/]/, priority: 10 },
];

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1300,
    rolldownOptions: { output: { codeSplitting: { groups } } },
  },
  server: { port: 5173 },
});
