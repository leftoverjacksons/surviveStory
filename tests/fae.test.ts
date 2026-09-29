import { describe, expect, it } from 'vitest';
import { alive, createCommunity, withRng } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { addFae, breakRule, leaveOffering } from '../src/sim/folk';
import { classOf, faeDaily, faeView, gentryView, saucersAtDusk, visitTarget, weeVisit } from '../src/sim/fae';

const fresh = (seed = 5) => {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  // A household with a roof: the first building will do for a door.
  const s = alive(col.community).slice(0, 2);
  col.village.households = [{ id: 1, members: s.map((x) => x.id), home: col.village.buildings[0].id, since: 1, petitioned: 0 }];
  return col;
};
const wee = (col: ReturnType<typeof fresh>) => col.folk.beings.find((b) => classOf(b.kind) === 'wee')!;
const call = (col: ReturnType<typeof fresh>) => withRng(col.community, (rng) => {
  const b = wee(col);
  b.visited = undefined;
  visitTarget(col, b, rng);
  return weeVisit(col, b, rng);
});

describe('the Gentry and the Wee Folk (DESIGN §25.2)', () => {
  it('two peoples: the elders and pipers are Gentry, hobs and sprites are Wee Folk', () => {
    expect(classOf('elder')).toBe('gentry');
    expect(classOf('piper')).toBe('gentry');
    expect(classOf('hob')).toBe('wee');
    expect(classOf('sprite')).toBe('wee');
  });

  it('a saucer at the door is left by those fond of the Folk, and repaid', () => {
    const col = fresh();
    const h = col.village.households[0];
    const [s] = h.members.map((id) => col.community.survivors.find((x) => x.id === id)!);
    s.fae = 30;
    col.community.resources.food = 100;
    expect(saucersAtDusk(col)).toBe(1);
    expect(h.saucer).toBe(col.community.day);
    expect(col.community.resources.food).toBeCloseTo(99.5, 5);
    const before = faeView(s);
    const did = call(col);
    expect(did).toMatch(/saucer|milk out/);
    expect(faeView(s)).toBeGreaterThan(before);
    expect(h.saucer).toBe(-col.community.day);
  });

  it('with no saucer and the Folk cross, mischief that costs something, and is remembered', () => {
    const col = fresh();
    col.folk.standing = 10;
    col.folk.level = 20; // no nightly cap in the way
    const h = col.village.households[0];
    const who = h.members.map((id) => col.community.survivors.find((x) => x.id === id)!);
    const food = col.community.resources.food = 60, wood = col.community.resources.wood = 60;
    let did = 0;
    for (let k = 0; k < 40; k++) if (call(col)) did++;
    expect(did).toBeGreaterThan(5);
    expect(h.hit).toBe(col.community.day);
    expect(who.some((s) => faeView(s) < 0)).toBe(true);
    expect(who.some((s) => s.memories.some((m) => /tools|sour|woodpile|dreamed|nets/i.test(m.text)))).toBe(true);
    // Something real was lost or moved.
    const lostFood = col.community.resources.food < food, movedWood = col.community.resources.wood < wood;
    const hidden = who.some((s) => s.toolsHidden === col.community.day);
    expect(lostFood || movedWood || hidden).toBe(true);
  });

  it('a household that turns against the Folk nails iron over the door: no mischief, no favours', () => {
    const col = fresh();
    const h = col.village.households[0];
    for (const id of h.members) col.community.survivors.find((x) => x.id === id)!.fae = -60;
    const st = col.folk.standing;
    faeDaily(col);
    expect(h.iron).toBe(true);
    expect(col.folk.standing).toBeLessThan(st);
    col.folk.standing = 5;
    expect(call(col)).toBeNull();
  });

  it('the Gentry warm to those who bring offerings, and cool to those who cut in the Wild', () => {
    const col = fresh();
    const [a, b] = alive(col.community);
    leaveOffering(col, a);
    expect(gentryView(col.folk, a.id)).toBeGreaterThan(0);
    breakRule(col, b, 'cut');
    expect(gentryView(col.folk, b.id)).toBeLessThan(0);
    // They hold opinions of each other too, once a day has passed.
    addFae(col.folk, col.world, 'piper', 1);
    faeDaily(col);
    const g = col.folk.beings.filter((x) => classOf(x.kind) === 'gentry');
    expect(Object.keys(g[0].kin ?? {}).length).toBe(col.folk.beings.length - 1);
  });

  it('left to run, the Wee Folk come calling at night', () => {
    const col = createColony(generateWorld(4), createCommunity(4));
    col.folk.standing = 15;
    for (let d = 0; d < 24; d++) tick(col, 1440);
    const calls = col.community.log.filter((l) => /saucer|woodpile|tools|soured|shutters|nets|boots|hair|milk out|kindling/.test(l.text));
    expect(calls.length).toBeGreaterThan(0);
  }, 120000);
});

describe('the Restless (DESIGN §25.2)', () => {
  it('those laid to rest drift home to the hill by night, and every third quickens one of the Wee Folk', async () => {
    const { sendHome, QUICKEN } = await import('../src/sim/fae');
    const col = createColony(generateWorld(6), createCommunity(6));
    const m = col.world.folk.mound;
    const n0 = col.folk.beings.length;
    for (let i = 0; i < QUICKEN; i++) sendHome(col, `the ${['Lamp', 'Hedge', 'Girl'][i]} of the old road`, m.x + 30 + i, m.z + 10, 'the old road');
    expect(col.folk.restless!.length).toBe(QUICKEN);
    // By day they wait; they come by night.
    for (let d = 0; d < 3 && col.folk.restless!.length; d++) tick(col, 1440);
    expect(col.folk.restless!.length).toBe(0);
    expect(col.folk.memory).toBe(QUICKEN);
    expect(col.folk.beings.length).toBe(n0 + 1);
    expect(col.community.log.some((l) => /pale light came up the path/.test(l.text))).toBe(true);
    expect(col.community.log.some((l) => /quickened/.test(l.text))).toBe(true);
  }, 120000);
});
