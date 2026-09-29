import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { HAUNT_RADIUS, giveDistrict } from '../src/sim/haunt';
import { finishRaze, markHeap, razeRuin, razeYield, whyNotRaze } from '../src/sim/salvage';
import { idx, isExplored, reveal, tileX, tileZ, toTileX, toTileZ } from '../src/sim/world';

describe('strip and clear (DESIGN §24.18)', () => {
  it('a marked wreck is stripped even when the stores have plenty, until it is gone', () => {
    const col = createColony(generateWorld(2), createCommunity(2));
    const w = col.world;
    col.community.resources.scrap = 500; // no need for scrap at all
    for (const s of alive(col.community)) s.role = 'builder';
    const h = w.heaps.filter((x) => x.kind === 'car' && isExplored(w, x.tx, x.tz))
      .sort((a, b) => Math.hypot(tileX(w, a.tx) - w.campfire.x, tileZ(w, a.tz) - w.campfire.z) - Math.hypot(tileX(w, b.tx) - w.campfire.x, tileZ(w, b.tz) - w.campfire.z))[0];
    expect(h).toBeTruthy();
    expect(markHeap(col, h)).toBeNull();
    for (let d = 0; d < 6 && h.scrap > 0; d++) tick(col, 1440);
    expect(h.scrap).toBe(0);
  }, 60000);

  it('a ruin in a cleared district of the village is pulled down for scrap, and its ground freed', () => {
    const col = createColony(generateWorld(3), createCommunity(3));
    const w = col.world;
    const r = w.ruins[0];
    expect(whyNotRaze(col, r)).toMatch(/Clear the district/);
    const d = w.districts[r.district], h = col.haunts.find((x) => x.district === d.id)!;
    reveal(w, d.x, d.z, HAUNT_RADIUS);
    h.state = 'cleared';
    giveDistrict(col, d.id, 'village');
    expect(razeRuin(col, r)).toBeNull();
    const scrap0 = col.community.resources.scrap;
    finishRaze(col, col.village.razes![0]);
    expect(r.razed).toBe(true);
    expect(col.community.resources.scrap - scrap0).toBeGreaterThanOrEqual(razeYield(r));
    expect(w.blocked[idx(w, toTileX(w, r.x), toTileZ(w, r.z))]).toBe(0);
    expect(whyNotRaze(col, r)).toMatch(/gone/);
  });
});
