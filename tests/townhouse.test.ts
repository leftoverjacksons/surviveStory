import { describe, expect, it } from 'vitest';
import { createCommunity, killSurvivor } from '../src/sim/community';
import { createColony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { addFae, folkDaily, folkNeeds } from '../src/sim/folk';
import { chamberCount, chambers, digChamber, nextChamber, townhouseDaily } from '../src/sim/townhouse';
import { makeSave, restore } from '../src/sim/save';
import type { Colony } from '../src/sim/colony';

const fresh = (seed = 7) => createColony(generateWorld(seed), createCommunity(seed));

describe('the townhouse under the hill (DESIGN §24.9)', () => {
  it('starts with a hearth-hall and a sleeping chamber, and digs what it lacks', () => {
    const col = fresh();
    expect(chambers(col.folk).map((c) => c.kind)).toEqual(['hearth', 'bowers']);
    // Crowded: the next chamber is for sleeping.
    addFae(col.folk, col.world, 'hob', 1); // four of them: two pairs
    expect(nextChamber(col)).toBe('bowers');
    digChamber(col);
    expect(chamberCount(col.folk, 'bowers')).toBe(2);
    // Enough beds, little dew: a dew-cellar.
    col.folk.dew = 2;
    expect(nextChamber(col)).toBe('dewcellar');
  });

  it('sleeping chambers count toward Rest; the dew-cellar adds dew', () => {
    const col = fresh();
    col.folk.works = col.folk.works.filter((k) => k.kind !== 'bower');
    // Three of them and one spare want four places; the first sleeping chamber gives two.
    expect(folkNeeds(col).find((n) => n.id === 'rest')!.met).toBe(false);
    col.folk.chambers!.push({ kind: 'bowers', a: 0, depth: 0.7, level: 1 });
    expect(folkNeeds(col).find((n) => n.id === 'rest')!.met).toBe(true);
    const a = fresh(), b = fresh();
    b.folk.chambers!.push({ kind: 'dewcellar', a: 0, depth: 0.7, level: 1 });
    a.folk.standing = b.folk.standing = 60;
    folkDaily(a); folkDaily(b);
    expect(b.folk.dew - a.folk.dew).toBeCloseTo(2, 5);
  });

  it('the root-archive eases grief', () => {
    const col = fresh();
    const [s, t] = col.community.survivors;
    killSurvivor(col.community, t.id, 'testing');
    const before = s.griefDays = 6;
    col.community.day = 10;
    townhouseDaily(col);
    expect(s.griefDays).toBe(before);
    col.folk.chambers!.push({ kind: 'archive', a: 0, depth: 0.7, level: 1 });
    townhouseDaily(col);
    expect(s.griefDays).toBe(before - 1);
  });

  it('an old save with a grown hill gets a chamber for each growth', () => {
    const col = fresh();
    col.folk.level = 3;
    const f = structuredClone(makeSave(col));
    delete f.colony.folk.chambers;
    const b = restore(f) as Colony;
    expect(chambers(b.folk).length).toBe(5);
  });
});
