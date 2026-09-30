import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { MENU, unlockOf, unlocksDaily, seenUnlocks } from '../src/sim/unlocks';
import { learn } from '../src/sim/purpose';

const fresh = (seed = 4) => createColony(generateWorld(seed), createCommunity(seed));

describe('the build menu grows with the village (DESIGN §32)', () => {
  it('a new village sees only the basics; later things are hidden, not listed', () => {
    const col = fresh();
    for (const k of ['plot', 'hut', 'garden', 'cellar', 'workshop', 'lantern', 'salvage'] as const) expect(unlockOf(col, k).state).toBe('open');
    for (const k of ['tavern', 'dome', 'solar', 'turbine', 'sawpit', 'windmill', 'hearth', 'hall', 'toolshop', 'tailor', 'smokehouse'] as const) expect(unlockOf(col, k).state).toBe('hidden');
    const r = unlockOf(col, 'restore');
    expect(r.state).toBe('glimpsed');
    expect(r.why).toMatch(/Clear a district/);
    // Fewer than half the entries are open at the start.
    expect(MENU.filter((m) => unlockOf(col, m.kind).state === 'open').length).toBeLessThan(MENU.length / 2);
  });

  it('the first check records what is open without news; later openings are news, and new until seen', () => {
    const col = fresh();
    unlocksDaily(col);
    expect(col.village.fresh ?? []).toEqual([]);
    const logs = col.community.log.length;
    // The workbench goes up: joinery is one step away (glimpsed); someone learns it: open.
    col.village.buildings.push({ ...col.village.buildings[0], id: 999, kind: 'workshop', level: 0, gone: false });
    expect(unlockOf(col, 'sawpit').state).toBe('glimpsed');
    expect(unlockOf(col, 'sawpit').why).toMatch(/joinery/);
    const s = col.community.survivors.find((x) => x.alive)!;
    learn(s, 'joinery', 1);
    expect(unlockOf(col, 'sawpit').state).toBe('open');
    unlocksDaily(col);
    expect(col.village.fresh).toContain('sawpit');
    expect(col.community.log.length).toBeGreaterThan(logs);
    unlocksDaily(col);
    expect(col.village.fresh!.filter((k) => k === 'sawpit').length).toBe(1); // news once
    seenUnlocks(col);
    expect(col.village.fresh).toEqual([]);
  });

  it('pulling down the shelter opens the commons hall', () => {
    const col = fresh();
    const st = col.village.buildings.find((b) => b.kind === 'store')!;
    expect(unlockOf(col, 'hall').state).toBe('hidden');
    st.gone = true;
    expect(unlockOf(col, 'hall').state).toBe('open');
  });

  it('runs daily in the sim without trouble', () => {
    const col = fresh(5);
    for (let d = 0; d < 6; d++) tick(col, 1440);
    expect(col.village.unlocked?.length).toBeGreaterThan(0);
  });
});
