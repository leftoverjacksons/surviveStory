import { idx, inBounds, passable, tileCost, type World } from './world';

/**
 * A* over the tile grid, 8-directional without corner cutting.
 * Returns tile indices from start (exclusive) to goal (inclusive), or null.
 */

let gScore = new Float32Array(0);
let came = new Int32Array(0);
let stamp = new Uint32Array(0);
let closed = new Uint32Array(0);
let gen = 0;

// Binary min-heap keyed by f-score.
let heapIdx = new Int32Array(1024);
let heapF = new Float32Array(1024);
let heapLen = 0;

function heapPush(i: number, f: number) {
  if (heapLen >= heapIdx.length) {
    const ni = new Int32Array(heapIdx.length * 2); ni.set(heapIdx); heapIdx = ni;
    const nf = new Float32Array(heapF.length * 2); nf.set(heapF); heapF = nf;
  }
  let k = heapLen++;
  while (k > 0) {
    const p = (k - 1) >> 1;
    if (heapF[p] <= f) break;
    heapIdx[k] = heapIdx[p]; heapF[k] = heapF[p];
    k = p;
  }
  heapIdx[k] = i; heapF[k] = f;
}

function heapPop(): number {
  const top = heapIdx[0];
  const li = heapIdx[--heapLen], lf = heapF[heapLen];
  let k = 0;
  for (;;) {
    let c = 2 * k + 1;
    if (c >= heapLen) break;
    if (c + 1 < heapLen && heapF[c + 1] < heapF[c]) c++;
    if (heapF[c] >= lf) break;
    heapIdx[k] = heapIdx[c]; heapF[k] = heapF[c];
    k = c;
  }
  heapIdx[k] = li; heapF[k] = lf;
  return top;
}

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

export function findPath(
  w: World, sx: number, sz: number, gx: number, gz: number, maxExpand = 40000,
): number[] | null {
  if (!inBounds(w, sx, sz) || !passable(w, gx, gz)) return null;
  const n = w.w * w.h;
  if (gScore.length !== n) {
    gScore = new Float32Array(n); came = new Int32Array(n);
    stamp = new Uint32Array(n); closed = new Uint32Array(n);
  }
  gen++;
  heapLen = 0;
  const start = idx(w, sx, sz), goal = idx(w, gx, gz);
  const h = (tx: number, tz: number) => {
    const dx = Math.abs(tx - gx), dz = Math.abs(tz - gz);
    // Most ground costs 1; roads and worn lanes less. 0.95 keeps paths close to
    // optimal (they still prefer lanes) while expanding far fewer tiles.
    return (dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)) * 0.95;
  };
  stamp[start] = gen; gScore[start] = 0; came[start] = -1;
  heapPush(start, h(sx, sz));
  let expanded = 0;
  while (heapLen > 0) {
    const cur = heapPop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    if (cur === goal) {
      const out: number[] = [];
      for (let c = cur; c !== start; c = came[c]) out.push(c);
      return out.reverse();
    }
    if (++expanded > maxExpand) return null;
    const cx = cur % w.w, cz = (cur / w.w) | 0;
    for (const [dx, dz, base] of DIRS) {
      const nx = cx + dx, nz = cz + dz;
      if (!passable(w, nx, nz)) continue;
      if (dx !== 0 && dz !== 0 && (!passable(w, cx + dx, cz) || !passable(w, cx, cz + dz))) continue;
      const ni = idx(w, nx, nz);
      if (closed[ni] === gen) continue;
      const g = gScore[cur] + base * tileCost(w, nx, nz);
      if (stamp[ni] !== gen || g < gScore[ni]) {
        stamp[ni] = gen; gScore[ni] = g; came[ni] = cur;
        heapPush(ni, g + h(nx, nz));
      }
    }
  }
  return null;
}

/**
 * Pull a tile path taut (DESIGN §38.10, village): skip corners wherever the
 * straight line crosses only open ground no dearer than the way A* chose, so
 * people walk diagonals and gentle curves instead of staircases, but still go
 * round fences, beds and trunks they went round before. The last point is kept.
 */
export function tautPath(w: World, from: { x: number; z: number }, pts: { x: number; z: number }[]): { x: number; z: number }[] {
  if (pts.length < 2) return pts;
  const all = [from, ...pts];
  const costAt = (x: number, z: number) => {
    const tx = Math.floor(x + w.w / 2), tz = Math.floor(z + w.h / 2);
    return passable(w, tx, tz) ? tileCost(w, tx, tz) : Infinity;
  };
  // The dearest tile the chosen way crosses between two of its points.
  const dearest = (i: number, j: number) => { let c = 0; for (let k = i; k <= j; k++) { const q = costAt(all[k].x, all[k].z); if (q < Infinity) c = Math.max(c, q); } return c; };
  const clear = (a: { x: number; z: number }, b: { x: number; z: number }, limit: number) => {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(d / 0.2);
    const nx = -(b.z - a.z) / (d || 1) * 0.22, nz = (b.x - a.x) / (d || 1) * 0.22;
    for (let k = 1; k < n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n;
      // A body's width either side, so nobody shaves a corner or a trunk.
      if (costAt(x, z) > limit + 1e-6 || costAt(x + nx, z + nz) > limit + 1e-6 || costAt(x - nx, z - nz) > limit + 1e-6) return false;
    }
    return true;
  };
  const out: { x: number; z: number }[] = [];
  let i = 0;
  while (i < all.length - 1) {
    let next = i + 1;
    for (let j = Math.min(all.length - 1, i + 14); j > i + 1; j--) if (clear(all[i], all[j], dearest(i, j))) { next = j; break; }
    out.push(all[next]);
    i = next;
  }
  return out;
}
