/**
 * Clearing the old world away for what it's made of (DESIGN §24.18; the
 * user's backlog, §23.2: "junk cars selectable for stripping and removal …
 * dismantling cleared ruins for scrap is one renewable source").
 *
 * - A wreck or junk heap the player marks is stripped first, whether or not
 *   the stores need scrap, until it's gone and its ground is clear.
 * - A wreck or heap can be towed (DESIGN §30): builders push it, slowly,
 *   to a spot the player picks (or the scrap yard beside the stockpile), so
 *   it stops blocking the way and is stripped close to home.
 * - An emptied wreck is gone: its shell hauled off, its tiles free.
 * - An old building in a district that is the village's (or shared) can be
 *   pulled down: slow work, but a great deal of scrap (and whatever glass,
 *   copper and steel was still in its walls), and the ground freed.
 */
import type { Colony } from './colony';
import { endTask } from './colony';
import { log } from './community';
import type { Ruin } from './oldworld';
import { rareOf } from './rare';
import { RESTORE } from './restore';
import { Ground, Zone, idx, inBounds, isExplored, tileX, tileZ, toTileX, toTileZ, type Heap, type World } from './world';

export interface Raze { ruin: number; work: number; need: number }

/** Mark (or unmark) a wreck or heap to be stripped first. */
export function markHeap(col: Colony, h: Heap, on = true): string | null {
  if (h.scrap <= 0) return 'There is nothing left of it.';
  h.marked = on;
  if (on) log(col.community, `${h.kind === 'car' ? 'The wreck' : 'The junk heap'} is to be stripped and cleared away.`, 'info');
  return null;
}

/** Why this ruin can't be pulled down, or null. */
export function whyNotRaze(col: Colony, r: Ruin): string | null {
  const h = col.haunts.find((x) => x.district === r.district);
  if (!h || h.state !== 'cleared') return 'Something still lives there. Clear the district first.';
  if (h.owner === 'folk') return 'That district was given to the Folk.';
  if (!h.owner) return 'Decide who the district belongs to first.';
  if (r.restored) return 'It is lived in again (or in use).';
  if (r.razed) return 'It is already gone.';
  if ((col.village.razes ?? []).some((x) => x.ruin === r.id)) return 'It is already coming down.';
  if (col.village.projects.some((p) => !p.done && p.kind === 'restore' && p.ruin === r.id)) return 'It is being restored.';
  return null;
}

/** Scrap in a building's walls: more for a bigger one. */
export const razeYield = (r: Ruin) => Math.round(Math.max(8, r.w * r.d * 0.45));

/** Ask the builders to pull a ruin down. Returns why not, or null. */
export function razeRuin(col: Colony, r: Ruin): string | null {
  const why = whyNotRaze(col, r);
  if (why) return why;
  (col.village.razes ??= []).push({ ruin: r.id, work: 0, need: Math.round(200 + r.w * r.d * 6) });
  log(col.community, `${r.name} is to be pulled down for what's in it${RESTORE[r.kind] ? ' (it could have been restored instead)' : ''}.`, 'info');
  return null;
}

/** It's down: the scrap and anything rare comes in, and the ground is free. */
export function finishRaze(col: Colony, z: Raze) {
  const w = col.world, v = col.village, res = col.community.resources;
  v.razes = (v.razes ?? []).filter((x) => x !== z);
  const r = w.ruins[z.ruin];
  if (!r || r.razed) return;
  const scrap = razeYield(r);
  res.scrap += scrap;
  const mat = r.materials[0] ?? 'odds and ends';
  v.salvaged[`${mat}|${r.name}`] = (v.salvaged[`${mat}|${r.name}`] ?? 0) + scrap;
  const rare = rareOf(r);
  let extra = '';
  if (rare && rare.left > 0) { res[rare.mat] += rare.left; extra = `, and ${rare.left} ${rare.mat}`; r.stripped = (r.stripped ?? 0) + rare.left; }
  r.razed = true;
  // Free its walls; the slab and the paving stay (break them up with the Depave brush).
  const cs = Math.cos(r.yaw), sn = Math.sin(r.yaw);
  const R = Math.ceil(Math.hypot(r.w, r.d) / 2) + 1;
  const cx = toTileX(w, r.x), cz = toTileZ(w, r.z);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const tx = cx + dx, tz = cz + dz;
    if (!inBounds(w, tx, tz)) continue;
    const x = tx - w.w / 2 + 0.5 - r.x, zz = tz - w.h / 2 + 0.5 - r.z;
    if (Math.abs(x * cs - zz * sn) <= r.w / 2 + 0.2 && Math.abs(x * sn + zz * cs) <= r.d / 2 + 0.2) w.blocked[idx(w, tx, tz)] = 0;
  }
  w.zoneVersion++;
  log(col.community, `${r.name} is down: ${scrap} scrap${extra} brought in, and the ground is open.`, 'good');
}

// ---------- wrecks: towing and clearing (DESIGN §30) ----------

/** The tiles a heap blocks: its own, and for a car about three along its length (as worldgen laid it). */
export function heapTiles(w: World, h: Heap, tx = h.tx, tz = h.tz): number[] {
  const out: number[] = [];
  if (inBounds(w, tx, tz)) out.push(idx(w, tx, tz));
  if (h.kind === 'car') {
    const x = tileX(w, tx), z = tileZ(w, tz);
    for (const k of [-1.4, 1.4]) {
      const bx = toTileX(w, x + Math.cos(h.rot) * k), bz = toTileZ(w, z - Math.sin(h.rot) * k);
      if (inBounds(w, bx, bz)) out.push(idx(w, bx, bz));
    }
  }
  return [...new Set(out)];
}

/** Stripped bare: the shell is hauled off with the last load, and its ground is free. */
export function clearHeap(col: Colony, h: Heap) {
  const w = col.world;
  for (const i of heapTiles(w, h)) w.blocked[i] = 0;
  h.scrap = 0; h.marked = false; h.tow = undefined;
  w.zoneVersion++;
}

/** What someone will put down when asked to push a wreck. */
const INTERRUPTIBLE = new Set(['forage', 'social', 'tend', 'wander', 'leisure', 'yard', 'salvage', 'scrounge', 'garden']);

/** Minutes of pushing to tow a wreck a distance d. */
const towWork = (h: Heap, d: number) => Math.round((h.kind === 'car' ? 60 : 40) + d * (h.kind === 'car' ? 5 : 3));
/** How far anyone will push a wreck. */
export const TOW_MAX = 60;

/** Why a heap can't be towed to (x, z), or null. */
export function whyNotTow(col: Colony, h: Heap, x: number, z: number): string | null {
  const w = col.world, v = col.village;
  if (h.scrap <= 0) return 'There is nothing left of it.';
  if (h.tow) return 'It is already being towed.';
  const d = Math.hypot(x - tileX(w, h.tx), z - tileZ(w, h.tz));
  if (d < 2) return 'That is where it is.';
  if (d > TOW_MAX) return `Too far to push it (${TOW_MAX} at most).`;
  const tx = toTileX(w, x), tz = toTileZ(w, z);
  const own = new Set(heapTiles(w, h));
  const to = heapTiles(w, h, tx, tz);
  if (to.length < (h.kind === 'car' ? 3 : 1)) return 'Off the edge of the map.';
  for (const i of to) {
    const itx = i % w.w, itz = Math.floor(i / w.w);
    if (!isExplored(w, itx, itz)) return 'Nobody has been out that far yet.';
    if (w.ground[i] === Ground.Water) return 'Not into the water.';
    if (w.blocked[i] && !own.has(i)) return 'Something is in the way there.';
    if (w.treeAt[i] >= 0) return 'A tree is in the way there.';
    if (v.plotAt[i]) return 'Not on a household\'s plot.';
    if (w.zone[i] === Zone.Field || w.fieldAt?.[i] > 0) return 'Not in a field.';
    if (w.zone[i] === Zone.Wild || w.folk.path[i]) return 'Not on the Folk\'s land.';
  }
  return null;
}

/** Ask the builders to push a wreck to (x, z). Returns why not, or null. */
export function towHeap(col: Colony, h: Heap, x: number, z: number): string | null {
  const why = whyNotTow(col, h, x, z);
  if (why) return why;
  const w = col.world, tx = toTileX(w, x), tz = toTileZ(w, z);
  const d = Math.hypot(tileX(w, tx) - tileX(w, h.tx), tileZ(w, tz) - tileZ(w, h.tz));
  h.tow = { tx, tz, work: 0, need: towWork(h, d) };
  h.marked = false;
  // An explicit order: the two nearest people at something that can wait put it down and come.
  const hx = tileX(w, h.tx), hz = tileZ(w, h.tz);
  const idle = col.agents
    .filter((a) => !a.task || (INTERRUPTIBLE.has(a.task.kind) && !a.carry))
    .filter((a) => col.community.survivors.find((s) => s.id === a.id && s.alive && s.role !== 'rest' && s.age >= 12))
    .sort((a, b) => Math.hypot(a.x - hx, a.z - hz) - Math.hypot(b.x - hx, b.z - hz))
    .slice(0, 2);
  for (const a of idle) if (a.task) endTask(col, a);
  log(col.community, `${h.kind === 'car' ? 'The wreck' : 'The junk heap'} is to be pushed ${d < 12 ? 'out of the way' : 'over to where it was wanted'}.`, 'info');
  return null;
}

/** Changed your mind: it stays where it has got to. */
export function stopTow(col: Colony, h: Heap) {
  if (!h.tow) return;
  const p = heapPos(col.world, h);
  finishTow(col, h, toTileX(col.world, p.x), toTileZ(col.world, p.z), true);
}

/** Where a heap is drawn now: part way along if it is being towed. */
export function heapPos(w: World, h: Heap): { x: number; z: number } {
  const x0 = tileX(w, h.tx), z0 = tileZ(w, h.tz);
  if (!h.tow) return { x: x0, z: z0 };
  const k = Math.min(1, h.tow.work / h.tow.need);
  return { x: x0 + (tileX(w, h.tow.tx) - x0) * k, z: z0 + (tileZ(w, h.tow.tz) - z0) * k };
}

/** It's there (or stopped part way): its old ground is free, its new ground taken. */
export function finishTow(col: Colony, h: Heap, tx = h.tow?.tx ?? h.tx, tz = h.tow?.tz ?? h.tz, stopped = false) {
  const w = col.world;
  for (const i of heapTiles(w, h)) w.blocked[i] = 0;
  // Stopped part way on something: it goes back to where it was.
  if (stopped && heapTiles(w, h, tx, tz).some((i) => w.blocked[i] || w.ground[i] === Ground.Water)) { tx = h.tx; tz = h.tz; }
  h.tx = tx; h.tz = tz;
  h.tow = undefined;
  h.reserved = 0;
  for (const i of heapTiles(w, h)) w.blocked[i] = 1;
  w.zoneVersion++;
  if (!stopped) log(col.community, `${h.kind === 'car' ? 'The wreck' : 'The junk heap'} was pushed into its new place.`, 'good');
}

/** The scrap yard: open ground beside the stockpile where a towed wreck can stand. Null if none. */
export function yardSpot(col: Colony, h: Heap): { x: number; z: number } | null {
  const w = col.world, sp = w.stockpile;
  const cx = (sp.x0 + sp.x1) / 2, cz = (sp.z0 + sp.z1) / 2;
  let best: { x: number; z: number } | null = null, bd = Infinity;
  for (let r = 4; r <= 16; r += 1) for (let a = 0; a < 24; a++) {
    const x = cx + Math.cos((a / 24) * Math.PI * 2) * r, z = cz + Math.sin((a / 24) * Math.PI * 2) * r;
    if (whyNotTow(col, h, x, z)) continue;
    // A tile of room all round, so it doesn't lean on a wall or another wreck.
    const own = new Set(heapTiles(w, h));
    if (heapTiles(w, h, toTileX(w, x), toTileZ(w, z)).some((i) => {
      const tx = i % w.w, tz = Math.floor(i / w.w);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!inBounds(w, tx + dx, tz + dz)) return true;
        const j = idx(w, tx + dx, tz + dz);
        if (w.blocked[j] && !own.has(j)) return true;
      }
      return false;
    })) continue;
    // Keep clear of the fire, and of other wrecks already in the yard.
    if (Math.hypot(x - w.campfire.x, z - w.campfire.z) < 6) continue;
    const d = r + Math.hypot(x - tileX(w, h.tx), z - tileZ(w, h.tz)) * 0.05;
    if (d < bd) { bd = d; best = { x, z }; }
    if (best && r > 6) break;
  }
  return best;
}
