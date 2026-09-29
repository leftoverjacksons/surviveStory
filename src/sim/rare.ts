/**
 * District-only materials (DESIGN §21.7): the rhythm breaker.
 *
 * Ordinary salvage (scrap and cloth) comes from heaps anywhere the spirits
 * don't watch. But glass, copper and steel are in the old buildings
 * themselves (window panes and shop fronts, pipe and wire in the walls,
 * girders and roof trusses), and nobody strips a building while something
 * still lives in it. So these come only from districts that have been
 * cleared and given to the village.
 *
 * A ruin can be stripped or restored, not both: stripping takes what it has
 * left; restoring keeps it standing (and what's left in it stays there).
 */
import type { Colony } from './colony';
import { log, type Resources } from './community';
import { RARE, type Material } from './buildings';
import type { Ruin, RuinKind, DistrictKind } from './oldworld';

export type RareMat = 'glass' | 'copper' | 'steel';

/** What each kind of building gives up when stripped, and what it's called. */
const YIELD: Partial<Record<RuinKind, { mat: RareMat; what: string; per: number }>> = {
  house: { mat: 'copper', what: 'copper pipe and wire', per: 1 },
  terrace: { mat: 'copper', what: 'copper pipe and wire', per: 1 },
  garage: { mat: 'steel', what: 'steel beams and a car lift', per: 0.8 },
  shop: { mat: 'glass', what: 'plate glass', per: 1.1 },
  bigbox: { mat: 'steel', what: 'roof trusses and shelving steel', per: 0.7 },
  warehouse: { mat: 'steel', what: 'girders', per: 0.8 },
  silo: { mat: 'steel', what: 'steel plate', per: 1 },
  farmhouse: { mat: 'glass', what: 'window glass', per: 0.8 },
  chapel: { mat: 'glass', what: 'leaded glass', per: 0.9 },
  glasshouse: { mat: 'glass', what: 'greenhouse glass', per: 1.4 },
};

/** Where each material is found, for hints (by district kind). */
export const FOUND_IN: Record<RareMat, DistrictKind[]> = {
  glass: ['strip', 'garden', 'oldtown', 'farmstead'],
  copper: ['suburb', 'oldtown'],
  steel: ['works', 'strip', 'farmstead'],
};

export const RARE_NAME: Record<RareMat, string> = { glass: 'glass', copper: 'copper', steel: 'steel' };

/** How much a ruin held when the village first came (before any stripping). */
export function rareTotal(r: Ruin): number {
  const y = YIELD[r.kind];
  if (!y) return 0;
  return Math.max(2, Math.min(12, Math.round((r.w * r.d / 7) * y.per * (1 - r.decay * 0.5))));
}

export function rareOf(r: Ruin): { mat: RareMat; what: string; left: number } | null {
  const y = YIELD[r.kind];
  if (!y) return null;
  return { mat: y.mat, what: y.what, left: Math.max(0, rareTotal(r) - (r.stripped ?? 0)) };
}

/** Can this ruin be stripped now? */
export function strippable(col: Colony, r: Ruin): boolean {
  const y = rareOf(r);
  if (!y || y.left <= 0 || r.restored || r.razed) return false;
  const h = col.haunts.find((x) => x.district === r.district);
  if (!h || h.state !== 'cleared' || h.owner === 'folk') return false;
  return !col.village.projects.some((p) => !p.done && p.kind === 'restore' && p.ruin === r.id);
}

/** Rare materials wanted: what building sites still need, plus a little in store once there is somewhere to get it. */
export function rareWanted(col: Colony): Record<RareMat, number> {
  const out: Record<RareMat, number> = { glass: 0, copper: 0, steel: 0 };
  for (const p of col.village.projects) {
    if (p.done) continue;
    for (const m of RARE as RareMat[]) out[m] += Math.max(0, p.cost[m] - p.delivered[m] - p.incoming[m]);
  }
  const r = col.community.resources;
  // A small stock, so the player can place a dome or a glasshouse without waiting.
  for (const m of RARE as RareMat[]) out[m] = Math.max(0, out[m] + 6 - r[m]);
  return out;
}

/** The ruin to strip next, nearest first, for the material most wanted. */
export function ruinToStrip(col: Colony, from: { x: number; z: number }, busy: Set<number>): Ruin | null {
  const want = rareWanted(col);
  let best: Ruin | null = null, bestS = Infinity;
  for (const r of col.world.ruins) {
    if (busy.has(r.id) || !strippable(col, r)) continue;
    const y = rareOf(r)!;
    if (want[y.mat] <= 0) continue;
    const s = Math.hypot(r.x - from.x, r.z - from.z) - want[y.mat] * 2;
    if (s < bestS) { best = r; bestS = s; }
  }
  return best;
}

/** Take up to `n` from a ruin; returns what was taken. */
export function strip(col: Colony, r: Ruin, n: number, who: string): { mat: RareMat; amount: number } | null {
  const y = rareOf(r);
  if (!y || y.left <= 0) return null;
  const amount = Math.min(n, y.left);
  r.stripped = (r.stripped ?? 0) + amount;
  const key = `strip${r.district}${y.mat}`;
  if (!col.hints.has(key)) {
    col.hints.add(key);
    const d = col.world.districts[r.district];
    log(col.community, `${who} came back from ${d.name} with ${y.what} out of ${r.name}. You can't get that from a junk heap.`, 'good');
  }
  return { mat: y.mat, amount };
}

/** Where a material could be had: cleared districts first, then the nearest still haunted. */
export function whereToFind(col: Colony, m: RareMat): { district: number; cleared: boolean } | null {
  const w = col.world, home = w.campfire;
  const cands = w.districts.filter((d) => w.ruins.some((r) => r.district === d.id && rareOf(r)?.mat === m && (rareOf(r)?.left ?? 0) > 0 && !r.restored));
  const withState = cands.map((d) => ({ d, h: col.haunts.find((x) => x.district === d.id) }))
    .filter(({ h }) => h?.owner !== 'folk')
    .sort((a, b) => Math.hypot(a.d.x - home.x, a.d.z - home.z) - Math.hypot(b.d.x - home.x, b.d.z - home.z));
  const open = withState.find(({ h }) => h?.state === 'cleared');
  if (open) return { district: open.d.id, cleared: true };
  const shut = withState[0];
  return shut ? { district: shut.d.id, cleared: false } : null;
}

/** What a district holds, for its card. */
export function districtYield(col: Colony, districtId: number): Partial<Record<RareMat, number>> {
  const out: Partial<Record<RareMat, number>> = {};
  for (const r of col.world.ruins) {
    if (r.district !== districtId || r.restored) continue;
    const y = rareOf(r);
    if (y && y.left > 0) out[y.mat] = (out[y.mat] ?? 0) + y.left;
  }
  return out;
}

/** Once a day: if a site is waiting on something only the old world has, someone says where it is. */
export function rareDaily(col: Colony) {
  const c = col.community;
  for (const p of col.village.projects) {
    if (p.done) continue;
    for (const m of RARE as RareMat[]) {
      const short = p.cost[m] - p.delivered[m] - p.incoming[m] - (c.resources as Resources)[m];
      if (short <= 0) continue;
      if (col.world.ruins.some((r) => rareOf(r)?.mat === m && strippable(col, r))) continue;
      const key = `rarehint${m}${c.day - (c.day % 6)}`;
      if (col.hints.has(key)) continue;
      col.hints.add(key);
      const where = whereToFind(col, m);
      const d = where ? col.world.districts[where.district] : null;
      log(c, d
        ? `${p.name} is waiting on ${RARE_NAME[m]}. There's plenty in ${d.name}${where!.cleared ? '' : ', if anyone dared go in (clear it first: click it on the map)'}.`
        : `${p.name} is waiting on ${RARE_NAME[m]}, and nobody knows where any is left.`, 'info');
    }
  }
}

export const isRare = (m: Material): m is RareMat => (RARE as string[]).includes(m);
