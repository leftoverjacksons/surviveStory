import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { Rng } from '../src/sim/rng';
import { toTileX, toTileZ } from '../src/sim/world';
import { canPlace, footAt, placeProject } from '../src/sim/buildings';
import { claimPlot, outlinePlot } from '../src/sim/homes';
import { requestRestore } from '../src/sim/restore';
import type { Colony } from '../src/sim/colony';

function manual(seed: number) {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  col.village.autoPlan = false;
  return col;
}

/** Try rectangles around the fire until one makes a good plot. */
function findPlot(col: Colony, w = 8, d = 7) {
  const c = col.world.campfire;
  for (let r = 8; r <= 20; r += 2) for (let a = 0; a < 16; a++) {
    const x = c.x + Math.cos((a / 16) * Math.PI * 2) * r, z = c.z + Math.sin((a / 16) * Math.PI * 2) * r;
    const pts = [{ x: x - w / 2, z: z - d / 2 }, { x: x + w / 2, z: z - d / 2 }, { x: x + w / 2, z: z + d / 2 }, { x: x - w / 2, z: z + d / 2 }];
    const plan = outlinePlot(col.world, col.village, pts, new Rng(7));
    if (typeof plan !== 'string') return { pts, plan };
  }
  return null;
}

describe('the build menu (DESIGN §21)', () => {
  it('rejects plots that are too small or run over things, and says why', () => {
    const col = manual(3);
    const c = col.world.campfire;
    const ok = findPlot(col)!.pts;
    const m = { x: (ok[0].x + ok[2].x) / 2, z: (ok[0].z + ok[2].z) / 2 };
    const tiny = [{ x: m.x - 1.5, z: m.z - 1.5 }, { x: m.x + 1.5, z: m.z - 1.5 }, { x: m.x + 1.5, z: m.z + 1.5 }];
    expect(outlinePlot(col.world, col.village, tiny, new Rng(1))).toMatch(/small/);
    const overFire = [{ x: c.x - 5, z: c.z - 5 }, { x: c.x + 5, z: c.z - 5 }, { x: c.x + 5, z: c.z + 5 }, { x: c.x - 5, z: c.z + 5 }];
    expect(typeof outlinePlot(col.world, col.village, overFire, new Rng(1))).toBe('string');
    expect(outlinePlot(col.world, col.village, tiny.slice(0, 2), new Rng(1))).toMatch(/three/);
  });

  it('a drawn plot gets a house near its front, and a waiting household builds there', () => {
    for (const seed of [3, 5]) {
      const col = manual(seed);
      const found = findPlot(col);
      expect(found).not.toBeNull();
      const plot = claimPlot(col, found!.plan, new Rng(9));
      // The house stands inside the plot, nearer the front edge than the back.
      const A = plot.corners[0], B = plot.corners[1];
      const mid = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
      const far = Math.max(...plot.corners.map((p) => Math.hypot(p.x - mid.x, p.z - mid.z)));
      expect(Math.hypot(plot.hc.x - mid.x, plot.hc.z - mid.z)).toBeLessThan(far * 0.75);
      // Nobody draws a second plot: the only home anyone starts is on it.
      for (let d = 0; d < 14 && !col.village.projects.some((p) => p.kind === 'home'); d++) tick(col, 1440);
      const homes = col.village.projects.filter((p) => p.kind === 'home');
      expect(homes.length).toBeGreaterThan(0);
      expect(homes.every((p) => p.plot === plot.id)).toBe(true);
      expect(plot.household).toBeGreaterThan(0);
    }
  }, 120000);

  it('with the player planning, the village places nothing by itself', () => {
    const col = manual(4);
    col.community.resources.wood += 80; col.community.resources.scrap += 40;
    // The first garden is staked out at the start (createColony); after that, nothing.
    const first = new Set(col.village.projects.map((p) => p.id));
    for (let d = 0; d < 10; d++) tick(col, 1440);
    const own = col.village.projects.filter((p) => !first.has(p.id)).filter((p) => ['hut', 'cellar', 'workshop', 'garden', 'shrine', 'lantern', 'home', 'restore'].includes(p.kind));
    expect(own.map((p) => `${p.kind} ${p.name}`)).toEqual([]);
  }, 120000);

  it('places a building where it fits, and refuses where it does not', () => {
    const col = manual(5);
    const w = col.world, c = w.campfire;
    // On the fire: refused, with a reason.
    const bad = footAt('cellar', toTileX(w, c.x), toTileZ(w, c.z), 0);
    const no = placeProject(w, col.village, col.community, 'cellar', bad.foot, bad.facing);
    expect(typeof no).toBe('string');
    let placed = null;
    for (let r = 8; r <= 18 && !placed; r++) for (let a = 0; a < 12 && !placed; a++) {
      const tx = toTileX(w, c.x + Math.cos(a / 12 * Math.PI * 2) * r), tz = toTileZ(w, c.z + Math.sin(a / 12 * Math.PI * 2) * r);
      for (let turn = 0; turn < 4 && !placed; turn++) {
        const { foot, facing } = footAt('cellar', tx, tz, turn);
        if (!canPlace(w, col.village, 'cellar', foot).ok) continue;
        const p = placeProject(w, col.village, col.community, 'cellar', foot, facing);
        if (typeof p !== 'string') placed = p;
      }
    }
    expect(placed).not.toBeNull();
    // Turning swaps width and depth; the same spot is now taken.
    const again = placeProject(w, col.village, col.community, 'cellar', placed!.foot, 0);
    expect(again).toMatch(/Too close/);
    col.community.resources.wood += 40; col.community.resources.scrap += 20;
    for (let d = 0; d < 12 && !placed!.done; d++) tick(col, 1440);
    expect(placed!.done).toBe(true);
    expect(col.village.buildings.some((b) => b.kind === 'cellar')).toBe(true);
  }, 120000);

  it('a ruin can be restored only once its district is quiet', () => {
    const col = manual(5);
    const hi = col.haunts.findIndex((h) => col.world.districts[h.district].kind === 'suburb');
    const d = col.haunts[hi].district;
    const r = col.world.ruins.find((x) => x.district === d && x.kind === 'house')!;
    expect(requestRestore(col, r.id)).toMatch(/Clear the district/);
    col.haunts[hi].state = 'cleared';
    const p = requestRestore(col, r.id);
    expect(typeof p).not.toBe('string');
    expect(col.haunts[hi].owner).toBe('village');
    expect(requestRestore(col, r.id)).toMatch(/Already/);
  });
});
