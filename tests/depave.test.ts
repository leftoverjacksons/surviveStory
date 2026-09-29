import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { markDepave, paved } from '../src/sim/depave';
import { giveDistrict, HAUNT_RADIUS } from '../src/sim/haunt';
import { whyNotFolkWork } from '../src/sim/folk';
import { Ground, Zone, idx, isExplored, reveal, toTileX, toTileZ, zoneAllowed } from '../src/sim/world';

const fresh = (seed = 1) => createColony(generateWorld(seed), createCommunity(seed));

describe('breaking up paving (DESIGN §24.12)', () => {
  it('marked paving is broken up by the village and becomes soil that can be planted', () => {
    const col = fresh(), w = col.world;
    // The nearest explored, unblocked paving to the fire.
    let best = -1, bd = Infinity;
    for (let i = 0; i < w.ground.length; i++) {
      const tx = i % w.w, tz = Math.floor(i / w.w);
      if (!paved(w, i) || w.blocked[i] || !isExplored(w, tx, tz)) continue;
      const d = Math.hypot(tx - w.w / 2 - w.campfire.x, tz - w.h / 2 - w.campfire.z);
      if (d < bd) { bd = d; best = i; }
    }
    expect(best).toBeGreaterThanOrEqual(0);
    const tx = best % w.w, tz = Math.floor(best / w.w);
    const x = tx - w.w / 2 + 0.5, z = tz - w.h / 2 + 0.5;
    expect(zoneAllowed(w, tx, tz, Zone.Field)).toBe(false);
    const n = markDepave(w, x, z, 1.5, true);
    expect(n).toBeGreaterThan(0);
    for (let d = 0; d < 6 && (w.depaveCount ?? 0) > 0; d++) tick(col, 1440);
    expect(w.depaveCount).toBe(0);
    expect(w.ground[best]).toBe(Ground.Grass);
    expect(w.depaved).toBe(n);
    expect(zoneAllowed(w, tx, tz, Zone.Field)).toBe(true);
    expect(w.groundVersion).toBeGreaterThan(0);
    // Nothing left claimed.
    expect([...col.claims.keys()].some((i) => i === best)).toBe(false);
  });

  it('erasing unmarks; buildings and water are never marked', () => {
    const col = fresh(), w = col.world;
    w.ground[idx(w, 10, 10)] = Ground.Asphalt; w.explored[idx(w, 10, 10)] = 255;
    const x = 10 - w.w / 2 + 0.5, z = 10 - w.h / 2 + 0.5;
    w.blocked[idx(w, 10, 10)] = 1;
    expect(markDepave(w, x, z, 0.5, true)).toBe(0);
    w.blocked[idx(w, 10, 10)] = 0;
    expect(markDepave(w, x, z, 0.5, true)).toBe(1);
    expect(markDepave(w, x, z, 0.5, false)).toBe(1);
    expect(w.depaveCount).toBe(0);
  });

  it('a shared district lets the Folk build among the gardens', () => {
    const col = fresh(), w = col.world;
    col.folk.met = true; col.folk.standing = 60;
    const d = w.districts[0], h = col.haunts.find((x) => x.district === d.id)!;
    reveal(w, d.x, d.z, HAUNT_RADIUS);
    h.state = 'cleared';
    // An open grass square in the district, away from the ruins.
    let p: { x: number; z: number } | null = null;
    for (let r = 4; r < HAUNT_RADIUS && !p; r += 1) for (let a = 0; a < 6.28 && !p; a += 0.3) {
      const x = d.x + Math.cos(a) * r, z = d.z + Math.sin(a) * r;
      const i = idx(w, toTileX(w, x), toTileZ(w, z));
      if (w.ground[i] === Ground.Grass && !w.blocked[i] && w.treeAt[i] < 0 && w.zone[i] !== Zone.Wild) p = { x, z };
    }
    expect(p).not.toBeNull();
    expect(whyNotFolkWork(col, p!.x, p!.z)).toMatch(/Wild/);
    giveDistrict(col, d.id, 'shared');
    expect(h.owner).toBe('shared');
    expect(whyNotFolkWork(col, p!.x, p!.z)).toBeNull();
  });
});
