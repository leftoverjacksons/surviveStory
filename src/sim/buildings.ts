/**
 * The village: buildings, construction projects, and the planner that decides
 * what the community builds next and where. Survivors make these choices;
 * the player only shapes the home zone.
 */
import { alive, log, type Community } from './community';
import { ANNEX, CAMP, KITCHEN, STORE, STORE_DOOR, STORE_INSIDE } from './layout';
import type { Rng } from './rng';
import {
  Ground, idx, inBounds, inZone, isExplored, tileX, tileZ, toTileX, toTileZ,
  type Point, type World,
} from './world';

export type BuildingKind = 'store' | 'annex' | 'hut' | 'garden' | 'workshop' | 'kitchen' | 'lantern';
export type ProjectKind = 'clear_store' | 'patch_roof' | 'annex' | 'hut' | 'garden' | 'workshop' | 'kitchen' | 'lantern' | 'upgrade';
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
  /** Store: 0 derelict, 1 cleared, 2 roof patched. */
  level: number;
  /** Garden: tended minutes today, and growth 0..1 (visual). */
  tended: number;
  growth: number;
  name: string;
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
}

export interface Village {
  buildings: Building[];
  projects: Project[];
  nextId: number;
  craftXp: number;
  tier: Tier;
}

interface Def { name: [string, string]; w: number; d: number; cost: [Cost, Cost]; work: [number, number]; beds?: [number, number] }
const c = (wood: number, scrap: number, glimmer = 0): Cost => ({ wood, scrap, glimmer });

export const DEFS: Record<Exclude<ProjectKind, 'upgrade' | 'clear_store' | 'patch_roof'>, Def> = {
  annex:    { name: ['Lean-to on the store', 'Lean-to on the store'], w: ANNEX.w, d: ANNEX.d, cost: [c(18, 6), c(18, 6)], work: [600, 600], beds: [2, 2] },
  hut:      { name: ['Scrap shack', 'Timber cabin'], w: 3, d: 3, cost: [c(14, 8), c(34, 2)], work: [600, 900], beds: [2, 3] },
  garden:   { name: ['Tire garden', 'Fenced garden'], w: 4, d: 3, cost: [c(6, 4), c(18, 0)], work: [300, 420] },
  workshop: { name: ['Scrap workbench', 'Timber workshop'], w: 3, d: 3, cost: [c(10, 6), c(30, 4)], work: [420, 660] },
  kitchen:  { name: ['Canopy kitchen', 'Canopy kitchen'], w: 4, d: 2, cost: [c(12, 6), c(12, 6)], work: [480, 480] },
  lantern:  { name: ['Wisp lantern', 'Wisp lantern'], w: 1, d: 1, cost: [c(2, 2, 6), c(2, 2, 6)], work: [120, 120] },
};

export const GARDEN_YIELD: [number, number] = [3, 5]; // food per tended day
export const TIER1_XP = 6;
export const TIER1_DAY = 8;
export const MAX_ACTIVE = 2;

const zero = (): Cost => c(0, 0, 0);

export function createVillage(w: World): Village {
  const v: Village = { buildings: [], projects: [], nextId: 1, craftXp: 0, tier: 0 };
  // The old store is there from the start: derelict, no beds yet.
  const foot = footOfRect(w, STORE.x - STORE.w / 2, STORE.z - STORE.d / 2, STORE.w, STORE.d);
  v.buildings.push({
    id: v.nextId++, kind: 'store', tier: 0, foot, facing: 0, door: { ...STORE_DOOR }, inside: { ...STORE_INSIDE },
    beds: 0, level: 0, tended: 0, growth: 0, name: 'the old store',
  });
  return v;
}

function footOfRect(w: World, x0: number, z0: number, wid: number, dep: number): Footprint {
  return { tx: toTileX(w, x0 + 0.01), tz: toTileZ(w, z0 + 0.01), w: Math.round(wid), d: Math.round(dep) };
}

export const store = (v: Village) => v.buildings.find((b) => b.kind === 'store')!;
export const bedsTotal = (v: Village) => v.buildings.reduce((n, b) => n + b.beds, 0);
export const hasBuilt = (v: Village, k: BuildingKind) => v.buildings.some((b) => b.kind === k);
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
      if (w.blocked[i] || w.bushAt[i] >= 0) return { ok: false, trees };
      if (w.treeAt[i] >= 0) {
        if (w.trees[w.treeAt[i]].protected) return { ok: false, trees };
        trees.push(w.treeAt[i]);
      }
    } else if (w.blocked[i]) {
      return { ok: false, trees }; // keep a walkway around buildings
    }
  }
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
  if (Math.hypot(cx - CAMP.x, cz - CAMP.z) < 5.5 + Math.max(f.w, f.d) / 2) return { ok: false, trees };
  const sp = w.stockpile;
  if (x0 < sp.x1 + pad && x0 + f.w > sp.x0 - pad && z0 < sp.z1 + pad && z0 + f.d > sp.z0 - pad) return { ok: false, trees };
  return { ok: true, trees };
}

type SiteKind = 'hut' | 'garden' | 'workshop' | 'lantern';

/** Score candidate sites around the fire and return the best one. */
export function findSite(w: World, v: Village, kind: SiteKind, rng: Rng): { foot: Footprint; facing: number; trees: number[] } | null {
  const def = DEFS[kind];
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
      const ideal = kind === 'lantern' ? 7 : kind === 'garden' ? 13 : kind === 'workshop' ? 10 : 9;
      let score = Math.abs(dist - ideal) * 1.2;
      if (score > bestScore) continue;
      const free = footprintFree(w, v, foot, kind === 'lantern' ? 0 : 1);
      if (!free.ok) continue;
      score += free.trees.length * 2.5;
      if (kind === 'garden') {
        let meadow = 0;
        for (const [tx, tz] of footTiles(foot)) if (w.ground[idx(w, tx, tz)] === Ground.Meadow) meadow++;
        score -= meadow * 0.4;
      }
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
      score += rng.next() * 1.5; // a little personality
      if (score < bestScore) {
        // Door faces the fire.
        const ax = CAMP.x - cen.x, az = CAMP.z - cen.z;
        const facing = Math.abs(ax) > Math.abs(az) ? (ax > 0 ? 1 : 3) : (az > 0 ? 0 : 2);
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
export function plan(w: World, v: Village, com: Community, rng: Rng, lead: string): Project | null {
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
      kind: 'clear_store', tier: 0, name: 'Clear out the old store', foot: st.foot, facing: 0,
      cost: zero(), workNeeded: 480, target: st.id, clearTrees: [],
    }));
  }
  const shelter = () => {
    if (st.level === 1 && !has('patch_roof')) {
      return newProject(v, {
        kind: 'patch_roof', tier: 0, name: 'Patch the store roof', foot: st.foot, facing: 0,
        cost: c(10, 6), workNeeded: 360, target: st.id, clearTrees: [],
      });
    }
    if (st.level >= 2 && !hasBuilt(v, 'annex') && !has('annex')) {
      const foot = footOfRect(w, ANNEX.x0, ANNEX.z0, ANNEX.w, ANNEX.d);
      const def = DEFS.annex;
      return newProject(v, {
        kind: 'annex', tier: 0, name: def.name[0], foot, facing: 0,
        cost: { ...def.cost[0] }, workNeeded: def.work[0], target: 0, clearTrees: [],
      });
    }
    if (st.level >= 1 && !has('hut')) return site('hut');
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
    const where = Math.abs(cen.x - CAMP.x) > Math.abs(cen.z - CAMP.z)
      ? (cen.x > CAMP.x ? 'east' : 'west') : (cen.z > CAMP.z ? 'south' : 'north');
    log(com, `${lead} scratched a plan in the dirt: ${def.name[tier].toLowerCase()} ${where} of the fire, door to the ${dir}.`, 'good');
    return p;
  };

  if (beds < pop) wants.push(shelter);
  const kitchen = () => (!hasBuilt(v, 'kitchen') && !has('kitchen') && st.level >= 1
    ? newProject(v, {
      kind: 'kitchen', tier: 0, name: DEFS.kitchen.name[0],
      foot: footOfRect(w, KITCHEN.x - 2, KITCHEN.z - 1, 4, 2), facing: 0,
      cost: { ...DEFS.kitchen.cost[0] }, workNeeded: DEFS.kitchen.work[0], target: 0, clearTrees: [],
    }) : null);
  const garden = () => (!hasBuilt(v, 'garden') && !has('garden') ? site('garden') : null);
  const workshop = () => (!hasBuilt(v, 'workshop') && !has('workshop') ? site('workshop') : null);
  // Personalities reorder priorities.
  const mid = [kitchen, garden, workshop];
  if (traits.has('green_thumb')) mid.unshift(garden);
  if (traits.has('tinkerer')) mid.unshift(workshop);
  wants.push(...mid);
  if (beds < pop + 2) wants.push(shelter); // a little room for newcomers
  if (v.tier === 1 && !has('upgrade')) {
    wants.push(() => {
      const old = v.buildings.find((b) => b.tier === 0 && (b.kind === 'hut' || b.kind === 'garden' || b.kind === 'workshop'));
      if (!old) return null;
      const def = DEFS[old.kind as 'hut' | 'garden' | 'workshop'];
      log(com, `${lead} wants to rebuild ${old.name.toLowerCase()} properly, in timber.`, 'good');
      return newProject(v, {
        kind: 'upgrade', tier: 1, name: `Rebuild as ${def.name[1].toLowerCase()}`, foot: old.foot, facing: old.facing,
        cost: { ...def.cost[1] }, workNeeded: def.work[1], target: old.id, clearTrees: [],
      });
    });
  }
  const lanterns = v.buildings.filter((b) => b.kind === 'lantern').length;
  if (com.resources.glimmer >= 8 && lanterns < Math.min(4, Math.floor(com.day / 4)) && !has('lantern')) {
    wants.push(() => site('lantern'));
  }
  if (v.buildings.filter((b) => b.kind === 'garden').length < Math.ceil(pop / 5) && !has('garden')) {
    wants.push(() => site('garden'));
  }

  for (const want of wants) {
    const p = want();
    if (p) return p;
  }
  return null;
}

function projectBeds(p: Project, v: Village): number {
  if (p.kind === 'clear_store') return 4;
  if (p.kind === 'patch_roof') return 2;
  if (p.kind === 'annex') return DEFS.annex.beds![0];
  if (p.kind === 'hut') return DEFS.hut.beds![p.tier];
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
  const block = (f: Footprint) => { for (const [tx, tz] of footTiles(f)) w.blocked[idx(w, tx, tz)] = 1; };
  switch (p.kind) {
    case 'clear_store': {
      const st = store(v);
      st.level = 1; st.beds = 4;
      res.scrap += 6;
      log(com, 'The old store is swept out. Four can sleep dry inside, and there was scrap behind the counter.', 'good');
      break;
    }
    case 'patch_roof': {
      const st = store(v);
      st.level = 2; st.beds = 6;
      log(com, 'Tarp and tin over the broken roof. The store sleeps six now, and nobody drips.', 'good');
      break;
    }
    case 'upgrade': {
      const b = v.buildings.find((x) => x.id === p.target);
      if (b) {
        b.tier = 1;
        const def = DEFS[b.kind as 'hut' | 'garden' | 'workshop'];
        b.name = def.name[1];
        if (def.beds) b.beds = def.beds[1];
        log(com, `The ${def.name[0].toLowerCase()} is gone; a ${def.name[1].toLowerCase()} stands in its place.`, 'good');
      }
      break;
    }
    default: {
      const kind = p.kind as Exclude<BuildingKind, 'store'>;
      const def = DEFS[kind];
      const cen = footCenter(w, p.foot);
      const b: Building = {
        id: v.nextId++, kind, tier: p.tier, foot: p.foot, facing: p.facing,
        door: kind === 'kitchen' ? { x: KITCHEN.x, z: KITCHEN.z } : doorOf(w, p.foot, p.facing),
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

/** Bed assignments: indoor beds first, by survivor id. Returns survivor id → building id. */
export function assignBeds(v: Village, ids: number[]): Map<number, number> {
  const out = new Map<number, number>();
  const slots: number[] = [];
  for (const b of v.buildings) for (let i = 0; i < b.beds; i++) slots.push(b.id);
  [...ids].sort((a, b) => a - b).forEach((id, i) => { if (i < slots.length) out.set(id, slots[i]); });
  return out;
}

export const MATERIALS: Material[] = ['wood', 'scrap', 'glimmer'];
