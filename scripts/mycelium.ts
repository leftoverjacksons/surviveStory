/**
 * Where the Folk's mycelium reaches (DESIGN §24.10): cells reached, the
 * share of field tiles and homes under it, the network at the fire, and the
 * hill's mood, every 16 days. Autopilot villages.
 *
 *   npx vite-node scripts/mycelium.ts -- [colonies=6] [days=64]
 */
import { createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { REACH, cellAt, folkMood, reachCells, reachShare } from '../src/sim/mycelium';
import { Crop } from '../src/sim/world';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = Number(args[0] ?? 6), DAYS = Number(args[1] ?? 64);

for (let seed = 1; seed <= N; seed++) {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  col.village.autoPlan = true;
  col.village.autopilot = true;
  const w = col.world, m = w.folk.mound;
  const out: string[] = [];
  for (let d = 1; d <= DAYS; d++) {
    for (let k = 0; k < 24; k++) tick(col, 60);
    if (d % 16) continue;
    const fields: { x: number; z: number }[] = [];
    for (let i = 0; i < w.cropState.length; i++) if (w.cropState[i] !== Crop.Untilled || w.zone[i] === 3) fields.push({ x: (i % w.w) - w.w / 2 + 0.5, z: Math.floor(i / w.w) - w.h / 2 + 0.5 });
    const homes = col.village.buildings.filter((b) => b.kind === 'home').map((b) => b.door);
    const my = col.mycelium!;
    const fire = my.m[cellAt(my, w, w.campfire.x, w.campfire.z)];
    out.push(`d${d}: cells ${reachCells(col)}, fields ${(reachShare(col, fields) * 100).toFixed(0)}%, homes ${(reachShare(col, homes) * 100).toFixed(0)}%, fire ${fire.toFixed(2)}${fire >= REACH ? '*' : ''}, standing ${Math.round(col.folk.standing)} mood ${folkMood(col).toFixed(2)}`);
  }
  console.log(`seed ${seed} (hill ${Math.round(Math.hypot(m.x - w.campfire.x, m.z - w.campfire.z))} from the fire)\n  ${out.join('\n  ')}`);
}
