// Screenshot runner. node scripts/shots.mjs <spec.json | inline JSON>
// spec: [{ name, hash, w, h, out, intro?, js?, wait?, click? }]
// Requires the dev server (npm run dev) on http://localhost:5173.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const arg = process.argv[2] ?? "[]";
const specs = JSON.parse(arg.trim().startsWith("[") ? arg : readFileSync(arg, "utf8"));
const base = process.argv[3] ?? process.env.KOEN_URL ?? "http://localhost:5173/";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

const queue = [...specs];
const worker = async () => {
  while (queue.length) await shoot(queue.shift());
};
await Promise.all([worker(), worker(), worker()]);
await browser.close();

async function shoot(s) {
  {
    const mobile = (s.w ?? 1440) < 760;
    const page = await browser.newPage({ viewport: { width: s.w ?? 1440, height: s.h ?? 900 }, deviceScaleFactor: s.dpr ?? 1, isMobile: mobile, hasTouch: mobile });
    const logs = [];
    page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && logs.push(`console: ${m.text()}`));
    if (!s.intro) await page.addInitScript(() => localStorage.setItem("koen-intro-seen", "1"));
    if (s.reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
    if (s.dark) await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`${base}#${s.hash ?? ""}`);
    if (!s.intro) await page.waitForSelector("html[data-ready='1']", { timeout: 90000 }).catch(() => logs.push("not ready"));
    else await page.waitForSelector("#intro:not([hidden])", { timeout: 90000 }).catch(() => logs.push("intro not shown"));
    await page.waitForLoadState("networkidle").catch(() => {});
    for (const c of s.click ?? []) {
      await page.click(c);
      await page.waitForTimeout(800);
    }
    if (s.js) await page.evaluate(s.js);
    await page.waitForTimeout(s.wait ?? 3000);
    await page.screenshot({ path: s.out });
    console.log(`${s.out}${logs.length ? "\n  " + logs.slice(0, 6).join("\n  ") : ""}`);
    await page.close();
  }
}
