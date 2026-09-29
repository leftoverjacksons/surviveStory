import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { REACH, blessingAt, blessingGrowth, cellAt, myceliumDaily, reachCells } from '../src/sim/mycelium';
import { Crop, idx, toTileX, toTileZ } from '../src/sim/world';

const fresh = (seed = 3) => createColony(generateWorld(seed), createCommunity(seed));

describe('the mycelium (DESIGN §24.10)', () => {
  it('grows out from the hill day by day, and stops', () => {
    const col = fresh();
    const counts: number[] = [];
    for (let d = 0; d < 40; d++) { myceliumDaily(col); counts.push(reachCells(col)); }
    expect(counts[5]).toBeGreaterThan(counts[0]);
    expect(counts[39]).toBeGreaterThan(20);
    expect(counts[39] - counts[30]).toBeLessThanOrEqual(2); // settled
  });

  it('an uncleared district is dead ground; cleared, the network can enter', () => {
    const col = fresh(), w = col.world;
    const h = col.haunts[0];
    const r = w.ruins.find((x) => x.district === h.district)!;
    const my = col.mycelium!;
    // Pretend the network is thick all around the ruin.
    const c = cellAt(my, w, r.x, r.z);
    for (let k = 0; k < my.m.length; k++) my.m[k] = 0.9;
    h.state = 'sensed';
    myceliumDaily(col);
    expect(my.m[c]).toBeLessThan(0.9); // withering where it's dead ground
    for (let d = 0; d < 30; d++) myceliumDaily(col);
    expect(my.m[c]).toBe(0);
    // Cleared: with the network thick around it again, it grows in.
    h.state = 'cleared';
    for (let k = 0; k < my.m.length; k++) if (k !== c) my.m[k] = 0.9;
    myceliumDaily(col);
    expect(my.m[c]).toBeGreaterThan(0);
  });

  it('where it reaches, a friendly hill blesses growth and a soured one blights crops', () => {
    const col = fresh(), w = col.world, m = w.folk.mound;
    for (let d = 0; d < 20; d++) myceliumDaily(col);
    const near = { x: m.x + 5, z: m.z };
    expect(col.mycelium!.m[cellAt(col.mycelium!, w, near.x, near.z)]).toBeGreaterThanOrEqual(REACH);
    col.folk.standing = 90;
    expect(blessingAt(col, near.x, near.z)).toBeGreaterThan(0.2);
    expect(blessingGrowth(col, near.x, near.z)).toBeGreaterThan(1.03);
    col.folk.standing = 38;
    expect(blessingAt(col, near.x, near.z)).toBe(0);
    // Soured: growing crops under the network go black in patches, over some days.
    col.folk.standing = 2;
    const tiles: number[] = [];
    for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
      const i = idx(w, toTileX(w, m.x + dx), toTileZ(w, m.z + dz));
      if (blessingAt(col, m.x + dx, m.z + dz) < -0.2) { w.cropState[i] = Crop.Growing; tiles.push(i); }
    }
    expect(tiles.length).toBeGreaterThan(20);
    for (let d = 0; d < 20; d++) { col.community.day++; myceliumDaily(col); }
    expect(tiles.some((i) => w.cropState[i] !== Crop.Growing)).toBe(true);
    expect(tiles.filter((i) => w.cropState[i] !== Crop.Growing).length).toBeLessThan(tiles.length);
  });
});
