/**
 * A plain-minded clearing team, for tests and balance probes: deal with the
 * nearest unsettled spirit, the Hollow last; steady whoever is shaking.
 */
import type { Colony } from './colony';
import { BESIDE, act, approachPoint, dist, endTurn, finish, moveUnit, quiet, spiritAt, verbsFor, type Clearing, type Spirit, type Unit, type Verb } from './haunt';

export function playTurn(col: Colony, cl: Clearing) {
  const h = col.haunts[cl.haunt];
  for (const u of cl.units) {
    for (let guard = 0; guard < 4 && u.state === 'in' && u.ap > 0 && !cl.outcome; guard++) {
      const shaky = cl.units.find((o) => o !== u && o.state === 'in' && o.nerve <= 4 && dist(col, o, u) <= BESIDE);
      if (shaky && !act(col, cl, u.id, 'steady', shaky.id)) continue;
      const open = h.spirits.filter((s) => s.fate === 'present' && (s.kind === 'hollow' || s.calm < 2 || s.known < 3));
      const others = open.filter((s) => s.kind !== 'hollow');
      const target = (others.length ? others : open).sort((a, b) => dist(col, u, a) - dist(col, u, b))[0];
      if (!target) break;
      if (target.kind === 'hollow' && cl.wardsLeft > 0 && dist(col, u, target) <= BESIDE && !cl.wards.length && !act(col, cl, u.id, 'ward')) continue;
      const order: Verb[] = target.kind === 'hollow' ? ['unravel', 'listen']
        : target.kind === 'remnant' ? ['invite', 'rest', 'offer_object', 'search', target.known < 2 ? 'listen' : 'offer_food', 'listen', 'offer_food']
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
  if (dist(col, u, s) <= BESIDE) return false;
  const p = approachPoint(col, cl, u, spiritAt(col, s));
  if (!p) return false;
  return !moveUnit(col, cl, u.id, p.x, p.z);
}
