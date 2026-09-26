import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng';
import {
  alive, bondValue, createCommunity, dailyRollover, killSurvivor, recruit,
} from '../src/sim/community';

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('stays in [0, 1)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('Community', () => {
  it('produces identical histories from identical seeds', () => {
    const a = createCommunity(123), b = createCommunity(123);
    for (let i = 0; i < 30; i++) { dailyRollover(a); dailyRollover(b); }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('creates bonds between every pair of founders', () => {
    const c = createCommunity(5, 5);
    expect(c.bonds.length).toBe((5 * 4) / 2);
  });

  it('death is permanent and hurts close friends more than strangers', () => {
    const c = createCommunity(11, 4);
    const [dead, close, stranger] = c.survivors;
    for (const s of c.survivors) { s.traits = []; s.morale = 70; }
    c.bonds.forEach((b) => (b.value = 0));
    c.bonds.find((b) => [b.a, b.b].includes(dead.id) && [b.a, b.b].includes(close.id))!.value = 80;

    const reports = killSurvivor(c, dead.id, 'test');
    expect(dead.alive).toBe(false);
    expect(alive(c).length).toBe(3);

    const lossClose = reports.find((r) => r.survivorId === close.id)!.moraleLoss;
    const lossStranger = reports.find((r) => r.survivorId === stranger.id)!.moraleLoss;
    expect(lossClose).toBeGreaterThan(lossStranger * 3);
    expect(close.griefDays).toBeGreaterThan(0);
    expect(close.memories.at(-1)!.text).toContain(dead.name);
    expect(killSurvivor(c, dead.id, 'again')).toEqual([]);
  });

  it('grief fades over days', () => {
    const c = createCommunity(2, 3);
    c.survivors[1].griefDays = 2;
    dailyRollover(c); dailyRollover(c);
    expect(c.survivors[1].griefDays).toBe(0);
  });

  it('recruits join with new bonds to everyone living', () => {
    const c = createCommunity(21, 3);
    const s = recruit(c);
    for (const o of c.survivors) if (o !== s) expect(Number.isFinite(bondValue(c, s.id, o.id))).toBe(true);
    expect(c.bonds.length).toBe(3 + 3);
  });
});
