/**
 * Shimmer measurement (DESIGN §23.7): with wind and moving things held still,
 * steps game time as play does and reports how many pixels change between
 * frames (`changed`) and how many flicker back and forth (`flips`), at
 * mid-morning and at dusk, over a grown village, with the camera settled (as a
 * player sees it while watching; the headless browser's ~1 fps would otherwise
 * catch the camera still easing). Lower is steadier.
 *   Q='?seed=41&site=farm' node scripts/shots/flicker.mjs [speed=1]
 * speed: 1 (2 game minutes a second), 3 (6) or 8 (16), at 30 frames a second.
 */
import { open, noHud, toHour } from './pw.mjs';

const speed = Number(process.argv[2] ?? 1);
/** Optional: --still (no game time passes: only animated effects), --noshadow, --nograde. */
const flags = { still: process.argv.includes('--still'), shadows: process.argv.includes('--noshadow') ? false : undefined, grade: process.argv.includes('--nograde') ? false : undefined };
const perFrame = { 1: 2, 3: 6, 8: 16 }[speed] / 30;
const { browser, page, errors } = await open(process.env.Q ?? '?seed=41&site=farm', { width: 960, height: 600 });
await noHud(page);
if (process.env.OFFSET) await page.evaluate((o) => { window.__offset = o; }, process.env.OFFSET.split(',').map(Number));
await page.evaluate(() => { const g = window.__game; g.setSpeed(0); for (let i = 0; i < 12; i++) { g.tick(1440); g.colony.council.active = null; } });
const out = {};
for (const [name, hour] of [['morning', 10], ['dusk', 18.5]]) {
  await toHour(page, hour);
  await page.evaluate(() => { const g = window.__game, c = g.colony; c.weather = 'clear'; const [ox, oz] = (window.__offset ?? [0, 0]); g.iso.target.x = c.world.campfire.x + ox; g.iso.target.z = c.world.campfire.z + oz; g.iso.zoomGoal = 1.4; g.iso.zoom = g.iso.zoomGoal; g.iso.yaw = g.iso.yawGoal; g.refresh(); });
  await page.waitForTimeout(2500);
  out[name] = await page.evaluate(([pf, o]) => window.__game.flicker(48, pf, o), [flags.still ? 0 : perFrame, { shadows: flags.shadows, grade: flags.grade, map: !!process.env.MAP }]);
}
if (process.env.MAP) {
  const fs = await import('node:fs');
  for (const [k, v] of Object.entries(out)) if (v.map) fs.writeFileSync(`${process.env.MAP}/flicker-${k}.png`, Buffer.from(v.map.split(',')[1], 'base64'));
}
for (const [k, v] of Object.entries(out)) console.log(`${k.padEnd(8)} changed ${(v.changed * 100).toFixed(2)}%  flips ${(v.flips * 100).toFixed(3)}%`);
console.log('errors', errors);
await browser.close();
