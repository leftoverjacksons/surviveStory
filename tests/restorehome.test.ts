import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { HAUNT_RADIUS, giveDistrict } from '../src/sim/haunt';
import { RESTORE, requestRestore } from '../src/sim/restore';
import { completeProject } from '../src/sim/buildings';
import { householdOf, treesOnRuinPlot } from '../src/sim/homes';
import { idx, inBounds, reveal, toTileX, toTileZ } from '../src/sim/world';

describe('restored houses are homes again (DESIGN §24.16)', () => {
  it('a restored house gets a plot and yard, and a waiting household moves in', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const col = createColony(generateWorld(seed), createCommunity(seed));
      const w = col.world, v = col.village;
      // A cleared district of the village's with a house in it.
      const r = w.ruins.find((x) => RESTORE[x.kind]?.as === 'home');
      if (!r) continue;
      const d = w.districts[r.district], h = col.haunts.find((x) => x.district === d.id)!;
      reveal(w, d.x, d.z, HAUNT_RADIUS + 4);
      h.state = 'cleared';
      const cx = toTileX(w, d.x), cz = toTileZ(w, d.z);
      for (let dz = -HAUNT_RADIUS; dz <= HAUNT_RADIUS; dz++) for (let dx = -HAUNT_RADIUS; dx <= HAUNT_RADIUS; dx++) if (inBounds(w, cx + dx, cz + dz)) w.haunted![idx(w, cx + dx, cz + dz)] = 0;
      giveDistrict(col, d.id, 'village');
      const p = requestRestore(col, r.id);
      if (typeof p === 'string') continue; // unreachable from the fire on this map
      completeProject(w, v, col.community, p);
      const b = v.buildings.find((x) => x.ruin === r.id)!;
      expect(b.kind).toBe('home');
      const plot = v.plots.find((x) => x.id === b.plot)!;
      expect(plot.tiles.length).toBeGreaterThan(20);
      expect(plot.yard.some((y) => y.kind === 'beds' || y.kind === 'bench')).toBe(true);
      // Someone waiting for a home.
      const s = alive(col.community)[0];
      v.households.push({ id: v.nextId++, members: [s.id], home: 0, since: 1, petitioned: 0 });
      tick(col, 1440);
      const hh = householdOf(v, s.id);
      expect(hh?.home).toBeTruthy();
      expect(v.buildings.find((x) => x.id === hh!.home)!.ruin === r.id || v.buildings.some((x) => x.ruin === r.id && x.household)).toBe(true);
      return;
    }
    throw new Error('no map with a restorable house');
  });
});

describe('a restored house can be pulled down again (DESIGN §27)', () => {
  it('its salvage comes in, the ruin is gone, its plot is free, and the family waits for a new home', async () => {
    const { takeDown, finishTakedown } = await import('../src/sim/dismantle');
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const col = createColony(generateWorld(seed), createCommunity(seed));
      const w = col.world, v = col.village;
      const r = w.ruins.find((x) => RESTORE[x.kind]?.as === 'home');
      if (!r) continue;
      const d = w.districts[r.district], h = col.haunts.find((x) => x.district === d.id)!;
      reveal(w, d.x, d.z, HAUNT_RADIUS + 4);
      h.state = 'cleared';
      giveDistrict(col, d.id, 'village');
      const p = requestRestore(col, r.id);
      if (typeof p === 'string') continue;
      completeProject(w, v, col.community, p);
      const b = v.buildings.find((x) => x.ruin === r.id)!;
      const s = alive(col.community)[0];
      v.households.push({ id: v.nextId++, members: [s.id], home: b.id, since: 1, petitioned: 0 });
      const scrap = col.community.resources.scrap;
      expect(takeDown(col, b)).toBeNull();
      finishTakedown(col, v.takedowns!.find((x) => x.building === b.id)!);
      expect(r.razed).toBe(true);
      expect(v.buildings.includes(b)).toBe(false);
      expect(col.community.resources.scrap).toBeGreaterThan(scrap);
      expect(v.plots.some((x) => x.id === b.plot)).toBe(false);
      expect(householdOf(v, s.id)?.home).toBe(0);
      return;
    }
  });

  it('a restored house is just a house: its trees are felled, it takes the family\'s name (DESIGN §37)', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const col = createColony(generateWorld(seed), createCommunity(seed));
      const w = col.world, v = col.village;
      const r = w.ruins.find((x) => RESTORE[x.kind]?.as === 'home' && treesOnRuinPlot(w, x).length > 0);
      if (!r) continue;
      const d = w.districts[r.district], h = col.haunts.find((x) => x.district === d.id)!;
      reveal(w, d.x, d.z, HAUNT_RADIUS + 4);
      h.state = 'cleared';
      const cx = toTileX(w, d.x), cz = toTileZ(w, d.z);
      for (let dz = -HAUNT_RADIUS; dz <= HAUNT_RADIUS; dz++) for (let dx = -HAUNT_RADIUS; dx <= HAUNT_RADIUS; dx++) if (inBounds(w, cx + dx, cz + dz)) w.haunted![idx(w, cx + dx, cz + dz)] = 0;
      giveDistrict(col, d.id, 'village');
      const p = requestRestore(col, r.id);
      if (typeof p === 'string') continue;
      expect(p.clearTrees.length).toBeGreaterThan(0);
      completeProject(w, v, col.community, p);
      const b = v.buildings.find((x) => x.ruin === r.id)!;
      expect(b.name).toBe('An empty house');
      const s = alive(col.community)[0];
      v.households.push({ id: v.nextId++, members: [s.id], home: 0, since: 1, petitioned: 0 });
      tick(col, 1440);
      if (b.household) {
        expect(b.name).toMatch(/'s (house|cottage)$/);
        expect(b.name).not.toContain(r.name);
      }
      return;
    }
    throw new Error('no map with a restorable house among trees');
  });
});
