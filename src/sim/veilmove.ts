/**
 * Free movement inside the Veil (DESIGN §38.10).
 *
 * The tile grid stays underneath as an index; the team moves on world
 * coordinates. A clearing builds a fine grid (4 cells a tile) over its
 * district once: which cells can be stood on, and which tiles block sight.
 * Reach is a distance flood over that grid (16 neighbours, so its contours are
 * close to circles), paths are pulled taut, and sight is a sampled ray.
 */
import { Ground, idx, inBounds, tileX, tileZ, toTileX, toTileZ, type World } from './world';
import type { Ruin } from './oldworld';

/** World units per fine cell. */
export const CELL = 0.25;
/** How far the Veil grid reaches beyond a district's haunting (tiles). */
const MARGIN = 12;

export interface Pt { x: number; z: number }
/** Something standing in the way: people and spirits. */
export interface Occupant extends Pt { r: number }

/** A tile a clearing team can cross: anything but water, standing trees and wrecks; ruins can be walked through. */
export function walkableTile(w: World, tx: number, tz: number): boolean {
  if (!inBounds(w, tx, tz)) return false;
  const i = idx(w, tx, tz);
  if (w.ground[i] === Ground.Water) return false;
  const t = w.treeAt[i];
  if (t >= 0 && !w.trees[t].felled) return false;
  if (w.heaps.some((h) => h.tx === tx && h.tz === tz)) return false;
  if (w.blocked[i] && !ruinAtTile(w, tx, tz)) return false;
  return true;
}

export function ruinAtTile(w: World, tx: number, tz: number): Ruin | undefined {
  return ruinAtPoint(w, tileX(w, tx), tileZ(w, tz));
}

export function ruinAtPoint(w: World, x: number, z: number): Ruin | undefined {
  return w.ruins.find((r) => {
    if (Math.abs(x - r.x) > r.w + r.d || Math.abs(z - r.z) > r.w + r.d) return false;
    const cs = Math.cos(r.yaw), sn = Math.sin(r.yaw);
    const px = x - r.x, pz = z - r.z;
    return Math.abs(px * cs - pz * sn) <= r.w / 2 + 0.2 && Math.abs(px * sn + pz * cs) <= r.d / 2 + 0.2;
  });
}

/** The ground of one clearing, in tiles: where people may walk and what blocks sight. */
export class VeilGrid {
  /** First tile of the region. */
  readonly tx0: number;
  readonly tz0: number;
  readonly n: number;
  private walk: Uint8Array;
  private opaque: Uint8Array;
  /** Which ruin a tile is part of (its index + 1; 0: none). */
  private ruin: Int32Array;
  /** Standing trees: round, so the ground between them isn't cut into squares. */
  private tree: Uint8Array;
  constructor(private w: World, cx: number, cz: number, radius: number) {
    const r = Math.ceil(radius) + MARGIN;
    this.tx0 = toTileX(w, cx) - r; this.tz0 = toTileZ(w, cz) - r;
    this.n = r * 2 + 1;
    this.walk = new Uint8Array(this.n * this.n);
    this.opaque = new Uint8Array(this.n * this.n);
    this.ruin = new Int32Array(this.n * this.n);
    this.tree = new Uint8Array(this.n * this.n);
    const heapAt = new Set(w.heaps.map((h) => `${h.tx},${h.tz}`));
    for (let j = 0; j < this.n; j++) for (let i = 0; i < this.n; i++) {
      const tx = this.tx0 + i, tz = this.tz0 + j;
      if (!inBounds(w, tx, tz)) continue;
      const k = j * this.n + i, wi = idx(w, tx, tz);
      const tree = w.treeAt[wi] >= 0 && !w.trees[w.treeAt[wi]].felled;
      const heap = heapAt.has(`${tx},${tz}`);
      const r = w.blocked[wi] ? ruinAtTile(w, tx, tz) : undefined;
      const ruin = !!r;
      if (r) this.ruin[k] = w.ruins.indexOf(r) + 1;
      // A tree's tile is walkable ground; its trunk is kept clear of in `fits`.
      this.walk[k] = w.ground[wi] !== Ground.Water && !heap && (!w.blocked[wi] || ruin) ? 1 : 0;
      this.tree[k] = tree ? 1 : 0;
      this.opaque[k] = tree || heap ? 1 : 0;
    }
  }
  private at(x: number, z: number, a: Uint8Array): number {
    const i = toTileX(this.w, x) - this.tx0, j = toTileZ(this.w, z) - this.tz0;
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    return a[j * this.n + i];
  }
  walkable(x: number, z: number): boolean { return this.at(x, z, this.walk) === 1; }
  /** Trees and wrecks block sight; a ruin's walls block it unless one end is inside that ruin (a doorway sees in, and out). */
  blocksSight(x: number, z: number, from = 0, to = 0): boolean {
    if (this.at(x, z, this.opaque) === 1) return true;
    const r = this.ruinAt(x, z);
    return r > 0 && r !== from && r !== to;
  }
  /** The ruin a point is in (index + 1), or 0. */
  ruinAt(x: number, z: number): number {
    const i = toTileX(this.w, x) - this.tx0, j = toTileZ(this.w, z) - this.tz0;
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return 0;
    return this.ruin[j * this.n + i];
  }
  /** A person (a little wider than a point) fits here: on walkable ground, clear of tree trunks. */
  fits(x: number, z: number): boolean {
    const e = 0.18;
    if (!(this.walkable(x, z) && this.walkable(x - e, z - e) && this.walkable(x + e, z - e) && this.walkable(x - e, z + e) && this.walkable(x + e, z + e))) return false;
    const ti = toTileX(this.w, x) - this.tx0, tj = toTileZ(this.w, z) - this.tz0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = ti + di, j = tj + dj;
      if (i < 0 || j < 0 || i >= this.n || j >= this.n || !this.tree[j * this.n + i]) continue;
      const cx = tileX(this.w, this.tx0 + i), cz = tileZ(this.w, this.tz0 + j);
      if ((x - cx) ** 2 + (z - cz) ** 2 < 0.62 ** 2) return false;
    }
    return true;
  }
}

const clearOf = (occ: Occupant[], x: number, z: number) => occ.every((o) => Math.hypot(o.x - x, o.z - z) >= o.r);

/** Can a person stand here: on walkable ground, clear of everyone and everything else. */
export function standable(g: VeilGrid, occ: Occupant[], x: number, z: number): boolean {
  return g.fits(x, z) && clearOf(occ, x, z);
}

/** Nothing blocks the view between two points (ruins, wrecks, standing trees). The ends themselves don't count: a doorway sees out. */
export function lineOfSight(g: VeilGrid, a: Pt, b: Pt): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.ceil(d / 0.25);
  const ra = g.ruinAt(a.x, a.z), rb = g.ruinAt(b.x, b.z);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (t * d < 0.6 || (1 - t) * d < 0.6) continue;
    if (g.blocksSight(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, ra, rb)) return false;
  }
  return true;
}

/** A person could walk straight from a to b. */
function walkLine(g: VeilGrid, occ: Occupant[], a: Pt, b: Pt): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.ceil(d / 0.1);
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    if (!g.fits(x, z) || !clearOf(occ, x, z)) return false;
  }
  return true;
}

/** How far each fine cell is from someone, walking. */
export interface ReachField {
  /** World position of cell (0, 0)'s centre. */
  ox: number;
  oz: number;
  /** Cells per side. */
  n: number;
  /** Walking distance to each cell's centre (Infinity: out of reach). */
  dist: Float32Array;
  parent: Int32Array;
  from: Pt;
  max: number;
}

/** Neighbours: [di, dj, cost, then the cells a step must not cut past]. */
const NB: number[][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]
  .map(([di, dj]) => [di, dj, Math.hypot(di, dj) * CELL, ...(di && dj ? [Math.sign(di), 0, 0, Math.sign(dj), Math.trunc(di / 2), Math.trunc(dj / 2)] : [])]);

/** Flood outward from a point, as far as `max`. */
export function reachField(g: VeilGrid, occ: Occupant[], from: Pt, max: number): ReachField {
  const half = Math.ceil(max / CELL) + 2;
  const n = half * 2 + 1;
  const ox = from.x - half * CELL, oz = from.z - half * CELL;
  const dist = new Float32Array(n * n).fill(Infinity);
  const parent = new Int32Array(n * n).fill(-1);
  // Which cells can be stood on, worked out once (the tile lookups are the slow part).
  const free = new Uint8Array(n * n);
  const occ2 = occ.map((o) => [o.x, o.z, o.r * o.r]);
  for (let j = 0; j < n; j++) {
    const z = oz + j * CELL;
    for (let i = 0; i < n; i++) {
      const x = ox + i * CELL;
      if ((i - half) ** 2 + (j - half) ** 2 > (half + 1) ** 2) continue;
      let ok = g.fits(x, z);
      if (ok) for (const [px, pz, r2] of occ2) if ((px - x) ** 2 + (pz - z) ** 2 < r2) { ok = false; break; }
      free[j * n + i] = ok ? 1 : 0;
    }
  }
  // Border cells never count as free, so a step's neighbours need no bounds checks.
  for (let i = 0; i < n; i++) { free[i] = free[n + i] = free[(n - 1) * n + i] = free[(n - 2) * n + i] = 0; }
  for (let j = 0; j < n; j++) { free[j * n] = free[j * n + 1] = free[j * n + n - 1] = free[j * n + n - 2] = 0; }
  // Each neighbour as index offsets: the step itself, then the cells it must not cut past.
  const steps = NB.map((nb) => ({ o: nb[1] * n + nb[0], c: nb[2], cut: nb.length > 3 ? [nb[4] * n + nb[3], nb[6] * n + nb[5], nb[8] * n + nb[7]] : null }));
  // A binary heap of cell indices keyed by distance.
  let hk = new Int32Array(1024), hd = new Float32Array(1024), hn = 0;
  const push = (k: number, d: number) => {
    if (hn >= hk.length) { const a = new Int32Array(hk.length * 2); a.set(hk); hk = a; const b = new Float32Array(hd.length * 2); b.set(hd); hd = b; }
    let i = hn++;
    while (i > 0) { const p = (i - 1) >> 1; if (hd[p] <= d) break; hk[i] = hk[p]; hd[i] = hd[p]; i = p; }
    hk[i] = k; hd[i] = d;
  };
  const pop = () => {
    const top = hk[0], lk = hk[--hn], ld = hd[hn];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= hn) break;
      if (c + 1 < hn && hd[c + 1] < hd[c]) c++;
      if (hd[c] >= ld) break;
      hk[i] = hk[c]; hd[i] = hd[c]; i = c;
    }
    hk[i] = lk; hd[i] = ld;
    return top;
  };
  const s = half * n + half;
  dist[s] = 0; free[s] = 1;
  push(s, 0);
  while (hn) {
    const hdTop = hd[0];
    const k = pop();
    const d = dist[k];
    if (hdTop > d) continue; // a stale entry
    for (const st of steps) {
      const nk = k + st.o;
      if (!free[nk]) continue;
      // Long steps and diagonals may not cut a blocked corner.
      if (st.cut && (!free[k + st.cut[0]] || !free[k + st.cut[1]] || !free[k + st.cut[2]])) continue;
      const nd = d + st.c;
      if (nd > max || nd >= dist[nk]) continue;
      dist[nk] = nd; parent[nk] = k; push(nk, nd);
    }
  }
  return { ox, oz, n, dist, parent, from, max };
}

function cellOf(f: ReachField, x: number, z: number): number {
  const i = Math.round((x - f.ox) / CELL), j = Math.round((z - f.oz) / CELL);
  if (i < 0 || j < 0 || i >= f.n || j >= f.n) return -1;
  return j * f.n + i;
}

/** Walking distance to a point (Infinity if out of reach). */
export function distAt(f: ReachField, x: number, z: number): number {
  const k = cellOf(f, x, z);
  if (k < 0) return Infinity;
  const i = k % f.n, j = (k - i) / f.n;
  // The last bit, from the cell's centre to the point itself.
  return f.dist[k] + Math.hypot(x - (f.ox + i * CELL), z - (f.oz + j * CELL));
}

/** The way there, pulled taut: from the start to the point, turning only where it must. */
export function pathTo(f: ReachField, g: VeilGrid, occ: Occupant[], x: number, z: number): Pt[] | null {
  let k = cellOf(f, x, z);
  if (k < 0 || !isFinite(f.dist[k])) return null;
  const raw: Pt[] = [{ x, z }];
  while (k >= 0 && f.parent[k] >= 0) {
    k = f.parent[k];
    const i = k % f.n, j = (k - i) / f.n;
    raw.push({ x: f.ox + i * CELL, z: f.oz + j * CELL });
  }
  raw.push(f.from);
  raw.reverse();
  const out: Pt[] = [raw[0]];
  let at = 0;
  while (at < raw.length - 1) {
    let next = at + 1;
    for (let j = raw.length - 1; j > at + 1; j--) if (walkLine(g, occ, raw[at], raw[j])) { next = j; break; }
    out.push(raw[next]);
    at = next;
  }
  return out;
}

export const pathLength = (p: Pt[]) => p.reduce((s, q, i) => (i ? s + Math.hypot(q.x - p[i - 1].x, q.z - p[i - 1].z) : 0), 0);

/** Every reachable cell centre, with its distance (for choosing where to go). */
export function* cells(f: ReachField): Generator<{ x: number; z: number; d: number }> {
  for (let k = 0; k < f.dist.length; k++) {
    const d = f.dist[k];
    if (!isFinite(d)) continue;
    const i = k % f.n, j = (k - i) / f.n;
    yield { x: f.ox + i * CELL, z: f.oz + j * CELL, d };
  }
}
