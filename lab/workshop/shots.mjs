// Workshop turnaround: a library figure from the front, 3/4 and back (close,
// smooth), walking, and at the game's zooms in pixel mode beside the current
// figures. Also saves the library thumbnail. With `npm run figures` running:
//   node lab/workshop/shots.mjs <library file, e.g. man_folk_scout.glb> <out dir>
import { mkdirSync } from 'node:fs';
import path from 'node:path';
let pw;
try { pw = await import('playwright'); } catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }

const [file, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror', String(e)));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto('http://localhost:5181/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__studio?.stage?.clips?.size, null, { timeout: 60000 });
await page.addStyleTag({ content: 'aside{display:none!important} #app{grid-template-columns:1fr!important} #bar{display:none!important}' });
await page.waitForTimeout(4000); // let the studio's first poll settle before taking over the stage
const set = (o) => page.evaluate(async (o) => {
  const st = window.__studio.stage;
  if (o.figs) await st.show(o.figs.map((f) => (f.startsWith('ref:') ? { name: f.slice(4), url: window.__studio.refUrl(f.slice(4)), ref: true } : { name: f, url: `/api/library/${f}`, child: f.startsWith('child') })));
  if (o.clip) { st.opts.clip = o.clip; st.play(); }
  if (o.pixel !== undefined) { st.opts.pixel = o.pixel; st.resize(); }
  if (o.zoom) st.opts.zoom = o.zoom;
  if (o.yaw !== undefined) st.yaw = o.yaw;
  if (o.look) st.look.set(...o.look);
  if (o.pause !== undefined) for (const c of st.chars) { c.mixer.timeScale = 1; c.mixer.setTime(o.pause); c.mixer.timeScale = 0; }
}, o);
const shot = async (name, clip) => { await page.waitForTimeout(2500); await page.screenshot({ path: path.join(out, `${name}.png`), ...(clip ? { clip } : {}) }); console.log('shot', name); };

// Close turnaround, standing (Idle, paused).
await set({ figs: [file], clip: 'Idle', pixel: false, zoom: 9, look: [0, 0.85, 0], pause: 0.2 });
const C = { x: 450, y: 30, width: 600, height: 840 };
for (const [n, yaw] of [['front', 0], ['three-quarter', Math.PI / 4], ['side', Math.PI / 2], ['back', Math.PI]]) {
  await set({ yaw });
  await shot(`close-${n}`, C);
  if (n === 'three-quarter') await page.screenshot({ path: path.join(out, 'thumb.png'), clip: { x: 600, y: 60, width: 300, height: 300 } });
}
// Walking, 3/4 view, two phases.
await set({ clip: 'Walk', yaw: Math.PI / 4 });
for (const t of [0.15, 0.55]) { await set({ pause: t }); await shot(`walk-${t}`, C); }
// At the game's zooms, pixel mode, beside the current figures, walking.
await set({ figs: ['ref:man_walker', 'ref:woman_forager', file], clip: 'Walk', pixel: true, yaw: Math.PI / 4, look: [0, 0.9, 0] });
for (const [n, z] of [['game-default', 1.45], ['game-max', 3.2]]) {
  await set({ zoom: z, pause: 0.3 });
  await shot(`${n}`, { x: 550, y: 250, width: 400, height: 300 });
}
await browser.close();
