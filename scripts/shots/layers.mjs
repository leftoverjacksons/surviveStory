/**
 * Which layer causes an artefact? Hides the scene's top-level children one at
 * a time and saves a crop for each (`hide-<i>.png`); the names are printed.
 *   node scripts/shots/layers.mjs <outdir> [x y w h]
 */
import { open, noHud, toHour } from './pw.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2];
const [x, y, width, height] = process.argv.slice(3).map(Number);
const clip = width ? { x, y, width, height } : { x: 300, y: 150, width: 400, height: 300 };
mkdirSync(out, { recursive: true });
const { browser, page } = await open(process.env.Q ?? '?seed=41&site=farm', { width: 1000, height: 640 });
await noHud(page);
await toHour(page, 9);
const names = await page.evaluate(() => {
  const g = window.__game; const c = g.colony.world.campfire;
  g.iso.target.x = c.x + 2; g.iso.target.z = c.z; g.iso.zoomGoal = 1.6; g.refresh();
  return g.scene.children.map((o, i) => `${i}:${o.name || o.type}:${o.children.length}`);
});
console.log(names.join(' | '));
for (const i of names.keys()) {
  await page.evaluate((i) => { window.__game.scene.children.forEach((o, j) => { o.userData.__v ??= o.visible; o.visible = j === i ? false : o.userData.__v; }); }, i);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/hide-${i}.png`, clip, timeout: 120000 });
}
await browser.close();
