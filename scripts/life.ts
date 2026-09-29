/**
 * Village life over time (DESIGN §24.8): how often couples court and marry,
 * and how many come to festivals. Autopilot villages, N days.
 *
 *   npx vite-node scripts/life.ts -- [colonies=6] [days=64]
 */
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = Number(args[0] ?? 6), DAYS = Number(args[1] ?? 64);

for (let seed = 1; seed <= N; seed++) {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  col.village.autoPlan = true;
  col.village.autopilot = true;
  for (let m = 0; m < DAYS * 1440; m += 60) tick(col, 60);
  const gs = col.gatherings ?? [];
  const pop = alive(col.community).length;
  const courted = col.community.survivors.filter((s) => s.memories.some((m) => m.text.startsWith('Started walking out'))).length / 2;
  const fests = gs.filter((g) => g.kind !== 'wedding' && g.done);
  const weddings = gs.filter((g) => g.kind === 'wedding' && g.done);
  const share = (g: typeof gs[number]) => g.attended.length;
  console.log(`seed ${seed}: pop ${pop}, courtships ${courted}, weddings ${weddings.length} (guests ${weddings.map(share).join('/') || '-'}), `
    + `festivals ${fests.length} (came ${fests.map(share).join('/') || '-'}), married now ${alive(col.community).filter((s) => s.partner !== undefined).length}`);
}
