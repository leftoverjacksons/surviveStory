import { describe, expect, it } from 'vitest';
import { createCommunity, alive } from '../src/sim/community';
import { createColony, dayOf, tick, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { exploredFraction } from '../src/sim/world';

function run(seed: number, days: number): Colony {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  for (let m = 0; m < days * 1440; m += 10) tick(col, 10);
  return col;
}

describe('colony', () => {
  const col = run(77, 5);

  it('advances days', () => {
    expect(dayOf(col)).toBe(6);
    expect(col.community.day).toBe(6);
  });

  it('keeps everyone alive through a quiet week at home', () => {
    expect(alive(col.community).length).toBe(5);
  });

  it('fells trees and hauls the wood home', () => {
    expect(col.world.trees.filter((t) => t.felled).length).toBeGreaterThan(3);
    expect(col.community.resources.wood).toBeGreaterThan(10);
  });

  it('forages food', () => {
    expect(col.community.resources.food).toBeGreaterThan(5);
  });

  it('pushes back the fog', () => {
    const fresh = generateWorld(77);
    expect(exploredFraction(col.world)).toBeGreaterThan(exploredFraction(fresh) * 1.5);
  });

  it('is deterministic', () => {
    const again = run(77, 5);
    expect(again.community.resources).toEqual(col.community.resources);
    expect(again.agents.map((a) => [a.x, a.z])).toEqual(col.agents.map((a) => [a.x, a.z]));
  });
});
