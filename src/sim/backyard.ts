/**
 * Trades in the back yard (DESIGN §21.10). After the collapse nobody puts up
 * a standalone workshop for one trade: the tool bench, the sewing room and
 * the smoke shed go at the back of a household's plot, like a Manor Lords
 * burgage extension, and that household runs it. The tavern and the glass
 * dome stay standalone.
 */
import type { Colony } from './colony';
import { log } from './community';
import { DEFS, newProject, tierFor, type Footprint, type Project, type TradeKind } from './buildings';
import { householdName, plotPoint, type Plot } from './homes';
import { idx, tileX, tileZ, toTileX, toTileZ, type Point } from './world';

export const BACKYARD: TradeKind[] = ['toolshop', 'tailor', 'smokehouse'];
export const isBackyard = (k: string): k is TradeKind => (BACKYARD as string[]).includes(k);

const DIRS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // facing 0..3: the door's direction

/** Plot-local depth of a point (distance back from the street). */
const depth = (plot: Plot, p: Point) => (p.x - plot.origin.x) * plot.n.x + (p.z - plot.origin.z) * plot.n.z;

/** Why this plot can't take this trade, or null. */
export function whyNotBackyard(col: Colony, plot: Plot | undefined, kind: TradeKind): string | null {
  if (!plot) return 'Click a household\'s plot: trades go in the back yard.';
  const v = col.village;
  if (!plot.household) return 'Nobody lives there yet.';
  if (!v.buildings.some((b) => b.kind === 'home' && b.plot === plot.id)) return 'Their house isn\'t finished yet.';
  if (v.buildings.some((b) => b.plot === plot.id && isBackyard(b.kind)) || v.projects.some((p) => !p.done && p.plot === plot.id && isBackyard(p.kind))) {
    return 'That household already keeps a trade.';
  }
  return backyardSite(col, plot, kind) ? null : 'There\'s no room at the back of that yard.';
}

/** The deepest free spot at the back of the plot for this trade, door facing the house. */
export function backyardSite(col: Colony, plot: Plot, kind: TradeKind): { foot: Footprint; facing: number; trees: number[] } | null {
  const w = col.world, def = DEFS[kind];
  const inPlot = new Set(plot.tiles);
  // The house's own tiles are blocked in the world, so `w.blocked` keeps us off them.
  const houseBack = depth(plot, plot.hc) + plot.house.D / 2 + (plot.house.wing ? plot.house.wing.d : 0);
  let best: { foot: Footprint; facing: number; trees: number[] } | null = null, bestS = -Infinity;
  for (const i of plot.tiles) {
    const tx = i % w.w, tz = (i / w.w) | 0;
    for (const [fw, fd] of def.w === def.d ? [[def.w, def.d]] : [[def.w, def.d], [def.d, def.w]]) {
      const foot = { tx, tz, w: fw, d: fd };
      let ok = true;
      const trees: number[] = [];
      for (let dz = 0; dz < fd && ok; dz++) for (let dx = 0; dx < fw && ok; dx++) {
        const j = idx(w, tx + dx, tz + dz);
        if (!inPlot.has(j) || w.blocked[j] || w.bushAt[j] >= 0) ok = false;
        else if (w.treeAt[j] >= 0) { if (w.trees[w.treeAt[j]].protected) ok = false; else trees.push(w.treeAt[j]); }
      }
      if (!ok) continue;
      const c = { x: tileX(w, tx) - 0.5 + fw / 2, z: tileZ(w, tz) - 0.5 + fd / 2 };
      const v = depth(plot, c);
      if (v - Math.min(fw, fd) / 2 < houseBack + 0.8) continue; // behind the house, with a gap
      const s = v - trees.length * 0.8;
      if (s <= bestS) continue;
      // The door looks back toward the house.
      const back = { x: -plot.n.x, z: -plot.n.z };
      let facing = 0, fb = -Infinity;
      DIRS.forEach(([x, z], k) => { const d = x * back.x + z * back.z; if (d > fb) { fb = d; facing = k; } });
      best = { foot, facing, trees };
      bestS = s;
    }
  }
  return best;
}

/** Start a trade at the back of a household's plot. */
export function placeBackyard(col: Colony, plotId: number, kind: TradeKind): Project | string {
  const v = col.village, plot = v.plots.find((p) => p.id === plotId);
  const why = whyNotBackyard(col, plot, kind);
  if (why) return why;
  const site = backyardSite(col, plot!, kind)!;
  const h = v.households.find((x) => x.id === plot!.household)!;
  const tier = tierFor(v, col.community, kind);
  const who = householdName(col.community, h);
  const p = newProject(v, {
    kind, tier, name: `${who}'s ${DEFS[kind].name[tier].toLowerCase()}`, foot: site.foot, facing: site.facing,
    cost: { ...DEFS[kind].cost[tier] }, workNeeded: DEFS[kind].work[tier], target: 0, clearTrees: site.trees,
    plot: plot!.id, household: h.id,
  });
  // Built from the same salvage as their house.
  p.clad = plot!.house.clad;
  // The yard gives up what stood there.
  const f = site.foot, w = col.world;
  const x0 = tileX(w, f.tx) - 1.1, x1 = tileX(w, f.tx + f.w - 1) + 1.1, z0 = tileZ(w, f.tz) - 1.1, z1 = tileZ(w, f.tz + f.d - 1) + 1.1;
  plot!.yard = plot!.yard.filter((y) => {
    if (y.kind === 'fence') return true;
    const q = plotPoint(plot!, y.u, y.v);
    return !(q.x > x0 && q.x < x1 && q.z > z0 && q.z < z1);
  });
  log(col.community, `${who} will keep a ${DEFS[kind].name[tier].toLowerCase()} at the back of their yard.`, 'good');
  return p;
}

/** For self-planning: the household best suited to a trade, and its yard. */
export function autoBackyard(col: Colony, kind: TradeKind): Project | null {
  const v = col.village, c = col.community;
  const cands = v.plots.filter((p) => !whyNotBackyard(col, p, kind)).map((p) => {
    const h = v.households.find((x) => x.id === p.household)!;
    const members = c.survivors.filter((s) => h.members.includes(s.id) && s.alive);
    const knack = members.reduce((n, s) => n + (s.traits.includes('tinkerer') ? 2 : 0) + (s.aspiration?.kind === 'craft' ? 1.5 : 0) + (s.role === 'maker' ? 1 : 0)
      + (kind === 'smokehouse' && (s.role === 'fisher' || s.traits.includes('hoarder')) ? 1 : 0), 0);
    return { p, score: knack + members.length * 0.3 };
  }).sort((a, b) => b.score - a.score);
  if (!cands.length) return null;
  const r = placeBackyard(col, cands[0].p.id, kind);
  return typeof r === 'string' ? null : r;
}

/** The plot under a world point, if any. */
export function plotAtPoint(col: Colony, x: number, z: number): Plot | undefined {
  const w = col.world;
  const id = col.village.plotAt[idx(w, toTileX(w, x), toTileZ(w, z))];
  return id ? col.village.plots.find((p) => p.id === id) : undefined;
}
