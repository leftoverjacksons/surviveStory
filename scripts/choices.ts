/**
 * Do council choices matter? (DESIGN §22.11.) The same villages, played with
 * different council policies, compared after N days. Any change sends a
 * deterministic run down a different path, so a "control" (the usual choice,
 * made at a different moment) measures that chaos; a policy matters only
 * where it moves an outcome by clearly more than the control does.
 *
 *   npx vite-node scripts/choices.ts -- [colonies=8] [days=64]
 */
import { alive, communityMorale, createCommunity } from '../src/sim/community';
import { createColony, tick, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { councilFavourite, resolvable, resolveCouncil, type Proposal } from '../src/sim/council';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = Number(args[0] ?? 8), DAYS = Number(args[1] ?? 64);

const FOLKISH = ['folk_festival', 'folk_land', 'folk_amends', 'offering', 'wild_ring', 'grove'];
type Policy = (col: Colony, ps: Proposal[]) => Proposal | null;
const pickBy = (pred: (p: Proposal) => boolean): Policy => (col, ps) => {
  const ok = ps.filter((p) => resolvable(col, p));
  return ok.filter(pred).sort((a, b) => b.support.length - a.support.length)[0] ?? councilFavourite(col);
};
const POLICIES: Record<string, Policy | null> = {
  control: null, // the council settles itself at its deadline (the default headless behaviour)
  favourite: (col) => councilFavourite(col), // same choice, made at once
  least: (col, ps) => ps.filter((p) => resolvable(col, p)).sort((a, b) => a.support.length - b.support.length)[0] ?? null,
  folk: pickBy((p) => FOLKISH.includes(p.kind)),
  village: pickBy((p) => !FOLKISH.includes(p.kind)),
  homes: pickBy((p) => p.kind === 'home'),
  // For dilemmas (DESIGN §23.5): the answers come in a fixed order (generous or bold first, cautious last).
  first: (col, ps) => ps.find((p) => resolvable(col, p)) ?? null,
  last: (col, ps) => [...ps].reverse().find((p) => resolvable(col, p)) ?? null,
};

const METRICS = ['alive', 'morale', 'tier', 'homes', 'buildings', 'folkStanding', 'folkLevel', 'cleared', 'influence', 'food'] as const;
type Out = Record<(typeof METRICS)[number], number>;

function run(seed: number, policy: Policy | null): Out {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  col.village.autoPlan = true;
  col.village.autopilot = true;
  for (let m = 0; m < DAYS * 1440; m += 60) {
    tick(col, 60);
    if (policy && col.council.active) {
      const p = policy(col, col.council.active.proposals);
      if (p) resolveCouncil(col, p.id, false, true);
    }
  }
  const c = col.community, v = col.village;
  return {
    alive: alive(c).length, morale: communityMorale(c), tier: v.needTier ?? 0,
    homes: v.buildings.filter((b) => b.kind === 'home').length, buildings: v.buildings.length,
    folkStanding: col.folk.standing, folkLevel: col.folk.level, cleared: col.haunts.filter((h) => h.state === 'cleared').length,
    influence: col.veil.influence, food: c.resources.food + c.resources.preserves,
  };
}

const res: Record<string, Out[]> = {};
for (const [name, pol] of Object.entries(POLICIES)) res[name] = Array.from({ length: N }, (_, i) => run(i + 1, pol));

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); };
console.log(`Council policies, ${N} villages × ${DAYS} days. Means (± sd across villages):\n`);
console.log('policy'.padEnd(11) + METRICS.map((m) => m.padStart(14)).join(''));
for (const [name, outs] of Object.entries(res)) {
  console.log(name.padEnd(11) + METRICS.map((m) => { const xs = outs.map((o) => o[m]); return `${mean(xs).toFixed(1)}±${sd(xs).toFixed(1)}`.padStart(14); }).join(''));
}
// Paired by village: how far each policy moves each outcome, against how far the control's chaos moves it.
console.log('\nMean |change| from "favourite", paired by village; ratio to the control\'s |change| (chaos) in brackets:');
const chaos = Object.fromEntries(METRICS.map((m) => [m, mean(res.control.map((o, i) => Math.abs(o[m] - res.favourite[i][m])))]));
console.log('chaos'.padEnd(11) + METRICS.map((m) => chaos[m].toFixed(1).padStart(14)).join(''));
for (const name of ['least', 'folk', 'village', 'homes', 'first', 'last']) {
  console.log(name.padEnd(11) + METRICS.map((m) => {
    const d = res[name].map((o, i) => o[m] - res.favourite[i][m]);
    const md = mean(d);
    return `${md >= 0 ? '+' : ''}${md.toFixed(1)} (${(mean(d.map(Math.abs)) / Math.max(0.05, chaos[m])).toFixed(1)}×)`.padStart(14);
  }).join(''));
}
