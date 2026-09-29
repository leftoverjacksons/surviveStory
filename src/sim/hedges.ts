/**
 * Fences, gates and garden beds on the walking grid (DESIGN §23.7).
 *
 * People used to walk straight through field fences, yard fences and
 * vegetable beds. Those tiles now cost extra to cross (`world.hedge`, read by
 * `tileCost`), so paths go round, or through a gate. They stay passable, so
 * nobody is ever shut in a yard. Where people keep crossing a fence at the
 * same place anyway, a gate is put there: the village's own desire line.
 */
import type { Colony } from './colony';
import { idx, inBounds, toTileX, toTileZ, type Point, type World } from './world';
import { perimeter } from './fields';
import { plotFence, plotPoint } from './homes';

export const HEDGE = { none: 0, fence: 1, gate: 2, bed: 3 } as const;
/** Extra cost of stepping onto a fence or a bed (a tile's base cost is about 1). */
export const HEDGE_COST = 4;
/** Crossings of one fence tile before a gate is put in. */
export const GATE_AFTER = 10;

function mark(w: World, h: Uint8Array, x: number, z: number, v: number) {
  const tx = toTileX(w, x), tz = toTileZ(w, z);
  if (!inBounds(w, tx, tz)) return;
  const i = idx(w, tx, tz);
  // Gates win over fences; fences over beds.
  if (h[i] === HEDGE.gate) return;
  if (v === HEDGE.bed && h[i] === HEDGE.fence) return;
  h[i] = v;
}

/** Mark a polyline's first `frac` of length as fence, every half tile. */
function line(w: World, h: Uint8Array, pts: Point[], frac: number, closed: boolean) {
  const path = closed ? [...pts, pts[0]] : pts;
  const total = perimeter(pts);
  let left = frac * total;
  for (let k = 0; k + 1 < path.length && left > 0; k++) {
    const a = path[k], b = path[k + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const run = Math.min(len, left);
    for (let d = 0; d <= run; d += 0.5) mark(w, h, a.x + ((b.x - a.x) / len) * d, a.z + ((b.z - a.z) / len) * d, HEDGE.fence);
    left -= len;
  }
}

/** Rebuild the grid from what stands now. Cheap enough to run daily and after changes. */
export function syncHedges(col: Colony) {
  const w = col.world, v = col.village;
  const h = (w.hedge && w.hedge.length === w.w * w.h) ? w.hedge.fill(0) : (w.hedge = new Uint8Array(w.w * w.h));
  // Field fences, as far as they are built; their own gate stays open.
  for (const f of w.fields) {
    if (f.fence <= 0) continue;
    line(w, h, f.pts, f.fence, true);
    const a = f.pts[f.gate], b = f.pts[(f.gate + 1) % f.pts.length];
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    mark(w, h, mx, mz, HEDGE.gate);
  }
  // Yard fences (sides and back of each plot, as built) and the beds and outbuildings inside.
  for (const p of v.plots) {
    const fence = p.yard.find((y) => y.kind === 'fence');
    if (fence && fence.progress > 0) {
      const path = plotFence(p);
      const total = path.slice(1).reduce((n, q, k) => n + Math.hypot(q.x - path[k].x, q.z - path[k].z), 0);
      let left = Math.min(1, fence.progress) * total;
      for (let k = 0; k + 1 < path.length && left > 0; k++) {
        const a = path[k], b = path[k + 1];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        for (let d = 0; d <= Math.min(len, left); d += 0.5) mark(w, h, a.x + ((b.x - a.x) / len) * d, a.z + ((b.z - a.z) / len) * d, HEDGE.fence);
        left -= len;
      }
    }
    for (const y of p.yard) {
      if (y.progress <= 0 || !['beds', 'coop', 'shed', 'woodpile'].includes(y.kind)) continue;
      for (let du = -y.w / 2 + 0.25; du <= y.w / 2 - 0.25; du += 0.5) for (let dv = -y.d / 2 + 0.25; dv <= y.d / 2 - 0.25; dv += 0.5) {
        const q = plotPoint(p, y.u + du, y.v + dv);
        mark(w, h, q.x, q.z, HEDGE.bed);
      }
    }
  }
  // Gates the village wore for itself.
  for (const g of w.gates ?? []) mark(w, h, g.x, g.z, HEDGE.gate);
}

/**
 * Someone stepped onto a tile: if it is fence, count the crossing, and put a
 * gate in once people keep coming this way. Returns true if a gate was made.
 */
export function crossed(col: Colony, tile: number): boolean {
  const w = col.world;
  if (!w.hedge || w.hedge[tile] !== HEDGE.fence) return false;
  const n = ((col.fenceCross ??= {})[tile] = (col.fenceCross[tile] ?? 0) + 1);
  if (n < GATE_AFTER) return false;
  delete col.fenceCross[tile];
  const x = (tile % w.w) - w.w / 2 + 0.5, z = Math.floor(tile / w.w) - w.h / 2 + 0.5;
  (w.gates ??= []).push({ x, z, day: col.community.day });
  w.hedge[tile] = HEDGE.gate;
  w.hedgeVersion = (w.hedgeVersion ?? 0) + 1;
  return true;
}

/** Is this point at a gate the village wore for itself (for renderers leaving a gap in a fence)? */
export function gateNear(w: World, x: number, z: number, r = 0.9): boolean {
  return (w.gates ?? []).some((g) => Math.hypot(g.x - x, g.z - z) < r);
}
