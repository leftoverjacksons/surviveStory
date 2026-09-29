/**
 * Restoring the old world's buildings (DESIGN §18, §19): once a haunted
 * district is cleared and given to the village, its ruins can be patched up
 * and used again. A house becomes somewhere to sleep, a garage a workbench,
 * a shop or warehouse a store, a chapel a shrine, a glasshouse a working
 * greenhouse. Restoring costs far less than building new: the walls are
 * already standing. The restored building behaves as its kind does at home
 * (beds, storage, the workbench, a shrine's Resonance, a garden's yield).
 */
import type { Colony } from './colony';
import { alive, log } from './community';
import { bedsTotal, storageCapacity, storageWanted, type BuildingKind, type Cost, type Project } from './buildings';
import type { Ruin, RuinKind } from './oldworld';
import { inBounds, passable, toTileX, toTileZ, type Point, type World } from './world';
import { findPath } from './path';

export interface RestoreDef {
  as: Extract<BuildingKind, 'home' | 'hut' | 'workshop' | 'cellar' | 'shrine' | 'garden'>;
  /** What it becomes, given the ruin. */
  name: (r: Ruin) => string;
  cost: Cost;
  work: number;
  beds?: number;
  /** Food kept, for stores. */
  capacity?: number;
}

const c = (wood: number, scrap: number, glimmer = 0): Cost => ({ wood, scrap, glimmer, glass: 0, copper: 0, steel: 0 });

export const RESTORE: Partial<Record<RuinKind, RestoreDef>> = {
  // Houses become homes again, with a household, a yard and the lights (DESIGN §24.16).
  house: { as: 'home', name: (r) => `${r.name}, lived in again`, cost: c(8, 3), work: 700, beds: 3 },
  terrace: { as: 'home', name: (r) => `${r.name}, lived in again`, cost: c(8, 3), work: 700, beds: 3 },
  farmhouse: { as: 'home', name: (r) => `${r.name}, lived in again`, cost: c(10, 3), work: 800, beds: 4 },
  garage: { as: 'workshop', name: (r) => `a workbench in ${r.name}`, cost: c(4, 2), work: 360 },
  shed: { as: 'workshop', name: (r) => `a workbench in ${r.name}`, cost: c(4, 2), work: 360 },
  shop: { as: 'cellar', name: (r) => `stores in ${r.name}`, cost: c(6, 2), work: 420, capacity: 90 },
  bigbox: { as: 'cellar', name: (r) => `a storehouse in ${r.name}`, cost: c(12, 4), work: 900, capacity: 240 },
  warehouse: { as: 'cellar', name: (r) => `a storehouse in ${r.name}`, cost: c(12, 4), work: 900, capacity: 220 },
  barn: { as: 'cellar', name: (r) => `a hay-barn store in ${r.name}`, cost: c(8, 2), work: 600, capacity: 140 },
  chapel: { as: 'shrine', name: (r) => `a shrine in ${r.name}`, cost: c(6, 2, 4), work: 500 },
  glasshouse: { as: 'garden', name: (r) => `the beds in ${r.name}`, cost: c(6, 4), work: 480 },
};

/** Ruins the village could restore now: in a district that is cleared and theirs, not yet restored or planned. */
export function restorable(col: Colony): Ruin[] {
  const w = col.world, v = col.village;
  const planned = new Set(v.projects.filter((p) => !p.done && p.kind === 'restore').map((p) => p.ruin));
  const ours = new Set(col.haunts.filter((h) => h.state === 'cleared' && (h.owner === 'village' || h.owner === 'shared')).map((h) => h.district));
  return w.ruins.filter((r) => ours.has(r.district) && !r.restored && !r.razed && !planned.has(r.id) && RESTORE[r.kind] && reachableRuin(w, r));
}

/** Can people get from the fire to the ruin's door at all? (Some stand beyond water or walls.) */
const reach = new WeakMap<Ruin, boolean>();
export function reachableRuin(w: World, r: Ruin): boolean {
  let ok = reach.get(r);
  if (ok === undefined) {
    const d = ruinDoor(w, r);
    ok = !!findPath(w, toTileX(w, w.campfire.x), toTileZ(w, w.campfire.z), toTileX(w, d.x), toTileZ(w, d.z), 120000);
    reach.set(r, ok);
  }
  return ok;
}

/** Where builders work and people go in: just in front of the ruin, on open ground. */
export function ruinDoor(w: World, r: Ruin): Point {
  const cs = Math.cos(r.yaw), sn = Math.sin(r.yaw);
  for (const out of [1.9, 2.6, 3.4]) for (const along of [0, 1.4, -1.4, 2.6, -2.6]) {
    const lz = r.d / 2 + out;
    const x = r.x + along * cs + lz * sn, z = r.z - along * sn + lz * cs;
    const tx = toTileX(w, x), tz = toTileZ(w, z);
    if (inBounds(w, tx, tz) && passable(w, tx, tz)) return { x, z };
  }
  const lz = r.d / 2 + 1.9;
  return { x: r.x + lz * sn, z: r.z + lz * cs };
}

/**
 * The village's wish to restore something, if there is anything worth it.
 * Returns the project to start, or null. Needs come first: beds, then
 * storage, a workbench, a shrine, a greenhouse; otherwise, one thing at a time.
 */
export function planRestore(col: Colony, lead: string, newProject: (p: Omit<Project, 'id' | 'delivered' | 'incoming' | 'work' | 'done'>) => Project): Project | null {
  const v = col.village, w = col.world;
  if (v.autoPlan === false) return null; // the player chooses what to restore
  if (v.projects.some((p) => !p.done && p.kind === 'restore')) return null;
  const options = restorable(col);
  if (!options.length) return null;
  const pop = alive(col.community).length;
  const has = (k: BuildingKind) => v.buildings.some((b) => b.kind === k);
  const score = (r: Ruin): number => {
    const d = RESTORE[r.kind]!;
    let s = 1;
    if ((d.as === 'hut' || d.as === 'home') && bedsTotal(v) < pop + 2) s += 6;
    if (d.as === 'home' && v.households.some((h) => !h.home)) s += 4;
    if (d.as === 'cellar' && col.community.resources.food > storageCapacity(v) * 0.7) s += 5;
    if (d.as === 'workshop' && !has('workshop')) s += 4;
    if (d.as === 'shrine' && !has('shrine')) s += 3;
    if (d.as === 'garden' && v.buildings.filter((b) => b.kind === 'garden').length < 2) s += 3;
    // Variety: a second store matters less than a first workbench.
    s -= v.buildings.filter((b) => b.ruin !== undefined && b.kind === d.as).length * 0.8;
    // Nearer is easier to keep up.
    return s - Math.hypot(r.x, r.z) / 60;
  };
  // Storehouses only while the stores can't hold two seasons' eating.
  const wanted = options.filter((x) => RESTORE[x.kind]!.as !== 'cellar' || storageWanted(v, pop));
  if (!wanted.length) return null;
  const r = wanted.sort((a, b) => score(b) - score(a))[0];
  // Only for a real need; otherwise one quiet improvement every eight days or so.
  const last = v.lastRestore ?? -99;
  if (score(r) < 2.5 && col.community.day - last < 8) return null;
  v.lastRestore = col.community.day;
  const def = RESTORE[r.kind]!;
  const door = ruinDoor(w, r);
  const tx = toTileX(w, door.x), tz = toTileZ(w, door.z);
  const d = w.districts[r.district];
  log(col.community, `${lead} walked out to ${d.name} and came back with a plan: ${def.name(r)}. "The walls are sound. It needs a roof patched and the doors rehung, that's all."`, 'good');
  return newProject({
    kind: 'restore', tier: 0, name: cap(def.name(r)), foot: { tx, tz, w: 1, d: 1 }, facing: 0,
    cost: { ...def.cost }, workNeeded: def.work, target: 0, clearTrees: [], ruin: r.id, door,
    inside: { x: r.x, z: r.z },
  });
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Can the player restore this ruin? Returns why not, or null. */
export function whyNotRestore(col: Colony, r: Ruin): string | null {
  const def = RESTORE[r.kind];
  if (!def) return 'There is nothing left of it worth saving.';
  if (r.restored) return 'Already restored.';
  if (r.razed || (col.village.razes ?? []).some((z) => z.ruin === r.id)) return 'It is coming down for salvage.';
  if (col.village.projects.some((p) => !p.done && p.kind === 'restore' && p.ruin === r.id)) return 'Already being restored.';
  const h = col.haunts.find((x) => x.district === r.district);
  if (h && h.state !== 'cleared') return 'Something still lives there. Clear the district first.';
  if (h?.owner === 'folk') return 'That district was given to the Folk.';
  if (!reachableRuin(col.world, r)) return 'Nobody can find a way to its door.';
  return null;
}

/** The player chooses a ruin to restore. */
export function requestRestore(col: Colony, ruinId: number): Project | string {
  const v = col.village, w = col.world;
  const r = w.ruins[ruinId];
  if (!r) return 'Nothing there.';
  const why = whyNotRestore(col, r);
  if (why) return why;
  const h = col.haunts.find((x) => x.district === r.district);
  if (h && !h.owner) h.owner = 'village';
  const def = RESTORE[r.kind]!;
  const door = ruinDoor(w, r);
  const p: Project = {
    id: v.nextId++, kind: 'restore', tier: 0, name: cap(def.name(r)), foot: { tx: toTileX(w, door.x), tz: toTileZ(w, door.z), w: 1, d: 1 }, facing: 0,
    cost: { ...def.cost }, delivered: { wood: 0, scrap: 0, glimmer: 0, glass: 0, copper: 0, steel: 0 }, incoming: { wood: 0, scrap: 0, glimmer: 0, glass: 0, copper: 0, steel: 0 },
    work: 0, workNeeded: def.work, target: 0, clearTrees: [], done: false, ruin: r.id, door, inside: { x: r.x, z: r.z },
  };
  v.projects.push(p);
  log(col.community, `They'll make ${r.name} good again: ${def.name(r)}.`, 'good');
  return p;
}
