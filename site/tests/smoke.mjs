import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
// SMOKE_DIST=1 runs the same checks against the production build (vite preview of dist/, run npm run build first).
const script = process.env.SMOKE_DIST ? 'preview' : 'dev';
const server = spawn('npm', ['run', script, '--', '--host', '127.0.0.1', '--port', '4179', '--strictPort'], { stdio: 'ignore' });
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
  // A malformed shared URL falls back to defaults instead of breaking the render.
  const bad = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await bad.addInitScript(() => localStorage.setItem('koen-intro-seen', '1'));
  await bad.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await bad.goto('http://127.0.0.1:4179/#mode=bogus&e=scatter&x=bogus&y=nope&k=9999&w=0,0,0,0,0,0,0');
  await bad.waitForSelector('#app[data-loading="false"]', { timeout: 30000 });
  const st = await bad.evaluate(() => ({ mode: window.__koen.state.mode, x: window.__koen.state.x, k: window.__koen.state.k, w: Object.values(window.__koen.state.w).reduce((a, b) => a + b, 0) }));
  assert.deepEqual([st.mode, st.x, st.k], ['koetryk', 'B1', null]);
  assert.ok(st.w > 0, 'all-zero weights rejected');
  assert.ok(await bad.locator('#scatter').count(), 'scatter rendered');
  // The skip link opens the table and focuses it, and the permalink hash survives.
  await bad.evaluate(() => window.__koen.set({ explorer: '' }));
  await bad.waitForTimeout(100);
  await bad.locator('#skip-link').focus();
  await bad.keyboard.press('Enter');
  await bad.waitForFunction(() => document.activeElement?.id === 'explorer-table');
  assert.match(await bad.evaluate(() => location.hash), /mode=koetryk/);
  // Lazy-loaded views still open: method panel and sources panel (with the font licences).
  await bad.click('#btn-method');
  await bad.waitForSelector('#panel #m-title');
  await bad.keyboard.press('Escape');
  await bad.click('#btn-sources');
  await bad.waitForSelector('#panel a[href$="fonts/OFL-ibm-plex-mono.txt"]');
  await bad.keyboard.press('Escape');
  // First visit: the intro dialog opens on the basemap load event, which may not fire with external tiles blocked,
  // so the lazy panels chunk is checked only when the dialog is shown.
  const fresh = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await fresh.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await fresh.goto('http://127.0.0.1:4179/');
  await fresh.waitForSelector('#app[data-loading="false"]', { timeout: 30000 });
  await fresh.waitForTimeout(1500);
  if (await fresh.locator('#intro:not([hidden])').count()) assert.ok(await fresh.locator('#intro-title').count());
  console.log('Offline smoke passed');
} finally {
  await browser?.close();
  server.kill();
}
