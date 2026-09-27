/**
 * A plain-minded clearing team, for tests and balance probes: deal with the
 * nearest unsettled spirit, the Hollow last; steady whoever is shaking.
 */
import type { Colony } from './colony';
import { act, cheb, endTurn, finish, moveUnit, quiet, reachable, verbsFor, type Clearing, type Spirit, type Unit, type Verb } from './haunt';

export function playTurn(col: Colony, cl: Clearing) {
  const h = col.haunts[cl.haunt];
  for (const u of cl.units) {
    for (let guard = 0; guard < 4 && u.state === 'in' && u.ap > 0 && !cl.outcome; guard++) {
      const shaky = cl.units.find((o) => o !== u && o.state === 'in' && o.nerve <= 4 && cheb(o, u) <= 1);
      if (shaky && !act(col, cl, u.id, 'steady', shaky.id)) continue;
      const open = h.spirits.filter((s) => s.fate === 'present' && (s.kind === 'hollow' || s.calm < 2 || s.known < 3));
      const others = open.filter((s) => s.kind !== 'hollow');
      const target = (others.length ? others : open).sort((a, b) => cheb(u, a) - cheb(u, b))[0];
      if (!target) break;
      if (target.kind === 'hollow' && cl.wardsLeft > 0 && cheb(u, target) <= 1 && !cl.wards.length && !act(col, cl, u.id, 'ward')) continue;
      const order: Verb[] = target.kind === 'hollow' ? ['unravel', 'listen']
        : target.kind === 'remnant' ? ['invite', 'rest', 'offer_object', target.known < 2 ? 'listen' : 'offer_food', 'listen', 'offer_food']
        : ['befriend', target.known < 1 ? 'listen' : target.need === 'glimmer' ? 'offer_glimmer' : 'offer_food', 'offer_food', 'offer_glimmer', 'listen'];
      const ok = verbsFor(col, cl, u, target).filter((v) => v.ok).map((v) => v.verb);
      const verb = order.find((v) => ok.includes(v));
      if (verb && !act(col, cl, u.id, verb, target.id)) continue;
      if (!moveNextTo(col, cl, u, target)) break;
    }
  }
  if (!cl.outcome && quiet(col, cl)) finish(col, cl, 'cleared');
  else if (!cl.outcome) endTurn(col, cl);
}

function moveNextTo(col: Colony, cl: Clearing, u: Unit, s: Spirit): boolean {
  if (cheb(u, s) <= 1) return false;
  let best: [string, number] | null = null;
  for (const [k, steps] of reachable(col, cl, u)) {
    const [tx, tz] = k.split(',').map(Number);
    const d = cheb({ tx, tz }, s);
    const score = d * 10 + steps;
    if (!best || score < best[1]) best = [k, score];
  }
  if (!best) return false;
  const [tx, tz] = best[0].split(',').map(Number);
  return !moveUnitSafe(col, cl, u, tx, tz);
}
const moveUnitSafe = (col: Colony, cl: Clearing, u: Unit, tx: number, tz: number) => moveUnit(col, cl, u.id, tx, tz);

