/**
 * Before/after views for visual changes: the same seed, site, spots and hours,
 * HUD hidden. Run once on the old build and once on the new, with different tags:
 *   node scripts/shots/compare.mjs <outdir> before     (then rebuild, restart preview)
 *   node scripts/shots/compare.mjs <outdir> after
 * Q overrides the query (default '?seed=41&site=farm').
 */
import { open, noHud, toHour } from './pw.mjs';
import { mkdirSync } from 'node:fs';

const [out, tag] = [process.argv[2], process.argv[3] ?? 'shot'];
mkdirSync(out, { recursive: true });
const { browser, page, errors } = await open(process.env.Q ?? '?seed=41&site=farm');
await noHud(page);
for (const [name, zoom, hour] of [['far', 1.0, 9], ['mid', 1.6, 9], ['eve', 1.6, 17.5]]) {
  await toHour(page, hour);
  await page.evaluate((zoom) => {
    const g = window.__game; g.colony.weather = 'clear';
    const c = g.colony.world.campfire; g.iso.target.x = c.x + 2; g.iso.target.z = c.z; g.iso.zoomGoal = zoom; g.refresh();
  }, zoom);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/${tag}-${name}.png`, timeout: 120000 });
}
console.log('errors', errors);
await browser.close();
