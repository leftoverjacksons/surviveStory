/**
 * What a survivor wears: one part per slot from the workshop's parts library
 * (lab/workshop, src/assets/people/parts/), chosen from their role, sex and
 * age, steady for a person (by id) and changing when their role does.
 * Colours come later, per survivor (characters.ts#makeCharacter).
 */
import type { Survivor } from '../sim/community';

export interface Dress {
  build: 'hero' | 'stout';
  parts: string[];
  /** A key for "looks the same": survivors dressed alike share one composed figure. */
  key: string;
}

/** A steady pseudo-random number in [0, 1) per survivor and purpose. */
const roll = (id: number, salt: number) => {
  let h = (id * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h = (h ^ (h >>> 13)) >>> 0;  // unsigned, or % goes negative
  return (h % 10000) / 10000;
};

type Pick = (salt: number, p: number) => boolean;

/** Role → clothes and kit (held tools are the game's own props, not parts). */
const ROLE: Record<string, (yes: Pick) => Record<string, string>> = {
  builder: (yes) => ({ top: 'top.shirt_rolled', vest: yes(1, 0.6) ? 'vest.waistcoat' : '', straps: yes(2, 0.5) ? 'straps.suspenders' : '', bottom: 'bottom.work', waist: 'waist.tool_belt' }),
  farmer: (yes) => ({ top: 'top.shirt_rolled', bottom: 'bottom.overalls', neck: yes(1, 0.5) ? 'neck.bandana' : '', hands: yes(2, 0.4) ? 'hands.gloves_fingerless' : '' }),
  tender: (yes) => ({ top: 'top.shirt_rolled', bottom: yes(1, 0.5) ? 'bottom.overalls' : 'bottom.work', neck: yes(2, 0.4) ? 'neck.bandana' : '', bag: yes(3, 0.4) ? 'bag.plant_sack' : '' }),
  forager: (yes) => ({ top: 'top.tunic', bottom: 'bottom.baggy', legs: 'legs.wraps', bag: 'bag.satchel', neck: yes(1, 0.4) ? 'neck.scarf' : '', waist: 'waist.belt' }),
  fisher: (yes) => ({ top: yes(1, 0.5) ? 'top.tunic' : 'top.shirt_rolled', bottom: 'bottom.work', neck: yes(2, 0.5) ? 'neck.bandana' : '', waist: 'waist.belt' }),
  maker: (yes) => ({ top: 'top.shirt_rolled', vest: yes(1, 0.5) ? 'vest.waistcoat' : '', bottom: 'bottom.work', hands: 'hands.gloves_fingerless', waist: 'waist.belt' }),
  scout: (yes) => ({ top: 'top.tunic', bottom: 'bottom.baggy', legs: 'legs.wraps', outer: 'outer.cloak', back: 'back.bedroll', straps: 'straps.chest', neck: yes(1, 0.7) ? 'neck.scarf' : '', waist: 'waist.belt' }),
  attune: (yes) => ({ top: 'top.tunic', bottom: 'bottom.baggy', outer: yes(1, 0.6) ? 'outer.cloak' : '', neck: 'neck.scarf' }),
  rest: (yes) => ({ top: yes(1, 0.5) ? 'top.tunic' : 'top.shirt_rolled', bottom: yes(2, 0.5) ? 'bottom.baggy' : 'bottom.work' }),
};

/**
 * How a figure presents (beards, hairstyles). The simulation doesn't model sex, so this is for
 * figures only: names that usually read one way (data.ts FIRST_NAMES) are drawn that way, and the
 * many that read either way follow id parity, as the earlier figures did.
 */
const FEMININE = new Set(['Ada', 'Ines', 'Nell', 'Pia', 'Tamsin', 'Vesna', 'Marisol', 'Amara']);
const MASCULINE = new Set(['Bram', 'Gus', 'Oren', 'Uri', 'Yusuf', 'Zeno', 'Dmitri', 'Tobiah']);
export const isFemale = (s: Survivor) => {
  const first = s.name.split(' ')[0];
  return FEMININE.has(first) ? true : MASCULINE.has(first) ? false : s.id % 2 === 1;
};

export function dress(s: Survivor): Dress {
  const yes: Pick = (salt, p) => roll(s.id, 100 + salt) < p;
  const female = isFemale(s);
  const elder = s.age >= 55;
  const build = (s.role === 'builder' ? yes(7, 0.5) : yes(7, 0.12)) || (elder && yes(8, 0.3)) ? 'stout' : 'hero';
  const hairs = female ? ['hair.bun', 'hair.curly', 'hair.bun'] : elder ? ['hair.swept', 'hair.swept', 'hair.curly'] : ['hair.curly', 'hair.swept'];
  const slots: Record<string, string> = {
    body: 'body.base', head: 'head.face', feet: 'feet.boots',
    hair: hairs[Math.floor(roll(s.id, 1) * hairs.length)],
    beard: !female && yes(3, elder ? 0.6 : 0.3) ? 'beard.full' : '',
    ...(ROLE[s.role] ?? ROLE.rest)(yes),
  };
  const parts = Object.values(slots).filter(Boolean).sort();
  return { build, parts, key: `${build}|${parts.join(',')}` };
}
