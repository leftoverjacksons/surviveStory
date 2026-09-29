import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { homeImprove, placeKindOf, repairShelter, shelterRepair, takeDown, whyNotTakeDown } from '../src/sim/dismantle';
import { hallOf, store } from '../src/sim/buildings';
import { idx, toTileX, toTileZ } from '../src/sim/world';
import { KNOWE_KEEP_OFF, whyNotKnowe } from '../src/sim/townhouse';

describe('the found shelter: repair, pull down, move (DESIGN §29)', () => {
  it('offers its next repair, and queues it', () => {
    const col = createColony(generateWorld(4), createCommunity(4));
    const st = store(col.village);
    const r = shelterRepair(col)!;
    expect(r.label).toMatch(/Clear/);
    col.village.projects = col.village.projects.filter((p) => p.kind !== 'clear_store');
    expect(repairShelter(col)).toBeNull();
    expect(col.village.projects.some((p) => p.kind === 'clear_store' && p.target === st.id)).toBe(true);
    expect(shelterRepair(col)!.why).toMatch(/already/);
  });

  it('the hall step makes it the hall at once', () => {
    const col = createColony(generateWorld(4), createCommunity(4));
    const st = store(col.village);
    st.level = 2;
    col.community.resources.wood = 50;
    expect(repairShelter(col)).toBeNull();
    expect(st.level).toBe(3);
    expect(hallOf(col.village)).toBe(st);
    expect(shelterRepair(col)).toBeNull();
  });

  it('pulled down, it is gone: no beds, no hall, its ground open, salvage in, the stores still counted', () => {
    const col = createColony(generateWorld(4), createCommunity(4));
    const st = store(col.village), w = col.world;
    st.level = 3; st.beds = 2;
    const S = col.village.site.shelter;
    const tile = idx(w, toTileX(w, S.x), toTileZ(w, S.z));
    expect(w.blocked[tile]).toBe(1);
    const scrap = col.community.resources.scrap;
    expect(takeDown(col, st)).toBeNull();
    for (let h = 0; h < 24 * 6 && !st.gone; h++) tick(col, 60);
    expect(st.gone).toBe(true);
    expect(col.village.buildings.includes(st)).toBe(true);
    expect(st.beds).toBe(0);
    expect(hallOf(col.village)).toBeUndefined();
    expect(w.blocked[tile]).toBe(0);
    expect(col.community.log.some((l) => l.text.includes('is down') && l.text.includes('scrap'))).toBe(true);
    expect(col.community.resources.scrap).toBeGreaterThan(scrap - 20);
    expect(whyNotTakeDown(col, st)).toMatch(/gone/);
    expect(shelterRepair(col)).toBeNull();
    // Life goes on without it.
    for (let d = 0; d < 2; d++) tick(col, 1440);
    expect(col.community.survivors.some((s) => s.alive)).toBe(true);
  });

  it('moving it means raising a commons hall elsewhere', () => {
    const col = createColony(generateWorld(4), createCommunity(4));
    expect(placeKindOf(store(col.village))).toBe('hall');
  });

  it('homes offer an improvement', () => {
    const col = createColony(generateWorld(4), createCommunity(4));
    const fake = { ...store(col.village), kind: 'home' as const, level: 0, ruin: undefined };
    expect(homeImprove(col, fake)!.label).toMatch(/Patch/);
  });
});

describe('the buffer between the village and the Folk (DESIGN §29)', () => {
  it('knowes may not rise close to the village fire', () => {
    const col = createColony(generateWorld(4), createCommunity(4));
    const f = col.world.campfire;
    const why = whyNotKnowe(col, f.x + KNOWE_KEEP_OFF / 2, f.z);
    expect(why).toBeTruthy();
  });
});
