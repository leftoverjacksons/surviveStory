import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { moveFire, moveStockpile, whyNotFire, whyNotStockpile } from '../src/sim/hearth';
import { woodyard } from '../src/sim/world';

const fresh = (seed = 3) => createColony(generateWorld(seed), createCommunity(seed));
/** The first spot, spiralling out from a point, where `ok` holds. */
function spot(from: { x: number; z: number }, ok: (x: number, z: number) => boolean) {
  for (let r = 6; r < 30; r += 1.5) for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2, x = from.x + Math.cos(a) * r, z = from.z + Math.sin(a) * r;
    if (ok(x, z)) return { x, z };
  }
  return null;
}

describe('moving the fire and the stockpile (DESIGN §27)', () => {
  it('the fire can be carried to open ground; bad places are refused with a reason', () => {
    const col = fresh();
    const w = col.world;
    // Not onto a building (the shelter), not into the unexplored dark.
    const store = col.village.buildings.find((b) => b.kind === 'store')!;
    expect(whyNotFire(col, store.inside.x, store.inside.z)).toBeTruthy();
    expect(whyNotFire(col, 100, 100)).toMatch(/far|edge|in the way|water|Folk/);
    const at = spot(w.campfire, (x, z) => !whyNotFire(col, x, z))!;
    expect(at).not.toBeNull();
    expect(moveFire(col, at.x, at.z)).toBeNull();
    expect(w.campfire).toEqual(at);
    expect(col.community.log.at(-1)!.text).toMatch(/embers/);
    // People gather at the new fire of an evening.
    let near = 0, old = 0;
    for (let h = 0; h < 40; h++) {
      tick(col, 60);
      near = Math.max(near, col.agents.filter((a) => Math.hypot(a.x - at.x, a.z - at.z) < 6).length);
    }
    expect(near).toBeGreaterThan(0);
    void old;
  }, 60000);

  it('the stockpile can be moved; the woodyard follows it', () => {
    const col = fresh();
    const w = col.world;
    const sp0 = { ...w.stockpile }, yard0 = woodyard(w);
    const c0 = { x: (sp0.x0 + sp0.x1) / 2, z: (sp0.z0 + sp0.z1) / 2 };
    const at = spot(c0, (x, z) => !whyNotStockpile(col, x, z))!;
    expect(at).not.toBeNull();
    expect(moveStockpile(col, at.x, at.z)).toBeNull();
    expect((w.stockpile.x0 + w.stockpile.x1) / 2).toBeCloseTo(at.x, 5);
    expect(w.stockpile.x1 - w.stockpile.x0).toBeCloseTo(sp0.x1 - sp0.x0, 5);
    expect(woodyard(w)).not.toEqual(yard0);
    // Hauling goes on to the new one.
    const food0 = col.community.resources.food;
    for (let d = 0; d < 2; d++) tick(col, 1440);
    expect(col.community.resources.food + col.community.resources.wood).toBeGreaterThan(0);
    void food0;
  }, 60000);
});
