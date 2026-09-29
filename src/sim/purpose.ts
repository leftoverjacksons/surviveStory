/**
 * Purpose: what people know, and what they hope for.
 *
 * Know-how replaces "eras". Everything is salvage at first; what changes is
 * what people learn to do with it. Joinery (squaring and jointing timber) is
 * learned by building, faster beside someone who already knows it, and is
 * lost if everyone who knows it dies or leaves. Someone who was a carpenter
 * before the Quiet arrives knowing it.
 *
 * Aspirations give each person something to want beyond their needs: a home,
 * someone to share it with, a craft, a garden, the country beyond the mist, a
 * true meeting with the other side, everyone at one table. People pursue them
 * in their free time; fulfilling one is a lasting joy.
 */
import type { Colony } from './colony';
import { alive, log, remember, withRng, type Community, type Survivor } from './community';
import { hallOf, hasBuilt } from './buildings';
import { householdOf, plotOf } from './homes';
import type { Rng } from './rng';
import { exploredFraction } from './world';

// ---------- know-how ----------

export type Craft = 'joinery' | 'netmending' | 'wiring';
export const SKILLED = 0.5;

export const skill = (s: Survivor, c: Craft) => s.skills?.[c] ?? 0;
export const knows = (s: Survivor, c: Craft) => skill(s, c) >= SKILLED;
export const knowers = (com: Community, c: Craft) => alive(com).filter((s) => knows(s, c));

/** Add practice. Returns true if this pushed them over into knowing the craft. */
export function learn(s: Survivor, c: Craft, amount: number): boolean {
  s.skills ??= {};
  const before = s.skills[c] ?? 0;
  s.skills[c] = Math.min(1, before + amount);
  return before < SKILLED && s.skills[c]! >= SKILLED;
}

const first = (s: Survivor) => s.name.split(' ')[0];
const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** Daily: whether the village can build in timber depends on who knows how. */
export function knowhowDaily(col: Colony) {
  const v = col.village, c = col.community;
  const joiners = knowers(c, 'joinery');
  const tier = joiners.length && hasBuilt(v, 'workshop') ? 1 : 0;
  if (v.tier === 0 && tier === 1) {
    log(c, `With ${list(joiners.map(first))} able to square and joint timber, and a bench to do it at, new buildings will be framed properly. The old shacks will be rebuilt in time.`, 'good');
  } else if (v.tier === 1 && tier === 0) {
    log(c, 'Nobody left knows how to joint timber. Until someone learns, they\'ll build with salvage.', 'bad');
  }
  v.tier = tier;
}

// ---------- aspirations ----------

export type AspirationKind = 'home' | 'kin' | 'craft' | 'garden' | 'explore' | 'veil' | 'feast';

export interface Aspiration {
  kind: AspirationKind;
  since: number;
  /** Explore: how much of the map was known when they set their heart on it. */
  base?: number;
}

export const ASPIRATIONS: Record<AspirationKind, { want: string; done: string }> = {
  home: { want: 'a home of their own', done: 'has a home of their own at last' },
  kin: { want: 'someone to share a home with', done: 'has found someone to make a home with' },
  craft: { want: 'to learn joinery', done: 'has learned to joint timber, and can\'t stop running their hands over it' },
  garden: { want: 'to grow a proper garden', done: 'stood in their own garden this morning and just looked at it' },
  explore: { want: 'to see what lies beyond the mist', done: 'has seen the country past the mist, and came back full of it' },
  veil: { want: 'to truly meet the other side', done: 'has met something from the other side of the Veil, and been met' },
  feast: { want: 'to see everyone at one table', done: 'got their wish: everyone, at one table, for one night' },
};

function fulfilled(col: Colony, s: Survivor, a: Aspiration): boolean {
  const v = col.village;
  const h = householdOf(v, s.id);
  switch (a.kind) {
    case 'home': return !!h?.home;
    case 'kin': return !!h && h.members.length >= 2;
    case 'craft': return knows(s, 'joinery');
    case 'garden': {
      const plot = h ? plotOf(v, h) : undefined;
      const beds = plot?.yard.find((y) => y.kind === 'beds');
      return !!beds && beds.progress >= 1 && beds.growth >= 0.7;
    }
    case 'explore': return exploredFraction(col.world) >= (a.base ?? 0) + 0.1;
    case 'veil': return (s.metEntity ?? -1) >= a.since;
    case 'feast': return col.council.festivalUntil > (a.since - 1) * 1440 || !!hallOf(v);
  }
}

/** What someone might set their heart on, weighted by who they are. */
function candidates(col: Colony, s: Survivor): [AspirationKind, number][] {
  const v = col.village;
  const h = householdOf(v, s.id);
  const has = (t: string) => s.traits.includes(t as never);
  const out: [AspirationKind, number][] = [];
  if (!h) out.push(['kin', has('tender') || has('storyteller') ? 3 : 1.5], ['home', 1]);
  else if (!h.home) out.push(['home', 3]);
  if (!knows(s, 'joinery')) out.push(['craft', (has('tinkerer') ? 3 : 0) + (s.role === 'builder' ? 1.5 : 0.3)]);
  if (h?.home) out.push(['garden', (has('green_thumb') ? 3 : 0.6) + (s.role === 'farmer' || s.role === 'forager' ? 1 : 0)]);
  out.push(['explore', (s.role === 'scout' ? 2.5 : 0.3) + (has('brave') ? 1 : 0) + (has('night_owl') ? 0.5 : 0)]);
  out.push(['veil', (has('orb_touched') ? 2.5 : 0) + (s.role === 'attune' ? 2 : 0) + s.sight / 30]);
  out.push(['feast', (has('storyteller') ? 2.5 : 0.3) + (s.role === 'tender' ? 1 : 0)]);
  return out.filter(([k, w]) => w > 0 && !fulfilled(col, s, { kind: k, since: col.community.day, base: exploredFraction(col.world) }));
}

function choose(col: Colony, s: Survivor, rng: Rng): Aspiration | undefined {
  const cands = candidates(col, s);
  const total = cands.reduce((n, [, w]) => n + w, 0);
  if (total <= 0) return undefined;
  let r = rng.next() * total;
  for (const [kind, w] of cands) {
    r -= w;
    if (r <= 0) return { kind, since: col.community.day, base: kind === 'explore' ? exploredFraction(col.world) : undefined };
  }
  return undefined;
}

/** Daily: hopes fulfilled, and new ones taken up after a pause. */
export function aspirationsDaily(col: Colony) {
  const c = col.community;
  withRng(c, (rng) => {
    for (const s of alive(c)) {
      const a = s.aspiration;
      if (a && fulfilled(col, s, a)) {
        s.morale = Math.min(100, s.morale + 12);
        const waited = c.day - a.since;
        log(c, `${first(s)} ${ASPIRATIONS[a.kind].done}.${waited >= 6 ? ` They've wanted it for ${waited} days.` : ''}`, 'good');
        remember(s, c.day, `Got my wish: ${ASPIRATIONS[a.kind].want}.`);
        s.aspiration = undefined;
        s.hopeAgain = c.day + 5 + rng.int(0, 6);
        continue;
      }
      if (!a && c.day >= (s.hopeAgain ?? 2)) s.aspiration = choose(col, s, rng);
    }
  });
}
