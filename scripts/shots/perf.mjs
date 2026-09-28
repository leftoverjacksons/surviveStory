/**
 * Render cost of a grown village: simulate N days on autopilot (sim only,
 * fast), then report draw calls and triangles per pass, meshes by scene
 * group, and a screenshot. Software GL, so frame times mean little; counts do.
 *   Q='?seed=1&site=farm&auto' node scripts/shots/perf.mjs <outdir> [days=96]
 */
import { open, noHud } from './pw.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2], days = Number(process.argv[3] ?? 96);
mkdirSync(out, { recursive: true });
const { browser, page, errors } = await open(process.env.Q ?? '?seed=1&site=farm&auto');
const t0 = Date.now();
for (let d = 0; d < days; d += 8) {
  await page.evaluate((n) => { const g = window.__game; g.setSpeed(0); for (let i = 0; i < n; i++) { g.tick(1440); if (g.colony.council.active) g.colony.council.active = null; } }, Math.min(8, days - d));
}
console.log(`simulated ${days} days in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const info = await page.evaluate(() => {
  const g = window.__game, c = g.colony;
  let n = 0; while (Math.abs(((c.minute % 1440) / 60) - 11) > 0.3 && n++ < 200) g.tick(10);
  c.weather = 'clear';
  g.iso.target.x = c.world.campfire.x; g.iso.target.z = c.world.campfire.z; g.iso.zoomGoal = 1.0;
  g.refresh();
  return { pop: c.agents.length, buildings: c.village.buildings.length };
});
await page.waitForTimeout(4000);
const r = await page.evaluate(() => {
  const g = window.__game;
  return { full: g.probeRender(), noShadow: g.probeRender({ shadows: false }), sceneOnly: g.probeRender({ composer: false, shadows: false }), stats: g.stats() };
});
console.log(JSON.stringify({ ...info, ...r }, null, 1));
// Draw calls each top-level group costs (hidden one at a time), with shadows.
const per = await page.evaluate(() => {
  const g = window.__game, base = g.probeRender();
  const out = {};
  g.scene.children.forEach((o, i) => {
    if (!o.visible) return;
    o.visible = false;
    const r = g.probeRender();
    o.visible = true;
    const d = base.calls - r.calls;
    if (d > 4) out[o.name || `${o.type}#${i}`] = { calls: d, tris: Math.round((base.triangles - r.triangles) / 1000) + 'k' };
  });
  return out;
});
console.log('per group (calls, triangles incl. shadows):', JSON.stringify(per));
await noHud(page);
await page.screenshot({ path: `${out}/village-${days}d.png`, timeout: 120000 });
console.log('errors', errors);
await browser.close();
