import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { Ground, Zone, idx, paintZone, passable, reveal, tileX, tileZ, zoneAllowed, type World } from '../src/sim/world';

/** Reveal the nearest sizeable pond and mark the stretch of its shore nearest home. */
function markNearestPond(w: World) {
  const pond = w.ponds.filter((p) => p.tiles >= 60).sort((a, b) => Math.hypot(a.cx, a.cz) - Math.hypot(b.cx, b.cz))[0];
  let best = -1, bd = Infinity;
  for (let i = 0; i < w.ground.length; i++) {
    if (w.pondAt[i] !== pond.id) continue;
    const d = Math.hypot(tileX(w, i % w.w), tileZ(w, (i / w.w) | 0));
    if (d < bd) { bd = d; best = i; }
  }
  const x = tileX(w, best % w.w), z = tileZ(w, (best / w.w) | 0);
  reveal(w, x, z, 14);
  paintZone(w, x, z, 5, Zone.Fishing);
  return pond;
}

describe('ponds', () => {
  const w = generateWorld(1);
  it('finds water bodies with fish stocks by size', () => {
    expect(w.ponds.length).toBeGreaterThan(3);
    for (const p of w.ponds) {
      expect(p.stock).toBe(p.max);
      expect(p.max).toBeGreaterThan(0);
    }
    const i = w.ground.findIndex((g) => g === Ground.Water);
    expect(w.pondAt[i]).toBeGreaterThanOrEqual(0);
  });

  it('only lets fishing grounds be marked along a shore', () => {
    const pond = markNearestPond(w);
    let shore = 0;
    for (let i = 0; i < w.zone.length; i++) {
      if (w.zone[i] !== Zone.Fishing) continue;
      shore++;
      expect(zoneAllowed(w, i % w.w, (i / w.w) | 0, Zone.Fishing)).toBe(true);
    }
    expect(shore).toBeGreaterThan(10);
    expect(zoneAllowed(w, w.w / 2, w.h / 2, Zone.Fishing)).toBe(false); // home, far from water
    void pond;
  });
});

describe('a fishery', () => {
  const w = generateWorld(1);
  const col = createColony(w, createCommunity(1));
  const pond = markNearestPond(w);
  // The Veil's lights under the water can refill a pond, so track its low point.
  let lowest = pond.stock;
  for (let m = 0; m < 24 * 1440; m += 10) { tick(col, 10); lowest = Math.min(lowest, pond.stock); }
  const f = col.village.fisheries[0];

  it('gets a jetty, a hut and a fisher', () => {
    expect(f).toBeDefined();
    const kinds = col.village.buildings.map((b) => b.kind);
    expect(kinds).toContain('jetty');
    expect(kinds).toContain('fishhut');
    expect(alive(col.community).some((s) => s.role === 'fisher')).toBe(true);
  });

  it('makes the jetty walkable over the water', () => {
    for (const i of f.jettyTiles) {
      expect(w.ground[i]).toBe(Ground.Water);
      expect(passable(w, i % w.w, (i / w.w) | 0)).toBe(true);
    }
  });

  it('brings in fish, and the pond feels it', () => {
    expect(col.ledger.fishing ?? 0).toBeGreaterThan(20);
    expect(lowest).toBeLessThan(pond.max * 0.95);
    void idx;
  });

  it('lets a rested pond recover', () => {
    const before = pond.stock = pond.max * 0.3;
    for (const s of alive(col.community)) if (s.role === 'fisher') s.role = 'rest';
    for (let m = 0; m < 10 * 1440; m += 10) tick(col, 10);
    // Some still fish there in their free time, so recovery is partial.
    expect(pond.stock).toBeGreaterThan(before + pond.max * 0.06);
  });
});
