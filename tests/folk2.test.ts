import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { act, faeUnitId, finish, startClearing, verbsFor, type Clearing } from '../src/sim/haunt';
import { breakRule } from '../src/sim/folk';
import { tileX, tileZ } from '../src/sim/world';
import { nudgeOmen } from '../src/sim/council';

const days = (col: Colony, n: number) => { for (let m = 0; m < 1440 * n; m += 10) tick(col, 10); };

describe('the Folk and the village together', () => {
  it('one of the Folk can walk into the Veil with the team', () => {
    const col = createColony(generateWorld(5), createCommunity(5));
    for (const p of col.world.pois) p.discovered = true;
    col.veil.influence += 30;
    const elder = col.folk.beings.find((b) => b.kind === 'elder')!;
    const team = alive(col.community).slice(0, 2).map((s) => s.id);
    // Not while they are only wary.
    expect(typeof startClearing(col, 0, team, elder.id)).toBe('string');
    col.folk.met = true; col.folk.standing = 60;
    const cl = startClearing(col, 0, team, elder.id) as Clearing;
    expect(typeof cl).not.toBe('string');
    const u = cl.units.find((x) => x.id === faeUnitId(elder.id))!;
    expect(u.fae).toBe('elder');
    expect(act(col, cl, u.id, 'ward')).toMatch(/iron/);
    // Speak a true name: the spirit is known at once.
    const s = col.haunts[0].spirits.find((x) => x.fate === 'present')!;
    u.x = tileX(col.world, s.tx) + 1; u.z = tileZ(col.world, s.tz);
    expect(verbsFor(col, cl, u, s).find((v) => v.verb === 'name')?.ok).toBe(true);
    expect(act(col, cl, u.id, 'name', s.id)).toBeNull();
    expect(s.known).toBe(3);
    const before = col.folk.standing;
    finish(col, cl, 'withdrew');
    expect(col.folk.standing).not.toBe(before);
  });

  it('breaking their rules offends them, and someone may be led astray and searched for', () => {
    const col = createColony(generateWorld(6), createCommunity(6));
    const s = alive(col.community)[0];
    const before = col.folk.standing;
    breakRule(col, s, 'cut');
    expect(col.folk.standing).toBeLessThan(before - 4);
    expect(col.folk.offendedUntil).toBeGreaterThan(col.community.day);
    col.folk.standing = 15;
    let seen = false;
    // Kept cross (offerings would otherwise mend it within days), so this is not left to a few dice rolls.
    for (let d = 0; d < 14 && !seen; d++) { col.folk.standing = Math.min(col.folk.standing, 15); days(col, 1); if (col.folk.led) seen = true; }
    expect(seen).toBe(true);
    const led = col.folk.led!;
    // An omen shows the searchers exactly where.
    col.veil.influence += 20;
    nudgeOmen(col, led.x, led.z);
    expect(col.folk.led?.hint.r).toBeLessThan(2);
    days(col, 3);
    expect(col.folk.led?.id === led.id).toBe(false);
    expect(col.community.log.some((l) => /found .* sitting in a ring of toadstools|walked back into the village at dusk/.test(l.text))).toBe(true);
    expect(alive(col.community).some((x) => x.id === led.id)).toBe(true);
  }, 60000);

  it('the Folk send word to the council', () => {
    const col = createColony(generateWorld(7), createCommunity(7));
    col.folk.met = true; col.folk.standing = 50;
    col.community.resources.food += 80; col.community.resources.wood += 40;
    const kinds = new Set<string>();
    for (let d = 0; d < 30; d++) { days(col, 1); for (const p of col.council.active?.proposals ?? []) kinds.add(p.kind); }
    expect([...kinds].some((k) => k.startsWith('folk_'))).toBe(true);
  }, 60000);
});
