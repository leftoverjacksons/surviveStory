/**
 * Pacing audit (DESIGN §22.11): what the player is asked to decide, what
 * becomes possible, and what happens, day by day, for an attentive player
 * (autopilot stands in: it answers every council, places what is agreed,
 * draws plots and paints zones). Nothing is changed; it only measures.
 *
 *   npx vite-node scripts/pacing.ts -- [colonies=6] [days=64] [--json=out.json] [--strips]
 *
 * Asked of the player ("forced"): a council meeting (the game pauses), an
 * agreed build to place, a household wanting a plot drawn, someone led astray
 * to search for. Possible ("options"): a building first affordable, the
 * timber (joinery) version first available, a district first clearable, the
 * Folk met, a Folk work first affordable, enough Influence for a nudge.
 */
import { writeFileSync } from 'node:fs';
import { DAYS_PER_SEASON } from '../src/sim/calendar';
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { DEFS, MATERIALS, PLACEABLE, tierFor } from '../src/sim/buildings';
import { waitingHouseholds } from '../src/sim/homes';
import { canClear } from '../src/sim/haunt';
import { FOLK_WORKS } from '../src/sim/folk';
import { CALM_COST, DREAM_COST, OMEN_COST } from '../src/sim/council';
import { needRows } from '../src/sim/trades';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = Number(args[0] ?? 6), DAYS = Number(args[1] ?? 64);
const jsonOut = process.argv.find((a) => a.startsWith('--json='))?.slice(7);
const strips = process.argv.includes('--strips');
/** Real minutes a game day lasts at each speed (main.ts SPEEDS: 2, 6, 16 game minutes a second). */
const REAL_MIN_PER_DAY = { '1×': 1440 / 2 / 60, '3×': 1440 / 6 / 60, '8×': 1440 / 16 / 60 };

interface Day {
  day: number;
  forced: { council: number; place: number; plot: number; search: number };
  proposals: string[];
  autopilot: string[];
  unlocks: string[];
  events: Record<string, number>;
  tier: number;
  unmet: string[];
}

function run(seed: number) {
  const col: Colony = createColony(generateWorld(seed), createCommunity(seed));
  col.village.autoPlan = true;
  col.village.autopilot = true;
  const days: Day[] = [];
  const first: Record<string, number> = {};
  const seen = { council: -1, priority: undefined as string | undefined, waiting: new Set<number>(), led: false, log: 0 };
  const unlock = (key: string, d: Day) => { if (first[key] === undefined) { first[key] = d.day; d.unlocks.push(key); } };
  for (let dayN = 1; dayN <= DAYS; dayN++) {
    const d: Day = { day: dayN, forced: { council: 0, place: 0, plot: 0, search: 0 }, proposals: [], autopilot: [], unlocks: [], events: {}, tier: 0, unmet: [] };
    for (let h = 0; h < 24; h++) {
      tick(col, 60);
      const c = col.community, v = col.village, r = c.resources, f = col.folk;
      // Asked of the player.
      const a = col.council.active;
      if (a && a.proposals[0].id !== seen.council) {
        seen.council = a.proposals[0].id;
        d.forced.council++;
        d.proposals.push(...a.proposals.map((p) => p.kind === 'build' ? `build:${p.build}` : p.kind));
      }
      if (v.priority && v.priority !== seen.priority) d.forced.place++;
      seen.priority = v.priority;
      for (const hh of waitingHouseholds(v)) if (!seen.waiting.has(hh.id)) { seen.waiting.add(hh.id); d.forced.plot++; }
      if (f.led && !seen.led) d.forced.search++;
      seen.led = !!f.led;
      // Possible.
      for (const { kind } of PLACEABLE) {
        const tier = tierFor(v, c, kind);
        const cost = DEFS[kind].cost[tier];
        if (MATERIALS.every((m) => r[m] >= cost[m])) unlock(`afford:${kind}`, d);
        if (tier === 1) unlock(`timber:${kind}`, d);
      }
      if (col.haunts.some((x) => !canClear(col, x))) unlock('clearable district', d);
      if (f.met) unlock('Folk met', d);
      for (const [k, w] of Object.entries(FOLK_WORKS)) if (f.met && f.dew >= w.dew && f.song >= w.song) unlock(`folk:${k}`, d);
      for (const [k, cost] of [['nudge:calm', CALM_COST], ['nudge:omen', OMEN_COST], ['nudge:dream', DREAM_COST]] as const) if (col.veil.influence >= cost) unlock(k, d);
    }
    const c = col.community;
    // What happened, from the log (the chronicle's own classes), and what autopilot did in the player's place.
    const total = c.logCount ?? 0;
    const fresh = c.log.slice(c.log.length - Math.min(total - seen.log, c.log.length));
    seen.log = total;
    for (const e of col.chronicle?.events.filter((x) => x.day === dayN) ?? []) d.events[e.kind] = (d.events[e.kind] ?? 0) + 1;
    for (const e of fresh) if (e.text.startsWith('Autopilot')) d.autopilot.push(e.text.replace(/^Autopilot /, '').replace(/\.$/, ''));
    d.tier = col.village.needTier ?? 0;
    d.unmet = needRows(col).filter((x) => !x.met).map((x) => x.id);
    days.push(d);
    if (!alive(c).length) break;
  }
  return { seed, days, first, pop: alive(col.community).length };
}

const runs = Array.from({ length: N }, (_, i) => run(i + 1));
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const forcedOf = (d: Day) => d.forced.council + d.forced.place + d.forced.plot + d.forced.search;

console.log(`Pacing audit: ${N} villages × ${DAYS} days (autopilot as the attentive player). A game day is ${REAL_MIN_PER_DAY['1×']} real minutes at 1×, ${REAL_MIN_PER_DAY['3×']} at 3×, ${REAL_MIN_PER_DAY['8×'].toFixed(1)} at 8×.\n`);

// 1. Decisions asked of the player, by season.
console.log('Asked of the player, per game day (mean over villages), by season:');
console.log('season'.padEnd(12) + ['council', 'place', 'plot', 'search', 'all', 'events', 'quiet days'].map((s) => s.padStart(11)).join(''));
for (let s = 0; s * DAYS_PER_SEASON < DAYS; s++) {
  const ds = runs.flatMap((r) => r.days.filter((d) => d.day > s * DAYS_PER_SEASON && d.day <= (s + 1) * DAYS_PER_SEASON));
  const m = (f: (d: Day) => number) => (ds.reduce((n, d) => n + f(d), 0) / Math.max(1, ds.length)).toFixed(2);
  const quiet = ds.filter((d) => forcedOf(d) === 0 && !d.unlocks.length).length / Math.max(1, ds.length);
  console.log(`Y${Math.floor(s / 4) + 1} ${['spring', 'summer', 'autumn', 'winter'][s % 4]}`.padEnd(12)
    + [m((d) => d.forced.council), m((d) => d.forced.place), m((d) => d.forced.plot), m((d) => d.forced.search), m(forcedOf),
      m((d) => Object.values(d.events).reduce((a, b) => a + b, 0)), `${Math.round(quiet * 100)}%`].map((x) => x.padStart(11)).join(''));
}

// 2. Gaps: runs of days with nothing asked of the player and nothing new possible.
console.log('\nLongest stretch with nothing asked and nothing new possible (days; real minutes at 1× / 3×):');
for (const r of runs) {
  let best = 0, cur = 0, at = 0;
  for (const d of r.days) {
    if (forcedOf(d) === 0 && !d.unlocks.length) { cur++; if (cur > best) { best = cur; at = d.day - cur + 1; } } else cur = 0;
  }
  let bestAsk = 0; cur = 0;
  for (const d of r.days) { if (forcedOf(d) === 0) { cur++; bestAsk = Math.max(bestAsk, cur); } else cur = 0; }
  console.log(`  seed ${r.seed}: ${best} days from day ${at} (${Math.round(best * REAL_MIN_PER_DAY['1×'])} / ${Math.round(best * REAL_MIN_PER_DAY['3×'])} min); longest with nothing asked: ${bestAsk} days`);
}

// 3. When things become possible.
const keys = [...new Set(runs.flatMap((r) => Object.keys(r.first)))];
const order = keys.map((k) => ({ k, days: runs.map((r) => r.first[k]).filter((x) => x !== undefined) as number[] }))
  .sort((a, b) => median(a.days) - median(b.days));
console.log('\nFirst possible (median day, range, villages reaching it):');
for (const { k, days } of order) console.log(`  ${k.padEnd(24)} day ${String(median(days)).padStart(3)}  (${Math.min(...days)}–${Math.max(...days)}, ${days.length}/${N})`);

// 4. Need tier and unmet needs over time.
console.log('\nNeed tier (median) and most-unmet need, by season:');
for (let s = 0; s * DAYS_PER_SEASON < DAYS; s++) {
  const end = Math.min(DAYS, (s + 1) * DAYS_PER_SEASON);
  const ds = runs.map((r) => r.days.find((d) => d.day === end)).filter(Boolean) as Day[];
  const tally: Record<string, number> = {};
  for (const d of ds) for (const u of d.unmet) tally[u] = (tally[u] ?? 0) + 1;
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ${n}/${ds.length}`).join(', ');
  console.log(`  end of Y${Math.floor(s / 4) + 1} ${['spring', 'summer', 'autumn', 'winter'][s % 4]}: tier ${median(ds.map((d) => d.tier))}; unmet: ${top || 'none'}`);
}

// 5. What the council asks about, and what autopilot decided in the player's place.
const props: Record<string, number> = {};
for (const r of runs) for (const d of r.days) for (const p of d.proposals) props[p] = (props[p] ?? 0) + 1;
console.log(`\nCouncil proposals (all villages): ${Object.entries(props).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
const auto: Record<string, number> = {};
for (const r of runs) for (const d of r.days) for (const a of d.autopilot) { const k = a.replace(/ into .*|:.*$/, ''); auto[k] = (auto[k] ?? 0) + 1; }
console.log(`Autopilot's own decisions (the player's, in play): ${Object.entries(auto).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ')}`);

if (strips) {
  console.log('\nDay strips (C council, P place, H plot for a household, S search, + something new possible, . nothing):');
  for (const r of runs) {
    const line = r.days.map((d) => d.forced.council ? 'C' : d.forced.place ? 'P' : d.forced.plot ? 'H' : d.forced.search ? 'S' : d.unlocks.length ? '+' : '.').join('');
    console.log(`  ${String(r.seed).padStart(2)} ${line.replace(new RegExp(`(.{${DAYS_PER_SEASON}})`, 'g'), '$1 ')}`);
  }
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ N, DAYS, REAL_MIN_PER_DAY, runs }, null, 0));
