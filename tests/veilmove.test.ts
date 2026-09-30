import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { BESIDE, approachPoint, endTurn, gridOf, moveOf, moveUnit, occupantsFor, reachOf, spiritAt, startClearing, threatsAt, walkCost, type Clearing } from '../src/sim/haunt';
import { cells, distAt, lineOfSight, standable } from '../src/sim/veilmove';
import { tileX, tileZ } from '../src/sim/world';

function clearing(seed: number, kind = 'suburb') {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  for (const p of col.world.pois) p.discovered = true;
  col.veil.influence += 40;
  const hi = col.haunts.findIndex((h) => col.world.districts[h.district].kind === kind);
  const cl = startClearing(col, hi, alive(col.community).slice(0, 3).map((s) => s.id)) as Clearing;
  return { col, cl };
}

describe('free movement in the Veil (DESIGN §38.10)', () => {
  it('reach is a walking distance, close to a circle on open ground', () => {
    const { col, cl } = clearing(3);
    const u = cl.units[0];
    const r = reachOf(col, cl, u)!;
    expect(r.outer).toBeCloseTo(moveOf(u) * 2);
    expect(r.inner).toBeCloseTo(moveOf(u));
    // Well clear of the others (right beside someone, the fine grid's steps make a small detour).
    const g = gridOf(col, cl), occ = occupantsFor(col, cl, u).map((o) => ({ ...o, r: o.r + 0.35 }));
    const clearWalk = (c: { x: number; z: number }) => {
      const n = Math.ceil(Math.hypot(c.x - u.x, c.z - u.z) / 0.1);
      for (let i = 1; i <= n; i++) if (!standable(g, occ, u.x + ((c.x - u.x) * i) / n, u.z + ((c.z - u.z) * i) / n)) return false;
      return true;
    };
    let open = 0, worst = 0;
    for (const c of cells(r.field)) {
      const straight = Math.hypot(c.x - u.x, c.z - u.z);
      // Walking is never shorter than the straight line, and never beyond the outer ring.
      expect(c.d).toBeGreaterThanOrEqual(straight - 1e-3);
      expect(c.d).toBeLessThanOrEqual(r.outer + 1e-3);
      if (c.d < 3 && straight > 1 && clearWalk(c)) { open++; worst = Math.max(worst, c.d / straight); }
    }
    expect(open).toBeGreaterThan(50);
    // Sixteen neighbours: within a few per cent of the straight line where nothing is in the way.
    expect(worst).toBeLessThan(1.08);
  });

  it('one action inside the inner ring, the whole turn out to the outer, nothing beyond', () => {
    const { col, cl } = clearing(5);
    const u = cl.units[0];
    const r = reachOf(col, cl, u)!;
    const near = [...cells(r.field)].find((c) => c.d > 1.5 && c.d < r.inner - 0.3)!;
    const far = [...cells(r.field)].find((c) => c.d > r.inner + 0.5)!;
    expect(walkCost(r, near.x, near.z, u.ap)).toBe(1);
    expect(walkCost(r, far.x, far.z, u.ap)).toBe(2);
    expect(walkCost(r, u.x + r.outer + 3, u.z, u.ap)).toBeNull();
    expect(moveUnit(col, cl, u.id, u.x + r.outer + 3, u.z)).toMatch(/Too far/);
    const start = { x: u.x, z: u.z };
    expect(moveUnit(col, cl, u.id, near.x, near.z)).toBeNull();
    expect(u.ap).toBe(1);
    expect(u.x).toBeCloseTo(near.x);
    // The way they walked starts where they stood and is pulled taut.
    expect(u.trail![0]).toEqual(start);
    expect(u.trail!.length).toBeLessThanOrEqual(4);
    // With one action left, only the inner ring remains.
    const r2 = reachOf(col, cl, u)!;
    expect(r2.outer).toBeCloseTo(moveOf(u));
    expect(r2.inner).toBe(0);
  });

  it('nobody stands on a spirit or on each other', () => {
    const { col, cl } = clearing(7);
    const [a, b] = cl.units;
    expect(moveUnit(col, cl, a.id, b.x, b.z)).toMatch(/room|far/);
    const s = col.haunts[cl.haunt].spirits.find((x) => x.fate === 'present')!;
    const p = spiritAt(col, s);
    const r = reachOf(col, cl, a)!;
    if (isFinite(distAt(r.field, p.x, p.z))) expect(moveUnit(col, cl, a.id, p.x, p.z)).toMatch(/room/);
  });

  it('walking up to a spirit ends beside it', () => {
    const { col, cl } = clearing(11);
    const u = cl.units[0];
    const s = col.haunts[cl.haunt].spirits.filter((x) => x.fate === 'present').sort((p, q) => Math.hypot(tileX(col.world, p.tx) - u.x, tileZ(col.world, p.tz) - u.z) - Math.hypot(tileX(col.world, q.tx) - u.x, tileZ(col.world, q.tz) - u.z))[0];
    for (let i = 0; i < 6 && u.ap > 0; i++) {
      const p = approachPoint(col, cl, u, spiritAt(col, s));
      if (!p) break;
      expect(moveUnit(col, cl, u.id, p.x, p.z)).toBeNull();
      if (u.ap === 0) { endTurn(col, cl); if (cl.outcome || u.state !== 'in') return; }
    }
    expect(Math.hypot(spiritAt(col, s).x - u.x, spiritAt(col, s).z - u.z)).toBeLessThanOrEqual(BESIDE);
  });

  it('the walk preview names the spirits that would reach them there', () => {
    const { col, cl } = clearing(3);
    const u = cl.units[0];
    const hollow = col.haunts[cl.haunt].spirits.find((x) => x.kind === 'hollow')!;
    hollow.known = 1;
    const p = spiritAt(col, hollow);
    expect(threatsAt(col, cl, u, p.x + 2, p.z).some((t) => t.spirit === hollow && t.threat === 'dread')).toBe(true);
    expect(threatsAt(col, cl, u, p.x + 12, p.z).some((t) => t.spirit === hollow)).toBe(false);
  });

  it('walls and wrecks block sight', () => {
    const { col, cl } = clearing(3);
    const g = gridOf(col, cl), w = col.world;
    const heap = w.heaps.find((h) => g.blocksSight(tileX(w, h.tx), tileZ(w, h.tz)) && !g.blocksSight(tileX(w, h.tx) - 2, tileZ(w, h.tz)) && !g.blocksSight(tileX(w, h.tx) + 2, tileZ(w, h.tz)));
    if (!heap) return;
    const x = tileX(w, heap.tx), z = tileZ(w, heap.tz);
    expect(lineOfSight(g, { x: x - 2, z }, { x: x + 2, z })).toBe(false);
  });
});
