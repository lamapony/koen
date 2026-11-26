import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4179', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 600; i++) {
    try { if ((await fetch('http://127.0.0.1:4179/')).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('koen-intro-seen', '1'));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:4179/');
  await page.waitForSelector('#app[data-loading="false"]', { timeout: 30000 });
  assert.ok(await page.locator('#modes').innerText());
  assert.match(await page.locator('#legend').innerText(), /modelleret/i);

  // First screen: about ten lenses plus a closed "Flere visninger" disclosure, and the rail does not scroll at 1440 x 900.
  const rail = await page.evaluate(() => {
    const el = document.getElementById('modes');
    const det = document.getElementById('more-modes');
    return { overflow: el.scrollHeight - el.clientHeight, primary: el.querySelectorAll(':scope > button.chip').length, open: det.open, more: det.querySelectorAll('button.chip').length };
  });
  assert.ok(rail.primary >= 9 && rail.primary <= 11, `primary lenses ${rail.primary}`);
  assert.equal(rail.open, false);
  assert.ok(rail.more >= 1);
  assert.ok(rail.overflow <= 1, `mode rail overflows by ${rail.overflow}px at 1440x900`);

  // Kommune card: Ventelistevalg links carry UTM tags, and utm_campaign follows the view at click time.
  await page.evaluate(() => window.__koen.set({ k: '0101' }));
  await page.waitForSelector('#card .sec.vv a[href*="/lister/andels/bydel/noerrebro"]');
  const hrefs = await page.$$eval('#card a[href^="https://ventelistevalg.dk"]', as => as.map(a => a.href));
  assert.ok(hrefs.length >= 10, `card links ${hrefs.length}`);
  for (const h of hrefs) {
    const u = new URL(h);
    assert.equal(u.searchParams.get('utm_source'), 'koen');
    assert.equal(u.searchParams.get('utm_medium'), 'map');
    assert.ok(u.searchParams.get('utm_campaign'));
  }
  await page.evaluate(() => window.__koen.set({ mode: 'unge' }));
  await page.waitForTimeout(200);
  const campaign = await page.evaluate(() => {
    const a = document.querySelector('#card .cta .go');
    a.addEventListener('click', e => e.preventDefault(), { once: true });
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return new URL(a.href).searchParams.get('utm_campaign');
  });
  assert.equal(campaign, 'unge');

  // A kommune outside the catalog gets no andels links, only pages that apply everywhere.
  await page.evaluate(() => window.__koen.set({ k: '0461' }));
  await page.waitForFunction(() => document.querySelector('#card h2')?.textContent === 'Odense');
  assert.equal(await page.locator('#card a[href*="/lister/andels"]').count(), 0);
  assert.equal(await page.locator('#card a[href*="/fornyelsesradar"]').count(), 1);
  console.log('Offline smoke passed');
} finally {
  await browser?.close();
  server.kill();
}
