/**
 * The Folk's settlement (DESIGN §25.3; replaces the chambers of §24.9). The
 * Great Hill holds the hearth-hall, where the Gentry sit and the hill decides.
 * Each time the hill grows, a knowe is raised around it: a smaller hill,
 * about the old mound's size, and in it a two-storey dwelling (one floor at
 * the hill's crown, one below) for a household of the Folk. The hills are
 * real ground; what stands on and in them is of the Veil, seen only with
 * Sight after dark, or in the Veil view (render/townhouse.ts).
 *
 * Every knowe houses a household, and each has a character that does
 * something small and real (what the old chambers did): a dew-knowe keeps
 * dew, the pipers' knowe makes song, the archive-knowe keeps the names of
 * the village's dead, the nursery quickens the hill's growth, the
 * guest-knowe sends a hob down to the village one night more.
 */
import { alive } from './community';
import type { Colony } from './colony';
import type { FolkSociety } from './folk';
import { raiseHill } from './folk';
import { CELL, reachKnowe } from './mycelium';
import { HAUNT_RADIUS } from './haunt';
import { Ground, Zone, idx, inBounds, reveal, toTileX, toTileZ, type World } from './world';

export type KnoweKind = 'dwelling' | 'dewcellar' | 'gallery' | 'archive' | 'nursery' | 'guestroom';

export interface Knowe {
  id: number;
  kind: KnoweKind;
  name: string;
  x: number; z: number;
  /** Radius of its hill. */
  r: number;
  /** The Great Hill's growth it was raised at. */
  level: number;
}

/** A knowe's hill: about the old mound's size. */
export const KNOWE_R = 3.4;
/** How many of the Folk the hall under the Great Hill houses, and each knowe. */
export const HALL_HOUSES = 6;
export const KNOWE_HOUSES = 5;

export const KNOWES: Record<KnoweKind, { name: string; blurb: string; topside: string }> = {
  dwelling: { name: 'Dwelling-knowe', blurb: `A household of the Folk: a hall at the crown and a sleeping floor below. Room for ${KNOWE_HOUSES} (counts toward Rest).`, topside: 'a round lodge of light on its crown, a door-glow facing the Great Hill' },
  dewcellar: { name: 'Dew-knowe', blurb: 'Its lower floor keeps the night\'s dew cool. Two more dew each night, and room to store more.', topside: 'a lodge with a well beside it, and a bowl of dew that shines' },
  gallery: { name: 'Pipers\' knowe', blurb: 'The pipers live here and practise in the long room below. Two more song each night.', topside: 'a lodge with tall reed pipes that hum in the wind' },
  archive: { name: 'Root-archive', blurb: 'Their memory, written in roots: the names of the village\'s dead are kept here too. Grief in the village eases sooner.', topside: 'a lodge under a tree hung with small lanterns, one for each name' },
  nursery: { name: 'Nursery-knowe', blurb: 'Where the young of the hill are sung to. The hill grows faster.', topside: 'a lodge with a cradle of light swinging in the branches' },
  guestroom: { name: 'Guest-knowe', blurb: 'A door the size of a person, left open. Their hobs come down one night more to help the village.', topside: 'a lodge with its door open, lit from inside' },
};

const NAMES = ['Bramble', 'Hazel', 'Rowan', 'Thimble', 'Sorrel', 'Yarrow', 'Elder', 'Foxglove', 'Rush', 'Harebell', 'Sloe', 'Mallow', 'Tansy', 'Vetch'];

export const knowes = (f: FolkSociety): Knowe[] => f.knowes ?? [];
export const knoweCount = (f: FolkSociety, kind: KnoweKind) => knowes(f).filter((k) => k.kind === kind).length;
/** How many of the Folk the settlement can house. */
export const housing = (f: FolkSociety) => HALL_HOUSES + knowes(f).length * KNOWE_HOUSES;

/** What the hill lacks most: the next knowe's character. */
export function nextKnowe(col: Colony): KnoweKind {
  const f = col.folk;
  const has = (k: KnoweKind) => knoweCount(f, k) > 0;
  if (housing(f) < f.beings.length + 2) return 'dwelling';
  if (!has('dewcellar') && f.dew < 12) return 'dewcellar';
  if (!has('gallery') && f.song < 12) return 'gallery';
  if (!has('archive') && col.community.survivors.some((s) => !s.alive && !s.departed && !s.taken)) return 'archive';
  if (!has('nursery') && f.level >= 3) return 'nursery';
  if (!has('guestroom') && f.standing >= 70) return 'guestroom';
  if (!has('dewcellar')) return 'dewcellar';
  if (!has('gallery')) return 'gallery';
  return 'dwelling';
}

/**
 * Where a knowe could stand: around the Great Hill, on open ground that is
 * the Folk's or nobody's (not the village's zones, plots or paving), clear of
 * their paths, their works, the Ring and the other knowes. Fewest trees, and
 * nearest the hill, first. The same world gives the same place.
 */
export function knoweSite(col: Colony, r = KNOWE_R): { x: number; z: number } | null {
  const w = col.world, f = col.folk, m = w.folk.mound;
  let best: { x: number; z: number; score: number } | null = null;
  const n = knowes(f).length;
  for (let ring = 0; ring < 10; ring++) {
    const d = m.r + r + 1.6 + ring * 2.2;
    for (let k = 0; k < 36; k++) {
      const a = m.door + Math.PI + (k / 36) * Math.PI * 2 + n * 0.37;
      const x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d;
      const trees = siteTrees(col, x, z, r);
      if (trees < 0) continue;
      const score = trees * 3 + ring * 1.5 + Math.abs(Math.sin((k + n) * 1.7)) * 0.5;
      if (!best || score < best.score) best = { x, z, score };
    }
    if (best && best.score < ring * 1.5 + 3) break;
  }
  return best ? { x: best.x, z: best.z } : null;
}

/** Trees on a site, or −1 if the site won't do. */
function siteTrees(col: Colony, x: number, z: number, r: number): number {
  const why = siteWhy(col, x, z, r);
  return typeof why === 'number' ? why : -1;
}

/** Why a knowe can't stand here (a reason), or how many trees it would take in. */
function siteWhy(col: Colony, x: number, z: number, r: number): number | string {
  const w = col.world, f = col.folk, v = col.village, m = w.folk.mound;
  const d0 = Math.hypot(x - m.x, z - m.z);
  if (d0 < m.r + r + 1) return 'Too close to the Great Hill.';
  if (d0 > m.r + r + 24) return 'Too far from the Great Hill: the knowes stand round it.';
  if (Math.hypot(x - w.fairyRing.x, z - w.fairyRing.z) < r + 5) return 'Too close to the Ring.';
  if (knowes(f).some((k) => Math.hypot(k.x - x, k.z - z) < k.r + r + 1)) return 'Too close to another knowe.';
  if (f.works.some((k) => Math.hypot(k.x - x, k.z - z) < r + 1)) return 'One of their works stands there.';
  if (v.buildings.some((b) => Math.hypot(b.inside.x - x, b.inside.z - z) < r + 4)) return 'Too close to the village\'s buildings.';
  // Not among the old world's ruins, nor in a district that is still haunted.
  if (w.ruins.some((q) => !q.razed && Math.hypot(q.x - x, q.z - z) < r + 2 + Math.max(q.w, q.d) / 2)) return 'Ruins of the old world stand there.';
  if (col.haunts.some((h) => h.state !== 'cleared' && Math.hypot(w.districts[h.district].x - x, w.districts[h.district].z - z) < HAUNT_RADIUS + r)) return 'Too near a haunted district.';
  // (Its ruins are dead ground to the mycelium some way out: keep the knowe's roots clear of them.)
  const haunted = new Set(col.haunts.filter((h) => h.state !== 'cleared').map((h) => h.district));
  if (w.ruins.some((q) => haunted.has(q.district) && Math.hypot(q.x - x, q.z - z) < r + 3 + CELL * 1.5 + Math.max(q.w, q.d) / 2)) return 'Too near a haunted district.';
  let trees = 0;
  const R = Math.ceil(r + 1);
  const cx = toTileX(w, x), cz = toTileZ(w, z);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const tx = cx + dx, tz = cz + dz;
    const d = Math.hypot(tx - w.w / 2 + 0.5 - x, tz - w.h / 2 + 0.5 - z);
    if (d > r + 0.8) continue;
    if (!inBounds(w, tx, tz)) return 'Off the edge of the map.';
    const i = idx(w, tx, tz), g = w.ground[i];
    if (g === Ground.Water) return 'Not on water.';
    if (g === Ground.Asphalt || g === Ground.Concrete) return 'Not on paving.';
    if (w.folk.path[i]) return 'Not across their paths.';
    if (v.plotAt[i]) return 'Not on a household\'s plot.';
    if (w.zone[i] !== Zone.Wild && w.zone[i] !== Zone.None) return 'Not on the village\'s zones: the Wild, or open land.';
    if (w.blocked[i] && w.treeAt[i] < 0) return 'Something is in the way.';
    if (w.treeAt[i] >= 0) trees++;
  }
  return trees;
}

/** Can a knowe be raised here? A reason if not (the player's placement, DESIGN §25.6). */
export function whyNotKnowe(col: Colony, x: number, z: number): string | null {
  const why = siteWhy(col, x, z, KNOWE_R);
  return typeof why === 'string' ? why : null;
}

/**
 * The hill has grown: raise a knowe for what it lacks. The ground swells; any
 * trees on it are taken into the hill; the land round it becomes the Wild.
 * Returns the knowe, or null if there is nowhere left to raise one.
 */
export function raiseKnowe(col: Colony, kind: KnoweKind = nextKnowe(col), where?: { x: number; z: number }): Knowe | null {
  const w = col.world, f = col.folk;
  const at = where ?? knoweSite(col);
  if (!at) return null;
  const used = new Set(knowes(f).map((k) => k.name));
  const base = NAMES.find((nm) => !used.has(`${nm} Knowe`)) ?? `${NAMES[knowes(f).length % NAMES.length]} the Second`;
  const k: Knowe = { id: (f.nextKnowe = (f.nextKnowe ?? 0) + 1), kind, name: `${base} Knowe`, x: at.x, z: at.z, r: KNOWE_R, level: f.level };
  swallowTrees(col, k.x, k.z, k.r + 0.6);
  raiseHill(w, k.x, k.z, k.r, 1.8);
  // Their land round it.
  const R = Math.ceil(k.r + 3);
  const cx = toTileX(w, k.x), cz = toTileZ(w, k.z);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const tx = cx + dx, tz = cz + dz;
    if (!inBounds(w, tx, tz)) continue;
    const i = idx(w, tx, tz), g = w.ground[i];
    if (g === Ground.Water || g === Ground.Asphalt || g === Ground.Concrete || w.zone[i] !== Zone.None) continue;
    if (Math.hypot(tx - w.w / 2 + 0.5 - k.x, tz - w.h / 2 + 0.5 - k.z) <= k.r + 3) w.zone[i] = Zone.Wild;
  }
  w.zoneVersion++;
  // A new hill is hard to miss.
  reveal(w, k.x, k.z, k.r + 3);
  (f.knowes ??= []).push(k);
  // The mycelium runs out to it at once: a trunk from the Great Hill (DESIGN §25.6).
  reachKnowe(col, k.x, k.z);
  f.version++;
  return k;
}

/** Trees where a hill rises are taken into it. */
function swallowTrees(col: Colony, x: number, z: number, r: number) {
  const w = col.world;
  const R = Math.ceil(r);
  const cx = toTileX(w, x), cz = toTileZ(w, z);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const tx = cx + dx, tz = cz + dz;
    if (!inBounds(w, tx, tz)) continue;
    const i = idx(w, tx, tz), id = w.treeAt[i];
    if (id < 0 || Math.hypot(tx - w.w / 2 + 0.5 - x, tz - w.h / 2 + 0.5 - z) > r) continue;
    const t = w.trees[id];
    t.felled = true;
    w.treeAt[i] = -1;
    w.blocked[i] = 0;
    col.events.push({ type: 'swallowed', tree: id });
  }
}

/** Where one of the Folk lives: a knowe, or the hall under the Great Hill (0). */
export function homeOf(f: FolkSociety, w: World, home: number | undefined): { x: number; z: number } {
  const k = home ? knowes(f).find((x) => x.id === home) : undefined;
  return k ? { x: k.x, z: k.z } : { x: w.folk.mound.x, z: w.folk.mound.z };
}

/** Give everyone without a home one: the Gentry in the hall first, then the knowes with room. */
export function settleFolk(f: FolkSociety) {
  const count = new Map<number, number>();
  for (const b of f.beings) if (b.home !== undefined) count.set(b.home, (count.get(b.home) ?? 0) + 1);
  for (const b of f.beings) {
    if (b.home !== undefined && (b.home === 0 || knowes(f).some((k) => k.id === b.home))) continue;
    const gentry = b.kind === 'elder' || b.kind === 'piper';
    const hallRoom = (count.get(0) ?? 0) < HALL_HOUSES;
    const k = knowes(f).find((x) => (count.get(x.id) ?? 0) < KNOWE_HOUSES && (x.kind === 'gallery') === (b.kind === 'piper'))
      ?? knowes(f).find((x) => (count.get(x.id) ?? 0) < KNOWE_HOUSES);
    b.home = gentry && hallRoom ? 0 : k ? k.id : 0;
    count.set(b.home, (count.get(b.home) ?? 0) + 1);
  }
}

/** Daily: what the knowes do beyond dew, song and rest (those are read where they're used). */
export function townhouseDaily(col: Colony) {
  const f = col.folk;
  // The root-archive keeps the names of the dead: those grieving in the village mend a little sooner.
  if (knoweCount(f, 'archive') && f.standing >= 20 && col.community.day % 2 === 0) {
    for (const s of alive(col.community)) if (s.griefDays > 0) s.griefDays--;
  }
  settleFolk(f);
}

/**
 * An old save's chambers under the small mound (DESIGN §24.9) become knowes
 * round it, one for each chamber dug (the sleeping bowers become dwellings).
 */
export function knowesFromChambers(col: Colony, old: { kind: string }[]) {
  for (const c of old) {
    if (c.kind === 'hearth') continue;
    raiseKnowe(col, c.kind === 'bowers' ? 'dwelling' : c.kind as KnoweKind);
  }
}

// ---------- a new knowe waits for a place (DESIGN §25.6) ----------

/** Days the Folk wait for the village to choose before they choose for themselves. */
export const KNOWE_WAIT = 3;

/**
 * The hill has grown. In a player's game the village is asked where the new
 * knowe should rise (the tray); self-planning villages, and anyone who leaves
 * it, get the Folk's own choice.
 */
export function knoweDue(col: Colony, kind: KnoweKind = nextKnowe(col)): Knowe | null {
  const f = col.folk;
  if (col.village.autoPlan === false) {
    f.pendingKnowe = { kind, since: col.community.day };
    f.version++;
    return null;
  }
  return raiseKnowe(col, kind);
}

/** The player chose a place. Returns the knowe, or why not. */
export function placeKnowe(col: Colony, x: number, z: number): Knowe | string {
  const f = col.folk;
  const p = f.pendingKnowe;
  if (!p) return 'No knowe is waiting to be raised.';
  const why = whyNotKnowe(col, x, z);
  if (why) return why;
  const k = raiseKnowe(col, p.kind, { x, z });
  if (!k) return 'It won\'t rise there.';
  delete f.pendingKnowe;
  settleFolk(f);
  return k;
}

/** Left to them (or after KNOWE_WAIT days): the Folk choose. */
export function letFolkChoose(col: Colony): Knowe | null {
  const f = col.folk;
  const p = f.pendingKnowe;
  if (!p) return null;
  delete f.pendingKnowe;
  const k = raiseKnowe(col, p.kind);
  settleFolk(f);
  return k;
}

/**
 * A new village: the Folk were here first. The Great Hill already has two
 * knowes round it, a dwelling and a dew-knowe, with a Wee band living in them.
 */
export function foundSettlement(col: Colony, add: () => void) {
  raiseKnowe(col, 'dwelling');
  raiseKnowe(col, 'dewcellar');
  add();
  settleFolk(col.folk);
}
