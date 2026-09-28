import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { canPlace, footAt, placeProject } from '../src/sim/buildings';
import { declineRequest, grantWork, putFirst, requestsDaily, requestsOf, type Request } from '../src/sim/requests';
import { waitingHouseholds } from '../src/sim/homes';
import { toTileX, toTileZ } from '../src/sim/world';

function grown(seed = 3, days = 24): Colony {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  for (let d = 0; d < days; d++) tick(col, 1440);
  return col;
}

describe('the request tray (DESIGN §23.4)', () => {
  const col = grown();

  it('home petitions never come to the council', () => {
    const c = createColony(generateWorld(4), createCommunity(4));
    for (let m = 0; m < 1440 * 30; m += 60) {
      tick(c, 60);
      expect(c.council.active?.proposals.some((p) => p.kind === 'home') ?? false).toBe(false);
    }
  }, 120000);

  it('a household waiting for a home has a standing ask, and can be put first in line', () => {
    const c = grown(5, 10);
    c.village.autoPlan = false;
    requestsDaily(c);
    const waiting = waitingHouseholds(c.village);
    for (const h of waiting) expect(requestsOf(c).some((q) => q.kind === 'plot' && q.household === h.id)).toBe(true);
    const q = requestsOf(c).find((x) => x.kind === 'plot');
    if (!q) return; // everyone housed on this seed
    expect(putFirst(c, q.id)).toBe(true);
    expect(c.village.homeQueue[0]).toBe(q.household);
    expect(declineRequest(c, q.id)).toBe(false); // a home ask waits; it can't be refused
  }, 120000);

  it('placing what was asked for, near their house, fulfils the ask and gladdens the asker', () => {
    const s = alive(col.community)[0];
    const q: Request = { id: 9001, kind: 'lantern', by: s.id, x: col.world.campfire.x + 6, z: col.world.campfire.z + 6, since: col.community.day, until: col.community.day + 6, text: 'test' };
    requestsOf(col).push(q);
    const w = col.world;
    let placed = false;
    for (let r = 1; r < 6 && !placed; r++) for (let a = 0; a < 12 && !placed; a++) {
      const { foot, facing } = footAt('lantern', toTileX(w, q.x) + Math.round(Math.cos(a) * r), toTileZ(w, q.z) + Math.round(Math.sin(a) * r), 0);
      if (canPlace(w, col.village, 'lantern', foot).ok) placed = typeof placeProject(w, col.village, col.community, 'lantern', foot, facing) !== 'string';
    }
    expect(placed).toBe(true);
    const before = s.morale;
    requestsDaily(col);
    expect(requestsOf(col).some((x) => x.id === 9001)).toBe(false);
    expect(s.morale).toBeGreaterThan(before);
  });

  it('declining costs a little; an ask left too long fades', () => {
    const s = alive(col.community)[1];
    requestsOf(col).push({ id: 9002, kind: 'shrine', by: s.id, x: 900, z: 900, since: 1, until: col.community.day + 5, text: 'test' });
    const m0 = s.morale;
    expect(declineRequest(col, 9002)).toBe(true);
    expect(s.morale).toBeLessThan(m0);
    requestsOf(col).push({ id: 9003, kind: 'shrine', by: s.id, x: 900, z: 900, since: 1, until: col.community.day - 1, text: 'test' });
    requestsDaily(col);
    expect(requestsOf(col).some((x) => x.id === 9003)).toBe(false);
    expect(s.memories.some((mm) => mm.text.includes('nobody answered'))).toBe(true);
  });

  it('letting someone change their work does it', () => {
    const s = alive(col.community).find((x) => x.role !== 'scout')!;
    requestsOf(col).push({ id: 9004, kind: 'work', by: s.id, role: 'scout', x: 0, z: 0, since: 1, until: col.community.day + 5, text: 'test' });
    expect(grantWork(col, 9004)).toBe(true);
    expect(s.role).toBe('scout');
    requestsDaily(col);
    expect(requestsOf(col).some((x) => x.id === 9004)).toBe(false);
  });

  it('asks come in on their own over time', () => {
    const c = grown(2, 40);
    const all = requestsOf(c).length + c.community.log.filter((l) => l.text.includes('got what they asked for')).length;
    expect(all).toBeGreaterThan(0);
  }, 120000);
});
