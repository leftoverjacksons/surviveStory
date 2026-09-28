/**
 * Long-run soak (DESIGN §22.2): villages on autopilot for several years,
 * reporting by season, and flagging what goes wrong over time: errors,
 * slowdowns, lists that grow without bound, sites that stall, collapse.
 * Usage: npx vite-node scripts/soak.ts -- [colonies=8] [years=5] [--detail]
 * (--detail: per village at the end: households, buildings, roles, food by source, stocks, unmet needs).
 */
import { DAYS_PER_SEASON, DAYS_PER_YEAR, SEASONS } from '../src/sim/calendar';
import { alive, communityMorale, createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { heapHaunted } from '../src/sim/haunt';
import { needRows } from '../src/sim/trades';
import { storageCapacity } from '../src/sim/buildings';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = Number(args[0] ?? 8), YEARS = Number(args[1] ?? 5);
const DETAIL = process.argv.includes('--detail');
const rows: Record<string, number[][]> = {};
const flags: string[] = [];
const unmet = new Map<string, number>();
const t00 = Date.now();

for (let seed = 1; seed <= N; seed++) {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  col.village.autoPlan = true;
  col.village.autopilot = true;
  const stall = new Map<number, { work: number; since: number }>();
  let lastMs = 0;
  for (let d = 1; d <= YEARS * DAYS_PER_YEAR; d++) {
    const t0 = performance.now();
    try {
      for (let m = 0; m < 1440; m += 5) tick(col, 5);
    } catch (e) {
      flags.push(`seed ${seed} day ${d}: ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`);
      break;
    }
    const ms = performance.now() - t0;
    lastMs = ms;
    // Sites that make no progress for two seasons.
    for (const p of col.village.projects) {
      if (p.done) continue;
      const w = p.work + Object.values(p.delivered).reduce((a, b) => a + b, 0);
      const s = stall.get(p.id);
      if (!s || s.work !== w) stall.set(p.id, { work: w, since: d });
      else if (d - s.since === DAYS_PER_SEASON * 2) flags.push(`seed ${seed} day ${d}: stalled "${p.name}" (${p.kind}) · delivered ${JSON.stringify(Object.fromEntries(Object.entries(p.delivered).filter(([, v]) => v)))} of ${JSON.stringify(Object.fromEntries(Object.entries(p.cost).filter(([, v]) => v)))} · work ${Math.round(p.work)}/${p.workNeeded}`);
    }
    if (d % DAYS_PER_SEASON === 0) {
      const c = col.community, r = c.resources, v = col.village;
      const key = `Y${Math.ceil(d / DAYS_PER_YEAR)} ${SEASONS[((d / DAYS_PER_SEASON) - 1) % 4]}`;
      for (const x of needRows(col)) if (!x.met) unmet.set(`${x.tier}:${x.id}`, (unmet.get(`${x.tier}:${x.id}`) ?? 0) + 1);
      (rows[key] ??= []).push([
        alive(c).length, communityMorale(c), r.food, r.wood, r.scrap, v.buildings.filter((b) => b.kind === 'home').length,
        v.needTier ?? 0, r.tools, r.clothes, r.preserves, col.folk.level, col.folk.standing, col.haunts.filter((h) => h.state === 'cleared').length, r.glass + r.copper + r.steel,
        col.world.heaps.filter((h) => !heapHaunted(col, h.tx, h.tz)).reduce((n, h) => n + h.scrap, 0), col.world.heaps.reduce((n, h) => n + h.scrap, 0), r.cloth, v.projects.filter((p) => !p.done).length, ms,
      ]);
    }
    if (!alive(col.community).length) { flags.push(`seed ${seed} day ${d}: everyone is gone`); break; }
  }
  const c = col.community;
  const dead = c.survivors.filter((s) => !s.alive && !s.departed && !s.taken).length, left = c.survivors.filter((s) => s.departed).length;
  console.log(`seed ${seed}: day ${c.day}, ${alive(c).length} alive, ${dead} died, ${left} left, ${col.village.buildings.length} buildings, last day ${lastMs.toFixed(0)} ms, log ${c.log.length}, hints ${col.hints.size}, projects ${col.village.projects.length}`);
  if (DETAIL) {
    // Where the village stands at the end, for diagnosing balance (--detail).
    const v = col.village, r = c.resources;
    const hh = v.households;
    const kinds = v.buildings.reduce<Record<string, number>>((m, b) => ((m[b.kind] = (m[b.kind] ?? 0) + 1), m), {});
    const perYear = (n: number) => Math.round(n / YEARS);
    console.log(`  households ${hh.length} (homed ${hh.filter((h) => h.home).length}, sizes ${hh.map((h) => h.members.length).join('')}), plots ${v.plots.length}, open home sites ${v.projects.filter((p) => !p.done && p.kind === 'home').length}`);
    console.log(`  built ${Object.entries(kinds).map(([k, n]) => `${k}${n > 1 ? '×' + n : ''}`).join(' ')}`);
    console.log(`  roles ${Object.entries(alive(c).reduce<Record<string, number>>((m, s) => ((m[s.role] = (m[s.role] ?? 0) + 1), m), {})).map(([k, n]) => `${k} ${n}`).join(', ')}`);
    console.log(`  food/yr ${Object.entries(col.ledger).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${perYear(n)}`).join(' · ')}; store cap ${storageCapacity(v)}`);
    console.log(`  stock food ${Math.round(r.food)} jars ${Math.round(r.preserves)} wood ${Math.round(r.wood)} scrap ${Math.round(r.scrap)} cloth ${Math.round(r.cloth)} tools ${r.tools.toFixed(1)} clothes ${r.clothes.toFixed(1)} rare ${r.glass + r.copper + r.steel}; unmet ${needRows(col).filter((x) => !x.met).map((x) => x.id).join(',') || 'none'}; festival ${Math.round((col.minute - col.council.festivalUntil) / 1440)} days ago`);
  }
}

const cols = ['alive', 'morale', 'food', 'wood', 'scrap', 'homes', 'tier', 'tools', 'clothes', 'jars', 'folkLv', 'folkSt', 'cleared', 'rare', 'scrapOK', 'scrapAll', 'cloth', 'active', 'ms/day'];
console.log(`\n${N} colonies × ${YEARS} years (${((Date.now() - t00) / 1000).toFixed(0)} s). Means by season:`);
console.log(['season'.padEnd(10), ...cols.map((c) => c.padStart(8))].join(''));
for (const [k, rs] of Object.entries(rows)) {
  const mean = cols.map((_, i) => rs.reduce((n, r) => n + r[i], 0) / rs.length);
  console.log([k.padEnd(10), ...mean.map((m) => (m >= 100 ? m.toFixed(0) : m.toFixed(1)).padStart(8))].join(''));
}
console.log(`\nUnmet needs (season-snapshots): ${[...unmet].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
console.log(`\nFlags (${flags.length}):`);
for (const f of flags.slice(0, 40)) console.log('  ' + f);
