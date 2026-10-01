/**
 * What a clearing team carries and how the dark works (DESIGN §38.11–38.14).
 *
 * - The dark: ground is seen only where light falls, and for a turn after
 *   (`Clearing.dusk`); spirits are perceived by Sight, not by light.
 * - Lanterns: raised (bright, and noticed), shuttered (dim, unnoticed, and
 *   frightening), or set down (a pool of light, a ward). Fuel burns each turn;
 *   a Hollow drinks it and can gutter a lantern. Someone with no light on
 *   them loses Nerve. Warm light comforts a remnant that wants it; a torch
 *   beam breaks a lamp's lure and a hedge's tricks, and makes a remnant flinch.
 * - Signs: traces the spirits leave, found where light falls.
 * - Sounding: a seer's sonar. Echoes come back exact, as a circle, or only as
 *   a bearing (an arc); they fade; two arcs from two places make a circle. A
 *   loud call is heard: lamps reach for the caller, the Hollow turns to them,
 *   remnants hide deeper.
 * - Wards and the kit: two slots each (salt, iron, rowan, a bell, oil, a
 *   radio), carried from home and paid for there; and the hearthstone.
 */
import type { Colony } from './colony';
import type { Clearing, Spirit, Unit, Ward } from './haunt';
import { BESIDE, FOLK_SUITED, clearingDistrict, clearingHaunt, dist, gridOf, spiritAt, within } from './haunt';
import { powerSupply } from './power';
import { Rng } from './rng';
import { resonanceAt } from './veil';
import { lineOfSight, type Pt } from './veilmove';
import { idx, inBounds, tileX, tileZ, toTileX, toTileZ } from './world';

// ---------- types ----------

export type LanternKind = 'tin' | 'torch';
export type LanternState = 'raised' | 'shuttered' | 'down';
export interface Lantern {
  kind: LanternKind;
  state: LanternState;
  /** Turns of light left. */
  fuel: number;
  max: number;
  lit: boolean;
  /** Where it stands, once set down. */
  x?: number; z?: number;
  /** A torch's bearing (radians, atan2(dz, dx)). */
  aim?: number;
}
export type ItemKind = 'salt' | 'iron' | 'rowan' | 'bell' | 'oil' | 'radio';
export type WardKind = 'pool' | 'salt' | 'iron' | 'rowan' | 'bell' | 'hearth';
export interface Sign { id: number; spirit: number; x: number; z: number; text: string; found: boolean }
export type EchoQuality = 'exact' | 'circle' | 'arc' | 'ring';
/**
 * Where something was sensed. exact/circle: at (x, z) within r. arc: from
 * `from`, along `bearing` ± `spread`, at `dist` ± r. ring: `dist` ± r from
 * `from`, in any direction (the radio).
 */
export interface Echo {
  spirit: number;
  turn: number;
  quality: EchoQuality;
  x: number; z: number; r: number;
  from?: Pt; bearing?: number; spread?: number; dist?: number;
  source: 'sound' | 'call' | 'bell' | 'radio' | 'sign';
}

// ---------- numbers ----------

export const LANTERN: Record<LanternKind, { r: number; fuel: number; warm: boolean; label: string }> = {
  tin: { r: 4, fuel: 14, warm: true, label: 'tin lantern' },
  torch: { r: 8, fuel: 10, warm: false, label: 'electric torch' },
};
const TORCH_HALF = 0.45;
const TORCH_SPILL = 1.5;
const SHUTTER_R = 1.2;
export const POOL_R = 3.5;
const FAE_GLOW = 2;
export const HEARTH_R = 2.5;
/** How far a quiet sounding and a call reach. */
export const SOUND_R = 9, CALL_R = 18;
/** Who can sound the Veil. */
export const SEER_SIGHT = 35;

export const ITEMS: Record<ItemKind, { label: string; note: string; cost: Partial<Record<'food' | 'wood' | 'scrap', number>>; power?: boolean }> = {
  salt: { label: 'Salt', note: 'A line up to five paces long: hedge-folk and lamps cannot reach across it. Hedge-folk wear it away.', cost: {} },
  iron: { label: 'Iron', note: 'A line like salt, twice as strong. The Folk can\'t abide it: a Folk companion near it loses heart, and in country the Folk love they will hear of it.', cost: { scrap: 2 } },
  rowan: { label: 'Rowan', note: 'A small ring: inside it nobody\'s Nerve falls below 2, and they steady a little each turn. A Hollow withers it.', cost: { wood: 1 } },
  bell: { label: 'Bell', note: 'Hung on a post: at every turn\'s end it rings for any spirit within four paces, and the team knows exactly where it is.', cost: { scrap: 1 } },
  oil: { label: 'Spare fuel', note: 'Six more turns of light for a lantern.', cost: { food: 1 } },
  radio: { label: 'Radio', note: 'Hisses louder the nearer a spirit is: how far, not which way. Needs the village\'s power to charge.', cost: { scrap: 1 }, power: true },
};

// ---------- the kit: lanterns and slots, from home ----------

/** The lantern someone takes: a torch if the village has power and they'd see little by a lantern anyway. */
export function lanternFor(sight: number, torches: number): Lantern {
  const kind: LanternKind = torches > 0 && sight < 30 ? 'torch' : 'tin';
  return { kind, state: 'raised', fuel: LANTERN[kind].fuel, max: LANTERN[kind].fuel, lit: true };
}

/** What each would pack, left to themselves: seers a bell, anchors rowan, everyone salt or fuel. */
export function defaultKit(col: Colony, team: Unit[]): Record<number, ItemKind[]> {
  const out: Record<number, ItemKind[]> = {};
  const power = powerSupply(col) > 0;
  team.forEach((u, i) => {
    if (u.fae) { out[u.id] = []; return; }
    if (u.sight >= SEER_SIGHT) out[u.id] = [i === 0 ? 'bell' : 'salt', 'oil'];
    else if (u.anchor) out[u.id] = ['rowan', 'salt'];
    else out[u.id] = [power ? 'radio' : 'salt', 'oil'];
  });
  return out;
}

/** Pay for the kit from the stores; whatever can't be paid for stays at home. Returns what each actually carries. */
export function packKit(col: Colony, team: Unit[], kit: Record<number, ItemKind[]>) {
  const r = col.community.resources;
  const power = powerSupply(col) > 0;
  for (const u of team) {
    u.slots = [];
    for (const it of (kit[u.id] ?? []).slice(0, 2)) {
      const def = ITEMS[it];
      if (u.fae || (def.power && !power)) continue;
      if (Object.entries(def.cost).some(([k, n]) => (r[k as 'food' | 'wood' | 'scrap'] ?? 0) < (n ?? 0))) continue;
      for (const [k, n] of Object.entries(def.cost)) r[k as 'food' | 'wood' | 'scrap'] -= n ?? 0;
      u.slots.push(it);
    }
    // Candles and lamp oil come from the stores too: short of food, the lanterns go out half full.
    if (u.lantern?.kind === 'tin') {
      if (r.food >= 1) r.food -= 1;
      else u.lantern.fuel = u.lantern.max = Math.ceil(u.lantern.max / 2);
    }
  }
}

// ---------- light ----------

export interface Light { x: number; z: number; r: number; warm: boolean; dir?: number; owner?: number; kind: 'lantern' | 'shuttered' | 'pool' | 'torch' | 'glow' | 'hearth' }

/** Every light in the clearing now. */
export function lightsOf(col: Colony, cl: Clearing): Light[] {
  const out: Light[] = [];
  for (const u of cl.units) {
    if (u.state !== 'in') continue;
    if (u.fae) { out.push({ x: u.x, z: u.z, r: FAE_GLOW, warm: false, kind: 'glow', owner: u.id }); continue; }
    const l = u.lantern;
    if (!l?.lit || l.state === 'down') continue;
    if (l.state === 'shuttered') out.push({ x: u.x, z: u.z, r: SHUTTER_R, warm: true, kind: 'shuttered', owner: u.id });
    else if (l.kind === 'torch') {
      out.push({ x: u.x, z: u.z, r: LANTERN.torch.r, warm: false, dir: l.aim ?? aimHome(col, cl, u), kind: 'torch', owner: u.id });
      out.push({ x: u.x, z: u.z, r: TORCH_SPILL, warm: false, kind: 'shuttered', owner: u.id });
    } else out.push({ x: u.x, z: u.z, r: LANTERN.tin.r, warm: true, kind: 'lantern', owner: u.id });
  }
  for (const w of cl.wards) {
    if (w.kind === 'hearth') out.push({ x: w.x, z: w.z, r: HEARTH_R, warm: true, kind: 'hearth' });
    if (w.kind === 'pool') {
      const l = cl.units.find((u) => u.id === w.owner)?.lantern;
      if (l?.lit) out.push({ x: w.x, z: w.z, r: POOL_R, warm: l.kind === 'tin', kind: 'pool', owner: w.owner });
    }
  }
  return out;
}

/** A torch not yet aimed points into the district. */
function aimHome(col: Colony, cl: Clearing, u: Unit) {
  const d = clearingDistrict(col, cl);
  return Math.atan2(d.z - u.z, d.x - u.x);
}

/** Does this light reach a point (radius, a torch's cone, and nothing in the way)? */
export function reachesPoint(col: Colony, cl: Clearing, l: Light, p: Pt): boolean {
  const d = Math.hypot(p.x - l.x, p.z - l.z);
  if (d > l.r) return false;
  if (l.dir !== undefined && d > TORCH_SPILL) {
    let a = Math.atan2(p.z - l.z, p.x - l.x) - l.dir;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) > TORCH_HALF) return false;
  }
  return d < 0.8 || lineOfSight(gridOf(col, cl), l, p);
}

/** The light on a point: whether any, whether warm, whether a torch beam, and which lights. */
export function lightAt(col: Colony, cl: Clearing, p: Pt, except?: number): { lit: boolean; warm: boolean; torch: boolean; others: boolean } {
  let lit = false, warm = false, torch = false, others = false;
  for (const l of lightsOf(col, cl)) {
    if (!reachesPoint(col, cl, l, p)) continue;
    lit = true;
    if (l.warm) warm = true;
    if (l.kind === 'torch') torch = true;
    if (l.owner !== except || l.kind === 'pool' || l.kind === 'hearth') others = true;
  }
  return { lit, warm, torch, others };
}

/** Tiles lit right now (tile indices). */
export function litTiles(col: Colony, cl: Clearing): Set<number> {
  const w = col.world, out = new Set<number>();
  for (const l of lightsOf(col, cl)) {
    const r = Math.ceil(l.r);
    const cx = toTileX(w, l.x), cz = toTileZ(w, l.z);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const tx = cx + dx, tz = cz + dz;
      if (!inBounds(w, tx, tz)) continue;
      const i = idx(w, tx, tz);
      if (out.has(i)) continue;
      if (reachesPoint(col, cl, l, { x: tileX(w, tx), z: tileZ(w, tz) })) out.add(i);
    }
  }
  return out;
}

/** What the team can see of the ground: lit now, or lit at the end of last turn. */
export function seenTiles(col: Colony, cl: Clearing): Set<number> {
  const s = litTiles(col, cl);
  for (const i of cl.dusk) s.add(i);
  return s;
}

/** Is someone standing in any light at all (their own, a friend's, a pool)? */
export const inLight = (col: Colony, cl: Clearing, u: Unit) => u.fae ? true : lightAt(col, cl, u).lit;

// ---------- lanterns: what can be done with one ----------

export type LanternOp = 'raise' | 'shutter' | 'set_down' | 'pick_up' | 'relight' | 'refuel' | 'aim';
export const LANTERN_COST: Record<LanternOp, number> = { raise: 0, shutter: 0, set_down: 0, pick_up: 0, relight: 1, refuel: 1, aim: 0 };

/** What someone could do with their lantern now (with reasons for what they can't). */
export function lanternOps(col: Colony, cl: Clearing, u: Unit): { op: LanternOp; ok: boolean; why?: string }[] {
  const l = u.lantern;
  if (!l || u.fae) return [];
  const out: { op: LanternOp; ok: boolean; why?: string }[] = [];
  const pool = cl.wards.find((w) => w.kind === 'pool' && w.owner === u.id);
  if (l.state === 'down') {
    out.push({ op: 'pick_up', ok: !!pool && dist(col, u, pool) <= BESIDE + 0.4, why: 'Walk back to it first.' });
  } else {
    if (l.state === 'shuttered') out.push({ op: 'raise', ok: true });
    else out.push({ op: 'shutter', ok: true });
    out.push({ op: 'set_down', ok: true });
    if (l.kind === 'torch' && l.state === 'raised') out.push({ op: 'aim', ok: l.lit, why: 'It is out.' });
  }
  if (!l.lit) out.push({ op: 'relight', ok: l.fuel > 0 && u.ap >= 1, why: l.fuel <= 0 ? 'No fuel left in it.' : 'No time left this turn.' });
  if (u.slots.includes('oil') && l.fuel < l.max) out.push({ op: 'refuel', ok: u.ap >= 1, why: 'No time left this turn.' });
  return out;
}

/** Do something with a lantern. `target`: for aiming, a spirit's id (the beam points at it). Returns why not, or null. */
export function useLantern(col: Colony, cl: Clearing, u: Unit, op: LanternOp, target?: number): string | null {
  const l = u.lantern;
  if (!l) return 'They carry no lantern.';
  const can = lanternOps(col, cl, u).find((x) => x.op === op);
  if (!can) return 'Not now.';
  if (!can.ok) return can.why ?? 'Not now.';
  u.ap -= LANTERN_COST[op];
  switch (op) {
    case 'raise': l.state = 'raised'; say(cl, `${u.name} opened the shutter. The light spilled out across the street.`); break;
    case 'shutter': l.state = 'shuttered'; say(cl, `${u.name} closed the lantern's shutter down to a slit.`); break;
    case 'set_down':
      l.state = 'down'; l.x = u.x; l.z = u.z;
      cl.wards.push({ kind: 'pool', x: u.x, z: u.z, r: POOL_R, hp: 1, owner: u.id });
      say(cl, `${u.name} set ${l.kind === 'torch' ? 'the torch' : 'the lantern'} down on the ground and stepped out of its light.`);
      break;
    case 'pick_up':
      cl.wards = cl.wards.filter((w) => !(w.kind === 'pool' && w.owner === u.id));
      l.state = 'raised'; l.x = l.z = undefined;
      say(cl, `${u.name} took up ${l.kind === 'torch' ? 'the torch' : 'the lantern'} again.`);
      break;
    case 'relight': l.lit = true; say(cl, `${u.name} got the light going again, hands not quite steady.`); break;
    case 'refuel':
      l.fuel = Math.min(l.max, l.fuel + 6);
      u.slots.splice(u.slots.indexOf('oil'), 1);
      say(cl, `${u.name} filled the lantern from the spare can.`);
      break;
    case 'aim': {
      const s = target !== undefined ? clearingHaunt(col, cl).spirits.find((x) => x.id === target) : undefined;
      if (!s) return 'Aim it at something.';
      const p = spiritAt(col, s);
      l.aim = Math.atan2(p.z - u.z, p.x - u.x);
      say(cl, `${u.name} turned the torch's beam on ${s.known >= 1 ? s.name : 'the dark'}.`);
      break;
    }
  }
  look(col, cl);
  return null;
}

// ---------- signs ----------

const SIGN_TEXT: Record<Spirit['kind'], string[]> = {
  remnant: ['frost on the inside of a window', 'a door that won\'t stay shut', 'a radio playing softly in an empty kitchen', 'slippers set side by side at the foot of the stairs'],
  hedge: ['brambles knotted across a doorway', 'footprints that go round in circles', 'a garden gnome turned to face the wall', 'laughter, very small, from under a hedge'],
  lamp: ['a path of trodden grass that leads nowhere', 'a light glimpsed between two houses, then gone', 'moths, all flying the same way'],
  hollow: ['the birdsong stops here', 'ash on the ground, though nothing burned', 'breath that fogs, and the fog falls'],
};
const NEED_SIGN: Record<string, string> = {
  object: 'a photograph frame on the step, empty',
  company: 'two cups set out on a garden table, one untouched',
  light: 'a candle stub on every windowsill in the street',
  food: 'a table laid for a meal nobody came to',
  glimmer: 'coins pressed into the mud in a little spiral',
};

/** Two traces near each spirit (three near a Hollow), one hinting at what a remnant wants. */
export function makeSigns(col: Colony, cl: Clearing): Sign[] {
  const out: Sign[] = [];
  const g = gridOf(col, cl);
  for (const s of clearingHaunt(col, cl).spirits) {
    if (s.fate !== 'present') continue;
    const rng = new Rng((cl.rng ^ (s.id * 7349)) >>> 0);
    const p = spiritAt(col, s);
    const texts = [...SIGN_TEXT[s.kind]];
    const n = s.kind === 'hollow' ? 3 : 2;
    for (let k = 0; k < n; k++) {
      let at: Pt | null = null;
      for (let tries = 0; tries < 20 && !at; tries++) {
        const a = rng.range(0, Math.PI * 2), d = rng.range(1.8, 4.8);
        const q = { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d };
        if (g.walkable(q.x, q.z)) at = q;
      }
      if (!at) continue;
      const text = k === 0 && s.kind === 'remnant' ? NEED_SIGN[s.need] : texts.splice(rng.int(0, texts.length - 1), 1)[0];
      out.push({ id: out.length, spirit: s.id, x: at.x, z: at.z, text, found: false });
    }
  }
  return out;
}

/** Look around: any sign the light now falls on is found. */
export function look(col: Colony, cl: Clearing) {
  const w = col.world;
  let lit: Set<number> | null = null;
  for (const sg of cl.signs) {
    if (sg.found) continue;
    lit ??= litTiles(col, cl);
    if (!lit.has(idx(w, toTileX(w, sg.x), toTileZ(w, sg.z)))) continue;
    const s = clearingHaunt(col, cl).spirits.find((x) => x.id === sg.spirit);
    sg.found = true;
    const finder = cl.units.filter((u) => u.state === 'in').sort((a, b) => dist(col, a, sg) - dist(col, b, sg))[0];
    say(cl, `${finder?.name ?? 'Someone'} found ${sg.text}.`);
    if (!s || s.fate !== 'present') continue;
    // A trace points at whatever left it: somewhere near.
    const rng = new Rng((cl.rng ^ (sg.id * 131) ^ cl.turn) >>> 0);
    const p = spiritAt(col, s), a = rng.range(0, Math.PI * 2), off = rng.range(0, 1.5);
    addEcho(cl, { spirit: s.id, turn: cl.turn, quality: 'circle', x: p.x + Math.cos(a) * off, z: p.z + Math.sin(a) * off, r: 3, source: 'sign' });
  }
}

// ---------- echoes ----------

const RANK: Record<EchoQuality, number> = { ring: 0, arc: 1, circle: 2, exact: 3 };

/** Keep the best fresh word on each spirit; two bearings from two places make a circle. */
export function addEcho(cl: Clearing, e: Echo) {
  const old = cl.echoes.find((x) => x.spirit === e.spirit);
  if (e.quality === 'arc' && old?.quality === 'arc' && old.from && e.from && cl.turn - old.turn <= 1 && Math.hypot(old.from.x - e.from.x, old.from.z - e.from.z) >= 4) {
    // Triangulated: where the two bearings cross, give or take a pace.
    const x = crossing(old, e);
    if (x) e = { spirit: e.spirit, turn: cl.turn, quality: 'circle', x: x.x, z: x.z, r: 1.4, source: e.source };
  }
  if (old && old.turn === e.turn && RANK[old.quality] > RANK[e.quality]) return;
  if (old && RANK[old.quality] > RANK[e.quality] + (e.turn - old.turn)) return;
  cl.echoes = cl.echoes.filter((x) => x.spirit !== e.spirit);
  cl.echoes.push(e);
}

function crossing(a: Echo, b: Echo): Pt | null {
  const p = a.from!, q = b.from!;
  const r = { x: Math.cos(a.bearing!), z: Math.sin(a.bearing!) }, s = { x: Math.cos(b.bearing!), z: Math.sin(b.bearing!) };
  const den = r.x * s.z - r.z * s.x;
  if (Math.abs(den) < 0.15) return null; // near parallel: no better than before
  const t = ((q.x - p.x) * s.z - (q.z - p.z) * s.x) / den;
  if (t < 0) return null;
  return { x: p.x + r.x * t, z: p.z + r.z * t };
}

/** The echoes fade: each turn they say a little less. */
export function ageEchoes(col: Colony, cl: Clearing) {
  const present = new Set(clearingHaunt(col, cl).spirits.filter((s) => s.fate === 'present').map((s) => s.id));
  cl.echoes = cl.echoes.filter((e) => present.has(e.spirit) && cl.turn - e.turn <= 3);
  for (const e of cl.echoes) {
    if (e.quality === 'exact') { e.quality = 'circle'; e.r = 1; }
    else e.r += 1;
    if (e.spread !== undefined) e.spread += 0.08;
  }
}

/** How clearly a sounding reaches a spirit: a reading, made worse by distance. */
function soundQuality(col: Colony, u: Unit, s: Spirit, loud: boolean): EchoQuality | null {
  const p = spiritAt(col, s);
  const d = Math.hypot(p.x - u.x, p.z - u.z);
  const v = u.sight + resonanceAt(col, p.x, p.z) * 40 - s.depth - d * 2 + (loud ? 5 : 0) + (u.fae === 'elder' ? 100 : 0);
  return v >= 35 ? 'exact' : v >= 10 ? 'circle' : v >= -20 ? 'arc' : null;
}

/** A seer sounds the Veil: quietly (close, unheard), or calling out (far, and heard). */
export function sound(col: Colony, cl: Clearing, u: Unit, loud: boolean): string | null {
  if (u.sight < SEER_SIGHT && !u.fae) return 'Only someone with Sight can sound the Veil.';
  if (u.ap < 1) return 'Not enough time this turn.';
  u.ap -= 1;
  const range = loud ? CALL_R : SOUND_R;
  const rng = new Rng((cl.rng ^ (u.id * 977) ^ (cl.turn * 31) ^ cl.echoes.length) >>> 0);
  let n = 0, clear = 0;
  for (const s of clearingHaunt(col, cl).spirits) {
    if (s.fate !== 'present') continue;
    const p = spiritAt(col, s);
    const d = Math.hypot(p.x - u.x, p.z - u.z);
    if (d > range) continue;
    if (loud) {
      cl.heard[s.id] = u.id;
      if (s.kind === 'remnant') s.depth = Math.min(60, s.depth + 8); // shy: they go deeper
    }
    const q = soundQuality(col, u, s, loud);
    if (!q) continue;
    n++;
    if (q === 'exact') { clear++; addEcho(cl, { spirit: s.id, turn: cl.turn, quality: q, x: p.x, z: p.z, r: 0.5, source: loud ? 'call' : 'sound' }); }
    else if (q === 'circle') {
      const a = rng.range(0, Math.PI * 2), off = rng.range(0, 1.5);
      addEcho(cl, { spirit: s.id, turn: cl.turn, quality: q, x: p.x + Math.cos(a) * off, z: p.z + Math.sin(a) * off, r: 2, source: loud ? 'call' : 'sound' });
    } else {
      const bearing = Math.atan2(p.z - u.z, p.x - u.x) + rng.range(-0.15, 0.15);
      const dd = d * rng.range(0.8, 1.2);
      addEcho(cl, { spirit: s.id, turn: cl.turn, quality: 'arc', x: u.x + Math.cos(bearing) * dd, z: u.z + Math.sin(bearing) * dd, r: Math.max(1, d * 0.25), from: { x: u.x, z: u.z }, bearing, spread: 0.35, dist: dd, source: loud ? 'call' : 'sound' });
    }
  }
  say(cl, loud
    ? `${u.name} called out into the dark. ${n ? `${n} answer${n > 1 ? 's' : ''} came back${clear ? `, ${clear} of them clear` : ''}` : 'Nothing answered'}. Whatever is out there heard it too.`
    : `${u.name} stood very still and listened to the Veil. ${n ? `${n} echo${n > 1 ? 'es' : ''}${clear ? `, ${clear} clear` : ''}.` : 'Nothing near.'}`);
  return null;
}

// ---------- wards ----------

/** Place what someone carries: a line (salt, iron) from where they stand toward a point, or a ring or bell at a point beside them. */
export function placeWard(col: Colony, cl: Clearing, u: Unit, item: ItemKind, x: number, z: number): string | null {
  if (u.fae) return 'The Folk won\'t touch iron or salt.';
  if (!u.slots.includes(item)) return `${u.name} isn't carrying any.`;
  if (item === 'oil' || item === 'radio') return 'That isn\'t a ward.';
  if (u.ap < 1) return 'Not enough time this turn.';
  const g = gridOf(col, cl);
  if (item === 'salt' || item === 'iron') {
    const d = Math.hypot(x - u.x, z - u.z);
    if (d < 1) return 'Draw it out further.';
    const k = Math.min(1, 5 / d);
    const x2 = u.x + (x - u.x) * k, z2 = u.z + (z - u.z) * k;
    cl.wards.push({ kind: item, x: u.x, z: u.z, x2, z2, r: 0, hp: item === 'salt' ? 4 : 8 });
    if (item === 'iron') cl.ironLaid = true;
    say(cl, item === 'salt' ? `${u.name} poured a line of salt across the ground.` : `${u.name} laid a line of old iron, railings and nails, across the ground. The air went flat and cold.`);
  } else {
    if (Math.hypot(x - u.x, z - u.z) > 2.2) return 'Put it down nearer.';
    if (!g.walkable(x, z)) return 'Not there.';
    cl.wards.push(item === 'rowan' ? { kind: 'rowan', x, z, r: 2, hp: 3 } : { kind: 'bell', x, z, r: 4.5, hp: 4 });
    say(cl, item === 'rowan' ? `${u.name} laid a ring of rowan twigs on the ground.` : `${u.name} drove in a stake and hung the bell from it.`);
  }
  u.slots.splice(u.slots.indexOf(item), 1);
  u.ap -= 1;
  return null;
}

/** Nearest distance from a point to a ward (to a line for salt and iron). */
export function wardDist(w: Ward, p: Pt): number {
  if (w.x2 === undefined || w.z2 === undefined) return Math.hypot(p.x - w.x, p.z - w.z);
  const dx = w.x2 - w.x, dz = w.z2 - w.z, L = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - w.x) * dx + (p.z - w.z) * dz) / L));
  return Math.hypot(p.x - (w.x + dx * t), p.z - (w.z + dz * t));
}

const isLine = (w: Ward) => w.kind === 'salt' || w.kind === 'iron';

/** Does a salt or iron line lie between two points? */
export function lineBetween(cl: Clearing, a: Pt, b: Pt): boolean {
  return cl.wards.some((w) => isLine(w) && crosses(a, b, { x: w.x, z: w.z }, { x: w.x2!, z: w.z2! }));
}
function crosses(p1: Pt, p2: Pt, q1: Pt, q2: Pt): boolean {
  const o = (a: Pt, b: Pt, c: Pt) => Math.sign((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
  return o(p1, p2, q1) !== o(p1, p2, q2) && o(q1, q2, p1) !== o(q1, q2, p2);
}

/** Inside a ring of rowan. */
export const inRowan = (cl: Clearing, p: Pt) => cl.wards.some((w) => w.kind === 'rowan' && wardDist(w, p) <= w.r + 0.3);
/** Beside the hearthstone: nobody is taken here. */
export const atHearth = (cl: Clearing, p: Pt) => cl.wards.some((w) => w.kind === 'hearth' && wardDist(w, p) <= HEARTH_R + 0.3);
/** In a pool of light that isn't their own lantern's (a set-down lantern, the hearth): lures fail, dread halves. */
export function inPool(col: Colony, cl: Clearing, p: Pt): boolean {
  return lightsOf(col, cl).some((l) => (l.kind === 'pool' || l.kind === 'hearth') && reachesPoint(col, cl, l, p));
}

// ---------- the end of a turn ----------

/** Before the spirits act: what the torches are shining on. */
export function beforeSpirits(col: Colony, cl: Clearing) {
  cl.beamed = [];
  const torches = lightsOf(col, cl).filter((l) => l.kind === 'torch');
  for (const s of clearingHaunt(col, cl).spirits) {
    if (s.fate !== 'present') continue;
    const p = spiritAt(col, s);
    if (torches.some((l) => reachesPoint(col, cl, l, p))) cl.beamed.push(s.id);
  }
}

/** After the spirits act: the light burns down, the dark frightens, wards wear, bells ring. */
export function afterSpirits(col: Colony, cl: Clearing) {
  const h = clearingHaunt(col, cl);
  const present = h.spirits.filter((s) => s.fate === 'present');
  const hollows = present.filter((s) => s.kind === 'hollow');
  const team = cl.units.filter((u) => u.state === 'in');
  const rng = new Rng((cl.rng ^ (cl.turn * 2654435761)) >>> 0);
  // Torches make remnants flinch.
  for (const id of cl.beamed) {
    const s = present.find((x) => x.id === id);
    if (s?.kind === 'remnant' && s.calm > 0) { s.calm -= 1; say(cl, `${cap(s.name)} flinched from the torch's glare.`); }
  }
  // Fuel burns; a Hollow drinks the light near it.
  for (const u of cl.units) {
    const l = u.lantern;
    if (!l?.lit) continue;
    const at = l.state === 'down' ? { x: l.x!, z: l.z! } : u;
    l.fuel -= l.state === 'shuttered' ? 0.5 : 1;
    const drunk = hollows.find((s) => dist(col, s, at) <= within(4));
    if (drunk) {
      l.fuel -= 1;
      if (rng.chance(0.35)) { l.lit = false; say(cl, `${cap(drunk.name)} drank ${u.name}'s light, and it went out.`); }
    }
    if (l.fuel <= 0) { l.fuel = 0; if (l.lit) say(cl, `${u.name}'s ${l.kind === 'torch' ? 'torch' : 'lantern'} guttered out.`); l.lit = false; }
  }
  // Warm light for a remnant that wanted a light to see by.
  for (const s of present) {
    if (s.kind !== 'remnant' || s.need !== 'light' || s.calm >= 2) continue;
    if (lightAt(col, cl, spiritAt(col, s)).warm) { s.calm += 1; say(cl, `${cap(s.name)} turned toward the warm light, and was quieter.`); }
  }
  // The dark frightens; a shuttered lantern alone, a little.
  for (const u of team) {
    if (u.fae) continue;
    const l = lightAt(col, cl, u, u.id);
    if (!l.lit) { u.nerve -= 1; say(cl, `${u.name} stood in the dark and felt it standing with them.`); }
    else if (u.lantern?.state === 'shuttered' && !l.others && cl.turn % 2 === 0) u.nerve -= 1;
  }
  // Iron: the Folk can't abide it.
  for (const u of team) if (u.fae && cl.wards.some((w) => w.kind === 'iron' && wardDist(w, u) <= 3)) { u.nerve -= 1; say(cl, `${u.name} shrank from the iron.`); }
  // Rowan steadies; nobody's nerve falls below 2 inside it.
  for (const u of team) if (inRowan(cl, u)) u.nerve = Math.min(u.maxNerve, Math.max(2, u.nerve) + 1);
  // Wards wear: a Hollow withers everything near it; the hedge-folk scuff salt.
  for (const w of cl.wards) {
    if (w.kind === 'pool' || w.kind === 'hearth') continue;
    if (hollows.some((s) => wardDist(w, spiritAt(col, s)) <= within(4))) w.hp -= 1;
    if (w.kind === 'salt' && present.some((s) => s.kind === 'hedge' && s.calm < 2 && wardDist(w, spiritAt(col, s)) <= within(2))) w.hp -= 1;
    if (w.hp <= 0) say(cl, `The ${w.kind === 'salt' ? 'salt line' : w.kind === 'iron' ? 'iron' : w.kind === 'rowan' ? 'rowan ring' : 'bell'} gave out.`);
  }
  cl.wards = cl.wards.filter((w) => w.hp > 0 || w.kind === 'pool' || w.kind === 'hearth');
  // Bells ring for whatever is near them; radios hiss.
  for (const w of cl.wards) {
    if (w.kind !== 'bell') continue;
    const near = present.filter((s) => wardDist(w, spiritAt(col, s)) <= w.r);
    for (const s of near) { const p = spiritAt(col, s); addEcho(cl, { spirit: s.id, turn: cl.turn, quality: 'exact', x: p.x, z: p.z, r: 0.5, source: 'bell' }); }
    if (near.length) say(cl, `The bell rang by itself, ${near.length > 1 ? 'over and over' : 'once'}.`);
  }
  for (const u of team) {
    if (!u.slots.includes('radio')) continue;
    const s = present.slice().sort((a, b) => dist(col, a, u) - dist(col, b, u))[0];
    const d = s ? dist(col, s, u) : Infinity;
    if (d > 12) { say(cl, `${u.name}'s radio gave only static.`); continue; }
    addEcho(cl, { spirit: s.id, turn: cl.turn, quality: 'ring', x: u.x, z: u.z, r: 1.5, from: { x: u.x, z: u.z }, dist: d, source: 'radio' });
    say(cl, `${u.name}'s radio ${d < 5 ? 'roared with static' : 'hissed'}: something about ${Math.round(d)} paces off.`);
  }
  cl.heard = {};
  cl.dusk = [...litTiles(col, cl)];
}

/** At the end: the Folk hear of iron laid in country they love. Returns the change in standing (≤ 0). */
export function ironReckoning(col: Colony, cl: Clearing): number {
  if (!cl.ironLaid) return 0;
  return FOLK_SUITED.includes(clearingDistrict(col, cl).kind) ? -3 : -1;
}

const say = (cl: Clearing, text: string) => { cl.log.push(text); if (cl.log.length > 40) cl.log.shift(); };
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
