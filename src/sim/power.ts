/**
 * Power from know-how (DESIGN §24.17; the user's backlog, §23.2: "large
 * solar arrays, homemade wooden and electric windmills, feeding the power
 * network: learned by doing and built from salvage, not eras").
 *
 * - Wiring is a craft, learned by doing: stripping copper, steel and glass out
 *   of the old world teaches how cable and panels go together.
 * - A wooden windmill (sails) wants joinery: it grinds grain, so every
 *   harvest goes further, and turns a small dynamo.
 * - A solar array (salvaged panels on a timber rack) wants someone who knows
 *   wiring, and glass and copper from a cleared district.
 * - A wind turbine (homemade, steel and copper) wants wiring too; it gives
 *   most in winter, when the sun gives least.
 *
 * The grid: supply against what the village draws (lived-in homes, the
 * hall, the tavern, the trades). Homes with power get a little light to
 * read by of an evening; the string lights glow only as bright as the grid.
 */
import type { Colony } from './colony';
import { log } from './community';
import { seasonOf } from './calendar';
import { knowers, learn } from './purpose';
import type { Survivor } from './community';

export type PowerKind = 'windmill' | 'solar' | 'turbine';
export const POWER_KINDS: PowerKind[] = ['windmill', 'solar', 'turbine'];

/** Power each gives by season (spring, summer, autumn, winter). */
const SUPPLY: Record<PowerKind, [number, number, number, number]> = {
  windmill: [1, 1, 1.5, 1.5],
  solar: [4, 5, 3, 1.5],
  turbine: [2.5, 2, 3, 4],
};
/** The little salvaged panel the first string of lights ran off. */
const BASE_SUPPLY = 1;
/** Share more food from each harvest brought in while a windmill grinds it. */
export const MILL_BONUS = 0.2;

/** What each needs to be built (know-how, not eras): joiners for the windmill, someone who knows wiring for the rest. */
export function whyNotPower(col: Colony, kind: PowerKind): string | null {
  if (kind === 'windmill') return knowers(col.community, 'joinery').length ? null : 'Nobody knows joinery yet (it is learned at the workbench).';
  return knowers(col.community, 'wiring').length ? null : 'Nobody knows wiring yet: it is learned by stripping copper, steel and glass out of the old world.';
}

/** What know-how a build-menu kind waits on, if any (power, and the saw pit's joinery). */
export function whyLocked(col: Colony, kind: string): string | null {
  if ((POWER_KINDS as string[]).includes(kind)) return whyNotPower(col, kind as PowerKind);
  if (kind === 'sawpit') return knowers(col.community, 'joinery').length ? null : 'Nobody knows joinery yet (it is learned at the workbench).';
  return null;
}

const built = (col: Colony, kind: PowerKind) => col.village.buildings.filter((b) => b.kind === kind).length;

export function powerSupply(col: Colony): number {
  const season = ['spring', 'summer', 'autumn', 'winter'].indexOf(seasonOf(col.community.day));
  return BASE_SUPPLY + POWER_KINDS.reduce((n, k) => n + built(col, k) * SUPPLY[k][season], 0);
}

export function powerDemand(col: Colony): number {
  const v = col.village;
  let d = 0;
  for (const b of v.buildings) {
    if (b.kind === 'home' && b.household) d += 1;
    else if ((b.kind === 'store' && b.level >= 3 && !b.gone) || b.kind === 'hall') d += 2;
    else if (b.kind === 'tavern') d += 2;
    else if (b.kind === 'workshop' || b.kind === 'toolshop' || b.kind === 'tailor' || b.kind === 'smokehouse') d += 0.5;
  }
  return d;
}

/** Share of what's drawn that the grid can give, 0..1. */
export function powered(col: Colony): number {
  const d = powerDemand(col);
  return d <= 0 ? 1 : Math.min(1, powerSupply(col) / d);
}

/** More food from each harvest while a windmill grinds it. */
export const millFactor = (col: Colony) => (built(col, 'windmill') ? 1 + MILL_BONUS : 1);

/** Practice at wiring (stripping salvage, building panels): the first to know it is news. */
export function learnWiring(col: Colony, s: Survivor, amount: number) {
  if (learn(s, 'wiring', amount)) {
    log(col.community, `${s.name.split(' ')[0]} has worked out how the old wiring goes: panels, cable, the little boxes in between. The village could build a solar array now, or a wind turbine.`, 'good');
  }
}

/** Daily: light to read by in homes with power; the grid's news. */
export function powerDaily(col: Colony) {
  const c = col.community, v = col.village;
  const f = powered(col);
  if (built(col, 'solar') + built(col, 'turbine') > 0) {
    for (const h of v.households) {
      if (!h.home) continue;
      for (const id of h.members) {
        const s = c.survivors.find((x) => x.id === id);
        if (s?.alive) s.morale = Math.min(100, s.morale + 0.4 * f);
      }
    }
  }
  // A word when the grid first falls short, and when it catches up.
  const short = f < 0.75;
  const key = short ? 'powershort' : 'powerok';
  if (built(col, 'solar') + built(col, 'turbine') > 0 && !col.hints.has(key)) {
    col.hints.add(key);
    col.hints.delete(short ? 'powerok' : 'powershort');
    log(c, short
      ? `The lights are dim along the lanes: the village draws more power than its panels and turbines give (${Math.round(f * 100)}%).`
      : 'Every house on the lanes has light of an evening now. People read, mend, and stay up talking.', short ? 'bad' : 'good');
  }
}
