// Lighthouse on the production build, desktop and mobile, with Playwright's Chromium (CHROME_PATH).
// Usage: npm run build && node scripts/lighthouse.mjs <outDir> [label]
// Starts `vite preview` itself on 127.0.0.1:4180. Raw JSON goes to <outDir> (not committed); scores print to stdout.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "lighthouse-out");
const label = process.argv[3] ?? "run";
mkdirSync(out, { recursive: true });
const url = "http://127.0.0.1:4180/";
const server = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", "4180", "--strictPort"], { stdio: "ignore" });
try {
  for (let i = 0; i < 300; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const env = { ...process.env, CHROME_PATH: chromium.executablePath() };
  const flags = "--headless=new --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader";
  for (const ff of ["desktop", "mobile"]) {
    const file = join(out, `${label}-${ff}.json`);
    const args = ["--no-install", "lighthouse", url, `--chrome-flags=${flags}`, "--output=json", `--output-path=${file}`, "--quiet"];
    if (ff === "desktop") args.push("--preset=desktop");
    else args.push("--form-factor=mobile");
    const r = spawnSync("npx", args, { env, stdio: "inherit" });
    if (r.status !== 0) throw new Error(`lighthouse ${ff} exited ${r.status}`);
    const j = JSON.parse(readFileSync(file, "utf8"));
    const s = Object.fromEntries(Object.entries(j.categories).map(([k, c]) => [k, Math.round(c.score * 100)]));
    const m = (id) => j.audits[id]?.displayValue ?? "";
    console.log(`${label} ${ff}`, JSON.stringify(s), `FCP ${m("first-contentful-paint")} LCP ${m("largest-contentful-paint")} TBT ${m("total-blocking-time")} CLS ${m("cumulative-layout-shift")}`);
    const failed = Object.values(j.categories)
      .flatMap((c) => c.auditRefs.map((a) => j.audits[a.id]))
      .filter((a) => a && a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "manual")
      .map((a) => `${a.id} (${a.score})`);
    console.log("  below 0.9:", [...new Set(failed)].join(", "));
  }
} finally {
  server.kill();
}
