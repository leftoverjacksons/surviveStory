import { Rng } from './rng';
import type { Aspiration } from './purpose';
import {
  BACKGROUNDS, EPITHETS, FIRST_NAMES, PSI, ROLES, TRADE_SKILLS, TRAITS,
  type PsiId, type RoleId, type TraitId,
} from './data';

export interface Stats {
  grit: number;       // toughness, carry, resisting injury
  wits: number;       // scavenging, tech, tactics
  aim: number;        // ranged accuracy
  empathy: number;    // bonds, tending, calming others
  attunement: number; // psi strength, sensitivity to the strange
}

export interface Memory { day: number; text: string }

export interface Survivor {
  id: number;
  /** Day the player last chose this person's work; the village leaves that choice alone for a season. */
  roleSetDay?: number;
  name: string;
  background: string;
  age: number;
  traits: TraitId[];
  psi: PsiId | null;
  stats: Stats;
  hp: number;
  maxHp: number;
  morale: number; // 0..100
  role: RoleId;
  alive: boolean;
  diedOnDay: number | null;
  /** Left the village (alive, elsewhere) rather than died. */
  departed?: boolean;
  /** Taken into the Veil: gone for now, not dead, and expected back (see haunt.ts). */
  taken?: boolean;
  causeOfDeath: string | null;
  griefDays: number; // >0 while actively mourning
  memories: Memory[];
  /** Palette index for rendering clothing. */
  hue: number;
  /** 0..100: how much of the hidden layer they perceive. */
  sight: number;
  /** Day they joined the village. */
  arrived?: number;
  /** Know-how, 0..1 per craft (0.5 = can do it). */
  skills?: { joinery?: number; netmending?: number };
  /** What they hope for, and when they'll set their heart on something new. */
  aspiration?: Aspiration;
  hopeAgain?: number;
  /** Last day they truly met something from the other side. */
  metEntity?: number;
}

export type BondKind = 'stranger' | 'friend' | 'close' | 'rival';

export interface Bond { a: number; b: number; value: number } // value -100..100

export interface Resources {
  food: number;
  wood: number;
  scrap: number;
  medicine: number;
  glimmer: number; // gathered from wisps; fuels psi
  /** Salvaged fabric: curtains, seat covers, sheets. The tailor makes it into clothes. */
  cloth: number;
  /** Made goods (DESIGN §21.6): tools speed work, clothes keep out the cold, preserves keep. */
  tools: number;
  clothes: number;
  preserves: number;
  /** Rare salvage from cleared districts (DESIGN §21.7). */
  glass: number;
  copper: number;
  steel: number;
}

export interface LogEntry { day: number; text: string; tone: 'info' | 'good' | 'bad' | 'strange' }

export interface Community {
  seed: number;
  rngState: number;
  day: number;
  nextId: number;
  survivors: Survivor[];
  bonds: Bond[];
  resources: Resources;
  log: LogEntry[];
  /** Log entries ever written (the log itself keeps the last 200); the chronicle reads new ones by it. */
  logCount?: number;
}

// ---------- tuning ----------
export const TUNING = {
  moraleBaseline: 60,
  griefBase: 6,
  griefPerBond: 0.35,   // extra morale loss per point of positive bond
  griefDays: 5,
  communalGrief: 4,     // everyone loses this much when anyone dies
  rivalRelief: -2,      // rivals still feel a small hit: guilt, not joy
  bondDailyDrift: 1.0,
} as const;

// ---------- helpers ----------
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const bondKey = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function getBond(c: Community, a: number, b: number): Bond | undefined {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return c.bonds.find((x) => x.a === lo && x.b === hi);
}

export function bondValue(c: Community, a: number, b: number): number {
  return getBond(c, a, b)?.value ?? 0;
}

export function bondKind(value: number): BondKind {
  if (value >= 60) return 'close';
  if (value >= 20) return 'friend';
  if (value <= -30) return 'rival';
  return 'stranger';
}

export function adjustBond(c: Community, a: number, b: number, delta: number) {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  let bond = c.bonds.find((x) => x.a === lo && x.b === hi);
  if (!bond) {
    bond = { a: lo, b: hi, value: 0 };
    c.bonds.push(bond);
  }
  bond.value = clamp(bond.value + delta, -100, 100);
}

export function traitSum(s: Survivor, pick: (t: (typeof TRAITS)[TraitId]) => number | undefined, neutral: number, combine: 'add' | 'mul') {
  let acc = neutral;
  for (const id of s.traits) {
    const v = pick(TRAITS[id]);
    if (v === undefined) continue;
    acc = combine === 'add' ? acc + v : acc * v;
  }
  return acc;
}

export const alive = (c: Community) => c.survivors.filter((s) => s.alive);

export function communityMorale(c: Community): number {
  const living = alive(c);
  if (living.length === 0) return 0;
  return living.reduce((sum, s) => sum + s.morale, 0) / living.length;
}

export function log(c: Community, text: string, tone: LogEntry['tone'] = 'info') {
  c.log.push({ day: c.day, text, tone });
  c.logCount = (c.logCount ?? 0) + 1;
  if (c.log.length > 200) c.log.splice(0, c.log.length - 200);
}

export function remember(s: Survivor, day: number, text: string) {
  s.memories.push({ day, text });
  if (s.memories.length > 40) s.memories.shift();
}

// ---------- creation ----------
export function createSurvivor(c: Community, rng: Rng): Survivor {
  const usedNames = new Set(c.survivors.map((s) => s.name.split(' ')[0]));
  const available = FIRST_NAMES.filter((n) => !usedNames.has(n));
  const first = rng.pick(available.length ? available : FIRST_NAMES);
  const name = rng.chance(0.45) ? `${first} ${rng.pick(EPITHETS)}` : first;

  const traitPool = rng.shuffle(Object.keys(TRAITS) as TraitId[]);
  const traits = traitPool.slice(0, rng.int(1, 2));

  const stats: Stats = {
    grit: rng.int(2, 7),
    wits: rng.int(2, 7),
    aim: rng.int(2, 7),
    empathy: rng.int(2, 7),
    attunement: rng.int(0, 4),
  };
  const s0 = { traits } as Survivor;
  stats.attunement += traitSum(s0, (t) => t.attunement, 0, 'add');

  // Psi is rare and tied to attunement.
  const psi: PsiId | null = rng.chance(0.12 + stats.attunement * 0.06)
    ? rng.pick(Object.keys(PSI) as PsiId[])
    : null;

  const maxHp = 8 + stats.grit;
  const s: Survivor = {
    id: c.nextId++,
    name,
    background: rng.pick(BACKGROUNDS),
    age: rng.int(16, 64),
    traits,
    psi,
    stats,
    hp: maxHp,
    maxHp,
    morale: TUNING.moraleBaseline + rng.int(-10, 10),
    role: 'rest',
    alive: true,
    diedOnDay: null,
    causeOfDeath: null,
    griefDays: 0,
    memories: [],
    hue: rng.int(0, 7),
    arrived: c.day,
    sight: Math.min(100, stats.attunement * 7 + (traits.includes('orb_touched') ? 15 : 0) + (psi ? 10 : 0) + rng.int(0, 12)),
  };
  const trade = TRADE_SKILLS[s.background];
  if (trade) s.skills = { ...trade };
  return s;
}

export function createCommunity(seed: number, size = 5): Community {
  const rng = new Rng(seed);
  const c: Community = {
    seed,
    rngState: 0,
    day: 1,
    nextId: 1,
    survivors: [],
    bonds: [],
    resources: { food: 40, wood: 16, scrap: 4, medicine: 2, glimmer: 0, cloth: 2, tools: 2, clothes: 3, preserves: 0, glass: 0, copper: 0, steel: 0 },
    log: [],
  };
  for (let i = 0; i < size; i++) c.survivors.push(createSurvivor(c, rng));

  // Seed a few pre-existing relationships: they didn't meet yesterday.
  const ids = c.survivors.map((s) => s.id);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const roll = rng.next();
      const v = roll < 0.15 ? rng.int(60, 85) : roll < 0.5 ? rng.int(15, 45) : roll < 0.62 ? rng.int(-50, -30) : rng.int(-10, 10);
      adjustBond(c, ids[i], ids[j], v);
    }
  }

  // Sensible default roles.
  const roles: RoleId[] = ['builder', 'farmer', 'forager', 'scout', 'attune', 'builder', 'tender'];
  c.survivors.forEach((s, i) => { s.role = roles[i % roles.length]; });

  c.rngState = rng.state;
  log(c, 'The old station at the crossroads holds. The vines hold it tighter.', 'info');
  return c;
}

// ---------- daily rollover ----------
export function withRng<T>(c: Community, fn: (rng: Rng) => T): T {
  const rng = new Rng(c.rngState);
  const out = fn(rng);
  c.rngState = rng.state;
  return out;
}

/** Slow background changes applied once per in-game day. */
export function dailyRollover(c: Community): void {
  withRng(c, (rng) => {
    const living = alive(c);
    for (let i = 0; i < living.length; i++) {
      for (let j = i + 1; j < living.length; j++) {
        const a = living[i], b = living[j];
        const rate = traitSum(a, (t) => t.bondRate, 1, 'mul') * traitSum(b, (t) => t.bondRate, 1, 'mul');
        let delta = rng.range(-0.6, 0.8) * TUNING.bondDailyDrift * rate;
        if (a.role === b.role) delta += 0.8 * rate;
        adjustBond(c, a.id, b.id, delta);
      }
    }
    for (const s of living) if (s.griefDays > 0) s.griefDays--;
    c.day++;
  });
}

// ---------- death ----------
export interface GriefReport { survivorId: number; moraleLoss: number; bond: number }

/**
 * Permanent death. Grief propagates along relationship bonds: a death hurts
 * in proportion to how connected the dead survivor was.
 */
export function killSurvivor(c: Community, id: number, cause: string): GriefReport[] {
  const dead = c.survivors.find((s) => s.id === id);
  if (!dead || !dead.alive) return [];
  dead.alive = false;
  dead.diedOnDay = c.day;
  dead.causeOfDeath = cause;
  log(c, `${dead.name} is gone (${cause}). Their name is carved into the pump island.`, 'bad');

  const reports: GriefReport[] = [];
  for (const s of alive(c)) {
    const bond = bondValue(c, s.id, dead.id);
    const griefMult = traitSum(s, (t) => t.griefMult, 1, 'mul');
    let loss = TUNING.communalGrief;
    if (bond > 0) loss += (TUNING.griefBase + bond * TUNING.griefPerBond) * griefMult;
    else if (bond <= -30) loss += -TUNING.rivalRelief;

    s.morale = clamp(s.morale - loss, 0, 100);
    if (bond >= 20) {
      s.griefDays = Math.max(s.griefDays, Math.round(TUNING.griefDays * griefMult * (bond / 50)));
      remember(s, c.day, `Lost ${dead.name}.`);
      if (bond >= 60) log(c, `${s.name} sits by the pumps and does not speak.`, 'bad');
    } else if (bond <= -30) {
      remember(s, c.day, `${dead.name} and I never made it right.`);
    }
    reports.push({ survivorId: s.id, moraleLoss: loss, bond });
  }
  return reports;
}

export function recruit(c: Community): Survivor {
  return withRng(c, (rng) => {
    const s = createSurvivor(c, rng);
    s.role = 'rest';
    for (const o of alive(c)) adjustBond(c, s.id, o.id, rng.int(-5, 10));
    c.survivors.push(s);
    log(c, `${s.name}, ${s.background}, walked out of the green and asked to stay.`, 'good');
    return s;
  });
}

export function setRole(c: Community, id: number, role: RoleId) {
  const s = c.survivors.find((x) => x.id === id);
  if (s && s.alive && role in ROLES) { s.role = role; s.roleSetDay = c.day; }
}
