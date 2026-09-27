import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { finish, giveDistrict, startClearing, type Clearing } from '../src/sim/haunt';
import { RESTORE, restorable } from '../src/sim/restore';
import { playTurn } from '../src/sim/clearbot';

describe('restoring the old world', () => {
  it('a cleared district given to the village is patched up and used', () => {
    const col = createColony(generateWorld(5), createCommunity(5));
    for (const p of col.world.pois) p.discovered = true;
    col.community.resources.food += 60; col.community.resources.glimmer += 10; col.veil.influence += 20;
    const hi = col.haunts.findIndex((h) => col.world.districts[h.district].kind === 'suburb');
    const by = [...alive(col.community)].sort((a, b) => b.sight - a.sight);
    const cl = startClearing(col, hi, [by[0], by[1], by[by.length - 1], by[by.length - 2]].map((s) => s.id)) as Clearing;
    for (let t = 0; t < 14 && !cl.outcome; t++) playTurn(col, cl);
    if (cl.outcome !== 'cleared') { col.haunts[hi].state = 'cleared'; if (col.clearing) finish(col, col.clearing, 'withdrew'); col.haunts[hi].state = 'cleared'; }
    const d = col.haunts[hi].district;
    // A remnant who came home would move back into their own house once it's restored.
    const ruinOfGhost = col.world.ruins.find((r) => r.district === d && r.kind === 'house')!;
    col.village.hearths.push({ name: 'the woman who waits', building: 0, ruin: ruinOfGhost.id });
    giveDistrict(col, d, 'village');
    const before = restorable(col).length;
    expect(before).toBeGreaterThan(2);
    col.community.resources.wood += 60; col.community.resources.scrap += 30;
    for (let m = 0; m < 1440 * 24; m += 10) tick(col, 10);
    const restored = col.village.buildings.filter((b) => b.ruin !== undefined);
    expect(restored.length).toBeGreaterThan(0);
    for (const b of restored) {
      const r = col.world.ruins[b.ruin!];
      expect(r.restored).toBe(true);
      expect(b.kind).toBe(RESTORE[r.kind]!.as);
    }
    expect(restorable(col).length).toBeLessThan(before);
    expect(col.community.log.some((l) => /lights in its windows again/.test(l.text))).toBe(true);
    const ghost = col.village.hearths.find((x) => x.ruin === ruinOfGhost.id)!;
    if (ruinOfGhost.restored) expect(col.village.buildings.find((b) => b.id === ghost.building)?.ruin).toBe(ruinOfGhost.id);
  }, 120000);
});
