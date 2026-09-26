import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import {
  communitySight, disturb, homeResonance, readingFor, resonanceAt, veilDaily, type Phenomenon,
} from '../src/sim/veil';
import {
  CALM_COST, OMEN_COST, maybeConvene, nudgeCalm, nudgeOmen, resolveCouncil,
} from '../src/sim/council';
import { Rng } from '../src/sim/rng';
import { isExplored, toTileX, toTileZ } from '../src/sim/world';

const fresh = (seed = 8) => createColony(generateWorld(seed), createCommunity(seed));
const runDays = (col: Colony, days: number) => { for (let m = 0; m < days * 1440; m += 10) tick(col, 10); };

describe('resonance', () => {
  it('is higher in the forest and at the Ring than on the asphalt', () => {
    const col = fresh();
    const w = col.world;
    expect(resonanceAt(col, w.fairyRing.x, w.fairyRing.z)).toBeGreaterThan(resonanceAt(col, 0, 13));
  });

  it('falls with disturbance and drifts back over days', () => {
    const col = fresh();
    const before = homeResonance(col);
    for (let i = 0; i < 20; i++) disturb(col, 0, 0, 0.05, 3);
    const hurt = homeResonance(col);
    expect(hurt).toBeLessThan(before - 0.1);
    for (let d = 0; d < 30; d++) veilDaily(col, { cold: false, rationing: false });
    expect(homeResonance(col)).toBeGreaterThan(hurt + 0.05);
  });

  it('is thinned by a death in the village', () => {
    const col = fresh();
    const before = homeResonance(col);
    const s = alive(col.community)[0];
    s.alive = false;
    veilDaily(col, { cold: false, rationing: false });
    expect(homeResonance(col)).toBeLessThan(before);
  });
});

describe('perception', () => {
  it('reads the same phenomenon differently by Sight', () => {
    const col = fresh();
    const [a, b] = alive(col.community);
    a.sight = 5; b.sight = 90;
    a.traits = []; b.traits = [];
    const p: Phenomenon = { id: 1, kind: 'moth_woman', x: 0, z: 0, until: 1e9, witnesses: [], logged: 0 };
    const order = ['none', 'chill', 'luminous', 'coherent'];
    expect(order.indexOf(readingFor(col, b, p))).toBeGreaterThan(order.indexOf(readingFor(col, a, p)));
  });

  const col = fresh(21);
  runDays(col, 30);

  it('phenomena appear and are witnessed over a month', () => {
    expect(col.community.log.filter((l) => l.tone === 'strange').length).toBeGreaterThan(3);
  });

  it('the community grows in Sight and the player in Influence', () => {
    expect(communitySight(col)).toBeGreaterThan(15);
    expect(col.veil.influence).toBeGreaterThan(20);
  });

  it('a thin Veil at home breeds hollows', () => {
    const c2 = fresh(5);
    const seen = new Set<string>();
    for (let d = 0; d < 10; d++) {
      for (let i = 0; i < 40; i++) disturb(c2, c2.world.home.x, c2.world.home.z, 0.05, 5);
      for (let m = 0; m < 1440; m += 10) {
        tick(c2, 10);
        for (const p of c2.veil.phenomena) seen.add(p.kind);
      }
    }
    expect(seen.has('hollow')).toBe(true);
  });
});

describe('council', () => {
  it('meets, and a festival lifts spirits and costs stores', () => {
    const col = fresh(3);
    col.community.day = 5;
    col.community.resources.food = 100;
    col.community.resources.wood = 60;
    for (const s of alive(col.community)) s.morale = 40; // low spirits make a festival likely
    maybeConvene(col, new Rng(1));
    expect(col.council.active).not.toBeNull();
    const props = col.council.active!.proposals;
    expect(props.length).toBeGreaterThanOrEqual(2);
    const fest = props.find((p) => p.kind === 'festival') ?? props[0];
    const moraleBefore = alive(col.community).reduce((n, s) => n + s.morale, 0);
    expect(resolveCouncil(col, fest.id)).toBe(true);
    expect(col.council.active).toBeNull();
    if (fest.kind === 'festival') {
      expect(col.community.resources.food).toBe(85);
      expect(alive(col.community).reduce((n, s) => n + s.morale, 0)).toBeGreaterThan(moraleBefore);
    }
  });

  it('a backed build request jumps the planner queue', () => {
    const col = fresh(3);
    col.village.priority = 'shrine';
    col.community.resources.glimmer = 20;
    runDays(col, 1);
    expect(col.village.projects.some((p) => p.kind === 'shrine')).toBe(true);
  });

  it('settles itself if the player stays silent', () => {
    const col = fresh(3);
    col.community.day = 5;
    maybeConvene(col, new Rng(2));
    expect(col.council.active).not.toBeNull();
    runDays(col, 2);
    expect(col.community.log.some((l) => l.text.startsWith('The council settled it without you'))).toBe(true);
  });
});

describe('nudges', () => {
  it('calm costs Influence and lifts grief', () => {
    const col = fresh();
    col.veil.influence = 50;
    const s = alive(col.community)[0];
    s.griefDays = 4; s.morale = 30;
    expect(nudgeCalm(col, s.id)).toBe(true);
    expect(col.veil.influence).toBe(50 - CALM_COST);
    expect(s.griefDays).toBe(0);
    expect(s.morale).toBeGreaterThan(30);
  });

  it('an omen lights a far place and fails without Influence', () => {
    const col = fresh();
    col.veil.influence = OMEN_COST - 1;
    expect(nudgeOmen(col, 60, 60)).toBe(false);
    col.veil.influence = 40;
    expect(nudgeOmen(col, 60, 60)).toBe(true);
    expect(isExplored(col.world, toTileX(col.world, 60), toTileZ(col.world, 60))).toBe(true);
    expect(col.council.omen).not.toBeNull();
  });
});
