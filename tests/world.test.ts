import { describe, expect, it } from 'vitest';
import { generateWorld } from '../src/sim/worldgen';
import { SITE_KINDS } from '../src/sim/sites';
import { findPath } from '../src/sim/path';
import { Ground, idx, isExplored, passable, toTileX, toTileZ } from '../src/sim/world';

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
    const { campfire: CAMP, stockpile: STOCKPILE } = world;
    const sx = toTileX(world, world.site.door.x), sz = toTileZ(world, world.site.door.z);
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

describe('starting sites', () => {
  for (const kind of SITE_KINDS) {
    it(`lays out ${kind} so everything can be reached`, () => {
      const w = generateWorld(77, undefined, kind);
      const S = w.site;
      const at = (p: { x: number; z: number }) => [toTileX(w, p.x), toTileZ(w, p.z)] as const;
      const [dx, dz] = at(S.door);
      expect(passable(w, dx, dz)).toBe(true);
      const targets = [
        { x: (w.stockpile.x0 + w.stockpile.x1) / 2, z: (w.stockpile.z0 + w.stockpile.z1) / 2 },
        { x: S.camp.x + 2, z: S.camp.z },
        S.kitchen,
        { x: S.annex.x0 + S.annex.w / 2, z: S.annex.z0 + S.annex.d / 2 },
        { x: 0, z: 13 }, // the highway
      ];
      for (const t of targets) {
        const [tx, tz] = at(t);
        expect(passable(w, tx, tz), `${kind}: ${t.x},${t.z}`).toBe(true);
        expect(findPath(w, dx, dz, tx, tz), `${kind}: path to ${t.x},${t.z}`).not.toBeNull();
      }
      // Cots stand inside the shelter.
      const inside = (p: { x: number; z: number }) => Math.abs(p.x - S.shelter.x) < S.shelter.w / 2 && Math.abs(p.z - S.shelter.z) < S.shelter.d / 2;
      for (const b of [...S.beds, ...S.hallBeds, S.inside, S.stove]) expect(inside(b), `${kind}: ${b.x},${b.z}`).toBe(true);
      expect(S.beds.length).toBeGreaterThanOrEqual(S.patch.beds);
      expect(w.site.kind).toBe(kind);
    });
  }
});

