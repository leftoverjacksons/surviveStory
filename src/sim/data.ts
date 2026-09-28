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
  roleBonus?: Partial<Record<RoleId, number>>; // added to work speed
  attunement?: number;      // flat attunement bonus
  moraleBaseline?: number;  // shifts resting morale
}

export const TRAITS: Record<TraitId, TraitDef> = {
  stoic:       { id: 'stoic', name: 'Stoic', blurb: 'Grief lands softer, but so does joy.', griefMult: 0.5, bondRate: 0.7, roleBonus: { fisher: 0.3 } },
  tender:      { id: 'tender', name: 'Tender', blurb: 'Loves quickly. Mourns hard.', griefMult: 1.6, bondRate: 1.5 },
  green_thumb: { id: 'green_thumb', name: 'Green Thumb', blurb: 'The overgrowth yields to them.', roleBonus: { forager: 0.5, farmer: 0.5 } },
  tinkerer:    { id: 'tinkerer', name: 'Tinkerer', blurb: 'Sees parts where others see junk.', roleBonus: { builder: 0.5 } },
  orb_touched: { id: 'orb_touched', name: 'Orb-Touched', blurb: 'Something followed them home once.', attunement: 3, bondRate: 0.6, roleBonus: { attune: 0.5 } },
  night_owl:   { id: 'night_owl', name: 'Night Owl', blurb: 'Most awake when the wisps are.', roleBonus: { scout: 0.4 } },
  brave:       { id: 'brave', name: 'Brave', blurb: 'First through the door.', moraleBaseline: 5 },
  skittish:    { id: 'skittish', name: 'Skittish', blurb: 'Hears every branch snap.', moraleBaseline: -6, roleBonus: { scout: 0.2 } },
  hoarder:     { id: 'hoarder', name: 'Hoarder', blurb: 'Nothing is truly useless.', roleBonus: { builder: 0.25 }, bondRate: 0.8 },
  storyteller: { id: 'storyteller', name: 'Storyteller', blurb: 'Keeps the fire and the names alive.', roleBonus: { tender: 0.5 }, bondRate: 1.2 },
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

export type RoleId = 'builder' | 'farmer' | 'forager' | 'fisher' | 'maker' | 'scout' | 'tender' | 'attune' | 'rest';

export const ROLES: Record<RoleId, { name: string; blurb: string }> = {
  builder: { name: 'Builder', blurb: 'Fells trees and hauls what the village needs.' },
  farmer:  { name: 'Farmer', blurb: 'Tills, sows, tends and harvests the fields you mark.' },
  forager: { name: 'Forager', blurb: 'Gathers berries and greens from the overgrowth.' },
  fisher:  { name: 'Fisher', blurb: 'Works the fishing grounds you mark: jetty, nets and boat.' },
  maker:   { name: 'Maker', blurb: 'Works the trades: tools at the bench, clothes from salvaged cloth, fish and meat put up in the smoke shed.' },
  scout:   { name: 'Scout', blurb: 'Walks the edge of the known map and pushes it back.' },
  tender:  { name: 'Tender', blurb: 'Keeps the fire and keeps people company.' },
  attune:  { name: 'Attuner', blurb: 'Sits with the wisps at the ring. Gathers glimmer.' },
  rest:    { name: 'Resting', blurb: 'Stays close to camp and recovers.' },
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
  'former carpenter', 'former deckhand',
];

/** Trades from before the Quiet that come with know-how (0..1; 0.5 = can do it). */
export const TRADE_SKILLS: Record<string, { joinery?: number; netmending?: number }> = {
  'former carpenter': { joinery: 0.7 },
  'former deckhand': { netmending: 0.7 },
  'former cabinetmaker': { joinery: 0.6 },
};
