/**
 * The Folk: a people of the Veil who live beside the village (DESIGN §19).
 *
 * - Their mound is a grassy hill with a door, near the village from the
 *   start. Around it is their land, the Wild (a zone the player can grow or
 *   take back), and from it run Folk paths that nobody may build across.
 * - They are seen as well as the watcher's Sight allows: nothing, a light,
 *   a small bright figure, or someone with a name.
 * - Standing is how they feel about the village. Room, quiet, whole woods and
 *   offerings raise it; crowding, felling and taking their land lower it.
 * - The player guides what they give their nights to: the woods, the
 *   village (night chores), or their own home (the mound grows).
 */
import { KNOWES, housing, knoweCount, raiseKnowe, settleFolk, townhouseDaily, homeOf, type Knowe } from './townhouse';
import { HAUNT_RADIUS } from './haunt';
import type { Colony } from './colony';
import { alive, log, remember, withRng, type Survivor } from './community';
import type { Rng } from './rng';
import { nurture, resonanceAt } from './veil';
import {
  Crop, Ground, Zone, heightAt, idx, inBounds, reveal, tileX, tileZ, toTileX, toTileZ, type Point, type World,
} from './world';

// ---------- the land: mound, the Wild, paths (worldgen) ----------

export interface Mound { x: number; z: number; name: string; /** Radius of the hill. */ r: number; /** Direction the door faces (radians, atan2(z, x)). */ door: number }

export interface FolkLand {
  mound: Mound;
  /** Tile → 1 where a Folk path runs. Nothing is built on these. */
  path: Uint8Array;
  /** The paths as polylines (for drawing). */
  paths: Point[][];
}

const MOUND_NAMES = ['Thorn Knowe', 'the Hollow Hill', 'Bracken Howe', 'Elder Knoll', 'Foxglove Hill', 'the Green Lowe', 'Hob\'s Knap', 'Moss Howe'];

/** How far their land reaches around the Great Hill at the start (DESIGN §25.3). */
export const WILD_RADIUS = 14;
/** The Great Hill's radius: twice the old mound's (DESIGN §25.3). */
export const GREAT_HILL_R = 7.2;

/**
 * Choose the mound's place and lay out its land. Called by worldgen after the
 * heights exist and before trees are planted. `flatDist` is each tile's
 * distance to paving (roads, ruins, the site). Uses its own random stream so
 * the rest of the world is unchanged by it.
 */
export function layFolkLand(w: World, flatDist: Float32Array, seed: number, rng: Rng): FolkLand {
  let best: { x: number; z: number; score: number } | null = null;
  // Out beyond the Ring, on its side of the village, so the path between them runs outside the village.
  const ringA = Math.atan2(w.fairyRing.z, w.fairyRing.x), ringD = Math.hypot(w.fairyRing.x, w.fairyRing.z);
  // If nothing fits every wish, the good ground farthest from the old districts.
  let fallback: { x: number; z: number; far: number } | null = null;
  for (let k = 0; k < 400; k++) {
    const a = ringA + rng.range(-0.6, 0.6) * (k < 120 ? 1 : k < 260 ? 2 : 3), d = ringD + rng.range(17, 25);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (segmentDist(x, z, w.fairyRing.x, w.fairyRing.z) < 17) continue;
    const tx = toTileX(w, x), tz = toTileZ(w, z);
    if (!inBounds(w, tx, tz)) continue;
    if (Math.hypot(x - w.fairyRing.x, z - w.fairyRing.z) < 18) continue;
    const far = Math.min(99, ...w.districts.map((q) => Math.hypot(x - q.x, z - q.z)));
    let ok = true, forest = 0;
    for (let dz = -9; dz <= 9 && ok; dz++) for (let dx = -9; dx <= 9; dx++) {
      if (!inBounds(w, tx + dx, tz + dz)) { ok = false; break; }
      const i = idx(w, tx + dx, tz + dz);
      const g = w.ground[i];
      if (Math.hypot(dx, dz) <= GREAT_HILL_R + 0.5 && (g === Ground.Water || g === Ground.Asphalt || g === Ground.Concrete || w.blocked[i] || flatDist[i] < 5)) { ok = false; break; }
      if (g === Ground.Forest) forest++;
    }
    if (!ok) continue;
    if (far < 34) { if (!fallback || far > fallback.far) fallback = { x, z, far }; continue; }
    const score = forest + rng.range(0, 12);
    if (!best || score > best.score) best = { x, z, score };
  }
  const at = best ?? fallback ?? { x: w.fairyRing.x * 1.7, z: w.fairyRing.z * 1.7 };
  const mound: Mound = {
    x: at.x, z: at.z, r: GREAT_HILL_R, name: MOUND_NAMES[Math.abs(seed) % MOUND_NAMES.length],
    // The door looks toward the Ring.
    door: Math.atan2(w.fairyRing.z - at.z, w.fairyRing.x - at.x),
  };

  // The hill itself: a smooth swell in the ground.
  raiseHill(w, mound.x, mound.z, mound.r, 3.6);
  const mtx = toTileX(w, mound.x), mtz = toTileZ(w, mound.z);

  // Their land around it.
  const WR = Math.ceil(WILD_RADIUS) + 1;
  for (let dz = -WR; dz <= WR; dz++) for (let dx = -WR; dx <= WR; dx++) {
    const tx = mtx + dx, tz = mtz + dz;
    if (!inBounds(w, tx, tz)) continue;
    const i = idx(w, tx, tz);
    const g = w.ground[i];
    if (g === Ground.Water || g === Ground.Asphalt || g === Ground.Concrete) continue;
    if (Math.hypot(tileX(w, tx) - mound.x, tileZ(w, tz) - mound.z) <= WILD_RADIUS) w.zone[i] = Zone.Wild;
  }

  // Folk paths: from the door to the Ring, and from the back of the hill into the woods.
  const path = new Uint8Array(w.w * w.h);
  const paths: Point[][] = [];
  const doorPt = { x: mound.x + Math.cos(mound.door) * (mound.r + 0.6), z: mound.z + Math.sin(mound.door) * (mound.r + 0.6) };
  const lay = (from: Point, to: Point, bend: number) => {
    const pts: Point[] = [];
    const mx = (from.x + to.x) / 2, mz = (from.z + to.z) / 2;
    const len = Math.hypot(to.x - from.x, to.z - from.z) || 1;
    const nx = -(to.z - from.z) / len, nz = (to.x - from.x) / len;
    const cx = mx + nx * bend, cz = mz + nz * bend;
    const n = Math.max(4, Math.ceil(len / 1.5));
    for (let s = 0; s <= n; s++) {
      const t = s / n, u = 1 - t;
      pts.push({ x: u * u * from.x + 2 * u * t * cx + t * t * to.x, z: u * u * from.z + 2 * u * t * cz + t * t * to.z });
    }
    for (let s = 0; s < pts.length - 1; s++) {
      const a = pts[s], b = pts[s + 1];
      const l = Math.hypot(b.x - a.x, b.z - a.z);
      for (let d = 0; d <= l; d += 0.4) {
        const x = a.x + ((b.x - a.x) * d) / l, z = a.z + ((b.z - a.z) * d) / l;
        const tx = toTileX(w, x), tz = toTileZ(w, z);
        if (inBounds(w, tx, tz) && w.ground[idx(w, tx, tz)] !== Ground.Water) path[idx(w, tx, tz)] = 1;
      }
    }
    paths.push(pts);
  };
  const ring = w.fairyRing;
  const toRing = Math.atan2(ring.z - doorPt.z, ring.x - doorPt.x);
  lay(doorPt, { x: ring.x - Math.cos(toRing) * 4.6, z: ring.z - Math.sin(toRing) * 4.6 }, rng.range(-6, 6));
  const back = mound.door + Math.PI + rng.range(-0.6, 0.6);
  lay({ x: mound.x + Math.cos(back) * (mound.r + 0.4), z: mound.z + Math.sin(back) * (mound.r + 0.4) },
    { x: mound.x + Math.cos(back) * (mound.r + 20), z: mound.z + Math.sin(back) * (mound.r + 20) }, rng.range(-5, 5));

  // The village has always known the hill is there.
  reveal(w, mound.x, mound.z, WILD_RADIUS + 3);
  return { mound, path, paths };
}

/**
 * A barrow in the ground at (x, z): a rounded crown, steep sides, a small
 * skirt, standing on the local ground so it sits on slopes too. Nobody walks
 * over the top of it. Only ever raises the ground (DESIGN §25.3: knowes are
 * raised this way mid-game, so nothing already standing is left floating).
 */
export function raiseHill(w: World, x0: number, z0: number, r: number, height: number) {
  const S = w.w + 1;
  const base = heightAt(w, x0, z0);
  const R = Math.ceil(r + 1);
  const cx = Math.round(x0 + w.w / 2), cz = Math.round(z0 + w.h / 2);
  for (let vz = cz - R; vz <= cz + R; vz++) for (let vx = cx - R; vx <= cx + R; vx++) {
    if (vx < 0 || vz < 0 || vx > w.w || vz > w.h) continue;
    const x = vx - w.w / 2, z = vz - w.h / 2;
    const d = Math.hypot(x - x0, z - z0);
    if (d >= r + 0.8) continue;
    const k = Math.max(0, 1 - d / (r + 0.8));
    const swell = height * Math.sqrt(Math.min(1, k * 1.25)) * (k < 0.2 ? k / 0.2 : 1);
    const i = vz * S + vx;
    w.heights[i] = Math.max(w.heights[i], w.heights[i] * (1 - k * 0.6) + base * k * 0.6 + swell);
  }
  const tx0 = toTileX(w, x0), tz0 = toTileZ(w, z0);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    if (!inBounds(w, tx0 + dx, tz0 + dz)) continue;
    if (Math.hypot(tileX(w, tx0 + dx) - x0, tileZ(w, tz0 + dz) - z0) <= r - 1) w.blocked[idx(w, tx0 + dx, tz0 + dz)] = 1;
  }
  w.heightVersion = (w.heightVersion ?? 0) + 1;
}

/** Distance from home (the origin) to the segment a→b. */
function segmentDist(ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, -(ax * dx + az * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(ax + dx * t, az + dz * t);
}

/** Can a tile be built on as far as the Folk are concerned? */
export const folkAllows = (w: World, i: number) => !w.folk || (w.folk.path[i] === 0 && w.zone[i] !== Zone.Wild);

// ---------- the society ----------

export type FaeKind = 'hob' | 'sprite' | 'elder' | 'piper';
export type FolkFocus = 'woods' | 'village' | 'home';

export interface Fae {
  id: number;
  name: string;
  kind: FaeKind;
  x: number; z: number;
  /** Where they are going, and what they will do there. */
  to: Point;
  act: 'in' | 'walk' | 'dance' | 'tend' | 'chore' | 'watch';
  /** Minutes left at what they are doing. */
  t: number;
  /** Someone in the village has met them and knows their name. */
  known: boolean;
  /** Day of their last chore in the village (one a night at most). */
  lastChore: number;
  /** Where they live: a knowe's id, or 0 for the hall under the Great Hill (DESIGN §25.3). */
  home?: number;
}

export interface LedAway {
  id: number;
  x: number; z: number;
  /** Day it happened, and the day they will find their own way back if nobody finds them. */
  day: number;
  until: number;
  /** Where the searchers think they are; it narrows with each search. */
  hint: { x: number; z: number; r: number };
  searchers: number[];
  /** Friends of the hill are borrowed for a dance, not punished. */
  borrowed?: boolean;
}

export type FolkWorkKind = 'ring' | 'lantern' | 'bower' | 'cairn' | 'flowers';
export interface FolkWork {
  kind: FolkWorkKind; x: number; z: number;
  /** 0..1, grows in over a few days once built. */
  grown: number;
  /** An order from the player, built at night (0..1); absent once built. */
  built?: number;
  /** Its dew and song have been spent. */
  paid?: boolean;
}

/**
 * What the Folk can be asked to make (DESIGN §21.8), what it takes of their
 * own materials, and what it does for them.
 */
export const FOLK_WORKS: Record<FolkWorkKind, { name: string; blurb: string; dew: number; song: number }> = {
  bower: { name: 'Bower', blurb: 'Woven hazel and moss: somewhere for two of them to sleep. The hill can\'t grow without room to rest.', dew: 5, song: 2 },
  ring: { name: 'Dancing ring', blurb: 'Toadstools in a circle. They dance there, and every ring adds song each night.', dew: 2, song: 6 },
  lantern: { name: 'Glow-lantern', blurb: 'Foxfire in a jar on a hazel pole. Light for their paths; the hill wants more as it grows.', dew: 3, song: 1 },
  flowers: { name: 'Moon garden', blurb: 'Flowers that open at night. Every moon garden adds dew each night.', dew: 1, song: 1 },
  cairn: { name: 'Boundary cairn', blurb: 'Stones that mark their land. The Wild around it heals faster.', dew: 2, song: 2 },
};
const builtWork = (k: FolkWork) => k.built === undefined || k.built >= 1;

export interface FolkSociety {
  /** 0..100: soured below 20, wary to 45, friendly to 70, then kin. */
  standing: number;
  /** Progress toward the mound's next growth, 0..1. */
  growth: number;
  level: number;
  beings: Fae[];
  works: FolkWork[];
  focus: FolkFocus;
  /** Someone has spoken with them. */
  met: boolean;
  /** Their rules, as the village has learned them. */
  rules: string[];
  /** Recent things the Folk did, newest last (for the HUD). */
  news: { day: number; text: string }[];
  /** The day of the last offering left at the door. */
  offeredDay: number;
  /** Night chores done tonight (day, count): one a night, more as the hill grows. */
  chores: { day: number; n: number };
  /** Until this day the Folk are offended (a rule was broken): someone may be led astray. */
  offendedUntil: number;
  /** Someone led off into the woods at night, where they are, and who is out looking. */
  led: LedAway | null;
  /** Wild tiles yesterday, to notice when their land is taken. */
  land: number;
  /** Their own materials (DESIGN §21.8): dew gathered by sprites from moon gardens, song made by pipers at the rings. */
  dew: number;
  song: number;
  nextId: number;
  version: number;
  /** The knowes raised round the Great Hill (townhouse.ts, DESIGN §25.3). */
  knowes?: Knowe[];
  nextKnowe?: number;
  /** An old save's chambers (DESIGN §24.9), turned into knowes on load. */
  chambers?: { kind: string }[];
}

const NAMES: Record<FaeKind, string[]> = {
  hob: ['Hob Thimble', 'Old Rushlight', 'Tansy', 'Nettlebed', 'Wicker', 'Hob Crumb'],
  sprite: ['Minnow', 'Sorrel', 'Glint', 'Wisp-of-Rain', 'Fennel', 'Tick'],
  elder: ['the Grey Lady', 'Grandmother Ash', 'the Old Man of the Hill'],
  piper: ['Reed', 'the Piper', 'Lark'],
};

export const RULES = [
  'Do not cut in the Wild.',
  'Do not build across their paths.',
  'Do not come to the hill empty-handed.',
  'Do not crowd their door.',
];

export const standingWord = (s: number) => (s < 20 ? 'soured' : s < 45 ? 'wary' : s < 70 ? 'friendly' : 'kin');

function wildTiles(w: World): number {
  let n = 0;
  for (let i = 0; i < w.zone.length; i++) if (w.zone[i] === Zone.Wild) n++;
  return n;
}

/** The land they want: it grows as their society does. */
export const landWanted = (f: FolkSociety) => 420 + f.level * 80;

export function createFolk(w: World): FolkSociety {
  const m = w.folk.mound;
  const f: FolkSociety = {
    standing: 40, growth: 0, level: 0, beings: [], works: [], focus: 'woods', met: false, rules: [],
    news: [], offeredDay: 0, offendedUntil: 0, led: null, chores: { day: 0, n: 0 }, land: wildTiles(w), dew: 4, song: 3, nextId: 1, version: 0,
    knowes: [],
  };
  for (const kind of ['elder', 'hob', 'sprite'] as FaeKind[]) addFae(f, w, kind, 0);
  settleFolk(f);
  // What was already there: a ring of toadstools and a cairn by the door.
  f.works.push(
    { kind: 'ring', x: m.x + Math.cos(m.door + 0.7) * (m.r + 1.8), z: m.z + Math.sin(m.door + 0.7) * (m.r + 1.8), grown: 1 },
    { kind: 'cairn', x: m.x + Math.cos(m.door - 0.4) * (m.r + 0.9), z: m.z + Math.sin(m.door - 0.4) * (m.r + 0.9), grown: 1 },
  );
  return f;
}

export function addFae(f: FolkSociety, w: World, kind: FaeKind, k: number, named?: string): Fae {
  const m = w.folk.mound;
  const used = new Set(f.beings.map((b) => b.name));
  const name = named ?? NAMES[kind].find((n) => !used.has(n)) ?? `${NAMES[kind][0]} the ${['Younger', 'Second', 'Third'][k % 3]}`;
  const fae: Fae = { id: f.nextId++, name, kind, x: m.x, z: m.z, to: { x: m.x, z: m.z }, act: 'in', t: 0, known: false, lastChore: 0 };
  f.beings.push(fae);
  return fae;
}

function news(col: Colony, text: string, tone: 'good' | 'bad' | 'strange' = 'strange', toLog = true) {
  const f = col.folk;
  f.news.push({ day: col.community.day, text });
  if (f.news.length > 6) f.news.shift();
  f.version++;
  if (toLog) log(col.community, text, tone);
}

export function changeStanding(col: Colony, delta: number) {
  const f = col.folk;
  const before = standingWord(f.standing);
  f.standing = Math.max(0, Math.min(100, f.standing + delta));
  const after = standingWord(f.standing);
  if (before !== after) {
    const lines: Record<string, string> = {
      soured: `Something has soured between the village and ${col.world.folk.mound.name}. Milk turns; tools go missing.`,
      wary: `The Folk of ${col.world.folk.mound.name} are watching the village, and keeping their distance.`,
      friendly: `The Folk of ${col.world.folk.mound.name} are easier with the village now. Their lights come closer at dusk.`,
      kin: `The Folk of ${col.world.folk.mound.name} call the village neighbours now, and mean it.`,
    };
    news(col, lines[after], delta > 0 ? 'good' : 'bad');
  }
  f.version++;
}

function learnRule(col: Colony, i: number, by?: Survivor) {
  const f = col.folk;
  if (f.rules.includes(RULES[i])) return;
  f.rules.push(RULES[i]);
  news(col, `${by ? by.name.split(' ')[0] : 'Someone'} learned one of the Folk's rules: "${RULES[i]}"`);
}

/** How well someone perceives the Folk here (the §4 gradient, depth 30). */
export function folkReading(col: Colony, s: Survivor, x: number, z: number): 'none' | 'chill' | 'luminous' | 'coherent' {
  const v = s.sight + resonanceAt(col, x, z) * 40 + (s.traits.includes('orb_touched') ? 10 : 0) - 30;
  return v < -10 ? 'none' : v < 10 ? 'chill' : v < 35 ? 'luminous' : 'coherent';
}

/** An offering left at the door. Returns true if it was the day's first. */
export function leaveOffering(col: Colony, s: Survivor): boolean {
  const f = col.folk, day = col.community.day;
  if (f.offeredDay === day) return false;
  f.offeredDay = day;
  changeStanding(col, f.standing < 60 ? 1.2 : 0.6);
  nurture(col, col.world.folk.mound.x, col.world.folk.mound.z, 0.01, 1);
  const r = folkReading(col, s, col.world.folk.mound.x, col.world.folk.mound.z);
  withRng(col.community, (rng) => {
    if (r === 'coherent' && (!f.met || rng.chance(0.25))) meet(col, s, rng);
    else if (r === 'luminous' && rng.chance(0.3)) news(col, `${s.name.split(' ')[0]} left bread at ${col.world.folk.mound.name} at dusk, and saw small lights come out to take it.`);
    else if (rng.chance(0.12)) news(col, `${s.name.split(' ')[0]} left bread at the door in the hill. In the morning it was gone.`, 'strange');
  });
  return true;
}

function meet(col: Colony, s: Survivor, rng: Rng) {
  const f = col.folk, m = col.world.folk.mound;
  const n = s.name.split(' ')[0];
  const stranger = f.beings.find((b) => !b.known);
  if (!f.met) {
    f.met = true;
    const elder = f.beings.find((b) => b.kind === 'elder') ?? f.beings[0];
    elder.known = true;
    news(col, `${n} took bread to ${m.name}, and the door was open. ${elder.name} came out and spoke with them: the hill has been theirs since before the roads, and they will share the land if the village keeps to their ways.`, 'good');
    learnRule(col, 0, s);
    return;
  }
  if (stranger) {
    stranger.known = true;
    news(col, `${n} met ${stranger.name} of ${m.name}. ${stranger.kind === 'hob' ? 'A small, brown, busy person with flour on their hands.' : stranger.kind === 'sprite' ? 'Quick as a wren; there and gone and there again.' : stranger.kind === 'piper' ? 'They played three notes and ' + n + ' forgot what they came for.' : 'Old as the hill, and kind.'}`, 'good');
  }
  const next = RULES.findIndex((r) => !f.rules.includes(r));
  if (next >= 0 && rng.chance(0.5)) learnRule(col, next, s);
}

// ---------- daily ----------

export function folkDaily(col: Colony) {
  const f = col.folk, w = col.world, m = w.folk.mound;
  // Their land: taken land stings; too little land crowds them.
  const land = wildTiles(w);
  if (land < f.land - 2) {
    changeStanding(col, -Math.min(12, (f.land - land) * 0.15));
    news(col, `The Folk of ${m.name} felt the edge of their land move. ${f.rules.includes(RULES[0]) ? 'They are not pleased.' : 'Nobody in the village knows why the dogs won\'t settle.'}`, 'bad');
  } else if (land > f.land + 2) {
    changeStanding(col, Math.min(6, (land - f.land) * 0.05));
    news(col, `More of the land around ${m.name} was left to the Wild. The Folk noticed.`, 'good');
  }
  f.land = land;
  const roomy = land >= landWanted(f);
  if (land < landWanted(f) * 0.8) changeStanding(col, -0.4);
  else if (roomy) changeStanding(col, 0.2);
  // Crowding their door: buildings and houses close by.
  let near = 0;
  for (const b of col.village.buildings) {
    const p = b.inside;
    if (Math.hypot(p.x - m.x, p.z - m.z) < WILD_RADIUS + 6) near++;
  }
  if (near) {
    changeStanding(col, -0.6 * near);
    if (!f.rules.includes(RULES[3]) && f.met) learnRule(col, 3);
  }
  // Drift back toward wariness, a little each day; the land's health helps.
  const res = resonanceAt(col, m.x, m.z);
  changeStanding(col, (40 - f.standing) * 0.05 + (res > 0.6 ? 0.2 : res < 0.4 ? -0.3 : 0));
  // Their land keeps the Veil thin around the hill.
  nurture(col, m.x, m.z, 0.012, 2);
  townhouseDaily(col);

  withRng(col.community, (rng) => {
    // Growth: a friendly, healthy hill with room to spare grows. Without more land, it can't.
    if (f.standing >= 50 && roomy) {
      // Their needs (DESIGN §21.8): without rest, dance and light, the hill can't grow past the brink.
      const needs = folkNeeds(col);
      const ready = needs.filter((x) => x.gate).every((x) => x.met);
      f.growth += 0.025 * (f.focus === 'home' ? 2.2 : 1) * (knoweCount(f, 'nursery') ? 1.25 : 1) * (0.5 + res) * (0.4 + 0.6 * needs.filter((x) => x.met).length / needs.length);
      if (f.growth >= 0.95 && !ready) {
        f.growth = 0.95;
        const want = needs.filter((x) => x.gate && !x.met).map((x) => x.label.toLowerCase());
        const key = `folkwant${col.community.day - (col.community.day % 6)}`;
        if (f.met && !col.hints.has(key)) {
          col.hints.add(key);
          news(col, `The Folk of ${m.name} want to grow, but they need ${want.join(' and ')} first. (Folk card: ask them to build it.)`, 'strange');
        }
      }
      if (f.growth >= 1) {
        f.growth = 0;
        f.level++;
        const kind: FaeKind = rng.pick(['hob', 'sprite', 'piper', 'hob']);
        const fae = addFae(f, w, kind, f.level);
        const k = raiseKnowe(col);
        settleFolk(f);
        news(col, !f.met ? `There are more lights around ${m.name} at dusk than there used to be${k ? ', and the ground beside it has risen into a new green hill' : ''}.`
          : k ? `${fae.name} has come to live at ${m.name}. Overnight a new hill rose beside it: ${k.name}, ${KNOWES[k.kind].name.toLowerCase()}. The Folk are growing.`
          : `${fae.name} has come to live at ${m.name}. There is no room left round the hill for another knowe.`, 'good');
        addWork(col, rng);
      }
    }
    for (const k of f.works) if (builtWork(k) && k.grown < 1) k.grown = Math.min(1, k.grown + 0.25);
    // The night's gathering: dew from the moon gardens, song from the rings.
    gather(col);
    // Left to themselves (tests and probes, where the village plans too), they order what they need.
    if (col.village.autoPlan !== false) selfOrder(col, rng);
    for (const k of f.works) if (k.kind === 'cairn' && builtWork(k)) nurture(col, k.x, k.z, 0.006, 3);
    // Tending the woods: saplings in the Wild, and the land knits.
    if (f.focus === 'woods' && f.standing >= 30) {
      nurture(col, m.x, m.z, 0.02, 3);
      if (rng.chance(0.35)) plantWild(col, rng);
    }
    // Gifts from friends.
    if (f.standing >= 70 && rng.chance(0.12)) {
      col.community.resources.glimmer += 2;
      news(col, 'A little heap of glimmer was left on the doorstep of the hall, wrapped in a dock leaf.', 'good');
    }
    // Mischief when things have soured.
    if (f.standing < 20 && rng.chance(0.3)) {
      const r = col.community.resources;
      if (rng.chance(0.5) && r.food > 8) {
        const lost = Math.min(r.food - 4, rng.int(3, 7));
        r.food -= lost;
        news(col, `${lost} food soured overnight in the stores. ${f.met ? 'Everyone knows who did it.' : 'Nobody can say how.'}`, 'bad');
      } else {
        const p = col.village.projects.find((x) => !x.done && x.work > 20);
        if (p) { p.work = Math.max(0, p.work - 25); news(col, `The tools for ${p.name.toLowerCase()} were found up a tree in the morning. Half a day lost.`, 'bad'); }
      }
    }
  });
  f.version++;
}

function addWork(col: Colony, rng: Rng) {
  const f = col.folk, w = col.world, m = w.folk.mound;
  if (f.works.length >= 4 + f.level * 3) return;
  for (let tries = 0; tries < 30; tries++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(m.r + 1.5, WILD_RADIUS + f.level * 1.5);
    const x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d;
    const tx = toTileX(w, x), tz = toTileZ(w, z);
    if (!inBounds(w, tx, tz)) continue;
    const i = idx(w, tx, tz);
    if (w.zone[i] !== Zone.Wild || w.blocked[i] || w.treeAt[i] >= 0 || w.folk.path[i]) continue;
    if (f.works.some((k) => Math.hypot(k.x - x, k.z - z) < 2.2)) continue;
    const kind: FolkWorkKind = rng.pick(['ring', 'lantern', 'bower', 'flowers', 'flowers', 'cairn']);
    f.works.push({ kind, x, z, grown: 0 });
    f.version++;
    return;
  }
}

function plantWild(col: Colony, rng: Rng) {
  const w = col.world, m = w.folk.mound;
  for (let tries = 0; tries < 12; tries++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(m.r + 2, WILD_RADIUS + 6);
    const tx = toTileX(w, m.x + Math.cos(a) * d), tz = toTileZ(w, m.z + Math.sin(a) * d);
    if (!inBounds(w, tx, tz)) continue;
    const i = idx(w, tx, tz);
    if (w.zone[i] !== Zone.Wild || w.blocked[i] || w.treeAt[i] >= 0 || w.bushAt[i] >= 0 || w.folk.path[i]) continue;
    if (col.folk.works.some((k) => Math.hypot(k.x - tileX(w, tx), k.z - tileZ(w, tz)) < 1.5)) continue;
    const t = { id: w.trees.length, tx, tz, kind: rng.pick(['oak', 'birch', 'oak'] as const), size: rng.range(0.8, 1.2), felled: false, chop: 0, reserved: 0, protected: false, growth: 0.15, planted: true };
    w.trees.push(t);
    w.treeAt[i] = t.id;
    col.events.push({ type: 'planted', tree: t.id });
    return;
  }
}

// ---------- the night: where the Folk go ----------

/** Night chores for the village, done while everyone sleeps. */
function chore(col: Colony, fae: Fae, rng: Rng): string | null {
  const r = col.community.resources;
  const item = col.items.find((it) => !it.reserved);
  if (item && rng.chance(0.5)) {
    if (item.kind === 'log') r.logs = (r.logs ?? 0) + item.amount; else r[item.kind] += item.amount;
    col.items = col.items.filter((it) => it !== item);
    return `the ${item.kind} left lying out was stacked in the stores`;
  }
  const p = col.village.projects.find((x) => !x.done && x.work > 0 && x.work < x.workNeeded);
  if (p && rng.chance(0.6)) {
    p.work = Math.min(p.workNeeded, p.work + 30);
    return `someone did an hour's work on ${p.name.toLowerCase()}`;
  }
  let tended = 0;
  const w = col.world;
  for (let i = 0; i < w.cropState.length && tended < 12; i++) if (w.cropState[i] === Crop.Growing && !col.tended.has(i)) { col.tended.add(i); tended++; }
  if (tended) return 'the fields were weeded';
  void fae;
  return null;
}

// ---------- the Folk as a second city builder (DESIGN §21.8) ----------

export interface FolkNeed { id: string; label: string; met: boolean; hint: string; gate: boolean }

export function folkNeeds(col: Colony): FolkNeed[] {
  const f = col.folk, done = f.works.filter(builtWork);
  const n = (k: FolkWorkKind) => done.filter((x) => x.kind === k).length;
  return [
    { id: 'room', label: 'Room', met: f.land >= landWanted(f), hint: 'Land left to the Wild around the hill.', gate: false },
    { id: 'rest', label: 'Rest', met: housing(f) + n('bower') * 2 >= f.beings.length + 1, hint: 'Room in the hall and the knowes (or a bower for every two more), and one spare for whoever comes next.', gate: true },
    { id: 'dance', label: 'Dance', met: n('ring') >= 1 + Math.floor(f.level / 3), hint: 'A dancing ring (another every third growth).', gate: true },
    { id: 'light', label: 'Light', met: n('lantern') >= 1 + Math.floor(f.level / 2), hint: 'Glow-lanterns along their paths, more as the hill grows.', gate: true },
    { id: 'gifts', label: 'Gifts', met: col.community.day - f.offeredDay <= 3, hint: 'An offering at the door in the last three days.', gate: false },
  ];
}

/** Where an order could go: in the Wild, off their paths, clear of trees and other works. */
const v = (col: Colony) => col.village;

export function whyNotFolkWork(col: Colony, x: number, z: number): string | null {
  const w = col.world, f = col.folk;
  if (!f.met) return 'Nobody has met the Folk yet.';
  const tx = toTileX(w, x), tz = toTileZ(w, z);
  if (!inBounds(w, tx, tz)) return 'Off the map.';
  const i = idx(w, tx, tz);
  // In a shared district (DESIGN §24.12) they may build among the gardens, not only in the Wild.
  const shared = col.haunts.some((h) => h.owner === 'shared' && Math.hypot(w.districts[h.district].x - x, w.districts[h.district].z - z) <= HAUNT_RADIUS);
  if (w.zone[i] !== Zone.Wild && !shared) return 'The Folk only build in the Wild, or in a district shared with them.';
  if (shared && (w.zone[i] === Zone.Field || v(col).plotAt[i] || w.ground[i] === Ground.Water)) return 'Not on a field, a plot or water.';
  if (w.folk.path[i]) return 'Not on their paths.';
  if (w.blocked[i] || w.treeAt[i] >= 0) return 'Something is in the way.';
  if (Math.hypot(x - w.folk.mound.x, z - w.folk.mound.z) < w.folk.mound.r + 0.8) return 'Too close to the hill.';
  if (f.works.some((k) => Math.hypot(k.x - x, k.z - z) < 2.2)) return 'Too close to another of their works.';
  if (f.standing < 20) return 'They are too cross with the village to take requests.';
  return null;
}

/** The player asks the Folk for something. It waits as a faint outline, and is built after dark. */
export function orderFolkWork(col: Colony, kind: FolkWorkKind, x: number, z: number): FolkWork | string {
  const why = whyNotFolkWork(col, x, z);
  if (why) return why;
  const f = col.folk;
  const k: FolkWork = { kind, x, z, grown: 0, built: 0 };
  f.works.push(k);
  f.version++;
  log(col.community, `Word was left at ${col.world.folk.mound.name}: the Folk are asked for a ${FOLK_WORKS[kind].name.toLowerCase()}. They work at night.`, 'strange');
  return k;
}

/** Each night's gathering. */
function gather(col: Colony) {
  const f = col.folk;
  if (f.standing < 20) return; // sulking
  const done = f.works.filter(builtWork);
  const count = (k: FaeKind) => f.beings.filter((b) => b.kind === k).length;
  const boost = f.focus === 'home' ? 1.5 : 1;
  f.dew = Math.min(40 + knoweCount(f, 'dewcellar') * 20, f.dew + (count('sprite') + Math.min(4, done.filter((k) => k.kind === 'flowers').length) + 0.5 + knoweCount(f, 'dewcellar') * 2) * boost);
  f.song = Math.min(40, f.song + (count('piper') + count('elder') * 0.5 + Math.min(4, done.filter((k) => k.kind === 'ring').length) + 0.3 + knoweCount(f, 'gallery') * 2) * boost);
}

/** Without a player (tests, probes), the Folk order what their needs call for. */
function selfOrder(col: Colony, rng: Rng) {
  const f = col.folk, w = col.world, m = w.folk.mound;
  if (!f.met || f.works.some((k) => !builtWork(k))) return;
  const need = folkNeeds(col).find((x) => x.gate && !x.met);
  const kind: FolkWorkKind = need?.id === 'rest' ? 'bower' : need?.id === 'dance' ? 'ring' : need?.id === 'light' ? 'lantern'
    : f.works.filter((k) => k.kind === 'flowers').length < 2 ? 'flowers' : 'bower';
  if (!need && rng.chance(0.7)) return;
  for (let tries = 0; tries < 30; tries++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(m.r + 1.5, WILD_RADIUS);
    const x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d;
    if (whyNotFolkWork(col, x, z)) continue;
    f.works.push({ kind, x, z, grown: 0, built: 0 });
    f.version++;
    return;
  }
}

/** A night's work on an order: spend its dew and song (once), then build. Returns what happened, for the news. */
function buildOrder(col: Colony, k: FolkWork, fae: Fae): string | null {
  const f = col.folk, def = FOLK_WORKS[k.kind];
  if (!k.paid) {
    if (f.dew < def.dew || f.song < def.song) {
      const key = `folkshort${k.kind}${col.community.day}`;
      if (!col.hints.has(key)) { col.hints.add(key); news(col, `The ${def.name.toLowerCase()} waits: the Folk need ${f.dew < def.dew ? 'more dew' : 'more song'} (${Math.floor(f.dew)}/${def.dew} dew, ${Math.floor(f.song)}/${def.song} song).`, 'strange', false); }
      return null;
    }
    f.dew -= def.dew; f.song -= def.song; k.paid = true;
  }
  k.built = Math.min(1, (k.built ?? 0) + (f.focus === 'home' ? 0.5 : 0.34));
  f.version++;
  if (k.built >= 1) {
    delete k.built;
    delete k.paid;
    k.grown = 0.25;
    return `${fae.known ? fae.name : 'the Folk'} finished a ${def.name.toLowerCase()} in the Wild by ${col.world.folk.mound.name}`;
  }
  return null;
}

/** Called every sim minute-step with dt minutes: the Folk move and act. */
export function folkTick(col: Colony, dt: number) {
  const f = col.folk, w = col.world, m = w.folk.mound;
  const h = (col.minute % 1440) / 60;
  const out = h >= 19.5 || h < 5;
  const speed = 1.4; // units a minute: quick and light
  withRng(col.community, (rng) => {
    for (const fae of f.beings) {
      if (fae.act === 'walk') {
        const dx = fae.to.x - fae.x, dz = fae.to.z - fae.z, d = Math.hypot(dx, dz);
        const step = speed * dt;
        if (d <= step) { fae.x = fae.to.x; fae.z = fae.to.z; fae.act = arrive(col, fae, rng); }
        else { fae.x += (dx / d) * step; fae.z += (dz / d) * step; }
        continue;
      }
      fae.t -= dt;
      if (fae.t > 0) continue;
      if (!out) {
        // Home by dawn.
        if (fae.act !== 'in') {
          const home = homeOf(f, w, fae.home);
          if (Math.hypot(fae.x - home.x, fae.z - home.z) < 0.5) { fae.act = 'in'; fae.t = 60; }
          else { fae.to = home; fae.act = 'walk'; fae.t = 0; }
        } else fae.t = 60;
        continue;
      }
      // Out for the night: choose what to do.
      const village = f.focus === 'village' && f.standing >= 45 && (fae.kind === 'hob' || fae.kind === 'sprite') && h >= 0 && h < 4 && fae.lastChore !== col.community.day
        && (f.chores.day !== col.community.day || f.chores.n < 1 + Math.floor(f.level / 2) + knoweCount(f, 'guestroom'));
      if (village) { fae.to = jitter(col.world.campfire, 5, rng); fae.act = 'walk'; fae.t = -1; continue; }
      // Orders from the village come first for the hands of the hill.
      const order = fae.kind !== 'piper' && h < 4.5 ? f.works.find((k) => !builtWork(k) && (k.paid || (f.dew >= FOLK_WORKS[k.kind].dew && f.song >= FOLK_WORKS[k.kind].song))) : undefined;
      if (order && rng.chance(0.7)) { fae.to = jitter(order, 0.6, rng); fae.act = 'walk'; fae.t = 0; continue; }
      const choice = rng.int(0, 9);
      if (choice < 3 && w.folk.paths.length) {
        const p = rng.pick(w.folk.paths);
        fae.to = { ...p[rng.int(0, p.length - 1)] };
      } else if (choice < 6 && f.works.length) {
        const k = rng.pick(f.works);
        fae.to = jitter(k, 1.2, rng);
      } else {
        const a = rng.range(0, Math.PI * 2), d = rng.range(m.r + 0.8, WILD_RADIUS);
        fae.to = { x: m.x + Math.cos(a) * d, z: m.z + Math.sin(a) * d };
      }
      fae.act = 'walk';
      fae.t = 0;
    }
  });
}

const jitter = (p: Point, r: number, rng: Rng): Point => ({ x: p.x + rng.range(-r, r), z: p.z + rng.range(-r, r) });

function arrive(col: Colony, fae: Fae, rng: Rng): Fae['act'] {
  const f = col.folk;
  const near = f.works.find((k) => Math.hypot(k.x - fae.x, k.z - fae.z) < 2);
  // At an order: build.
  if (near && !builtWork(near)) {
    const did = buildOrder(col, near, fae);
    if (did) news(col, `In the night ${did}.`, 'strange');
    fae.t = rng.range(30, 50);
    return 'tend';
  }
  // A hob in the village does a chore, then goes home.
  if (Math.hypot(fae.x - col.world.campfire.x, fae.z - col.world.campfire.z) < 8) {
    fae.lastChore = col.community.day;
    if (f.chores.day !== col.community.day) f.chores = { day: col.community.day, n: 0 };
    f.chores.n++;
    const did = chore(col, fae, rng);
    if (did) {
      const seen = alive(col.community).some((s) => s.sight >= 45);
      news(col, seen && fae.known ? `In the night ${fae.name} came down from the hill, and ${did}.` : `In the morning, ${did}. Nobody admits to it.`, 'good', rng.chance(0.5));
    }
    fae.t = rng.range(40, 90);
    return 'chore';
  }
  fae.t = rng.range(20, 70);
  return near?.kind === 'ring' ? 'dance' : near ? 'tend' : 'watch';
}

// ---------- rules broken, and being led astray ----------

/** Someone broke one of the Folk's rules (cut or foraged in the Wild). */
export function breakRule(col: Colony, s: Survivor, what: 'cut' | 'forage') {
  const f = col.folk;
  const n = s.name.split(' ')[0];
  changeStanding(col, what === 'cut' ? -5 : -1.5);
  f.offendedUntil = Math.max(f.offendedUntil, col.community.day + (what === 'cut' ? 5 : 2));
  if (what === 'cut') {
    news(col, f.met
      ? `${n} cut a tree in the Wild. The Folk of ${col.world.folk.mound.name} will not forget it soon.`
      : `${n} cut a tree near ${col.world.folk.mound.name}, and the woods went very quiet.`, 'bad');
    if (!f.rules.includes(RULES[0])) learnRule(col, 0, s);
  } else if (!f.news.slice(-2).some((x) => x.text.includes('berries'))) {
    news(col, `${n} took berries from the Wild in the hungry days. Someone noticed.`, 'bad', true);
  }
}

/** At night, when the Folk are offended or soured: someone walks out of bed into the woods. */
export function maybeLeadAway(col: Colony, rng: Rng) {
  const f = col.folk, c = col.community, w = col.world, m = w.folk.mound;
  if (f.led) return;
  const cross = f.standing < 25 || c.day < f.offendedUntil;
  // Offended, they lead people astray; friends of the hill are sometimes borrowed for a dance.
  const borrowed = !cross && f.standing >= 45 && f.met;
  if (cross ? !rng.chance(f.standing < 20 ? 0.3 : 0.18) : !borrowed || !rng.chance(0.02)) return;
  const pool = alive(c).filter((s) => !col.taken.some((t) => t.id === s.id));
  if (pool.length < 3) return;
  // The Folk take the careless and the sweet alike.
  const s = rng.pick(pool);
  const a = rng.range(0, Math.PI * 2), d = rng.range(WILD_RADIUS + 4, WILD_RADIUS + 14);
  let x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d;
  const tx = toTileX(w, x), tz = toTileZ(w, z);
  if (!inBounds(w, tx, tz) || w.ground[idx(w, tx, tz)] === Ground.Water || w.blocked[idx(w, tx, tz)]) { x = m.x + Math.cos(a) * (m.r + 3); z = m.z + Math.sin(a) * (m.r + 3); }
  f.led = {
    id: s.id, x, z, day: c.day, until: c.day + 2, borrowed,
    hint: { x: x + rng.range(-10, 10), z: z + rng.range(-10, 10), r: 12 }, searchers: [],
  };
  reveal(w, x, z, 5);
  const ag = col.agents.find((q) => q.id === s.id);
  if (ag) { ag.x = x; ag.z = z; ag.path = []; ag.pathI = 0; ag.indoors = false; ag.inside = 0; ag.afloat = false; ag.task = null; }
  log(c, borrowed
    ? `In the night ${s.name.split(' ')[0]} got up without waking and walked out toward ${m.name}, following music only they could hear.`
    : `In the night ${s.name.split(' ')[0]} got up without waking, and walked out toward ${m.name} after a light only they could see.`, borrowed ? 'strange' : 'bad');
}

/** Found by a searcher (or come home alone). */
export function endLed(col: Colony, found: Survivor | null) {
  const f = col.folk, c = col.community;
  const led = f.led;
  if (!led) return;
  f.led = null;
  const s = c.survivors.find((x) => x.id === led.id);
  if (!s) return;
  const n = s.name.split(' ')[0];
  if (led.borrowed) {
    c.resources.glimmer += 3;
    s.morale = Math.min(100, s.morale + 6);
    s.sight = Math.min(100, s.sight + 4);
    log(c, `${found ? `${found.name.split(' ')[0]} found ${n}` : `${n} came home`} barefoot and laughing, pockets full of glimmer. They danced all night under the hill, they say, and it was the best night of their life.`, 'strange');
    remember(s, c.day, 'Danced a night under the hill with the Folk.');
    return;
  }
  if (found) {
    s.morale = Math.max(0, s.morale - 4);
    found.morale = Math.min(100, found.morale + 4);
    log(c, `${found.name.split(' ')[0]} found ${n} sitting in a ring of toadstools in the woods, humming a tune nobody knew, and walked them home.`, 'good');
    remember(s, c.day, 'Was led into the woods by the Folk, and found.');
  } else {
    s.morale = Math.max(0, s.morale - 12);
    s.sight = Math.min(100, s.sight + 5);
    log(c, `${n} walked back into the village at dusk, two days gone, thin and quiet. They say they were only away an hour.`, 'strange');
    remember(s, c.day, 'Was led into the woods by the Folk for two days.');
  }
}
