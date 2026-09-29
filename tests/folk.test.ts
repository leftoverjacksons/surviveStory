import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { SITE_KINDS } from '../src/sim/sites';
import { Zone, heightAt, idx, paintZone, toTileX, toTileZ } from '../src/sim/world';
import { WILD_RADIUS, folkDaily, landWanted } from '../src/sim/folk';

const days = (col: ReturnType<typeof createColony>, n: number) => { for (let m = 0; m < 1440 * n; m += 10) tick(col, 10); };

describe('the Folk', () => {
  it('have a hill near every starting site, with land and paths of their own', () => {
    SITE_KINDS.forEach((kind, k) => {
      const w = generateWorld(20 + k, undefined, kind);
      const m = w.folk.mound;
      const d = Math.hypot(m.x, m.z);
      expect(d).toBeGreaterThan(24);
      expect(d).toBeLessThan(46);
      // A real hill, standing above its own foot.
      const foot = heightAt(w, m.x + Math.cos(m.door) * (m.r + 1.5), m.z + Math.sin(m.door) * (m.r + 1.5));
      expect(heightAt(w, m.x, m.z) - foot).toBeGreaterThan(1.2);
      let wild = 0, path = 0;
      for (let i = 0; i < w.zone.length; i++) { if (w.zone[i] === Zone.Wild) wild++; if (w.folk.path[i]) path++; }
      expect(wild).toBeGreaterThan(150);
      expect(path).toBeGreaterThan(30);
      // Well clear of the old districts, and explored from the start.
      for (const q of w.districts) expect(Math.hypot(q.x - m.x, q.z - m.z)).toBeGreaterThan(30);
      expect(w.explored[idx(w, toTileX(w, m.x), toTileZ(w, m.z))]).toBe(255);
    });
  });

  it('are never built across, and their woods are never cut unnoticed', () => {
    const col = createColony(generateWorld(7), createCommunity(7));
    days(col, 30);
    const w = col.world;
    for (const b of col.village.buildings) {
      for (let dz = 0; dz < b.foot.d; dz++) for (let dx = 0; dx < b.foot.w; dx++) {
        const i = idx(w, b.foot.tx + dx, b.foot.tz + dz);
        expect(w.folk.path[i]).toBe(0);
        expect(w.zone[i]).not.toBe(Zone.Wild);
      }
    }
    // Their woods are cut only by a village out of firewood in the cold (colony.ts#pickTree), and never unnoticed.
    const wildCut = w.trees.filter((t) => t.felled && !t.planted && w.zone[idx(w, t.tx, t.tz)] === Zone.Wild).length;
    if (wildCut) expect(col.community.log.some((l) => /cut a tree (in the Wild|near)/.test(l.text))).toBe(true);
  }, 60000);

  it('warm to offerings, and sour when their land is taken', () => {
    const col = createColony(generateWorld(8), createCommunity(8));
    days(col, 20);
    const warmed = col.folk.standing;
    expect(warmed).toBeGreaterThan(45);
    expect(col.folk.offeredDay).toBeGreaterThan(10);
    // Take back most of their land.
    const m = col.world.folk.mound;
    paintZone(col.world, m.x, m.z, WILD_RADIUS, Zone.Home);
    // Their next day's reckoning (a council may give land back soon after, so look straight away).
    folkDaily(col);
    expect(col.folk.standing).toBeLessThan(warmed - 8);
    expect(col.folk.news.some((n) => /edge of their land/.test(n.text))).toBe(true);
  }, 60000);

  it('grow only with room, and help at night when asked', () => {
    const col = createColony(generateWorld(9), createCommunity(9));
    col.folk.focus = 'village';
    col.folk.standing = 65;
    col.council.nextDay = 9999; // no council: nobody grants them land here
    const work0 = col.village.projects.reduce((s, p) => s + p.work, 0);
    days(col, 12);
    expect(col.folk.news.some((n) => /In the night|In the morning/.test(n.text))).toBe(true);
    expect(col.village.projects.reduce((s, p) => s + p.work, 0)).toBeGreaterThan(work0);
    // With the land they have, they cannot grow past what it allows.
    col.folk.standing = 80; col.folk.level = 3; col.folk.growth = 0.9;
    days(col, 3);
    expect(col.folk.level).toBe(3);
    expect(landWanted(col.folk)).toBeGreaterThan(col.folk.land);
  }, 60000);
});
