import type { Colony } from '../sim/colony';
import { dayOf, fireWood, hourOf } from '../sim/colony';
import {
  dayOfSeason, daysUntilWinter, seasonOf, yearOf, DAYS_PER_SEASON, SEASON_NAMES, WEATHER_NAMES,
} from '../sim/calendar';
import { alive, bondKind, bondValue, communityMorale, type Survivor } from '../sim/community';
import { PSI, ROLES, TRAITS, type RoleId } from '../sim/data';
import { Zone, exploredFraction } from '../sim/world';
import { landWanted, standingWord, type FolkFocus } from '../sim/folk';
import { FOLK_SUITED, canClear } from '../sim/haunt';
import type { DistrictKind } from '../sim/oldworld';

const DISTRICT_BLURB: Record<DistrictKind, string> = {
  suburb: 'A close of houses round a turning circle. Doors open, gardens gone to meadow.',
  strip: 'A row of shops round a car park, the signs still up.',
  works: 'A works yard and a steel shed full of pigeons.',
  farmstead: 'A barn and a silo, the fields long since hedges.',
  oldtown: 'An old high street and a chapel, ivy to the gutters.',
  garden: 'A garden centre, its glasshouses run wild.',
};
import { bedsTotal, heatNeed, outstanding, storageCapacity, type Building, type Project } from '../sim/buildings';
import { LORE, communitySight, growthFactor, healFactor, homeResonance } from '../sim/veil';
import { ASPIRATIONS, SKILLED, knowers, skill } from '../sim/purpose';
import { YARD, homeComfort, householdName, householdOf, waitingHouseholds } from '../sim/homes';
import { fisheryOf } from '../sim/fishing';
import { CALM_COST, DREAM_COST, OMEN_COST, resolvable } from '../sim/council';

/** What each kind of building is for, in plain words. */
const BUILDING_INFO: Record<string, string> = {
  store: 'The building they found and first sheltered in. Clearing it out gives beds; patching its fallen roof gives more. Once most people have homes, the council may turn it into a hall for shared suppers and winter evenings.',
  annex: 'A lean-to built against the old shelter. 2 more beds.',
  hut: 'A bunkhouse: shared beds for people without a home of their own yet.',
  home: 'A household\'s own house on its own plot. They sleep and cook here, spend some evenings in, and improve the yard behind it over the seasons. Burns firewood in winter.',
  garden: 'A kitchen garden. Tended daily, it adds a little food in summer and autumn.',
  workshop: 'The workbench. With it, and some practice, they learn to work timber.',
  kitchen: 'The canopy kitchen. Hot meals lift everyone\'s morale.',
  lantern: 'A wisp lantern. Lights the dark between houses (a little morale each) and thins the Veil nearby.',
  cellar: 'A root cellar. Keeps food from spoiling: more room in the stores.',
  shrine: 'A shrine. Raises Resonance around it; a place to leave things for the unseen.',
  jetty: 'A jetty out over the pond. Fishers sit at its end; in winter they cut holes in the ice beside it.',
  fishhut: 'The fishing hut, with racks for drying and smoking the catch: smoked fish keeps (more room in the stores). Fishers eat here instead of walking home.',
  netshed: 'The net shed, where nets are mended. Fishers who know net-mending catch half again as much once there is one. In heavy rain they work here.',
  boat: 'A rowing boat. Out in the middle is where the big ones are: a third more catch, except in winter.',
};

export type ZoneTool = 'home' | 'field' | 'woodlot' | 'sacred' | 'fishing' | 'wild' | 'erase';

export interface HudActions {
  onKill(id: number): void;
  onRecruit(): void;
  onRole(id: number, role: RoleId): void;
  onRotate(dir: 1 | -1): void;
  onSpeed(level: number): void;
  onSelect(id: number): void;
  onFollow(): void;
  onZoneTool(mode: ZoneTool | null): void;
  onCouncil(id: number, dream: boolean): void;
  onVeilView(): void;
  onCalm(): void;
  onOmen(): void;
  onFolkFocus(focus: FolkFocus): void;
  onClear(haunt: number, team: number[]): void;
  onGive(district: number, to: 'village' | 'folk'): void;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class Hud {
  private labelsOn = true;
  private labelEls = new Map<number, HTMLDivElement>();
  private killArmed = false;
  private selected = 0;
  private lastLog = -1;
  private rosterKey = '';
  private zoneMode: ZoneTool | null = null;

  private veilView = false;
  private omenMode = false;
  private councilKey = '';
  private councilOpen = false;
  private loreOpen = false;
  private inspecting: { building?: number; project?: number; folk?: boolean; district?: number } | null = null;
  /** The team being chosen for a clearing. */
  private team = new Set<number>();
  private teamFor = -1;

  constructor(private col: Colony, act: HudActions) {
    $('rot-l').addEventListener('click', () => act.onRotate(-1));
    $('rot-r').addEventListener('click', () => act.onRotate(1));
    $('recruit-btn').addEventListener('click', () => act.onRecruit());
    $('labels-btn').addEventListener('click', () => this.toggleLabels());
    $('follow-btn').addEventListener('click', () => act.onFollow());
    document.querySelectorAll<HTMLButtonElement>('[data-zone]').forEach((b) => b.addEventListener('click', () => {
      const z = b.dataset.zone as ZoneTool;
      this.setZoneMode(this.zoneMode === z ? null : z);
      act.onZoneTool(this.zoneMode);
    }));
    for (let i = 0; i < 4; i++) $(`spd-${i}`).addEventListener('click', () => act.onSpeed(i));
    $('toggle-roster').addEventListener('click', () => {
      const r = $('roster');
      r.classList.toggle('collapsed');
      $('toggle-roster').textContent = r.classList.contains('collapsed') ? 'Show' : 'Hide';
    });
    const killBtn = $<HTMLButtonElement>('kill-btn');
    killBtn.addEventListener('click', () => {
      const id = Number($<HTMLSelectElement>('kill-pick').value);
      if (!id) return;
      if (!this.killArmed) {
        this.killArmed = true;
        killBtn.textContent = 'Confirm: they die';
        setTimeout(() => { this.killArmed = false; killBtn.textContent = 'Lose survivor'; }, 3000);
        return;
      }
      this.killArmed = false;
      killBtn.textContent = 'Lose survivor';
      act.onKill(id);
    });
    $('veil').addEventListener('toggle', (e) => {
      if ((e.target as HTMLElement).classList.contains('lore')) this.loreOpen = (e.target as HTMLDetailsElement).open;
    }, true);
    $('veil').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || b.disabled) return;
      if (b.dataset.v === 'view') act.onVeilView();
      if (b.dataset.v === 'calm') act.onCalm();
      if (b.dataset.v === 'omen') act.onOmen();
      if (b.dataset.v === 'folk') this.inspect({ folk: true });
    });
    $('inspect').addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('#inspect-close')) this.inspect(null);
      const fb = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-focus]');
      if (fb) act.onFolkFocus(fb.dataset.focus as FolkFocus);
      const pick = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-pick]');
      if (pick) {
        const id = Number(pick.dataset.pick);
        if (this.team.has(id)) this.team.delete(id); else if (this.team.size < 4) this.team.add(id);
        this.renderInspect();
      }
      const go = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-clear]');
      if (go && !go.disabled) act.onClear(Number(go.dataset.clear), [...this.team]);
      const give = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-give]');
      if (give) act.onGive(Number(give.dataset.district), give.dataset.give as 'village' | 'folk');
    });
    $('council-open').addEventListener('click', () => { this.councilOpen = true; this.councilKey = ''; this.renderCouncil(); });
    $('council').addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('#council-later')) { this.councilOpen = false; this.councilKey = ''; this.renderCouncil(); return; }
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-prop]');
      if (!b || b.disabled) return;
      const dream = $<HTMLInputElement>('dream')?.checked ?? false;
      act.onCouncil(Number(b.dataset.prop), dream);
    });
    const crew = $('crew');
    crew.addEventListener('change', (e) => {
      const sel = e.target as HTMLSelectElement;
      if (sel.dataset.id) act.onRole(Number(sel.dataset.id), sel.value as RoleId);
    });
    crew.addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      if (el.closest('select')) return;
      const card = el.closest<HTMLElement>('.card');
      if (card?.dataset.id) act.onSelect(Number(card.dataset.id));
    });
  }

  toggleLabels() {
    this.labelsOn = !this.labelsOn;
    $('labels').hidden = !this.labelsOn;
  }

  setSpeed(level: number) {
    for (let i = 0; i < 4; i++) $(`spd-${i}`).setAttribute('aria-pressed', String(i === level));
  }

  setZoneMode(mode: ZoneTool | null) {
    this.zoneMode = mode;
    document.querySelectorAll<HTMLButtonElement>('[data-zone]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.zone === mode)));
    document.body.classList.toggle('painting', mode !== null);
  }

  setFollowing(on: boolean) {
    $('follow-btn').setAttribute('aria-pressed', String(on));
    $('follow-btn').textContent = on ? 'Following' : 'Follow';
  }

  select(id: number) {
    this.selected = id;
    this.rosterKey = '';
    this.render();
    const card = document.querySelector<HTMLElement>(`.card[data-id="${id}"]`);
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  updateClock(heading: number) {
    const h = hourOf(this.col);
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    const dir = COMPASS[Math.round(heading / 45) % 8];
    const txt = `Day ${dayOf(this.col)} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · facing ${dir}`;
    const el = $('clock');
    if (el.textContent !== txt) el.textContent = txt;
    const cp = $('compass');
    if (cp.textContent !== dir) cp.textContent = dir;
    const day = dayOf(this.col);
    const season = `Year ${yearOf(day)} · ${SEASON_NAMES[seasonOf(day)]}, day ${dayOfSeason(day)} of ${DAYS_PER_SEASON} · ${WEATHER_NAMES[this.col.weather]}`;
    const se = $('season');
    if (se.textContent !== season) se.textContent = season;
  }

  placeLabels(project: (id: number, out: { x: number; y: number }) => boolean) {
    if (!this.labelsOn) return;
    const out = { x: 0, y: 0 };
    const living = new Set(this.col.agents.map((a) => a.id));
    for (const [id, el] of this.labelEls) {
      if (!living.has(id)) { el.remove(); this.labelEls.delete(id); }
    }
    for (const a of this.col.agents) {
      let el = this.labelEls.get(a.id);
      if (!el) {
        const s = this.col.community.survivors.find((x) => x.id === a.id)!;
        el = document.createElement('div');
        el.className = 'label';
        el.textContent = s.name.split(' ')[0];
        $('labels').appendChild(el);
        this.labelEls.set(a.id, el);
      }
      if (project(a.id, out)) {
        el.style.left = `${out.x}px`;
        el.style.top = `${out.y}px`;
        el.hidden = false;
      } else el.hidden = true;
    }
  }

  /** Cheap refresh for fast-changing values; full rebuild only when structure changes. */
  render() {
    const c = this.col.community;
    const r = c.resources;
    const morale = communityMorale(c);
    const res: [string, string, string][] = [
      ['Food', Math.floor(r.food).toString(), ''],
      ['Wood', Math.floor(r.wood).toString(), ''],
      ['Scrap', Math.floor(r.scrap).toString(), ''],
      ['Glimmer', r.glimmer.toFixed(1), 'glimmer'],
      ['Morale', morale.toFixed(0), morale < 40 ? 'morale low' : 'morale'],
      ['Influence', Math.floor(this.col.veil.influence).toString(), 'influence'],
      ['Explored', `${(exploredFraction(this.col.world) * 100).toFixed(1)}%`, ''],
    ];
    const resHtml = res.map(([k, v, cls]) => `<div class="res ${cls}"><b>${v}</b><span>${k}</span></div>`).join('');
    if ($('res').innerHTML !== resHtml) $('res').innerHTML = resHtml;

    const living = alive(c);
    const key = living.map((s) => `${s.id}:${s.role}:${s.griefDays > 0}`).join('|') + `#${this.selected}#${c.bonds.map((b) => bondKind(b.value)).join('')}`;
    if (key !== this.rosterKey) {
      this.rosterKey = key;
      $('crew-title').textContent = `The Crew · ${living.length}`;
      $('crew').innerHTML = living.map((s) => this.card(s)).join('');
      const pick = $<HTMLSelectElement>('kill-pick');
      const prev = pick.value;
      pick.innerHTML = living.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
      if (living.some((s) => String(s.id) === prev)) pick.value = prev;
    }
    // Live parts of each card.
    for (const a of this.col.agents) {
      const card = document.querySelector<HTMLElement>(`.card[data-id="${a.id}"]`);
      if (!card) continue;
      const s = living.find((x) => x.id === a.id)!;
      const act = card.querySelector<HTMLElement>('.activity')!;
      if (act.textContent !== a.activity) {
        act.textContent = a.activity;
        act.classList.toggle('idle', a.anim === 'idle' || a.anim === 'sleep');
      }
      const home = card.querySelector<HTMLElement>('.home')!;
      const ht = this.homeLine(s.id) + this.hopeLine(s);
      if (home.innerHTML !== ht) home.innerHTML = ht;
      this.setBar(card, 'mor', s.morale, 100, `${Math.round(s.morale)}`);
      this.setBar(card, 'hp', s.hp, s.maxHp, `${Math.max(0, Math.round(s.hp))}/${s.maxHp}`);
      this.setBar(card, 'sight', s.sight, 100, `${Math.round(s.sight)}`);
      this.setBar(card, 'food', a.needs.food, 100);
      this.setBar(card, 'rest', a.needs.rest, 100);
      this.setBar(card, 'social', a.needs.social, 100);
    }

    this.renderVillage();

    if (c.log.length !== this.lastLog) {
      this.lastLog = c.log.length;
      const fallen = c.survivors.filter((s) => !s.alive && !s.taken);
      const missing = c.survivors.filter((s) => s.taken);
      const lines = c.log.slice(-8).map((l) => `<p class="${l.tone}"><span class="d">D${l.day}</span>${esc(l.text)}</p>`);
      if (fallen.length) lines.unshift(`<p><span class="d">MEM</span>Remembered: ${fallen.map((f) => esc(f.name)).join(', ')}</p>`);
      if (missing.length) lines.unshift(`<p class="strange"><span class="d">VEIL</span>Taken, and waited for: ${missing.map((f) => esc(f.name)).join(', ')}</p>`);
      const log = $('log');
      log.innerHTML = lines.join('');
      log.scrollTop = log.scrollHeight;
    }
  }

  private renderVillage() {
    const v = this.col.village;
    const pop = this.col.agents.length;
    const beds = bedsTotal(v);
    const bedsTxt = `beds ${beds}/${pop}`;
    if ($('beds').textContent !== bedsTxt) $('beds').textContent = bedsTxt;
    const active = v.projects.filter((p) => !p.done);
    const joiners = knowers(this.col.community, 'joinery').map((s) => s.name.split(' ')[0]);
    const tier = `<span class="tier t${v.tier}" title="What they know how to build with. Joinery is learned by building, fastest beside someone who knows it, and lost if everyone who knows it is gone.">${
      v.tier === 1 ? `Joinery · ${esc(joiners.join(', '))}` : joiners.length ? `Joinery · ${esc(joiners.join(', '))} (needs a workbench)` : 'Salvage only'}</span>`
      + (() => {
        const nets = knowers(this.col.community, 'netmending').map((s) => s.name.split(' ')[0]);
        return nets.length ? `<span class="tier t1" title="Net-mending: fishers who know it catch half again as much, once there is a net shed.">Nets · ${esc(nets.join(', '))}</span>` : '';
      })();
    const built = v.buildings.filter((b) => b.kind !== 'store').length;
    const html = (active.length
      ? active.map((p) => {
        const pct = Math.min(100, (p.work / p.workNeeded) * 100);
        return `<div class="proj"><div class="n">${esc(p.name)}</div><div class="st">${esc(this.status(p))}</div>
          <div class="bar"><i style="width:${pct.toFixed(0)}%"></i></div></div>`;
      }).join('')
      : `<div class="empty">Nothing planned. They'll think of something when the village needs it.</div>`)
      + this.waitingLine()
      + `<div class="st" style="display:flex;gap:8px;align-items:center;font-size:11.5px;color:var(--ink-dim)">${tier}<span>${built} built</span></div>`;
    if ($('projects').innerHTML !== html) $('projects').innerHTML = html;
    this.renderWinter();
    this.renderInspect();
    this.renderVeil();
    this.renderCouncil();
  }

  private waitingLine(): string {
    const v = this.col.village, c = this.col.community;
    const waiting = waitingHouseholds(v);
    if (!waiting.length) return '';
    const names = waiting.map((h) => `${householdName(c, h)}${v.homeQueue.includes(h.id) ? ' ✓' : ''}`);
    return `<div class="st" style="font-size:11.5px;color:var(--ink-dim);margin:2px 0 6px">Waiting for homes: ${esc(names.join(' · '))}</div>`;
  }

  setVeilView(on: boolean) { this.veilView = on; }

  inspect(target: { building?: number; project?: number; folk?: boolean; district?: number } | null) {
    this.inspecting = target;
    this.renderInspect();
  }

  private renderInspect() {
    const el = $('inspect');
    const t = this.inspecting;
    const col = this.col;
    if (!t) { el.hidden = true; return; }
    let html = '';
    const name = (id: number) => col.community.survivors.find((s) => s.id === id)?.name.split(' ')[0] ?? '?';
    if (t.building !== undefined) {
      const b = col.village.buildings.find((x) => x.id === t.building);
      if (!b) { this.inspecting = null; el.hidden = true; return; }
      const sleepers = [...col.beds.entries()].filter(([, v]) => v === b.id).map(([k]) => name(k));
      const facts: [string, string][] = [];
      if (b.beds) facts.push(['Beds', `${sleepers.length} of ${b.beds} used${sleepers.length ? `: ${sleepers.join(', ')}` : ''}`]);
      if (heatNeed(b)) facts.push(['Winter firewood', `${heatNeed(b)} a day when occupied`]);
      if (b.kind === 'cellar') facts.push(['Stores keep', `${Math.floor(storageCapacity(col.village))} food in all`]);
      if (b.kind === 'garden') facts.push(['Tended today', b.tended >= 60 ? 'Yes' : 'Not yet']);
      const fishery = fisheryOf(col.village, b);
      if (fishery) {
        const pond = col.world.ponds[fishery.pond];
        const pct = Math.round((pond.stock / pond.max) * 100);
        facts.push(['Pond', `${pond.name}: fish stock ${pct}%${pct < 30 ? ' (fished thin; it needs a rest)' : pct < 60 ? ' (being fished hard)' : ''}`]);
        const fishers = alive(col.community).filter((s) => s.role === 'fisher').map((s) => s.name.split(' ')[0]);
        facts.push(['Fishers', fishers.length ? fishers.join(', ') : 'Nobody yet (set someone\'s role to Fisher)']);
        facts.push(['Caught this year', `${Math.round(col.ledger.fishing ?? 0)} food`]);
      }
      if (b.kind === 'store') {
        facts.push(['State', ['Derelict', 'Cleared', 'Roof patched', 'Hall'][b.level] ?? '']);
        facts.push(['This place', col.village.site.perk]);
        // What the scrap pile actually is, and where it came from.
        const byMat = new Map<string, { n: number; from: Map<string, number> }>();
        for (const [k, n] of Object.entries(col.village.salvaged)) {
          const [m, from] = k.split('|');
          const e = byMat.get(m) ?? { n: 0, from: new Map() };
          e.n += n; e.from.set(from, (e.from.get(from) ?? 0) + n);
          byMat.set(m, e);
        }
        const top = [...byMat.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5);
        if (top.length) {
          facts.push(['Salvage brought in', top.map(([m, e]) => {
            const src = [...e.from.entries()].sort((a, b) => b[1] - a[1])[0][0];
            return `${m} (${e.n}, mostly from ${src})`;
          }).join('; ')]);
        }
      }
      if (b.kind === 'home') {
        const plot = col.village.plots.find((p) => p.id === b.plot);
        const h = col.village.households.find((x) => x.id === b.household);
        facts.unshift(['Household', h ? householdName(col.community, h) : 'Empty']);
        if (plot) {
          const done = plot.yard.filter((y) => y.progress >= 1).map((y) => YARD[y.kind].name);
          const next = plot.yard.find((y) => y.progress < 1);
          facts.push(['Yard', done.length ? cap(done.join(', ')) : 'Bare ground so far']);
          if (next) facts.push(['Next', `${cap(YARD[next.kind].name)}${next.progress > 0 ? ` (${Math.round(next.progress * 100)}%)` : ''}`]);
          facts.push(['Comfort', `+${homeComfort(col.village, b).toFixed(1)} morale for those who live here`]);
        }
      }
      const build = (b as Building).tier === 1 ? 'Timber' : 'Salvage';
      if (b.kind === 'home') {
        const plot = col.village.plots.find((p) => p.id === b.plot);
        facts.push(['State', ['A salvage shack', 'Patched up', 'Well kept: glasshouse and solar panels'][b.level] ?? '']);
        if (plot?.house.clad?.length) facts.push(['Built from', cap(plot.house.clad.join(', '))]);
      } else if (b.kind !== 'store' && b.kind !== 'kitchen' && b.kind !== 'lantern') facts.push(['Built from', build]);
      html = `<h3>${esc(cap(b.name))}<button type="button" id="inspect-close">Close</button></h3>
        <div class="what">${esc(BUILDING_INFO[b.kind] ?? '')}</div>
        <div class="facts">${facts.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div>`;
    } else if (t.folk) {
      html = this.folkCard();
    } else if (t.district !== undefined) {
      html = this.districtCard(t.district);
    } else if (t.project !== undefined) {
      const p = col.village.projects.find((x) => x.id === t.project);
      if (!p || p.done) { this.inspecting = null; el.hidden = true; return; }
      html = `<h3>${esc(p.name)}<button type="button" id="inspect-close">Close</button></h3>
        <div class="what">Under construction. ${esc(BUILDING_INFO[p.kind] ?? '')}</div>
        <div class="facts"><span>Status</span><b>${esc(this.status(p))}</b></div>`;
    }
    if (el.innerHTML !== html) el.innerHTML = html;
    el.hidden = false;
  }
  private districtCard(id: number): string {
    const col = this.col, d = col.world.districts[id];
    const hi = col.haunts.findIndex((x) => x.district === id);
    const h = col.haunts[hi];
    if (!d || !h) return '';
    const facts: [string, string][] = [];
    const suits = FOLK_SUITED.includes(d.kind) ? 'The Folk would love it (quiet, green, old).' : 'Better suited to the village: roofs and salvage.';
    const known = h.spirits.filter((s) => s.known >= 1);
    const unknownN = h.spirits.length - known.length;
    if (h.state === 'unknown') facts.push(['What lives here', 'Nobody has been close enough to feel it.']);
    else if (h.state === 'cleared') facts.push(['State', h.owner === 'folk' ? 'Quiet, and left to the Folk.' : h.owner === 'village' ? 'Quiet, and the village\'s.' : 'Quiet. Who should have it?']);
    else {
      facts.push(['What lives here', [...known.map((s) => `${cap(s.name)}${s.fate !== 'present' ? ` (${s.fate === 'rested' ? 'at rest' : s.fate === 'unravelled' ? 'unravelled' : s.fate === 'banished' ? 'banished' : s.fate === 'invited' ? 'came home' : 'with the Folk'})` : ''}`), unknownN ? `${unknownN} ${unknownN === 1 ? 'presence' : 'presences'} nobody has made out yet` : ''].filter(Boolean).join('; ')]);
      facts.push(['Effect', 'Nothing can be zoned here; salvage near them is left alone.']);
    }
    facts.push(['Suits', suits]);
    let body = '';
    if (h.state === 'cleared' && !h.owner) {
      body = `<div class="h" style="margin-top:8px">Who should have it</div><div class="row">
        <button type="button" data-give="village" data-district="${id}">The village</button>
        <button type="button" data-give="folk" data-district="${id}">The Folk</button></div>`;
    } else if (h.state !== 'cleared') {
      const why = canClear(col, h);
      if (this.teamFor !== id) {
        // Suggest two who see and two who don't: seers to read the spirits, anchors to hold.
        this.teamFor = id;
        const by = [...alive(col.community)].sort((a, b) => b.sight - a.sight);
        this.team = new Set([by[0], by[1], by[by.length - 1], by[by.length - 2]].filter(Boolean).map((s) => s.id));
      }
      const people = alive(col.community).map((s) => {
        const tag = s.sight >= 40 ? 'Seer' : s.sight < 30 ? 'Anchor' : '';
        return `<button type="button" data-pick="${s.id}" aria-pressed="${this.team.has(s.id)}" title="Sight ${Math.round(s.sight)} · morale ${Math.round(s.morale)}">${esc(s.name.split(' ')[0])}${tag ? ` · ${tag}` : ''}</button>`;
      }).join('');
      body = `<div class="h" style="margin-top:8px">Send a team into the Veil (up to four)</div>
        <div class="what" style="font-size:12px">Seers (high Sight) can see and speak with what lives here, but it frightens them. Anchors (low Sight) barely feel it, and steady the others. No time passes at home while they are gone. Nobody dies in the Veil, but people can be rattled, or taken.</div>
        <div class="row">${people}</div>
        <div class="row"><button type="button" class="primary" data-clear="${hi}" ${why || !this.team.size ? 'disabled' : ''} title="${esc(why ?? '')}">Into the Veil${this.team.size ? ` · ${this.team.size}` : ''}</button>${why ? `<span class="st">${esc(why)}</span>` : ''}</div>`;
    }
    return `<h3>${esc(d.name)}<button type="button" id="inspect-close">Close</button></h3>
      <div class="what">${esc(DISTRICT_BLURB[d.kind])}</div>
      <div class="facts">${facts.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div>${body}`;
  }

  private folkCard(): string {
    const col = this.col, f = col.folk, m = col.world.folk.mound;
    const word = standingWord(f.standing);
    let land = 0;
    for (const z of col.world.zone) if (z === Zone.Wild) land++;
    const want = landWanted(f);
    const known = f.beings.filter((b) => b.known);
    const facts: [string, string][] = [
      ['Standing', `${cap(word)} (${Math.round(f.standing)})`],
      ['Their people', f.met ? `${f.beings.length}${known.length ? `: ${known.map((b) => b.name).join(', ')}${known.length < f.beings.length ? ', and others' : ''}` : ''}` : 'Nobody has met them yet. Lights at dusk.'],
      ['Their land', `${land} tiles of Wild${land >= want ? ' (room to grow)' : land < want * 0.8 ? ` (crowded; they want about ${want})` : ` (enough; they would grow with ${want})`}`],
      ['The hill', f.level ? `Grown ${f.level} time${f.level > 1 ? 's' : ''} · next ${Math.round(f.growth * 100)}%` : `Next growth ${Math.round(f.growth * 100)}%`],
    ];
    if (f.rules.length) facts.push(['Their rules', f.rules.join(' ')]);
    const FOCUS: [FolkFocus, string, string][] = [
      ['woods', 'The woods', 'They plant and knit the Wild: saplings, and the Veil runs thick around the hill.'],
      ['village', 'The village', 'Once friendly, they come down at night: hauling, weeding, an hour on a building.'],
      ['home', 'Their hill', 'They build: toadstool rings, lanterns, bowers. The hill grows faster, if it has room.'],
    ];
    const focus = FOCUS.map(([k, label, tip]) => `<button type="button" data-focus="${k}" aria-pressed="${f.focus === k}" title="${esc(tip)}">${label}</button>`).join('');
    const news = f.news.slice(-3).reverse().map((n) => `<p><span class="d">D${n.day}</span>${esc(n.text)}</p>`).join('');
    return `<h3>${esc(cap(m.name))}<button type="button" id="inspect-close">Close</button></h3>
      <div class="what">A green hill with a door in it, and the Folk who live inside. They were here before the roads. They share the land if the village keeps its distance and their ways. Paint the Wild to give them room.</div>
      <div class="facts">${facts.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div>
      <div class="h" style="margin-top:8px">What they give their nights to</div>
      <div class="row">${focus}</div>
      ${news ? `<div class="folk-news">${news}</div>` : ''}`;
  }

  setOmenMode(on: boolean) { this.omenMode = on; document.body.classList.toggle('omen', on); }

  private renderVeil() {
    const col = this.col;
    const inf = col.veil.influence;
    const hr = homeResonance(col);
    const sel = this.selected;
    const pct = (hr * 100).toFixed(0);
    const effects = [`land ×${(growthFactor(hr) * (col.community.day < col.veil.mothBlessing ? 1.12 : 1)).toFixed(2)}`, `healing ×${healFactor(hr).toFixed(2)}`];
    if (col.community.day < col.veil.mothBlessing) effects.push('moth-blessed');
    if (col.veil.thinSleep) effects.push('thin sleep, blight');
    const lore = col.veil.lore.map((i) => `<li>${esc(LORE[i])}</li>`).join('');
    const html = `<div class="h">The Veil</div>
      <div class="ready veil"><span>Resonance</span><div class="bar"><i style="width:${pct}%"></i></div><span>${pct}%</span></div>
      <div class="effects" title="Resonance at home: how the land answers. Crops, berries and gardens grow with it; wounds heal with it. Too low, and sleep comes thin and blight gets in.">${esc(effects.join(' · '))}</div>
      <div class="ready veil"><span>Sight</span><div class="bar"><i style="width:${communitySight(col).toFixed(0)}%"></i></div><span>${communitySight(col).toFixed(0)}</span></div>
      <div class="row">
        <button type="button" data-v="view" aria-pressed="${this.veilView}" title="Show Resonance on the land (V)">Veil view</button>
        <button type="button" data-v="calm" ${sel && inf >= CALM_COST ? '' : 'disabled'} title="${sel ? 'Quiet the selected survivor\'s troubles' : 'Select a survivor first'}">Calm · ${CALM_COST}</button>
        <button type="button" data-v="omen" aria-pressed="${this.omenMode}" ${inf >= OMEN_COST ? '' : 'disabled'} title="Click the map: light a way through the mist for the scouts">Omen · ${OMEN_COST}</button>
        <button type="button" data-v="folk" title="${esc(cap(col.world.folk.mound.name))}: the Folk of the hill. Their standing, their land, what they do at night.">Folk · ${standingWord(col.folk.standing)}</button>
      </div>
      ${lore ? `<details class="lore" ${this.loreOpen ? 'open' : ''}><summary>What they've learned · ${col.veil.lore.length} of ${LORE.length}</summary><ol>${lore}</ol></details>` : ''}`;
    if ($('veil').innerHTML !== html) $('veil').innerHTML = html;
  }

  private renderCouncil() {
    const col = this.col;
    const active = col.council.active;
    const el = $('council');
    const bar = $('council-bar');
    if (!active) {
      if (!el.hidden) el.hidden = true;
      if (!bar.hidden) bar.hidden = true;
      this.councilKey = '';
      this.councilOpen = false;
      return;
    }
    if (!this.councilOpen) {
      el.hidden = true;
      if (bar.hidden) {
        bar.hidden = false;
        $('council-open').textContent = `The council is meeting · ${active.proposals.length} voices · hear them`;
      }
      return;
    }
    bar.hidden = true;
    const key = active.proposals.map((p) => `${p.id}:${resolvable(col, p)}`).join(',') + `:${col.veil.influence >= DREAM_COST}`;
    if (key === this.councilKey && !el.hidden) return;
    this.councilKey = key;
    const c = col.community;
    const name = (id: number) => c.survivors.find((s) => s.id === id)?.name.split(' ')[0] ?? '?';
    const living = c.survivors.filter((s) => s.alive).length;
    const cost = (p: typeof active.proposals[number]) => [
      p.cost.food ? `${p.cost.food} food` : '', p.cost.wood ? `${p.cost.wood} wood` : '', p.cost.glimmer ? `${p.cost.glimmer} glimmer` : '',
    ].filter(Boolean).join(' · ');
    const dreamOk = col.veil.influence >= DREAM_COST;
    const wasChecked = ($('dream') as HTMLInputElement | null)?.checked ?? false;
    el.innerHTML = `<div class="top"><h2>The council meets</h2><button type="button" id="council-later">Later</button></div>
      <div class="sub">Each of them wants something. Back one; the others will feel passed over.</div>
      ${active.proposals.map((p) => `<div class="prop">
        <div class="t"><b>${esc(p.title)}</b><span class="cost">${esc(cost(p))}</span></div>
        <div><q>${esc(p.pitch)}</q> <span class="who">${esc(name(p.proposer))}</span></div>
        <div class="who">Backed by <em>${p.support.length} of ${living}</em>: ${esc(p.support.map(name).join(', '))}</div>
        <button type="button" class="primary" data-prop="${p.id}" ${resolvable(col, p) ? '' : 'disabled title="Not enough in the stores"'}>Back ${esc(name(p.proposer))}</button>
      </div>`).join('')}
      <div class="foot">
        <label><input id="dream" type="checkbox" ${dreamOk ? '' : 'disabled'} ${wasChecked && dreamOk ? 'checked' : ''}> Send a dream so nobody feels passed over (${DREAM_COST} Influence)</label>
        <span>Stay silent and they'll settle it themselves by tomorrow.</span>
      </div>`;
    el.hidden = false;
  }

  /** The yearly test, made visible: stores against what winter will take. */
  private renderWinter() {
    const col = this.col;
    const day = dayOf(col);
    const pop = col.agents.length;
    const toWinter = daysUntilWinter(day);
    const inWinter = toWinter === 0;
    const daysLeft = inWinter ? DAYS_PER_SEASON - dayOfSeason(day) + 1 : DAYS_PER_SEASON;
    const food = col.community.resources.food, wood = col.community.resources.wood;
    const needFood = Math.round(pop * 1.8 * daysLeft);
    const needWood = Math.round(fireWood(col, 'winter') * daysLeft);
    const beds = bedsTotal(col.village);
    const row = (label: string, have: number, need: number) => {
      const pct = need > 0 ? Math.min(100, (have / need) * 100) : 100;
      return `<div class="ready ${have < need ? 'short' : ''}"><span>${label}</span><div class="bar"><i style="width:${pct.toFixed(0)}%"></i></div><span>${Math.floor(have)}/${need}</span></div>`;
    };
    const head = inWinter ? `Winter · ${daysLeft} day${daysLeft === 1 ? '' : 's'} to spring` : `Winter in ${toWinter} day${toWinter === 1 ? '' : 's'}`;
    const html = `<div class="h">${head}</div>${row('Food', food, needFood)}${row('Firewood', wood, needWood)}${row('Beds', beds, pop)}`;
    if ($('winter').innerHTML !== html) $('winter').innerHTML = html;
  }

  private status(p: Project): string {
    const trees = p.clearTrees.filter((id) => !this.col.world.trees[id].felled).length;
    if (trees) return `Clearing ${trees} tree${trees > 1 ? 's' : ''} from the site`;
    const missing = (['wood', 'scrap', 'glimmer'] as const)
      .filter((m) => p.delivered[m] < p.cost[m])
      .map((m) => `${m} ${p.delivered[m]}/${p.cost[m]}${outstanding(p, m) > 0 && this.col.community.resources[m] < 1 ? ' (none in store)' : ''}`);
    if (missing.length) return `Gathering materials: ${missing.join(' · ')}`;
    if (p.work <= 0) return 'Ready to build';
    return `Building · ${Math.round((p.work / p.workNeeded) * 100)}%`;
  }

  private setBar(card: HTMLElement, key: string, v: number, max: number, text?: string) {
    const bar = card.querySelector<HTMLElement>(`[data-bar="${key}"]`);
    if (!bar) return;
    const pct = Math.max(0, Math.min(100, (v / max) * 100));
    const i = bar.firstElementChild as HTMLElement;
    const w = `${pct.toFixed(0)}%`;
    if (i.style.width !== w) i.style.width = w;
    bar.classList.toggle('low', pct < 35);
    if (text !== undefined) {
      const t = card.querySelector<HTMLElement>(`[data-val="${key}"]`);
      if (t && t.textContent !== text) t.textContent = text;
    }
  }

  /** What someone hopes for, and what they know. */
  private hopeLine(s: Survivor): string {
    const parts: string[] = [];
    if (s.aspiration) parts.push(`Hopes for <em>${esc(ASPIRATIONS[s.aspiration.kind].want)}</em>`);
    for (const [craft, name] of [['joinery', 'joinery'], ['netmending', 'net-mending']] as const) {
      const j = skill(s, craft);
      if (j >= SKILLED) parts.push(`Knows ${name}`);
      else if (j > 0.05) parts.push(`Learning ${name} · ${Math.round((j / SKILLED) * 100)}%`);
    }
    return parts.length ? `<br>${parts.join(' · ')}` : '';
  }

  /** Where someone lives, or what they're waiting for. */
  private homeLine(id: number): string {
    const v = this.col.village, c = this.col.community;
    const h = householdOf(v, id);
    const others = h ? h.members.filter((m) => m !== id).map((m) => c.survivors.find((x) => x.id === m)?.name.split(' ')[0] ?? '?') : [];
    const withWho = others.length ? ` with <em>${esc(others.join(' and '))}</em>` : '';
    if (h?.home) {
      const b = v.buildings.find((x) => x.id === h.home);
      return `Lives${withWho} in <em>${esc(b?.name ?? 'their house')}</em>`;
    }
    const bid = this.col.beds.get(id);
    const where = bid !== undefined ? v.buildings.find((x) => x.id === bid)?.name : undefined;
    const sleeps = where ? `sleeps in ${esc(where)}` : 'sleeps by the fire';
    if (!h) return where ? `Sleeps in ${esc(where)}` : 'Sleeps by the fire';
    const building = v.projects.some((p) => !p.done && p.household === h.id);
    const approved = v.homeQueue.includes(h.id);
    const state = building ? 'their house is going up' : approved ? 'the council said yes to a house' : `waiting on a house for ${c.day - h.since} days`;
    return `Household${withWho} · ${state} · ${sleeps}`;
  }

  private card(s: Survivor): string {
    const c = this.col.community;
    const others = alive(c).filter((o) => o.id !== s.id);
    const close = others.filter((o) => bondKind(bondValue(c, s.id, o.id)) === 'close').map((o) => o.name.split(' ')[0]);
    const rivals = others.filter((o) => bondKind(bondValue(c, s.id, o.id)) === 'rival').map((o) => o.name.split(' ')[0]);
    const traits = s.traits.map((t) => `<span class="chip" title="${esc(TRAITS[t].blurb)}">${TRAITS[t].name}</span>`).join('');
    const psi = s.psi ? `<span class="chip psi" title="${esc(PSI[s.psi].blurb)}">Psi · ${PSI[s.psi].name}</span>` : '';
    const grief = s.griefDays > 0 ? `<span class="chip grief">Grieving</span>` : '';
    const roles = (Object.keys(ROLES) as RoleId[])
      .map((j) => `<option value="${j}" ${j === s.role ? 'selected' : ''} title="${esc(ROLES[j].blurb)}">${ROLES[j].name}</option>`).join('');
    const bonds = [
      close.length ? `Close to <em>${esc(close.join(', '))}</em>` : '',
      rivals.length ? `At odds with <em>${esc(rivals.join(', '))}</em>` : '',
    ].filter(Boolean).join(' · ');
    const bar = (key: string, cls: string) => `<div class="bar ${cls}" data-bar="${key}"><i style="width:0%"></i></div>`;
    return `<div class="card ${s.griefDays > 0 ? 'grieving' : ''} ${s.id === this.selected ? 'selected' : ''}" data-id="${s.id}">
      <div class="row"><span class="name">${esc(s.name)}</span>
        <select data-id="${s.id}" aria-label="Role for ${esc(s.name)}">${roles}</select></div>
      <div class="activity"></div>
      <div class="bg">${s.age}, ${esc(s.background)}</div>
      <div class="chips">${traits}${psi}${grief}</div>
      <div class="bars">
        <span>MOR</span>${bar('mor', '')}<span data-val="mor"></span>
        <span>HP</span>${bar('hp', 'hp')}<span data-val="hp"></span>
        <span>SIGHT</span>${bar('sight', 'sight')}<span data-val="sight"></span>
      </div>
      <div class="needs">
        <div>FOOD${bar('food', 'need')}</div><div>REST${bar('rest', 'need')}</div><div>COMPANY${bar('social', 'need')}</div>
      </div>
      ${bonds ? `<div class="bonds">${bonds}</div>` : ''}
      <div class="bonds home"></div>
    </div>`;
  }
}

