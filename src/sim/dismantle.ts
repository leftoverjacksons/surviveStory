/**
 * Taking things down, moving them, and calling off what was started
 * (DESIGN §24.13). Right-click a building: "Take down" asks the builders to
 * dismantle it (about 40% of the work it took to put up) and brings back
 * half of what it was made of; "Move" does the same but brings back all of
 * it, and the player places the same kind again somewhere else. A building
 * not finished yet can be called off: everything delivered comes back.
 *
 * Everything the village has made can be taken down or moved (DESIGN §27):
 * - a home, even lived in: the household waits first in line for a new plot
 *   (moving: everything comes back, and the plot tool opens);
 * - a backyard trade: moved to another household's plot;
 * - the canopy kitchen: placed again anywhere;
 * - the fishing works: they come down together (move them by painting the
 *   Fishing zone at another pond or shore);
 * - a restored house of the old world: pulled down for its salvage.
 * The fire and the stockpile are moved in hearth.ts. Only the found shelter
 * the village started in, an old building of the site, stays.
 */
import type { Colony } from './colony';
import { log } from './community';
import { DEFS, type Building, type Cost, type Project, type SiteKind } from './buildings';
import { idx, inBounds } from './world';
import { finishRaze } from './salvage';

export interface Takedown {
  building: number;
  /** Work done and needed (minutes). */
  work: number;
  need: number;
  /** Moving it: everything it was made of comes back, and the same kind is placed elsewhere. */
  moving: boolean;
}

/** What it was made of (the cost of its kind at its tier), if it is something that can come down. */
function madeOf(b: Building): Cost | null {
  // A home is built from its plot's salvage; call it a small house's worth.
  if (b.kind === 'home') return { wood: 16, scrap: 8, glimmer: 0, glass: 0, copper: 0, steel: 0 };
  const def = (DEFS as Record<string, { cost: [Cost, Cost]; work: [number, number] }>)[b.kind];
  return def ? def.cost[b.tier] : null;
}
function workOf(b: Building): number {
  const def = (DEFS as Record<string, { work: [number, number] }>)[b.kind];
  return def ? def.work[b.tier] : 480;
}

/** Why this building can't be taken down (or moved), or null if it can. */
export function whyNotTakeDown(col: Colony, b: Building, moving = false): string | null {
  const v = col.village;
  if (b.kind === 'store') return 'The shelter the village started from stays.';
  if (b.ruin !== undefined && moving) return 'An old building can\'t be moved; it can be pulled down for its salvage.';
  if (FISHING.includes(b.kind) && moving) return 'The fishing works come down together; paint the Fishing zone where you want the new ones.';
  if (b.kind !== 'home' && b.ruin === undefined && !madeOf(b)) return 'That can\'t be taken down.';
  if ((v.takedowns ?? []).some((t) => t.building === b.id)) return 'It is already coming down.';
  return null;
}

const FISHING = ['jetty', 'fishhut', 'netshed', 'boat'];

/** Ask the builders to take it down (or move it). Returns why not, or null. */
export function takeDown(col: Colony, b: Building, moving = false): string | null {
  const why = whyNotTakeDown(col, b, moving);
  if (why) return why;
  (col.village.takedowns ??= []).push({ building: b.id, work: 0, need: Math.round(workOf(b) * 0.4), moving });
  const h = b.kind === 'home' ? col.village.households.find((x) => x.id === b.household) : undefined;
  log(col.community, b.ruin !== undefined ? `${b.name} is to be pulled down for what's in its walls.`
    : moving ? `${b.name} is to be moved: they'll take it apart carefully and keep every piece.${h ? ' The family will wait first in line for a new plot.' : ''}`
    : `${b.name} is to come down. Half of it can be used again.${h ? ' The family will wait first in line for a new plot.' : ''}`, 'info');
  return null;
}

/** Changed your mind: it stays up. */
export function keepStanding(col: Colony, buildingId: number) {
  const v = col.village;
  v.takedowns = (v.takedowns ?? []).filter((t) => t.building !== buildingId);
}

/** Dismantling is done: the building is gone, its ground is free, and its materials come back. */
export function finishTakedown(col: Colony, t: Takedown) {
  const v = col.village, w = col.world, res = col.community.resources;
  v.takedowns = (v.takedowns ?? []).filter((x) => x !== t);
  const b = v.buildings.find((x) => x.id === t.building);
  if (!b) return;
  // A restored old building: pulled down for its salvage (salvage.ts), its home plot freed.
  if (b.ruin !== undefined) {
    const r = w.ruins[b.ruin];
    freePlot(col, b);
    rehouse(col, b);
    v.buildings = v.buildings.filter((x) => x !== b);
    v.bedsDirty = true;
    if (r) { r.restored = false; finishRaze(col, { ruin: r.id, work: 0, need: 0 }); }
    w.zoneVersion++;
    return;
  }
  // The fishing works come down together, and the fishery with them.
  const fishery = FISHING.includes(b.kind) ? v.fisheries.find((f) => [f.jetty, f.hut, f.shed, f.boat].includes(b.id)) : undefined;
  if (fishery) {
    const parts = v.buildings.filter((x) => x !== b && [fishery.jetty, fishery.hut, fishery.shed, fishery.boat].includes(x.id));
    for (const o of parts) {
      const c = madeOf(o);
      if (c) for (const m of ['wood', 'scrap'] as const) res[m] += Math.floor((c[m] ?? 0) * 0.5);
      for (let dz = 0; dz < o.foot.d; dz++) for (let dx = 0; dx < o.foot.w; dx++) {
        const tx = o.foot.tx + dx, tz = o.foot.tz + dz;
        if (inBounds(w, tx, tz)) { const i = idx(w, tx, tz); w.blocked[i] = 0; w.deck[i] = 0; w.deckY[i] = 0; }
      }
    }
    for (const i of fishery.jettyTiles) { w.deck[i] = 0; w.deckY[i] = 0; }
    v.buildings = v.buildings.filter((x) => !parts.includes(x));
    v.fisheries = v.fisheries.filter((f) => f !== fishery);
    for (const s of col.community.survivors) if (s.alive && s.role === 'fisher') s.role = 'forager';
  }
  const cost = madeOf(b);
  const k = t.moving ? 1 : 0.5;
  const back: string[] = [];
  if (cost) for (const m of ['wood', 'scrap', 'glimmer', 'glass', 'copper', 'steel'] as const) {
    const n = Math.floor((cost[m] ?? 0) * k);
    if (n > 0) { res[m] += n; back.push(`${n} ${m}`); }
  }
  // Free its ground: its footprint, or (a home) the house on its plot.
  const free = (i: number) => { w.blocked[i] = 0; w.deck[i] = 0; w.deckY[i] = 0; };
  if (b.kind === 'home' && b.plot !== undefined) {
    freePlot(col, b);
    rehouse(col, b);
  } else {
    for (let dz = 0; dz < b.foot.d; dz++) for (let dx = 0; dx < b.foot.w; dx++) {
      const tx = b.foot.tx + dx, tz = b.foot.tz + dz;
      if (inBounds(w, tx, tz)) free(idx(w, tx, tz));
    }
  }
  // Anyone inside steps out first.
  for (const a of col.agents) if (a.inside === b.id) { if (a.door) { a.x = a.door.x; a.z = a.door.z; } a.indoors = false; a.inside = 0; }
  v.buildings = v.buildings.filter((x) => x !== b);
  v.bedsDirty = true;
  w.zoneVersion++;
  log(col.community, `${b.name} is down${back.length ? `: ${back.join(', ')} back in the stores` : ''}.${t.moving ? ' It waits in pieces for wherever it goes next.' : ''}`, 'good');
}

/** A home's plot goes with it: the land is open again. */
function freePlot(col: Colony, b: Building) {
  const v = col.village, w = col.world;
  const plot = b.plot !== undefined ? v.plots.find((p) => p.id === b.plot) : undefined;
  if (!plot) return;
  for (const i of plot.tiles) {
    if (w.blocked[i] && w.deck[i]) { w.blocked[i] = 0; w.deck[i] = 0; w.deckY[i] = 0; }
    if (v.plotAt[i] === plot.id) v.plotAt[i] = 0;
  }
  // Backyard trades on the plot come down with it (half back).
  for (const o of v.buildings.filter((x) => x !== b && x.plot === plot.id && x.kind !== 'home')) {
    for (let dz = 0; dz < o.foot.d; dz++) for (let dx = 0; dx < o.foot.w; dx++) {
      const tx = o.foot.tx + dx, tz = o.foot.tz + dz;
      if (inBounds(w, tx, tz)) w.blocked[idx(w, tx, tz)] = 0;
    }
    v.buildings = v.buildings.filter((x) => x !== o);
  }
  v.plots = v.plots.filter((p) => p !== plot);
}

/** The household that lived there waits, first in line, for a new plot. */
function rehouse(col: Colony, b: Building) {
  const v = col.village;
  const h = v.households.find((x) => x.home === b.id);
  if (!h) return;
  h.home = 0;
  v.homeQueue = [h.id, ...v.homeQueue.filter((id) => id !== h.id)];
}

/** Why an unfinished project can't be called off, or null. */
export function whyNotCancel(p: Project): string | null {
  if (p.done) return 'It is finished.';
  if (p.kind === 'home') return 'A family is waiting on this home (for now it can\'t be called off).';
  if (p.kind === 'clear_store' || p.kind === 'patch_roof') return 'The shelter comes first.';
  return null;
}

/** Call off an unfinished project: whatever was delivered goes back to the stores. */
export function cancelProject(col: Colony, p: Project): string | null {
  const why = whyNotCancel(p);
  if (why) return why;
  const v = col.village, res = col.community.resources;
  for (const m of ['wood', 'scrap', 'glimmer', 'glass', 'copper', 'steel'] as const) res[m] += p.delivered[m] ?? 0;
  for (const i of p.blockTiles ?? []) col.world.blocked[i] = 0;
  for (const id of p.clearTrees) { const tr = col.world.trees[id]; if (tr?.reserved) tr.reserved = 0; }
  v.projects = v.projects.filter((x) => x !== p);
  col.world.zoneVersion++;
  log(col.community, `${p.name} was called off. What had been brought for it went back to the stores.`, 'info');
  return null;
}

/** The kind to place again after a move, if it is one the build menu knows. */
export const placeKindOf = (b: Building): SiteKind | null => (b.kind in DEFS && b.kind !== 'annex' && b.kind !== 'store' && b.kind !== 'home' && b.ruin === undefined && !FISHING.includes(b.kind) ? b.kind as SiteKind : null);
