import { Rng } from './rng';
import {
  BACKGROUNDS, EPITHETS, FIRST_NAMES, JOBS, PSI, TRAITS,
  type JobId, type PsiId, type TraitId,
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
  name: string;
  background: string;
  age: number;
  traits: TraitId[];
  psi: PsiId | null;
  stats: Stats;
  hp: number;
  maxHp: number;
  morale: number; // 0..100
  job: JobId;
  alive: boolean;
  diedOnDay: number | null;
  causeOfDeath: string | null;
  griefDays: number; // >0 while actively mourning
  memories: Memory[];
  /** Palette index for rendering clothing. */
  hue: number;
}

export type BondKind = 'stranger' | 'friend' | 'close' | 'rival';

export interface Bond { a: number; b: number; value: number } // value -100..100

export interface Resources {
  food: number;
  water: number;
  scrap: number;
  medicine: number;
  glimmer: number; // gathered from wisps; fuels psi
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
}

// ---------- tuning ----------
export const TUNING = {
  foodPerSurvivor: 1,
  waterPerSurvivor: 1,
  baseYield: { forage: 3.2, scavenge: 1.0, attune: 0.6 },
  moraleBaseline: 60,
  moraleDriftRate: 0.08,
  starvationMorale: -8,
  starvationHp: -2,
  griefBase: 6,
  griefPerBond: 0.35,   // extra morale loss per point of positive bond
  griefDays: 5,
  communalGrief: 4,     // everyone loses this much when anyone dies
  rivalRelief: -2,      // rivals still feel a small hit: guilt, not joy
  bondDailyDrift: 1.5,
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

function adjustBond(c: Community, a: number, b: number, delta: number) {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  let bond = c.bonds.find((x) => x.a === lo && x.b === hi);
  if (!bond) {
    bond = { a: lo, b: hi, value: 0 };
    c.bonds.push(bond);
  }
  bond.value = clamp(bond.value + delta, -100, 100);
}

function traitSum(s: Survivor, pick: (t: (typeof TRAITS)[TraitId]) => number | undefined, neutral: number, combine: 'add' | 'mul') {
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
  if (c.log.length > 200) c.log.splice(0, c.log.length - 200);
}

function remember(s: Survivor, day: number, text: string) {
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
    job: 'rest',
    alive: true,
    diedOnDay: null,
    causeOfDeath: null,
    griefDays: 0,
    memories: [],
    hue: rng.int(0, 7),
  };
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
    resources: { food: 12, water: 12, scrap: 4, medicine: 2, glimmer: 0 },
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

  // Sensible default jobs.
  const jobs: JobId[] = ['forage', 'forage', 'scavenge', 'guard', 'tend', 'attune'];
  c.survivors.forEach((s, i) => { s.job = jobs[i % jobs.length]; });

  c.rngState = rng.state;
  log(c, 'The old station at the crossroads holds. The vines hold it tighter.', 'info');
  return c;
}

// ---------- daily tick ----------
function withRng<T>(c: Community, fn: (rng: Rng) => T): T {
  const rng = new Rng(c.rngState);
  const out = fn(rng);
  c.rngState = rng.state;
  return out;
}

export function advanceDay(c: Community): void {
  withRng(c, (rng) => {
    const living = alive(c);
    const r = c.resources;

    // 1. Work.
    for (const s of living) {
      if (s.hp <= s.maxHp * 0.3 && s.job !== 'rest') s.job = 'rest';
      const bonus = traitSum(s, (t) => t.jobBonus?.[s.job], 1, 'add');
      const moraleFactor = 0.6 + (s.morale / 100) * 0.6;
      switch (s.job) {
        case 'forage': {
          const y = TUNING.baseYield.forage * bonus * moraleFactor * (1 + s.stats.wits * 0.03);
          r.food += y;
          r.water += y * 0.9;
          break;
        }
        case 'scavenge': {
          const y = TUNING.baseYield.scavenge * bonus * moraleFactor * (1 + s.stats.wits * 0.08);
          r.scrap += y;
          if (rng.chance(0.2 + s.stats.wits * 0.02)) r.medicine += 1;
          if (rng.chance(0.06)) {
            s.hp -= rng.int(1, 3);
            remember(s, c.day, 'Cut myself on rebar in the old pharmacy.');
            log(c, `${s.name} came back from the ruins bleeding.`, 'bad');
          }
          break;
        }
        case 'attune': {
          r.glimmer += TUNING.baseYield.attune * bonus * (1 + s.stats.attunement * 0.25);
          if (rng.chance(0.04 + s.stats.attunement * 0.01)) {
            log(c, `${s.name} says the wisps spelled something tonight. They won't say what.`, 'strange');
            remember(s, c.day, 'The wisps spelled something.');
          }
          break;
        }
        case 'tend': {
          // Tenders lift everyone a little.
          for (const o of living) if (o !== s) o.morale += 0.4 * bonus * (1 + s.stats.empathy * 0.1);
          break;
        }
        case 'rest':
          s.morale += 2; // healing happens after meals, and only if fed
          break;
        case 'guard':
          break;
      }
      if (r.medicine > 0 && s.hp < s.maxHp * 0.5) {
        r.medicine -= 1;
        s.hp = Math.min(s.maxHp, s.hp + 4);
      }
    }

    // 2. Consumption.
    const needFood = living.length * TUNING.foodPerSurvivor;
    const needWater = living.length * TUNING.waterPerSurvivor;
    const hungry = r.food < needFood || r.water < needWater;
    r.food = Math.max(0, r.food - needFood);
    r.water = Math.max(0, r.water - needWater);
    if (hungry) {
      log(c, 'Not enough to go around. Portions were cut.', 'bad');
      for (const s of living) {
        s.morale += TUNING.starvationMorale;
        s.hp += TUNING.starvationHp;
      }
    } else {
      for (const s of living) if (s.job === 'rest') s.hp = Math.min(s.maxHp, s.hp + 2);
    }

    // 3. Bonds drift: people who share work grow closer; everyone drifts a bit.
    for (let i = 0; i < living.length; i++) {
      for (let j = i + 1; j < living.length; j++) {
        const a = living[i], b = living[j];
        const rate = traitSum(a, (t) => t.bondRate, 1, 'mul') * traitSum(b, (t) => t.bondRate, 1, 'mul');
        let delta = rng.range(-0.5, 1) * TUNING.bondDailyDrift * rate;
        if (a.job === b.job) delta += 1.2 * rate;
        adjustBond(c, a.id, b.id, delta);
      }
    }

    // 4. Morale: drift toward baseline, friends near you help, grief decays.
    for (const s of living) {
      const baseline = TUNING.moraleBaseline + traitSum(s, (t) => t.moraleBaseline, 0, 'add');
      let friendLift = 0;
      for (const o of living) if (o !== s && bondValue(c, s.id, o.id) >= 20) friendLift += 0.5;
      const target = baseline + Math.min(friendLift, 6) - (s.griefDays > 0 ? 15 : 0);
      s.morale += (target - s.morale) * TUNING.moraleDriftRate;
      if (s.griefDays > 0) s.griefDays--;
      s.morale = clamp(s.morale, 0, 100);
    }

    // 5. Deaths from neglect.
    for (const s of living) {
      if (s.hp <= 0) killSurvivor(c, s.id, 'wasted away');
    }

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
    s.job = 'rest';
    for (const o of alive(c)) adjustBond(c, s.id, o.id, rng.int(-5, 10));
    c.survivors.push(s);
    log(c, `${s.name}, ${s.background}, walked out of the green and asked to stay.`, 'good');
    return s;
  });
}

export function setJob(c: Community, id: number, job: JobId) {
  const s = c.survivors.find((x) => x.id === id);
  if (s && s.alive && job in JOBS) s.job = job;
}
