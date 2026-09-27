/**
 * The clearing panel: the team, what the chosen one can do, what the team
 * knows of the spirits, and what has happened. Shown in place of the village
 * HUD while a team is in the Veil.
 */
import type { Colony } from '../sim/colony';
import {
  KIND_NAME, NEED_TEXT, VERB_COST, cheb, clearingDistrict, quiet, readingOf, teamReading, verbsFor,
  type Clearing, type Reading, type Spirit, type Verb,
} from '../sim/haunt';

export interface ClearingActions {
  onSelect(unit: number): void;
  onAct(unit: number, verb: Verb, target?: number): void;
  onEndTurn(): void;
  onLeave(): void;
  onWithdraw(): void;
  onReturn(): void;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const VERB_LABEL: Record<Verb, string> = {
  listen: 'Listen', offer_food: 'Offer food', offer_glimmer: 'Offer glimmer', offer_object: 'Give back their things',
  rest: 'Lay to rest', invite: 'Ask them home', befriend: 'Befriend', unravel: 'Unravel', banish: 'Banish', steady: 'Steady', ward: 'Ward',
};
const VERB_TIP: Record<Verb, string> = {
  listen: 'Learn what it is, what it wants, and how it could find peace. Needs Sight to perceive it.',
  offer_food: 'Two food from the stores.',
  offer_glimmer: 'One glimmer from the stores.',
  offer_object: 'Something the village salvaged from their house. Doesn\'t use it up.',
  rest: 'Help them finish. They go, and the land is better for it.',
  invite: 'They come home with you and keep a hearth warm (+comfort in a home).',
  befriend: 'It goes to live with the Folk (another of them at the hill, and their thanks).',
  unravel: 'Tear at the Hollow. Costs Nerve. Anchors (low Sight) do it better, and so does a ward\'s light.',
  banish: 'Always works. But the place goes colder, and the Folk won\'t like it.',
  steady: 'Give back some Nerve. Anchors are best at it.',
  ward: 'A lantern and a ring of salt: inside it, lures fail and dread is halved.',
};

export function spiritLabel(s: Spirit, r: Reading): string {
  if (s.known >= 1 && r !== 'none') return cap(s.name);
  if (r === 'chill') return 'A cold spot';
  if (r === 'luminous' || r === 'coherent') return `A shape of light (${KIND_NAME[s.kind].replace(/^an? /, '')})`;
  return 'Something';
}

export class ClearingPanel {
  private el: HTMLElement;
  constructor(private col: Colony, act: ClearingActions) {
    this.el = document.getElementById('clearing')!;
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || b.disabled) return;
      const d = b.dataset;
      if (d.unit) act.onSelect(Number(d.unit));
      else if (d.verb) act.onAct(Number(d.by), d.verb as Verb, d.target !== undefined ? Number(d.target) : undefined);
      else if (d.c === 'end') act.onEndTurn();
      else if (d.c === 'leave') act.onLeave();
      else if (d.c === 'withdraw') act.onWithdraw();
      else if (d.c === 'return') act.onReturn();
    });
  }

  hide() { this.el.hidden = true; document.body.classList.remove('in-veil'); }

  render(cl: Clearing, sel: number) {
    const col = this.col, h = col.haunts[cl.haunt], d = clearingDistrict(col, cl);
    document.body.classList.add('in-veil');
    this.el.hidden = false;
    const u = cl.units.find((x) => x.id === sel && x.state === 'in');
    const team = cl.units.map((x) => {
      const frac = Math.max(0, x.nerve) / x.maxNerve;
      const tag = x.sight >= 40 ? 'Seer' : x.anchor ? 'Anchor' : '';
      const state = x.state === 'fled' ? 'fled home' : x.state === 'taken' ? 'taken' : `${'●'.repeat(x.ap)}${'○'.repeat(Math.max(0, 2 - x.ap))}`;
      return `<button type="button" class="unit ${x.id === sel ? 'sel' : ''} ${x.state}" data-unit="${x.id}" ${x.state !== 'in' ? 'disabled' : ''}>
        <span class="n">${esc(x.name)}${tag ? ` <i>${tag}</i>` : ''}</span>
        <span class="nerve"><b style="width:${(frac * 100).toFixed(0)}%" class="${frac < 0.35 ? 'low' : frac < 0.65 ? 'mid' : ''}"></b></span>
        <span class="ap">${state}</span></button>`;
    }).join('');

    let acts = '';
    if (cl.outcome) {
      const lost = cl.units.filter((x) => x.state === 'taken').map((x) => x.name);
      const fled = cl.units.filter((x) => x.state === 'fled').map((x) => x.name);
      const verdict = cl.outcome === 'cleared' ? `${d.name} is quiet.` : cl.outcome === 'lost' ? 'Nobody is left standing in the Veil.' : 'The team came away with the work unfinished. The spirits will be stirred up for a few days.';
      acts = `<div class="result ${cl.outcome}"><b>${esc(verdict)}</b>
        ${fled.length ? `<p>${esc(fled.join(' and '))} ran home rattled.</p>` : ''}
        ${lost.length ? `<p>${esc(lost.join(' and '))} ${lost.length > 1 ? 'were' : 'was'} taken. They may come back, in days or seasons.</p>` : ''}
        ${cl.spent.food || cl.spent.glimmer ? `<p>Offered: ${cl.spent.food ? `${cl.spent.food} food` : ''}${cl.spent.food && cl.spent.glimmer ? ', ' : ''}${cl.spent.glimmer ? `${cl.spent.glimmer} glimmer` : ''}.</p>` : ''}
        <button type="button" data-c="return">Return home</button></div>`;
    } else if (u) {
      const rows: string[] = [];
      const adj = cl.units.filter((x) => x !== u && x.state === 'in' && cheb(x, u) <= 1);
      const general = [`<button type="button" data-verb="ward" data-by="${u.id}" ${cl.wardsLeft > 0 && u.ap >= 1 ? '' : 'disabled'} title="${esc(VERB_TIP.ward)}">Ward here · ${cl.wardsLeft} left</button>`]
        .concat(adj.map((x) => `<button type="button" data-verb="steady" data-by="${u.id}" data-target="${x.id}" ${u.ap >= 1 ? '' : 'disabled'} title="${esc(VERB_TIP.steady)}">Steady ${esc(x.name)}</button>`));
      rows.push(`<div class="verbs">${general.join('')}</div>`);
      for (const s of h.spirits) {
        if (s.fate !== 'present') continue;
        const r = readingOf(col, u, s);
        if (r === 'none' && s.known < 1) continue;
        const dist = cheb(u, s);
        if (dist > 6) continue;
        const vs = verbsFor(col, cl, u, s).filter((v) => v.ok || dist <= 1 || v.verb === 'listen');
        const btns = vs.map((v) => `<button type="button" data-verb="${v.verb}" data-by="${u.id}" data-target="${s.id}" ${v.ok ? '' : 'disabled'} title="${esc(v.ok ? VERB_TIP[v.verb] : v.why ?? '')}">${VERB_LABEL[v.verb]}${VERB_COST[v.verb] > 1 ? ' ·2' : ''}</button>`).join('');
        rows.push(`<div class="target"><div class="tn">${esc(spiritLabel(s, r === 'none' ? 'chill' : r))} <span>${dist <= 1 ? 'beside them' : `${dist} paces`}</span></div><div class="verbs">${btns}</div></div>`);
      }
      acts = `<div class="who">${esc(u.name)}: ${u.ap} action${u.ap === 1 ? '' : 's'} left. Click a lit tile to walk there.</div>${rows.join('')}`;
    } else acts = '<div class="who">Choose someone in the team.</div>';

    const known = h.spirits.map((s) => {
      const r = teamReading(col, cl, s);
      if (s.fate !== 'present') return `<li class="done">${esc(cap(s.name))}: ${s.fate === 'rested' ? 'laid to rest' : s.fate === 'invited' ? 'coming home with you' : s.fate === 'befriended' ? 'gone to the Folk' : s.fate === 'unravelled' ? 'unravelled' : 'banished'}</li>`;
      if (r === 'none' && s.known < 1) return '<li class="unknown">Something you can\'t perceive</li>';
      const bits: string[] = [];
      if (s.known >= 2 && s.kind !== 'hollow') bits.push(`wants ${NEED_TEXT[s.need]}`);
      if (s.kind === 'hollow' && s.known >= 1) bits.push(`hold ${s.integrity}`);
      else if (s.known >= 1) bits.push(s.calm >= 2 ? 'at peace' : `calm ${s.calm}/2`);
      return `<li>${esc(spiritLabel(s, r === 'none' ? 'chill' : r))}${bits.length ? `: ${esc(bits.join(', '))}` : ''}</li>`;
    }).join('');

    const isQuiet = quiet(col, cl);
    const html = `<h3>In the Veil · ${esc(d.name)}</h3>
      <div class="sub">Turn ${cl.turn} of ${cl.maxTurns} before dawn · no time passes at home · food ${Math.floor(col.community.resources.food)}, glimmer ${col.community.resources.glimmer.toFixed(0)}</div>
      <div class="team">${team}</div>
      <div class="acts">${acts}</div>
      <div class="h">What lives here</div><ul class="known">${known}</ul>
      <div class="clog">${cl.log.slice(-5).map((l) => `<p>${esc(l)}</p>`).join('')}</div>
      ${cl.outcome ? '' : `<div class="row">
        <button type="button" data-c="end" class="primary">End turn</button>
        ${isQuiet ? '<button type="button" data-c="leave" class="good">It\'s quiet: come home</button>' : ''}
        <button type="button" data-c="withdraw">Withdraw</button></div>`}`;
    if (this.el.innerHTML !== html) this.el.innerHTML = html;
  }
}
