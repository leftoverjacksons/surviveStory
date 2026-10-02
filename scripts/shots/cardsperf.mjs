/**
 * Cards vs solid shapes (DESIGN §41): draw calls, triangles and frame time
 * (the GPU waited on) for the same wooded view: solid trees and blade grass,
 * tree cards, tree and grass cards;
 * at pixel size 3 and 1. Software GL, so times only compare with each other.
 *   Q='?seed=3&new' node scripts/shots/cardsperf.mjs <outdir>
 */
import { open, noHud } from './pw.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const { browser, page, errors } = await open(process.env.Q ?? '?seed=3&new');
await page.evaluate(() => {
  const g = window.__game, c = g.colony;
  g.setSpeed(0);
  let n = 0; while (Math.abs(((c.minute % 1440) / 60) - 11) > 0.3 && n++ < 200) g.tick(10);
  c.weather = 'clear';
  // The densest stand of trees near the start.
  const w = c.world; let best = null, bestN = -1;
  for (let z = -60; z <= 60; z += 6) for (let x = -60; x <= 60; x += 6) {
    let k = 0;
    for (const t of w.trees) if (!t.felled && Math.abs(t.tx - w.w / 2 - x) < 9 && Math.abs(t.tz - w.h / 2 - z) < 9) k++;
    if (k > bestN) { bestN = k; best = { x, z }; }
  }
  g.reveal(best.x, best.z, 30);
  g.iso.target.x = best.x; g.iso.target.z = best.z; g.iso.zoomGoal = 1.3;
  g.refresh();
});
await noHud(page);
await page.waitForTimeout(4000);
const rows = [];
const configs = [[false, false], [true, false], [true, true]];
for (const px of [3, 1]) for (const [cards, grass] of configs) {
  const r = await page.evaluate(([px, cards, grass]) => {
    const g = window.__game;
    g.gfx.s.px = px; g.gfx.s.leafCards = cards; g.gfx.s.grassCards = grass; g.gfx.refresh();
    g.probeRender(); g.probeRender(); // warm up (shader compiles)
    const runs = [];
    for (let i = 0; i < 5; i++) runs.push(g.probeRender());
    runs.sort((a, b) => a.ms - b.ms);
    const without = (name) => {
      const o = g.scene.getObjectByName(name);
      o.visible = false;
      const w = g.probeRender();
      o.visible = true;
      return w;
    };
    const t = without('trees'), u = without('tufts');
    const m = runs[2];
    return { px, trees: cards ? 'cards' : 'solid', grass: grass ? 'cards' : 'blades', calls: m.calls, triangles: m.triangles, ms: m.ms,
      treeCalls: m.calls - t.calls, treeTris: m.triangles - t.triangles, grassCalls: m.calls - u.calls, grassTris: m.triangles - u.triangles };
  }, [px, cards, grass]);
  rows.push(r);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/px${px}-${cards ? 'cards' : 'solid'}-${grass ? 'grass' : 'blades'}.png`, timeout: 120000 });
}
console.table(rows);
console.log('errors', errors);
await browser.close();
