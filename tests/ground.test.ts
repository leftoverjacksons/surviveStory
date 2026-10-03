/** DESIGN §42.5–42.6: fields keep off plots and buildings and grub up bushes; Clear ground is felled; old litter stays brown. */
import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { Zone, idx, paintZone, toTileX, toTileZ } from '../src/sim/world';
import { createField, fieldBlock } from '../src/sim/fields';
import { fieldKeepOut } from '../src/sim/buildings';
import { DAYS_PER_YEAR, seasonLook } from '../src/sim/calendar';

const square = (x: number, z: number, r: number) => [{ x: x - r, z: z - r }, { x: x + r, z: z - r }, { x: x + r, z: z + r }, { x: x - r, z: z + r }];

describe('fields and the ground around them', () => {
  it('a field may not be drawn over a plot or a building', () => {
    const col = createColony(generateWorld(5, undefined, 'farm'), createCommunity(5));
    const w = col.world, v = col.village;
    const b = v.buildings.find((x) => !x.gone)!;
    const bx = b.foot.tx - w.w / 2 + b.foot.w / 2, bz = b.foot.tz - w.h / 2 + b.foot.d / 2;
    const keep = fieldKeepOut(w, v);
    expect(fieldBlock(w, square(bx, bz, 3), keep)).toMatch(/building/);
    expect(createField(w, square(bx, bz, 3), w.campfire, keep)).toBeNull();
    // A plot tile.
    const i = idx(w, toTileX(w, 30), toTileZ(w, 30));
    v.plotAt[i] = 99;
    expect(fieldBlock(w, square(30, 30, 2), fieldKeepOut(w, v))).toMatch(/plot/);
  });

  it('grubs up bushes on its ground', () => {
    const w = generateWorld(7);
    // Find a bush on open, explored, workable ground and draw a field round it.
    const b = w.bushes.find((x) => x.max > 0 && Math.hypot(x.tx - w.w / 2, x.tz - w.h / 2) > 16)!;
    const cx = b.tx - w.w / 2 + 0.5, cz = b.tz - w.h / 2 + 0.5;
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) w.explored[idx(w, b.tx + dx, b.tz + dz)] = 255;
    const out = { bushes: 0 };
    const f = createField(w, square(cx, cz, 3), w.campfire, undefined, out);
    expect(f).toBeTruthy();
    expect(out.bushes).toBeGreaterThan(0);
    expect(b.max).toBe(0);
    expect(w.bushAt[idx(w, b.tx, b.tz)]).toBe(-1);
  });
});

describe('clear ground', () => {
  it('builders fell the trees on ground marked Clear, wood wanted or not', () => {
    const col = createColony(generateWorld(3), createCommunity(3));
    const w = col.world;
    col.community.resources.wood = 500; // the woodpile wants nothing
    // The nearest stand of standing trees to the fire.
    const near = w.trees.filter((t) => !t.felled && !t.protected && Math.hypot(t.tx - w.w / 2, t.tz - w.h / 2) > 8)
      .sort((a, b) => Math.hypot(a.tx - w.w / 2, a.tz - w.h / 2) - Math.hypot(b.tx - w.w / 2, b.tz - w.h / 2))[0];
    const x = near.tx - w.w / 2 + 0.5, z = near.tz - w.h / 2 + 0.5;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) w.explored[idx(w, near.tx + dx, near.tz + dz)] = 255;
    expect(paintZone(w, x, z, 2, Zone.Clear)).toBe(true);
    // Protected trees are kept, even on Clear ground.
    const inZone = () => w.trees.filter((t) => !t.felled && !t.protected && w.zone[idx(w, t.tx, t.tz)] === Zone.Clear);
    const before = inZone().length;
    expect(before).toBeGreaterThan(0);
    for (let m = 0; m < 1440 * 4 && inZone().length; m += 10) tick(col, 10);
    expect(inZone().length).toBe(0);
  }, 60000);

  it('may not be painted over the Wild', () => {
    const w = generateWorld(3);
    const i = w.zone.findIndex((z) => z === Zone.Wild);
    expect(i).toBeGreaterThanOrEqual(0);
    w.explored[i] = 255;
    paintZone(w, (i % w.w) - w.w / 2 + 0.5, Math.floor(i / w.w) - w.h / 2 + 0.5, 0.4, Zone.Clear);
    expect(w.zone[i]).toBe(Zone.Wild);
  });
});

describe('leaf litter', () => {
  it('is brown at the thaw and gone within the first days of spring', () => {
    const atThaw = seasonLook(1.2, false);
    expect(atThaw.litter).toBeGreaterThan(0.5);
    expect(atThaw.litterAge).toBe(1);
    expect(seasonLook(3.5, false).litter).toBe(0);
    // Fresh in mid-autumn.
    expect(seasonLook(DAYS_PER_YEAR * 0.62, false).litterAge).toBeLessThan(0.3);
  });
});
