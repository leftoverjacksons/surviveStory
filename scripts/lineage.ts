/**
 * Families over the years (DESIGN §24.15): births, foundlings, children by
 * age, comings of age, deaths of old age, and the largest families.
 * Autopilot villages.
 *
 *   npx vite-node scripts/lineage.ts -- [colonies=4] [years=4]
 */
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { DAYS_PER_YEAR } from '../src/sim/calendar';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = Number(args[0] ?? 4), YEARS = Number(args[1] ?? 4);

for (let seed = 1; seed <= N; seed++) {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  col.village.autoPlan = true;
  col.village.autopilot = true;
  const t0 = Date.now();
  for (let y = 1; y <= YEARS; y++) {
    for (let m = 0; m < DAYS_PER_YEAR * 1440; m += 60) tick(col, 60);
    const c = col.community, living = alive(c);
    const born = c.survivors.filter((s) => s.background === 'born in the village').length;
    const found = c.survivors.filter((s) => s.background === 'a foundling from the green').length;
    const kids = living.filter((s) => s.age < 16);
    const old = c.survivors.filter((s) => s.causeOfDeath === 'old age').length;
    const married = living.filter((s) => s.partner !== undefined).length / 2;
    const expecting = living.filter((s) => s.expecting !== undefined).length;
    console.log(`seed ${seed} y${y}: pop ${living.length} (children ${kids.length}: ages ${kids.map((k) => k.age).join(',') || '-'}), born ${born}, foundlings ${found}, expecting ${expecting}, couples ${married}, died old ${old}`);
  }
  const fams = new Map<string, number>();
  for (const s of col.community.survivors) if (s.family) fams.set(s.family, (fams.get(s.family) ?? 0) + 1);
  console.log(`  largest families: ${[...fams].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f, n]) => `${f} ${n}`).join(', ')} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
