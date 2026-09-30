/**
 * The clearing panel: the team, what the chosen one can do, what the team
 * knows of the spirits, and what has happened. Shown in place of the village
 * HUD while a team is in the Veil.
 */
import type { Colony } from '../sim/colony';
import {
  BESIDE, KIND_NAME, NEED_TEXT, VERB_COST, clearingDistrict, dist, quiet, readingOf, teamReading, verbsFor,
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
  name: 'Speak its true name', play: 'Play for it', search: 'Search their house',
};
const VERB_TIP: Record<Verb, string> = {
  listen: 'Learn what it is, what it wants, and how it could find peace. Needs Sight to perceive it.',
  offer_food: 'Two food from the stores.',
  offer_glimmer: 'One glimmer from the stores.',
  offer_object: 'Give back what you found in their house (or something the village salvaged from it). Exactly what they wanted.',
  rest: 'Help them finish. They go, and the land is better for it.',
  invite: 'They come home with you and keep a hearth warm (+comfort in a home).',
  befriend: 'It goes to live with the Folk (another of them at the hill, and their thanks).',
  unravel: 'Tear at the Hollow. Costs Nerve. Anchors (low Sight) do it better, and so does a ward\'s light.',
  banish: 'Always works. But the place goes colder, and the Folk won\'t like it.',
  steady: 'Give back some Nerve. Anchors are best at it.',
  ward: 'A lantern and a ring of salt: inside it, lures fail and dread is halved.',
  name: 'Once a clearing: the spirit is known at once and half at peace. A Hollow loses two of its hold.',
  play: 'Every spirit within three paces grows calmer; the team near the piper steadier.',
  search: 'Look through the house for something of theirs (a photograph, a teacup). Then give it back.',
};

export function spiritLabel(s: Spirit, r: Reading): string {
  if (s.known >= 1 && r !== 'none') return cap(s.name);
  if (r === 'chill') return 'A cold spot';
  if (r === 'luminous' || r === 'coherent') return `A shape of light (${KIND_NAME[s.kind].replace(/^an? /, '')})`;
  return 'Something';
}

export class ClearingPanel {
  private el: HTMLElement;
  private guideOpen = true;
  constructor(private col: Colony, act: ClearingActions) {
    this.el = document.getElementById('clearing')!;
    this.el.addEventListener('toggle', (e) => {
      if ((e.target as HTMLElement).classList.contains('guide')) this.guideOpen = (e.target as HTMLDetailsElement).open;
    }, true);
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
      const tag = x.fae ? `Folk · ${x.fae}` : x.sight >= 40 ? 'Seer' : x.anchor ? 'Anchor' : '';
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
      acts = `<div class="who"><b>${esc(u.name)}</b>: ${u.ap} action${u.ap === 1 ? '' : 's'} left this turn.</div>`;
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
    const guide = `<details class="guide" ${this.guideOpen ? 'open' : ''}><summary>How it works</summary><ol>
      <li><b>Click</b> one of your people, then <b>click the ground</b> to walk there. Inside the <b>inner ring</b> it costs one action and they can still act; out to the <b>outer ring</b> it takes the whole turn. Hover to see the way, and which spirits would reach them there.</li>
      <li><b>Click a spirit</b> (or right-click anything) for what you can do. Listen to learn what it wants; give it that; then lay it to rest, befriend it, or ask it home.</li>
      <li>The <b>Hollow</b> (the dark orb) is unravelled last: Anchors (low Sight) do it best, standing inside a ward.</li>
      <li><b>End turn</b>: the spirits act on everyone's Nerve. If Nerve breaks, they run home; if a light is pulling them when it breaks, they are taken.</li>
      <li>When the Hollow is gone and the rest are at peace, <b>come home</b>.</li></ol></details>`;
    const html = `<h3>In the Veil · ${esc(d.name)}</h3>
      <div class="sub">Turn ${cl.turn} of ${cl.maxTurns} before dawn · no time passes at home · food ${Math.floor(col.community.resources.food)}, glimmer ${col.community.resources.glimmer.toFixed(0)}</div>
      ${guide}
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

export type MenuTarget = { spirit: number } | { ally: number } | { self: true };
export interface MenuActions {
  onAct(unit: number, verb: Verb, target?: number): void;
  onApproach(unit: number, target: { x: number; z: number }): void;
  onSelect(unit: number): void;
}

/** What to try next with a spirit, in plain words. */
function nextStep(s: Spirit, r: Reading): string {
  if (r === 'none' || r === 'chill') return 'Your Seers can barely sense it. Bring someone with more Sight closer.';
  if (s.kind === 'hollow') return s.known < 1 ? 'Listen from a distance to learn how strong it is (it costs a little Nerve).' : 'Unravel it: best done by an Anchor, standing inside a ward.';
  if (s.known < 2) return 'Listen to it to learn what it wants.';
  if (s.calm < 2 && s.need === 'object') return 'Search their house for something of theirs, then give it back to them.';
  if (s.calm < 2) return `Give it what it wants: ${NEED_TEXT[s.need]}.`;
  if (s.kind === 'remnant') return s.known >= 3 && s.calm >= 3 ? 'They are ready: lay them to rest, or ask them home.' : 'At peace: lay them to rest (or calm them further and ask them home).';
  return 'Won over enough: befriend it, and it goes to the Folk.';
}

/** A small action menu at the cursor, for a spirit, a teammate, or where someone stands. */
export class ClearingMenu {
  private el: HTMLElement;
  private tipEl: HTMLElement;
  constructor(private col: Colony, act: MenuActions) {
    this.el = document.getElementById('veil-menu')!;
    this.tipEl = document.getElementById('veil-tip')!;
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || b.disabled) return;
      const d = b.dataset;
      if (d.verb) act.onAct(Number(d.by), d.verb as Verb, d.target !== undefined ? Number(d.target) : undefined);
      else if (d.go) { const [x, z] = d.go.split(',').map(Number); act.onApproach(Number(d.by), { x, z }); }
      else if (d.sel) act.onSelect(Number(d.sel));
      this.close();
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
  }
  get isOpen() { return !this.el.hidden; }
  close() { this.el.hidden = true; }

  tip(x: number, y: number, text: string | null) {
    if (!text || this.isOpen) { this.tipEl.hidden = true; return; }
    this.tipEl.hidden = false;
    this.tipEl.textContent = text;
    this.tipEl.style.left = `${x + 14}px`;
    this.tipEl.style.top = `${y + 10}px`;
  }

  /** `approach`: the best place to walk to beside the target, if it is out of reach. */
  open(x: number, y: number, cl: Clearing, sel: number, target: MenuTarget, approach: { x: number; z: number; beside: boolean; cost: number } | null) {
    const col = this.col, h = col.haunts[cl.haunt];
    const u = cl.units.find((q) => q.id === sel && q.state === 'in');
    const item = (verb: Verb, ok: boolean, why: string | undefined, target?: number, label = VERB_LABEL[verb]) =>
      `<button type="button" data-verb="${verb}" data-by="${u?.id}" ${target !== undefined ? `data-target="${target}"` : ''} ${ok ? '' : 'disabled'} title="${esc(VERB_TIP[verb])}">
        <span>${esc(label)}</span><i>${VERB_COST[verb]} action${VERB_COST[verb] > 1 ? 's' : ''}</i>${!ok && why ? `<em>${esc(why)}</em>` : ''}</button>`;
    let head = '', body = '';
    if (!u) {
      head = '<b>Choose one of your people first</b>';
    } else if ('spirit' in target) {
      const s = h.spirits.find((q) => q.id === target.spirit);
      if (!s) return;
      const r = readingOf(col, u, s);
      const best = teamReading(col, cl, s);
      const shown: Reading = RANKS.indexOf(r) >= RANKS.indexOf(best) ? r : best;
      const facts: string[] = [];
      if (s.kind === 'hollow' && s.known >= 1) facts.push(`hold ${s.integrity}`);
      else if (s.known >= 2) facts.push(`wants ${NEED_TEXT[s.need]}`, s.calm >= 2 ? 'at peace' : `calm ${s.calm} of 2`);
      else if (s.known >= 1) facts.push(s.calm >= 2 ? 'at peace' : `calm ${s.calm} of 2`);
      const d = dist(col, u, s);
      head = `<b>${esc(spiritLabel(s, shown === 'none' ? 'chill' : shown))}</b>
        <span>${esc(u.name)} · ${u.ap} action${u.ap === 1 ? '' : 's'} left · ${d <= BESIDE ? 'beside it' : `${Math.round(d)} paces away`}</span>
        ${facts.length ? `<span>${esc(facts.join(' · '))}</span>` : ''}
        <p class="next">${esc(nextStep(s, shown))}</p>`;
      const vs = verbsFor(col, cl, u, s);
      if (d > BESIDE && approach) body += `<button type="button" data-go="${approach.x},${approach.z}" data-by="${u.id}"><span>${approach.beside ? 'Walk beside it' : 'Walk toward it'}</span><i>${approach.cost} action${approach.cost > 1 ? 's' : ''}</i></button>`;
      body += vs.map((v) => item(v.verb, v.ok, v.why, s.id)).join('');
    } else if ('ally' in target) {
      const a = cl.units.find((q) => q.id === target.ally && q.state === 'in');
      if (!a) return;
      head = `<b>${esc(a.name)}</b><span>Nerve ${Math.max(0, a.nerve)} of ${a.maxNerve}${a.anchor ? ' · Anchor' : a.sight >= 40 ? ' · Seer' : ''}</span>`;
      const near = dist(col, u, a) <= BESIDE;
      body += item('steady', near && u.ap >= 1, near ? 'No actions left.' : `${u.name} must stand beside them.`, a.id, `${u.name}: steady ${a.name}`);
      if (!near && approach) body += `<button type="button" data-go="${approach.x},${approach.z}" data-by="${u.id}"><span>${u.name}: walk beside ${esc(a.name)}</span></button>`;
      body += `<button type="button" data-sel="${a.id}"><span>Switch to ${esc(a.name)}</span></button>`;
    } else {
      head = `<b>${esc(u.name)}</b><span>Nerve ${Math.max(0, u.nerve)} of ${u.maxNerve} · ${u.ap} action${u.ap === 1 ? '' : 's'} left</span>`;
      body += item('ward', cl.wardsLeft > 0 && u.ap >= 1, cl.wardsLeft <= 0 ? 'No lanterns left.' : 'No actions left.', undefined, `Ward here (${cl.wardsLeft} lantern${cl.wardsLeft === 1 ? '' : 's'} left)`);
    }
    this.el.innerHTML = `<div class="mh">${head}</div><div class="mb">${body}</div>`;
    this.el.hidden = false;
    const w = this.el.offsetWidth, hgt = this.el.offsetHeight;
    this.el.style.left = `${Math.min(window.innerWidth - w - 8, x + 8)}px`;
    this.el.style.top = `${Math.min(window.innerHeight - hgt - 8, y + 8)}px`;
    this.tipEl.hidden = true;
  }
}
const RANKS: Reading[] = ['none', 'chill', 'luminous', 'coherent'];
