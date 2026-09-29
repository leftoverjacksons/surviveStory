/**
 * Breaking up paving (DESIGN §24.12). Most of the old world is car parks,
 * roads and slabs: nothing grows there and nothing sensible is built on it.
 * The player marks paving with the Depave brush; builders (and farmers with
 * nothing else to do) break it up a square at a time, and it becomes soil
 * that can be zoned, planted, fenced and built on like any other ground.
 * The rubble gives a little scrap (rebar, kerb iron, a drain cover).
 */
import type { Colony } from './colony';
import { log } from './community';
import { Ground, idx, inBounds, isExplored, toTileX, toTileZ, type World } from './world';

/** Minutes of work to break up one square. */
export const DEPAVE_WORK = 40;
/** Squares broken up for each scrap found in the rubble. */
export const DEPAVE_PER_SCRAP = 4;

export const paved = (w: World, i: number) => w.ground[i] === Ground.Asphalt || w.ground[i] === Ground.Concrete;

/** Mark (or unmark) paving in a disc for breaking up. Returns squares changed. */
export function markDepave(w: World, x: number, z: number, radius: number, on: boolean): number {
  const d = (w.depave ??= new Uint8Array(w.w * w.h));
  const cx = toTileX(w, x), cz = toTileZ(w, z), r = Math.ceil(radius);
  let n = 0;
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const tx = cx + dx, tz = cz + dz;
    if (!inBounds(w, tx, tz) || Math.hypot(dx, dz) > radius) continue;
    const i = idx(w, tx, tz);
    if (on) {
      if (d[i] || !paved(w, i) || w.blocked[i] || w.haunted?.[i] || !isExplored(w, tx, tz)) continue;
      d[i] = 1; n++;
    } else if (d[i]) { d[i] = 0; n++; }
  }
  if (n) { w.depaveCount = (w.depaveCount ?? 0) + (on ? n : -n); w.zoneVersion++; }
  return n;
}

/** The nearest square waiting to be broken up that nobody has claimed, within reach. */
export function nearestDepave(col: Colony, x: number, z: number, reach = 80): number {
  const w = col.world, d = w.depave;
  if (!d || !(w.depaveCount! > 0)) return -1;
  const cx = toTileX(w, x), cz = toTileZ(w, z);
  let best = -1, bd = Infinity;
  const r = Math.min(reach, Math.max(w.w, w.h));
  for (let tz = Math.max(0, cz - r); tz <= Math.min(w.h - 1, cz + r); tz++) for (let tx = Math.max(0, cx - r); tx <= Math.min(w.w - 1, cx + r); tx++) {
    const i = tz * w.w + tx;
    if (!d[i] || col.claims.has(i)) continue;
    const dd = (tx - cx) ** 2 + (tz - cz) ** 2;
    if (dd < bd) { bd = dd; best = i; }
  }
  return best;
}

/** A square is broken up: soil, and now and then something worth keeping in the rubble. */
export function finishDepave(col: Colony, i: number) {
  const w = col.world;
  if (w.depave?.[i]) { w.depave[i] = 0; w.depaveCount = Math.max(0, (w.depaveCount ?? 1) - 1); }
  if (!paved(w, i)) return;
  w.ground[i] = Ground.Grass;
  w.groundVersion = (w.groundVersion ?? 0) + 1;
  w.zoneVersion++;
  w.depaved = (w.depaved ?? 0) + 1;
  if (w.depaved % DEPAVE_PER_SCRAP === 0) col.community.resources.scrap += 1;
  if (w.depaved === 1) log(col.community, 'The first square of old paving has been broken up. Under it the soil is pale and cold, but it is soil.', 'good');
  else if (w.depaved % 50 === 0) log(col.community, `${w.depaved} squares of old paving broken up so far. The ground is coming back.`, 'good');
}
