import { describe, expect, it } from 'vitest';
import { adjustBond, alive, createCommunity } from '../src/sim/community';
import { createColony, tick, type Colony } from '../src/sim/colony';
import { findPlot, householdOf, householdsDaily, houseContains, pointInPoly, PAIR_BOND } from '../src/sim/homes';
import { Rng } from '../src/sim/rng';
import { generateWorld } from '../src/sim/worldgen';
import { idx, inZone, passable, tileX, tileZ, toTileX, toTileZ } from '../src/sim/world';

const runDays = (col: Colony, days: number) => { for (let m = 0; m < days * 1440; m += 10) tick(col, 10); };

describe('households', () => {
  it('forms from close pairs, and not from strangers', () => {
    const col = createColony(generateWorld(3), createCommunity(3));
    const [a, b, c] = alive(col.community);
    for (const s of alive(col.community)) for (const o of alive(col.community)) if (s.id < o.id) adjustBond(col.community, s.id, o.id, -200);
    adjustBond(col.community, a.id, b.id, 200);
    col.community.day = 5;
    householdsDaily(col);
    const h = householdOf(col.village, a.id);
    expect(h?.members.sort()).toEqual([a.id, b.id].sort());
    expect(householdOf(col.village, c.id)).toBeUndefined();
    expect(PAIR_BOND).toBeGreaterThan(0);
  });
});

describe('plots', () => {
  const w = generateWorld(8);
  const col = createColony(w, createCommunity(8));
  const plan = findPlot(w, col.village, 3, new Rng(4))!;

  it('finds room for a plot on home ground', () => {
    expect(plan).not.toBeNull();
    for (const i of plan.plot.tiles) expect(inZone(w, i % w.w, (i / w.w) | 0)).toBe(true);
    expect(plan.plot.tiles.length).toBeGreaterThan(40);
  });

  it('is not a rectangle', () => {
    const [fl, fr, br, bl] = plan.plot.corners;
    const front = Math.hypot(fr.x - fl.x, fr.z - fl.z), back = Math.hypot(br.x - bl.x, br.z - bl.z);
    const left = Math.hypot(bl.x - fl.x, bl.z - fl.z), right = Math.hypot(br.x - fr.x, br.z - fr.z);
    expect(Math.abs(front - back) + Math.abs(left - right)).toBeGreaterThan(0.05);
  });

  it('puts the whole house on the plot', () => {
    const p = plan.plot;
    for (const i of plan.houseTiles) {
      const pt = { x: tileX(w, i % w.w), z: tileZ(w, (i / w.w) | 0) };
      expect(pointInPoly(pt, p.corners)).toBe(true);
      expect(houseContains(p.house, p.hc, p.yaw, pt, 0.3)).toBe(true);
    }
  });
});

describe('homes', () => {
  const col = createColony(generateWorld(21), createCommunity(21));
  const [a, b] = alive(col.community);
  adjustBond(col.community, a.id, b.id, 200);
  runDays(col, 24);
  const v = col.village;
  const homes = v.buildings.filter((x) => x.kind === 'home');

  it('builds a home for a household', () => {
    expect(v.households.length).toBeGreaterThan(0);
    expect(homes.length).toBeGreaterThan(0);
  });

  it('the household sleeps at home, and its door is reachable', () => {
    const home = homes[0];
    const h = v.households.find((x) => x.id === home.household)!;
    expect(h).toBeDefined();
    for (const m of h.members) expect(col.beds.get(m)).toBe(home.id);
    expect(passable(col.world, toTileX(col.world, home.door.x), toTileZ(col.world, home.door.z))).toBe(true);
    const plot = v.plots.find((p) => p.id === home.plot)!;
    expect(col.world.blocked[idx(col.world, toTileX(col.world, plot.hc.x), toTileZ(col.world, plot.hc.z))]).toBe(1);
  });

  it('improves the yard over time', () => {
    const done = v.plots.reduce((n, p) => n + p.yard.filter((y) => y.progress >= 1).length, 0);
    expect(done).toBeGreaterThan(0);
  });

  it('keeps plots from overlapping', () => {
    const seen = new Set<number>();
    for (const p of v.plots) for (const i of p.tiles) { expect(seen.has(i)).toBe(false); seen.add(i); }
  });
});

describe('meals', () => {
  it('nobody goes hungry while the stores hold plenty', () => {
    const col = createColony(generateWorld(2), createCommunity(2));
    let starving = 0;
    // Someone led off by the Folk goes hungry until they're home again: not the stores' fault.
    const led = new Map<number, number>();
    for (let m = 0; m < 30 * 1440; m += 10) {
      tick(col, 10);
      if (col.folk.led) led.set(col.folk.led.id, col.minute);
      if (col.community.resources.food < col.agents.length * 3) continue;
      for (const a of col.agents) if (a.needs.food <= 0 && col.minute - (led.get(a.id) ?? -1e9) > 360) starving++;
    }
    expect(starving).toBe(0);
  }, 30000); // thirty simulated days: slow under load
});
