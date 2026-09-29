import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { GATE_AFTER, HEDGE, crossed, syncHedges } from '../src/sim/hedges';
import { idx, tileCost, toTileX, toTileZ } from '../src/sim/world';

describe('fences, gates and beds on the walking grid (DESIGN §23.7)', () => {
  const col = createColony(generateWorld(5, undefined, 'farm'), createCommunity(5));
  const w = col.world;
  const f = w.fields[0];

  it('a built field fence costs more to cross; its gate does not', () => {
    f.fence = 1;
    syncHedges(col);
    const a = f.pts[0], b = f.pts[1];
    const mx = a.x + (b.x - a.x) * 0.25, mz = a.z + (b.z - a.z) * 0.25;
    const i = idx(w, toTileX(w, mx), toTileZ(w, mz));
    expect(w.hedge![i]).toBe(HEDGE.fence);
    const tx = i % w.w, tz = Math.floor(i / w.w);
    const before = w.hedge![i];
    w.hedge![i] = 0;
    const open = tileCost(w, tx, tz);
    w.hedge![i] = before;
    expect(tileCost(w, tx, tz)).toBeGreaterThan(open + 3);
    const ga = f.pts[f.gate], gb = f.pts[(f.gate + 1) % f.pts.length];
    const gi = idx(w, toTileX(w, (ga.x + gb.x) / 2), toTileZ(w, (ga.z + gb.z) / 2));
    expect(w.hedge![gi]).toBe(HEDGE.gate);
  });

  it('an unbuilt fence is no obstacle', () => {
    f.fence = 0;
    syncHedges(col);
    expect(w.hedge!.every((h) => h !== HEDGE.fence)).toBe(true);
    f.fence = 1;
    syncHedges(col);
  });

  it('where people keep climbing the fence, a gate goes in, and stays', () => {
    const i = w.hedge!.findIndex((h) => h === HEDGE.fence);
    expect(i).toBeGreaterThanOrEqual(0);
    let made = false;
    for (let k = 0; k < GATE_AFTER; k++) made = crossed(col, i) || made;
    expect(made).toBe(true);
    expect(w.hedge![i]).toBe(HEDGE.gate);
    syncHedges(col);
    expect(w.hedge![i]).toBe(HEDGE.gate);
    expect(w.gates!.length).toBe(1);
  });
});
