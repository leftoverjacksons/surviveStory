import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { idx } from '../src/sim/world';
import { backyardSite, placeBackyard, whyNotBackyard } from '../src/sim/backyard';

describe('trades in the back yard (DESIGN §21.10)', () => {
  it('a household with a house gets a trade at the back of its plot, one at most', () => {
    const col = createColony(generateWorld(5), createCommunity(5));
    col.community.resources.wood += 60; col.community.resources.scrap += 30;
    for (let d = 0; d < 20 && !col.village.buildings.some((b) => b.kind === 'home'); d++) tick(col, 1440);
    col.village.autoPlan = false;
    const home = col.village.buildings.find((b) => b.kind === 'home')!;
    const plot = col.village.plots.find((p) => p.id === home.plot)!;
    for (const b of col.village.buildings.filter((x) => x.plot === plot.id && x.kind !== 'home')) col.village.buildings.splice(col.village.buildings.indexOf(b), 1);
    col.village.projects = col.village.projects.filter((p) => p.plot !== plot.id || p.kind === 'home');
    expect(whyNotBackyard(col, undefined, 'tailor')).toMatch(/back yard/);
    const site = backyardSite(col, plot, 'tailor');
    expect(site).not.toBeNull();
    const w = col.world, tiles = new Set(plot.tiles);
    for (let dz = 0; dz < site!.foot.d; dz++) for (let dx = 0; dx < site!.foot.w; dx++) expect(tiles.has(idx(w, site!.foot.tx + dx, site!.foot.tz + dz))).toBe(true);
    const p = placeBackyard(col, plot.id, 'tailor');
    if (typeof p === 'string') throw new Error(p);
    expect(p.household).toBe(plot.household);
    expect(p.clad).toEqual(plot.house.clad);
    expect(placeBackyard(col, plot.id, 'smokehouse')).toMatch(/already keeps a trade/);
  }, 120000);

  it('self-planning villages put their trades in yards, and the household works them', () => {
    const col = createColony(generateWorld(5), createCommunity(5));
    col.community.resources.wood += 60; col.community.resources.scrap += 30;
    for (let d = 0; d < 32; d++) tick(col, 1440);
    const trades = col.village.buildings.filter((b) => ['toolshop', 'tailor', 'smokehouse'].includes(b.kind));
    expect(trades.length).toBeGreaterThan(0);
    for (const b of trades) {
      expect(b.household).toBeTruthy();
      const h = col.village.households.find((x) => x.id === b.household)!;
      expect(alive(col.community).some((s) => h.members.includes(s.id) && s.role === 'maker')).toBe(true);
    }
  }, 120000);
});
