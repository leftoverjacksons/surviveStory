import type { Colony } from '../sim/colony';
import { dayOf, hourOf } from '../sim/colony';
import { alive, bondKind, bondValue, communityMorale, type Survivor } from '../sim/community';
import { PSI, ROLES, TRAITS, type RoleId } from '../sim/data';
import { exploredFraction } from '../sim/world';
import { bedsTotal, outstanding, type Project } from '../sim/buildings';

export interface HudActions {
  onKill(id: number): void;
  onRecruit(): void;
  onRole(id: number, role: RoleId): void;
  onRotate(dir: 1 | -1): void;
  onSpeed(level: number): void;
  onSelect(id: number): void;
  onFollow(): void;
  onZoneTool(mode: 'add' | 'del' | null): void;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class Hud {
  private labelsOn = true;
  private labelEls = new Map<number, HTMLDivElement>();
  private killArmed = false;
  private selected = 0;
  private lastLog = -1;
  private rosterKey = '';
  private zoneMode: 'add' | 'del' | null = null;

  constructor(private col: Colony, act: HudActions) {
    $('rot-l').addEventListener('click', () => act.onRotate(-1));
    $('rot-r').addEventListener('click', () => act.onRotate(1));
    $('recruit-btn').addEventListener('click', () => act.onRecruit());
    $('labels-btn').addEventListener('click', () => this.toggleLabels());
    $('follow-btn').addEventListener('click', () => act.onFollow());
    $('zone-add').addEventListener('click', () => { this.setZoneMode(this.zoneMode === 'add' ? null : 'add'); act.onZoneTool(this.zoneMode); });
    $('zone-del').addEventListener('click', () => { this.setZoneMode(this.zoneMode === 'del' ? null : 'del'); act.onZoneTool(this.zoneMode); });
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

  setZoneMode(mode: 'add' | 'del' | null) {
    this.zoneMode = mode;
    $('zone-add').setAttribute('aria-pressed', String(mode === 'add'));
    $('zone-del').setAttribute('aria-pressed', String(mode === 'del'));
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
      this.setBar(card, 'mor', s.morale, 100, `${Math.round(s.morale)}`);
      this.setBar(card, 'hp', s.hp, s.maxHp, `${Math.max(0, Math.round(s.hp))}/${s.maxHp}`);
      this.setBar(card, 'food', a.needs.food, 100);
      this.setBar(card, 'rest', a.needs.rest, 100);
      this.setBar(card, 'social', a.needs.social, 100);
    }

    this.renderVillage();

    if (c.log.length !== this.lastLog) {
      this.lastLog = c.log.length;
      const fallen = c.survivors.filter((s) => !s.alive);
      const lines = c.log.slice(-8).map((l) => `<p class="${l.tone}"><span class="d">D${l.day}</span>${esc(l.text)}</p>`);
      if (fallen.length) lines.unshift(`<p><span class="d">MEM</span>Remembered: ${fallen.map((f) => esc(f.name)).join(', ')}</p>`);
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
    const tier = `<span class="tier t${v.tier}">${v.tier === 0 ? 'Salvage era' : 'Timber era'}</span>`;
    const built = v.buildings.filter((b) => b.kind !== 'store').length;
    const html = (active.length
      ? active.map((p) => {
        const pct = Math.min(100, (p.work / p.workNeeded) * 100);
        return `<div class="proj"><div class="n">${esc(p.name)}</div><div class="st">${esc(this.status(p))}</div>
          <div class="bar"><i style="width:${pct.toFixed(0)}%"></i></div></div>`;
      }).join('')
      : `<div class="empty">Nothing planned. They'll think of something when the village needs it.</div>`)
      + `<div class="st" style="display:flex;gap:8px;align-items:center;font-size:11.5px;color:var(--ink-dim)">${tier}<span>${built} built</span></div>`;
    if ($('projects').innerHTML !== html) $('projects').innerHTML = html;
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
      </div>
      <div class="needs">
        <div>FOOD${bar('food', 'need')}</div><div>REST${bar('rest', 'need')}</div><div>COMPANY${bar('social', 'need')}</div>
      </div>
      ${bonds ? `<div class="bonds">${bonds}</div>` : ''}
    </div>`;
  }
}

