/**
 * The village: buildings, construction projects, and the planner that decides
 * what the community builds next and where. Survivors make these choices;
 * the player only shapes the home zone.
 */
import { alive, log, type Community } from './community';
import type { Site } from './sites';
import type { Rng } from './rng';
import { houseFloor, type Household, type Plot } from './homes';
import type { Fishery } from './fishing';
import {
  Ground, LANE_WEAR, PATH_WEAR, heightAt, idx, inBounds, inZone, isExplored, tileX, tileZ, toTileX, toTileZ,
  type Point, type World,
} from './world';

export type FisheryKind = 'jetty' | 'fishhut' | 'netshed' | 'boat';
export type BuildingKind = 'store' | 'annex' | 'hut' | 'home' | 'garden' | 'workshop' | 'kitchen' | 'lantern' | 'cellar' | 'shrine' | FisheryKind;
export type ProjectKind = 'clear_store' | 'patch_roof' | 'annex' | 'hut' | 'home' | 'garden' | 'workshop' | 'kitchen' | 'lantern' | 'cellar' | 'shrine' | 'upgrade' | FisheryKind;
export const FISHERY_KINDS: FisheryKind[] = ['jetty', 'fishhut', 'netshed', 'boat'];
export type Tier = 0 | 1;

export interface Cost { wood: number; scrap: number; glimmer: number }
export type Material = keyof Cost;

/** Tile-aligned footprint. */
export interface Footprint { tx: number; tz: number; w: number; d: number }

export interface Building {
  id: number;
  kind: BuildingKind;
  tier: Tier;
  foot: Footprint;
  /** Side the door faces: 0 +z, 1 +x, 2 -z, 3 -x. */
  facing: number;
  door: Point;
  inside: Point;
  beds: number;
  /** Store: 0 derelict, 1 cleared, 2 roof patched, 3 commons hall. */
  level: number;
  /** Garden: tended minutes today, and growth 0..1 (visual). */
  tended: number;
  growth: number;
  name: string;
  /** The found shelter: firewood per winter day, before and after its roof is patched. */
  heat?: [number, number];
  /** Homes: the plot it stands on, who lives there, and its heading. */
  plot?: number;
  household?: number;
  yaw?: number;
}

export interface Project {
  id: number;
  kind: ProjectKind;
  tier: Tier;
  name: string;
  foot: Footprint;
  facing: number;
  cost: Cost;
  delivered: Cost;
  incoming: Cost;
  work: number;
  workNeeded: number;
  /** Building this project modifies (clear/patch/upgrade), if any. */
  target: number;
  /** Tree ids that must be felled before building can start. */
  clearTrees: number[];
  done: boolean;
  /** Fishery projects: which fishery they belong to. */
  fishery?: number;
  /** Homes: plot, household, the tiles the house covers, and its door and heading. */
  plot?: number;
  household?: number;
  blockTiles?: number[];
  door?: Point;
  inside?: Point;
  yaw?: number;
}

export interface Village {
  /** What the council asked to build next, if anything. */
  priority?: SiteKind;
  buildings: Building[];
  projects: Project[];
  nextId: number;
  craftXp: number;
  /**
   * Provenance of salvage brought home: "material|source" → amount. The
   * player sees one scrap total; this says what it is and where it came from.
   */
  salvaged: Record<string, number>;
  tier: Tier;
  /** The starting site (same object as the world's). */
  site: Site;
  households: Household[];
  plots: Plot[];
  /** Tile index → plot id (0 = none). */
  plotAt: Int32Array;
  /** Households whose petition for a home the council approved. */
  homeQueue: number[];
  /** Fishing outposts on marked shores. */
  fisheries: Fishery[];
  /** Last day a household found no room for a plot, and the land it searched. */
  noPlotDay?: number;
  noPlotKey?: string;
  /** Set when bed assignments need redoing (e.g. the store became a hall). */
  bedsDirty?: boolean;
}

interface Def { name: [string, string]; w: number; d: number; cost: [Cost, Cost]; work: [number, number]; beds?: [number, number] }
const c = (wood: number, scrap: number, glimmer = 0): Cost => ({ wood, scrap, glimmer });

export const DEFS: Record<Exclude<ProjectKind, 'upgrade' | 'clear_store' | 'patch_roof' | 'home' | FisheryKind>, Def> = {
  annex:    { name: ['Lean-to', 'Lean-to'], w: 3, d: 5, cost: [c(18, 6), c(18, 6)], work: [600, 600], beds: [2, 2] },
  hut:      { name: ['Bunk shack', 'Bunkhouse'], w: 3, d: 3, cost: [c(14, 8), c(34, 2)], work: [600, 900], beds: [2, 3] },
  garden:   { name: ['Tire garden', 'Fenced garden'], w: 4, d: 3, cost: [c(6, 4), c(18, 0)], work: [300, 420] },
  workshop: { name: ['Scrap workbench', 'Timber workshop'], w: 3, d: 3, cost: [c(10, 6), c(30, 4)], work: [420, 660] },
  kitchen:  { name: ['Canopy kitchen', 'Canopy kitchen'], w: 4, d: 2, cost: [c(12, 6), c(12, 6)], work: [480, 480] },
  cellar:   { name: ['Root cellar', 'Stone-lined cellar'], w: 3, d: 3, cost: [c(10, 4), c(20, 0)], work: [360, 480] },
  shrine:   { name: ['Wayside shrine', 'Stone shrine'], w: 2, d: 2, cost: [c(8, 2, 8), c(14, 0, 8)], work: [300, 360] },
  lantern:  { name: ['Wisp lantern', 'Wisp lantern'], w: 1, d: 1, cost: [c(2, 2, 6), c(2, 2, 6)], work: [120, 120] },
};

export const GARDEN_YIELD: [number, number] = [2, 3]; // food per tended day: kitchen plots, not staples
export const TIER1_XP = 6;
export const TIER1_DAY = 8;
export const MAX_ACTIVE = 2;

const zero = (): Cost => c(0, 0, 0);

export function createVillage(w: World): Village {
  const v: Village = {
    buildings: [], projects: [], nextId: 1, craftXp: 0, salvaged: {}, tier: 0, site: w.site,
    households: [], plots: [], plotAt: new Int32Array(w.w * w.h), homeQueue: [], fisheries: [],
  };
  // The found shelter is there from the start: derelict, no beds yet.
  const S = w.site.shelter;
  const foot = footOfRect(w, S.x - S.w / 2, S.z - S.d / 2, S.w, S.d);
  v.buildings.push({
    id: v.nextId++, kind: 'store', tier: 0, foot, facing: 0, door: { ...w.site.door }, inside: { ...w.site.inside },
    beds: 0, level: 0, tended: 0, growth: 0, name: w.site.shelterName, heat: [...w.site.heat],
  });
  return v;
}

function footOfRect(w: World, x0: number, z0: number, wid: number, dep: number): Footprint {
  return { tx: toTileX(w, x0 + 0.01), tz: toTileZ(w, z0 + 0.01), w: Math.round(wid), d: Math.round(dep) };
}

export const store = (v: Village) => v.buildings.find((b) => b.kind === 'store')!;
/** Beds anyone could sleep in: shared beds, plus homes up to their household's size (and empty homes). */
export const bedsTotal = (v: Village) => v.buildings.reduce((n, b) => {
  if (b.kind !== 'home' || !b.household) return n + b.beds;
  const h = v.households.find((x) => x.id === b.household);
  return n + Math.min(b.beds, h ? h.members.length : b.beds);
}, 0);
/** Shared (non-home) beds. */
export const sharedBeds = (v: Village) => v.buildings.reduce((n, b) => n + (b.kind === 'home' ? 0 : b.beds), 0);
export const hasBuilt = (v: Village, k: BuildingKind) => v.buildings.some((b) => b.kind === k);
/**
 * Floor height for a footprint building: within 0.2 of the highest ground
 * under it, so nothing is buried uphill; a foundation fills in downhill.
 */
export function footFloor(w: World, f: Footprint): number {
  const c = footCenter(w, f);
  let hi = -Infinity;
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
    hi = Math.max(hi, heightAt(w, c.x + (i / 4 - 0.5) * f.w, c.z + (j / 4 - 0.5) * f.d));
  }
  return Math.max(heightAt(w, c.x, c.z), hi - 0.2);
}

export const footCenter = (w: World, f: Footprint): Point => ({ x: tileX(w, f.tx) - 0.5 + f.w / 2, z: tileZ(w, f.tz) - 0.5 + f.d / 2 });

/** Tiles of a footprint. */
export function* footTiles(f: Footprint) {
  for (let dz = 0; dz < f.d; dz++) for (let dx = 0; dx < f.w; dx++) yield [f.tx + dx, f.tz + dz] as const;
}

/** Door point just outside the middle of the facing side. */
export function doorOf(w: World, f: Footprint, facing: number): Point {
  const cen = footCenter(w, f);
  switch (facing) {
    case 0: return { x: cen.x, z: cen.z + f.d / 2 + 0.6 };
    case 1: return { x: cen.x + f.w / 2 + 0.6, z: cen.z };
    case 2: return { x: cen.x, z: cen.z - f.d / 2 - 0.6 };
    default: return { x: cen.x - f.w / 2 - 0.6, z: cen.z };
  }
}

// ---------- site selection ----------

function footprintFree(w: World, v: Village, f: Footprint, margin: number): { ok: boolean; trees: number[] } {
  const trees: number[] = [];
  for (let dz = -margin; dz < f.d + margin; dz++) for (let dx = -margin; dx < f.w + margin; dx++) {
    const tx = f.tx + dx, tz = f.tz + dz;
    const inner = dx >= 0 && dz >= 0 && dx < f.w && dz < f.d;
    if (!inBounds(w, tx, tz)) return { ok: false, trees };
    const i = idx(w, tx, tz);
    if (inner) {
      if (!inZone(w, tx, tz) || !isExplored(w, tx, tz)) return { ok: false, trees };
      const g = w.ground[i];
      if (g === Ground.Water || g === Ground.Asphalt || g === Ground.Concrete) return { ok: false, trees };
      if (w.blocked[i] || w.bushAt[i] >= 0 || v.plotAt[i]) return { ok: false, trees };
      if (w.treeAt[i] >= 0) {
        if (w.trees[w.treeAt[i]].protected) return { ok: false, trees };
        trees.push(w.treeAt[i]);
      }
    } else if (w.blocked[i]) {
      return { ok: false, trees }; // keep a walkway around buildings
    } else if (w.treeAt[i] >= 0 && !w.trees[w.treeAt[i]].protected && Math.max(-dx - 1, dx - f.w, -dz - 1, dz - f.d) < 1) {
      trees.push(w.treeAt[i]); // clear a tree standing right against the walls
    }
  }
  // Too steep for a sensible foundation.
  const c = footCenter(w, f);
  let lowest = Infinity;
  for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) lowest = Math.min(lowest, heightAt(w, c.x + (i / 2 - 0.5) * f.w, c.z + (j / 2 - 0.5) * f.d));
  if (footFloor(w, f) - lowest > 1.2) return { ok: false, trees };
  const x0 = tileX(w, f.tx) - 0.5, z0 = tileZ(w, f.tz) - 0.5;
  const pad = margin + 0.5;
  // Stay clear of other buildings and projects.
  for (const o of [...v.buildings.map((b) => b.foot), ...v.projects.filter((p) => !p.done).map((p) => p.foot)]) {
    if (f.tx < o.tx + o.w + margin && f.tx + f.w + margin > o.tx && f.tz < o.tz + o.d + margin && f.tz + f.d + margin > o.tz) {
      return { ok: false, trees };
    }
  }
  // Keep the fire circle, bedrolls and stockpile open.
  const cx = x0 + f.w / 2, cz = z0 + f.d / 2;
  if (Math.hypot(cx - w.campfire.x, cz - w.campfire.z) < 5.5 + Math.max(f.w, f.d) / 2) return { ok: false, trees };
  const sp = w.stockpile;
  if (x0 < sp.x1 + pad && x0 + f.w > sp.x0 - pad && z0 < sp.z1 + pad && z0 + f.d > sp.z0 - pad) return { ok: false, trees };
  return { ok: true, trees };
}

/** Footfall along each side of a footprint, just outside it: [+z, +x, -z, -x]. */
function sideWear(w: World, f: Footprint): number[] {
  const at = (tx: number, tz: number) => (inBounds(w, tx, tz) ? w.wear[idx(w, tx, tz)] : 0);
  const out = [0, 0, 0, 0];
  for (let dx = 0; dx < f.w; dx++) { out[0] += at(f.tx + dx, f.tz + f.d); out[2] += at(f.tx + dx, f.tz - 1); }
  for (let dz = 0; dz < f.d; dz++) { out[1] += at(f.tx + f.w, f.tz + dz); out[3] += at(f.tx - 1, f.tz + dz); }
  return out;
}

/** Firewood a building burns per winter day when people sleep in it. */
export function heatNeed(b: Building): number {
  switch (b.kind) {
    case 'store': return b.heat ? b.heat[b.level >= 2 ? 1 : 0] : b.level >= 2 ? 2 : 3;
    case 'annex': return 1;
    case 'hut': return b.tier === 0 ? 2 : 1;
    case 'home': return b.tier === 0 ? 2 : 1;
    default: return 0;
  }
}

/** Food that keeps; anything above this slowly spoils. */
export function storageCapacity(v: Village): number {
  // Cellars keep roots and grain; the fishing hut's racks keep smoked fish.
  return 40 + v.buildings.filter((b) => b.kind === 'cellar').reduce((n, b) => n + (b.tier === 0 ? 100 : 160), 0)
    + v.buildings.filter((b) => b.kind === 'fishhut').length * 50;
}

export type SiteKind = 'hut' | 'garden' | 'workshop' | 'lantern' | 'cellar' | 'shrine';

/** Score candidate sites around the fire and return the best one. */
export function findSite(w: World, v: Village, kind: SiteKind, rng: Rng): { foot: Footprint; facing: number; trees: number[] } | null {
  const def = DEFS[kind];
  const CAMP = w.campfire;
  const cxT = toTileX(w, CAMP.x), czT = toTileZ(w, CAMP.z);
  let best: { foot: Footprint; facing: number; trees: number[] } | null = null;
  let bestScore = Infinity;
  const R = 26;
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    // Rotate footprints so the long side can face either way.
    for (const swap of def.w === def.d ? [false] : [false, true]) {
      const fw = swap ? def.d : def.w, fd = swap ? def.w : def.d;
      const foot = { tx: cxT + dx, tz: czT + dz, w: fw, d: fd };
      const cen = footCenter(w, foot);
      const dist = Math.hypot(cen.x - CAMP.x, cen.z - CAMP.z);
      const ideal = kind === 'lantern' ? 7 : kind === 'garden' ? 13 : kind === 'workshop' || kind === 'cellar' ? 10 : kind === 'shrine' ? 14 : 9;
      let score = Math.abs(dist - ideal) * 1.2;
      if (score - 7 > bestScore) continue; // 7 = the most frontage can win back
      const free = footprintFree(w, v, foot, kind === 'lantern' ? 0 : 1);
      if (!free.ok) continue;
      score += free.trees.length * 2.5;
      // Don't build over the lanes people walk; do build facing them.
      const side = sideWear(w, foot);
      let onLane = 0;
      for (const [tx, tz] of footTiles(foot)) if (w.wear[idx(w, tx, tz)] >= LANE_WEAR) onLane++;
      score += onLane * 3;
      const bestSide = side.indexOf(Math.max(...side));
      const frontage = kind === 'lantern' ? 0 : Math.min(7, side[bestSide] / (PATH_WEAR * 1.5));
      if (kind === 'garden') {
        let meadow = 0;
        for (const [tx, tz] of footTiles(foot)) if (w.ground[idx(w, tx, tz)] === Ground.Meadow) meadow++;
        score -= meadow * 0.4;
      }
      if (kind === 'shrine') score += Math.hypot(cen.x - w.fairyRing.x, cen.z - w.fairyRing.z) * 0.35; // toward the Ring
      if (kind === 'workshop') {
        const sp = w.stockpile;
        score += Math.hypot(cen.x - (sp.x0 + sp.x1) / 2, cen.z - (sp.z0 + sp.z1) / 2) * 0.3;
      }
      // Neighbourliness: like to sit near other buildings, not on top of them.
      for (const b of v.buildings) {
        const bc = footCenter(w, b.foot);
        const d = Math.hypot(bc.x - cen.x, bc.z - cen.z);
        if (d < 12) score -= 0.4;
      }
      score -= frontage;
      score += rng.next() * 1.5; // a little personality
      if (score < bestScore) {
        // Door faces the busiest path alongside, else the fire.
        const ax = CAMP.x - cen.x, az = CAMP.z - cen.z;
        const facing = frontage >= 1 ? bestSide : Math.abs(ax) > Math.abs(az) ? (ax > 0 ? 1 : 3) : (az > 0 ? 0 : 2);
        bestScore = score;
        best = { foot, facing, trees: free.trees };
      }
    }
  }
  return best;
}

// ---------- projects ----------

function newProject(v: Village, p: Omit<Project, 'id' | 'delivered' | 'incoming' | 'work' | 'done'>): Project {
  const proj: Project = { ...p, id: v.nextId++, delivered: zero(), incoming: zero(), work: 0, done: false };
  v.projects.push(proj);
  return proj;
}

export function materialsReady(p: Project) {
  return p.delivered.wood >= p.cost.wood && p.delivered.scrap >= p.cost.scrap && p.delivered.glimmer >= p.cost.glimmer;
}

export function outstanding(p: Project, m: Material) {
  return Math.max(0, p.cost[m] - p.delivered[m] - p.incoming[m]);
}

const activeProjects = (v: Village) => v.projects.filter((p) => !p.done);

/**
 * Decide what the community wants next. Called each morning and whenever a
 * project finishes. Returns the project started, if any.
 */
export function plan(w: World, v: Village, com: Community, rng: Rng, lead: string, seasonIdx = 0): Project | null {
  const active = activeProjects(v);
  if (active.length >= MAX_ACTIVE) return null;
  const pop = alive(com).length;
  const beds = bedsTotal(v) + active.reduce((n, p) => n + projectBeds(p, v), 0);
  const st = store(v);
  const has = (k: ProjectKind) => active.some((p) => p.kind === k);
  const traits = new Set(alive(com).flatMap((s) => s.traits));
  const wants: (() => Project | null)[] = [];

  if (st.level === 0 && !has('clear_store')) {
    wants.push(() => newProject(v, {
      kind: 'clear_store', tier: 0, name: v.site.clear.name, foot: st.foot, facing: 0,
      cost: zero(), workNeeded: 480, target: st.id, clearTrees: [],
    }));
  }
  const shelter = () => {
    if (st.level === 1 && !has('patch_roof')) {
      return newProject(v, {
        kind: 'patch_roof', tier: 0, name: v.site.patch.name, foot: st.foot, facing: 0,
        cost: c(v.site.patch.wood, v.site.patch.scrap), workNeeded: 360, target: st.id, clearTrees: [],
      });
    }
    if (st.level >= 2 && !hasBuilt(v, 'annex') && !has('annex')) {
      const A = v.site.annex;
      const foot = footOfRect(w, A.x0, A.z0, A.w, A.d);
      const def = DEFS.annex;
      return newProject(v, {
        kind: 'annex', tier: 0, name: def.name[0], foot, facing: 0,
        cost: { ...def.cost[0] }, workNeeded: def.work[0], target: 0, clearTrees: [],
      });
    }
    // Households get homes of their own (see homes.ts); a bunk shack is for
    // when nobody has paired up yet and people are sleeping out.
    const waiting = v.households.some((h) => !h.home);
    const noRoom = v.noPlotDay !== undefined && com.day - v.noPlotDay <= 1;
    if (st.level >= 1 && !has('hut') && (!waiting || (noRoom && beds < pop))) return site('hut');
    return null;
  };
  const site = (kind: SiteKind): Project | null => {
    const s = findSite(w, v, kind, rng);
    if (!s) return null;
    const def = DEFS[kind];
    const tier = kind === 'lantern' ? 0 : v.tier;
    const p = newProject(v, {
      kind, tier, name: def.name[tier], foot: s.foot, facing: s.facing,
      cost: { ...def.cost[tier] }, workNeeded: def.work[tier], target: 0, clearTrees: s.trees,
    });
    const dir = ['south', 'east', 'north', 'west'][s.facing];
    const cen = footCenter(w, s.foot);
    const CAMP = w.campfire;
    const where = Math.abs(cen.x - CAMP.x) > Math.abs(cen.z - CAMP.z)
      ? (cen.x > CAMP.x ? 'east' : 'west') : (cen.z > CAMP.z ? 'south' : 'north');
    log(com, `${lead} scratched a plan in the dirt: ${def.name[tier].toLowerCase()} ${where} of the fire, door to the ${dir}.`, 'good');
    return p;
  };

  if (beds < pop) wants.push(shelter);
  const kitchen = () => (!hasBuilt(v, 'kitchen') && !has('kitchen') && st.level >= 1
    ? newProject(v, {
      kind: 'kitchen', tier: 0, name: DEFS.kitchen.name[0],
      foot: footOfRect(w, v.site.kitchen.x - 2, v.site.kitchen.z - 1, 4, 2), facing: 0,
      cost: { ...DEFS.kitchen.cost[0] }, workNeeded: DEFS.kitchen.work[0], target: 0, clearTrees: [],
    }) : null);
  const garden = () => (!hasBuilt(v, 'garden') && !has('garden') ? site('garden') : null);
  const cellar = () => (!hasBuilt(v, 'cellar') && !has('cellar') ? site('cellar') : null);
  // With winter coming, a cellar jumps the queue.
  if (seasonIdx >= 1 && seasonIdx <= 2) wants.push(cellar);
  // Stores filling up before winter: dig another cellar.
  const cellars = v.buildings.filter((b) => b.kind === 'cellar').length;
  if (seasonIdx >= 1 && seasonIdx <= 2 && cellars > 0 && cellars < 3 && com.resources.food > storageCapacity(v) * 0.85 && !has('cellar')) {
    wants.push(() => site('cellar'));
  }
  const workshop = () => (!hasBuilt(v, 'workshop') && !has('workshop') ? site('workshop') : null);
  // Personalities reorder priorities.
  const mid = [kitchen, garden, workshop, cellar];
  if (traits.has('green_thumb')) mid.unshift(garden);
  if (traits.has('tinkerer')) mid.unshift(workshop);
  wants.push(...mid);
  if (beds < pop + 2) wants.push(shelter); // a little room for newcomers
  if (v.tier === 1 && !has('upgrade')) {
    wants.push(() => {
      const old = v.buildings.find((b) => b.tier === 0 && (b.kind === 'garden' || b.kind === 'workshop' || b.kind === 'cellar' || b.kind === 'shrine'));
      if (!old) return null;
      const def = DEFS[old.kind as 'hut' | 'garden' | 'workshop' | 'cellar' | 'shrine'];
      log(com, `${lead} wants to rebuild ${old.name.toLowerCase()} properly, in timber.`, 'good');
      return newProject(v, {
        kind: 'upgrade', tier: 1, name: `Rebuild as ${def.name[1].toLowerCase()}`, foot: old.foot, facing: old.facing,
        cost: { ...def.cost[1] }, workNeeded: def.work[1], target: old.id, clearTrees: [],
      });
    });
  }
  const lanterns = v.buildings.filter((b) => b.kind === 'lantern').length;
  if (com.resources.glimmer >= 8 && lanterns < Math.min(3, Math.floor(com.day / 8)) && !has('lantern')) {
    wants.push(() => site('lantern'));
  }
  if (v.buildings.filter((b) => b.kind === 'garden').length < Math.min(2, Math.ceil(pop / 6)) && !has('garden')) {
    wants.push(() => site('garden'));
  }

  // The council's wish goes first.
  if (v.priority && !has(v.priority)) {
    const kind = v.priority;
    wants.unshift(() => {
      const p = site(kind);
      if (p) v.priority = undefined;
      return p;
    });
  }
  for (const want of wants) {
    const p = want();
    if (p) return p;
  }
  return null;
}

function projectBeds(p: Project, v: Village): number {
  if (p.kind === 'clear_store') return v.site.clear.beds;
  if (p.kind === 'patch_roof') return v.site.patch.beds - v.site.clear.beds;
  if (p.kind === 'annex') return DEFS.annex.beds![0];
  if (p.kind === 'hut') return DEFS.hut.beds![p.tier];
  if (p.kind === 'home') return v.households.find((h) => h.id === p.household)?.members.length ?? 0;
  if (p.kind === 'upgrade') {
    const b = v.buildings.find((x) => x.id === p.target);
    return b?.kind === 'hut' ? DEFS.hut.beds![1] - DEFS.hut.beds![0] : 0;
  }
  return 0;
}

/** Apply a finished project to the village and the world. */
export function completeProject(w: World, v: Village, com: Community, p: Project) {
  p.done = true;
  v.craftXp++;
  const res = com.resources;
  const block = (f: Footprint) => {
    // Blocked to walkers; anyone inside stands on the (possibly raised) floor.
    const y = footFloor(w, f);
    for (const [tx, tz] of footTiles(f)) { const i = idx(w, tx, tz); w.blocked[i] = 1; w.deck[i] = 1; w.deckY[i] = y; }
  };
  switch (p.kind) {
    case 'clear_store': {
      const st = store(v);
      const cl = v.site.clear;
      st.level = 1; st.beds = cl.beds;
      res.scrap += cl.gives.scrap ?? 0;
      res.glimmer += cl.gives.glimmer ?? 0;
      res.food += cl.gives.food ?? 0;
      log(com, cl.done, 'good');
      break;
    }
    case 'patch_roof': {
      const st = store(v);
      st.level = 2; st.beds = v.site.patch.beds;
      log(com, v.site.patch.done, 'good');
      break;
    }
    case 'upgrade': {
      const b = v.buildings.find((x) => x.id === p.target);
      if (b) {
        b.tier = 1;
        const def = DEFS[b.kind as 'hut' | 'garden' | 'workshop' | 'cellar' | 'shrine'];
        b.name = def.name[1];
        if (def.beds) b.beds = def.beds[1];
        log(com, `The ${def.name[0].toLowerCase()} is gone; a ${def.name[1].toLowerCase()} stands in its place.`, 'good');
      }
      break;
    }
    case 'home': {
      const b: Building = {
        id: v.nextId++, kind: 'home', tier: p.tier, foot: p.foot, facing: 0, door: { ...p.door! }, inside: { ...p.inside! },
        beds: 0, level: 0, tended: 0, growth: 1, name: p.name, plot: p.plot, household: p.household, yaw: p.yaw,
      };
      const plot = v.plots.find((x) => x.id === p.plot);
      b.beds = plot ? plot.house.beds : 2;
      v.buildings.push(b);
      // Indoors, people stand on the floor, which on a slope may be well above the ground.
      const floor = plot ? houseFloor(w, plot) + 0.24 : 0;
      for (const i of p.blockTiles ?? []) { w.blocked[i] = 1; if (plot) { w.deck[i] = 1; w.deckY[i] = floor; } }
      log(com, `${p.name} is finished.`, 'good');
      break;
    }
    case 'jetty': case 'fishhut': case 'netshed': case 'boat': {
      const b: Building = {
        id: v.nextId++, kind: p.kind, tier: p.tier, foot: p.foot, facing: p.facing, door: doorOf(w, p.foot, p.facing),
        inside: footCenter(w, p.foot), beds: 0, level: 0, tended: 0, growth: 0, name: p.name,
      };
      v.buildings.push(b);
      if (p.kind === 'fishhut' || p.kind === 'netshed') block(p.foot);
      log(com, `${p.name} finished.`, 'good');
      break;
    }
    default: {
      const kind = p.kind as Exclude<BuildingKind, 'store' | 'home' | FisheryKind>;
      const def = DEFS[kind];
      const cen = footCenter(w, p.foot);
      const b: Building = {
        id: v.nextId++, kind, tier: p.tier, foot: p.foot, facing: p.facing,
        door: kind === 'kitchen' ? { ...v.site.kitchen } : doorOf(w, p.foot, p.facing),
        inside: cen, beds: def.beds ? def.beds[p.tier] : 0, level: 0, tended: 0, growth: 0.1, name: def.name[p.tier],
      };
      v.buildings.push(b);
      if (kind !== 'kitchen' && kind !== 'garden') block(p.foot);
      log(com, `${def.name[p.tier]} finished.`, 'good');
    }
  }
}

/** Timber comes with practice: enough finished projects, a workshop, and time. */
export function checkTier(v: Village, com: Community) {
  if (v.tier === 0 && v.craftXp >= TIER1_XP && hasBuilt(v, 'workshop') && com.day >= TIER1_DAY) {
    v.tier = 1;
    log(com, 'After weeks of practice at the workbench, they can square timber now. New buildings will be sturdier, and the old shacks will be rebuilt.', 'good');
  }
}

/**
 * Bed assignments. Households sleep at home; everyone else takes the shared
 * beds (and any empty home), by survivor id. Returns survivor id → building id.
 */
export function assignBeds(v: Village, ids: number[]): Map<number, number> {
  const out = new Map<number, number>();
  const living = new Set(ids);
  for (const h of v.households) {
    const b = h.home ? v.buildings.find((x) => x.id === h.home) : undefined;
    if (!b) continue;
    let n = 0;
    for (const m of h.members) if (living.has(m) && n < b.beds) { out.set(m, b.id); n++; }
  }
  const slots: number[] = [];
  for (const b of v.buildings) {
    if (b.kind === 'home' && b.household) continue;
    for (let i = 0; i < b.beds; i++) slots.push(b.id);
  }
  let k = 0;
  for (const id of [...ids].sort((a, b) => a - b)) {
    if (out.has(id)) continue;
    if (k < slots.length) out.set(id, slots[k++]);
  }
  return out;
}

export const MATERIALS: Material[] = ['wood', 'scrap', 'glimmer'];
