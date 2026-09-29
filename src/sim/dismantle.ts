/**
 * Taking things down, moving them, and calling off what was started
 * (DESIGN §24.13). Right-click a building: "Take down" asks the builders to
 * dismantle it (about 40% of the work it took to put up) and brings back
 * half of what it was made of; "Move" does the same but brings back all of
 * it, and the player places the same kind again somewhere else. A building
 * not finished yet can be called off: everything delivered comes back.
 *
 * Not (yet): the found shelter and kitchen, fishing works, restored ruins,
 * and homes someone lives in.
 */
import type { Colony } from './colony';
import { log } from './community';
import { DEFS, type Building, type Cost, type Project, type SiteKind } from './buildings';
import { idx, inBounds } from './world';

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
  if (b.kind === 'store' || b.kind === 'kitchen') return 'The shelter the village started from stays.';
  if (b.ruin !== undefined) return 'A restored house of the old world stays standing.';
  if (['jetty', 'fishhut', 'netshed', 'boat'].includes(b.kind)) return 'The fishing works stay with their pond (for now).';
  if (b.kind === 'home') {
    if (moving) return 'A home stands on its plot; it can be taken down, not moved.';
    if (b.household && v.households.some((h) => h.id === b.household)) return 'Someone lives here.';
  }
  if (b.kind !== 'home' && !madeOf(b)) return 'That can\'t be taken down.';
  if (moving && b.plot !== undefined) return 'A backyard trade belongs to its plot; it can be taken down, not moved.';
  if ((v.takedowns ?? []).some((t) => t.building === b.id)) return 'It is already coming down.';
  return null;
}

/** Ask the builders to take it down (or move it). Returns why not, or null. */
export function takeDown(col: Colony, b: Building, moving = false): string | null {
  const why = whyNotTakeDown(col, b, moving);
  if (why) return why;
  (col.village.takedowns ??= []).push({ building: b.id, work: 0, need: Math.round(workOf(b) * 0.4), moving });
  log(col.community, moving ? `${b.name} is to be moved: they'll take it apart carefully and keep every piece.` : `${b.name} is to come down. Half of it can be used again.`, 'info');
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
    const plot = v.plots.find((p) => p.id === b.plot);
    for (const i of plot?.tiles ?? []) if (w.blocked[i] && w.deck[i]) free(i);
    // The plot goes with it: the land is open again.
    if (plot) {
      for (const i of plot.tiles) if (v.plotAt[i] === plot.id) v.plotAt[i] = 0;
      v.plots = v.plots.filter((p) => p !== plot);
    }
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
export const placeKindOf = (b: Building): SiteKind | null => (b.kind in DEFS && b.kind !== 'kitchen' && b.kind !== 'annex' ? b.kind as SiteKind : null);
