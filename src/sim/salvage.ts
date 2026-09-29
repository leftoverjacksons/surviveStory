/**
 * Clearing the old world away for what it's made of (DESIGN §24.18; the
 * user's backlog, §23.2: "junk cars selectable for stripping and removal …
 * dismantling cleared ruins for scrap is one renewable source").
 *
 * - A wreck or junk heap the player marks is stripped first, whether or not
 *   the stores need scrap, until it's gone and its ground is clear.
 * - An old building in a district that is the village's (or shared) can be
 *   pulled down: slow work, but a great deal of scrap (and whatever glass,
 *   copper and steel was still in its walls), and the ground freed.
 */
import type { Colony } from './colony';
import { log } from './community';
import type { Ruin } from './oldworld';
import { rareOf } from './rare';
import { RESTORE } from './restore';
import { idx, inBounds, toTileX, toTileZ, type Heap } from './world';

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
