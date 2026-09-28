/**
 * Balance report: where food comes from, how morale moves through the year,
 * how fast Influence accumulates, and how hard winter bites.
 * Usage: npx vite-node scripts/balance.ts -- [colonies=6] [days=48] [--prepared] [--site=K]
 */
import { DAYS_PER_SEASON, DAYS_PER_YEAR } from '../src/sim/calendar';
import { alive, communityMorale, createCommunity } from '../src/sim/community';
import { createColony, dayOf, tick } from '../src/sim/colony';
import { roundField } from '../src/sim/fields';
import { generateWorld } from '../src/sim/worldgen';
import type { SiteKind } from '../src/sim/sites';
import { Zone, idx, paintZone, toTileX, toTileZ, zoneAllowed, type World } from '../src/sim/world';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = Number(args[0] ?? 6), DAYS = Number(args[1] ?? DAYS_PER_YEAR);
const prepared = process.argv.includes('--prepared');
const siteArg = process.argv.find((a) => a.startsWith('--site='))?.slice(7) as SiteKind | undefined;

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

const ledgers: Record<string, number>[] = [];
const seasonMorale = [0, 0, 0, 0], seasonN = [0, 0, 0, 0];
for (let seed = 1; seed <= N; seed++) {
  const col = createColony(generateWorld(seed, undefined, siteArg), createCommunity(seed));
  if (prepared) {
    const w = col.world;
    const f1 = bestSpot(w, 20, 24, 3.5, Zone.Field, false, []); roundField(w, f1.x, f1.z, 4, w.campfire);
    const f2 = bestSpot(w, 20, 24, 3.5, Zone.Field, false, [f1]); roundField(w, f2.x, f2.z, 4, w.campfire);
    const lot = bestSpot(w, 18, 24, 4.5, Zone.Woodlot, true, [f1, f2]); paintZone(w, lot.x, lot.z, 4.5, Zone.Woodlot);
  }
  let pop10 = -1, inf100 = -1, minWinter = 1e9, ration = 0, foodW = 0, minMor = 100;
  while (dayOf(col) <= DAYS) {
    for (let m = 0; m < 1440; m += 10) tick(col, 10);
    const d = dayOf(col);
    const si = Math.floor(((d - 2 + DAYS_PER_YEAR) % DAYS_PER_YEAR) / DAYS_PER_SEASON);
    seasonMorale[si] += communityMorale(col.community); seasonN[si]++;
    minMor = Math.min(minMor, ...alive(col.community).map((s) => s.morale));
    if (inf100 < 0 && col.veil.influence >= 99.9) inf100 = d;
    if (pop10 < 0 && alive(col.community).length >= 10) pop10 = d;
    if (d === 37) foodW = col.community.resources.food;
    if (d > 37) { minWinter = Math.min(minWinter, col.community.resources.food); if (col.community.resources.food < col.agents.length * 6) ration++; }
    if (prepared && (col.village.noPlotDay ?? -9) >= d - 1) { const s = bestSpot(col.world, 22, 34, 6, Zone.Home, false, []); if (s.score > 20) paintZone(col.world, s.x, s.z, 6, Zone.Home); }
  }
  ledgers.push(col.ledger);
  const c = col.community;
  console.log(`seed ${seed} ${col.world.site.kind.padEnd(10)} pop ${alive(c).length} (10 by day ${pop10})  morale ${communityMorale(c).toFixed(0)} (lowest person ${minMor.toFixed(0)})  food@winter ${foodW.toFixed(0)}  winter min ${minWinter.toFixed(0)}  ration days ${ration}  influence ${col.veil.influence.toFixed(0)}${inf100 > 0 ? ` (hit 100 on day ${inf100})` : ''}  died ${c.survivors.filter((s) => !s.alive && !s.departed).map((s) => `${s.causeOfDeath} d${s.diedOnDay}`).join(',') || 0} left ${c.survivors.filter((s) => s.departed).length}`);
}
const keys = [...new Set(ledgers.flatMap((l) => Object.keys(l)))].sort();
console.log('food ledger, mean per colony-year:', keys.map((k) => `${k} ${(ledgers.reduce((n, l) => n + (l[k] ?? 0), 0) / ledgers.length).toFixed(0)}`).join(' · '));
console.log('mean morale spring / summer / autumn / winter:', seasonMorale.map((m, i) => (m / Math.max(1, seasonN[i])).toFixed(0)).join(' / '));
