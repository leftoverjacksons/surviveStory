import { describe, expect, it } from 'vitest';
import { adjustBond, alive, bondValue, createCommunity, withRng } from '../src/sim/community';
import { createColony, rationing, tick, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { maybeConvene, resolveCouncil, HEARTH_GAP } from '../src/sim/council';
import { committed } from '../src/sim/dilemmas';
import { DAYS_PER_SEASON } from '../src/sim/calendar';

const questionOf = (col: Colony): string | undefined => col.council.active?.question?.kind;
const convene = (col: Colony) => withRng(col.community, (rng) => maybeConvene(col, rng));
const answer = (col: Colony, kind: string) => {
  const p = col.council.active!.proposals.find((x) => x.kind === kind)!;
  expect(p).toBeDefined();
  expect(p.effect).toBeTruthy();
  return resolveCouncil(col, p.id);
};

function fresh(seed = 3, days = 10): Colony {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  for (let d = 0; d < days; d++) tick(col, 1440);
  col.council.active = null;
  col.council.nextDay = 0;
  col.council.asked = {}; // nothing asked recently, so the question under test can come up
  return col;
}

describe('councils that matter (DESIGN §23.5)', () => {
  it('meets when there is a question, never two days running, and holds a hearth talk after a quiet spell', () => {
    const col = createColony(generateWorld(4), createCommunity(4));
    const held: number[] = [];
    let seen = -1;
    for (let m = 0; m < 1440 * 48; m += 60) {
      tick(col, 60);
      const a = col.council.active;
      if (a && a.proposals[0].id !== seen) { seen = a.proposals[0].id; held.push(col.community.day); }
    }
    expect(held.length).toBeGreaterThan(4);
    for (let i = 1; i < held.length; i++) {
      expect(held[i] - held[i - 1]).toBeGreaterThanOrEqual(2);
      expect(held[i] - held[i - 1]).toBeLessThanOrEqual(HEARTH_GAP + 4);
    }
  }, 120000);

  it('strangers at the gate: taking them in adds people; sending them on costs food', () => {
    const col = fresh();
    const pop = alive(col.community).length;
    col.council.strangers = { n: 2 };
    convene(col);
    expect(questionOf(col)).toBe('strangers');
    answer(col, 'take_all');
    expect(alive(col.community).length).toBe(pop + 2);

    col.council.nextDay = 0;
    col.council.strangers = { n: 3 };
    col.community.resources.food += 50;
    const food = col.community.resources.food;
    convene(col);
    answer(col, 'send_on');
    expect(col.community.resources.food).toBe(food - 24);
    expect(alive(col.community).length).toBe(pop + 2);
  }, 120000);

  it('winter that won\'t add up: rationing and all hands become visible commitments that act', () => {
    const col = fresh(3, 0);
    while (Math.floor((col.community.day - 1) / DAYS_PER_SEASON) % 4 !== 2) tick(col, 1440);
    col.council.active = null; col.council.nextDay = 0; col.council.asked = {};
    col.community.resources.wood = 2; col.community.resources.food = 5; col.community.resources.preserves = 0;
    convene(col);
    expect(questionOf(col)).toBe('winter');
    answer(col, 'ration');
    expect(committed(col, 'ration')).toBe(true);
    expect(rationing(col)).toBe(true);
    expect(col.council.commitments!.some((k) => k.kind === 'ration')).toBe(true);
    tick(col, 1440 * 9);
    expect(committed(col, 'ration')).toBe(false);
  }, 120000);

  it('all hands: builders stop building and cut wood', () => {
    const col = fresh();
    col.council.commitments = [{ kind: 'all_hands', title: 'x', effect: 'y', until: col.minute + 1440 * 2 }];
    let building = 0, cutting = 0;
    for (let m = 0; m < 1440; m += 30) {
      tick(col, 30);
      for (const a of col.agents) {
        const s = col.community.survivors.find((x) => x.id === a.id)!;
        if (s.role !== 'builder') continue;
        if (a.task?.kind === 'build') building++;
        if (a.task?.kind === 'chop') cutting++;
      }
    }
    expect(building).toBe(0);
    expect(cutting).toBeGreaterThan(0);
  }, 120000);

  it('the Folk ask for land: refusing cools them', () => {
    const col = fresh();
    const f = col.folk;
    f.met = true; f.standing = 50; f.land = 0;
    convene(col);
    expect(questionOf(col)).toBe('folk_land');
    const before = f.standing;
    answer(col, 'land_refuse');
    expect(f.standing).toBeLessThan(before);
  }, 120000);

  it('a quarrel: mending brings the two back toward each other', () => {
    const col = fresh();
    const [a, b] = alive(col.community);
    adjustBond(col.community, a.id, b.id, -200);
    const bond = bondValue(col.community, a.id, b.id);
    col.community.resources.food += 20;
    convene(col);
    expect(questionOf(col)).toBe('quarrel');
    answer(col, 'mend');
    expect(bondValue(col.community, a.id, b.id)).toBeGreaterThan(bond);
  }, 120000);
});
