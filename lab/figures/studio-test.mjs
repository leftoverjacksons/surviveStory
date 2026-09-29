// Drive the figure studio end to end (with `npm run figures` running):
// upload an image, wait for generate → rig → pack, add it to the library, and
// take screenshots of the studio.
//   node lab/figures/studio-test.mjs <front image> <out dir> [back image]
import { mkdirSync } from 'node:fs';
let pw;
try { pw = await import('playwright'); } catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }

const [front, out, back] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror', String(e)));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto('http://localhost:5181/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__studio, null, { timeout: 60000 });
await page.setInputFiles('#dropFront input', front);
if (back) await page.setInputFiles('#dropBack input', back);
await page.fill('#name', 'studio test');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/1-form.png` });
await page.click('#make');
const t0 = Date.now();
let last = '';
for (;;) {
  const st = await page.evaluate(() => { const s = window.__studio.state; return s.figures[0]?.status ?? ''; });
  if (st !== last) { console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s`, st); last = st; }
  if (st === 'ready' || st === 'error') break;
  if (Date.now() - t0 > 30 * 60e3) throw new Error('timed out');
  await page.waitForTimeout(3000);
}
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/2-ready.png` });
await page.click('#aLib');
await page.waitForTimeout(4000);
await page.selectOption('#show', 'library');
await page.dispatchEvent('#show', 'input');
await page.check('#pixel');
await page.dispatchEvent('#pixel', 'input');
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/3-library-pixel.png` });
await browser.close();
