import { describe, expect, it } from 'vitest';
import { alive, bondValue, createCommunity, adjustBond } from '../src/sim/community';
import { createColony, tick, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { COURT_DAYS, activeGathering, phaseOf, scheduleGathering } from '../src/sim/gatherings';
import { householdOf } from '../src/sim/homes';

const fresh = (seed = 4) => createColony(generateWorld(seed), createCommunity(seed));
const until = (col: Colony, minute: number) => { while (col.minute < minute) tick(col, Math.min(10, minute - col.minute)); };

describe('gatherings (DESIGN §24.8)', () => {
  it('a festival is held: people come, eat, dance and play, and those who came are lifted', () => {
    const col = fresh();
    until(col, 2 * 1440 + 9 * 60);
    const g = scheduleGathering(col, 'festival', 'Greening');
    expect(Math.floor(g.start / 1440)).toBe(2); // this evening
    until(col, g.start + 120);
    expect(activeGathering(col)).toBe(g);
    expect(phaseOf(g, col.minute)).toBe('feast');
    const eating = col.agents.filter((a) => a.anim === 'eat').length;
    expect(eating).toBeGreaterThanOrEqual(Math.ceil(col.agents.length / 2));
    until(col, g.start + 200);
    expect(col.agents.some((a) => a.anim === 'dance')).toBe(true);
    expect(g.players.length).toBeGreaterThanOrEqual(1);
    expect(col.agents.filter((a) => a.anim === 'play').length).toBe(g.players.length);
    const before = new Map(alive(col.community).map((s) => [s.id, s.morale]));
    until(col, g.end + 10);
    expect(g.done).toBe(true);
    expect(g.attended.length).toBeGreaterThanOrEqual(Math.ceil(col.agents.length / 2));
    const lifted = g.attended.filter((id) => (col.community.survivors.find((s) => s.id === id)!.morale) >= (before.get(id) ?? 0));
    expect(lifted.length).toBeGreaterThan(g.attended.length / 2);
    expect(col.community.log.some((l) => l.text.startsWith('Greening:'))).toBe(true);
  });

  it('close unattached adults court, marry at a wedding, and share a household', () => {
    const col = fresh(6);
    until(col, 1440 + 8 * 60);
    const [a, b] = alive(col.community).filter((s) => s.age >= 18);
    adjustBond(col.community, a.id, b.id, 90 - bondValue(col.community, a.id, b.id));
    // Force the start of the courtship (it's a daily chance), then let it run.
    a.courting = b.id; b.courting = a.id; a.courtingSince = b.courtingSince = col.community.day - COURT_DAYS;
    for (let d = 0; d < 12 && !(col.gatherings ?? []).some((g) => g.kind === 'wedding'); d++) {
      adjustBond(col.community, a.id, b.id, 90 - bondValue(col.community, a.id, b.id));
      until(col, (Math.floor(col.minute / 1440) + 1) * 1440 + 60);
    }
    const w = (col.gatherings ?? []).find((g) => g.kind === 'wedding');
    expect(new Set(w?.couple)).toEqual(new Set([a.id, b.id]));
    until(col, w!.start + 35);
    expect(phaseOf(w!, col.minute)).toBe('vows');
    until(col, w!.end + 10);
    expect(a.partner).toBe(b.id);
    expect(b.partner).toBe(a.id);
    expect(householdOf(col.village, a.id)).toBe(householdOf(col.village, b.id));
    expect(col.community.log.some((l) => /were married under the arch/.test(l.text))).toBe(true);
  });
});
