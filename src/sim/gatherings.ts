/**
 * Gatherings that actually happen (DESIGN §24.8): festivals, dances with the
 * Folk, and weddings. A gathering is held on a given evening at a place (the
 * fire on the green, or the Ring). Everyone who can walks there: they arrive,
 * eat together, then dance in a ring while someone plays; at a wedding the
 * couple first stand under an arch with everyone around them. What it does
 * (spirits, bonds, the land, the Folk) goes to whoever came, when it ends.
 *
 * Courtship: two unattached adults who are close may start walking out; after
 * some days, if it holds, they marry, and the wedding is a gathering.
 *
 * No dice here: choices use a hash of the day and ids, so gatherings don't
 * shift the rest of the simulation's random stream.
 */
import { adjustBond, alive, bondValue, log, remember, type Survivor } from './community';
import type { Colony } from './colony';
import { changeStanding } from './folk';
import { gentryFeel, sway } from './fae';
import { householdOf, type Household } from './homes';
import { nurture } from './veil';
import { passable, toTileX, toTileZ, type Point } from './world';

export type GatheringKind = 'festival' | 'folk_festival' | 'wedding';
export type Phase = 'arrive' | 'vows' | 'feast' | 'dance';

export interface Gathering {
  id: number;
  kind: GatheringKind;
  title: string;
  /** Minutes (absolute) it starts and ends. */
  start: number;
  end: number;
  /** The centre (the fire, or the Ring), and the radius of the ring people stand, sit and dance on. */
  at: Point;
  r: number;
  /** Which of 24 sectors of the ring are open ground (people are placed only there). */
  open?: boolean[];
  /** The couple, at a wedding. */
  couple?: [number, number];
  /** Who came (survivor ids). */
  attended: number[];
  /** Those playing for the dance. */
  players: number[];
  done?: boolean;
}

/** Days courting before a wedding, and the bonds it takes. */
export const COURT_BOND = 55;
export const WED_BOND = 70;
export const COURT_DAYS = 5;
/** A wedding is held this many days after the couple decide. */
export const WED_AFTER = 2;

const hash = (a: number, b: number) => ((a * 2654435761 + b * 40503) >>> 0) % 100;
const firstName = (s: Survivor) => s.name.split(' ')[0];
const who = (col: Colony, id: number) => col.community.survivors.find((s) => s.id === id);

/** The gathering going on now, if any (setting-up time before the start counts for the view, not for people). */
export function activeGathering(col: Colony): Gathering | undefined {
  return (col.gatherings ?? []).find((g) => !g.done && col.minute >= g.start && col.minute < g.end);
}

/** The next gathering not yet over (for the HUD and the view's decorations). */
export function nextGathering(col: Colony): Gathering | undefined {
  return (col.gatherings ?? []).filter((g) => !g.done).sort((a, b) => a.start - b.start)[0];
}

/** Where a gathering is in its evening. */
export function phaseOf(g: Gathering, minute: number): Phase {
  const t = minute - g.start;
  if (g.kind === 'wedding') return t < 20 ? 'arrive' : t < 50 ? 'vows' : t < 170 ? 'feast' : 'dance';
  return t < 30 ? 'arrive' : t < (g.kind === 'folk_festival' ? 90 : 150) ? 'feast' : 'dance';
}

const SECTORS = 24;
/** Is this point open ground, clear of the old cars (which don't block the walking grid)? */
function clear(col: Colony, x: number, z: number): boolean {
  const w = col.world;
  return passable(w, toTileX(w, x), toTileZ(w, z)) && !(w.site.vehicles ?? []).some((v) => Math.hypot(v.x - x, v.z - z) < 2.6);
}

/** A ring radius around the centre that is mostly open ground. */
function openRadius(col: Colony, at: Point): number {
  let best = 4.5, bestScore = -1;
  for (const r of [4.5, 4, 5, 3.6, 5.6, 3.2, 6.2]) {
    let ok = 0;
    for (let k = 0; k < SECTORS; k++) {
      const a = ((k + 0.5) / SECTORS) * Math.PI * 2;
      if (clear(col, at.x + Math.cos(a) * r, at.z + Math.sin(a) * r)) ok++;
    }
    if (ok > bestScore + 1) { best = r; bestScore = ok; }
  }
  return best;
}

/** First evening from `day` with nothing else on. */
function freeDay(col: Colony, day: number): number {
  const taken = new Set((col.gatherings ?? []).filter((g) => !g.done).map((g) => Math.floor(g.start / 1440)));
  while (taken.has(day)) day++;
  return day;
}

/**
 * Put a gathering on: today if there is time to get ready, else tomorrow
 * (weddings `WED_AFTER` days on). Returns it.
 */
export function scheduleGathering(col: Colony, kind: GatheringKind, title: string, couple?: [number, number]): Gathering {
  const today = Math.floor(col.minute / 1440);
  const h = (col.minute % 1440) / 60;
  const startH = kind === 'wedding' ? 15 : kind === 'folk_festival' ? 18.5 : 17.5;
  const endH = kind === 'wedding' ? 22.5 : 23.5;
  const day = freeDay(col, kind === 'wedding' ? today + WED_AFTER : h < startH - 1.5 ? today : today + 1);
  const at = kind === 'folk_festival' ? { ...col.world.fairyRing } : { ...col.world.campfire };
  const g: Gathering = {
    id: (col.gatherings ?? []).reduce((n, x) => Math.max(n, x.id), 0) + 1,
    kind, title, start: day * 1440 + startH * 60, end: day * 1440 + endH * 60, at, r: openRadius(col, at),
    couple, attended: [], players: [],
  };
  g.open = Array.from({ length: SECTORS }, (_, k) => {
    const a = ((k + 0.5) / SECTORS) * Math.PI * 2;
    return clear(col, at.x + Math.cos(a) * g.r, at.z + Math.sin(a) * g.r) && clear(col, at.x + Math.cos(a) * (g.r + 0.9), at.z + Math.sin(a) * (g.r + 0.9));
  });
  if (g.open.filter(Boolean).length < 6) g.open = undefined; // hemmed in: use the whole ring
  (col.gatherings ??= []).push(g);
  // Festivals keep their old meaning for everything that reads it (the Veil opens freely, the Thriving need).
  if (kind !== 'wedding') col.council.festivalUntil = Math.max(col.council.festivalUntil, g.end);
  return g;
}

/** Slot k's angle on the ring: people spread evenly over the open part of it. */
export function slotAngle(g: Gathering, k: number, n: number): number {
  const open = g.open ? g.open.flatMap((o, i) => (o ? [i] : [])) : Array.from({ length: SECTORS }, (_, i) => i);
  const f = ((k + 0.5) / Math.max(1, n)) * open.length;
  const i = Math.min(open.length - 1, Math.floor(f));
  return ((open[i] + (f - i)) / SECTORS) * Math.PI * 2;
}

/** The arch at a wedding: between the fire and the ring. */
export function archSpot(g: Gathering): Point & { yaw: number } {
  const a = (g.id % 7) * 0.4 - 0.9;
  return { x: g.at.x + Math.cos(a) * g.r * 0.62, z: g.at.z + Math.sin(a) * g.r * 0.62, yaw: a };
}

/**
 * Where someone should be, and doing what, at this moment of the gathering.
 * `k` of `n` is their place in the ring.
 */
export function gatherSpot(col: Colony, g: Gathering, s: Survivor, k: number, n: number): { p: Point; face: Point; act: 'stand' | 'eat' | 'dance' | 'play' | 'watch' | 'cheer' } {
  const ph = phaseOf(g, col.minute);
  const base = slotAngle(g, k, n);
  const onRing = (a: number, r = g.r) => ({ x: g.at.x + Math.cos(a) * r, z: g.at.z + Math.sin(a) * r });
  const inCouple = g.couple?.includes(s.id);
  if (g.kind === 'wedding' && inCouple && (ph === 'arrive' || ph === 'vows')) {
    const arch = archSpot(g);
    const side = g.couple![0] === s.id ? 1 : -1;
    // Side by side along the ring's tangent, facing each other.
    const tx = -Math.sin(arch.yaw), tz = Math.cos(arch.yaw);
    const p = { x: arch.x + tx * 0.32 * side, z: arch.z + tz * 0.32 * side };
    return { p, face: { x: arch.x - tx * side, z: arch.z - tz * side }, act: ph === 'vows' && col.minute - g.start > 45 ? 'cheer' : 'stand' };
  }
  if (ph === 'arrive' || ph === 'vows') {
    const p = onRing(base);
    const t = g.kind === 'wedding' ? archSpot(g) : g.at;
    return { p, face: t, act: ph === 'vows' && col.minute - g.start > 45 ? 'cheer' : 'stand' };
  }
  if (ph === 'feast') return { p: onRing(base), face: g.at, act: 'eat' };
  // The dance. Players sit and play; the tired and the old watch; everyone else goes round.
  if (g.players.includes(s.id)) return { p: onRing(base, g.r + 0.9), face: g.at, act: 'play' };
  const me = col.agents.find((a) => a.id === s.id);
  const tired = (me?.needs.rest ?? 100) < 8 || s.age >= 64 || s.hp < s.maxHp * 0.5;
  if (tired && hash(s.id, Math.floor(g.start / 1440)) < 70) return { p: onRing(base, g.r + 0.9), face: g.at, act: 'watch' };
  // Round they go: a couple dance in the middle at their own wedding.
  const t = (col.minute - g.start) * 0.05;
  if (g.kind === 'wedding' && inCouple) {
    const a = t * 1.6 + (g.couple![0] === s.id ? 0 : Math.PI);
    const p = { x: g.at.x + Math.cos(a) * g.r * 0.32, z: g.at.z + Math.sin(a) * g.r * 0.32 };
    return { p, face: { x: g.at.x * 2 - p.x, z: g.at.z * 2 - p.z }, act: 'dance' };
  }
  const a = base + t;
  const p = onRing(a, g.r * (0.56 + 0.05 * Math.sin(t * 3 + k)));
  // Facing along the ring, the way they're going.
  return { p, face: { x: p.x - Math.sin(a), z: p.z + Math.cos(a) }, act: 'dance' };
}

/** Choose who plays for the dance: storytellers first, then whoever the evening falls to. */
function choosePlayers(col: Colony, g: Gathering) {
  const here = g.attended.map((id) => who(col, id)).filter((s): s is Survivor => !!s && s.alive && s.age >= 12 && !g.couple?.includes(s.id));
  here.sort((a, b) => (b.traits.includes('storyteller') ? 1 : 0) - (a.traits.includes('storyteller') ? 1 : 0)
    || hash(a.id, g.id) - hash(b.id, g.id));
  g.players = here.slice(0, here.length >= 8 ? 2 : here.length >= 3 ? 1 : 0).map((s) => s.id);
}

/** Someone has arrived. */
export function joined(g: Gathering, id: number) {
  if (!g.attended.includes(id)) g.attended.push(id);
}

/** Each step: pick players when the dance starts, the Folk join in, and close the gathering at its end. */
export function gatheringsTick(col: Colony) {
  for (const g of col.gatherings ?? []) {
    if (g.done || col.minute < g.start) continue;
    if (col.minute >= g.end) { finish(col, g); continue; }
    const ph = phaseOf(g, col.minute);
    if (ph === 'dance' && !g.players.length) choosePlayers(col, g);
    if (g.kind === 'folk_festival' && ph === 'dance') {
      // The Folk come to the Ring and dance among the villagers.
      const t = (col.minute - g.start) * 0.05;
      col.folk.beings.forEach((fae, i) => {
        const a = (i + 0.25) / Math.max(1, col.folk.beings.length) * Math.PI * 2 + t * 1.15;
        const p = { x: g.at.x + Math.cos(a) * g.r * 0.45, z: g.at.z + Math.sin(a) * g.r * 0.45 };
        if (fae.act !== 'dance' && Math.hypot(fae.x - p.x, fae.z - p.z) > 1.5) { fae.to = p; fae.act = 'walk'; fae.t = 0; return; }
        fae.x = p.x; fae.z = p.z; fae.act = 'dance'; fae.t = 5;
      });
    }
  }
}

function finish(col: Colony, g: Gathering) {
  g.done = true;
  const c = col.community, w = col.world;
  const came = g.attended.map((id) => who(col, id)).filter((s): s is Survivor => !!s && s.alive);
  const n = came.length;
  const lift = g.kind === 'festival' ? 6 : g.kind === 'folk_festival' ? 5 : 5;
  for (const s of came) s.morale = Math.min(100, s.morale + lift);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) adjustBond(c, came[i].id, came[j].id, g.kind === 'folk_festival' ? 1 : 2);
  const played = g.players.map((id) => who(col, id)).filter((s): s is Survivor => !!s);
  const band = played.length ? ` ${played.map(firstName).join(' and ')} played until their fingers ached.` : '';
  if (g.kind === 'festival') {
    nurture(col, g.at.x, g.at.z, 0.08, 3);
    log(c, n ? `${g.title}: ${n} of the village ate together by the fire and danced till late.${band}` : `${g.title} came and went. Nobody felt like it.`, n ? 'good' : 'bad');
    for (const s of came) remember(s, c.day, `Danced at ${g.title}.`);
  } else if (g.kind === 'folk_festival') {
    changeStanding(col, 8);
    // The Gentry remember who danced with them; the dancers think better of the Folk (DESIGN §25.2).
    for (const s of came) { gentryFeel(col.folk, s.id, 4); sway(s, 5); }
    nurture(col, w.folk.mound.x, w.folk.mound.z, 0.1, 3);
    const stranger = col.folk.beings.find((b) => !b.known);
    if (stranger) stranger.known = true;
    log(c, `The village danced at the Ring with the Folk of ${w.folk.mound.name} until the stars went pale.${stranger ? ` ${stranger.name} danced with everyone, and told them their name.` : ''}${band}`, 'strange');
    for (const s of came) remember(s, c.day, `Danced with the Folk at the Ring.`);
  } else if (g.couple) {
    const [a, b] = g.couple.map((id) => who(col, id));
    if (a?.alive && b?.alive) marry(col, a, b, n);
  }
}

// ---------- courtship and weddings ----------

const adult = (s: Survivor) => s.alive && !s.taken && s.age >= 18;
const free = (col: Colony, s: Survivor) => {
  const p = s.partner !== undefined ? who(col, s.partner) : undefined;
  return adult(s) && (!p || !p.alive) && s.courting === undefined && s.griefDays <= 0;
};

/** Daily: couples start walking out, grow closer or drift apart, and decide to marry. */
export function courtshipDaily(col: Colony) {
  const c = col.community;
  const living = alive(c);
  // Courting couples.
  for (const s of living) {
    if (s.courting === undefined || s.id > s.courting) continue; // each couple once
    const o = who(col, s.courting);
    if (!o || !o.alive || o.courting !== s.id) { s.courting = undefined; if (o && o.courting === s.id) o.courting = undefined; continue; }
    adjustBond(c, s.id, o.id, 2);
    const bond = bondValue(c, s.id, o.id);
    if (bond < 30) {
      s.courting = o.courting = undefined;
      log(c, `${firstName(s)} and ${firstName(o)} have stopped walking out together. Nobody asks.`, 'info');
      continue;
    }
    const days = c.day - (s.courtingSince ?? c.day);
    const pending = (col.gatherings ?? []).some((g) => !g.done && g.kind === 'wedding' && g.couple?.includes(s.id));
    if (!pending && days >= COURT_DAYS && bond >= WED_BOND && hash(s.id + o.id, c.day) < 50) {
      const g = scheduleGathering(col, 'wedding', `The wedding of ${firstName(s)} and ${firstName(o)}`, [s.id, o.id]);
      const on = Math.floor(g.start / 1440) + 1;
      log(c, `${firstName(s)} and ${firstName(o)} are to be married on day ${on}. Everyone is invited.`, 'good');
      remember(s, c.day, `Asked ${firstName(o)} to marry me. (Or they asked me: we disagree.)`);
      remember(o, c.day, `Said yes to ${firstName(s)}.`);
    }
  }
  // New courtships: the closest free pair, at most one a day.
  const free_ = living.filter((s) => free(col, s));
  let best: [Survivor, Survivor, number] | null = null;
  for (let i = 0; i < free_.length; i++) for (let j = i + 1; j < free_.length; j++) {
    const a = free_[i], b = free_[j];
    if (Math.abs(a.age - b.age) > 16) continue;
    const bond = bondValue(c, a.id, b.id);
    if (bond >= COURT_BOND && (!best || bond > best[2])) best = [a, b, bond];
  }
  if (best && hash(best[0].id * 31 + best[1].id, c.day) < 30) {
    const [a, b] = best;
    a.courting = b.id; b.courting = a.id;
    a.courtingSince = b.courtingSince = c.day;
    log(c, `${firstName(a)} and ${firstName(b)} have been walking out together in the evenings.`, 'good');
    remember(a, c.day, `Started walking out with ${firstName(b)}.`);
    remember(b, c.day, `Started walking out with ${firstName(a)}.`);
  }
}

/** The couple are married: partners, and one household. */
function marry(col: Colony, a: Survivor, b: Survivor, guests: number) {
  const c = col.community, v = col.village;
  a.partner = b.id; b.partner = a.id;
  a.courting = b.courting = undefined;
  adjustBond(c, a.id, b.id, 10);
  a.morale = Math.min(100, a.morale + 10); b.morale = Math.min(100, b.morale + 10);
  remember(a, c.day, `Married ${firstName(b)}.`);
  remember(b, c.day, `Married ${firstName(a)}.`);
  log(c, `${firstName(a)} and ${firstName(b)} were married under the arch, with ${guests} of the village looking on. There was dancing after.`, 'good');
  const ha = householdOf(v, a.id), hb = householdOf(v, b.id);
  if (ha && ha === hb) return;
  const homeBeds = (h: Household | undefined) => (h?.home ? v.buildings.find((x) => x.id === h.home)?.beds ?? 0 : 0);
  // Move in where there is a home with room; else set up together and wait for one.
  const into = [hb, ha].find((h) => h && h.home && homeBeds(h) > h.members.length);
  const mover = into === hb ? a : b;
  const leave = (s: Survivor) => { const h = householdOf(v, s.id); if (h) h.members = h.members.filter((m) => m !== s.id); };
  if (into) {
    leave(mover);
    into.members.push(mover.id);
    log(c, `${firstName(mover)} has moved in with ${firstName(mover === a ? b : a)}.`, 'good');
  } else {
    leave(a); leave(b);
    v.households.push({ id: v.nextId++, members: [a.id, b.id], home: 0, since: c.day, petitioned: 0 });
  }
  v.households = v.households.filter((h) => h.members.length > 0 || h.home);
}
