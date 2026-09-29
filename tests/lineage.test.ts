import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { DAYS_PER_YEAR } from '../src/sim/calendar';
import { APPRENTICE_AGE, childrenOf, lineageDaily, oldAge, parentsOf } from '../src/sim/lineage';
import { householdOf } from '../src/sim/homes';

const fresh = (seed = 4) => createColony(generateWorld(seed), createCommunity(seed));
const day = (col: Colony) => tick(col, 1440);

describe('growing up, families (DESIGN §24.15)', () => {
  it('everyone has a family and a birth day, and age follows the calendar', () => {
    const col = fresh();
    const s = col.community.survivors[0];
    expect(s.family).toBeTruthy();
    expect(s.born).toBeDefined();
    const age0 = s.age;
    for (let d = 0; d < DAYS_PER_YEAR + 1; d++) { col.community.day++; lineageDaily(col); }
    expect(s.age).toBe(age0 + 1);
  });

  it('a child comes due: born into the household, named for the family, and plays rather than works', () => {
    const col = fresh();
    const [p, q] = alive(col.community).filter((x) => x.age >= 18);
    p.partner = q.id; q.partner = p.id;
    col.village.households.push({ id: col.village.nextId++, members: [p.id, q.id], home: 0, since: 1, petitioned: 0 });
    col.village.households = col.village.households.filter((h) => h.members.length && !(h.members.length === 1 && (h.members[0] === p.id || h.members[0] === q.id)));
    p.expecting = col.community.day + 1;
    const n0 = col.community.survivors.length;
    day(col); day(col);
    expect(col.community.survivors.length).toBe(n0 + 1);
    const baby = col.community.survivors[n0];
    expect(baby.age).toBe(0);
    expect(baby.name.endsWith(p.family!)).toBe(true);
    expect(parentsOf(col.community, baby).map((x) => x.id).sort()).toEqual([p.id, q.id].sort());
    expect(childrenOf(col.community, p)).toContain(baby);
    expect(householdOf(col.village, baby.id)).toBe(householdOf(col.village, p.id));
    // A few years on: a child at play, not at work.
    baby.born! -= 5 * DAYS_PER_YEAR;
    for (let h = 0; h < 48; h++) tick(col, 60);
    const a = col.agents.find((x) => x.id === baby.id)!;
    expect(baby.age).toBe(5);
    expect(baby.role).toBe('rest');
    for (let h = 0; h < 12 && a.task?.kind !== 'leisure'; h++) tick(col, 60);
    expect(['leisure', 'eat', 'sleep', 'social', 'gather']).toContain(a.task?.kind);
    // Twelve: learning a parent's work.
    p.role = 'farmer';
    baby.born! -= (APPRENTICE_AGE - 5) * DAYS_PER_YEAR;
    day(col);
    expect(baby.age).toBe(APPRENTICE_AGE);
    expect(baby.role).toBe('farmer');
  });

  it('children do not set up house on their own', () => {
    const col = fresh();
    const [p, q] = alive(col.community);
    q.age = 9; q.born = col.community.day - 9 * DAYS_PER_YEAR;
    q.parents = [p.id];
    for (let d = 0; d < 14; d++) day(col);
    const h = householdOf(col.village, q.id);
    expect(!h || h.members.some((m) => m !== q.id)).toBe(true);
  });

  it('the very old die in time', () => {
    const col = fresh();
    const s = alive(col.community)[0];
    s.age = 95; s.born = col.community.day - 95 * DAYS_PER_YEAR;
    for (let d = 0; d < 400 && s.alive; d++) { col.community.day++; oldAge(col); }
    expect(s.alive).toBe(false);
    expect(s.causeOfDeath).toBe('old age');
  });
});
