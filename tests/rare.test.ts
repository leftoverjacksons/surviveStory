import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { reveal } from '../src/sim/world';
import { DEFS, tierFor } from '../src/sim/buildings';
import { rareOf, rareTotal, strip, strippable } from '../src/sim/rare';

describe('district-only materials (DESIGN §21.7)', () => {
  it('ruins can be stripped only once their district is cleared, and not once restored', () => {
    const col = createColony(generateWorld(3), createCommunity(3));
    const r = col.world.ruins.find((x) => x.kind === 'house')!;
    expect(rareTotal(r)).toBeGreaterThan(1);
    expect(rareOf(r)!.mat).toBe('copper');
    expect(strippable(col, r)).toBe(false);
    const h = col.haunts.find((x) => x.district === r.district)!;
    h.state = 'cleared';
    h.owner = 'village';
    expect(strippable(col, r)).toBe(true);
    const left = rareOf(r)!.left;
    expect(strip(col, r, 3, 'Ada')!.amount).toBe(Math.min(3, left));
    expect(rareOf(r)!.left).toBe(left - Math.min(3, left));
    h.owner = 'folk';
    expect(strippable(col, r)).toBe(false);
    h.owner = 'village';
    r.restored = true;
    expect(strippable(col, r)).toBe(false);
  });

  it('the timber versions wait for rare salvage; without it, the salvage version is built', () => {
    const col = createColony(generateWorld(4), createCommunity(4));
    const v = col.village, res = col.community.resources;
    v.tier = 1;
    expect(tierFor(v, col.community, 'tavern')).toBe(0);
    res.glass = DEFS.tavern.cost[1].glass; res.copper = DEFS.tavern.cost[1].copper;
    expect(tierFor(v, col.community, 'tavern')).toBe(1);
    expect(tierFor(v, col.community, 'hut')).toBe(1);
  });

  it('builders go out and strip a cleared district when glass or copper is wanted', () => {
    const col = createColony(generateWorld(5), createCommunity(5));
    const w = col.world;
    const h = col.haunts.find((x) => w.districts[x.district].kind === 'suburb') ?? col.haunts[0];
    h.state = 'cleared'; h.owner = 'village';
    const d = w.districts[h.district];
    reveal(w, d.x, d.z, 30);
    const before = { glass: col.community.resources.glass, copper: col.community.resources.copper, steel: col.community.resources.steel };
    for (let m = 0; m < 1440 * 6; m += 30) tick(col, 30);
    const r = col.community.resources;
    expect(r.glass + r.copper + r.steel).toBeGreaterThan(before.glass + before.copper + before.steel);
    expect(col.community.log.some((l) => /You can't get that from a junk heap/.test(l.text))).toBe(true);
  }, 60000);

  it('a glass dome gives food in winter', () => {
    const col = createColony(generateWorld(6), createCommunity(6));
    const b = {
      id: col.village.nextId++, kind: 'dome', tier: 0, foot: { tx: 0, tz: 0, w: 4, d: 4 }, facing: 0, door: { x: 0, z: 0 }, inside: { x: 0, z: 0 },
      beds: 0, level: 0, tended: 100, growth: 0.5, name: 'Glass dome',
    } as never;
    col.village.buildings.push(b);
    col.community.day = 40; // winter
    col.minute = 40 * 1440 - 1;
    const before = col.ledger.domes ?? 0;
    tick(col, 2);
    expect((col.ledger.domes ?? 0)).toBeGreaterThan(before);
  });
});
