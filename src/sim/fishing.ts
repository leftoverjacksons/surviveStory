/**
 * Fishing grounds.
 *
 * The player paints a Fishing zone along a pond's shore (ponds lie a walk
 * from home, so this is the village's first outpost). Builders put a jetty
 * out over the water, then a fishing hut with smoking racks (smoked fish
 * keeps), then a net shed; once someone knows joinery, a rowing boat.
 * Fishers walk out at dawn, fish from the jetty or the boat, and carry the
 * catch home in the evening.
 *
 * Each pond holds a stock of fish that recovers logistically. Overfishing
 * thins the catch and the Veil around the water; rested ponds recover. In
 * winter fishers cut holes by the jetty and keep fishing at a reduced rate.
 * Net-mending is know-how, learned on the water and in the net shed.
 */
import type { Colony } from './colony';
import { alive, log, type Survivor } from './community';
import type { Building, Footprint, Project, ProjectKind, Village } from './buildings';
import type { Rng } from './rng';
import { knows } from './purpose';
import {
  Ground, Zone, heightAt, idx, inBounds, isExplored, tileX, tileZ, toTileX, toTileZ, type Point, type Pond, type World,
} from './world';

export interface Fishery {
  id: number;
  pond: number;
  /** The shore tile the jetty starts from, and the direction to the water (0 +z, 1 +x, 2 -z, 3 -x). */
  shore: { tx: number; tz: number };
  facing: number;
  /** Deck tiles, shore outward. */
  jettyTiles: number[];
  hutFoot: Footprint;
  shedFoot: Footprint;
  boatFoot: Footprint;
  jetty: number;
  hut: number;
  shed: number;
  boat: number;
  /** Day the "fished thin" warning was last given. */
  warned: number;
}

const DIRS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
export const JETTY_LEN = 4;

const tileAt = (w: World, i: number): Point => ({ x: tileX(w, i % w.w), z: tileZ(w, (i / w.w) | 0) });
export const pondOf = (w: World, f: Fishery): Pond => w.ponds[f.pond];

/** Footprint of `w`×`d` tiles whose near edge sits `back` tiles behind the shore, centred `side` tiles across. */
function footBehind(tx: number, tz: number, facing: number, back: number, side: number, wid: number, dep: number): Footprint {
  const [dx, dz] = DIRS[facing];
  const [px, pz] = [-dz, dx]; // perpendicular
  const cx = tx - dx * (back + (dep - 1) / 2) + px * side, cz = tz - dz * (back + (dep - 1) / 2) + pz * side;
  const fw = dx !== 0 ? dep : wid, fd = dx !== 0 ? wid : dep;
  return { tx: Math.round(cx - (fw - 1) / 2), tz: Math.round(cz - (fd - 1) / 2), w: fw, d: fd };
}

function* tilesOf(f: Footprint) {
  for (let dz = 0; dz < f.d; dz++) for (let dx = 0; dx < f.w; dx++) yield [f.tx + dx, f.tz + dz] as const;
}

/** Choose where a fishery goes on a pond's marked shore. */
function findFishery(w: World, v: Village, pond: number): Omit<Fishery, 'id' | 'jetty' | 'hut' | 'shed' | 'boat' | 'warned'> | null {
  let best: Omit<Fishery, 'id' | 'jetty' | 'hut' | 'shed' | 'boat' | 'warned'> | null = null, bestScore = Infinity;
  const landOk = (tx: number, tz: number) => {
    if (!inBounds(w, tx, tz) || !isExplored(w, tx, tz)) return false;
    const i = idx(w, tx, tz);
    return w.ground[i] !== Ground.Water && w.ground[i] !== Ground.Asphalt && !w.blocked[i] && w.bushAt[i] < 0 && !v.plotAt[i]
      && !(w.treeAt[i] >= 0 && w.trees[w.treeAt[i]].protected);
  };
  for (let i = 0; i < w.zone.length; i++) {
    if (w.zone[i] !== Zone.Fishing || w.ground[i] === Ground.Water) continue;
    const tx = i % w.w, tz = (i / w.w) | 0;
    if (!landOk(tx, tz)) continue;
    for (let f = 0; f < 4; f++) {
      const [dx, dz] = DIRS[f];
      const jetty: number[] = [];
      for (let k = 1; k <= JETTY_LEN; k++) {
        const x = tx + dx * k, z = tz + dz * k;
        if (!inBounds(w, x, z)) break;
        const j = idx(w, x, z);
        if (w.pondAt[j] !== pond) break;
        jetty.push(j);
      }
      if (jetty.length < JETTY_LEN) continue;
      const hutFoot = footBehind(tx, tz, f, 1, 0, 3, 3);
      const shedFoot = footBehind(tx, tz, f, 1, 2.5, 2, 2);
      let ok = true, trees = 0;
      for (const [x, z] of [...tilesOf(hutFoot), ...tilesOf(shedFoot)]) {
        if (!landOk(x, z)) { ok = false; break; }
        if (w.treeAt[idx(w, x, z)] >= 0) trees++;
      }
      if (!ok) continue;
      // A mooring for the boat beside the jetty's end.
      const [px, pz] = [-dz, dx];
      const end = tileAt(w, jetty[jetty.length - 1]);
      const bx = toTileX(w, end.x) + px, bz = toTileZ(w, end.z) + pz;
      if (!inBounds(w, bx, bz) || w.pondAt[idx(w, bx, bz)] !== pond) continue;
      const score = Math.hypot(tileX(w, tx) - w.home.x, tileZ(w, tz) - w.home.z) + trees * 2;
      if (score < bestScore) {
        bestScore = score;
        best = { pond, shore: { tx, tz }, facing: f, jettyTiles: jetty, hutFoot, shedFoot, boatFoot: { tx: bx, tz: bz, w: 1, d: 1 } };
      }
    }
  }
  return best;
}

export const fisheryOf = (v: Village, b: Building) => v.fisheries.find((f) => f.jetty === b.id || f.hut === b.id || f.shed === b.id || f.boat === b.id);

const NAMES: Record<string, [string, string]> = {
  jetty: ['Plank jetty', 'Timber jetty'],
  fishhut: ['Fishing hut', 'Smokehouse'],
  netshed: ['Net shed', 'Net shed'],
  boat: ['Rowing boat', 'Rowing boat'],
};
const COSTS: Record<string, { wood: number; scrap: number; work: number }> = {
  jetty: { wood: 12, scrap: 2, work: 420 },
  fishhut: { wood: 14, scrap: 4, work: 540 },
  netshed: { wood: 6, scrap: 2, work: 300 },
  boat: { wood: 10, scrap: 3, work: 480 },
};

/**
 * Start the next piece of a fishery if one is due: a new fishery on any
 * pond with a marked shore, then its hut, net shed and boat in turn.
 */
export function planFishery(col: Colony, rng: Rng, lead: string): Project | null {
  const v = col.village, w = col.world;
  void rng;
  if (v.projects.some((p) => !p.done && (p.kind === 'jetty' || p.kind === 'fishhut' || p.kind === 'netshed' || p.kind === 'boat'))) return null;
  const has = (id: number) => id > 0 && v.buildings.some((b) => b.id === id);
  const newProject = (kind: ProjectKind, foot: Footprint, facing: number, fishery: Fishery, trees: number[]): Project => {
    const tier = kind === 'boat' ? 1 : v.tier;
    const c = COSTS[kind];
    const p: Project = {
      id: v.nextId++, kind, tier: tier as 0 | 1, name: NAMES[kind][tier], foot, facing, cost: { wood: c.wood, scrap: c.scrap, glimmer: 0 },
      delivered: { wood: 0, scrap: 0, glimmer: 0 }, incoming: { wood: 0, scrap: 0, glimmer: 0 }, work: 0, workNeeded: c.work,
      target: 0, clearTrees: trees, done: false, fishery: fishery.id,
    };
    v.projects.push(p);
    return p;
  };
  // A small clearing: the footprint and a tile around it.
  const treesIn = (f: Footprint, margin = 1) => {
    const out: number[] = [];
    for (let z = f.tz - margin; z < f.tz + f.d + margin; z++) for (let x = f.tx - margin; x < f.tx + f.w + margin; x++) {
      if (!inBounds(w, x, z)) continue;
      const t = w.treeAt[idx(w, x, z)];
      if (t >= 0 && !w.trees[t].protected) out.push(t);
    }
    return out;
  };
  // Existing fisheries: carry on building.
  for (const f of v.fisheries) {
    if (!has(f.jetty)) continue;
    if (!has(f.hut)) return newProject('fishhut', f.hutFoot, f.facing, f, treesIn(f.hutFoot));
    if (!has(f.shed) && col.community.day >= 6) return newProject('netshed', f.shedFoot, f.facing, f, treesIn(f.shedFoot));
    if (!has(f.boat) && has(f.shed) && v.tier === 1) {
      log(col.community, `${lead} wants a boat for ${pondOf(w, f).name}. "Out in the middle is where the big ones are."`, 'info');
      return newProject('boat', f.boatFoot, f.facing, f, []);
    }
  }
  // A marked shore with no fishery yet.
  const marked = new Set<number>();
  for (let i = 0; i < w.zone.length; i++) {
    if (w.zone[i] !== Zone.Fishing) continue;
    const tx = i % w.w, tz = (i / w.w) | 0;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      if (!inBounds(w, tx + dx, tz + dz)) continue;
      const p = w.pondAt[idx(w, tx + dx, tz + dz)];
      if (p >= 0) marked.add(p);
    }
  }
  for (const pond of marked) {
    if (v.fisheries.some((f) => f.pond === pond)) continue;
    const site = findFishery(w, v, pond);
    if (!site) {
      const key = `nofish${pond}`;
      if (!col.hints.has(key)) {
        col.hints.add(key);
        log(col.community, `${lead} walked the marked shore of ${w.ponds[pond].name} and couldn't find a place for a jetty: it needs open bank and a few tiles of water in front. (Mark more of the shore.)`, 'info');
      }
      continue;
    }
    const fishery: Fishery = { ...site, id: v.nextId++, jetty: 0, hut: 0, shed: 0, boat: 0, warned: -99 };
    v.fisheries.push(fishery);
    const jf: Footprint = (() => {
      const pts = site.jettyTiles.map((i) => [i % w.w, (i / w.w) | 0]);
      const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
      return { tx: Math.min(...xs), tz: Math.min(...zs), w: Math.max(...xs) - Math.min(...xs) + 1, d: Math.max(...zs) - Math.min(...zs) + 1 };
    })();
    log(col.community, `${lead} went out to ${w.ponds[pond].name} and drove a stake into the bank. A jetty first, then a hut.`, 'good');
    return newProject('jetty', jf, site.facing, fishery, treesIn({ tx: site.shore.tx - 1, tz: site.shore.tz - 1, w: 3, d: 3 }, 0));
  }
  return null;
}

/** Deck height of a fishery's jetty: level with its bank. */
export function jettyHeight(w: World, f: Fishery): number {
  return Math.max(0.05, heightAt(w, tileX(w, f.shore.tx), tileZ(w, f.shore.tz)) + 0.1);
}

/** A finished fishery building: note it, and make the jetty walkable. */
export function onFisheryBuilt(col: Colony, b: Building, fisheryId: number) {
  const w = col.world, v = col.village;
  const f = v.fisheries.find((x) => x.id === fisheryId);
  if (!f) return;
  if (b.kind === 'jetty') {
    f.jetty = b.id;
    const y = jettyHeight(w, f);
    for (const i of f.jettyTiles) { w.deck[i] = 1; w.deckY[i] = y; }
    w.wearVersion++;
  } else if (b.kind === 'fishhut') {
    f.hut = b.id;
    volunteer(col, f);
  } else if (b.kind === 'netshed') f.shed = b.id;
  else if (b.kind === 'boat') f.boat = b.id;
}

/** When a fishery is ready and nobody fishes, someone takes it up. */
function volunteer(col: Colony, f: Fishery) {
  const c = col.community;
  const living = alive(c);
  if (living.some((s) => s.role === 'fisher') || living.length < 5) return;
  const count = (r: string) => living.filter((s) => s.role === r).length;
  const pool = living.filter((s) => s.role === 'rest' || s.role === 'tender' || (s.role === 'forager' && count('forager') > 1) || (s.role === 'builder' && count('builder') > 2));
  const score = (s: Survivor) => (s.traits.includes('stoic') ? 2 : 0) + (s.traits.includes('night_owl') ? 1 : 0) + (s.skills?.netmending ?? 0) * 4 + (s.role === 'rest' ? 1 : 0);
  const who = (pool.length ? pool : living.filter((s) => s.role === 'forager' || s.role === 'scout')).sort((a, b) => score(b) - score(a))[0];
  if (!who) return;
  who.role = 'fisher';
  log(c, `${who.name.split(' ')[0]} has taken up fishing at ${col.world.ponds[f.pond].name}. "Somebody has to learn the water."`, 'good');
}

// ---------- catching ----------

/** Food an hour of fishing brings in at this fishery, before the fisher's own skill. */
export function catchRate(col: Colony, f: Fishery, s: Survivor, fromBoat: boolean, season: string): number {
  const pond = pondOf(col.world, f);
  const stockK = Math.pow(Math.max(0, pond.stock) / pond.max, 0.7);
  const seasonK = season === 'winter' ? 0.45 : season === 'summer' ? 1 : 1.15;
  const nets = knows(s, 'netmending') && f.shed > 0 ? 1.5 : 1;
  return 0.65 * stockK * seasonK * nets * (fromBoat ? 1.3 : 1);
}

/** Where on the jetty a fisher sits (the end first), or the boat's spot out on the water. */
export function fishingSpot(col: Colony, f: Fishery, slot: number, fromBoat: boolean): Point {
  const w = col.world;
  const [dx, dz] = DIRS[f.facing];
  if (fromBoat) {
    const end = tileAt(w, f.jettyTiles[f.jettyTiles.length - 1]);
    return { x: end.x + dx * 3.5 - dz * 1.5, z: end.z + dz * 3.5 + dx * 1.5 };
  }
  const k = Math.max(0, f.jettyTiles.length - 1 - (slot % f.jettyTiles.length));
  return tileAt(w, f.jettyTiles[k]);
}

/** Daily: fish stocks recover; fished-thin ponds thin the Veil and say so. */
export function fishingDaily(col: Colony, disturb: (x: number, z: number, amount: number) => void) {
  const w = col.world;
  for (const pond of w.ponds) {
    pond.stock = Math.min(pond.max, pond.stock + 0.12 * pond.stock * (1 - pond.stock / pond.max) + 0.4);
  }
  for (const f of col.village.fisheries) {
    const pond = pondOf(w, f);
    if (pond.stock / pond.max < 0.3) {
      disturb(pond.cx, pond.cz, 0.02);
      if (col.community.day - f.warned >= 6) {
        f.warned = col.community.day;
        log(col.community, `The nets come up light at ${pond.name}. It's been fished thin; it needs a rest.`, 'bad');
      }
    }
  }
}
