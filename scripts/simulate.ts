/**
 * Headless balance probe: runs whole colonies and reports how they fare.
 * Usage: npm run sim -- [colonies=20] [days=10]
 */
import { alive, communityMorale, createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { exploredFraction } from '../src/sim/world';

const colonies = Number(process.argv[2] ?? 20);
const days = Number(process.argv[3] ?? 10);

const rows: number[][] = [];
const t0 = Date.now();
for (let seed = 1; seed <= colonies; seed++) {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  for (let m = 0; m < days * 1440; m += 5) tick(col, 5);
  const r = col.community.resources;
  rows.push([
    alive(col.community).length, communityMorale(col.community), r.food, r.wood, r.glimmer,
    col.world.trees.filter((t) => t.felled).length, exploredFraction(col.world) * 100,
    col.world.pois.filter((p) => p.discovered).length,
  ]);
}
const mean = (i: number) => rows.reduce((s, r) => s + r[i], 0) / rows.length;
const min = (i: number) => Math.min(...rows.map((r) => r[i]));
const names = ['alive', 'morale', 'food', 'wood', 'glimmer', 'trees felled', 'explored %', 'places found'];
console.log(`${colonies} colonies × ${days} days  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
names.forEach((n, i) => console.log(`${n.padEnd(14)} mean ${mean(i).toFixed(1).padStart(7)}   min ${min(i).toFixed(1).padStart(7)}`));
