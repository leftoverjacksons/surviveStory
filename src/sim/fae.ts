/**
 * The Folk as two peoples, and what passes between them and the village
 * (DESIGN §25.2).
 *
 * - **The Gentry** (the elders and pipers): tall, named, ageless. They hold
 *   opinions of each other and of the village's people, which move with what
 *   those people do (meeting them, offerings, dancing with them, breaking
 *   their rules), and decide whom they borrow for a dance or lead astray.
 * - **The Wee Folk** (hobs and sprites): small, in bands by knowe, abroad from
 *   dusk to dawn in the village. A saucer left out at a door is taken, and
 *   something is done for that house. With no saucer there may be mischief,
 *   more as the Folk's standing falls, and it truly costs: hidden tools slow
 *   a day's work, soured food is lost, a woodpile carried off must be fetched
 *   back, tangled nets halve a catch, bad dreams cost sleep. Among friends it
 *   is mostly play.
 * - **The village's side:** everyone has a feeling for the Folk
 *   (`Survivor.fae`, −100..100), moved by what happens to them and
 *   remembered. It decides who leaves saucers and offerings; a household
 *   that turns against the Folk nails iron over its door (no mischief, and
 *   no favours either). The Folk feel the village's mood: it moves their
 *   standing a little each day.
 */
import type { Colony } from './colony';
import { alive, log, remember, withRng, type Survivor } from './community';
import type { Fae, FaeKind, FolkSociety } from './folk';
import type { Household } from './homes';
import type { Rng } from './rng';
import { Crop } from './world';

export type FaeClass = 'gentry' | 'wee';
export const classOf = (k: FaeKind): FaeClass => (k === 'elder' || k === 'piper' ? 'gentry' : 'wee');
export const isGentry = (b: Fae) => classOf(b.kind) === 'gentry';

const clamp = (v: number) => Math.max(-100, Math.min(100, v));
const first = (s: Survivor) => s.name.split(' ')[0];
/** A fixed number in [0, 1) from two integers. */
const hash = (a: number, b: number) => ((((a * 73856093) ^ (b * 19349663)) >>> 0) % 10007) / 10007;

// ---------- opinions ----------

/** What one of the Folk thinks of a person (−100..100). */
export const opinionOf = (b: Fae, sid: number) => b.of?.[sid] ?? 0;
export function feel(b: Fae, sid: number, d: number) { (b.of ??= {})[sid] = clamp(opinionOf(b, sid) + d); }
/** Every one of the Gentry who knows of it feels it. */
export function gentryFeel(f: FolkSociety, sid: number, d: number) { for (const b of f.beings) if (isGentry(b)) feel(b, sid, d); }
/** What the Gentry think of a person, on average. */
export function gentryView(f: FolkSociety, sid: number): number {
  const g = f.beings.filter(isGentry);
  return g.length ? g.reduce((n, b) => n + opinionOf(b, sid), 0) / g.length : 0;
}
/** One of the Folk's opinion of another. */
export const kinOf = (a: Fae, b: Fae) => a.kin?.[b.id] ?? 0;

/** Opinions of each other, for anyone who has none yet: fixed per pair, mostly warm, a few cool. */
export function seedOpinions(f: FolkSociety) {
  for (const a of f.beings) for (const b of f.beings) {
    if (a === b || a.kin?.[b.id] !== undefined) continue;
    (a.kin ??= {})[b.id] = Math.round(-25 + hash(a.id * 31 + b.id, 7) * 80);
  }
}

/** The village's feeling for the Folk (−100..100): what someone thinks of them. */
export const faeView = (s: Survivor) => s.fae ?? 0;
export function sway(s: Survivor, d: number) { s.fae = clamp(faeView(s) + d); }
export const viewWord = (v: number) => (v <= -40 ? 'afraid of the Folk' : v <= -15 ? 'wary of the Folk' : v < 15 ? 'unsure about the Folk' : v < 40 ? 'fond of the Folk' : 'devoted to the Folk');
export function villageFeeling(col: Colony): number {
  const adults = alive(col.community).filter((s) => s.age >= 12);
  return adults.length ? adults.reduce((n, s) => n + faeView(s), 0) / adults.length : 0;
}

const membersOf = (col: Colony, h: Household) => h.members.map((id) => col.community.survivors.find((s) => s.id === id)).filter((s): s is Survivor => !!s?.alive);
/** Who speaks for a household about the Folk: the one who feels most strongly. */
const voiceOf = (col: Colony, h: Household) => membersOf(col, h).sort((a, b) => Math.abs(faeView(b)) - Math.abs(faeView(a)))[0];

// ---------- dusk: saucers at the door ----------

/**
 * At dusk, households that like the Folk (or are trying to make peace after
 * mischief) leave a saucer of milk and bread at the door. Costs a little food.
 */
export function saucersAtDusk(col: Colony) {
  const c = col.community, day = c.day;
  let left = 0;
  for (const h of col.village.households) {
    if (!h.home || h.iron) continue;
    const v = voiceOf(col, h);
    if (!v) continue;
    const feel = faeView(v);
    const makingPeace = h.hit !== undefined && day - h.hit <= 3 && feel > -30;
    if (feel < 10 && !makingPeace) continue;
    if (c.resources.food < col.agents.length * 2 + 1) continue;
    c.resources.food -= 0.5;
    h.saucer = day;
    left++;
  }
  return left;
}

// ---------- the Wee Folk's nights ----------

/** Where a Wee one goes visiting tonight: a house with a home, not ironed, not already visited. */
export function visitTarget(col: Colony, b: Fae, rng: Rng): { x: number; z: number } | null {
  const v = col.village, day = col.community.day;
  if (isGentry(b) || b.visited === day) return null;
  const taken = new Set(col.folk.beings.map((o) => o.visit).filter((x) => x !== undefined));
  // Saucers draw them; otherwise anywhere.
  const houses = v.households.filter((h) => h.home && !h.iron && !taken.has(h.id));
  if (!houses.length) return null;
  const withSaucer = houses.filter((h) => h.saucer === day);
  const h = withSaucer.length && rng.chance(0.75) ? rng.pick(withSaucer) : rng.pick(houses);
  const home = v.buildings.find((x) => x.id === h.home);
  if (!home) return null;
  b.visit = h.id;
  b.visited = day;
  return { x: home.door.x + rng.range(-0.8, 0.8), z: home.door.z + rng.range(-0.8, 0.8) };
}

/** How likely mischief is at a house with no saucer, by the Folk's standing. */
const mischiefChance = (standing: number) => (standing < 20 ? 0.55 : standing < 45 ? 0.3 : standing < 70 ? 0.12 : 0.08);

/** A Wee one at a door. Returns what happened, for the news (or null). */
export function weeVisit(col: Colony, b: Fae, rng: Rng): string | null {
  const v = col.village, c = col.community, f = col.folk, day = c.day;
  const h = v.households.find((x) => x.id === b.visit);
  b.visit = undefined;
  if (!h || !h.home || h.iron) return null;
  const who = membersOf(col, h);
  if (!who.length) return null;
  if (h.saucer === day) {
    h.saucer = -day; // taken
    return favour(col, who, rng);
  }
  if (f.mischief?.day === day && f.mischief.n >= 1 + Math.floor(f.level / 2)) return null;
  if (!rng.chance(mischiefChance(f.standing))) return null;
  f.mischief = f.mischief?.day === day ? { day, n: f.mischief.n + 1 } : { day, n: 1 };
  return mischief(col, h, who, rng);
}

/** A saucer taken: something done for the house in return. */
function favour(col: Colony, who: Survivor[], rng: Rng): string {
  const c = col.community, w = col.world;
  for (const s of who) { sway(s, 3); s.morale = Math.min(100, s.morale + 1); }
  col.folk.standing = Math.min(100, col.folk.standing + 0.3);
  const name = who[0].name.split(' ').slice(-1)[0];
  const p = col.village.projects.find((x) => !x.done && x.work > 0 && x.work < x.workNeeded);
  const roll = rng.int(0, 3);
  if (roll === 0 && p) { p.work = Math.min(p.workNeeded, p.work + 20); return `The saucer at the ${name} house was licked clean, and someone did an hour's work on ${p.name.toLowerCase()} before dawn.`; }
  if (roll === 1) {
    let n = 0;
    for (let i = 0; i < w.cropState.length && n < 8; i++) if (w.cropState[i] === Crop.Growing && !col.tended.has(i)) { col.tended.add(i); n++; }
    if (n) return `The saucer at the ${name} house was empty in the morning, and a row of the field had been weeded.`;
  }
  if (roll === 2) { c.resources.wood += 2; return `The saucer at the ${name} house was taken, and a bundle of kindling was left in its place.`; }
  for (const s of who) s.morale = Math.min(100, s.morale + 2);
  return `The ${name} household left milk out, and slept better than they have in weeks. Something mended the hinge on their gate.`;
}

type Mischief = 'tools' | 'sour' | 'woodpile' | 'nets' | 'dreams' | 'braid' | 'boots';

/** No saucer: mischief. Play among friends; real harm when the Folk are cross. */
function mischief(col: Colony, h: Household, who: Survivor[], rng: Rng): string {
  const c = col.community, v = col.village, f = col.folk, day = c.day;
  const s = rng.pick(who);
  const n = first(s);
  const cross = f.standing < 45;
  const options: Mischief[] = cross ? ['tools', 'sour', 'woodpile', 'dreams'] : ['braid', 'boots', 'braid', 'tools'];
  if (cross && v.fisheries.some((x) => x.hut)) options.push('nets');
  const kind = rng.pick(options);
  h.hit = day;
  const hurt = (d: number, memory: string) => { sway(s, -d); for (const o of who) if (o !== s) sway(o, -Math.round(d / 2)); remember(s, day, memory); };
  switch (kind) {
    case 'tools':
      s.toolsHidden = day;
      hurt(cross ? 6 : 2, 'Found their tools up a tree in the morning.');
      return `${n}'s tools were found up an apple tree in the morning. ${cross ? 'A day\'s work goes slowly without them.' : 'They laughed, eventually.'}`;
    case 'sour': {
      const lost = Math.min(Math.max(0, c.resources.food - 2), rng.int(2, 5));
      c.resources.food -= lost;
      hurt(5, 'Their milk and bread went sour overnight.');
      return `Everything in the ${n} household's larder had soured by morning: ${lost} food lost.`;
    }
    case 'woodpile': {
      const k = Math.min(Math.floor(c.resources.wood), rng.int(3, 6));
      const home = v.buildings.find((x) => x.id === h.home);
      if (k > 0 && home) {
        c.resources.wood -= k;
        const a = rng.range(0, Math.PI * 2), d = rng.range(6, 10);
        col.items.push({ id: col.nextItemId++, kind: 'wood', amount: k, x: home.door.x + Math.cos(a) * d, z: home.door.z + Math.sin(a) * d, reserved: 0 });
      }
      hurt(4, 'Their woodpile walked off in the night.');
      return `${n}'s woodpile was found in the morning stacked neatly in a ditch, ten yards off. Someone will have to carry it back.`;
    }
    case 'nets': {
      const fy = rng.pick(v.fisheries.filter((x) => x.hut));
      fy.tangled = day;
      hurt(5, 'The nets were knotted into a ball in the night.');
      return `The nets at the fishing hut were knotted into one great ball in the night. Half a day's catch at most, until they're picked apart.`;
    }
    case 'dreams':
      for (const o of who) { const ag = col.agents.find((x) => x.id === o.id); if (ag) ag.needs.rest = Math.max(0, ag.needs.rest - 25); o.morale = Math.max(0, o.morale - 3); }
      hurt(4, 'Dreamed of small hands at the window all night.');
      return `Nobody in the ${n} household slept: something tapped at the shutters till dawn, laughing.`;
    case 'boots':
      s.morale = Math.max(0, s.morale - 1);
      hurt(1, 'Found their boots on the roof.');
      return `${n}'s boots were on the roof in the morning, laces tied together. The Folk think this is very funny.`;
    case 'braid':
    default:
      if (faeView(s) >= 0) { s.morale = Math.min(100, s.morale + 1); sway(s, 1); remember(s, day, 'Woke with their hair braided with flowers.'); }
      else hurt(2, 'Woke with their hair knotted into elf-locks.');
      return faeView(s) >= 0 ? `${n} woke with their hair braided with meadowsweet. They wore it like that all day.` : `${n} woke with their hair twisted into elf-locks, and cut them out in a temper.`;
  }
}

// ---------- daily ----------

/** Daily: iron over doors, the village's mood felt at the hill, and a word about the Gentry's own quarrels and loves. */
export function faeDaily(col: Colony) {
  const f = col.folk, c = col.community, m = col.world.folk.mound;
  seedOpinions(f);
  for (const h of col.village.households) {
    const v = voiceOf(col, h);
    if (!v || !h.home) continue;
    if (!h.iron && faeView(v) <= -45) {
      h.iron = true;
      f.standing = Math.max(0, f.standing - 1);
      log(c, `${first(v)} nailed an old horseshoe over the door. Nothing from ${m.name} will come near that house now: not to make mischief, and not to help.`, 'bad');
    } else if (h.iron && faeView(v) >= 0) {
      h.iron = false;
      log(c, `${first(v)} took the horseshoe down from over the door.`, 'strange');
    }
  }
  // The Folk feel the village's mood.
  f.standing = Math.max(0, Math.min(100, f.standing + villageFeeling(col) * 0.01));
  // Now and then, a word about the Gentry's own feelings, if anyone has met them.
  if (!f.met) return;
  withRng(c, (rng) => {
    if (!rng.chance(0.08)) return;
    const g = f.beings.filter((b) => isGentry(b) && b.known);
    if (!g.length) return;
    const a = rng.pick(g);
    const others = f.beings.filter((b) => b !== a && b.known);
    const people = alive(c).filter((s) => Math.abs(opinionOf(a, s.id)) >= 25);
    if (people.length && rng.chance(0.6)) {
      const s = people.sort((x, y) => Math.abs(opinionOf(a, y.id)) - Math.abs(opinionOf(a, x.id)))[0];
      const o = opinionOf(a, s.id);
      log(c, o > 0 ? `They say ${a.name} of ${m.name} asks after ${first(s)}, and leaves small things on their windowsill.` : `They say ${a.name} of ${m.name} will not dance where ${first(s)} is. Nobody knows what ${first(s)} did.`, 'strange');
    } else if (others.length) {
      const b = others.sort((x, y) => Math.abs(kinOf(a, y)) - Math.abs(kinOf(a, x)))[0];
      const o = kinOf(a, b);
      if (Math.abs(o) >= 20) log(c, o > 0 ? `On clear nights ${a.name} and ${b.name} sit together on the crown of ${m.name}, singing.` : `${a.name} and ${b.name} of ${m.name} have quarrelled: the woods between their doors are full of cold air.`, 'strange');
    }
  });
}

// ---------- the Restless (DESIGN §25.2) ----------

/**
 * A spirit laid to rest (or unravelled) in a cleared district doesn't linger:
 * by night it drifts back toward the Great Hill as a pale light, and is taken
 * in. What the hill takes in becomes its memory; every few, a new one of the
 * Wee Folk quickens (the old belief that the fairy host is fed by the dead).
 * Banished spirits never come.
 */
export interface Restless { id: number; name: string; x: number; z: number; from: string }

/** How many taken in for each Wee one that quickens. */
export const QUICKEN = 3;
/** How fast they drift (units a minute), by night only. */
const DRIFT = 0.35;

export function sendHome(col: Colony, name: string, x: number, z: number, from: string) {
  const f = col.folk;
  (f.restless ??= []).push({ id: (f.nextRestless = (f.nextRestless ?? 0) + 1), name, x, z, from });
  f.version++;
}

/** Each step: by night, the Restless drift toward the hill; at its door they go in. */
export function restlessTick(col: Colony, dt: number, hour: number, addWee: (name: string) => Fae) {
  const f = col.folk, m = col.world.folk.mound;
  if (!f.restless?.length || !(hour >= 20 || hour < 5)) return;
  const door = { x: m.x + Math.cos(m.door) * (m.r + 0.6), z: m.z + Math.sin(m.door) * (m.r + 0.6) };
  for (const r of [...f.restless]) {
    const dx = door.x - r.x, dz = door.z - r.z, d = Math.hypot(dx, dz);
    const step = DRIFT * dt;
    if (d > step) {
      // Not straight: they wander a little as they come.
      const wob = Math.sin(col.minute * 0.05 + r.id) * 0.4;
      r.x += (dx / d) * step + (-dz / d) * wob * step;
      r.z += (dz / d) * step + (dx / d) * wob * step;
      continue;
    }
    f.restless = f.restless.filter((x) => x !== r);
    f.memory = (f.memory ?? 0) + 1;
    f.standing = Math.min(100, f.standing + 1);
    const c = col.community;
    log(c, `In the small hours a pale light came up the path to ${m.name}: what was ${r.name}, of ${r.from}. The door opened for it, and it went in.`, 'strange');
    if (f.memory % QUICKEN === 0) {
      const wee = addWee(r.name);
      log(c, `Something new has quickened under ${m.name}: one of the Wee Folk, with a look of ${r.name} about them. ${f.met ? `They call themselves ${wee.name}.` : 'There is one more light at dusk than there was.'}`, 'strange');
    }
    f.version++;
  }
}
