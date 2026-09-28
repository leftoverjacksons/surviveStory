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
