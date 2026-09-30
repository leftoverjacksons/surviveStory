import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony, tick, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { HAUNT_RADIUS, giveDistrict } from '../src/sim/haunt';
import { RESTORE, requestRestore } from '../src/sim/restore';
import { canPlace, completeProject, footAt, placeProject } from '../src/sim/buildings';
import { fireFor, whyNotHamletFire } from '../src/sim/hearth';
import { idx, inBounds, reveal, toTileX, toTileZ } from '../src/sim/world';

/** A cleared district of the village's, with a restored house in it and a family living there. */
function resettled(): { col: Colony; home: { x: number; z: number }; family: number[] } | null {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const col = createColony(generateWorld(seed), createCommunity(seed));
    const w = col.world, v = col.village;
    const r = w.ruins.find((x) => RESTORE[x.kind]?.as === 'home' && Math.hypot(x.x - w.campfire.x, x.z - w.campfire.z) > 40);
    if (!r) continue;
    const d = w.districts[r.district], h = col.haunts.find((x) => x.district === d.id)!;
    reveal(w, d.x, d.z, HAUNT_RADIUS + 4);
    h.state = 'cleared';
    // As a real clearing leaves it: nothing haunts its tiles any more.
    const cx = toTileX(w, d.x), cz = toTileZ(w, d.z);
    for (let dz = -HAUNT_RADIUS; dz <= HAUNT_RADIUS; dz++) for (let dx = -HAUNT_RADIUS; dx <= HAUNT_RADIUS; dx++) if (inBounds(w, cx + dx, cz + dz)) w.haunted![idx(w, cx + dx, cz + dz)] = 0;
    giveDistrict(col, d.id, 'village');
    const p = requestRestore(col, r.id);
    if (typeof p === 'string') continue;
    completeProject(w, v, col.community, p);
    const b = v.buildings.find((x) => x.ruin === r.id)!;
    const who = alive(col.community).filter((s) => s.age >= 16).slice(0, 2).map((s) => s.id);
    for (const hh of v.households) hh.members = hh.members.filter((id) => !who.includes(id));
    v.households.push({ id: v.nextId++, members: who, home: b.id, since: 1, petitioned: 0 });
    v.bedsDirty = true;
    return { col, home: b.door, family: who };
  }
  return null;
}

describe('resettling a district: a hamlet fire (DESIGN §28)', () => {
  it('only in a district the village has resettled, and away from the old fire', () => {
    const col = createColony(generateWorld(2), createCommunity(2));
    const w = col.world;
    expect(whyNotHamletFire(col, w.campfire.x + 5, w.campfire.z)).toMatch(/district of the village/);
    const t = resettled()!;
    expect(t).not.toBeNull();
    expect(whyNotHamletFire(t.col, t.col.world.campfire.x + 3, t.col.world.campfire.z)).toMatch(/district the village has resettled|Too close/);
  });

  it('the family in the resettled district gathers at their own fire of an evening', () => {
    const t = resettled()!;
    const { col, home, family } = t;
    const w = col.world, v = col.village;
    // Lay the fire near their door.
    let placed = false;
    for (let r = 3; r < 12 && !placed; r++) for (let a = 0; a < 16 && !placed; a++) {
      const x = home.x + Math.cos(a) * r, z = home.z + Math.sin(a) * r;
      if (whyNotHamletFire(col, x, z)) continue;
      const { foot, facing } = footAt('hearth', toTileX(w, x), toTileZ(w, z), 0);
      if (!canPlace(w, v, 'hearth', foot).ok) continue;
      const p = placeProject(w, v, col.community, 'hearth', foot, facing);
      if (typeof p !== 'string') { completeProject(w, v, col.community, p); placed = true; }
    }
    expect(placed).toBe(true);
    const fire = v.buildings.find((b) => b.kind === 'hearth')!;
    expect(fire.name).toMatch(/^The fire at /);
    expect(fireFor(col, family[0]).id).toBe(fire.id);
    // Others still use the old fire.
    const other = alive(col.community).find((s) => !family.includes(s.id))!;
    expect(fireFor(col, other.id).id).toBe(0);
    // Over a couple of evenings, one of them sits at the hamlet's fire.
    let seen = false;
    for (let m = 0; m < 2 * 1440 && !seen; m += 10) {
      tick(col, 10);
      seen = col.agents.some((a) => family.includes(a.id) && a.task?.kind === 'social' && Math.hypot(a.x - fire.inside.x, a.z - fire.inside.z) < 3);
    }
    expect(seen).toBe(true);
  }, 120000);
});
