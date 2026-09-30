import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { outlinePlot } from '../src/sim/homes';
import { Rng } from '../src/sim/rng';
import { idx, reveal, tileX, tileZ } from '../src/sim/world';

describe('rocks in plots (DESIGN §34)', () => {
  it('a plot may be drawn round a rock; the house is fitted clear of it', () => {
    let tried = 0, passed = 0;
    for (let seed = 1; seed <= 6 && passed < 2; seed++) {
      const col = createColony(generateWorld(seed), createCommunity(seed));
      const w = col.world;
      const rocks = w.rocks.filter((r) => Math.hypot(tileX(w, r.tx), tileZ(w, r.tz)) > 12 && Math.hypot(tileX(w, r.tx), tileZ(w, r.tz)) < 40);
      for (const r of rocks.slice(0, 12)) {
        const x = tileX(w, r.tx), z = tileZ(w, r.tz);
        reveal(w, x, z, 14);
        // The rock at the back of the plot, the front toward the fire.
        const pts = [{ x: x - 4, z: z - 4 }, { x: x + 4, z: z - 4 }, { x: x + 4, z: z + 4 }, { x: x - 4, z: z + 4 }];
        const plan = outlinePlot(w, col.village, pts, new Rng(3));
        tried++;
        if (typeof plan === 'string') { expect(plan).not.toMatch(/rock/); continue; }
        passed++;
        expect(plan.plot.tiles).toContain(idx(w, r.tx, r.tz));
        expect(plan.houseTiles).not.toContain(idx(w, r.tx, r.tz));
      }
    }
    expect(tried).toBeGreaterThan(0);
    expect(passed).toBeGreaterThan(0);
  });
});
