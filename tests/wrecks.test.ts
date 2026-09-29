import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { heapTiles, markHeap, stopTow, towHeap, whyNotTow, yardSpot } from '../src/sim/salvage';
import { tileX, tileZ } from '../src/sim/world';

/** A station village and its forecourt car. */
function start(seed = 5): { col: Colony; car: Colony['world']['heaps'][number] } {
  const col = createColony(generateWorld(seed, undefined, 'station'), createCommunity(seed));
  const w = col.world;
  const car = w.heaps.filter((h) => h.kind === 'car').sort((a, b) => Math.hypot(tileX(w, a.tx), tileZ(w, a.tz)) - Math.hypot(tileX(w, b.tx), tileZ(w, b.tz)))[0];
  return { col, car };
}

describe('wrecks: strip, tow, clear (DESIGN §30)', () => {
  it('a wreck blocks its length; stripped bare, the shell goes and its ground is free', () => {
    const { col, car } = start();
    const tiles = heapTiles(col.world, car);
    expect(tiles.length).toBe(3);
    for (const i of tiles) expect(col.world.blocked[i]).toBe(1);
    markHeap(col, car);
    for (let h = 0; h < 24 * 4 && car.scrap > 0; h++) tick(col, 60);
    expect(car.scrap).toBe(0);
    for (const i of tiles) expect(col.world.blocked[i]).toBe(0);
  });

  it('towed to the yard: pushed there over time, old ground freed, new ground taken', () => {
    const { col, car } = start();
    const w = col.world;
    const old = heapTiles(w, car);
    const at = yardSpot(col, car);
    expect(at).toBeTruthy();
    const sp = w.stockpile;
    expect(Math.hypot(at!.x - (sp.x0 + sp.x1) / 2, at!.z - (sp.z0 + sp.z1) / 2)).toBeLessThan(17);
    expect(towHeap(col, car, at!.x, at!.z)).toBeNull();
    expect(towHeap(col, car, at!.x, at!.z)).toMatch(/already/);
    for (let h = 0; h < 24 * 4 && car.tow; h++) tick(col, 30);
    expect(car.tow).toBeUndefined();
    expect(Math.hypot(tileX(w, car.tx) - at!.x, tileZ(w, car.tz) - at!.z)).toBeLessThan(1);
    const now = heapTiles(w, car);
    for (const i of now) expect(w.blocked[i]).toBe(1);
    for (const i of old) if (!now.includes(i)) expect(w.blocked[i]).toBe(0);
    expect(col.community.log.some((l) => l.text.includes('pushed into its new place'))).toBe(true);
  });

  it('refuses the impossible, and can be stopped part way', () => {
    const { col, car } = start();
    const w = col.world, x = tileX(w, car.tx), z = tileZ(w, car.tz);
    expect(whyNotTow(col, car, x + 200, z)).toMatch(/far|edge/);
    expect(whyNotTow(col, car, x, z)).toMatch(/where it is/);
    const at = yardSpot(col, car)!;
    towHeap(col, car, at.x, at.z);
    stopTow(col, car);
    expect(car.tow).toBeUndefined();
    for (const i of heapTiles(w, car)) expect(w.blocked[i]).toBe(1);
  });
});
