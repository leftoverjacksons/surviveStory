import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import type { Building } from '../src/sim/buildings';
import { finishBatch, needRows, needTier, pickTrade, toolFactor, tradesDaily } from '../src/sim/trades';

function bench(col: ReturnType<typeof createColony>, kind: Building['kind']): Building {
  const b: Building = {
    id: col.village.nextId++, kind, tier: 0, foot: { tx: 0, tz: 0, w: 3, d: 3 }, facing: 0, door: { x: 0, z: 0 }, inside: { x: 0, z: 0 },
    beds: 0, level: 0, tended: 0, growth: 0, name: kind,
  } as Building;
  col.village.buildings.push(b);
  return b;
}

describe('the trades (DESIGN §21.6)', () => {
  it('a batch turns materials into goods, and the bench most needed is worked first', () => {
    const col = createColony(generateWorld(3), createCommunity(3));
    const r = col.community.resources;
    const tools = bench(col, 'toolshop'), sewing = bench(col, 'tailor');
    r.scrap = 10; r.wood = 40; r.cloth = 10; r.tools = 20; r.clothes = 0;
    expect(pickTrade(col, new Set())?.id).toBe(sewing.id);
    const before = { ...r };
    expect(finishBatch(col, sewing, 'Ada')).toBe(true);
    expect(r.cloth).toBe(before.cloth - 2);
    expect(r.clothes).toBe(1);
    r.cloth = 0;
    // Without cloth the sewing room waits; the tool bench is next if tools are short.
    r.tools = 0;
    expect(pickTrade(col, new Set())?.id).toBe(tools.id);
    expect(finishBatch(col, tools, 'Ada')).toBe(true);
    expect(r.scrap).toBe(8);
    // Firewood is never burned at the bench when the pile is low.
    r.wood = 3;
    expect(pickTrade(col, new Set())).toBeNull();
  });

  it('tools speed work, clothes wear, and preserves are opened in lean times', () => {
    const col = createColony(generateWorld(4), createCommunity(4));
    const r = col.community.resources;
    r.tools = 0;
    expect(toolFactor(col, 'builder')).toBe(1);
    r.tools = 20;
    expect(toolFactor(col, 'builder')).toBeCloseTo(1.25);
    expect(toolFactor(col, 'scout')).toBe(1);
    r.clothes = 10; r.food = 1; r.preserves = 30;
    tradesDaily(col);
    expect(r.clothes).toBeLessThan(10);
    expect(r.food).toBeGreaterThan(1);
    expect(r.preserves).toBeLessThan(30);
  });

  it('needs come in tiers', () => {
    const col = createColony(generateWorld(5), createCommunity(5));
    const r = col.community.resources;
    r.food = 0; r.preserves = 0;
    expect(needTier(col)).toBe(0);
    r.food = 200; r.wood = 50;
    const rows = needRows(col);
    const shelter = rows.find((x) => x.id === 'shelter')!.met;
    expect(needTier(col)).toBe(shelter ? 1 : 0);
    expect(rows.filter((x) => x.tier === 2).length).toBe(4);
  });

  it('a growing village takes up the trades by itself and makes goods', () => {
    const col = createColony(generateWorld(5), createCommunity(5));
    col.community.resources.wood += 60; col.community.resources.scrap += 30;
    let made = 0, tier = 0;
    for (let d = 0; d < 40; d++) {
      const r0 = { ...col.community.resources };
      tick(col, 1440);
      tier = Math.max(tier, col.village.needTier ?? 0);
      const r = col.community.resources;
      made += Math.max(0, r.preserves - r0.preserves) + Math.max(0, r.tools - r0.tools) + Math.max(0, r.clothes - r0.clothes);
    }
    const v = col.village;
    expect(v.buildings.filter((b) => ['toolshop', 'tailor', 'smokehouse'].includes(b.kind)).length).toBeGreaterThan(0);
    expect(alive(col.community).some((s) => s.role === 'maker')).toBe(true);
    expect(made).toBeGreaterThan(5);
    // It reaches the next tier (a cold week can drop it back a day; that's the tiers working).
    expect(tier).toBeGreaterThanOrEqual(1);
  }, 120000);
});
