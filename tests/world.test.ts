import { describe, expect, it } from 'vitest';
import { generateWorld } from '../src/sim/worldgen';
import { findPath } from '../src/sim/path';
import { Ground, idx, isExplored, passable, toTileX, toTileZ } from '../src/sim/world';
import { CAMP, STOCKPILE } from '../src/sim/layout';

const world = generateWorld(1234);

describe('world generation', () => {
  it('is deterministic', () => {
    const again = generateWorld(1234);
    expect(again.trees.length).toBe(world.trees.length);
    expect(Buffer.from(again.ground).equals(Buffer.from(world.ground))).toBe(true);
  });

  it('starts with the station area explored and the far map hidden', () => {
    expect(isExplored(world, toTileX(world, 0), toTileZ(world, 0))).toBe(true);
    expect(isExplored(world, 5, 5)).toBe(false);
  });

  it('has forests, water, trees, bushes and ruins', () => {
    const count = (g: number) => world.ground.filter((v) => v === g).length;
    expect(count(Ground.Forest)).toBeGreaterThan(3000);
    expect(count(Ground.Water)).toBeGreaterThan(100);
    expect(world.trees.length).toBeGreaterThan(3000);
    expect(world.bushes.length).toBeGreaterThan(100);
    expect(world.pois.filter((p) => p.kind === 'ruin').length).toBe(4);
  });

  it('keeps the camp and stockpile reachable from the station', () => {
    const sx = toTileX(world, 0), sz = toTileZ(world, 1.5);
    const gx = toTileX(world, (STOCKPILE.x0 + STOCKPILE.x1) / 2), gz = toTileZ(world, (STOCKPILE.z0 + STOCKPILE.z1) / 2);
    expect(passable(world, gx, gz)).toBe(true);
    expect(findPath(world, sx, sz, gx, gz)).not.toBeNull();
    expect(passable(world, toTileX(world, CAMP.x), toTileZ(world, CAMP.z))).toBe(false); // fire pit
  });

  it('never places trees on roads, water, or blocked tiles', () => {
    for (const t of world.trees) {
      if (t.felled) continue;
      const i = idx(world, t.tx, t.tz);
      expect(world.ground[i]).not.toBe(Ground.Water);
      expect(world.ground[i]).not.toBe(Ground.Asphalt);
      expect(world.blocked[i]).toBe(0);
    }
  });

  it('finds long paths across the map', () => {
    const p = findPath(world, toTileX(world, 0), toTileZ(world, 1.5), toTileX(world, 60), toTileZ(world, 13));
    expect(p).not.toBeNull();
    expect(p!.length).toBeGreaterThan(50);
  });
});
