/**
 * Keeping trees out of buildings. Every building (finished or planned) is an
 * oriented box up to its ridge; a tree whose canopy reaches into one has the
 * offending leaf clumps shrunk, nudged outward, or dropped, so it grows
 * around the house instead of through it. Built from the simulation's plans,
 * so a canopy already makes room while the walls are going up.
 */
import { houseAxes } from '../sim/homes';
import { footCenter, type Village } from '../sim/buildings';
import { heightAt, type World } from '../sim/world';

export interface Obstacle {
  cx: number; cz: number;
  /** Unit axes of the box in world x/z. */
  ax: number; az: number; bx: number; bz: number;
  hw: number; hd: number;
  y0: number; y1: number;
}

/** Height (above ground) of each kind of building, ridge included. */
const TOP: Partial<Record<string, number>> = {
  annex: 3.1, hut: 3.5, workshop: 3.7, kitchen: 3.3, cellar: 1.6, shrine: 2.6, fishhut: 3.3, netshed: 2.9, garden: 0.9, upgrade: 3.7,
};

function box(w: World, cx: number, cz: number, yaw: number, hw: number, hd: number, top: number): Obstacle {
  const { X, Z } = houseAxes(yaw);
  const y0 = heightAt(w, cx, cz) - 0.5;
  return { cx, cz, ax: X.x, az: X.z, bx: Z.x, bz: Z.z, hw, hd, y0, y1: y0 + 0.5 + top };
}

export function obstaclesFor(w: World, v: Village): Obstacle[] {
  const out: Obstacle[] = [];
  const S = v.site.shelter;
  const span = v.site.ridge === 'x' ? S.d : S.w;
  out.push(box(w, S.x, S.z, 0, S.w / 2 + 0.4, S.d / 2 + 0.4, S.h + (v.site.roof === 'gable' ? (span / 2) * Math.tan(v.site.pitch) : 0) + 0.4));
  const home = (plotId: number | undefined) => {
    const plot = v.plots.find((p) => p.id === plotId);
    if (!plot) return;
    const s = plot.house;
    const along = s.ridge === 'along';
    const rise = ((along ? s.D : s.W) / 2) * Math.tan(s.pitch);
    const eave = 0.45;
    out.push(box(w, plot.hc.x, plot.hc.z, plot.yaw, s.W / 2 + eave, s.D / 2 + eave, s.wall + 0.24 + rise + 0.4));
    if (s.wing) {
      const { X, Z } = houseAxes(plot.yaw);
      const wx = s.wing.side * (s.W / 2 - s.wing.w / 2), wz = -(s.D / 2 + s.wing.d / 2);
      out.push(box(w, plot.hc.x + X.x * wx + Z.x * wz, plot.hc.z + X.z * wx + Z.z * wz, plot.yaw,
        s.wing.w / 2 + eave, s.wing.d / 2 + eave, s.wall + rise * 0.8 + 0.2));
    }
  };
  const foot = (kind: string, f: { tx: number; tz: number; w: number; d: number }) => {
    const top = TOP[kind];
    if (top === undefined) return;
    const c = footCenter(w, f);
    out.push(box(w, c.x, c.z, 0, f.w / 2 + 0.25, f.d / 2 + 0.25, top));
  };
  for (const b of v.buildings) {
    if (b.kind === 'store') continue;
    if (b.kind === 'home') home(b.plot);
    else if (b.kind === 'kitchen') out.push(box(w, v.site.kitchen.x, v.site.kitchen.z, 0, 1.9, 1.9, TOP.kitchen!));
    else foot(b.kind, b.foot);
  }
  for (const p of v.projects) {
    if (p.done) continue;
    if (p.kind === 'home') home(p.plot);
    else if (p.kind === 'kitchen') out.push(box(w, v.site.kitchen.x, v.site.kitchen.z, 0, 1.9, 1.9, TOP.kitchen!));
    else foot(p.kind, p.foot);
  }
  return out;
}

/** A key that changes whenever the set of obstacles does. */
export function obstacleKey(v: Village): string {
  return `${v.buildings.length}:${v.buildings.map((b) => b.id).join(',')}|${v.projects.filter((p) => !p.done).map((p) => p.id).join(',')}`;
}

/** Nearest point of obstacle `o` to (x, y, z); returns the offset from it and its length. */
function gap(o: Obstacle, x: number, y: number, z: number) {
  const dx = x - o.cx, dz = z - o.cz;
  const lx = dx * o.ax + dz * o.az, lz = dx * o.bx + dz * o.bz;
  const qx = Math.max(-o.hw, Math.min(o.hw, lx)), qz = Math.max(-o.hd, Math.min(o.hd, lz));
  const qy = Math.max(o.y0, Math.min(o.y1, y));
  const ex = lx - qx, ez = lz - qz, ey = y - qy;
  // Offset back in world axes (horizontal only; vertical is handled by the caller).
  return { d: Math.hypot(ex, ey, ez), hx: ex * o.ax + ez * o.bx, hz: ex * o.az + ez * o.bz, inside: ex === 0 && ez === 0, lx, lz };
}

/** Is a trunk base standing inside (or right against) an obstacle? */
export function trunkBlocked(obs: Obstacle[], x: number, z: number): boolean {
  for (const o of obs) {
    const dx = x - o.cx, dz = z - o.cz;
    if (Math.abs(dx * o.ax + dz * o.az) < o.hw + 0.15 && Math.abs(dx * o.bx + dz * o.bz) < o.hd + 0.15) return true;
  }
  return false;
}

/**
 * Fit a leaf clump (a sphere at p with radius r, or for pines a cone that
 * only needs horizontal room) around the obstacles near it. Mutates p and
 * returns the new radius factor (1 = untouched, 0 = drop the clump).
 */
export function fitClump(obs: Obstacle[], p: { x: number; y: number; z: number }, r: number, trunk: { x: number; z: number }): number {
  let k = 1;
  for (let pass = 0; pass < 3; pass++) {
    let worst: { o: Obstacle; g: ReturnType<typeof gap> } | null = null;
    for (const o of obs) {
      // Cheap reject: far away.
      if (Math.abs(p.x - o.cx) > o.hw + o.hd + r + 1 || Math.abs(p.z - o.cz) > o.hw + o.hd + r + 1) continue;
      const g = gap(o, p.x, p.y, p.z);
      if (g.d < r * k && (!worst || g.d < worst.g.d)) worst = { o, g };
    }
    if (!worst) return k;
    const { o, g } = worst;
    // First try shrinking the clump down to the gap.
    const shrunk = Math.max(0.55, g.d / r);
    if (g.d >= r * 0.55) return Math.min(k, shrunk * 0.97);
    // Too close: slide it outward, away from the building (towards the trunk's side).
    let nx = g.hx, nz = g.hz;
    if (Math.hypot(nx, nz) < 1e-3) {
      // Centre is above or inside the box: push along the side the trunk stands on.
      const tx = trunk.x - o.cx, tz = trunk.z - o.cz;
      const tlx = tx * o.ax + tz * o.az, tlz = tx * o.bx + tz * o.bz;
      const ux = Math.abs(tlx) / o.hw > Math.abs(tlz) / o.hd ? Math.sign(tlx) || 1 : 0;
      const uz = ux === 0 ? Math.sign(tlz) || 1 : 0;
      nx = ux * o.ax + uz * o.bx; nz = ux * o.az + uz * o.bz;
      // Distance to the wall along that side.
      const need = ux !== 0 ? o.hw - Math.abs(g.lx) : o.hd - Math.abs(g.lz);
      const len = Math.hypot(nx, nz) || 1;
      const move = need + r * 0.6;
      if (move > 2.2) return 0;
      p.x += (nx / len) * move; p.z += (nz / len) * move;
      k = Math.min(k, 0.6);
      continue;
    }
    const len = Math.hypot(nx, nz);
    const move = r * 0.6 - g.d + 0.05;
    if (move > 2.2) return 0;
    p.x += (nx / len) * move; p.z += (nz / len) * move;
    k = Math.min(k, 0.6);
  }
  // Still overlapping after three tries: drop it.
  for (const o of obs) if (gap(o, p.x, p.y, p.z).d < r * k * 0.9) return 0;
  return k;
}

/** Does a sphere reach into any obstacle? */
export function clumpOverlaps(obs: Obstacle[], p: { x: number; y: number; z: number }, r: number): boolean {
  for (const o of obs) if (gap(o, p.x, p.y, p.z).d < r) return true;
  return false;
}
