/**
 * Households and their homes.
 *
 * Nobody wants to sleep in a crowd for ever. People who are close form
 * households; a household without a home petitions the council for one.
 * Each home stands on its own plot, a strip of land running back from a lane
 * or the green (a burgage plot), with the house at the front and a yard
 * behind that the household improves over the seasons.
 *
 * Plots are not rectangles: frontage, depth, taper and skew vary, and rows
 * of plots bend with the lanes they face.
 */
import { alive, bondValue, log, remember, type Community, type Survivor } from './community';
import type { Colony } from './colony';
import type { Building, Cost, Footprint, Project, Tier, Village } from './buildings';
import type { Rng } from './rng';
import {
  Ground, LANE_WEAR, PATH_WEAR, heightAt, idx, inBounds, inZone, isExplored, tileX, tileZ, toTileX, toTileZ,
  type Point, type World,
} from './world';

// ---------- types ----------

export interface Household {
  id: number;
  members: number[];
  /** Building id of their home, or 0 while they wait. */
  home: number;
  /** Day the household formed. */
  since: number;
  /** Day they last petitioned the council. */
  petitioned: number;
}

/** A house's shape, in its local frame: door toward +z, width along x. */
export interface HouseSpec {
  W: number;
  D: number;
  /** Eaves height. */
  wall: number;
  /** 'along': ridge parallel to the street; 'across': gable end to the street. */
  ridge: 'along' | 'across';
  pitch: number;
  /** A lower wing behind the house on one side (an L-shaped plan). */
  wing: { side: 1 | -1; w: number; d: number } | null;
  porch: boolean;
  /** Which side the hearth and chimney are on. */
  chimney: 1 | -1;
  beds: number;
  seed: number;
}

export type YardKind = 'beds' | 'woodpile' | 'bench' | 'fence' | 'fruit' | 'flowers' | 'washing' | 'coop' | 'shed';

export interface YardItem {
  kind: YardKind;
  /** Plot-local position: u along the frontage, v back from the street. */
  u: number;
  v: number;
  w: number;
  d: number;
  /** Work done, 0..1. */
  progress: number;
  /** Veg beds: minutes tended today. Fruit trees: growth 0..1. */
  tended: number;
  growth: number;
}

export interface Plot {
  id: number;
  household: number;
  /** Front-centre of the plot, on the street edge. */
  origin: Point;
  /** Unit vectors: t along the frontage, n back from the street. */
  t: Point;
  n: Point;
  /** Front-left, front-right, back-right, back-left. */
  corners: Point[];
  tiles: number[];
  house: HouseSpec;
  /** House centre (world) and heading (radians, as a Three.js yaw). */
  hc: Point;
  yaw: number;
  yard: YardItem[];
}

// ---------- geometry ----------

const add = (a: Point, b: Point, k = 1): Point => ({ x: a.x + b.x * k, z: a.z + b.z * k });
const dot = (a: Point, b: Point) => a.x * b.x + a.z * b.z;
const norm = (a: Point): Point => { const l = Math.hypot(a.x, a.z) || 1; return { x: a.x / l, z: a.z / l }; };
const rot = (a: Point, ang: number): Point => ({ x: a.x * Math.cos(ang) - a.z * Math.sin(ang), z: a.x * Math.sin(ang) + a.z * Math.cos(ang) });

export function pointInPoly(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** Plot-local (u, v) to world. */
export const plotPoint = (p: Plot, u: number, v: number): Point => add(add(p.origin, p.t, u), p.n, v);

/** House-local axes: X along the width, Z toward the door (the street). */
export function houseAxes(yaw: number) {
  return { X: { x: Math.cos(yaw), z: -Math.sin(yaw) }, Z: { x: Math.sin(yaw), z: Math.cos(yaw) } };
}

/** House-local (x, z) to world. */
export function housePoint(hc: Point, yaw: number, x: number, z: number): Point {
  const { X, Z } = houseAxes(yaw);
  return { x: hc.x + X.x * x + Z.x * z, z: hc.z + X.z * x + Z.z * z };
}

/** Whether a world point lies under the house's roof (main block or wing). */
export function houseContains(spec: HouseSpec, hc: Point, yaw: number, p: Point, pad = 0): boolean {
  const { X, Z } = houseAxes(yaw);
  const d = { x: p.x - hc.x, z: p.z - hc.z };
  const lx = dot(d, X), lz = dot(d, Z);
  if (Math.abs(lx) <= spec.W / 2 + pad && Math.abs(lz) <= spec.D / 2 + pad) return true;
  const wg = spec.wing;
  if (!wg) return false;
  const wx = wg.side * (spec.W / 2 - wg.w / 2), wz = -(spec.D / 2 + wg.d / 2);
  return Math.abs(lx - wx) <= wg.w / 2 + pad && Math.abs(lz - wz) <= wg.d / 2 + pad;
}

/**
 * The height a house's floor datum sits at. The ground is never reshaped:
 * the house rises to within 0.2 of the highest ground under it (so its
 * uphill wall isn't buried) and the foundation fills the gap downhill.
 * A pure function of the terrain, so sim and renderer always agree.
 */
export function houseFloor(w: World, plot: { hc: Point; yaw: number; house: HouseSpec }): number {
  const s = plot.house;
  let hi = -Infinity;
  const sample = (cx: number, cz: number, W: number, D: number) => {
    for (let i = 0; i <= 5; i++) for (let j = 0; j <= 5; j++) {
      const q = housePoint(plot.hc, plot.yaw, cx + (i / 5 - 0.5) * W, cz + (j / 5 - 0.5) * D);
      hi = Math.max(hi, heightAt(w, q.x, q.z));
    }
  };
  sample(0, 0, s.W, s.D);
  if (s.wing) sample(s.wing.side * (s.W / 2 - s.wing.w / 2), -(s.D / 2 + s.wing.d / 2), s.wing.w, s.wing.d);
  return Math.max(heightAt(w, plot.hc.x, plot.hc.z), hi - 0.2);
}

/** Where things are inside a house, in its local frame. */
export function homeLayout(spec: HouseSpec) {
  const { W, D, chimney: c } = spec;
  const beds: { x: number; z: number; yaw: number }[] = [];
  // Beds along the back wall, away from the hearth; any extra go in the wing.
  const along = Math.max(1, Math.floor((W - 1.4) / 0.95));
  for (let i = 0; i < spec.beds; i++) {
    if (i < along) beds.push({ x: -c * (W / 2 - 0.6 - i * 0.95), z: -D / 2 + 1.0, yaw: 0 });
    else if (spec.wing) {
      const wg = spec.wing, k = i - along;
      beds.push({ x: wg.side * (W / 2 - wg.w / 2) + (k - 0.5) * 0.9, z: -D / 2 - wg.d / 2, yaw: 0 });
    } else beds.push({ x: c * (W / 2 - 0.6), z: D / 2 - 1.1, yaw: Math.PI / 2 });
  }
  const hearth = { x: c * (W / 2 - 0.55), z: -D / 2 + 0.55 };
  const table = { x: c * 0.2, z: D / 2 - 1.5 };
  const seats = [
    { x: table.x - 0.75, z: table.z, yaw: Math.PI / 2 },
    { x: table.x + 0.75, z: table.z, yaw: -Math.PI / 2 },
    { x: table.x, z: table.z - 0.65, yaw: 0 },
    { x: table.x, z: table.z + 0.65, yaw: Math.PI },
  ];
  return { beds, hearth, table, seats };
}

// ---------- households ----------

export const householdOf = (v: Village, id: number) => v.households.find((h) => h.members.includes(id));
export const plotOf = (v: Village, h: Household) => v.plots.find((p) => p.household === h.id);
export const homeOf = (v: Village, id: number): Building | undefined => {
  const h = householdOf(v, id);
  return h?.home ? v.buildings.find((b) => b.id === h.home) : undefined;
};

const firstName = (s: Survivor) => s.name.split(' ')[0];

export function householdName(c: Community, h: Household): string {
  const names = h.members.map((id) => c.survivors.find((s) => s.id === id)).filter((s): s is Survivor => !!s).map(firstName);
  if (names.length <= 1) return names[0] ?? 'Nobody';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Bond needed to set up house together, and to move in with a household. */
export const PAIR_BOND = 35;
export const JOIN_BOND = 50;
/** Days in the village before someone with no close bond sets up on their own. */
export const SINGLE_AFTER = 12;

/** Daily: households form, lose members, and move into empty homes. */
export function householdsDaily(col: Colony) {
  const c = col.community, v = col.village;
  const living = alive(c);
  const ids = new Set(living.map((s) => s.id));
  // The dead and departed leave their households.
  for (const h of v.households) h.members = h.members.filter((m) => ids.has(m));
  for (const h of v.households.filter((x) => x.members.length === 0)) {
    const b = v.buildings.find((x) => x.id === h.home);
    if (b) {
      b.household = 0;
      log(c, `${b.name} stands empty now. Someone keeps the door shut against the weather.`, 'bad');
    }
    const plot = plotOf(v, h);
    if (plot) plot.household = 0;
  }
  v.households = v.households.filter((h) => h.members.length > 0);
  for (const p of v.projects) {
    if (!p.done && p.kind === 'home' && p.household && !v.households.some((h) => h.id === p.household)) p.household = 0;
  }

  const unattached = () => living.filter((s) => !householdOf(v, s.id));
  // Close pairs set up house together, best bond first. People living (or
  // waiting to live) alone are still open to it.
  const alone = (s: Survivor) => {
    const h = householdOf(v, s.id);
    if (!h) return true;
    return h.members.length === 1 && !h.home && !v.projects.some((p) => !p.done && p.household === h.id);
  };
  if (c.day >= 3) {
    const loose = living.filter(alone);
    const pairs: [Survivor, Survivor, number][] = [];
    for (let i = 0; i < loose.length; i++) for (let j = i + 1; j < loose.length; j++) {
      const b = bondValue(c, loose[i].id, loose[j].id);
      if (b >= PAIR_BOND) pairs.push([loose[i], loose[j], b]);
    }
    pairs.sort((a, b) => b[2] - a[2]);
    const used = new Set<number>();
    for (const [a, b] of pairs) {
      if (used.has(a.id) || used.has(b.id)) continue;
      used.add(a.id); used.add(b.id);
      // Leave any single households, keeping the earlier start (and any place in the queue).
      const old = [householdOf(v, a.id), householdOf(v, b.id)].filter((x): x is Household => !!x);
      const since = old.length ? Math.min(...old.map((x) => x.since)) : c.day;
      const h: Household = { id: v.nextId++, members: [a.id, b.id], home: 0, since, petitioned: 0 };
      if (old.some((x) => v.homeQueue.includes(x.id))) v.homeQueue.push(h.id);
      v.homeQueue = v.homeQueue.filter((id) => !old.some((x) => x.id === id));
      v.households = v.households.filter((x) => !old.includes(x));
      v.households.push(h);
      log(c, `${firstName(a)} and ${firstName(b)} have started talking about a place of their own.`, 'good');
      remember(a, c.day, `Decided to make a home with ${firstName(b)}.`);
      remember(b, c.day, `Decided to make a home with ${firstName(a)}.`);
    }
    // Anyone very close to a whole household may join it.
    for (const s of unattached()) {
      const h = v.households.find((x) => x.members.length < 3 && x.members.every((m) => bondValue(c, s.id, m) >= JOIN_BOND));
      if (!h) continue;
      const home = v.buildings.find((b) => b.id === h.home);
      if (home && home.beds <= h.members.length) continue;
      h.members.push(s.id);
      log(c, `${firstName(s)} is going to live with ${householdName(c, { ...h, members: h.members.filter((m) => m !== s.id) })}.`, 'good');
    }
    // After a while, people with nobody to pair with set up on their own.
    for (const s of unattached()) {
      if (c.day - (s.arrived ?? 1) < SINGLE_AFTER) continue;
      if (living.some((o) => o !== s && !householdOf(v, o.id) && bondValue(c, s.id, o.id) >= PAIR_BOND - 10)) continue;
      v.households.push({ id: v.nextId++, members: [s.id], home: 0, since: c.day, petitioned: 0 });
      log(c, `${firstName(s)} wants a place of their own, even a small one.`, 'info');
    }
  }
  // Empty homes go to whoever is waiting and fits.
  for (const b of v.buildings) {
    if (b.kind !== 'home' || b.household) continue;
    const h = v.households.filter((x) => !x.home && x.members.length <= b.beds && !v.projects.some((p) => !p.done && p.household === x.id))
      .sort((a, b2) => b2.members.length - a.members.length)[0];
    if (!h) continue;
    moveIn(col, h, b, true);
  }
}

function moveIn(col: Colony, h: Household, b: Building, second: boolean) {
  const c = col.community, v = col.village;
  h.home = b.id;
  b.household = h.id;
  const plot = v.plots.find((p) => p.id === b.plot);
  if (plot) plot.household = h.id;
  const name = householdName(c, h);
  if (second) {
    log(c, `${name} moved into the empty house. They kept the old name over the door.`, 'good');
  } else {
    b.name = h.members.length > 1 ? `${name}'s house` : `${name}'s cottage`;
    log(c, `${name} moved into their new house. The first night, nobody could quite stop smiling.`, 'good');
  }
  for (const id of h.members) {
    const s = c.survivors.find((x) => x.id === id);
    if (s) remember(s, c.day, second ? 'Moved into an empty house.' : 'First night in our own home.');
  }
}

/** A finished home: the household moves in and plans its yard. */
export function onHomeBuilt(col: Colony, b: Building) {
  const v = col.village;
  const h = v.households.find((x) => x.id === b.household);
  const plot = v.plots.find((p) => p.id === b.plot);
  if (plot && !plot.yard.length) plot.yard = planYard(plot, h ? traitsOf(col.community, h) : new Set());
  if (h) moveIn(col, h, b, false);
  else b.household = 0;
}

const traitsOf = (c: Community, h: Household) =>
  new Set(h.members.flatMap((id) => c.survivors.find((s) => s.id === id)?.traits ?? []) as string[]);

// ---------- yards ----------

export const YARD: Record<YardKind, { name: string; work: number; cost: Cost }> = {
  beds:     { name: 'vegetable beds', work: 240, cost: { wood: 3, scrap: 0, glimmer: 0 } },
  woodpile: { name: 'a woodpile', work: 120, cost: { wood: 0, scrap: 0, glimmer: 0 } },
  bench:    { name: 'a bench by the door', work: 120, cost: { wood: 2, scrap: 0, glimmer: 0 } },
  fence:    { name: 'a wattle fence', work: 600, cost: { wood: 6, scrap: 0, glimmer: 0 } },
  fruit:    { name: 'a fruit tree', work: 90, cost: { wood: 0, scrap: 0, glimmer: 0 } },
  flowers:  { name: 'a flower border', work: 120, cost: { wood: 0, scrap: 0, glimmer: 0 } },
  washing:  { name: 'a washing line', work: 60, cost: { wood: 1, scrap: 1, glimmer: 0 } },
  coop:     { name: 'a hen coop', work: 450, cost: { wood: 6, scrap: 3, glimmer: 0 } },
  shed:     { name: 'a garden shed', work: 600, cost: { wood: 8, scrap: 5, glimmer: 0 } },
};

/** Where yard features go on a plot, and in what order the household wants them. */
export function planYard(plot: Plot, traits: Set<string>): YardItem[] {
  const hs = plot.house;
  const hu = dot({ x: plot.hc.x - plot.origin.x, z: plot.hc.z - plot.origin.z }, plot.t);
  const hv = dot({ x: plot.hc.x - plot.origin.x, z: plot.hc.z - plot.origin.z }, plot.n);
  const back = Math.min(...plot.corners.slice(2).map((p) => dot({ x: p.x - plot.origin.x, z: p.z - plot.origin.z }, plot.n)));
  const houseBack = hv + hs.D / 2 + (hs.wing ? hs.wing.d : 0);
  const yardV0 = houseBack + 0.9, yardV1 = back - 0.9;
  const widthAt = (v: number) => {
    // Half-width of the plot at depth v (conservative: the narrower side).
    const [fl, fr, br, bl] = plot.corners.map((p) => ({ u: dot({ x: p.x - plot.origin.x, z: p.z - plot.origin.z }, plot.t), v: dot({ x: p.x - plot.origin.x, z: p.z - plot.origin.z }, plot.n) }));
    const lerp = (a: { u: number; v: number }, b: { u: number; v: number }) => a.u + (b.u - a.u) * Math.max(0, Math.min(1, (v - a.v) / ((b.v - a.v) || 1)));
    return { lo: lerp(fl, bl) + 0.8, hi: lerp(fr, br) - 0.8 };
  };
  const item = (kind: YardKind, u: number, v: number, w: number, d: number): YardItem => ({ kind, u, v, w, d, progress: 0, tended: 0, growth: 0 });
  const items: YardItem[] = [];
  const side = hs.wing ? -hs.wing.side : 1;
  const mid = (yardV0 + yardV1) / 2;
  if (yardV1 - yardV0 > 2.5) {
    const span = widthAt(yardV0 + 1.3);
    const bw = Math.min(3.6, (span.hi - span.lo) * 0.55);
    items.push(item('beds', (span.lo + span.hi) / 2 - side * 0.6, yardV0 + 1.3, bw, 2.4));
  }
  items.push(item('woodpile', hu + side * (hs.W / 2 + 0.7), hv - hs.D * 0.1, 0.8, Math.min(2.2, hs.D * 0.5)));
  items.push(item('bench', hu - hs.chimney * hs.W * 0.28, hv - hs.D / 2 - 0.55, 1.2, 0.4));
  items.push(item('fence', 0, 0, 0, 0));
  if (yardV1 - yardV0 > 4) {
    const span = widthAt(yardV1 - 1.2);
    items.push(item('fruit', span.lo + 0.6, yardV1 - 1.2, 1, 1));
    items.push(item('coop', span.hi - 0.9, yardV1 - 1.1, 1.4, 1.2));
    const m = widthAt(mid + 1.2);
    items.push(item('washing', (m.lo + m.hi) / 2, mid + 1.4, Math.min(3, m.hi - m.lo - 0.6), 0.1));
    if (yardV1 - yardV0 > 6.5) {
      const s2 = widthAt(yardV1 - 3.2);
      items.push(item('shed', s2.hi - 1.1, yardV1 - 3.4, 1.8, 1.5));
    }
  }
  if (hv - hs.D / 2 > 1.1) items.push(item('flowers', hu + hs.chimney * hs.W * 0.25, (hv - hs.D / 2) / 2, hs.W * 0.35, 0.5));
  // Keep only features that fit inside the plot.
  const fits = items.filter((it) => it.kind === 'fence' || pointInPoly(plotPoint(plot, it.u, it.v), plot.corners));
  const pref: Record<YardKind, number> = { beds: 1, woodpile: 2, fence: 3, bench: 4, fruit: 5, flowers: 6, washing: 7, coop: 8, shed: 9 };
  if (traits.has('green_thumb')) { pref.fruit = 1.5; pref.flowers = 2.5; }
  if (traits.has('tinkerer')) { pref.shed = 2.5; pref.coop = 3.5; }
  if (traits.has('hoarder')) { pref.woodpile = 0.5; pref.shed = 3.2; }
  if (traits.has('storyteller')) pref.bench = 1.2;
  if (traits.has('tender')) pref.flowers = 3.1;
  return fits.sort((a, b) => pref[a.kind] - pref[b.kind]);
}

/** Comfort a home gives the people who live in it (morale target points). */
export function homeComfort(v: Village, b: Building): number {
  const plot = v.plots.find((p) => p.id === b.plot);
  const done = plot ? plot.yard.filter((y) => y.progress >= 1).length : 0;
  return 2 + Math.min(3, done * 0.5);
}

// ---------- finding a plot ----------

interface Candidate { origin: Point; n: Point; bonus: number; from: string }

/** Street-ness of a tile: roads and well-worn lanes. */
function streetness(w: World, tx: number, tz: number): number {
  if (!inBounds(w, tx, tz)) return 0;
  const i = idx(w, tx, tz);
  const g = w.ground[i];
  if (g === Ground.Asphalt) return 1;
  if (w.wear[i] >= LANE_WEAR) return 0.9;
  if (w.wear[i] >= PATH_WEAR) return 0.5;
  return 0;
}

function streetCandidates(w: World, rng: Rng): Candidate[] {
  const CAMP = w.campfire;
  const out: Candidate[] = [];
  const cx = toTileX(w, CAMP.x), cz = toTileZ(w, CAMP.z);
  const R = 26;
  for (let dz = -R; dz <= R; dz += 2) for (let dx = -R; dx <= R; dx += 2) {
    const tx = cx + dx + (dz & 2 ? 1 : 0), tz = cz + dz;
    const s = streetness(w, tx, tz);
    if (s < 0.5) continue;
    // The run of the street here: principal axis of nearby street tiles.
    let n = 0, mx = 0, mz = 0;
    const pts: [number, number][] = [];
    for (let oz = -3; oz <= 3; oz++) for (let ox = -3; ox <= 3; ox++) {
      if (streetness(w, tx + ox, tz + oz) < 0.5) continue;
      pts.push([ox, oz]); mx += ox; mz += oz; n++;
    }
    if (n < 4) continue;
    mx /= n; mz /= n;
    let cxx = 0, czz = 0, cxz = 0;
    for (const [ox, oz] of pts) { cxx += (ox - mx) ** 2; czz += (oz - mz) ** 2; cxz += (ox - mx) * (oz - mz); }
    const phi = 0.5 * Math.atan2(2 * cxz, cxx - czz);
    const along = { x: Math.cos(phi), z: Math.sin(phi) };
    // Half-width of the road: spread across its run (uniform: var = w^2 / 12).
    const across = (cxx + czz) / (2 * n) - Math.sqrt(((cxx - czz) / 2) ** 2 + cxz ** 2) / n;
    const width = Math.sqrt(3 * Math.max(0, across));
    for (const sgn of [1, -1]) {
      const nn = { x: -along.z * sgn, z: along.x * sgn };
      const base = { x: tileX(w, tx), z: tileZ(w, tz) };
      out.push({ origin: add(base, nn, 1.2 + Math.min(2.5, width) + rng.range(0, 0.6)), n: nn, bonus: -3 * s, from: 'street' });
    }
  }
  return out;
}

function ringCandidates(w: World): Candidate[] {
  const CAMP = w.campfire;
  const out: Candidate[] = [];
  for (const r of [10, 12.5, 15]) for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2 + r * 0.1;
    const n = { x: Math.cos(a), z: Math.sin(a) };
    out.push({ origin: add(CAMP, n, r), n, bonus: 0, from: 'green' });
  }
  return out;
}

function neighbourCandidates(v: Village, rng: Rng): Candidate[] {
  const out: Candidate[] = [];
  for (const p of v.plots) {
    const front = Math.hypot(p.corners[1].x - p.corners[0].x, p.corners[1].z - p.corners[0].z);
    for (const side of [1, -1]) {
      const bend = side * rng.range(-0.05, 0.14);
      const n = norm(rot(p.n, bend));
      const edge = add(p.origin, p.t, side * front / 2);
      out.push({ origin: add(edge, p.t, side * 4.2), n, bonus: -5, from: 'row' });
      out.push({ origin: add(edge, p.t, side * 4.8), n, bonus: -4.5, from: 'row' });
    }
  }
  return out;
}

export interface PlotPlan { plot: Plot; trees: number[]; houseTiles: number[]; score: number; from: string }

function tryPlot(w: World, v: Village, cand: Candidate, beds: number, rng: Rng, compact: boolean): PlotPlan | null {
  const CAMP = w.campfire;
  const n = norm(cand.n);
  const t = { x: -n.z, z: n.x };
  const W0 = compact ? rng.range(6.2, 7.2) : rng.range(6.8, 9.2), taper = rng.range(0.85, 1.3);
  const D = compact ? rng.range(8, 10.5) : rng.range(10.5, 15);
  const skew = rng.range(-1.6, 1.6);
  const O = cand.origin;
  const corners = [
    add(O, t, -W0 / 2),
    add(O, t, W0 / 2),
    add(add(O, t, (W0 * taper) / 2 + skew), n, D + rng.range(-1.2, 1.2)),
    add(add(O, t, -(W0 * taper) / 2 + skew), n, D + rng.range(-1.2, 1.2)),
  ];
  // Rasterise and check every tile.
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const c of corners) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z); }
  const tiles: number[] = [];
  let lanes = 0, meadow = 0;
  const others = [
    ...v.buildings.filter((b) => b.kind !== 'home').map((b) => b.foot),
    ...v.projects.filter((p) => !p.done && p.kind !== 'home').map((p) => p.foot),
  ];
  const sp = w.stockpile;
  for (let tz = toTileZ(w, z0); tz <= toTileZ(w, z1); tz++) for (let tx = toTileX(w, x0); tx <= toTileX(w, x1); tx++) {
    const p = { x: tileX(w, tx), z: tileZ(w, tz) };
    if (!pointInPoly(p, corners)) continue;
    if (!inBounds(w, tx, tz) || !inZone(w, tx, tz) || !isExplored(w, tx, tz)) return null;
    const i = idx(w, tx, tz);
    const g = w.ground[i];
    if (g === Ground.Water || g === Ground.Asphalt || g === Ground.Concrete) return null;
    if (w.blocked[i] || v.plotAt[i]) return null;
    if (Math.hypot(p.x - CAMP.x, p.z - CAMP.z) < 5.5) return null;
    if (p.x > sp.x0 - 1.5 && p.x < sp.x1 + 1.5 && p.z > sp.z0 - 1.5 && p.z < sp.z1 + 1.5) return null;
    for (const f of others) if (tx >= f.tx - 1 && tx < f.tx + f.w + 1 && tz >= f.tz - 1 && tz < f.tz + f.d + 1) return null;
    if (w.wear[i] >= LANE_WEAR) lanes++;
    if (g === Ground.Meadow) meadow++;
    tiles.push(i);
  }
  if (tiles.length < (compact ? 40 : 55) || lanes > 3) return null;

  // The house: bigger for bigger households, set back from the street.
  const Wh = Math.min(W0 - 2.2, compact ? rng.range(4, 4.6) : rng.range(4.4, 5.4) + (beds >= 3 ? 0.6 : 0));
  if (Wh < 4) return null;
  const Dh = rng.range(3.8, 4.8) + (beds >= 4 ? 0.4 : 0);
  const room = (W0 - Wh) / 2 - 0.6;
  const hu = rng.range(-room, room);
  const setback = rng.range(0.9, 2.0);
  const wing = beds >= 3 || rng.chance(0.35)
    ? { side: (rng.chance(0.5) ? 1 : -1) as 1 | -1, w: Math.min(Wh * 0.6, rng.range(2.2, 3)), d: rng.range(1.8, 3.2) }
    : null;
  const spec: HouseSpec = {
    W: Wh, D: Dh, wall: rng.range(2.1, 2.5), ridge: rng.chance(0.62) ? 'along' : 'across', pitch: rng.range(0.55, 0.85),
    wing, porch: rng.chance(0.45), chimney: rng.chance(0.5) ? 1 : -1, beds, seed: rng.int(1, 1e6),
  };
  const hc = add(add(O, t, hu), n, setback + Dh / 2);
  const yaw = Math.atan2(-n.x, -n.z);
  // Hillsides are fine (the house stands on a foundation), cliffs are not:
  // nobody builds where the base would be taller than a person's shoulder.
  let lowest = Infinity;
  for (let k = 0; k < 25; k++) {
    const q = housePoint(hc, yaw, ((k % 5) / 4 - 0.5) * Wh, (Math.floor(k / 5) / 4 - 0.5) * Dh);
    lowest = Math.min(lowest, heightAt(w, q.x, q.z));
    if (wing) {
      const r = housePoint(hc, yaw, wing.side * (Wh / 2 - wing.w / 2) + ((k % 5) / 4 - 0.5) * wing.w, -(Dh / 2 + wing.d / 2) + (Math.floor(k / 5) / 4 - 0.5) * wing.d);
      lowest = Math.min(lowest, heightAt(w, r.x, r.z));
    }
  }
  const drop = houseFloor(w, { hc, yaw, house: spec }) - lowest;
  if (drop > 1.5) return null;
  const tileSet = new Set(tiles);
  const houseTiles: number[] = [];
  const trees: number[] = [];
  for (const i of tiles) {
    const p = { x: tileX(w, i % w.w), z: tileZ(w, (i / w.w) | 0) };
    if (!houseContains(spec, hc, yaw, p, 0.2)) {
      // Trees hard against the walls come down too (their trunks would stand in the eaves).
      const tr = w.treeAt[i];
      if (tr >= 0 && !w.trees[tr].protected && houseContains(spec, hc, yaw, p, 1.0)) trees.push(tr);
      continue;
    }
    if (w.bushAt[i] >= 0) return null;
    const tr = w.treeAt[i];
    if (tr >= 0) { if (w.trees[tr].protected) return null; trees.push(tr); }
    houseTiles.push(i);
  }
  // The whole house must stand on the plot, with the door reachable.
  for (let k = 0; k < 24; k++) {
    const q = housePoint(hc, yaw, ((k % 6) / 5 - 0.5) * spec.W, (Math.floor(k / 6) / 3 - 0.5) * spec.D);
    if (!tileSet.has(idx(w, toTileX(w, q.x), toTileZ(w, q.z)))) return null;
  }
  const dist = Math.hypot(O.x - CAMP.x, O.z - CAMP.z);
  let score = Math.abs(dist - 12) * 0.35 + trees.length * 1.5 + lanes * 2 - meadow * 0.03 + cand.bonus + rng.next() * 1.5 + drop * 1.5;
  // Houses like to face the village, not turn their backs on it.
  if (dot({ x: -n.x, z: -n.z }, norm({ x: CAMP.x - O.x, z: CAMP.z - O.z })) < -0.2) score += 2;
  const plot: Plot = { id: 0, household: 0, origin: O, t, n, corners, tiles, house: spec, hc, yaw, yard: [] };
  return { plot, trees, houseTiles, score, from: cand.from };
}

/** Survey the home ground for the best free plot for a household of this size. */
export function findPlot(w: World, v: Village, beds: number, rng: Rng): PlotPlan | null {
  const cands = [...neighbourCandidates(v, rng), ...streetCandidates(w, rng), ...ringCandidates(w)];
  let best: PlotPlan | null = null;
  // A full plot if there's room; a narrow one if that's all that's left (or
  // all a single person wants).
  for (const compact of beds <= 2 ? [true] : [false, true]) {
    for (const cand of cands) {
      for (let k = 0; k < 2; k++) {
        const p = tryPlot(w, v, cand, beds, rng, compact);
        if (p && (!best || p.score < best.score)) best = p;
      }
    }
    if (best) return best;
  }
  return null;
}

// ---------- building homes ----------

export const HOME_COST = (tier: Tier, beds: number): Cost => (tier === 0
  ? { wood: 14 + beds * 4, scrap: 8 + beds * 2, glimmer: 0 }
  : { wood: 28 + beds * 6, scrap: 3, glimmer: 0 });
export const HOME_WORK = (tier: Tier, beds: number) => (tier === 0 ? 1900 + beds * 400 : 2500 + beds * 500);
/** People who can usefully work on one site at once (the household can always help). */
export const SITE_CREW = 3;
/** Days a household waits for the council before starting on its own. */
export const SELF_START = 8;

const footOfTiles = (w: World, tiles: number[]): Footprint => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const i of tiles) { const tx = i % w.w, tz = (i / w.w) | 0; x0 = Math.min(x0, tx); x1 = Math.max(x1, tx); z0 = Math.min(z0, tz); z1 = Math.max(z1, tz); }
  return { tx: x0, tz: z0, w: x1 - x0 + 1, d: z1 - z0 + 1 };
};

/** Households waiting for a home, in the order they should get one. */
export function waitingHouseholds(v: Village): Household[] {
  const building = new Set(v.projects.filter((p) => !p.done && p.kind === 'home').map((p) => p.household));
  return v.households.filter((h) => !h.home && !building.has(h.id));
}

/**
 * Start a home if one is due: approved petitions first, then (if people have
 * nowhere to sleep) the largest waiting household. Returns the project.
 */
export function planHome(col: Colony, rng: Rng, lead: string, urgent: boolean): Project | null {
  const v = col.village, w = col.world, c = col.community;
  if (v.projects.filter((p) => !p.done && p.kind === 'home').length >= 2) return null;
  const waiting = waitingHouseholds(v);
  let h = v.homeQueue.map((id) => waiting.find((x) => x.id === id)).find((x) => !!x);
  let selfStart = false;
  if (!h && urgent) h = [...waiting].sort((a, b) => b.members.length - a.members.length)[0];
  if (!h) {
    // Tired of waiting on the council, a household starts anyway.
    h = [...waiting].sort((a, b) => a.since - b.since).find((x) => c.day - x.since >= SELF_START);
    selfStart = !!h;
  }
  if (!h) return null;
  const beds = Math.min(4, h.members.length + 1);
  // Don't re-survey land that had no room today unless something changed.
  const landKey = `${c.day}:${w.zoneVersion}:${v.buildings.length}:${v.projects.length}:${beds}`;
  if (v.noPlotKey === landKey) return null;
  const plan = findPlot(w, v, beds, rng);
  if (!plan) v.noPlotKey = landKey;
  const name = householdName(c, h);
  if (!plan) {
    v.noPlotDay = c.day;
    const key = `noplot${c.day}`;
    if (!col.hints.has(key) && c.day % 3 === 0) {
      col.hints.add(key);
      log(c, `${name} walked the home ground looking for room for a house and plot. There isn't any left. (Paint more Home zone.)`, 'info');
    }
    return null;
  }
  const plot = plan.plot;
  plot.id = v.nextId++;
  plot.household = h.id;
  v.plots.push(plot);
  for (const i of plot.tiles) v.plotAt[i] = plot.id;
  v.homeQueue = v.homeQueue.filter((id) => id !== h!.id);
  const tier = v.tier;
  const { X, Z } = houseAxes(plot.yaw);
  void X;
  const door = { x: plot.hc.x + Z.x * (plot.house.D / 2 + 0.7), z: plot.hc.z + Z.z * (plot.house.D / 2 + 0.7) };
  const proj: Project = {
    id: v.nextId++, kind: 'home', tier, name: `${h.members.length > 1 ? `${name}'s house` : `${name}'s cottage`}`,
    foot: footOfTiles(w, plan.houseTiles), facing: 0, cost: HOME_COST(tier, beds), delivered: { wood: 0, scrap: 0, glimmer: 0 },
    incoming: { wood: 0, scrap: 0, glimmer: 0 }, work: 0, workNeeded: HOME_WORK(tier, beds), target: 0, clearTrees: plan.trees, done: false,
    plot: plot.id, household: h.id, blockTiles: plan.houseTiles, door, inside: { ...plot.hc }, yaw: plot.yaw,
  };
  v.projects.push(proj);
  const dx = plot.origin.x - w.campfire.x, dz = plot.origin.z - w.campfire.z;
  const where = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : (dz > 0 ? 'south' : 'north');
  const facing = plan.from === 'street' ? 'fronting the lane' : plan.from === 'row' ? 'next to their neighbours' : 'facing the green';
  if (selfStart) log(c, `Tired of waiting on the council, ${name} paced out a plot ${where} of the fire anyway, ${facing}.`, 'info');
  else log(c, `${name} paced out a plot ${where} of the fire, ${facing}. ${lead} is drawing up the house.`, 'good');
  return proj;
}
