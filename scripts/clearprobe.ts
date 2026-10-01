/**
 * Clearing balance probe (DESIGN §40): the test bot plays one district kind
 * on many seeds; prints outcomes and why the failures failed.
 *   npx vite-node scripts/clearprobe.ts -- [kind=suburb] [seeds=12] [--log]
 */
import { alive, createCommunity } from '../src/sim/community';
import { createColony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { startClearing, type Clearing } from '../src/sim/haunt';
import { playTurn } from '../src/sim/clearbot';

const args = process.argv.slice(2).filter((a) => a !== '--');
const kind = args.find((a) => !/^\d+$/.test(a) && !a.startsWith('--')) ?? 'suburb';
const n = Number(args.find((a) => /^\d+$/.test(a)) ?? 12);
const showLog = args.includes('--log');
/** --poor: only the stores a new village has (no extra scrap and wood for the kit). */
const poor = args.includes('--poor');

const tally = { cleared: 0, withdrew: 0, lost: 0, fled: 0, taken: 0, turns: 0, tried: 0 };
for (let seed = 1; seed <= n * 3 && tally.tried < n; seed++) {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  for (const p of col.world.pois) p.discovered = true;
  col.community.resources.food += 60; col.community.resources.glimmer += 10;
  if (!poor) { col.community.resources.scrap += 10; col.community.resources.wood += 10; }
  col.veil.influence += 40;
  const hi = col.haunts.findIndex((h) => col.world.districts[h.district].kind === kind);
  if (hi < 0) continue;
  tally.tried++;
  const team = [...alive(col.community)].sort((a, b) => b.sight - a.sight);
  const pick = [...new Set([team[0], team[1], team[team.length - 1], team[team.length - 2]].filter(Boolean).map((s) => s.id))];
  const cl = startClearing(col, hi, pick) as Clearing;
  let t = 0;
  for (; t < 14 && !cl.outcome; t++) playTurn(col, cl);
  const last = col.lastClearing ?? cl;
  tally[last.outcome as 'cleared' | 'withdrew' | 'lost']++;
  tally.turns += last.turn;
  tally.fled += last.units.filter((u) => u.state === 'fled').length;
  tally.taken += last.units.filter((u) => u.state === 'taken').length;
  const h = col.haunts[hi];
  const left = h.spirits.filter((s) => s.fate === 'present' && (s.kind === 'hollow' || s.calm < 2));
  console.log(`seed ${seed}: ${last.outcome} at turn ${last.turn}; left: ${left.map((s) => `${s.kind}(known ${s.known}, calm ${s.calm}${s.kind === 'hollow' ? `, hold ${s.integrity}` : ''})`).join(', ') || 'none'}; signs ${last.signs.filter((x) => x.found).length}/${last.signs.length}; team ${last.units.map((u) => `${u.name}:${u.state}/${u.nerve}${u.lantern ? `/${u.lantern.kind}${u.lantern.lit ? '' : '-out'}${Math.round(u.lantern.fuel)}` : ''}`).join(' ')}`);
  if (showLog) for (const l of last.log) console.log('   ', l);
}
console.log(`\n${kind}: ${tally.cleared}/${tally.tried} cleared, ${tally.withdrew} withdrew, ${tally.lost} lost; ${tally.fled} fled, ${tally.taken} taken; mean turns ${(tally.turns / Math.max(1, tally.tried)).toFixed(1)}`);
