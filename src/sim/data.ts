/** Static content tables. Kept as plain data so content can grow without code changes. */

export type TraitId =
  | 'stoic' | 'tender' | 'green_thumb' | 'tinkerer' | 'orb_touched'
  | 'night_owl' | 'brave' | 'skittish' | 'hoarder' | 'storyteller';

export interface TraitDef {
  id: TraitId;
  name: string;
  blurb: string;
  griefMult?: number;       // scales morale loss when a bonded survivor dies
  bondRate?: number;        // scales daily bond drift
  jobBonus?: Partial<Record<JobId, number>>;
  attunement?: number;      // flat attunement bonus
  moraleBaseline?: number;  // shifts resting morale
}

export const TRAITS: Record<TraitId, TraitDef> = {
  stoic:       { id: 'stoic', name: 'Stoic', blurb: 'Grief lands softer, but so does joy.', griefMult: 0.5, bondRate: 0.7 },
  tender:      { id: 'tender', name: 'Tender', blurb: 'Loves quickly. Mourns hard.', griefMult: 1.6, bondRate: 1.5 },
  green_thumb: { id: 'green_thumb', name: 'Green Thumb', blurb: 'The overgrowth yields to them.', jobBonus: { forage: 0.5 } },
  tinkerer:    { id: 'tinkerer', name: 'Tinkerer', blurb: 'Sees parts where others see junk.', jobBonus: { scavenge: 0.5 } },
  orb_touched: { id: 'orb_touched', name: 'Orb-Touched', blurb: 'Something followed them home once.', attunement: 3, bondRate: 0.6 },
  night_owl:   { id: 'night_owl', name: 'Night Owl', blurb: 'Most awake when the wisps are.', jobBonus: { guard: 0.4 } },
  brave:       { id: 'brave', name: 'Brave', blurb: 'First through the door.', moraleBaseline: 5 },
  skittish:    { id: 'skittish', name: 'Skittish', blurb: 'Hears every branch snap.', moraleBaseline: -6, jobBonus: { guard: 0.2 } },
  hoarder:     { id: 'hoarder', name: 'Hoarder', blurb: 'Nothing is truly useless.', jobBonus: { scavenge: 0.25 }, bondRate: 0.8 },
  storyteller: { id: 'storyteller', name: 'Storyteller', blurb: 'Keeps the fire and the names alive.', jobBonus: { tend: 0.5 }, bondRate: 1.2 },
};

export type PsiId = 'lumen' | 'farsight' | 'push' | 'hush' | 'echo';

export interface PsiDef { id: PsiId; name: string; blurb: string }

export const PSI: Record<PsiId, PsiDef> = {
  lumen:    { id: 'lumen', name: 'Lumen', blurb: 'Calls a small, warm light that closes wounds.' },
  farsight: { id: 'farsight', name: 'Farsight', blurb: 'Sees through the eyes of birds, briefly.' },
  push:     { id: 'push', name: 'Push', blurb: 'A shove from nowhere.' },
  hush:     { id: 'hush', name: 'Hush', blurb: 'Quiets panic in a room — or in an enemy.' },
  echo:     { id: 'echo', name: 'Echo', blurb: 'Reads the last memory left in an object.' },
};

export type JobId = 'forage' | 'scavenge' | 'guard' | 'tend' | 'attune' | 'rest';

export const JOBS: Record<JobId, { name: string; blurb: string }> = {
  forage:   { name: 'Forage', blurb: 'Food and water from the green.' },
  scavenge: { name: 'Scavenge', blurb: 'Scrap and medicine from the ruins.' },
  guard:    { name: 'Guard', blurb: 'Watch the treeline.' },
  tend:     { name: 'Tend', blurb: 'Keep the fire, the sick, the spirits.' },
  attune:   { name: 'Attune', blurb: 'Sit with the wisps. Gather glimmer.' },
  rest:     { name: 'Rest', blurb: 'Recover body and mind.' },
};

export const FIRST_NAMES = [
  'Ada', 'Bram', 'Cass', 'Dell', 'Eun', 'Fen', 'Gus', 'Hollis', 'Ines', 'Jory',
  'Kit', 'Lark', 'Mako', 'Nell', 'Oren', 'Pia', 'Quill', 'Rue', 'Sol', 'Tamsin',
  'Uri', 'Vesna', 'Wren', 'Yusuf', 'Zeno', 'Marisol', 'Dmitri', 'Amara', 'Tobiah', 'Lio',
];

export const EPITHETS = [
  'the Quiet', 'Two-Coats', 'of the Pumps', 'Lantern', 'Half-Deaf', 'the Mender',
  'Crowfoot', 'the Late', 'Moss', 'Sparks', 'Longwalk', 'the Listener',
];

export const BACKGROUNDS = [
  'former line cook', 'former EMT', 'former radio host', 'former lineworker',
  'former schoolteacher', 'former sky-watcher forum mod', 'former long-haul trucker',
  'former park ranger', 'former data-center tech', 'born after the Quiet',
];
