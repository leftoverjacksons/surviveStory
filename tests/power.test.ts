import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony, gainFood } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { MILL_BONUS, learnWiring, millFactor, powerDemand, powerSupply, powered, whyNotPower } from '../src/sim/power';

const fresh = (seed = 3) => createColony(generateWorld(seed), createCommunity(seed));
const put = (col: ReturnType<typeof fresh>, kind: 'windmill' | 'solar' | 'turbine') =>
  col.village.buildings.push({ id: col.village.nextId++, kind, tier: 0, foot: { tx: 0, tz: 0, w: 2, d: 2 }, facing: 0, door: { x: 0, z: 0 }, inside: { x: 0, z: 0 }, beds: 0, level: 0, tended: 0, growth: 0, name: kind });

describe('power from know-how (DESIGN §24.17)', () => {
  it('panels and turbines wait on someone who knows wiring; stripping salvage teaches it', () => {
    const col = fresh();
    expect(whyNotPower(col, 'solar')).toMatch(/wiring/);
    const s = alive(col.community)[0];
    for (let k = 0; k < 9; k++) learnWiring(col, s, 0.06);
    expect(whyNotPower(col, 'solar')).toBeNull();
    expect(col.community.log.some((l) => /how the old wiring goes/.test(l.text))).toBe(true);
    expect(whyNotPower(col, 'windmill')).toMatch(/joinery/);
  });

  it('a windmill makes each harvest go further', () => {
    const col = fresh();
    expect(millFactor(col)).toBe(1);
    put(col, 'windmill');
    const f0 = col.community.resources.food;
    gainFood(col, 'fields', 10);
    expect(col.community.resources.food - f0).toBeCloseTo(10 * (1 + MILL_BONUS), 5);
    // Only harvests, not foraging.
    const f1 = col.community.resources.food;
    gainFood(col, 'forage', 10);
    expect(col.community.resources.food - f1).toBe(10);
  });

  it('supply against demand: homes draw power; panels and turbines give it', () => {
    const col = fresh();
    for (let k = 0; k < 4; k++) col.village.buildings.push({ id: col.village.nextId++, kind: 'home', tier: 0, foot: { tx: 0, tz: 0, w: 2, d: 2 }, facing: 0, door: { x: 0, z: 0 }, inside: { x: 0, z: 0 }, beds: 2, level: 0, tended: 0, growth: 0, name: 'h', household: 99 });
    expect(powerDemand(col)).toBe(4);
    expect(powered(col)).toBeCloseTo(0.25, 5);
    put(col, 'solar');
    expect(powerSupply(col)).toBeGreaterThan(2);
    expect(powered(col)).toBeGreaterThan(0.6);
  });
});
