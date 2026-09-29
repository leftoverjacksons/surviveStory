// Lab: screenshots of the figure viewer at several zooms, cropped to the figures.
// With `npx vite --port 5173` running:
//   node lab/figures/shot.mjs <out dir> [clip]
import { mkdirSync } from 'node:fs';
let pw;
try { pw = await import('playwright'); } catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }

const out = process.argv[2] ?? 'lab-shots';
const clip = process.argv[3] ?? 'Walk';
const query = process.argv[4] ?? '';
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
page.on('pageerror', (e) => console.log('pageerror', String(e)));
page.on('console', (m) => console.log('console', m.text()));
await page.goto('http://localhost:5173/lab/figures/' + query, { waitUntil: 'load' });
await page.waitForFunction(() => window.__lab, null, { timeout: 60000 });
await page.selectOption('#clip', clip);
await page.addStyleTag({ content: '#ui{display:none}' });
// [name, zoom, pixel, crop width, crop height]
for (const [name, zoom, pixel, cw, ch] of [
  ['game-default', 1.45, true, 500, 200], ['game-max', 3.2, true, 900, 380], ['lineup', 6, false, 1400, 760],
]) {
  await page.evaluate(([z, p]) => {
    const zi = document.getElementById('zoom'); zi.max = '10'; zi.value = String(z);
    const pi = document.getElementById('pixel'); if (pi.checked !== p) pi.click();
  }, [zoom, pixel]);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/${name}.png`, clip: { x: 700 - cw / 2, y: 430 - ch * 0.7, width: cw, height: ch } });
  console.log('shot', name);
}
// The last figure (the newest candidate) close up, at four points of the clip.
await page.evaluate(() => { const L = window.__lab; L.focus(L.chars.length - 1); for (const m of L.mixers) m.timeScale = 0; });
for (let f = 0; f < 4; f++) {
  await page.evaluate((f) => { const L = window.__lab; for (const m of L.mixers) { m.timeScale = 1; m.setTime(f * 0.25 * (m._actions[0]?.getClip().duration ?? 1)); m.timeScale = 0; } }, f);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/pose-${f}.png`, clip: { x: 500, y: 60, width: 400, height: 760 } });
}
console.log('shot poses');
await browser.close();
