/**
 * Close look at cards (DESIGN §41): the densest stand of one kind of tree,
 * zoomed in, with solid shapes and with cards (and grass cards).
 * KIND=grass looks at open ground beside the start instead.
 * DAY=22 jumps the calendar (late autumn: leaf fall and litter).
 * WOODS=1 presses O once before the first shot (Wild ghosted → all ghosted).
 *   KIND=pine ZOOM=3 node scripts/shots/cardlook.mjs <outdir>
 */
import { open, noHud } from './pw.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const kind = process.env.KIND ?? 'pine', zoom = Number(process.env.ZOOM ?? 3);
const { browser, page, errors } = await open(process.env.Q ?? '?seed=3&new');
await page.evaluate(([kind, zoom, day]) => {
  const g = window.__game, c = g.colony;
  g.setSpeed(0);
  let n = 0; while (Math.abs(((c.minute % 1440) / 60) - 11) > 0.3 && n++ < 200) g.tick(10);
  // DAY (fractional game day): jump the calendar, e.g. DAY=22 for leaf fall (32-day year).
  if (day) c.minute = Math.floor(day - 1) * 1440 + 11 * 60;
  c.weather = 'clear';
  const w = c.world; let best = kind === 'grass' ? { x: 12, z: 12 } : null, bestN = kind === 'grass' ? 1e9 : -1;
  for (let z = -90; z <= 90; z += 4) for (let x = -90; x <= 90; x += 4) {
    let k = 0;
    for (const t of w.trees) if (!t.felled && t.kind === kind && Math.abs(t.tx - w.w / 2 - x) < 6 && Math.abs(t.tz - w.h / 2 - z) < 6) k++;
    if (k > bestN) { bestN = k; best = { x, z }; }
  }
  g.reveal(best.x, best.z, 30);
  g.iso.target.x = best.x; g.iso.target.z = best.z; g.iso.zoomGoal = zoom;
  g.refresh();
}, [kind, zoom, Number(process.env.DAY ?? 0)]);
await noHud(page);
await page.waitForTimeout(4000);
for (const [cards, grass] of [[false, false], [true, true]]) {
  await page.evaluate(([cards, grass]) => {
    const g = window.__game; g.gfx.s.leafCards = cards; g.gfx.s.grassCards = grass; g.gfx.refresh();
  }, [cards, grass]);
  // WOODS: press O (see-through woods: Wild only → everywhere → off).
  if (!cards && process.env.WOODS) { await page.mouse.move(700, 430); await page.keyboard.press('o'); }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${kind}-${cards ? 'cards' : 'solid'}.png`, timeout: 120000 });
}
console.log('falling leaves', await page.evaluate(() => window.__game.scene.getObjectByName('leaffall')?.count));
console.log('errors', errors);
await browser.close();
