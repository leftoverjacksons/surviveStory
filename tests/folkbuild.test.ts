import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { Zone, idx, tileX, tileZ, toTileX, toTileZ } from '../src/sim/world';
import { FOLK_WORKS, WILD_RADIUS, folkNeeds, orderFolkWork, whyNotFolkWork } from '../src/sim/folk';

function wildSpot(col: ReturnType<typeof createColony>) {
  const w = col.world, m = w.folk.mound;
  for (let d = m.r + 2; d < WILD_RADIUS; d += 0.7) for (let a = 0; a < 24; a++) {
    const x = tileX(w, toTileX(w, m.x + Math.cos(a / 24 * 6.283) * d)), z = tileZ(w, toTileZ(w, m.z + Math.sin(a / 24 * 6.283) * d));
    if (!whyNotFolkWork(col, x, z)) return { x, z };
  }
  throw new Error('no spot');
}

describe('the Folk as a second city builder (DESIGN §21.8)', () => {
  it('orders go only in the Wild, once the Folk are met', () => {
    const col = createColony(generateWorld(3), createCommunity(3));
    col.village.autoPlan = false;
    const c = col.world.campfire;
    expect(whyNotFolkWork(col, c.x, c.z)).toMatch(/met/);
    col.folk.met = true;
    expect(whyNotFolkWork(col, c.x, c.z)).toMatch(/Wild/);
    const p = wildSpot(col);
    expect(col.world.zone[idx(col.world, toTileX(col.world, p.x), toTileZ(col.world, p.z))]).toBe(Zone.Wild);
    expect(typeof orderFolkWork(col, 'bower', p.x, p.z)).not.toBe('string');
    expect(orderFolkWork(col, 'bower', p.x, p.z)).toMatch(/Too close/);
  });

  it('orders are built at night, from dew and song', () => {
    const col = createColony(generateWorld(4), createCommunity(4));
    col.village.autoPlan = false;
    col.folk.met = true; col.folk.dew = 20; col.folk.song = 20; col.folk.standing = 50;
    const p = wildSpot(col);
    const k = orderFolkWork(col, 'lantern', p.x, p.z);
    if (typeof k === 'string') throw new Error(k);
    // By day, nothing happens.
    while ((col.minute % 1440) / 60 < 8) tick(col, 30);
    tick(col, 8 * 60);
    expect(k.built).toBe(0);
    for (let n = 0; n < 5 && k.built !== undefined; n++) tick(col, 1440);
    expect(k.built).toBeUndefined();
    expect(col.folk.dew).toBeLessThan(20 + 5 * 3); // spent some
    expect(col.folk.news.some((x) => /finished a glow-lantern/.test(x.text))).toBe(true);
    void FOLK_WORKS;
  }, 60000);

  it('the hill grows only once rest, dance and light are seen to', () => {
    const col = createColony(generateWorld(5), createCommunity(5));
    col.village.autoPlan = false;
    const f = col.folk;
    f.met = true; f.focus = 'home';
    col.council.nextDay = 9999;
    const gate = () => folkNeeds(col).filter((x) => x.gate).every((x) => x.met);
    expect(gate()).toBe(false);
    for (let d = 0; d < 12; d++) { f.standing = 70; f.offeredDay = col.community.day; tick(col, 1440); }
    expect(f.level).toBe(0);
    expect(f.growth).toBeLessThanOrEqual(0.95);
    // Ask for bowers and a lantern, and give them the means.
    f.dew = 40; f.song = 40;
    for (let i = 0; i < 2; i++) { const p = wildSpot(col); orderFolkWork(col, 'bower', p.x, p.z); }
    const p = wildSpot(col); orderFolkWork(col, 'lantern', p.x, p.z);
    for (let d = 0; d < 14 && f.level === 0; d++) { f.standing = 70; f.offeredDay = col.community.day; f.dew = Math.max(f.dew, 20); f.song = Math.max(f.song, 20); tick(col, 1440); }
    expect(gate() || f.level > 0).toBe(true);
    expect(f.level).toBeGreaterThan(0);
  }, 60000);
});
