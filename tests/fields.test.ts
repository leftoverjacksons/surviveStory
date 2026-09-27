import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { Zone } from '../src/sim/world';
import { alongPerimeter, createField, deleteField, fieldAtPoint, perimeter, pointInPolygon, roundField } from '../src/sim/fields';

describe('fields drawn as outlines', () => {
  it('tests points against a polygon', () => {
    const sq = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }];
    expect(pointInPolygon({ x: 2, z: 2 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 5, z: 2 }, sq)).toBe(false);
    expect(perimeter(sq)).toBeCloseTo(16);
    expect(alongPerimeter(sq, 0.5).p).toEqual({ x: 4, z: 4 });
  });

  it('claims the tiles inside, and gives them back when removed', () => {
    const w = generateWorld(5, undefined, 'farm');
    const start = w.fields.length;
    const f = roundField(w, 22, 18, 4, w.campfire) ?? roundField(w, -22, 18, 4, w.campfire) ?? roundField(w, 18, -26, 4, w.campfire);
    expect(f).toBeTruthy();
    expect(w.fields.length).toBe(start + 1);
    for (const i of f!.tiles) { expect(w.zone[i]).toBe(Zone.Field); expect(w.fieldAt[i]).toBe(f!.id); }
    const c = f!.pts.reduce((a, p) => ({ x: a.x + p.x / 8, z: a.z + p.z / 8 }), { x: 0, z: 0 });
    expect(fieldAtPoint(w, c.x, c.z)).toBe(f);
    // An overlapping field only takes what is left.
    const g = createField(w, f!.pts, w.campfire);
    expect(g).toBeNull();
    expect(deleteField(w, f!.id)).toBe(true);
    for (const i of f!.tiles) { expect(w.zone[i]).toBe(Zone.None); expect(w.fieldAt[i]).toBe(0); }
  });

  it('gets fenced once it is worked', () => {
    const col = createColony(generateWorld(5, undefined, 'farm'), createCommunity(5));
    const f = col.world.fields[0];
    expect(f).toBeTruthy();
    for (let m = 0; m < 1440 * 16 && f.fence < 1; m += 10) tick(col, 10);
    expect(f.fence).toBeGreaterThan(0.99);
  }, 60000);
});
