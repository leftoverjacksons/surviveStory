/**
 * Moving the hearth and the stockpile (DESIGN §27). The fire the village
 * gathers at, and the yard where the stores are stacked, were where the
 * starting site put them; the player can move either. The fire is carried in
 * a pot of embers (at once); the stockpile's stacks are carried over by the
 * people hauling to it (the stores themselves are counted, not placed).
 *
 * Everything that works from the fire's place reads it live: bedrolls, the
 * evening circle, festivals, where plots and lanes are laid out from, and the
 * Folk's night calls. Upcoming festivals at the old fire follow it.
 */
import type { Colony } from './colony';
import { endTask } from './colony';
import { log } from './community';
import { findPath } from './path';
import { Ground, Zone, idx, inBounds, isExplored, toTileX, toTileZ, type Rect } from './world';

/** Room the fire needs round it (the seats and the bedrolls). */
const FIRE_R = 4.6;

/** Anything that stands (buildings, sites) too close to a circle of radius r at (x, z)? */
function crowded(col: Colony, x: number, z: number, r: number): string | null {
  const v = col.village, w = col.world;
  for (const b of v.buildings) {
    const bx = b.foot.tx - w.w / 2 + b.foot.w / 2, bz = b.foot.tz - w.h / 2 + b.foot.d / 2;
    if (Math.hypot(bx - x, bz - z) < r + Math.max(b.foot.w, b.foot.d) / 2) return `Too close to ${b.name.toLowerCase()}.`;
  }
  for (const p of v.projects) {
    if (p.done || p.kind === 'restore' || p.kind === 'upgrade') continue;
    const px = p.foot.tx - w.w / 2 + p.foot.w / 2, pz = p.foot.tz - w.h / 2 + p.foot.d / 2;
    if (Math.hypot(px - x, pz - z) < r + Math.max(p.foot.w, p.foot.d) / 2) return `Too close to the site of ${p.name.toLowerCase()}.`;
  }
  return null;
}

/** Is each tile within r of (x, z) open ground the village could use? A reason if not. */
function openGround(col: Colony, x: number, z: number, r: number): string | null {
  const w = col.world, v = col.village;
  const R = Math.ceil(r), cx = toTileX(w, x), cz = toTileZ(w, z);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const tx = cx + dx, tz = cz + dz;
    if (Math.hypot(dx, dz) > r) continue;
    if (!inBounds(w, tx, tz)) return 'Off the edge of the map.';
    if (!isExplored(w, tx, tz)) return 'Nobody has been out that far yet.';
    const i = idx(w, tx, tz);
    if (w.ground[i] === Ground.Water) return 'Not on water.';
    if (w.blocked[i]) return 'Something is in the way.';
    if (v.plotAt[i]) return 'Not on a household\'s plot.';
    if (w.zone[i] === Zone.Field || w.fieldAt?.[i] > 0) return 'Not in a field.';
    if (w.zone[i] === Zone.Wild || w.folk.path[i]) return 'Not on the Folk\'s land.';
  }
  return null;
}

/** Can people walk from where they are now to there? */
function reachable(col: Colony, from: { x: number; z: number }, x: number, z: number): boolean {
  const w = col.world;
  return !!findPath(w, toTileX(w, from.x), toTileZ(w, from.z), toTileX(w, x), toTileZ(w, z), 60000);
}

const rectCentre = (r: Rect) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });

/** Why the fire can't go here, or null. */
export function whyNotFire(col: Colony, x: number, z: number): string | null {
  const w = col.world;
  const bad = openGround(col, x, z, 2.5) ?? crowded(col, x, z, FIRE_R);
  if (bad) return bad;
  const sp = w.stockpile;
  const nx = Math.max(sp.x0, Math.min(sp.x1, x)), nz = Math.max(sp.z0, Math.min(sp.z1, z));
  if (Math.hypot(nx - x, nz - z) < FIRE_R) return 'Too close to the stockpile.';
  if (!reachable(col, w.campfire, x, z)) return 'Nobody could get there from here.';
  return null;
}

/** Carry the fire to a new place. Returns why not, or null. */
export function moveFire(col: Colony, x: number, z: number): string | null {
  const why = whyNotFire(col, x, z);
  if (why) return why;
  const w = col.world, old = { ...w.campfire };
  w.campfire = { x, z };
  // Festivals still to come at the old fire follow it.
  for (const g of col.gatherings ?? []) if (!g.done && g.kind !== 'folk_festival' && Math.hypot(g.at.x - old.x, g.at.z - old.z) < 1) g.at = { x, z };
  // Anyone sitting by it, or asleep in a bedroll, gets up and finds the new one.
  for (const a of col.agents) if (a.task?.kind === 'social' || (a.task?.kind === 'sleep' && !a.indoors) || a.task?.kind === 'eat') endTask(col, a);
  col.village.bedsDirty = true;
  w.zoneVersion++;
  log(col.community, 'They carried the fire to its new place in a pot of embers, and laid the stones round it again. It took a while for the new spot to feel like home.', 'info');
  return null;
}

/** The stockpile's rect if centred at (x, z) (same size as now). */
export function stockpileAt(col: Colony, x: number, z: number): Rect {
  const sp = col.world.stockpile, hw = (sp.x1 - sp.x0) / 2, hd = (sp.z1 - sp.z0) / 2;
  return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd };
}

/** Why the stockpile can't go here, or null. */
export function whyNotStockpile(col: Colony, x: number, z: number): string | null {
  const w = col.world, r = stockpileAt(col, x, z);
  const half = Math.hypot(r.x1 - r.x0, r.z1 - r.z0) / 2;
  const bad = openGround(col, x, z, half + 0.5) ?? crowded(col, x, z, half + 1);
  if (bad) return bad;
  const nx = Math.max(r.x0, Math.min(r.x1, w.campfire.x)), nz = Math.max(r.z0, Math.min(r.z1, w.campfire.z));
  if (Math.hypot(nx - w.campfire.x, nz - w.campfire.z) < FIRE_R) return 'Too close to the fire.';
  if (!reachable(col, rectCentre(w.stockpile), x, z)) return 'Nobody could get there from here.';
  return null;
}

/** Move the stockpile (and its woodyard). Returns why not, or null. */
export function moveStockpile(col: Colony, x: number, z: number): string | null {
  const why = whyNotStockpile(col, x, z);
  if (why) return why;
  const w = col.world;
  w.stockpile = stockpileAt(col, x, z);
  // The woodyard is chosen again beside it.
  w.woodyard = undefined;
  // Those carrying to the old one, or splitting there, start again.
  for (const a of col.agents) if (a.task?.kind === 'haul' || a.task?.kind === 'split' || a.task?.kind === 'supply') endTask(col, a);
  w.zoneVersion++;
  log(col.community, 'The stockpile was carried to its new place, stack by stack, crate by crate.', 'info');
  return null;
}

/** Is a point on the fire (for the right-click card)? */
export const atFire = (col: Colony, x: number, z: number) => Math.hypot(x - col.world.campfire.x, z - col.world.campfire.z) < 1.6;
/** Is a point on the stockpile? */
export function atStockpile(col: Colony, x: number, z: number) {
  const sp = col.world.stockpile;
  return x > sp.x0 - 0.5 && x < sp.x1 + 0.5 && z > sp.z0 - 0.5 && z < sp.z1 + 0.5;
}
