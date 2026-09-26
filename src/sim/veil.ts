/**
 * The Veil: a layer of reality only some can perceive.
 *
 * - Resonance: how thin the Veil is at a place (a coarse field over the map).
 *   Undisturbed nature, sacred ground and shrines raise it; felling, salvage
 *   and suffering lower it. It drifts back toward the land's baseline.
 * - Sight: each survivor's perception of the hidden layer (on Survivor).
 * - Phenomena: things in the hidden layer. Each witness reads one by
 *   Sight + local Resonance − depth: nothing, a chill, a luminous form, or a
 *   coherent entity with intent.
 * - Influence: the player's power, grown from the community's collective Sight.
 */
import type { Colony } from './colony';
import { alive, log, remember, type Survivor } from './community';
import type { Rng } from './rng';
import { Ground, Zone, idx, reveal, tileX, tileZ, toTileX, toTileZ, type Point, type World } from './world';

export const CELL = 4; // tiles per resonance cell

export interface Veil {
  cw: number;
  ch: number;
  /** Current resonance per cell, 0..1. */
  res: Float32Array;
  /** The land's own baseline per cell (before zones and shrines). */
  base: Float32Array;
  version: number;
  phenomena: Phenomenon[];
  nextId: number;
  influence: number;
  /** Requests entities have made, waiting to become council proposals. */
  requests: EntityRequest[];
  /** Survivors whose deaths have already been felt by the land. */
  mourned: Set<number>;
}

export type PhenomKind = 'moth_woman' | 'lantern_man' | 'stag' | 'choir' | 'shade' | 'hollow' | 'orb';
export type Reading = 'none' | 'chill' | 'luminous' | 'coherent';

export interface Witness { id: number; reading: Reading }

export interface Phenomenon {
  id: number;
  kind: PhenomKind;
  x: number;
  z: number;
  /** Game minute it fades. */
  until: number;
  witnesses: Witness[];
  /** Individual accounts already written to the log (the rest go into testimony). */
  logged: number;
  /** For shades: whose shade it is. */
  of?: number;
}

export interface EntityRequest { kind: 'offering' | 'grove'; from: PhenomKind; x: number; z: number; by: number }

interface PhenomDef {
  name: string;
  depth: number;
  night: boolean;
  /** Spawn condition on local resonance. */
  minRes: number;
  maxRes: number;
  chill: string | string[];
  luminous: string | string[];
  coherent: string | string[];
  color: string;
}

export const PHENOMENA: Record<PhenomKind, PhenomDef> = {
  choir: {
    name: 'the Choir', depth: 25, night: true, minRes: 0.45, maxRes: 1, color: '#bff7ea',
    chill: ['{a} heard something like humming from the Ring, then nothing.', 'The Ring went quiet all at once, and {a} felt it.'],
    luminous: ['{a} saw the wisps circling in time, as if they were singing.', '{a} watched the wisps braid themselves into a slow ring of light.'],
    coherent: [
      '{a} understood the wisps\' song. It was about the old highway.',
      '{a} caught a verse of the wisps\' song: something about the rain before the Quiet.',
      'The wisps sang {a}\'s name back to them, and then a name {a} didn\'t know.',
      '{a} sat in the middle of the Choir until it finished. They won\'t say what it was about.',
    ],
  },
  stag: {
    name: 'the White Stag', depth: 35, night: false, minRes: 0.5, maxRes: 1, color: '#f4f1e0',
    chill: ['{a} felt watched from the meadow and couldn\'t say why.', '{a} found hoofprints that stopped in the middle of the grass.'],
    luminous: ['{a} saw a stag made of light at the edge of the trees.', 'Something pale and antlered watched {a} from the long grass.'],
    coherent: ['The White Stag walked beside {a} for a while. {a} came home lighter.', 'The White Stag let {a} come close enough to touch. {a} hasn\'t stopped smiling.'],
  },
  shade: {
    name: 'a shade', depth: 30, night: true, minRes: 0, maxRes: 1, color: '#c9d4ff',
    chill: '{a} felt a cold spot by the memorial stones.',
    luminous: '{a} saw a figure standing by the memorial stones.',
    coherent: '{a} spoke with {dead} by the stones, one last time.',
  },
  lantern_man: {
    name: 'the Lantern Man', depth: 45, night: true, minRes: 0.3, maxRes: 1, color: '#ffd89a',
    chill: ['{a} saw a light swinging on the road where nobody was walking.', '{a} heard footsteps on the asphalt that kept pace, then stopped.'],
    luminous: ['{a} followed a lantern-light along the highway until it went out.', 'A lantern bobbed at the edge of the firelight. {a} called out; it went away.'],
    coherent: 'An old man with a lantern stopped {a} on the road. He pointed the way to something, and asked for a little glimmer.',
  },
  moth_woman: {
    name: 'the Moth Woman', depth: 55, night: true, minRes: 0.6, maxRes: 1, color: '#e8dcff',
    chill: ['{a} walked through a cloud of pale moths and felt dizzy.', 'Moths covered the side of the house where {a} was standing, then all left at once.'],
    luminous: ['{a} saw a tall shape made of moths among the trees.', 'At the edge of the firelight, {a} saw moths holding the shape of a woman.'],
    coherent: 'A woman made of moths asked {a} to keep her grove unbroken.',
  },
  orb: {
    name: 'the Orb', depth: 65, night: true, minRes: 0.55, maxRes: 1, color: '#fff4e0',
    chill: 'The air over the Ring pressed on {a}\'s ears, like before a storm.',
    luminous: '{a} saw the Orb come down low over the Ring, silent.',
    coherent: 'The Orb came down to the Ring. {a} says it was listening, and that something listened back.',
  },
  hollow: {
    name: 'a Hollow', depth: 10, night: false, minRes: 0, maxRes: 0.3, color: '#3a2a4a',
    chill: ['{a} felt a pressure in the air near camp, like a held breath.', 'Sound goes dull near the woodpile. {a} doesn\'t like standing there.'],
    luminous: ['{a} saw a place where the light bends wrong.', '{a} saw a shadow near camp with nothing to cast it.'],
    coherent: '{a} looked into the Hollow, and it looked back.',
  },
};

// ---------- setup ----------

function groundBase(g: number): number {
  switch (g) {
    case Ground.Forest: return 0.72;
    case Ground.Meadow: return 0.6;
    case Ground.Water: return 0.66;
    case Ground.Grass: return 0.5;
    case Ground.Concrete: return 0.25;
    case Ground.Asphalt: return 0.22;
    default: return 0.45;
  }
}

export function createVeil(w: World): Veil {
  const cw = Math.ceil(w.w / CELL), ch = Math.ceil(w.h / CELL);
  const base = new Float32Array(cw * ch);
  for (let cz = 0; cz < ch; cz++) for (let cx = 0; cx < cw; cx++) {
    let sum = 0, n = 0;
    for (let dz = 0; dz < CELL; dz++) for (let dx = 0; dx < CELL; dx++) {
      const tx = cx * CELL + dx, tz = cz * CELL + dz;
      if (tx >= w.w || tz >= w.h) continue;
      const i = idx(w, tx, tz);
      sum += groundBase(w.ground[i]) + (w.treeAt[i] >= 0 ? 0.08 : 0) - (w.blocked[i] ? 0.05 : 0);
      n++;
    }
    const x = tileX(w, cx * CELL + CELL / 2), z = tileZ(w, cz * CELL + CELL / 2);
    const ring = Math.hypot(x - w.fairyRing.x, z - w.fairyRing.z);
    base[cz * cw + cx] = Math.min(1, sum / Math.max(n, 1) + Math.max(0, 0.35 - ring * 0.025));
  }
  return {
    cw, ch, res: base.slice(), base, version: 0, phenomena: [], nextId: 1,
    influence: 10, requests: [], mourned: new Set(),
  };
}

const cellOf = (v: Veil, w: World, x: number, z: number) => {
  const cx = Math.max(0, Math.min(v.cw - 1, Math.floor(toTileX(w, x) / CELL)));
  const cz = Math.max(0, Math.min(v.ch - 1, Math.floor(toTileZ(w, z) / CELL)));
  return cz * v.cw + cx;
};

export function resonanceAt(col: Colony, x: number, z: number): number {
  return col.veil.res[cellOf(col.veil, col.world, x, z)];
}

/** Average resonance over the home zone. */
export function homeResonance(col: Colony): number {
  const w = col.world, v = col.veil;
  let sum = 0, n = 0;
  for (let cz = 0; cz < v.ch; cz++) for (let cx = 0; cx < v.cw; cx++) {
    const i = idx(w, Math.min(w.w - 1, cx * CELL + 2), Math.min(w.h - 1, cz * CELL + 2));
    if (w.zone[i] !== Zone.Home) continue;
    sum += v.res[cz * v.cw + cx];
    n++;
  }
  return n ? sum / n : resonanceAt(col, w.home.x, w.home.z);
}

/** Lower resonance around a point (felling, salvage, suffering). */
export function disturb(col: Colony, x: number, z: number, amount: number, radiusCells = 1) {
  const v = col.veil, w = col.world;
  const c = cellOf(v, w, x, z);
  const cx = c % v.cw, cz = Math.floor(c / v.cw);
  for (let dz = -radiusCells; dz <= radiusCells; dz++) for (let dx = -radiusCells; dx <= radiusCells; dx++) {
    const x2 = cx + dx, z2 = cz + dz;
    if (x2 < 0 || z2 < 0 || x2 >= v.cw || z2 >= v.ch) continue;
    const fall = 1 / (1 + Math.hypot(dx, dz));
    const i = z2 * v.cw + x2;
    v.res[i] = Math.max(0, Math.min(1, v.res[i] - amount * fall));
  }
  v.version++;
}

export const nurture = (col: Colony, x: number, z: number, amount: number, radiusCells = 1) =>
  disturb(col, x, z, -amount, radiusCells);

// ---------- daily drift ----------

/** Where the land wants to be: baseline, plus sacred ground, shrines and lanterns. */
function targetResonance(col: Colony): Float32Array {
  const v = col.veil, w = col.world;
  const t = v.base.slice();
  for (let cz = 0; cz < v.ch; cz++) for (let cx = 0; cx < v.cw; cx++) {
    let sacred = 0, n = 0;
    for (let dz = 0; dz < CELL; dz += 2) for (let dx = 0; dx < CELL; dx += 2) {
      const tx = cx * CELL + dx, tz = cz * CELL + dz;
      if (tx >= w.w || tz >= w.h) continue;
      if (w.zone[idx(w, tx, tz)] === Zone.Sacred) sacred++;
      n++;
    }
    t[cz * v.cw + cx] += (sacred / Math.max(n, 1)) * 0.3;
  }
  for (const b of col.village.buildings) {
    if (b.kind !== 'shrine' && b.kind !== 'lantern') continue;
    const bx = tileX(w, b.foot.tx), bz = tileZ(w, b.foot.tz);
    const c = cellOf(v, w, bx, bz);
    const cx = c % v.cw, cz = Math.floor(c / v.cw);
    const r = b.kind === 'shrine' ? 3 : 1, amt = b.kind === 'shrine' ? 0.22 : 0.06;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const x2 = cx + dx, z2 = cz + dz;
      if (x2 < 0 || z2 < 0 || x2 >= v.cw || z2 >= v.ch) continue;
      t[z2 * v.cw + x2] += amt / (1 + Math.hypot(dx, dz) * 0.6);
    }
  }
  for (let i = 0; i < t.length; i++) t[i] = Math.min(1, t[i]);
  return t;
}

export function veilDaily(col: Colony, hardship: { cold: boolean; rationing: boolean }) {
  const v = col.veil, c = col.community;
  const t = targetResonance(col);
  for (let i = 0; i < v.res.length; i++) v.res[i] += (t[i] - v.res[i]) * 0.05;
  // Suffering thins the Veil around home.
  const h = col.world.home;
  if (hardship.cold) disturb(col, h.x, h.z, 0.04, 3);
  if (hardship.rationing) disturb(col, h.x, h.z, 0.03, 3);
  for (const s of c.survivors) {
    if (s.alive || s.departed || v.mourned.has(s.id)) continue;
    v.mourned.add(s.id);
    disturb(col, h.x, h.z, 0.2, 4);
  }
  v.version++;
}

// ---------- hourly: sight, influence, phenomena ----------

export function veilHourly(col: Colony, rng: Rng, hour: number, night: boolean) {
  const v = col.veil;
  const living = alive(col.community);
  let sightSum = 0;
  for (const s of living) {
    const a = col.agents.find((x) => x.id === s.id);
    if (!a) continue;
    const res = resonanceAt(col, a.x, a.z);
    let d = 0;
    if (a.task?.kind === 'attune' && a.task.stage === 'sit') d += 0.35 * (0.5 + res);
    if (a.task?.kind === 'sleep' && a.task.stage === 'sleep') d += 0.02 * res; // dreaming
    if (res > 0.6) d += 0.02;
    if (a.needs.rest < 15) d -= 0.1; // exhaustion
    if (s.griefDays > 0) d -= 0.05;
    s.sight = Math.max(0, Math.min(100, s.sight + d));
    sightSum += s.sight;
  }
  // The more they perceive, the more clearly they sense the player.
  v.influence = Math.min(100, v.influence + (sightSum / 100) * 0.03);

  spawnPhenomena(col, rng, hour, night);
  encounters(col, rng);
  // Fade out and report testimony.
  for (const p of v.phenomena) if (col.minute >= p.until) testimony(col, p);
  v.phenomena = v.phenomena.filter((p) => col.minute < p.until);
}

function place(col: Colony, rng: Rng, kind: PhenomKind): Point | null {
  const w = col.world;
  switch (kind) {
    case 'choir': case 'orb': return { x: w.fairyRing.x + rng.range(-2, 2), z: w.fairyRing.z + rng.range(-2, 2) };
    case 'shade': return { x: -7.4 + rng.range(-1, 1), z: -3.6 + rng.range(-1, 1) };
    default: {
      // Things show themselves at the edge of where people are: just past the
      // firelight, beyond the field, along the road someone is walking.
      const awake = col.agents.filter((a) => !a.indoors && a.task?.kind !== 'sleep');
      if (!awake.length) return null;
      const who = rng.pick(awake);
      const ang = rng.range(0, Math.PI * 2), r = rng.range(5, 9);
      return { x: who.x + Math.cos(ang) * r, z: who.z + Math.sin(ang) * r };
    }
  }
}

function spawnPhenomena(col: Colony, rng: Rng, hour: number, night: boolean) {
  const v = col.veil;
  if (v.phenomena.length >= 3) return;
  const hr = homeResonance(col);
  const grieving = alive(col.community).some((s) => s.griefDays > 0);
  const recentDead = col.community.survivors.filter((s) => !s.alive && !s.departed && (s.diedOnDay ?? -99) >= col.community.day - 6);
  const kinds = Object.keys(PHENOMENA) as PhenomKind[];
  for (const kind of rng.shuffle(kinds)) {
    const def = PHENOMENA[kind];
    if (def.night && !night) continue;
    if (v.phenomena.some((p) => p.kind === kind)) continue;
    if (kind === 'shade' && (!grieving || !recentDead.length)) continue;
    const at = place(col, rng, kind);
    if (!at) continue;
    const res = kind === 'hollow' ? hr : resonanceAt(col, at.x, at.z);
    if (res < def.minRes || res > def.maxRes) continue;
    const chance = kind === 'hollow' ? 0.06 : kind === 'orb' ? 0.004 : kind === 'shade' ? 0.08 : 0.012 + (res - def.minRes) * 0.04;
    if (!rng.chance(chance)) continue;
    const p: Phenomenon = {
      id: v.nextId++, kind, x: at.x, z: at.z, until: col.minute + rng.range(3, 8) * 60, witnesses: [], logged: 0,
      of: kind === 'shade' ? rng.pick(recentDead).id : undefined,
    };
    v.phenomena.push(p);
    void hour;
    return;
  }
}

/** How a survivor perceives a phenomenon, from their Sight and the place. */
export function readingFor(col: Colony, s: Survivor, p: Phenomenon): Reading {
  const def = PHENOMENA[p.kind];
  const score = s.sight + resonanceAt(col, p.x, p.z) * 40 + (s.traits.includes('orb_touched') ? 10 : 0) - def.depth;
  return score < -10 ? 'none' : score < 10 ? 'chill' : score < 35 ? 'luminous' : 'coherent';
}

function encounters(col: Colony, rng: Rng) {
  const c = col.community;
  for (const p of col.veil.phenomena) {
    for (const a of col.agents) {
      if (a.indoors || p.witnesses.some((w) => w.id === a.id)) continue;
      if (Math.hypot(a.x - p.x, a.z - p.z) > 7) continue;
      const s = c.survivors.find((x) => x.id === a.id);
      if (!s) continue;
      const reading = readingFor(col, s, p);
      p.witnesses.push({ id: s.id, reading });
      if (reading !== 'none') experience(col, rng, s, p, reading);
    }
  }
}

const first = (s: Survivor) => s.name.split(' ')[0];

function experience(col: Colony, rng: Rng, s: Survivor, p: Phenomenon, reading: Exclude<Reading, 'none'>) {
  const c = col.community;
  const def = PHENOMENA[p.kind];
  const dead = p.of ? c.survivors.find((x) => x.id === p.of) : undefined;
  const recent = new Set(c.log.slice(-15).map((l) => l.text));
  const variants = ([] as string[]).concat(def[reading])
    .map((t) => t.replaceAll('{a}', first(s)).replaceAll('{dead}', dead ? first(dead) : 'someone'));
  const fresh = variants.filter((t) => !recent.has(t));
  const text = rng.pick(fresh.length ? fresh : variants);
  const skittish = s.traits.includes('skittish');
  const brave = s.traits.includes('brave');
  const bump = (m: number) => { s.morale = Math.max(0, Math.min(100, s.morale + m)); };
  const hostile = p.kind === 'hollow';

  if (reading === 'chill') {
    bump(hostile ? -5 : skittish ? -5 : brave ? 0 : -2);
  } else if (reading === 'luminous') {
    if (hostile) { bump(-6); s.sight = Math.max(0, s.sight - 2); } else bump(skittish ? -3 : 4);
    s.sight = Math.min(100, s.sight + 1);
  } else {
    s.sight = Math.min(100, s.sight + 3);
    switch (p.kind) {
      case 'stag': bump(10); s.griefDays = Math.max(0, s.griefDays - 2); break;
      case 'choir': c.resources.glimmer += 3; bump(5); break;
      case 'shade': s.griefDays = 0; bump(8); break;
      case 'orb': s.sight = Math.min(100, s.sight + 10); col.veil.influence = Math.min(100, col.veil.influence + 15); break;
      case 'hollow': bump(-8); s.sight = Math.min(100, s.sight + 4); break;
      case 'lantern_man': {
        // He points the way: reveal a patch of the map toward something undiscovered.
        const target = col.world.pois.find((q) => !q.discovered);
        if (target) {
          const tx = tileX(col.world, target.tx), tz = tileZ(col.world, target.tz);
          reveal(col.world, tx, tz, 9);
        }
        col.veil.requests.push({ kind: 'offering', from: 'lantern_man', x: p.x, z: p.z, by: s.id });
        bump(3);
        break;
      }
      case 'moth_woman':
        col.veil.requests.push({ kind: 'grove', from: 'moth_woman', x: p.x, z: p.z, by: s.id });
        bump(4);
        break;
    }
    remember(s, c.day, text);
  }
  const tone = hostile || (reading === 'chill') ? 'bad' : 'strange';
  // Chills are only worth a line for the easily spooked, so the log isn't flooded.
  if ((reading !== 'chill' || skittish || hostile) && fresh.length && p.logged < 2) {
    p.logged++;
    log(c, text, tone);
  }
}

/** When a phenomenon fades, disagreeing witnesses make for testimony. */
function testimony(col: Colony, p: Phenomenon) {
  const c = col.community;
  const readings = new Set(p.witnesses.map((w) => w.reading));
  if (p.witnesses.length < 2 || readings.size < 2) return;
  const name = (id: number) => first(c.survivors.find((s) => s.id === id)!);
  const words: Record<Reading, string> = {
    none: 'saw nothing', chill: 'only felt cold', luminous: 'saw a figure of light', coherent: `met ${PHENOMENA[p.kind].name}`,
  };
  const parts = [...readings].map((r) => {
    const who = p.witnesses.filter((w) => w.reading === r).map((w) => name(w.id));
    const list = who.length > 3 ? `${who.slice(0, 2).join(', ')} and ${who.length - 2} others` : who.join(' and ');
    return `${list} ${words[r]}`;
  });
  log(c, `${parts.join('. ')}.`, 'strange');
}

/** Community-wide Sight: the mean over the living. */
export function communitySight(col: Colony): number {
  const living = alive(col.community);
  return living.length ? living.reduce((n, s) => n + s.sight, 0) / living.length : 0;
}
