import { describe, expect, it } from 'vitest';
import { createCommunity, withRng } from '../src/sim/community';
import { createColony, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { maybeConvene, resolveCouncil } from '../src/sim/council';
import { giveDistrict } from '../src/sim/haunt';
import { RUIN_HOUSES, folkRuins, housing, inFolkCountry, knoweSite, raiseKnowe, roomFor, whyNotKnowe } from '../src/sim/townhouse';
import { cellAt, growMycelium } from '../src/sim/mycelium';
import { reveal } from '../src/sim/world';

const fresh = (seed = 7) => createColony(generateWorld(seed), createCommunity(seed));
/** Clear a district as a team would (no owner yet), with its ground explored. */
function quieten(col: Colony, i = 0) {
  const h = col.haunts[i], d = col.world.districts[h.district];
  h.state = 'cleared';
  reveal(col.world, d.x, d.z, 20);
  return { h, d };
}

describe('cleared districts become places (DESIGN §26)', () => {
  it('the council asks who a quiet district belongs to, and the answer is carried out', () => {
    const col = fresh();
    const { h, d } = quieten(col);
    col.council.nextDay = 0;
    withRng(col.community, (rng) => maybeConvene(col, rng));
    expect(col.council.active?.question?.kind).toBe('district');
    expect(col.council.active!.question!.title).toContain(d.name);
    const p = col.council.active!.proposals.find((x) => x.kind === 'district_folk')!;
    resolveCouncil(col, p.id);
    expect(h.owner).toBe('folk');
  });

  it('a district given to the Folk is their country: knowes may rise there, far from the hill, and they live in its old buildings', () => {
    const col = fresh();
    const { h, d } = quieten(col);
    const m = col.world.folk.mound;
    // Far from the hill: refused before, allowed once it is theirs (if the spot is otherwise fine).
    const far = Math.hypot(d.x - m.x, d.z - m.z) > m.r + 30;
    giveDistrict(col, h.district, 'folk');
    expect(inFolkCountry(col, d.x, d.z)).toBe(true);
    if (far) for (let a = 0; a < 12; a++) {
      const why = whyNotKnowe(col, d.x + Math.cos(a) * 6, d.z + Math.sin(a) * 6);
      expect(why ?? '').not.toMatch(/Too far/);
    }
    // They live in its ruins.
    expect(folkRuins(col).length).toBeGreaterThan(0);
    expect(roomFor(col)).toBe(housing(col.folk) + folkRuins(col).length * RUIN_HOUSES);
    // With the hill crowded round, the next knowe goes to their country.
    for (let i = 0; i < 12; i++) if (!raiseKnowe(col, 'dwelling')) break;
    const site = knoweSite(col);
    if (site) expect(inFolkCountry(col, site.x, site.z) || Math.hypot(site.x - m.x, site.z - m.z) < m.r + 30).toBe(true);
  });

  it('the mycelium runs out to their country', () => {
    const col = fresh();
    const { h, d } = quieten(col);
    giveDistrict(col, h.district, 'folk');
    growMycelium(col, 20);
    const my = col.mycelium!;
    expect(my.m[cellAt(my, col.world, d.x, d.z)]).toBeGreaterThan(0.5);
  });
});
