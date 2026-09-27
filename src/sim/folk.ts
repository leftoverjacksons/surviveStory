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
import type { Colony } from './colony';
import { alive, log, withRng, type Survivor } from './community';
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

/** How far their land reaches around the mound at the start. */
export const WILD_RADIUS = 8.5;

/**
 * Choose the mound's place and lay out its land. Called by worldgen after the
 * heights exist and before trees are planted. `flatDist` is each tile's
 * distance to paving (roads, ruins, the site). Uses its own random stream so
 * the rest of the world is unchanged by it.
 */
export function layFolkLand(w: World, flatDist: Float32Array, seed: number, rng: Rng): FolkLand {
  let best: { x: number; z: number; score: number } | null = null;
  for (let k = 0; k < 160; k++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(31, 40);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const tx = toTileX(w, x), tz = toTileZ(w, z);
    if (!inBounds(w, tx, tz)) continue;
    if (Math.hypot(x - w.fairyRing.x, z - w.fairyRing.z) < 14) continue;
    if (w.districts.some((q) => Math.hypot(x - q.x, z - q.z) < 34)) continue;
    let ok = true, forest = 0;
    for (let dz = -5; dz <= 5 && ok; dz++) for (let dx = -5; dx <= 5; dx++) {
      if (!inBounds(w, tx + dx, tz + dz)) { ok = false; break; }
      const i = idx(w, tx + dx, tz + dz);
      const g = w.ground[i];
      if (Math.hypot(dx, dz) <= 4 && (g === Ground.Water || g === Ground.Asphalt || g === Ground.Concrete || w.blocked[i] || flatDist[i] < 5)) { ok = false; break; }
      if (g === Ground.Forest) forest++;
    }
    if (!ok) continue;
    const score = forest + rng.range(0, 12);
    if (!best || score > best.score) best = { x, z, score };
  }
  // A fallback that always exists: due north of the Ring, pulled in.
  const at = best ?? { x: w.fairyRing.x * 1.7, z: w.fairyRing.z * 1.7 };
  const mound: Mound = {
    x: at.x, z: at.z, r: 3.6, name: MOUND_NAMES[Math.abs(seed) % MOUND_NAMES.length],
    // The door looks toward the village.
    door: Math.atan2(-at.z, -at.x),
  };

  // The hill itself: a smooth swell in the ground.
  const S = w.w + 1;
  const base = heightAt(w, mound.x, mound.z);
  for (let vz = 0; vz <= w.h; vz++) for (let vx = 0; vx <= w.w; vx++) {
    const x = vx - w.w / 2, z = vz - w.h / 2;
    const d = Math.hypot(x - mound.x, z - mound.z);
    if (d >= mound.r + 0.8) continue;
    // A barrow's profile: a rounded crown, steep sides, a small skirt.
    const k = Math.max(0, 1 - d / (mound.r + 0.8));
    const swell = 2.5 * Math.sqrt(Math.min(1, k * 1.25)) * (k < 0.2 ? k / 0.2 : 1);
    const i = vz * S + vx;
    // Blend toward a hill standing on the local ground, so it sits on slopes too.
    w.heights[i] = w.heights[i] * (1 - k * 0.6) + (base * k * 0.6) + swell;
  }
  // Nobody walks over the top of it.
  const mtx = toTileX(w, mound.x), mtz = toTileZ(w, mound.z);
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
    if (!inBounds(w, mtx + dx, mtz + dz)) continue;
    if (Math.hypot(tileX(w, mtx + dx) - mound.x, tileZ(w, mtz + dz) - mound.z) <= mound.r - 1) w.blocked[idx(w, mtx + dx, mtz + dz)] = 1;
  }

  // Their land around it.
  for (let dz = -10; dz <= 10; dz++) for (let dx = -10; dx <= 10; dx++) {
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
    { x: mound.x + Math.cos(back) * 24, z: mound.z + Math.sin(back) * 24 }, rng.range(-5, 5));

  // The village has always known the hill is there.
  reveal(w, mound.x, mound.z, WILD_RADIUS + 3);
  return { mound, path, paths };
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
}

export type FolkWorkKind = 'ring' | 'lantern' | 'bower' | 'cairn' | 'flowers';
export interface FolkWork { kind: FolkWorkKind; x: number; z: number; /** 0..1, grows in over a few days. */ grown: number }

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
  /** Wild tiles yesterday, to notice when their land is taken. */
  land: number;
  nextId: number;
  version: number;
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
export const landWanted = (f: FolkSociety) => 180 + f.level * 70;

export function createFolk(w: World): FolkSociety {
  const m = w.folk.mound;
  const f: FolkSociety = {
    standing: 40, growth: 0, level: 0, beings: [], works: [], focus: 'woods', met: false, rules: [],
    news: [], offeredDay: 0, chores: { day: 0, n: 0 }, land: wildTiles(w), nextId: 1, version: 0,
  };
  for (const kind of ['elder', 'hob', 'sprite'] as FaeKind[]) addFae(f, w, kind, 0);
  // What was already there: a ring of toadstools and a cairn by the door.
  f.works.push(
    { kind: 'ring', x: m.x + Math.cos(m.door + 0.9) * 5.2, z: m.z + Math.sin(m.door + 0.9) * 5.2, grown: 1 },
    { kind: 'cairn', x: m.x + Math.cos(m.door - 0.5) * 4.4, z: m.z + Math.sin(m.door - 0.5) * 4.4, grown: 1 },
  );
  return f;
}

function addFae(f: FolkSociety, w: World, kind: FaeKind, k: number): Fae {
  const m = w.folk.mound;
  const used = new Set(f.beings.map((b) => b.name));
  const name = NAMES[kind].find((n) => !used.has(n)) ?? `${NAMES[kind][0]} the ${['Younger', 'Second', 'Third'][k % 3]}`;
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

  withRng(col.community, (rng) => {
    // Growth: a friendly, healthy hill with room to spare grows. Without more land, it can't.
    if (f.standing >= 50 && roomy) {
      f.growth += 0.025 * (f.focus === 'home' ? 2.2 : 1) * (0.5 + res);
      if (f.growth >= 1) {
        f.growth = 0;
        f.level++;
        const kind: FaeKind = rng.pick(['hob', 'sprite', 'piper', 'hob']);
        const fae = addFae(f, w, kind, f.level);
        news(col, f.met ? `${fae.name} has come to live at ${m.name}. The hill is growing.` : `There are more lights around ${m.name} at dusk than there used to be.`, 'good');
        addWork(col, rng);
      }
    }
    if (f.focus === 'home' && f.standing >= 45 && rng.chance(0.2)) addWork(col, rng);
    for (const k of f.works) if (k.grown < 1) k.grown = Math.min(1, k.grown + 0.25);
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
    r[item.kind] += item.amount;
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
          if (Math.hypot(fae.x - m.x, fae.z - m.z) < 0.5) { fae.act = 'in'; fae.t = 60; }
          else { fae.to = { x: m.x, z: m.z }; fae.act = 'walk'; fae.t = 0; }
        } else fae.t = 60;
        continue;
      }
      // Out for the night: choose what to do.
      const village = f.focus === 'village' && f.standing >= 45 && (fae.kind === 'hob' || fae.kind === 'sprite') && h >= 0 && h < 4 && fae.lastChore !== col.community.day
        && (f.chores.day !== col.community.day || f.chores.n < 1 + Math.floor(f.level / 2));
      if (village) { fae.to = jitter(col.world.campfire, 5, rng); fae.act = 'walk'; fae.t = -1; continue; }
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
