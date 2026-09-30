import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { cancelProject, takeDown, whyNotTakeDown } from '../src/sim/dismantle';
import { DEFS, store } from '../src/sim/buildings';
import { idx } from '../src/sim/world';

/** A village left to plan for itself until it has finished a building that can come down. */
function grown(seed = 2): Colony {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  col.village.autoPlan = true;
  for (let d = 0; d < 20 && !col.village.buildings.some((b) => b.kind === 'workshop' || b.kind === 'hut' || b.kind === 'cellar'); d++) tick(col, 1440);
  return col;
}
const target = (col: Colony) => col.village.buildings.find((b) => b.kind === 'workshop' || b.kind === 'hut' || b.kind === 'cellar')!;

describe('taking down, moving and calling off (DESIGN §24.13)', () => {
  it('the found shelter can be pulled down too (DESIGN §29)', () => {
    const col = createColony(generateWorld(2), createCommunity(2));
    expect(whyNotTakeDown(col, store(col.village))).toBeNull();
  });

  it('a building taken down is gone, its ground is free, and half of it comes back', () => {
    const col = grown(), b = target(col);
    expect(b).toBeTruthy();
    const cost = (DEFS as Record<string, { cost: { wood: number }[] }>)[b.kind].cost[b.tier];
    const tile = idx(col.world, b.foot.tx, b.foot.tz);
    expect(takeDown(col, b)).toBeNull();
    expect(takeDown(col, b)).toMatch(/already/);
    let gone = false;
    for (let h = 0; h < 72 && !gone; h++) { tick(col, 60); gone = !col.village.buildings.includes(b); }
    expect(gone).toBe(true);
    expect(col.world.blocked[tile]).toBe(0);
    expect(col.community.log.some((l) => l.text.startsWith(`${b.name} is down`))).toBe(true);
    // Half the wood came back (other work moves wood too, so check the log's figure).
    const half = Math.floor(cost.wood * 0.5);
    if (half > 0) expect(col.community.log.some((l) => l.text.includes(`${half} wood`))).toBe(true);
  });

  it('moving brings everything back', () => {
    const col = grown(), b = target(col);
    const cost = (DEFS as Record<string, { cost: { wood: number }[] }>)[b.kind].cost[b.tier];
    expect(takeDown(col, b, true)).toBeNull();
    for (let h = 0; h < 72 && col.village.buildings.includes(b); h++) tick(col, 60);
    expect(col.village.buildings.includes(b)).toBe(false);
    if (cost.wood > 0) expect(col.community.log.some((l) => l.text.includes(`${cost.wood} wood`))).toBe(true);
  });

  it('a project called off gives back what was delivered', () => {
    const col = createColony(generateWorld(3), createCommunity(3));
    col.village.autoPlan = true;
    let p = col.village.projects.find((x) => !x.done && x.kind !== 'home' && x.kind !== 'clear_store' && x.kind !== 'patch_roof' && x.delivered.wood + x.delivered.scrap > 0);
    for (let h = 0; h < 24 * 12 && !p; h++) {
      tick(col, 60);
      p = col.village.projects.find((x) => !x.done && x.kind !== 'home' && x.kind !== 'clear_store' && x.kind !== 'patch_roof' && x.delivered.wood + x.delivered.scrap > 0);
    }
    expect(p).toBeTruthy();
    const r = col.community.resources, before = r.wood + r.scrap, back = p!.delivered.wood + p!.delivered.scrap;
    expect(cancelProject(col, p!)).toBeNull();
    expect(r.wood + r.scrap).toBe(before + back);
    expect(col.village.projects.includes(p!)).toBe(false);
  });
});

describe('everything can be moved or taken down (DESIGN §27)', () => {
  it('a lived-in home can come down: the family waits first in line for a new plot', async () => {
    const { finishTakedown } = await import('../src/sim/dismantle');
    const col = createColony(generateWorld(2), createCommunity(2));
    col.village.autoPlan = true;
    let home;
    for (let d = 0; d < 40 && !(home = col.village.buildings.find((b) => b.kind === 'home' && col.village.households.some((h) => h.home === b.id))); d++) tick(col, 1440);
    expect(home).toBeTruthy();
    const h = col.village.households.find((x) => x.home === home!.id)!;
    expect(whyNotTakeDown(col, home!, true)).toBeNull();
    expect(takeDown(col, home!, true)).toBeNull();
    const t = col.village.takedowns!.find((x) => x.building === home!.id)!;
    finishTakedown(col, t);
    expect(col.village.buildings.includes(home!)).toBe(false);
    expect(h.home).toBe(0);
    expect(col.village.homeQueue[0]).toBe(h.id);
    expect(col.village.plots.some((p) => p.id === home!.plot)).toBe(false);
  }, 120000);

  it('the kitchen can be placed somewhere else, and stands where it is placed', async () => {
    const { placeProject, footCenter } = await import('../src/sim/buildings');
    const col = createColony(generateWorld(2), createCommunity(2));
    const v = col.village, w = col.world;
    // Anywhere it fits, near the fire.
    let placed: unknown = 'none';
    for (let r = 6; r < 20 && typeof placed === 'string'; r++) for (let k = 0; k < 16 && typeof placed === 'string'; k++) {
      const x = w.campfire.x + Math.cos(k) * r, z = w.campfire.z + Math.sin(k) * r;
      placed = placeProject(w, v, col.community, 'kitchen', { tx: Math.floor(x + w.w / 2), tz: Math.floor(z + w.h / 2), w: 4, d: 2 }, 0);
    }
    expect(typeof placed).not.toBe('string');
    const p = placed as { foot: { tx: number; tz: number; w: number; d: number } };
    expect(v.site.kitchen).toEqual(footCenter(w, p.foot));
    expect(v.site.kitchenCovered).toBe(false);
  });
});
