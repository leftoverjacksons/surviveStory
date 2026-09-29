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
  it('the found shelter stays', () => {
    const col = createColony(generateWorld(2), createCommunity(2));
    expect(whyNotTakeDown(col, store(col.village))).toMatch(/shelter/);
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
