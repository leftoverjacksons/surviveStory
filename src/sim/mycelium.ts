/**
 * The mycelium (DESIGN §24.10): the Folk's network under the ground, and
 * where their mood reaches. It grows out from the hill a little each day,
 * best along their paths, their works and the Wild. Places the village
 * honours (the Sacred zone, the shrine, the Ring, the memorial) are hubs: once
 * it reaches one, it grows strong again from there. An
 * uncleared district is dead ground to it: clearing one lets it through.
 * Cutting in the Wild severs it where the tree stood.
 *
 * Where it reaches, the hill's mood is felt: a blessing while the Folk are
 * friendly (things grow better, homes sleep sound), a curse while they are
 * soured (patches of blight, milk turning, bad dreams). Nuisances, never
 * disasters.
 *
 * A coarse grid (CELL tiles a side), so the daily update is cheap.
 */
import { alive, log } from './community';
import type { Colony } from './colony';
import { Crop, Ground, Zone, idx, inBounds, type World } from './world';

export const CELL = 4;
/** Below this the network is too thin to carry anything. */
export const REACH = 0.25;
/** How much each step away from a feeding place thins it. */
const FALLOFF = 0.86;
/** The most it can grow in a day. */
const GROW = 0.12;

export interface Mycelium {
  cw: number; ch: number;
  m: Float32Array;
  version: number;
}

export function createMycelium(w: World): Mycelium {
  const cw = Math.ceil(w.w / CELL), ch = Math.ceil(w.h / CELL);
  const my: Mycelium = { cw, ch, m: new Float32Array(cw * ch), version: 0 };
  const c = cellAt(my, w, w.folk.mound.x, w.folk.mound.z);
  if (c >= 0) my.m[c] = 1;
  return my;
}

export function cellAt(my: Mycelium, w: World, x: number, z: number): number {
  const cx = Math.floor((x + w.w / 2) / CELL), cz = Math.floor((z + w.h / 2) / CELL);
  return cx < 0 || cz < 0 || cx >= my.cw || cz >= my.ch ? -1 : cz * my.cw + cx;
}

/** The hill's mood as felt through the network: +1 full blessing, −1 full curse, 0 neither. */
export function folkMood(col: Colony): number {
  const s = col.folk.standing;
  if (s >= 45) return 0.4 + 0.6 * Math.min(1, (s - 45) / 45);
  if (s < 30) return -Math.min(1, (30 - s) / 25);
  return 0;
}

/** Blessing (+) or curse (−) at a point: the network's strength there times the mood. */
export function blessingAt(col: Colony, x: number, z: number): number {
  const my = col.mycelium;
  if (!my) return 0;
  const c = cellAt(my, col.world, x, z);
  const m = c < 0 ? 0 : my.m[c];
  return m < REACH ? 0 : m * folkMood(col);
}

/** Growth multiplier from the blessing (crops, berries, yards): up to +15%. Curses act by blight instead. */
export const blessingGrowth = (col: Colony, x: number, z: number) => 1 + 0.15 * Math.max(0, blessingAt(col, x, z));

/** How far each cell can carry the network: what feeds it there, and what forbids it. */
function capacity(col: Colony): { cap: Float32Array; hub: Float32Array; source: number } {
  const w = col.world, my = col.mycelium!;
  const cap = new Float32Array(my.cw * my.ch), hub = new Float32Array(my.cw * my.ch);
  // Natural ground carries it; paving and water barely or not at all.
  for (let cz = 0; cz < my.ch; cz++) for (let cx = 0; cx < my.cw; cx++) {
    let soil = 0, n = 0, wild = 0, sacred = 0;
    for (let dz = 0; dz < CELL; dz++) for (let dx = 0; dx < CELL; dx++) {
      const tx = cx * CELL + dx, tz = cz * CELL + dz;
      if (!inBounds(w, tx, tz)) continue;
      const i = idx(w, tx, tz), g = w.ground[i];
      n++;
      if (g === Ground.Grass || g === Ground.Meadow || g === Ground.Forest) soil++;
      if (w.zone[i] === Zone.Wild) wild++;
      if (w.zone[i] === Zone.Sacred) sacred++;
      if (w.folk.path[i]) wild += 2;
    }
    const c = cz * my.cw + cx;
    const s = n ? soil / n : 0;
    cap[c] = s * 0.42 + Math.min(1, wild / Math.max(1, n)) * 0.45;
    if (sacred) hub[c] = 0.7;
  }
  const mark = (x: number, z: number, v: number, isHub = false) => {
    const c = cellAt(my, w, x, z);
    if (c < 0) return;
    cap[c] = Math.max(cap[c], v);
    if (isHub) hub[c] = Math.max(hub[c], v);
  };
  const m = w.folk.mound;
  mark(m.x, m.z, 1);
  for (const k of col.folk.works) if (k.built === undefined || k.built >= 1) mark(k.x, k.z, 0.9);
  // The knowes round the Great Hill: the network runs out to each, and on from there (DESIGN §25.3).
  for (const k of col.folk.knowes ?? []) mark(k.x, k.z, 0.95, true);
  mark(w.fairyRing.x, w.fairyRing.z, 0.9, true);
  for (const b of col.village.buildings) if (b.kind === 'shrine') mark(b.door.x, b.door.z, 0.8, true);
  mark(w.site.memorial.x, w.site.memorial.z, 0.6, true);
  // Uncleared districts are dead ground. Cleared, they carry it over their paving:
  // moderately if the village took them, strongly if they were given to the Folk.
  for (const h of col.haunts) {
    const carry = h.state !== 'cleared' ? 0 : h.owner === 'folk' || h.owner === 'shared' ? 0.8 : 0.4;
    for (const r of w.ruins) {
      if (r.district !== h.district) continue;
      const rr = Math.max(r.w, r.d) / 2 + 3;
      for (let dz = -rr; dz <= rr; dz += CELL / 2) for (let dx = -rr; dx <= rr; dx += CELL / 2) {
        const c = cellAt(my, w, r.x + dx, r.z + dz);
        if (c < 0) continue;
        if (carry === 0) { cap[c] = 0; hub[c] = 0; } else cap[c] = Math.max(cap[c], carry);
      }
    }
  }
  return { cap, hub, source: cellAt(my, w, m.x, m.z) };
}

/** Daily: the network grows toward what feeds it, thins where it isn't fed, and the mood is felt. */
export function myceliumDaily(col: Colony) {
  const my = (col.mycelium ??= createMycelium(col.world));
  const { cap, hub, source } = capacity(col);
  const { cw, ch } = my;
  const next = new Float32Array(my.m.length);
  for (let cz = 0; cz < ch; cz++) for (let cx = 0; cx < cw; cx++) {
    const c = cz * cw + cx;
    let best = 0;
    if (cx > 0) best = Math.max(best, my.m[c - 1]);
    if (cx < cw - 1) best = Math.max(best, my.m[c + 1]);
    if (cz > 0) best = Math.max(best, my.m[c - cw]);
    if (cz < ch - 1) best = Math.max(best, my.m[c + cw]);
    // What it could reach from its neighbours, bounded by what the ground here can carry;
    // a hub it has reached grows strong again; the hill itself always is.
    const want = c === source ? 1 : Math.max(Math.min(cap[c], best * FALLOFF), best >= REACH ? hub[c] : 0);
    const cur = my.m[c];
    next[c] = want > cur ? Math.min(want, cur + GROW) : Math.max(want, cur - 0.03);
  }
  my.m = next;
  my.version++;
  feel(col);
}

/** Cutting in the Wild tears it where the tree stood. */
export function sever(col: Colony, x: number, z: number) {
  const my = col.mycelium;
  if (!my) return;
  const c = cellAt(my, col.world, x, z);
  if (c >= 0) { my.m[c] = Math.max(0, my.m[c] - 0.35); my.version++; }
}

/** Share of a set of points the network reaches (for the HUD). */
export function reachShare(col: Colony, pts: { x: number; z: number }[]): number {
  if (!pts.length || !col.mycelium) return 0;
  return pts.filter((p) => { const c = cellAt(col.mycelium!, col.world, p.x, p.z); return c >= 0 && col.mycelium!.m[c] >= REACH; }).length / pts.length;
}

/** Cells the network reaches. */
export const reachCells = (col: Colony) => (col.mycelium ? col.mycelium.m.filter((v) => v >= REACH).length : 0);

// Deterministic "chance" from the day and a key, so the network doesn't shift the rest of the random stream.
const roll = (day: number, key: number) => (((day * 2654435761) ^ (key * 40503)) >>> 0) % 1000 / 1000;

/** The mood, felt where the network reaches the village. */
function feel(col: Colony) {
  const c = col.community, w = col.world, day = c.day;
  const mood = folkMood(col);
  if (mood === 0) return;
  const hill = w.folk.mound.name;
  // Homes: blessed homes sleep sound; cursed ones dream badly.
  let dreams = 0;
  for (const s of alive(c)) {
    const bed = col.beds.get(s.id);
    const b = bed !== undefined ? col.village.buildings.find((x) => x.id === bed) : undefined;
    const p = b?.door ?? w.campfire;
    const e = blessingAt(col, p.x, p.z);
    if (e > 0.2) s.morale = Math.min(100, s.morale + 0.6);
    else if (e < -0.3 && roll(day, s.id) < -e * 0.5) { s.morale = Math.max(0, s.morale - 2); dreams++; }
  }
  if (dreams && !col.hints.has(`dreams${day - (day % 4)}`)) {
    col.hints.add(`dreams${day - (day % 4)}`);
    log(c, `${dreams > 1 ? `${dreams} people` : 'Someone'} woke from the same dream: roots, and a voice under the hill that is not pleased. (The Folk of ${hill} are soured, and their mycelium reaches the village.)`, 'bad');
  }
  if (mood > 0) return;
  // Blight in patches, where the network reaches the fields.
  let blighted = 0;
  for (let i = 0; i < w.cropState.length && blighted < 6; i++) {
    if (w.cropState[i] !== Crop.Growing) continue;
    const e = blessingAt(col, (i % w.w) - w.w / 2 + 0.5, Math.floor(i / w.w) - w.h / 2 + 0.5);
    if (e < -0.2 && roll(day, i) < -e * 0.05) { w.cropState[i] = Crop.Tilled; w.cropGrowth[i] = 0; blighted++; }
  }
  if (blighted) { w.cropVersion++; log(c, `A patch of the crop came up black overnight: ${blighted} rows. Nobody will say the word, but everyone looks toward ${hill}.`, 'bad'); }
  // Milk turns and bread sours in the stores, if the network is under them.
  const e = blessingAt(col, w.campfire.x, w.campfire.z);
  if (e < -0.2 && roll(day, 7) < -e * 0.3 && c.resources.food > 10) {
    const lost = Math.min(4, Math.ceil(-e * 5));
    c.resources.food -= lost;
    log(c, `${lost} food turned in the night. The Folk of ${hill} are soured, and it reaches the stores.`, 'bad');
  }
}
