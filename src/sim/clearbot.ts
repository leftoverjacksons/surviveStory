/**
 * A plain-minded clearing team, for tests and balance probes. It knows only
 * what a player would (DESIGN §38.14): spirits someone perceives, ones already
 * met, and where echoes and signs point. It sounds the Veil when it knows of
 * nothing, keeps its lanterns lit, deals with the nearest unsettled spirit
 * (the Hollow last, from a pool of light and a ring of rowan), and steadies
 * whoever is shaking.
 */
import type { Colony } from './colony';
import {
  BESIDE, act, approachPoint, canSound, clearingDistrict, dist, endTurn, finish, lanternAct, moveUnit, quiet, soundAct, spiritAt, teamReading,
  verbsFor, wardAct, type Clearing, type Spirit, type Unit, type Verb,
} from './haunt';
import type { Pt } from './veilmove';

/** Where the team believes a spirit is, or null if it knows nothing of it. */
function believed(col: Colony, cl: Clearing, s: Spirit): Pt | null {
  if (s.known >= 1 || teamReading(col, cl, s) !== 'none') return spiritAt(col, s);
  const e = cl.echoes.find((x) => x.spirit === s.id && x.quality !== 'ring');
  return e ? { x: e.x, z: e.z } : null;
}

export function playTurn(col: Colony, cl: Clearing) {
  const h = col.haunts[cl.haunt];
  // Spirits nobody has any word of (a player would know how many from the briefing).
  const unaccounted = () => h.spirits.filter((s) => s.fate === 'present' && !believed(col, cl, s)).length;
  for (const u of cl.units) {
    tendLantern(col, cl, u);
    // A seer spends a moment each turn listening, while anything is unaccounted for: quietly, then calling out.
    if (canSound(u) && u.ap > 0 && unaccounted() > 0) soundAct(col, cl, u.id, cl.turn % 2 === 0);
    for (let guard = 0; guard < 5 && u.state === 'in' && u.ap > 0 && !cl.outcome; guard++) {
      const shaky = cl.units.find((o) => o !== u && o.state === 'in' && o.nerve <= 4 && dist(col, o, u) <= BESIDE);
      if (shaky && !act(col, cl, u.id, 'steady', shaky.id)) continue;
      const open = h.spirits.filter((s) => s.fate === 'present' && (s.kind === 'hollow' || s.calm < 2 || s.known < 3));
      const guesses = open.map((s) => ({ s, at: believed(col, cl, s) })).filter((g): g is { s: Spirit; at: Pt } => !!g.at);
      const others = guesses.filter((g) => g.s.kind !== 'hollow');
      const pick = (others.length ? others : guesses).sort((a, b) => Math.hypot(a.at.x - u.x, a.at.z - u.z) - Math.hypot(b.at.x - u.x, b.at.z - u.z))[0];
      if (!pick) {
        // Nothing known: a seer listens (then calls out); the rest walk in toward the heart of it.
        if (canSound(u) && !soundAct(col, cl, u.id, cl.turn >= 3 && !cl.echoes.length)) continue;
        if (!walkToward(col, cl, u, explore(col, cl, u))) break;
        continue;
      }
      const target = pick.s;
      const perceived = target.known >= 1 || teamReading(col, cl, target) !== 'none';
      if (perceived) {
        aimAt(col, cl, u, target);
        if (target.kind === 'hollow' && dist(col, u, target) <= BESIDE + 0.5 && prepareForHollow(col, cl, u)) continue;
        if (u.slots.includes('bell') && dist(col, u, target) <= 4 && !wardAct(col, cl, u.id, 'bell', u.x, u.z)) continue;
        const order: Verb[] = target.kind === 'hollow' ? ['unravel', 'listen']
          : target.kind === 'remnant' ? ['invite', 'rest', 'offer_object', 'search', target.known < 2 ? 'listen' : 'offer_food', 'listen', 'offer_food']
            : ['befriend', target.known < 1 ? 'listen' : target.need === 'glimmer' ? 'offer_glimmer' : 'offer_food', 'offer_food', 'offer_glimmer', 'listen'];
        const ok = verbsFor(col, cl, u, target).filter((v) => v.ok).map((v) => v.verb);
        const verb = order.find((v) => ok.includes(v));
        if (verb && !act(col, cl, u.id, verb, target.id)) continue;
        if (dist(col, u, target) <= BESIDE) break;
      }
      if (!walkToward(col, cl, u, pick.at)) break;
    }
  }
  if (!cl.outcome && quiet(col, cl)) finish(col, cl, 'cleared');
  else if (!cl.outcome) endTurn(col, cl);
}

/** Keep the light going: relight it, top it up, take it up again if it was left behind. */
function tendLantern(col: Colony, cl: Clearing, u: Unit) {
  const l = u.lantern;
  if (u.state !== 'in' || !l) return;
  if (l.state === 'down') {
    const hollowNear = col.haunts[cl.haunt].spirits.some((s) => s.fate === 'present' && s.kind === 'hollow' && dist(col, u, s) <= 5);
    if (!hollowNear) lanternAct(col, cl, u.id, 'pick_up');
  }
  if (l.state === 'shuttered') lanternAct(col, cl, u.id, 'raise');
  if (!l.lit && l.fuel > 0) lanternAct(col, cl, u.id, 'relight');
  if (l.fuel <= 3 && u.slots.includes('oil')) lanternAct(col, cl, u.id, 'refuel');
}

/** A torch's beam on a lamp or a hedge-spirit breaks its hold this turn. */
function aimAt(col: Colony, cl: Clearing, u: Unit, s: Spirit) {
  if (u.lantern?.kind === 'torch' && u.lantern.lit && u.lantern.state === 'raised' && (s.kind === 'lamp' || s.kind === 'hedge') && dist(col, u, s) <= 8) lanternAct(col, cl, u.id, 'aim', s.id);
}

/** Beside the Hollow: a ring of rowan underfoot, and a lantern set down so its light weakens it. Returns true if it did something. */
function prepareForHollow(col: Colony, cl: Clearing, u: Unit): boolean {
  if (u.slots.includes('rowan') && !wardAct(col, cl, u.id, 'rowan', u.x, u.z)) return true;
  const pooled = cl.wards.some((w) => w.kind === 'pool' && Math.hypot(w.x - u.x, w.z - u.z) <= 3);
  if (!pooled && u.lantern?.lit && u.lantern.state !== 'down' && !lanternAct(col, cl, u.id, 'set_down')) return true;
  return false;
}

/** Somewhere not yet looked at: round the district's heart, each person their own way, moving on each turn. */
function explore(col: Colony, cl: Clearing, u: Unit): Pt {
  const d = clearingDistrict(col, cl);
  const a = cl.turn * 1.3 + (u.id % 7) * 0.9;
  const r = 6 + ((cl.turn + u.id) % 3) * 4;
  return { x: d.x + Math.cos(a) * r, z: d.z + Math.sin(a) * r };
}

function walkToward(col: Colony, cl: Clearing, u: Unit, at: Pt): boolean {
  if (Math.hypot(at.x - u.x, at.z - u.z) <= BESIDE) return false;
  const p = approachPoint(col, cl, u, at);
  if (!p) return false;
  return !moveUnit(col, cl, u.id, p.x, p.z);
}
