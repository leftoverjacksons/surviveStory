/**
 * The trades and the village's needs (DESIGN §21.6).
 *
 * Makers work three small salvage workshops: the tool bench (scrap and wood
 * into tools), the sewing room (salvaged cloth into clothes) and the smoke
 * shed (food put up as preserves, which never spoil). A tavern gives the
 * evenings somewhere to go. Goods wear out, so the trades are ongoing work.
 *
 * Needs come in tiers. "Getting by" is food, shelter and warmth; "Settled"
 * adds tools, clothes, stores that keep and homes of their own; "Thriving"
 * adds a tavern, beauty and festivals. Each tier met lifts everyone's mood,
 * draws newcomers and lets houses be improved further; once the village has
 * been going a while, unmet needs of the next tier begin to weigh.
 */
import type { Colony } from './colony';
import { seasonOf } from './calendar';
import { alive, log, type Resources } from './community';
import { DEFS, bedsTotal, hasBuilt, type Building, type TradeKind } from './buildings';
import type { RoleId } from './data';

export type Good = 'tools' | 'clothes' | 'preserves';
type Input = Partial<Record<'wood' | 'scrap' | 'cloth' | 'food', number>>;

export interface TradeDef {
  good: Good;
  /** Goods made per batch, and what a batch uses. */
  makes: number;
  input: Input;
  /** Minutes of work per batch (at a steady pace). */
  minutes: number;
  doing: string;
  /** How much the village wants in stock. */
  target: (col: Colony) => number;
}

const pop = (col: Colony) => col.agents.length;

export const TRADES: Record<Exclude<TradeKind, 'tavern'>, TradeDef> = {
  toolshop: {
    good: 'tools', makes: 1, input: { scrap: 2, wood: 1 }, minutes: 110, doing: 'Beating out a blade at the tool bench',
    target: (col) => Math.ceil(workers(col) * 0.8) + 1,
  },
  tailor: {
    good: 'clothes', makes: 1, input: { cloth: 2 }, minutes: 100, doing: 'Sewing at the sewing room table',
    target: (col) => Math.ceil(pop(col) * 1.3),
  },
  smokehouse: {
    good: 'preserves', makes: 4, input: { food: 4, wood: 1 }, minutes: 80, doing: 'Hanging fish and roots in the smoke',
    // Put up more as winter comes.
    target: (col) => pop(col) * (['summer', 'autumn'].includes(seasonOf(col.community.day)) ? 7 : 3),
  },
};

const WORK_ROLES: RoleId[] = ['builder', 'farmer', 'forager', 'fisher', 'maker'];
/** People whose work goes faster with tools. */
export function workers(col: Colony): number {
  return alive(col.community).filter((s) => WORK_ROLES.includes(s.role)).length;
}

/** Tools in hand: up to a quarter faster at every job. */
export function toolFactor(col: Colony, role: RoleId): number {
  if (!WORK_ROLES.includes(role)) return 1;
  const want = Math.max(1, workers(col) * 0.6);
  return 1 + 0.25 * Math.min(1, col.community.resources.tools / want);
}

/** Share of people with warm clothes (0–1). */
export function clothed(col: Colony): number {
  return Math.min(1, col.community.resources.clothes / Math.max(1, pop(col)));
}

const has = (r: Resources, input: Input) => Object.entries(input).every(([k, n]) => (r[k as keyof Resources] ?? 0) >= (n ?? 0));

/** Which bench a maker should work, if any: the good furthest below what's wanted, with its materials in store. */
export function pickTrade(col: Colony, taken: Set<number>): Building | null {
  const r = col.community.resources;
  let best: Building | null = null, bestNeed = 0;
  for (const b of col.village.buildings) {
    if (b.kind === 'tavern' || !(b.kind in TRADES) || taken.has(b.id)) continue;
    const def = TRADES[b.kind as keyof typeof TRADES];
    // Food isn't put up while people are going hungry.
    if (b.kind === 'smokehouse' && r.food < pop(col) * 6) continue;
    // …nor firewood burned at the bench when the woodpile is low.
    if (def.input.wood && r.wood < 12 + pop(col)) continue;
    if (!has(r, def.input)) continue;
    const need = 1 - r[def.good] / def.target(col);
    if (need > bestNeed) { best = b; bestNeed = need; }
  }
  return best;
}

/** A batch is done: take the materials, add the goods. Returns false if the materials ran out meanwhile. */
export function finishBatch(col: Colony, b: Building, maker: string): boolean {
  const def = TRADES[b.kind as keyof typeof TRADES];
  if (!def) return false;
  const r = col.community.resources;
  if (!has(r, def.input)) return false;
  for (const [k, n] of Object.entries(def.input)) r[k as 'wood'] -= n ?? 0;
  // Better benches (and practised hands) make a little more.
  r[def.good] += def.makes * (b.tier === 1 ? 1.25 : 1);
  const key = `made-${def.good}`;
  if (!col.hints.has(key)) {
    col.hints.add(key);
    log(col.community, {
      tools: `${maker} ground an edge back onto a salvaged blade and fitted it with a new handle. The first tools from the village's own bench.`,
      clothes: `${maker} cut a coat from motel curtains and lined it with a sleeping bag. Someone will be warm this winter.`,
      preserves: `${maker} hung the first fish and roots in the smoke shed. Food that will keep till spring.`,
    }[def.good], 'good');
  }
  return true;
}

/** Salvage the trades are waiting on (on top of what building sites need). */
export function tradeDemand(col: Colony): { scrap: number; cloth: number } {
  const r = col.community.resources, v = col.village;
  const tools = hasBuilt(v, 'toolshop') && r.tools < TRADES.toolshop.target(col) ? 6 : 0;
  const cloth = hasBuilt(v, 'tailor') && r.clothes < TRADES.tailor.target(col) && r.cloth < 6 ? 6 - r.cloth : 0;
  return { scrap: tools, cloth };
}

/** Salvage brings back cloth as well as scrap: curtains, seat covers, sheets in drawers. */
export function clothFrom(kind: string | undefined, isCar: boolean, take: number): number {
  if (isCar) return take * 0.15;
  const soft = ['house', 'motel', 'shop', 'store', 'mall', 'school', 'church', 'chapel', 'hotel', 'office'];
  return take * (kind && soft.some((k) => kind.includes(k)) ? 0.45 : 0.25);
}

/** Goods wear out; in lean times the preserves are opened. Called once a day. */
export function tradesDaily(col: Colony) {
  const c = col.community, r = c.resources, n = pop(col);
  const winter = seasonOf(c.day) === 'winter';
  r.tools = Math.max(0, r.tools - workers(col) * 0.035);
  r.clothes = Math.max(0, r.clothes - n * (winter ? 0.03 : 0.012));
  // Open jars when the stores run low (they never spoil, so they are kept for this).
  if (r.food < n * 3 && r.preserves >= 1) {
    const open = Math.min(r.preserves, n * 3 - r.food);
    r.preserves -= open;
    r.food += open;
    const key = `jars${c.day - (c.day % 12)}`;
    if (!col.hints.has(key)) {
      col.hints.add(key);
      log(c, 'The stores ran low, so the preserves came down off the shelves: smoked fish and jars of roots.', 'info');
    }
  }
  // The tavern pours: a little food goes into brewing and the pot.
  if (hasBuilt(col.village, 'tavern') && r.food > n * 4) r.food -= Math.min(2, n * 0.12);
  staffTrades(col);
  noteTier(col);
}

/** The trades want makers; someone takes one up (the survivors decide who does what). */
function staffTrades(col: Colony) {
  const v = col.village, c = col.community;
  const benches = v.buildings.filter((b) => b.kind === 'toolshop' || b.kind === 'tailor' || b.kind === 'smokehouse').length;
  if (!benches) return;
  const living = alive(c);
  const makers = living.filter((s) => s.role === 'maker').length;
  if (makers >= Math.min(3, Math.ceil(benches / 2)) || living.length < 5) return;
  const count = (r: RoleId) => living.filter((s) => s.role === r).length;
  const pool = living.filter((s) => (s.role === 'builder' && count('builder') > 2) || (s.role === 'forager' && count('forager') > 1)
    || (s.role === 'farmer' && count('farmer') > 2) || s.role === 'tender');
  const pick = pool.sort((a, b) => score(b) - score(a))[0];
  if (!pick) return;
  pick.role = 'maker';
  log(c, `${pick.name.split(' ')[0]} took up the trades: the bench, the needle and the smoke shed.`, 'good');
  function score(s: typeof living[number]) {
    return (s.traits.includes('tinkerer') ? 3 : 0) + (s.aspiration?.kind === 'craft' ? 2 : 0) + (s.traits.includes('hoarder') ? 1 : 0) + (s.id % 7) / 10;
  }
}

// ---------- needs ----------

export interface NeedRow { id: string; tier: 1 | 2 | 3; label: string; met: boolean; hint: string }
export const TIER_NAMES = ['Struggling', 'Getting by', 'Settled', 'Thriving'];

export function needRows(col: Colony): NeedRow[] {
  const c = col.community, r = c.resources, v = col.village, n = Math.max(1, pop(col));
  const homed = v.households.length ? v.households.filter((h) => h.home).length / v.households.length : 1;
  const lanterns = v.buildings.filter((b) => b.kind === 'lantern').length;
  const sinceFestival = (col.minute - col.council.festivalUntil) / 1440;
  return [
    { id: 'food', tier: 1, label: 'Food', met: r.food + r.preserves >= n * 3, hint: 'Three days of food in store.' },
    { id: 'shelter', tier: 1, label: 'Shelter', met: bedsTotal(v) >= n, hint: 'A bed under a roof for everyone.' },
    { id: 'warmth', tier: 1, label: 'Warmth', met: r.wood >= 6, hint: 'Firewood on the pile.' },
    { id: 'tools', tier: 2, label: 'Tools', met: r.tools >= Math.max(1, workers(col) * 0.4), hint: 'Tools for the workers: a tool bench and a maker.' },
    { id: 'clothes', tier: 2, label: 'Clothes', met: r.clothes >= n * 0.6, hint: 'Warm clothes for most: a sewing room, and cloth from salvage.' },
    { id: 'stores', tier: 2, label: 'Stores that keep', met: hasBuilt(v, 'cellar') || r.preserves >= n * 2, hint: 'A root cellar, or preserves from the smoke shed.' },
    { id: 'homes', tier: 2, label: 'Homes', met: homed >= 0.5, hint: 'Half the households in homes of their own.' },
    { id: 'tavern', tier: 3, label: 'Somewhere to go', met: hasBuilt(v, 'tavern'), hint: 'A tavern for the evenings.' },
    { id: 'beauty', tier: 3, label: 'Beauty', met: (hasBuilt(v, 'shrine') && lanterns >= 2) || hasBuilt(v, 'dome'), hint: 'A shrine and lanterns between the houses, or a glass dome.' },
    { id: 'festival', tier: 3, label: 'Festivals', met: col.council.festivalUntil > 0 && sinceFestival < 24, hint: 'A festival within the last two seasons.' },
  ];
}

/** The highest tier whose needs, and every tier below, are all met (0–3). */
export function needTier(col: Colony, rows = needRows(col)): number {
  let tier = 0;
  for (const t of [1, 2, 3] as const) {
    if (rows.filter((x) => x.tier === t).every((x) => x.met)) tier = t; else break;
  }
  return tier;
}

/** How the needs feel, as a mood adjustment for everyone. */
export function needComfort(col: Colony, rows = needRows(col)): number {
  const tier = needTier(col, rows);
  let m = [-2, 0, 1.5, 3][tier];
  // Once the village has found its feet, the next tier's needs start to weigh.
  if (col.community.day >= 16) m -= rows.filter((x) => x.tier === 2 && !x.met).length * 0.75;
  return m;
}

/** News when the village reaches a new tier. */
function noteTier(col: Colony) {
  const tier = needTier(col);
  if (tier < 2) return;
  const key = `tier${tier}`;
  if (col.hints.has(key)) return;
  col.hints.add(key);
  log(col.community, tier === 2
    ? 'Tools on the hooks, coats on the pegs, food that will keep, doors of their own. People have stopped talking about getting through the winter, and started talking about next year.'
    : 'Music from the tavern, lanterns along the lanes, a festival still being talked about. The village is thriving, and word of it is getting around.', 'good');
}

export const TRADE_NAME = (k: TradeKind, tier: number) => DEFS[k].name[tier];
