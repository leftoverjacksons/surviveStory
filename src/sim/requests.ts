/**
 * Requests (DESIGN §23.4): the everyday asks, out of the council. They come
 * to a tray that never pauses the game, and wait to be answered:
 * - a household that wants a home (draw them a plot, or put them first);
 * - someone who would like something near their house: a lantern, a kitchen
 *   garden, a shrine (place it, and they are glad);
 * - someone who wants to change their work (let them).
 * Fulfilled asks lift the asker's mood; a personal ask left too long fades,
 * and is remembered. Home asks stay until the household has a plot.
 */
import type { Colony } from './colony';
import { alive, log, remember, type Survivor } from './community';
import { footCenter } from './buildings';
import { householdName, householdOf, plotOf, waitingHouseholds } from './homes';
import type { RoleId } from './data';

export type RequestKind = 'plot' | 'lantern' | 'garden' | 'shrine' | 'work';
export interface Request {
  id: number;
  kind: RequestKind;
  /** Who asks (for a plot: the household's speaker). */
  by: number;
  household?: number;
  /** For 'work': the work they want. */
  role?: RoleId;
  /** Where it is wanted (their house), for building asks. */
  x: number; z: number;
  since: number;
  /** Day a personal ask fades, unanswered. */
  until: number;
  text: string;
}

/** How near their house a building must be to count (tiles). */
export const NEAR: Record<'lantern' | 'garden' | 'shrine', number> = { lantern: 7, garden: 9, shrine: 12 };
const PERSONAL_OPEN = 3;
const FADE_DAYS = 6;

const first = (s: Survivor) => s.name.split(' ')[0];
export const requestsOf = (col: Colony): Request[] => (col.requests ??= []);

/** A building (or a site for one) of this kind near a point. */
function builtNear(col: Colony, kind: string, x: number, z: number, r: number): boolean {
  const w = col.world, v = col.village;
  const near = (f: { tx: number; tz: number; w: number; d: number }) => { const c = footCenter(w, f); return Math.hypot(c.x - x, c.z - z) <= r; };
  return v.buildings.some((b) => b.kind === kind && near(b.foot))
    || v.projects.some((p) => p.kind === kind && !p.done && near(p.foot));
}

export function fulfilled(col: Colony, q: Request): boolean {
  const v = col.village;
  const s = col.community.survivors.find((x) => x.id === q.by);
  switch (q.kind) {
    case 'plot': {
      const h = v.households.find((x) => x.id === q.household);
      return !h || !!h.home || v.plots.some((p) => p.household === h.id);
    }
    case 'work': return !!s && s.role === q.role;
    default: return builtNear(col, q.kind, q.x, q.z, NEAR[q.kind]);
  }
}

/** Where someone's house is (the house's centre), if they have one. */
function homeSpot(col: Colony, s: Survivor): { x: number; z: number } | null {
  const h = householdOf(col.village, s.id);
  const plot = h?.home ? plotOf(col.village, h) : undefined;
  return plot ? { x: plot.hc.x, z: plot.hc.z } : null;
}

/** What someone might ask for, and how much they want it. */
function asks(col: Colony, s: Survivor): [Omit<Request, 'id' | 'since' | 'until' | 'by'>, number][] {
  const out: [Omit<Request, 'id' | 'since' | 'until' | 'by'>, number][] = [];
  const has = (t: string) => s.traits.includes(t as never);
  const at = homeSpot(col, s);
  if (at) {
    if ((has('skittish') || s.morale < 55 || s.sight > 40) && !builtNear(col, 'lantern', at.x, at.z, NEAR.lantern)) {
      out.push([{ kind: 'lantern', ...at, text: `${first(s)} would like a lantern by their door. The dark between the houses is very dark.` }, has('skittish') ? 3 : 1]);
    }
    if ((has('green_thumb') || s.role === 'farmer' || s.aspiration?.kind === 'garden') && !builtNear(col, 'garden', at.x, at.z, NEAR.garden)) {
      out.push([{ kind: 'garden', ...at, text: `${first(s)} would like a kitchen garden near their house.` }, has('green_thumb') ? 2.5 : 1]);
    }
    if (s.sight > 45 && !builtNear(col, 'shrine', at.x, at.z, NEAR.shrine)) {
      out.push([{ kind: 'shrine', ...at, text: `${first(s)} would like a shrine near their house: somewhere to leave something for the ones they can't see.` }, s.sight / 40]);
    }
  }
  // A change of work, from what they have set their heart on.
  const want: Partial<Record<string, RoleId>> = { craft: 'builder', explore: 'scout', veil: 'attune', garden: 'farmer' };
  const role = s.aspiration ? want[s.aspiration.kind] : undefined;
  if (role && s.role !== role && (s.roleSetDay === undefined || col.community.day - s.roleSetDay >= 8)) {
    const what: Partial<Record<RoleId, string>> = {
      builder: 'work on the building sites, and learn to joint timber', scout: 'go scouting, past the mist',
      attune: 'spend their days attuning to the Veil', farmer: 'work the fields',
    };
    out.push([{ kind: 'work', role, x: 0, z: 0, text: `${first(s)} asks to ${what[role]}.` }, 1.5]);
  }
  return out;
}

/** A home ask answered (a plot drawn and taken): it goes from the tray at once, not the next morning. */
export function dropAnsweredHomes(col: Colony) {
  const list = requestsOf(col);
  for (const q of [...list]) if (q.kind === 'plot' && fulfilled(col, q)) list.splice(list.indexOf(q), 1);
}

/** Once a day: settle what was answered, fade what wasn't, and let new asks come in. */
export function requestsDaily(col: Colony) {
  const c = col.community, v = col.village;
  const list = requestsOf(col);
  for (const q of [...list]) {
    const s = c.survivors.find((x) => x.id === q.by);
    if (fulfilled(col, q)) {
      list.splice(list.indexOf(q), 1);
      if (q.kind === 'plot' || !s?.alive) continue; // the home itself is the news (homes.ts)
      s.morale = Math.min(100, s.morale + 6);
      remember(s, c.day, `Asked, and was listened to: ${q.text.replace(`${first(s)} `, '')}`);
      log(c, `${first(s)} got what they asked for, and is glad of it.`, 'good');
      continue;
    }
    if (!s?.alive || (q.kind !== 'plot' && c.day > q.until)) {
      list.splice(list.indexOf(q), 1);
      if (s?.alive) {
        s.morale = Math.max(0, s.morale - 3);
        remember(s, c.day, 'Asked for something, and nobody answered.');
      }
    }
  }
  // Households waiting for a home: one standing ask each.
  for (const h of waitingHouseholds(v)) {
    if (list.some((q) => q.kind === 'plot' && q.household === h.id)) continue;
    const speaker = alive(c).filter((s) => h.members.includes(s.id)).sort((a, b) => b.stats.empathy - a.stats.empathy)[0];
    if (!speaker) continue;
    const plot = v.plots.find((p) => !p.household);
    list.push({
      id: v.nextId++, kind: 'plot', by: speaker.id, household: h.id, x: plot?.origin.x ?? 0, z: plot?.origin.z ?? 0, since: c.day, until: Infinity,
      text: h.members.length > 1 ? `${householdName(c, h)} would like a home of their own.` : `${first(speaker)} would like a small place of their own.`,
    });
  }
  // Self-planning villages (tests, autopilot) put a household in line after a few days' wait,
  // about the pace the council used to approve petitions at.
  if (v.autoPlan !== false) for (const h of waitingHouseholds(v)) if (c.day - h.since >= 3 && !v.homeQueue.includes(h.id)) v.homeQueue.push(h.id);
  // Now and then, someone asks for something.
  if (list.filter((q) => q.kind !== 'plot').length >= PERSONAL_OPEN) return;
  // Their own dice (seeded by the world and the day), so asks don't shift the rest of the simulation.
  const roll = (k: number) => { const x = Math.sin((col.world.seed * 131 + c.day * 7919 + k * 104729) % 1e6) * 43758.5453; return x - Math.floor(x); };
  if (roll(1) >= 0.45) return;
  const cands = alive(c).filter((s) => !list.some((q) => q.by === s.id)).flatMap((s) => asks(col, s).map(([q, wt]) => ({ s, q, wt })));
  const total = cands.reduce((n, x) => n + x.wt, 0);
  if (total <= 0) return;
  let r = roll(2) * total;
  const pick = cands.find((x) => (r -= x.wt) <= 0) ?? cands[cands.length - 1];
  list.push({ ...pick.q, id: v.nextId++, by: pick.s.id, since: c.day, until: c.day + FADE_DAYS });
}

/** The player answers "not now": the ask goes, a little sadly. Home asks can't be refused, only waited on. */
export function declineRequest(col: Colony, id: number): boolean {
  const list = requestsOf(col), q = list.find((x) => x.id === id);
  if (!q || q.kind === 'plot') return false;
  list.splice(list.indexOf(q), 1);
  const s = col.community.survivors.find((x) => x.id === q.by);
  if (s?.alive) { s.morale = Math.max(0, s.morale - 2); remember(s, col.community.day, 'Asked for something, and was told not now.'); }
  return true;
}

/** The player lets someone change their work. */
export function grantWork(col: Colony, id: number): boolean {
  const q = requestsOf(col).find((x) => x.id === id);
  const s = q && col.community.survivors.find((x) => x.id === q.by);
  if (!q || q.kind !== 'work' || !q.role || !s?.alive) return false;
  s.role = q.role;
  s.roleSetDay = col.community.day;
  return true;
}

/** Put a household first in line for the next plot. */
export function putFirst(col: Colony, id: number): boolean {
  const q = requestsOf(col).find((x) => x.id === id);
  if (!q?.household) return false;
  const v = col.village;
  v.homeQueue = [q.household, ...v.homeQueue.filter((x) => x !== q.household)];
  return true;
}
