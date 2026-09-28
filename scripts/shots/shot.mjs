/**
 * Scripted screenshots. Usage (with `npx vite preview --port 4173` running):
 *   Q='?seed=41&site=farm' node scripts/shots/shot.mjs <outdir> '<steps json>'
 * Each step is an object; every key is optional and applied in this order,
 * then a screenshot `<outdir>/<name>.png` is taken. See README.md for keys.
 */
import { open, noHud } from './pw.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2];
const steps = JSON.parse(process.argv[3]);
mkdirSync(out, { recursive: true });
const t0 = Date.now();
const { browser, page, errors } = await open(process.env.Q ?? '?new');
console.log('loaded in', Date.now() - t0, 'ms');
for (const s of steps) {
  const info = await page.evaluate((s) => {
    const g = window.__game;
    const c = g.colony, w = c.world;
    g.setSpeed(0);
    if (s.paint) for (const p of s.paint) g.paint(p[0], p[1], p[2], p[3]);
    if (s.tick) for (let m = 0; m < s.tick; m += 60) g.tick(Math.min(60, s.tick - m));
    if (s.untilHour !== undefined) { let n = 0; while (Math.floor((c.minute % 1440) / 60) !== s.untilHour && n++ < 200) g.tick(10); }
    if (s.weather) c.weather = s.weather;
    if (s.yaw !== undefined) g.iso.yawGoal = s.yaw;
    if (s.zoom) g.iso.zoomGoal = s.zoom;
    if (s.target) { g.iso.target.x = s.target[0]; g.iso.target.z = s.target[1]; }
    if (s.lookCamp) { g.iso.target.x = w.campfire.x + (s.lookCamp[0] ?? 0); g.iso.target.z = w.campfire.z + (s.lookCamp[1] ?? 0); }
    if (s.lookFolk) { const m = w.folk.mound; g.reveal(m.x, m.z, 20); g.iso.target.x = m.x + (s.lookFolk[0] ?? 0); g.iso.target.z = m.z + (s.lookFolk[1] ?? 0); }
    if (s.reveal) g.reveal(s.reveal[0], s.reveal[1], s.reveal[2]);
    if (s.select) g.select(s.select === 'first' ? g.colony.agents[0].id : s.select);
    if (s.unselect) g.select(0);
    if (s.hide) for (const o of g.scene.children) o.visible = !(s.hide.includes(o.name) || s.hide.includes(o.type));
    if (s.woods !== undefined) g.setWoods(s.woods);
    if (s.zone !== undefined) g.setZoneTool(s.zone);
    if (s.folkCard) g.inspect({ folk: true });
    if (s.inspectHome) { const b = c.village.buildings.find((x) => x.kind === 'home'); if (b) { g.inspect({ building: b.id }); g.iso.target.x = b.inside.x; g.iso.target.z = b.inside.z; } }
    if (s.district !== undefined) { const d = w.districts.find((x) => x.kind === s.district); for (const p of w.pois) p.discovered = true; g.inspect({ district: d.id }); g.iso.target.x = d.x; g.iso.target.z = d.z; }
    if (s.veilStart) g.veilStart(s.veilStart, !!s.withFolk);
    if (s.veilTurns) g.veilTurns(s.veilTurns);
    if (s.eval) (0, eval)(s.eval); // anything else, as a JS string with `__game` in scope
    g.refresh();
    return {
      day: c.community.day, minute: c.minute, council: !!c.council.active, weather: c.weather,
      folk: { standing: Math.round(c.folk.standing), level: c.folk.level, mound: [Math.round(w.folk.mound.x), Math.round(w.folk.mound.z)] },
      buildings: c.village.buildings.map((b) => b.name),
      projects: c.village.projects.filter((p) => !p.done).map((p) => `${p.name} ${Math.round(p.work)}/${p.workNeeded}`),
    };
  }, s);
  if (s.nohud) await noHud(page);
  if (s.key) await page.keyboard.press(s.key);
  if (s.clicks) for (const c of s.clicks) { await page.mouse.click(c[0], c[1]); await page.waitForTimeout(700); }
  if (s.hover) await page.mouse.move(s.hover[0], s.hover[1]);
  await page.waitForTimeout(s.wait ?? 2500);
  if (s.name) await page.screenshot({ path: `${out}/${s.name}.png`, timeout: 120000 });
  console.log(s.name ?? '(step)', JSON.stringify(info));
}
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
console.log('fps (software GL):', fps);
console.log('errors:', JSON.stringify(errors, null, 1));
await browser.close();
