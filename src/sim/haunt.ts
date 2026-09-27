/**
 * Haunted districts and clearing them (DESIGN §19).
 *
 * Every district of the old world is still occupied: by remnants (the old
 * world's dead, keeping their habits), wild spirits (hedge-folk, lamps that
 * lead people off the road) and, at the heart of the worst places, a Hollow
 * where the Veil has worn through. Nobody can settle or zone a haunted
 * district, and the salvage deep inside is out of reach.
 *
 * A clearing is a turn-based encounter inside the Veil: no time passes at
 * home. A small team walks in; each of them has Nerve instead of health.
 * What they can see depends on their Sight (the §4 perception gradient).
 * They listen, make offerings, lay the dead to rest, befriend or banish the
 * wild ones, ward themselves with light, steady each other, and unravel the
 * Hollow. Nerve that breaks sends someone fleeing home, rattled; someone
 * lured away as their Nerve breaks is *taken*, and comes back days or
 * seasons later, changed. Nobody dies in the Veil.
 */
import type { Colony } from './colony';
import { adjustBond, alive, bondValue, log, remember, withRng, type Survivor } from './community';
import { addFae, changeStanding } from './folk';
import type { District, DistrictKind, Ruin } from './oldworld';
import { Rng } from './rng';
import { disturb, nurture, resonanceAt } from './veil';
import { Ground, Zone, idx, inBounds, reveal, tileX, tileZ, toTileX, toTileZ, type World } from './world';

// ---------- data ----------

export type SpiritKind = 'remnant' | 'hedge' | 'lamp' | 'hollow';
export type SpiritFate = 'present' | 'rested' | 'invited' | 'befriended' | 'unravelled' | 'banished';
export type Need = 'object' | 'company' | 'light' | 'food' | 'glimmer';

export interface Spirit {
  id: number;
  kind: SpiritKind;
  name: string;
  tx: number; tz: number;
  /** How deep in the Veil it sits: higher is harder to perceive. */
  depth: number;
  /** What the village knows of it, 0..3 (kept between attempts). */
  known: number;
  /** Progress toward peace: 2 is at peace. */
  calm: number;
  /** A Hollow's hold on the world; 0 unravels it. */
  integrity: number;
  need: Need;
  /** A remnant's old home (ruin id), if it had one. */
  home?: number;
  fate: SpiritFate;
}

export interface Haunt {
  district: number;
  spirits: Spirit[];
  /** unknown: never been close; sensed: scouts felt it; cleared: settled or given. */
  state: 'unknown' | 'sensed' | 'cleared';
  owner: null | 'village' | 'folk';
  /** Day before which the spirits are too stirred up for another attempt. */
  stirredUntil: number;
  attempts: number;
}

export interface TakenRecord { id: number; since: number; until: number; from: string }

/** Districts that suit the Folk better than the village. */
export const FOLK_SUITED: DistrictKind[] = ['farmstead', 'garden'];

const ROSTER: Record<DistrictKind, SpiritKind[]> = {
  suburb: ['remnant', 'remnant', 'hedge', 'lamp', 'hollow'],
  strip: ['remnant', 'lamp', 'hedge', 'hollow'],
  works: ['remnant', 'lamp', 'hollow'],
  farmstead: ['hedge', 'hedge', 'remnant'],
  oldtown: ['remnant', 'remnant', 'hedge', 'hollow'],
  garden: ['hedge', 'lamp', 'hedge'],
};
const DEPTH: Record<SpiritKind, number> = { remnant: 20, hedge: 30, lamp: 35, hollow: 5 };
const INTEGRITY: Partial<Record<DistrictKind, number>> = { suburb: 5, strip: 6, works: 7, oldtown: 6 };

export const KIND_NAME: Record<SpiritKind, string> = { remnant: 'a remnant', hedge: 'a hedge-spirit', lamp: 'a lamp', hollow: 'a Hollow' };
export const NEED_TEXT: Record<Need, string> = {
  object: 'something of theirs brought home',
  company: 'someone to listen to them',
  light: 'a light to see by (a ward beside them)',
  food: 'food, freely given',
  glimmer: 'glimmer',
};

/** How far a haunting reaches from a district's centre: no zoning inside it. */
export const HAUNT_RADIUS = 22;

function remnantName(r: Ruin, rng: Rng): string {
  const pick = (xs: string[]) => rng.pick(xs);
  switch (r.kind) {
    case 'house': return pick([`the woman who waits at ${r.name}`, `the boy on the step of ${r.name}`, `the old man still mowing at ${r.name}`, `the girl at the window of ${r.name}`]);
    case 'garage': return `the man under the car in ${r.name}`;
    case 'shop': case 'bigbox': return pick([`the queue at ${r.name}`, `the night manager of ${r.name}`, `the shelf-stacker of ${r.name}`]);
    case 'warehouse': case 'shed': return `the night watchman of ${r.name}`;
    case 'farmhouse': case 'barn': return `the farmer's wife at ${r.name}`;
    case 'terrace': return pick([`the landlady of ${r.name}`, `the piano teacher of ${r.name}`]);
    case 'chapel': return `the bell-ringer of ${r.name}`;
    case 'glasshouse': return `the gardener in ${r.name}`;
    default: return `someone still living at ${r.name}`;
  }
}

/** Every district's occupants. Seeded from the world, so the same map has the same ghosts. */
export function createHaunts(w: World): Haunt[] {
  const rng = new Rng(w.seed ^ 0x6a057);
  const haunts: Haunt[] = [];
  w.haunted = new Uint8Array(w.w * w.h);
  for (const d of w.districts) {
    const spirits: Spirit[] = [];
    const used = new Set<number>();
    const taken = new Set<string>();
    const place = (tx: number, tz: number) => {
      // Nearest walkable free tile.
      for (let r = 0; r < 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const x = tx + dx, z = tz + dz;
        if (!inBounds(w, x, z) || taken.has(`${x},${z}`) || !walkable(w, x, z)) continue;
        taken.add(`${x},${z}`);
        return { tx: x, tz: z };
      }
      return { tx, tz };
    };
    const ruins = d.ruins.map((i) => w.ruins[i]).filter(Boolean);
    const big = [...ruins].sort((a, b) => b.w * b.d - a.w * a.d)[0];
    for (const kind of ROSTER[d.kind]) {
      const s: Spirit = { id: spirits.length, kind, name: '', tx: 0, tz: 0, depth: DEPTH[kind], known: 0, calm: 0, integrity: 0, need: 'food', fate: 'present' };
      if (kind === 'remnant') {
        const r = rng.shuffle(ruins.filter((x) => !used.has(x.id) && x !== big && x.kind !== 'silo'))[0] ?? big;
        if (!r) continue;
        used.add(r.id);
        s.name = remnantName(r, rng);
        s.home = r.id;
        Object.assign(s, place(toTileX(w, r.x), toTileZ(w, r.z)));
        s.need = rng.pick(['object', 'object', 'company', 'light'] as Need[]);
      } else if (kind === 'hedge') {
        const a = rng.range(0, Math.PI * 2), dist = rng.range(9, 15);
        s.name = rng.pick(['the Thorn Child', 'Old Nettle', 'a bramble-hob', 'the Briar Wife', 'a hedge-sprite']);
        Object.assign(s, place(toTileX(w, d.x + Math.cos(a) * dist), toTileZ(w, d.z + Math.sin(a) * dist)));
        s.need = rng.pick(['food', 'glimmer'] as Need[]);
      } else if (kind === 'lamp') {
        const a = rng.range(0, Math.PI * 2), dist = rng.range(5, 12);
        s.name = rng.pick(['the Pale Lamp', 'Jack-with-a-lantern', 'a will-o\'-the-wisp']);
        Object.assign(s, place(toTileX(w, d.x + Math.cos(a) * dist), toTileZ(w, d.z + Math.sin(a) * dist)));
        s.need = 'glimmer';
      } else {
        s.name = big && big.w * big.d > 60 ? `the Hollow under ${big.name}` : `the Hollow at the heart of ${d.name}`;
        const at = big && big.w * big.d > 60 ? { x: big.x, z: big.z } : { x: d.x, z: d.z };
        Object.assign(s, place(toTileX(w, at.x), toTileZ(w, at.z)));
        s.integrity = INTEGRITY[d.kind] ?? 5;
      }
      if (s.name && !spirits.some((o) => o.name === s.name)) spirits.push(s);
      else if (s.name) { s.name = `${s.name} (another)`; spirits.push(s); }
    }
    spirits.forEach((s, i) => { s.id = i; });
    haunts.push({ district: d.id, spirits, state: 'unknown', owner: null, stirredUntil: 0, attempts: 0 });
    markHaunted(w, d, 1);
  }
  return haunts;
}

function markHaunted(w: World, d: District, v: 0 | 1) {
  const cx = toTileX(w, d.x), cz = toTileZ(w, d.z);
  for (let dz = -HAUNT_RADIUS; dz <= HAUNT_RADIUS; dz++) for (let dx = -HAUNT_RADIUS; dx <= HAUNT_RADIUS; dx++) {
    const tx = cx + dx, tz = cz + dz;
    if (!inBounds(w, tx, tz) || Math.hypot(dx, dz) > HAUNT_RADIUS) continue;
    w.haunted![idx(w, tx, tz)] = v;
  }
  w.zoneVersion++;
}

/** Ground a clearing team can cross: anything but water, standing trees and wrecks; ruins can be walked through. */
function walkable(w: World, tx: number, tz: number): boolean {
  if (!inBounds(w, tx, tz)) return false;
  const i = idx(w, tx, tz);
  if (w.ground[i] === Ground.Water) return false;
  const t = w.treeAt[i];
  if (t >= 0 && !w.trees[t].felled) return false;
  if (w.heaps.some((h) => h.tx === tx && h.tz === tz)) return false;
  if (w.blocked[i] && !ruinAtTile(w, tx, tz)) return false;
  return true;
}

function ruinAtTile(w: World, tx: number, tz: number): Ruin | undefined {
  const x = tileX(w, tx), z = tileZ(w, tz);
  return w.ruins.find((r) => {
    if (Math.abs(x - r.x) > r.w + r.d || Math.abs(z - r.z) > r.w + r.d) return false;
    const cs = Math.cos(r.yaw), sn = Math.sin(r.yaw);
    const px = x - r.x, pz = z - r.z;
    return Math.abs(px * cs - pz * sn) <= r.w / 2 + 0.2 && Math.abs(px * sn + pz * cs) <= r.d / 2 + 0.2;
  });
}

// ---------- the home sim ----------

export const hauntOf = (col: Colony, districtId: number) => col.haunts.find((h) => h.district === districtId);
const present = (s: Spirit) => s.fate === 'present';

/** Salvage too close to a spirit is left alone. */
export function heapHaunted(col: Colony, tx: number, tz: number): boolean {
  for (const h of col.haunts) {
    if (h.state === 'cleared') continue;
    for (const s of h.spirits) if (present(s) && Math.max(Math.abs(s.tx - tx), Math.abs(s.tz - tz)) <= (s.kind === 'hollow' ? 9 : 5)) return true;
  }
  return false;
}

/** A district was discovered: whoever found it felt what lives there. */
export function senseDistrict(col: Colony, d: District, s: Survivor) {
  const h = hauntOf(col, d.id);
  if (!h || h.state !== 'unknown') return;
  h.state = 'sensed';
  const hollow = h.spirits.some((x) => x.kind === 'hollow' && present(x));
  const n = s.name.split(' ')[0];
  log(col.community, s.sight >= 40
    ? `${n} came back from ${d.name} very quiet. "It isn't empty. There are people still living there who aren't people${hollow ? ", and something under it all that's wrong" : ''}."`
    : `${n} came back from ${d.name} and wouldn't go near it again. "Cold spots. Doors that close by themselves. Leave it be."`, 'strange');
  if (!col.hints.has('clearing')) {
    col.hints.add('clearing');
    log(col.community, `(Click ${d.name} on the map to see what lives there, and to send a team into the Veil to settle it.)`, 'info');
  }
}

/** Daily: the taken come home when their time is up; the ones who love them keep a place for them. */
export function hauntDaily(col: Colony) {
  const c = col.community, day = c.day;
  for (const t of [...col.taken]) {
    const s = c.survivors.find((x) => x.id === t.id);
    if (!s) { col.taken = col.taken.filter((x) => x !== t); continue; }
    if (day < t.until) {
      // Loved ones keep a place for them.
      for (const o of alive(c)) if (bondValue(c, o.id, s.id) >= 20) o.morale = Math.max(0, o.morale - 1.5);
      withRng(c, (rng) => {
        const lover = alive(c).find((o) => bondValue(c, o.id, s.id) >= 20);
        if (lover && rng.chance(0.2)) {
          log(c, rng.pick([
            `${first(lover)} set a place for ${first(s)} at supper again.`,
            `${first(lover)} walked out to the edge of ${t.from} at dusk and called for ${first(s)}.`,
            `${first(lover)} won't let anyone sleep in ${first(s)}'s bed.`,
          ]), 'bad');
        }
      });
      continue;
    }
    returnTaken(col, s, t);
  }
}

function returnTaken(col: Colony, s: Survivor, t: TakenRecord) {
  const c = col.community;
  col.taken = col.taken.filter((x) => x !== t);
  s.alive = true;
  s.taken = false;
  const away = c.day - t.since;
  s.sight = Math.min(100, s.sight + 15);
  const n = first(s);
  withRng(c, (rng) => {
    const change = rng.pick(['white', 'folk', 'gift', 'forgot'] as const);
    let how = '';
    if (change === 'white') how = 'Their hair has gone white at the temples.';
    else if (change === 'folk') {
      how = 'They say the Folk looked after them, and they greet the hill by name now.';
      col.folk.met = true;
      const f = col.folk.beings.find((b) => !b.known);
      if (f) f.known = true;
    } else if (change === 'gift') {
      how = 'They came back with their pockets full of glimmer and no idea how it got there.';
      c.resources.glimmer += 5;
    } else {
      how = 'Some of the village is strange to them: faces they should know.';
      const bond = c.bonds.filter((b) => b.a === s.id || b.b === s.id).sort((a, b) => b.value - a.value)[0];
      if (bond) bond.value = Math.max(-20, bond.value - 30);
    }
    log(c, `${n} walked out of the trees near ${t.from} at dusk, ${away} days after the Veil took them, and asked what day it was. For them it had been one night. ${how}`, 'strange');
    remember(s, c.day, `Came back from the Veil after ${away} days. ${how}`);
  });
  for (const o of alive(c)) if (o !== s && bondValue(c, o.id, s.id) >= 20) { o.morale = Math.min(100, o.morale + 12); adjustBond(c, o.id, s.id, 5); }
  s.morale = Math.max(40, s.morale);
}

const first = (s: Survivor) => s.name.split(' ')[0];

// ---------- the clearing: a turn-based encounter inside the Veil ----------

export interface Unit {
  id: number;
  name: string;
  tx: number; tz: number;
  nerve: number; maxNerve: number;
  ap: number;
  sight: number;
  /** Low Sight: dread slides off them, and they steady others well. */
  anchor: boolean;
  state: 'in' | 'fled' | 'taken';
  /** Pulled by a spirit this turn (breaking now means being taken). */
  lured: boolean;
}

export interface Ward { tx: number; tz: number; r: number }

export interface Clearing {
  haunt: number;
  turn: number;
  maxTurns: number;
  units: Unit[];
  wards: Ward[];
  wardsLeft: number;
  /** Newest last. */
  log: string[];
  outcome: null | 'cleared' | 'withdrew' | 'lost';
  rng: number;
  /** What the team spent from the stores. */
  spent: { food: number; glimmer: number };
}

export const AP_PER_TURN = 2;
export const STEPS_PER_AP = 4;

export type Reading = 'none' | 'chill' | 'luminous' | 'coherent';
const RANK: Reading[] = ['none', 'chill', 'luminous', 'coherent'];

function clRng(cl: Clearing): Rng { const r = new Rng(cl.rng); return r; }
function saveRng(cl: Clearing, r: Rng) { cl.rng = r.state; }

export const cheb = (a: { tx: number; tz: number }, b: { tx: number; tz: number }) => Math.max(Math.abs(a.tx - b.tx), Math.abs(a.tz - b.tz));

export function clearingHaunt(col: Colony, cl: Clearing): Haunt { return col.haunts[cl.haunt]; }
export function clearingDistrict(col: Colony, cl: Clearing): District { return col.world.districts[col.haunts[cl.haunt].district]; }

/** Influence it takes to open the way into the Veil (later: free on full moons and festivals). */
export const VEIL_COST = 10;

/** Can a team go in now? Returns a reason if not. */
export function canClear(col: Colony, h: Haunt): string | null {
  const d = col.world.districts[h.district];
  const poi = col.world.pois.find((p) => p.kind === 'ruin' && p.name === d.name);
  if (h.state === 'cleared') return 'Already cleared.';
  if (!poi?.discovered) return 'Nobody has found it yet. Send a scout.';
  if (col.clearing) return 'A team is already in the Veil.';
  if (col.community.day < h.stirredUntil) return `The spirits there are stirred up. Wait until day ${h.stirredUntil}.`;
  if (col.veil.influence < VEIL_COST) return `Opening the way takes ${VEIL_COST} Influence (you have ${Math.floor(col.veil.influence)}).`;
  return null;
}

/** How one team member reads a spirit. */
export function readingOf(col: Colony, u: Unit, s: Spirit): Reading {
  const surv = col.community.survivors.find((x) => x.id === u.id);
  const res = resonanceAt(col, tileX(col.world, s.tx), tileZ(col.world, s.tz));
  const v = u.sight + res * 40 + (surv?.traits.includes('orb_touched') ? 10 : 0) - s.depth;
  if (cheb(u, s) > 10) return 'none';
  return v < -10 ? 'none' : v < 10 ? 'chill' : v < 35 ? 'luminous' : 'coherent';
}

/** The team's best reading of a spirit. */
export function teamReading(col: Colony, cl: Clearing, s: Spirit): Reading {
  let best: Reading = 'none';
  for (const u of cl.units) if (u.state === 'in') { const r = readingOf(col, u, s); if (RANK.indexOf(r) > RANK.indexOf(best)) best = r; }
  return best;
}

export function startClearing(col: Colony, hauntIdx: number, team: number[]): Clearing | string {
  const h = col.haunts[hauntIdx];
  const why = canClear(col, h);
  if (why) return why;
  const members = team.map((id) => alive(col.community).find((s) => s.id === id)).filter((s): s is Survivor => !!s);
  if (members.length < 1 || members.length > 4) return 'Send between one and four people.';
  const w = col.world, d = w.districts[h.district];
  // Enter along the road from home.
  const len = Math.hypot(d.x, d.z) || 1;
  const ex = d.x - (d.x / len) * 15, ez = d.z - (d.z / len) * 15;
  const units: Unit[] = [];
  const occupied = new Set(h.spirits.filter(present).map((s) => `${s.tx},${s.tz}`));
  for (const s of members) {
    const at = nearestFree(w, toTileX(w, ex), toTileZ(w, ez), (tx, tz) => !occupied.has(`${tx},${tz}`) && !units.some((u) => u.tx === tx && u.tz === tz));
    const maxNerve = 8 + (s.traits.includes('brave') ? 3 : 0) + (s.traits.includes('stoic') ? 2 : 0) - (s.traits.includes('skittish') ? 3 : 0) + Math.round((s.morale - 50) / 20);
    units.push({ id: s.id, name: first(s), tx: at.tx, tz: at.tz, nerve: maxNerve, maxNerve, ap: AP_PER_TURN, sight: s.sight, anchor: s.sight < 30, state: 'in', lured: false });
  }
  h.attempts++;
  col.veil.influence -= VEIL_COST;
  // Walking in, they see the whole of it.
  reveal(w, d.x, d.z, HAUNT_RADIUS);
  const cl: Clearing = {
    haunt: hauntIdx, turn: 1, maxTurns: 12, units, wards: [], wardsLeft: 2, log: [], outcome: null,
    rng: (w.seed ^ (h.district * 7919) ^ (col.community.day * 104729) ^ h.attempts) >>> 0, spent: { food: 0, glimmer: 0 },
  };
  cl.log.push(`${units.map((u) => u.name).join(', ')} stepped into the Veil at the edge of ${d.name}. At home, no time will pass.`);
  col.clearing = cl;
  return cl;
}

function nearestFree(w: World, tx: number, tz: number, ok: (tx: number, tz: number) => boolean) {
  for (let r = 0; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const x = tx + dx, z = tz + dz;
    if (walkable(w, x, z) && ok(x, z)) return { tx: x, tz: z };
  }
  return { tx, tz };
}

function blockedFor(col: Colony, cl: Clearing, self?: Unit) {
  const h = clearingHaunt(col, cl);
  const occ = new Set<string>();
  for (const s of h.spirits) if (present(s)) occ.add(`${s.tx},${s.tz}`);
  for (const u of cl.units) if (u.state === 'in' && u !== self) occ.add(`${u.tx},${u.tz}`);
  return occ;
}

/** Tiles a unit can reach this turn, with the steps each takes. */
export function reachable(col: Colony, cl: Clearing, u: Unit): Map<string, number> {
  const out = new Map<string, number>();
  if (u.state !== 'in' || u.ap <= 0) return out;
  const max = u.ap * STEPS_PER_AP;
  const occ = blockedFor(col, cl, u);
  const w = col.world;
  const q: [number, number, number][] = [[u.tx, u.tz, 0]];
  const seen = new Set([`${u.tx},${u.tz}`]);
  while (q.length) {
    const [x, z, d] = q.shift()!;
    if (d > 0) out.set(`${x},${z}`, d);
    if (d >= max) continue;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = x + dx, nz = z + dz, k = `${nx},${nz}`;
      if (seen.has(k) || occ.has(k) || !walkable(w, nx, nz)) continue;
      // No cutting corners between blocked tiles.
      if (dx && dz && (!walkable(w, x + dx, z) || !walkable(w, x, z + dz))) continue;
      seen.add(k);
      q.push([nx, nz, d + 1]);
    }
  }
  return out;
}

const inWard = (cl: Clearing, p: { tx: number; tz: number }) => cl.wards.some((wd) => cheb(wd, p) <= wd.r);
const say = (cl: Clearing, text: string) => { cl.log.push(text); if (cl.log.length > 40) cl.log.shift(); };

function unitOf(cl: Clearing, id: number) { const u = cl.units.find((x) => x.id === id && x.state === 'in'); return u; }
function spiritOf(col: Colony, cl: Clearing, id: number) { const s = clearingHaunt(col, cl).spirits.find((x) => x.id === id && present(x)); return s; }

export function moveUnit(col: Colony, cl: Clearing, unitId: number, tx: number, tz: number): string | null {
  const u = unitOf(cl, unitId);
  if (!u || cl.outcome) return 'They can\'t move.';
  const steps = reachable(col, cl, u).get(`${tx},${tz}`);
  if (steps === undefined) return 'Too far this turn.';
  u.ap -= Math.ceil(steps / STEPS_PER_AP);
  u.tx = tx; u.tz = tz;
  const inside = ruinAtTile(col.world, tx, tz);
  if (inside && !cl.log[cl.log.length - 1]?.includes(inside.name)) say(cl, `${u.name} went in through the door of ${inside.name}.`);
  return null;
}

/** What can be done to a spirit (or an ally) from where a unit stands. */
export type Verb = 'listen' | 'offer_food' | 'offer_glimmer' | 'offer_object' | 'rest' | 'invite' | 'befriend' | 'unravel' | 'banish' | 'steady' | 'ward';
export const VERB_COST: Record<Verb, number> = { listen: 1, offer_food: 1, offer_glimmer: 1, offer_object: 1, rest: 1, invite: 1, befriend: 1, unravel: 2, banish: 2, steady: 1, ward: 1 };

export function hasObjectFor(col: Colony, s: Spirit): boolean {
  if (s.home === undefined) return false;
  const r = col.world.ruins[s.home];
  return !!r && Object.keys(col.village.salvaged).some((k) => k.endsWith(`|${r.name}`));
}

/** Verbs a unit could use on a spirit right now (with reasons for the ones it can't). */
export function verbsFor(col: Colony, _cl: Clearing, u: Unit, s: Spirit): { verb: Verb; ok: boolean; why?: string }[] {
  const out: { verb: Verb; ok: boolean; why?: string }[] = [];
  const reading = readingOf(col, u, s);
  const near = cheb(u, s) <= 1;
  const res = col.community.resources;
  const add = (verb: Verb, ok: boolean, why?: string) => out.push({ verb, ok: ok && u.ap >= VERB_COST[verb], why: u.ap < VERB_COST[verb] ? 'Not enough time this turn.' : ok ? undefined : why });
  const more = s.known < 3 || (s.need === 'company' && s.calm < 3 && s.kind === 'remnant');
  add('listen', reading !== 'none' && cheb(u, s) <= 5 && more, reading === 'none' ? 'They can\'t perceive it at all.' : !more ? 'There is nothing more to learn from it.' : 'Get within five paces.');
  if (s.kind === 'hollow') {
    add('unravel', near, 'Stand beside it.');
    return out;
  }
  if (s.kind === 'remnant') {
    if (s.home !== undefined) add('offer_object', near && hasObjectFor(col, s), !near ? 'Stand beside them.' : 'The village has brought nothing home from their house yet.');
    add('offer_food', near && res.food >= 2, !near ? 'Stand beside them.' : 'Not enough food in the stores.');
    add('rest', near && s.calm >= 2 && s.known >= 2, !near ? 'Stand beside them.' : s.known < 2 ? 'You don\'t know what they need yet.' : 'They aren\'t at peace yet.');
    add('invite', near && s.calm >= 3 && s.known >= 3, !near ? 'Stand beside them.' : s.known < 3 ? 'You must know them fully first.' : 'They need more peace first (calm 3).');
  } else {
    add('offer_food', near && res.food >= 2, !near ? 'Stand beside it.' : 'Not enough food in the stores.');
    add('offer_glimmer', near && res.glimmer >= 1, !near ? 'Stand beside it.' : 'No glimmer in the stores.');
    add('befriend', near && s.known >= 1 && s.calm >= (s.kind === 'lamp' ? 3 : 2), !near ? 'Stand beside it.' : s.known < 1 ? 'Listen to it first.' : 'It isn\'t won over yet.');
  }
  add('banish', near && s.known >= 1, !near ? 'Stand beside it.' : 'You must at least know what it is.');
  return out;
}

export function act(col: Colony, cl: Clearing, unitId: number, verb: Verb, targetId?: number): string | null {
  const u = unitOf(cl, unitId);
  if (!u || cl.outcome) return 'They can\'t act.';
  const res = col.community.resources;
  if (verb === 'ward') {
    if (cl.wardsLeft <= 0) return 'No lanterns left to ward with.';
    if (u.ap < 1) return 'Not enough time this turn.';
    u.ap -= 1; cl.wardsLeft--;
    cl.wards.push({ tx: u.tx, tz: u.tz, r: 2 });
    say(cl, `${u.name} set down a lantern and drew a ring of salt around it. Inside the light, the Veil holds back.`);
    checkBreak(cl); settleCheck(col, cl);
    return null;
  }
  if (verb === 'steady') {
    const ally = cl.units.find((x) => x.id === targetId && x.state === 'in');
    if (!ally || ally === u) return 'Choose someone else.';
    if (cheb(u, ally) > 1) return 'Stand beside them.';
    if (u.ap < 1) return 'Not enough time this turn.';
    u.ap -= 1;
    const gain = u.anchor ? 3 : 2;
    ally.nerve = Math.min(ally.maxNerve, ally.nerve + gain);
    say(cl, u.anchor ? `${u.name} put a hand on ${ally.name}'s shoulder and talked about ordinary things until the shaking stopped.` : `${u.name} held ${ally.name}'s hand for a while.`);
    checkBreak(cl); settleCheck(col, cl);
    return null;
  }
  const s = targetId !== undefined ? spiritOf(col, cl, targetId) : undefined;
  if (!s) return 'Nothing there.';
  const v = verbsFor(col, cl, u, s).find((x) => x.verb === verb);
  if (!v) return 'That can\'t be done to it.';
  if (!v.ok) return v.why ?? 'Not now.';
  u.ap -= VERB_COST[verb];
  const reading = readingOf(col, u, s);
  switch (verb) {
    case 'listen': {
      const before = s.known;
      s.known = Math.min(3, s.known + (reading === 'coherent' ? 2 : 1));
      if (s.kind === 'hollow') {
        u.nerve -= 1;
        say(cl, `${u.name} listened to ${s.name}, and it listened back. (Its hold: ${s.integrity}. Light and steady hands weaken it.)`);
        break;
      }
      if (s.need === 'company' && before >= 1) s.calm += 1;
      const parts = [`It is ${KIND_NAME[s.kind]}: ${s.name}.`];
      if (s.known >= 2) parts.push(`It wants ${NEED_TEXT[s.need]}.`);
      if (s.known >= 3) parts.push(s.kind === 'remnant' ? 'They could be laid to rest, or asked to come home with you.' : 'It could be won over, or sent away.');
      say(cl, `${u.name} listened. ${parts.join(' ')}`);
      break;
    }
    case 'offer_food': case 'offer_glimmer': case 'offer_object': {
      const what = verb === 'offer_food' ? 'food' : verb === 'offer_glimmer' ? 'glimmer' : 'object';
      if (what === 'food') { res.food -= 2; cl.spent.food += 2; }
      if (what === 'glimmer') { res.glimmer -= 1; cl.spent.glimmer += 1; }
      const match = s.need === what;
      s.calm += match ? 2 : 1;
      const ruin = s.home !== undefined ? col.world.ruins[s.home] : undefined;
      say(cl, what === 'object' && ruin
        ? `${u.name} held out something the village had salvaged from ${ruin.name}. ${s.name} knew it at once.`
        : `${u.name} offered ${what}. ${match ? `${cap(s.name)} took it gladly.` : `${cap(s.name)} took it, but it isn't what it wanted.`}`);
      break;
    }
    case 'rest':
      s.fate = 'rested';
      say(cl, `${u.name} sat with ${s.name} until they were ready. Then there was nobody there, and the house was only a house.`);
      break;
    case 'invite':
      s.fate = 'invited';
      say(cl, `${u.name} asked ${s.name} to come home with them. They said yes. A hearth in the village will be warmer for it.`);
      break;
    case 'befriend':
      s.fate = 'befriended';
      say(cl, `${cap(s.name)} decided it liked ${u.name}. It will go to live with the Folk.`);
      break;
    case 'unravel': {
      const dmg = 1 + (inWard(cl, s) ? 1 : 0) + (u.anchor ? 1 : 0);
      s.integrity = Math.max(0, s.integrity - dmg);
      u.nerve -= u.anchor ? 1 : 2;
      if (s.integrity <= 0) {
        s.fate = 'unravelled';
        say(cl, `${u.name} pulled the last thread. ${cap(s.name)} came apart like wet paper, and the air in ${clearingDistrict(col, cl).name} went clear.`);
      } else say(cl, `${u.name} tore at ${s.name}. (Its hold: ${s.integrity}.)`);
      break;
    }
    case 'banish':
      s.fate = 'banished';
      say(cl, `${u.name} drove ${s.name} out. It went, but the place feels colder for it.`);
      break;
  }
  checkBreak(cl);
  settleCheck(col, cl);
  return null;
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** The district is quiet enough to settle: no Hollow, and everything left is at peace. */
export function quiet(col: Colony, cl: Clearing): boolean {
  return clearingHaunt(col, cl).spirits.every((s) => !present(s) || (s.kind !== 'hollow' && s.calm >= 2));
}

function settleCheck(col: Colony, cl: Clearing) {
  if (!cl.outcome && !cl.units.some((u) => u.state === 'in')) finish(col, cl, 'lost');
}

function checkBreak(cl: Clearing) {
  for (const u of cl.units) {
    if (u.state !== 'in' || u.nerve > 0) continue;
    if (u.lured) { u.state = 'taken'; say(cl, `${u.name} followed the light between two houses, and did not come out the other side.`); }
    else { u.state = 'fled'; say(cl, `${u.name}'s nerve broke. They ran for home and didn't stop.`); }
  }
}

/** Pull a unit up to n steps toward a point, over walkable free ground. */
function pull(col: Colony, cl: Clearing, u: Unit, to: { tx: number; tz: number }, n: number) {
  const occ = blockedFor(col, cl, u);
  for (let k = 0; k < n; k++) {
    if (cheb(u, to) <= 1) break;
    const nx = u.tx + Math.sign(to.tx - u.tx), nz = u.tz + Math.sign(to.tz - u.tz);
    if (!walkable(col.world, nx, nz) || occ.has(`${nx},${nz}`)) break;
    u.tx = nx; u.tz = nz;
  }
  u.lured = true;
}

export function endTurn(col: Colony, cl: Clearing) {
  if (cl.outcome) return;
  const h = clearingHaunt(col, cl);
  const rng = clRng(cl);
  for (const u of cl.units) u.lured = false;
  const team = () => cl.units.filter((u) => u.state === 'in');
  for (const s of h.spirits) {
    if (!present(s)) continue;
    if (s.kind === 'hollow') {
      // Toward morning the night deepens and it presses harder.
      const deep = cl.turn >= 7 ? 1 : 0;
      for (const u of team()) {
        if (cheb(u, s) > 4) continue;
        let loss = (u.anchor ? 1 : 2) + deep;
        if (inWard(cl, u)) loss = Math.ceil(loss / 2);
        u.nerve -= loss;
      }
      if (team().some((u) => cheb(u, s) <= 4)) say(cl, `${cap(s.name)} pressed on everyone near it, like a held breath.`);
    } else if (s.kind === 'remnant' && s.calm < 2) {
      const near = team().filter((u) => cheb(u, s) <= 2 && !u.anchor);
      for (const u of near) u.nerve -= 1;
      if (near.length) say(cl, `${cap(s.name)} wept. ${near.map((u) => u.name).join(' and ')} felt it in their chest.`);
    } else if (s.kind === 'hedge' && s.calm < 2) {
      const near = team().filter((u) => cheb(u, s) <= 5 && !inWard(cl, u));
      if (!near.length) continue;
      if (near.length >= 2 && rng.chance(0.4)) {
        const [a, b] = rng.shuffle([...near]).slice(0, 2);
        [a.tx, b.tx] = [b.tx, a.tx]; [a.tz, b.tz] = [b.tz, a.tz];
        a.nerve -= 1; b.nerve -= 1;
        say(cl, `${cap(s.name)} laughed, and ${a.name} and ${b.name} were suddenly standing in each other's places.`);
      } else {
        const u = near.sort((x, y) => cheb(x, s) - cheb(y, s))[0];
        pull(col, cl, u, s, 1);
        u.nerve -= 1;
        say(cl, `Something tugged ${u.name} toward the brambles.`);
      }
    } else if (s.kind === 'lamp' && s.calm < 2) {
      const near = team().filter((u) => cheb(u, s) <= 8 && !inWard(cl, u)).sort((x, y) => x.nerve - y.nerve);
      const u = near[0];
      if (!u) continue;
      pull(col, cl, u, s, 2);
      u.nerve -= 1;
      if (cheb(u, s) <= 1 && u.nerve <= 3) {
        u.state = 'taken';
        say(cl, `${u.name} walked after ${s.name} with a smile on their face, and the light went out, and so did they.`);
      } else say(cl, `${u.name} found themselves walking toward ${s.name}${cheb(u, s) <= 1 ? ', close enough to feel its warmth' : ''}.`);
    }
  }
  checkBreak(cl);
  saveRng(cl, rng);
  if (!team().length) { finish(col, cl, 'lost'); return; }
  cl.turn++;
  for (const u of team()) u.ap = AP_PER_TURN;
  if (cl.turn > cl.maxTurns) {
    say(cl, 'The Veil thinned toward morning. The team found themselves standing on an ordinary road.');
    finish(col, cl, quiet(col, cl) ? 'cleared' : 'withdrew');
  }
}

/** The team comes home. `settle` is chosen by the player when a district is quiet. */
export function finish(col: Colony, cl: Clearing, outcome: 'cleared' | 'withdrew' | 'lost') {
  if (cl.outcome) return;
  if (outcome === 'cleared' && !quiet(col, cl)) outcome = 'withdrew';
  cl.outcome = outcome;
  applyClearing(col, cl);
}

function applyClearing(col: Colony, cl: Clearing) {
  const c = col.community, w = col.world, h = clearingHaunt(col, cl), d = clearingDistrict(col, cl);
  const day = c.day;
  const surv = (id: number) => c.survivors.find((x) => x.id === id)!;
  // What happened to each spirit.
  for (const s of h.spirits) {
    if (s.fate === 'rested') { nurture(col, d.x, d.z, 0.08, 3); }
    if (s.fate === 'unravelled') { nurture(col, d.x, d.z, 0.2, 4); }
    if (s.fate === 'banished') { disturb(col, d.x, d.z, 0.08, 3); changeStanding(col, s.kind === 'remnant' ? -2 : -6); }
    if (s.fate === 'befriended') { addFae(col.folk, w, s.kind === 'lamp' ? 'sprite' : 'hob', col.folk.beings.length, s.name); changeStanding(col, 3); }
    if (s.fate === 'invited') {
      const homes = col.village.buildings.filter((b) => b.kind === 'home' && b.household && !col.village.hearths.some((x) => x.building === b.id));
      col.village.hearths.push({ name: s.name, building: homes[0]?.id ?? 0 });
    }
  }
  // The team.
  for (const u of cl.units) {
    const s = surv(u.id);
    if (u.state === 'fled') {
      s.morale = Math.max(0, s.morale - 12);
      remember(s, day, `Ran from ${d.name} with their nerve in pieces.`);
    } else if (u.state === 'taken') {
      withRng(c, (rng) => {
        const long = rng.chance(0.3);
        const until = day + (long ? rng.int(12, 30) : rng.int(3, 10));
        col.taken.push({ id: s.id, since: day, until, from: d.name });
      });
      s.alive = false;
      s.taken = true;
      for (const o of alive(c)) if (bondValue(c, o.id, s.id) >= 20) o.morale = Math.max(0, o.morale - 10);
    } else {
      const worn = u.nerve < u.maxNerve * 0.4;
      s.morale = Math.max(0, Math.min(100, s.morale + (cl.outcome === 'cleared' ? 6 : 0) - (worn ? 6 : 0)));
      remember(s, day, cl.outcome === 'cleared' ? `Walked into the Veil at ${d.name} and came out with it quiet.` : `Went into the Veil at ${d.name}.`);
      s.sight = Math.min(100, s.sight + 2);
    }
  }
  const back = cl.units.filter((u) => u.state !== 'taken').map((u) => u.name);
  const taken = cl.units.filter((u) => u.state === 'taken').map((u) => u.name);
  const resolved = h.spirits.filter((s) => s.fate !== 'present').length;
  if (cl.outcome === 'cleared') {
    h.state = 'cleared';
    markHaunted(w, d, 0);
    for (const s of h.spirits) if (present(s)) s.calm = Math.max(s.calm, 2);
    log(c, `${back.join(', ')} came back from ${d.name}. It's quiet there now. ${taken.length ? `${taken.join(' and ')} did not come back with them.` : ''} Who should have it: the village, or the Folk?`, 'good');
  } else {
    h.stirredUntil = day + 3;
    for (const s of h.spirits) if (present(s)) s.calm = Math.floor(s.calm / 2);
    log(c, `${back.length ? `${back.join(', ')} came back from ${d.name}` : `Nobody came back from ${d.name} that night`}${resolved ? `, having settled ${resolved} of what lives there` : ''}. ${taken.length ? `${taken.join(' and ')} did not come back. They have been taken.` : ''}`.trim(), taken.length ? 'bad' : 'strange');
  }
  col.lastClearing = cl;
  col.clearing = null;
}

/** After a clearing, who the district goes to. */
export function giveDistrict(col: Colony, districtId: number, to: 'village' | 'folk') {
  const h = hauntOf(col, districtId);
  if (!h || h.state !== 'cleared' || h.owner) return;
  h.owner = to;
  const w = col.world, d = w.districts[districtId];
  const suited = FOLK_SUITED.includes(d.kind);
  if (to === 'folk') {
    const cx = toTileX(w, d.x), cz = toTileZ(w, d.z);
    let n = 0;
    for (let dz = -14; dz <= 14; dz++) for (let dx = -14; dx <= 14; dx++) {
      const tx = cx + dx, tz = cz + dz;
      if (!inBounds(w, tx, tz) || Math.hypot(dx, dz) > 14) continue;
      const i = idx(w, tx, tz);
      const g = w.ground[i];
      if (g === Ground.Water || w.explored[i] <= 128) continue;
      // Paving is left to crack and green over; the Folk take it as it is.
      if (g === Ground.Asphalt || g === Ground.Concrete) { if (!w.blocked[i]) w.ground[i] = Ground.Grass; }
      w.zone[i] = Zone.Wild;
      n++;
    }
    w.zoneVersion++;
    changeStanding(col, suited ? 10 : 4);
    log(col.community, suited
      ? `${d.name} was left to the Folk. By the next full moon there were lights among the ruins, and the paving had started to green.`
      : `${d.name} was left to the Folk. They took it politely; it isn't the kind of place they love, but they'll make something of it.`, 'good');
  } else {
    log(col.community, suited
      ? `${d.name} is the village's now. The Folk would have liked it; they said nothing.`
      : `${d.name} is the village's now: its salvage, its roofs, its ground for zoning.`, 'good');
    if (suited) changeStanding(col, -2);
  }
}
