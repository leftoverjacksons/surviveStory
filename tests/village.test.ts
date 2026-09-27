import { describe, expect, it } from 'vitest';
import { createCommunity, killSurvivor } from '../src/sim/community';
import { createColony, tick, type Colony } from '../src/sim/colony';
import { bedsTotal, footTiles, hasBuilt, store } from '../src/sim/buildings';
import { knowers, knowhowDaily } from '../src/sim/purpose';
import { generateWorld } from '../src/sim/worldgen';
import { Zone, idx, inZone, paintZone, toTileX, toTileZ } from '../src/sim/world';

function runDays(col: Colony, days: number) {
  for (let m = 0; m < days * 1440; m += 10) tick(col, 10);
}

describe('village', () => {
  it('starts with a home zone around the fire and nothing on the far map', () => {
    const w = generateWorld(5);
    expect(inZone(w, toTileX(w, 0), toTileZ(w, 0))).toBe(true);
    expect(inZone(w, toTileX(w, 60), toTileZ(w, 60))).toBe(false);
  });

  it('only zones explored land', () => {
    const w = generateWorld(5);
    paintZone(w, 90, 90, 3, Zone.Home);
    expect(inZone(w, toTileX(w, 90), toTileZ(w, 90))).toBe(false);
  });

  it('moves into the old store first', () => {
    const col = createColony(generateWorld(9), createCommunity(9));
    expect(col.village.projects[0].kind).toBe('clear_store');
    runDays(col, 2);
    expect(store(col.village).level).toBeGreaterThanOrEqual(1);
    expect(bedsTotal(col.village)).toBeGreaterThanOrEqual(4);
  });

  const col = createColony(generateWorld(31), createCommunity(31));
  runDays(col, 16);
  const v = col.village;

  it('grows: kitchen, garden, workshop, and enough beds for everyone', () => {
    const kinds = new Set(v.buildings.map((b) => b.kind));
    for (const k of ['kitchen', 'garden', 'workshop']) expect(kinds.has(k as never)).toBe(true);
    expect(bedsTotal(v)).toBeGreaterThanOrEqual(col.agents.length - 1);
  });

  it('builds only inside the home zone, without overlapping', () => {
    const seen = new Set<number>();
    for (const b of v.buildings) {
      if (b.kind === 'store' || b.kind === 'kitchen' || b.kind === 'annex') continue;
      for (const [tx, tz] of footTiles(b.foot)) {
        expect(inZone(col.world, tx, tz)).toBe(true);
        const i = idx(col.world, tx, tz);
        expect(seen.has(i)).toBe(false);
        seen.add(i);
      }
    }
  });

  it('builds in timber only when someone knows joinery and there is a workbench', () => {
    expect(hasBuilt(v, 'workshop')).toBe(true);
    const living = col.community.survivors.filter((s) => s.alive);
    const saved = living.map((s) => s.skills);
    for (const s of living) s.skills = {};
    knowhowDaily(col);
    expect(v.tier).toBe(0);
    living[0].skills = { joinery: 0.6 };
    knowhowDaily(col);
    expect(v.tier).toBe(1);
    living.forEach((s, i) => { s.skills = saved[i]; });
    knowhowDaily(col);
  });

  it('forgets joinery if everyone who knew it is gone', () => {
    const lost = createColony(generateWorld(31), createCommunity(31));
    runDays(lost, 16);
    for (const s of knowers(lost.community, 'joinery')) killSurvivor(lost.community, s.id, 'a fall');
    knowhowDaily(lost);
    expect(lost.village.tier).toBe(0);
  });

  it('never leaves materials half-promised', () => {
    for (const p of v.projects) {
      if (p.done) continue;
      for (const m of ['wood', 'scrap', 'glimmer'] as const) expect(p.incoming[m]).toBeGreaterThanOrEqual(0);
    }
    expect(col.community.resources.scrap).toBeGreaterThanOrEqual(0);
    expect(col.community.resources.wood).toBeGreaterThanOrEqual(0);
  });
});
