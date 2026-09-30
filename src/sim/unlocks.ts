/**
 * What the build menu offers, and when (DESIGN §32). Not a tech tree of eras:
 * each thing appears because something has happened in the world, such as a
 * craft learned, a material found, a need felt or a district cleared.
 *
 * Each entry is in one of three states:
 * - hidden: nothing in the world points to it yet;
 * - glimpsed: one step away, shown greyed with the step in the villagers'
 *   words;
 * - open: it can be built (costs are gathered as usual).
 *
 * The first time something opens, the log says so and the menu marks it new
 * until the menu has been opened once after (`Village.unlocked`, `seen`).
 */
import type { Colony } from './colony';
import { log } from './community';
import { hallOf, hasBuilt, store, type SiteKind } from './buildings';
import { knowers } from './purpose';
import { homeResonance } from './veil';

export type UnlockState = 'hidden' | 'glimpsed' | 'open';
export interface Unlock { state: UnlockState; why?: string }

/** The menu's sections, in order. */
export const SECTIONS = ['Shelter and home', 'Food and stores', 'Crafts', 'Power', 'Common life', 'The old world'] as const;
export type Section = typeof SECTIONS[number];

/** Menu entries that are tools, not buildings. */
export type MenuTool = 'plot' | 'restore' | 'salvage';
export type MenuKind = SiteKind | MenuTool;

/** Every menu entry, in the order it is listed within its section. */
export const MENU: { kind: MenuKind; section: Section }[] = [
  { kind: 'plot', section: 'Shelter and home' }, { kind: 'hut', section: 'Shelter and home' }, { kind: 'hearth', section: 'Shelter and home' },
  { kind: 'garden', section: 'Food and stores' }, { kind: 'cellar', section: 'Food and stores' }, { kind: 'smokehouse', section: 'Food and stores' }, { kind: 'dome', section: 'Food and stores' },
  { kind: 'workshop', section: 'Crafts' }, { kind: 'toolshop', section: 'Crafts' }, { kind: 'tailor', section: 'Crafts' }, { kind: 'sawpit', section: 'Crafts' },
  { kind: 'lantern', section: 'Power' }, { kind: 'windmill', section: 'Power' }, { kind: 'solar', section: 'Power' }, { kind: 'turbine', section: 'Power' },
  { kind: 'shrine', section: 'Common life' }, { kind: 'tavern', section: 'Common life' }, { kind: 'hall', section: 'Common life' },
  { kind: 'salvage', section: 'The old world' }, { kind: 'restore', section: 'The old world' },
];

const open = (): Unlock => ({ state: 'open' });
const glimpse = (why: string): Unlock => ({ state: 'glimpsed', why });
const hidden = (): Unlock => ({ state: 'hidden' });

/** The rule for one entry, read from the world as it is now. */
export function unlockOf(col: Colony, kind: MenuKind): Unlock {
  const v = col.village, com = col.community, res = com.resources;
  const tier = v.needTier ?? 0;
  const cleared = col.haunts.some((h) => h.state === 'cleared');
  const ours = col.haunts.some((h) => h.state === 'cleared' && (h.owner === 'village' || h.owner === 'shared'));
  const homed = v.households.some((h) => h.home);
  const joiners = knowers(com, 'joinery').length > 0;
  const wiring = knowers(com, 'wiring').length > 0;
  const rareSeen = res.glass + res.copper + res.steel > 0 || Object.keys(v.salvaged).some((k) => /glass|copper|steel/.test(k)) || cleared;
  switch (kind) {
    case 'plot': case 'hut': case 'garden': case 'cellar': case 'workshop': case 'lantern':
      return open();
    case 'shrine': {
      const seer = com.survivors.some((s) => s.alive && s.sight >= 30);
      return seer || homeResonance(col) < 0.5 || hasBuilt(v, 'shrine') ? open() : glimpse('Nobody has felt the need yet: it comes when the land feels tired, or someone sees more than the rest.');
    }
    case 'toolshop': case 'tailor': case 'smokehouse':
      if (tier < 1) return hidden();
      return homed ? open() : glimpse('It goes at the back of a household\'s yard: someone needs a home first.');
    case 'tavern':
      if (tier < 1) return hidden();
      return tier >= 2 ? open() : glimpse('When tools, clothes, food that keeps and homes are sorted, people will want somewhere to go of an evening.');
    case 'sawpit': case 'windmill':
      if (!hasBuilt(v, 'workshop')) return hidden();
      return joiners ? open() : glimpse('Nobody knows joinery yet: it is learned at the workbench.');
    case 'solar': case 'turbine':
      if (!rareSeen) return hidden();
      return wiring ? open() : glimpse('Nobody knows wiring yet: it is learned by stripping copper, steel and glass out of the old world.');
    case 'dome':
      if (!cleared) return hidden();
      return res.glass > 0 && res.steel > 0 ? open() : glimpse('Needs glass and steel, stripped out of a cleared district.');
    case 'hearth':
      return ours ? open() : cleared ? glimpse('For a district the village has taken: decide who a cleared district belongs to.') : hidden();
    case 'hall': {
      if (v.buildings.some((b) => b.kind === 'hall')) return hidden();
      const st = store(v);
      if (st?.gone) return open();
      return hallOf(v) ? hidden() : st && st.level >= 2 ? glimpse(`Or make ${v.site.shelterName} the hall (from its card), once most people have homes.`) : hidden();
    }
    case 'restore': case 'salvage':
      if (kind === 'salvage') return open(); // wrecks and heaps are there from the start
      return cleared ? open() : glimpse('Clear a district of the old world first: then its buildings can be patched up and used.');
    default:
      return hidden();
  }
}

/** Every menu entry that has opened since the last check: logged once each, and marked new in the menu. */
export function unlocksDaily(col: Colony) {
  const v = col.village;
  const known = new Set(v.unlocked ?? []);
  const first = !v.unlocked;
  for (const { kind: k } of MENU) {
    if (known.has(k) || unlockOf(col, k).state !== 'open') continue;
    known.add(k);
    // The first check (a new or an older saved village) just records what's already open.
    if (!first) {
      (v.fresh ??= []).push(k);
      const line = NEWS[k];
      if (line) log(col.community, line, 'good');
    }
  }
  v.unlocked = [...known];
}

/** The menu was looked at: nothing is new any more. */
export function seenUnlocks(col: Colony) { col.village.fresh = []; }

const NEWS: Partial<Record<MenuKind, string>> = {
  shrine: 'Someone said the land felt tired, and talked of a place where it could rest. (Build: shrine.)',
  toolshop: 'With a home and a yard behind it, a household could keep a trade out the back. (Build: tool bench, sewing room, smoke shed.)',
  tavern: 'The talk at the fire has turned to having somewhere to go of an evening. (Build: tavern.)',
  sawpit: 'Joinery has taken: they could dig a saw pit, or raise a windmill. (Build: Crafts, Power.)',
  solar: 'Someone has worked out how the old wiring goes: panels and turbines are possible now. (Build: Power.)',
  dome: 'With glass and steel from the old world, they could raise a glass dome. (Build: Food and stores.)',
  hearth: 'A district is the village\'s now: a fire of its own would make it a hamlet. (Build: hamlet fire.)',
  hall: 'Without the old shelter, the village wants a commons hall of its own. (Build: Common life.)',
  restore: 'A district is quiet: its old buildings could be patched up and used. (Build: restore a ruin.)',
};
