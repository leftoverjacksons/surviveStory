/**
 * Growing up, growing old, and families (DESIGN §24.15; the user's answers
 * in §24.11: children take as long as it really takes to grow up, one year
 * of age per game year; lineage in the manner of Crusader Kings).
 *
 * Everyone has a birth day, and their age follows the calendar. Everyone
 * belongs to a family (a surname the village remembers); children are named
 * for theirs. A married couple living together, one of them able to carry a
 * child, with room at home and food to spare, may expect one; other couples
 * may take in a foundling. Babies stay at home; children play; at twelve they
 * learn a parent's work; at sixteen they are grown. The old die in time.
 *
 * Deterministic: births and deaths use hashes of the day and ids, and a
 * child's make-up uses the community's own random stream.
 */
import { DAYS_PER_YEAR } from './calendar';
import { adjustBond, alive, killSurvivor, log, remember, withRng, TUNING, type Community, type Survivor } from './community';
import type { Colony } from './colony';
import { FIRST_NAMES } from './data';
import { homeOf, householdOf } from './homes';

export const COME_OF_AGE = 16;
export const APPRENTICE_AGE = 12;
export const TODDLER_AGE = 3;
/** Days a pregnancy lasts (nine months of a 32-day year). */
export const PREGNANCY_DAYS = Math.round(DAYS_PER_YEAR * 0.75);
/** Children per household at most, and headroom over the arrivals cap for the village's own. */
export const MAX_CHILDREN = 4;
export const BIRTH_POP_CAP = 30;

export const FAMILY_NAMES = [
  'Ashdown', 'Marrow', 'Finch', 'Okafor', 'Varga', 'Hale', 'Quinlan', 'Moreau', 'Tanaka', 'Brandt', 'Oyelaran', 'Sallow',
  'Pike', 'Novak', 'Reyes', 'Thorne', 'Castellan', 'Weir', 'Abernathy', 'Kowalczyk', 'Lindqvist', 'Mbeki', 'Harrow', 'Delacroix',
  'Fairweather', 'Oduya', 'Pellow', 'Rook', 'Santos', 'Vance', 'Whitlock', 'Yarrow',
];

const hash = (a: number, b: number) => (((a * 2654435761) ^ (b * 40503)) >>> 0) % 10000 / 10000;
const first = (s: Survivor) => s.name.split(' ')[0];

export const isAdult = (s: Survivor) => s.age >= COME_OF_AGE;
export const isChild = (s: Survivor) => s.age < COME_OF_AGE;
/** Can carry a child (the renderer draws odd ids as women; the simulation follows it). */
export const canCarry = (s: Survivor) => s.id % 2 === 1 && s.age >= 18 && s.age <= 44;

/** A birth day consistent with an age (spread through the year by id), for arrivals and old saves. */
export const bornFor = (day: number, age: number, id: number) => day - age * DAYS_PER_YEAR - ((id * 7) % DAYS_PER_YEAR);

/** Give someone who arrived a birth day and a family, if they have none yet. */
export function settleLineage(c: Community, s: Survivor) {
  s.born ??= bornFor(c.day, s.age, s.id);
  if (!s.family) {
    const used = new Set(c.survivors.map((x) => x.family));
    const free = FAMILY_NAMES.filter((n) => !used.has(n));
    s.family = (free.length ? free : FAMILY_NAMES)[(s.id * 11 + c.seed * 7) % (free.length || FAMILY_NAMES.length)];
  }
}

/** Work rate for age: apprentices half, the old slower. */
export const ageWork = (s: Survivor) => (s.age < APPRENTICE_AGE ? 0 : s.age < COME_OF_AGE ? 0.5 : s.age >= 68 ? 0.7 : 1);

/** Daily: ages follow the calendar, births come due, couples conceive, the very old may die. */
export function lineageDaily(col: Colony) {
  const c = col.community, day = c.day;
  for (const s of c.survivors) settleLineage(c, s);
  // Ages, and the milestones of growing up.
  for (const s of alive(c)) {
    const age = Math.floor((day - s.born!) / DAYS_PER_YEAR);
    if (age === s.age) continue;
    s.age = age;
    if (age === APPRENTICE_AGE) {
      const p = parentsOf(c, s).find((x) => x.alive && x.role !== 'rest');
      if (p) s.role = p.role;
      log(c, `${first(s)} is twelve, and has started going out with ${p ? first(p) : 'the others'} to learn the work.`, 'good');
      remember(s, day, 'Started learning the work.');
    } else if (age === COME_OF_AGE) {
      log(c, `${s.name} came of age today. There was cake, of a kind.`, 'good');
      remember(s, day, 'Came of age.');
    } else if (s.parents && age < COME_OF_AGE && age % 4 === 0) {
      log(c, `${first(s)} turned ${age}.`, 'info');
    }
  }
  // Births that are due.
  for (const s of alive(c)) {
    if (s.expecting === undefined || day < s.expecting) continue;
    s.expecting = undefined;
    const partner = s.partner !== undefined ? c.survivors.find((x) => x.id === s.partner) : undefined;
    birth(col, [s, partner].filter((x): x is Survivor => !!x), false);
  }
  // New pregnancies (and foundlings): at most one a day in the village.
  if (alive(c).length >= BIRTH_POP_CAP) return;
  const couples = alive(c).filter((s) => s.partner !== undefined && s.id < s.partner);
  for (const a of couples) {
    const b = c.survivors.find((x) => x.id === a.partner);
    if (!b || !b.alive) continue;
    const h = householdOf(col.village, a.id);
    if (!h || householdOf(col.village, b.id) !== h) continue;
    const home = homeOf(col.village, a.id);
    const kids = h.members.filter((id) => { const k = c.survivors.find((x) => x.id === id); return k && isChild(k); }).length;
    if (!home || kids >= MAX_CHILDREN || home.beds < 2) continue;
    const food = (c.resources.food + c.resources.preserves) / Math.max(1, alive(c).length);
    if (food < 4 || (a.morale + b.morale) / 2 < 45) continue;
    const carrier = [a, b].find(canCarry);
    const other = carrier === a ? b : a;
    if ([a, b].some((x) => x.expecting !== undefined)) continue;
    // Roughly one child in two years for a settled couple; fewer as the family grows.
    const chance = 0.016 / (1 + kids * 0.6);
    if (hash(day, a.id * 131 + b.id) >= chance) continue;
    if (carrier && other.id % 2 === 0) {
      carrier.expecting = day + PREGNANCY_DAYS;
      log(c, `${first(a)} and ${first(b)} are expecting a child, around day ${carrier.expecting}.`, 'good');
      remember(a, day, 'We are expecting a child.'); remember(b, day, 'We are expecting a child.');
    } else if (Math.min(a.age, b.age) < 60 && hash(day + 7, a.id + b.id) < 0.6) {
      // A child with nobody left comes out of the green, and they take them in.
      birth(col, [a, b], true);
    }
    return;
  }
}

/** A child is born (or a foundling taken in) to these parents. */
function birth(col: Colony, parents: Survivor[], foundling: boolean): Survivor | null {
  const c = col.community;
  if (!parents.length) return null;
  const [p, q] = parents;
  return withRng(c, (rng) => {
    const used = new Set(alive(c).map((s) => first(s)));
    const names = FIRST_NAMES.filter((n) => !used.has(n));
    const given = rng.pick(names.length ? names : FIRST_NAMES);
    const family = p.family ?? q?.family ?? FAMILY_NAMES[0];
    const age = foundling ? rng.int(3, 8) : 0;
    const mix = (k: keyof Survivor['stats']) => Math.max(0, Math.round(((p.stats[k] + (q ?? p).stats[k]) / 2) + rng.int(-2, 2)));
    const stats = { grit: mix('grit'), wits: mix('wits'), aim: mix('aim'), empathy: mix('empathy'), attunement: mix('attunement') };
    const inherited = [...p.traits, ...(q?.traits ?? [])];
    const traits = inherited.length && rng.chance(0.5) ? [rng.pick(inherited)] : [];
    const maxHp = 8 + stats.grit;
    const s: Survivor = {
      id: c.nextId++, name: `${given} ${family}`, background: foundling ? 'a foundling from the green' : 'born in the village',
      age, born: c.day - age * DAYS_PER_YEAR, family, parents: foundling ? undefined : parents.map((x) => x.id),
      guardians: parents.map((x) => x.id),
      traits, psi: null, stats, hp: maxHp, maxHp, morale: TUNING.moraleBaseline, role: 'rest', alive: true, diedOnDay: null,
      causeOfDeath: null, griefDays: 0, memories: [], hue: rng.int(0, 7), arrived: c.day,
      sight: Math.min(100, Math.round(((p.sight + (q ?? p).sight) / 2) * 0.6 + rng.int(0, 15))),
    };
    c.survivors.push(s);
    for (const x of parents) { adjustBond(c, s.id, x.id, 70); remember(x, c.day, foundling ? `We took in ${given}.` : `${given} was born.`); }
    // Brothers and sisters.
    for (const o of alive(c)) if (o !== s && o.guardians?.some((g) => parents.some((x) => x.id === g))) adjustBond(c, s.id, o.id, 40);
    const h = householdOf(col.village, p.id);
    if (h && !h.members.includes(s.id)) h.members.push(s.id);
    col.village.bedsDirty = true;
    log(c, foundling
      ? `A child came out of the green on their own, thin and quiet, and ${first(p)}${q ? ` and ${first(q)}` : ''} took them in. They call them ${given} ${family}.`
      : `${given} ${family} was born to ${first(p)}${q ? ` and ${first(q)}` : ''}. The whole village came to look.`, 'good');
    return s;
  });
}

/** Old age: from about seventy, a small chance each day, rising with the years. */
export function oldAge(col: Colony) {
  const c = col.community;
  for (const s of alive(c)) {
    if (s.age < 70) continue;
    const chance = (s.age - 68) * 0.0012;
    if (hash(c.day, s.id * 977) < chance) {
      log(c, `${s.name} died in their sleep, very old, at home among their own.`, 'bad');
      killSurvivor(c, s.id, 'old age');
      return;
    }
  }
}

/** Parents (or, for a foundling, those who took them in). */
export function parentsOf(c: Community, s: Survivor): Survivor[] {
  return (s.parents ?? s.guardians ?? []).map((id) => c.survivors.find((x) => x.id === id)).filter((x): x is Survivor => !!x);
}

/** Children of this person (born to or taken in). */
export function childrenOf(c: Community, s: Survivor): Survivor[] {
  return c.survivors.filter((x) => (x.parents ?? x.guardians ?? []).includes(s.id));
}

/** Everyone of a family, living and dead, and what (if anything) it is becoming known for. */
export function familyOf(c: Community, name: string): { members: Survivor[]; known: string | null } {
  const members = c.survivors.filter((s) => s.family === name);
  const living = members.filter((s) => s.alive);
  let known: string | null = null;
  if (members.length >= 3) {
    const sight = living.reduce((n, s) => n + s.sight, 0) / Math.max(1, living.length);
    const craft = living.filter((s) => (s.skills?.joinery ?? 0) >= 0.5 || (s.skills?.netmending ?? 0) >= 0.5).length;
    if (sight >= 45) known = 'known for the Sight';
    else if (craft >= 2) known = 'known for their hands: joiners and net-menders';
    else if (members.length >= 5) known = 'one of the old families of the village';
  }
  return { members, known };
}
