import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { Zone, idx, paintZone, toTileX, toTileZ, zoneAllowed } from '../src/sim/world';
import { act, finish, giveDistrict, startClearing, type Clearing } from '../src/sim/haunt';
import { playTurn } from '../src/sim/clearbot';

function ready(seed: number) {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  for (const p of col.world.pois) p.discovered = true;
  col.community.resources.food += 60;
  col.community.resources.glimmer += 10;
  col.veil.influence += 40;
  return col;
}

describe('haunted districts', () => {
  it('every district is occupied, and nothing can be zoned there', () => {
    const col = ready(3);
    const w = col.world;
    expect(col.haunts.length).toBe(w.districts.length);
    for (const h of col.haunts) {
      expect(h.spirits.length).toBeGreaterThan(1);
      const d = w.districts[h.district];
      if (['suburb', 'strip', 'works', 'oldtown'].includes(d.kind)) expect(h.spirits.some((s) => s.kind === 'hollow')).toBe(true);
      w.explored[idx(w, toTileX(w, d.x), toTileZ(w, d.z))] = 255;
      expect(zoneAllowed(w, toTileX(w, d.x), toTileZ(w, d.z), Zone.Home)).toBe(false);
    }
  });

  it('stops time at home while a team is in the Veil', () => {
    const col = ready(4);
    const team = alive(col.community).slice(0, 3).map((s) => s.id);
    // Opening the way costs Influence.
    const inf = col.veil.influence;
    col.veil.influence = 5;
    expect(typeof startClearing(col, 0, team)).toBe('string');
    col.veil.influence = inf;
    const cl = startClearing(col, 0, team);
    expect(typeof cl).not.toBe('string');
    expect(col.veil.influence).toBe(inf - 10);
    const m = col.minute;
    tick(col, 120);
    expect(col.minute).toBe(m);
    finish(col, col.clearing!, 'withdrew');
    tick(col, 120);
    expect(col.minute).toBeGreaterThan(m);
  });

  it('a willing team can quiet a suburb, and the district can be given away', () => {
    let cleared = 0, tried = 0, taken = 0, fled = 0;
    for (const seed of [3, 5, 7, 11, 13, 17]) {
      const col = ready(seed);
      const hi = col.haunts.findIndex((h) => col.world.districts[h.district].kind === 'suburb');
      if (hi < 0) continue;
      tried++;
      const team = [...alive(col.community)].sort((a, b) => b.sight - a.sight);
      // Two who see, two who don't: seers and anchors.
      const pick = [team[0], team[1], team[team.length - 1], team[team.length - 2]].filter(Boolean).map((s) => s.id);
      const cl = startClearing(col, hi, [...new Set(pick)]) as Clearing;
      for (let t = 0; t < 14 && !cl.outcome; t++) playTurn(col, cl);
      taken += cl.units.filter((u) => u.state === 'taken').length;
      fled += cl.units.filter((u) => u.state === 'fled').length;
      if (cl.outcome === 'cleared') {
        cleared++;
        const d = col.haunts[hi].district;
        giveDistrict(col, d, 'village');
        expect(col.haunts[hi].owner).toBe('village');
        const w = col.world, dd = w.districts[d];
        w.explored[idx(w, toTileX(w, dd.x), toTileZ(w, dd.z))] = 255;
        expect(zoneAllowed(w, toTileX(w, dd.x), toTileZ(w, dd.z), Zone.Home)).toBe(true);
      }
    }
    // Hard, but not hopeless; and it costs people something.
    console.log(`suburb clearings: ${cleared}/${tried} cleared, ${fled} rattled, ${taken} taken`);
    expect(cleared).toBeGreaterThanOrEqual(Math.ceil(tried / 3));
    expect(cleared).toBeLessThan(tried + 1);
  });

  it('the taken come home, days or seasons later, changed', () => {
    const col = ready(5);
    const s = alive(col.community)[0];
    const sight = s.sight;
    const cl = startClearing(col, 0, [s.id]) as Clearing;
    cl.units[0].lured = true;
    cl.units[0].nerve = 0;
    act(col, cl, s.id, 'ward'); // breaks while lured
    expect(s.taken).toBe(true);
    expect(s.alive).toBe(false);
    expect(col.taken.length).toBe(1);
    const until = col.taken[0].until;
    while (col.community.day <= until) tick(col, 60);
    expect(s.alive).toBe(true);
    expect(s.taken).toBe(false);
    expect(s.sight).toBeGreaterThanOrEqual(Math.min(100, sight + 15));
    expect(col.community.log.some((l) => /asked what day it was/.test(l.text))).toBe(true);
  }, 60000);

  it('a district given to the Folk becomes their Wild', () => {
    const col = ready(6);
    const h = col.haunts[0];
    h.state = 'cleared';
    const d = col.world.districts[h.district];
    const w = col.world;
    for (let dz = -14; dz <= 14; dz++) for (let dx = -14; dx <= 14; dx++) {
      const tx = toTileX(w, d.x) + dx, tz = toTileZ(w, d.z) + dz;
      if (tx >= 0 && tz >= 0 && tx < w.w && tz < w.h) w.explored[idx(w, tx, tz)] = 255;
    }
    const before = col.folk.standing;
    giveDistrict(col, h.district, 'folk');
    expect(w.zone[idx(w, toTileX(w, d.x) + 3, toTileZ(w, d.z) + 3)]).toBe(Zone.Wild);
    expect(col.folk.standing).toBeGreaterThan(before);
    void paintZone;
  });
});

describe('what remnants want', () => {
  it('something of theirs can be found in their house and given back', () => {
    const col = createColony(generateWorld(3), createCommunity(3));
    for (const p of col.world.pois) p.discovered = true;
    col.veil.influence += 30;
    const hi = col.haunts.findIndex((h) => h.spirits.some((s) => s.kind === 'remnant'));
    const s = col.haunts[hi].spirits.find((x) => x.kind === 'remnant')!;
    s.need = 'object'; s.known = 2;
    const cl = startClearing(col, hi, [alive(col.community)[0].id]) as Clearing;
    const u = cl.units[0];
    u.tx = s.tx + 1; u.tz = s.tz; u.ap = 2;
    expect(act(col, cl, u.id, 'offer_object', s.id)).toMatch(/Search their house/);
    expect(act(col, cl, u.id, 'search', s.id)).toBeNull();
    expect(cl.found[s.id]).toBeTruthy();
    expect(act(col, cl, u.id, 'offer_object', s.id)).toBeNull();
    expect(s.calm).toBe(2);
    expect(cl.log.some((l) => l.includes(cl.found[s.id]))).toBe(true);
  });
});
