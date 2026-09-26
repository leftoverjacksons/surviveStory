/**
 * Headless balance probe: runs whole colonies and reports how they fare.
 * Usage: npm run sim -- [colonies=12] [days=20] [--log]
 */
import { alive, communityMorale, createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { bedsTotal } from '../src/sim/buildings';
import { generateWorld } from '../src/sim/worldgen';
import { exploredFraction } from '../src/sim/world';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const colonies = Number(args[0] ?? 12);
const days = Number(args[1] ?? 20);
const showLog = process.argv.includes('--log');

const rows: number[][] = [];
const t0 = Date.now();
for (let seed = 1; seed <= colonies; seed++) {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  for (let m = 0; m < days * 1440; m += 5) tick(col, 5);
  const r = col.community.resources;
  const v = col.village;
  rows.push([
    alive(col.community).length, bedsTotal(v), communityMorale(col.community), r.food, r.wood, r.scrap, r.glimmer,
    v.buildings.length - 1, v.projects.filter((p) => p.done).length, v.tier,
    exploredFraction(col.world) * 100,
  ]);
  if (showLog && seed === 1) {
    for (const l of col.community.log) if (l.tone !== 'info' || l.text.startsWith('Day')) console.log(`  D${l.day} ${l.text}`);
    console.log('  buildings:', v.buildings.map((b) => `${b.name}(t${b.tier})`).join(', '));
    console.log('  active:', v.projects.filter((p) => !p.done).map((p) => `${p.name} w${Math.round(p.work)}/${p.workNeeded} d${JSON.stringify(p.delivered)} c${JSON.stringify(p.cost)}`).join(' | '));
  }
}
const mean = (i: number) => rows.reduce((s, r) => s + r[i], 0) / rows.length;
const min = (i: number) => Math.min(...rows.map((r) => r[i]));
const names = ['alive', 'beds', 'morale', 'food', 'wood', 'scrap', 'glimmer', 'buildings', 'projects done', 'tier', 'explored %'];
console.log(`${colonies} colonies × ${days} days  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
names.forEach((n, i) => console.log(`${n.padEnd(14)} mean ${mean(i).toFixed(1).padStart(7)}   min ${min(i).toFixed(1).padStart(7)}`));
