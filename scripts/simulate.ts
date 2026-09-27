/**
 * Headless balance probe: runs whole colonies and reports how they fare.
 * Usage: npm run sim -- [colonies=12] [days=48] [--log] [--prepared]
 *   --prepared  paints two fields and a woodlot on day 1, as a player would.
 */
import { alive, communityMorale, createCommunity } from '../src/sim/community';
import { createColony, tick, type Colony } from '../src/sim/colony';
import { bedsTotal } from '../src/sim/buildings';
import { communitySight, homeResonance } from '../src/sim/veil';
import { generateWorld } from '../src/sim/worldgen';
import { Zone, exploredFraction, idx, paintZone, toTileX, toTileZ, zoneAllowed, type World } from '../src/sim/world';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const colonies = Number(args[0] ?? 12);
const days = Number(args[1] ?? 48);
const showLog = process.argv.includes('--log');
const prepared = process.argv.includes('--prepared');

/** Best spot on a ring around home for a zone disc, by count of allowed tiles (and trees for woodlots). */
function bestSpot(w: World, r0: number, r1: number, radius: number, kind: number, wantTrees: boolean, avoid: { x: number; z: number }[]) {
  let best = { x: 0, z: 0, score: -1 };
  for (let r = r0; r <= r1; r += 3) for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < radius * 2.2)) continue;
    let score = 0;
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      if (Math.hypot(dx, dz) > radius) continue;
      const tx = toTileX(w, x + dx), tz = toTileZ(w, z + dz);
      if (!zoneAllowed(w, tx, tz, kind as never)) continue;
      const i = idx(w, tx, tz);
      if (w.zone[i] === Zone.Home) continue;
      score += wantTrees ? (w.treeAt[i] >= 0 ? 1 : 0.1) : (w.treeAt[i] >= 0 || w.bushAt[i] >= 0 ? 0 : 1);
    }
    if (score > best.score) best = { x, z, score };
  }
  return best;
}

function prepare(col: Colony) {
  const w = col.world;
  const f1 = bestSpot(w, 20, 24, 3.5, Zone.Field, false, []);
  paintZone(w, f1.x, f1.z, 3.5, Zone.Field);
  const f2 = bestSpot(w, 20, 24, 3.5, Zone.Field, false, [f1]);
  paintZone(w, f2.x, f2.z, 3.5, Zone.Field);
  const lot = bestSpot(w, 18, 24, 4.5, Zone.Woodlot, true, [f1, f2]);
  paintZone(w, lot.x, lot.z, 4.5, Zone.Woodlot);
}

/** A player answering "paint more Home zone": extend it where the land is open. */
function growHome(col: Colony) {
  const w = col.world;
  const spot = bestSpot(w, 22, 34, 6, Zone.Home, false, []);
  if (spot.score > 20) paintZone(w, spot.x, spot.z, 6, Zone.Home);
}

const rows: number[][] = [];
const t0 = Date.now();
for (let seed = 1; seed <= colonies; seed++) {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  if (prepared) prepare(col);
  let minFoodWinter = Infinity, coldNights = 0, hungryDays = 0, foodAtWinter = 0;
  for (let d = 0; d < days; d++) {
    const logLen = col.community.log.length;
    for (let m = 0; m < 1440; m += 5) tick(col, 5);
    if (prepared && (col.village.noPlotDay ?? -9) >= col.community.day - 1) growHome(col);
    if (d >= 36) minFoodWinter = Math.min(minFoodWinter, col.community.resources.food);
    if (col.community.resources.food < 1) hungryDays++;
    if (d === 35) foodAtWinter = col.community.resources.food;
    coldNights += col.community.log.slice(logLen).filter((l) => /bitter night|snow by the fire/.test(l.text)).length;
  }
  const c = col.community;
  const r = c.resources;
  const v = col.village;
  rows.push([
    alive(c).length, foodAtWinter, c.survivors.filter((s) => !s.alive && !s.departed).length, c.survivors.filter((s) => s.departed).length,
    bedsTotal(v), communityMorale(c), r.food, minFoodWinter === Infinity ? 0 : minFoodWinter, hungryDays, r.wood, coldNights,
    v.buildings.length - 1, v.tier, exploredFraction(col.world) * 100,
    col.world.trees.filter((t) => t.planted).length,
    homeResonance(col), communitySight(col), col.veil.influence,
    c.log.filter((l) => l.tone === 'strange').length, c.log.filter((l) => l.text.startsWith('The council met')).length,
    v.households.length, v.buildings.filter((b) => b.kind === 'home').length,
    alive(c).filter((s) => v.buildings.find((b) => b.id === col.beds.get(s.id))?.kind === 'home').length,
    v.plots.reduce((n, p) => n + p.yard.filter((y) => y.progress >= 1).length, 0),
    v.buildings.some((b) => b.kind === 'store' && b.level >= 3) ? 1 : 0,
    alive(c).filter((s) => (s.skills?.joinery ?? 0) >= 0.5).length,
    c.survivors.reduce((n, s) => n + s.memories.filter((m) => m.text.startsWith('Got my wish')).length, 0),
    col.veil.lore.length,
  ]);
  if (showLog && seed === 1) {
    for (const l of c.log) if (l.tone !== 'info' || l.text.startsWith('Day')) console.log(`  D${l.day} ${l.text}`);
    console.log('  buildings:', v.buildings.map((b) => `${b.name}(t${b.tier})`).join(', '));
    for (const p of v.plots) console.log(`  plot ${p.id}: hh ${p.household} corners ${p.corners.map((q) => `${q.x.toFixed(1)},${q.z.toFixed(1)}`).join(' ')} house ${p.house.W.toFixed(1)}x${p.house.D.toFixed(1)} wing ${!!p.house.wing} yard ${p.yard.map((y) => `${y.kind}:${y.progress.toFixed(2)}`).join(' ')}`);
  }
}
const mean = (i: number) => rows.reduce((s, r) => s + r[i], 0) / rows.length;
const min = (i: number) => Math.min(...rows.map((r) => r[i]));
const max = (i: number) => Math.max(...rows.map((r) => r[i]));
const names = ['alive', 'food @ winter', 'died', 'left', 'beds', 'morale', 'food', 'min food (winter)', 'hungry days', 'wood', 'cold nights', 'buildings', 'tier', 'explored %', 'saplings', 'home resonance', 'mean sight', 'influence', 'strange lines', 'councils', 'households', 'homes', 'sleep at home', 'yard features', 'hall', 'joiners', 'wishes granted', 'lore'];
console.log(`${colonies} colonies × ${days} days${prepared ? ' (prepared)' : ''}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
names.forEach((n, i) => console.log(`${n.padEnd(18)} mean ${mean(i).toFixed(1).padStart(7)}   min ${min(i).toFixed(1).padStart(7)}   max ${max(i).toFixed(1).padStart(7)}`));
