import { describe, expect, it } from 'vitest';
import { createCommunity, killSurvivor } from '../src/sim/community';
import { createColony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { GREAT_HILL_R, addFae, folkDaily, folkNeeds } from '../src/sim/folk';
import { HALL_HOUSES, KNOWE_HOUSES, KNOWE_R, housing, knoweCount, knowes, nextKnowe, raiseKnowe, settleFolk, townhouseDaily } from '../src/sim/townhouse';
import { makeSave, restore } from '../src/sim/save';
import { Zone, heightAt, idx, toTileX, toTileZ } from '../src/sim/world';
import type { Colony } from '../src/sim/colony';

const fresh = (seed = 7) => createColony(generateWorld(seed), createCommunity(seed));

describe('the Great Hill and its knowes (DESIGN §25.3)', () => {
  it('the Great Hill is twice the old mound, and the Gentry live in its hall', () => {
    const col = fresh();
    expect(col.world.folk.mound.r).toBe(GREAT_HILL_R);
    expect(knowes(col.folk)).toEqual([]);
    const elder = col.folk.beings.find((b) => b.kind === 'elder')!;
    expect(elder.home).toBe(0);
    expect(housing(col.folk)).toBe(HALL_HOUSES);
  });

  it('a knowe rises on open ground round the hill: real ground, trees taken in, the Wild round it', () => {
    const col = fresh();
    const w = col.world, m = w.folk.mound;
    const before = w.heights.slice();
    const k = raiseKnowe(col, 'dwelling')!;
    expect(k).not.toBeNull();
    const d = Math.hypot(k.x - m.x, k.z - m.z);
    expect(d).toBeGreaterThanOrEqual(m.r + KNOWE_R);
    // The ground rose there, and only rose anywhere.
    expect(heightAt(w, k.x, k.z)).toBeGreaterThan(0);
    for (let i = 0; i < before.length; i++) expect(w.heights[i]).toBeGreaterThanOrEqual(before[i]);
    const i = idx(w, toTileX(w, k.x), toTileZ(w, k.z));
    expect(w.treeAt[i]).toBe(-1);
    expect(w.zone[i]).toBe(Zone.Wild);
    expect(w.heightVersion).toBeGreaterThan(0);
    // A second one stands clear of the first.
    const k2 = raiseKnowe(col, 'gallery')!;
    expect(Math.hypot(k2.x - k.x, k2.z - k.z)).toBeGreaterThan(k.r * 2);
    expect(housing(col.folk)).toBe(HALL_HOUSES + 2 * KNOWE_HOUSES);
  });

  it('the hill raises what it lacks: room first, then dew', () => {
    const col = fresh();
    for (let i = 0; i < 5; i++) addFae(col.folk, col.world, 'hob', 1);
    expect(nextKnowe(col)).toBe('dwelling');
    raiseKnowe(col);
    settleFolk(col.folk);
    // Wee folk live in the knowes once the hall is for the Gentry.
    expect(col.folk.beings.some((b) => (b.home ?? 0) > 0)).toBe(true);
    col.folk.dew = 2;
    expect(nextKnowe(col)).toBe('dewcellar');
  });

  it('knowes count toward Rest; the dew-knowe adds dew', () => {
    const col = fresh();
    col.folk.works = col.folk.works.filter((k) => k.kind !== 'bower');
    for (let i = 0; i < 5; i++) addFae(col.folk, col.world, 'hob', 1);
    expect(folkNeeds(col).find((n) => n.id === 'rest')!.met).toBe(false);
    raiseKnowe(col, 'dwelling');
    expect(folkNeeds(col).find((n) => n.id === 'rest')!.met).toBe(true);
    const a = fresh(), b = fresh();
    raiseKnowe(b, 'dewcellar');
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
    raiseKnowe(col, 'archive');
    townhouseDaily(col);
    expect(s.griefDays).toBe(before - 1);
  });

  it("an old save's chambers become knowes", () => {
    const col = fresh();
    col.folk.level = 2;
    const f = structuredClone(makeSave(col));
    delete f.colony.folk.knowes;
    f.colony.folk.chambers = [{ kind: 'hearth' }, { kind: 'bowers' }, { kind: 'dewcellar' }];
    const b = restore(f) as Colony;
    expect(knowes(b.folk).map((k) => k.kind)).toEqual(['dwelling', 'dewcellar']);
    expect(b.folk.chambers).toBeUndefined();
    expect(knoweCount(b.folk, 'dewcellar')).toBe(1);
  });
});
