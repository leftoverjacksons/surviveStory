import {
  alive, bondKind, bondValue, communityMorale, type Community, type Survivor,
} from '../sim/community';
import { JOBS, PSI, TRAITS, type JobId } from '../sim/data';

export interface HudActions {
  onEndDay(): void;
  onKill(id: number): void;
  onRecruit(): void;
  onJob(id: number, job: JobId): void;
  onRotate(dir: 1 | -1): void;
  onHour(h: number): void;
  onTogglePlay(): boolean;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class Hud {
  private labelsOn = true;
  private labelEls = new Map<number, HTMLDivElement>();
  private killArmed = false;

  constructor(private c: Community, private act: HudActions) {
    $('next-day').addEventListener('click', () => act.onEndDay());
    $('rot-l').addEventListener('click', () => act.onRotate(-1));
    $('rot-r').addEventListener('click', () => act.onRotate(1));
    $('recruit-btn').addEventListener('click', () => act.onRecruit());
    $('play').addEventListener('click', () => this.togglePlay());
    $('labels-btn').addEventListener('click', () => this.toggleLabels());
    $<HTMLInputElement>('hour').addEventListener('input', (e) => act.onHour(Number((e.target as HTMLInputElement).value)));
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
    $('crew').addEventListener('change', (e) => {
      const sel = e.target as HTMLSelectElement;
      if (sel.dataset.id) act.onJob(Number(sel.dataset.id), sel.value as JobId);
    });
  }

  togglePlay() {
    const on = this.act.onTogglePlay();
    $('play').textContent = on ? 'Pause time' : 'Run time';
  }

  toggleLabels() {
    this.labelsOn = !this.labelsOn;
    $('labels').hidden = !this.labelsOn;
  }

  setHour(h: number) {
    $<HTMLInputElement>('hour').value = String(h);
  }

  updateClock(day: number, hour: number, heading: number) {
    const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
    const dir = COMPASS[Math.round(heading / 45) % 8];
    const txt = `Day ${day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · facing ${dir}`;
    const el = $('clock');
    if (el.textContent !== txt) el.textContent = txt;
    const cp = $('compass');
    if (cp.textContent !== dir) cp.textContent = dir;
  }

  placeLabels(project: (id: number, out: { x: number; y: number }) => boolean) {
    if (!this.labelsOn) return;
    const out = { x: 0, y: 0 };
    const living = new Set(alive(this.c).map((s) => s.id));
    for (const [id, el] of this.labelEls) {
      if (!living.has(id)) { el.remove(); this.labelEls.delete(id); }
    }
    for (const s of alive(this.c)) {
      let el = this.labelEls.get(s.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'label';
        el.textContent = s.name.split(' ')[0];
        $('labels').appendChild(el);
        this.labelEls.set(s.id, el);
      }
      if (project(s.id, out)) {
        el.style.left = `${out.x}px`;
        el.style.top = `${out.y}px`;
        el.hidden = false;
      } else el.hidden = true;
    }
  }

  render() {
    const c = this.c;
    const r = c.resources;
    const morale = communityMorale(c);
    const res: [string, string, string][] = [
      ['Food', r.food.toFixed(0), ''], ['Water', r.water.toFixed(0), ''],
      ['Scrap', r.scrap.toFixed(0), ''], ['Medicine', r.medicine.toFixed(0), ''],
      ['Glimmer', r.glimmer.toFixed(1), 'glimmer'],
      ['Morale', morale.toFixed(0), morale < 40 ? 'morale low' : 'morale'],
    ];
    $('res').innerHTML = res.map(([k, v, cls]) => `<div class="res ${cls}"><b>${v}</b><span>${k}</span></div>`).join('');

    const living = alive(c);
    $('crew-title').textContent = `The Crew · ${living.length}`;
    $('crew').innerHTML = living.map((s) => this.card(s)).join('');

    const pick = $<HTMLSelectElement>('kill-pick');
    const prev = pick.value;
    pick.innerHTML = living.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    if (living.some((s) => String(s.id) === prev)) pick.value = prev;

    const fallen = c.survivors.filter((s) => !s.alive);
    const logLines = c.log.slice(-7).map((l) => `<p class="${l.tone}"><span class="d">D${l.day}</span>${esc(l.text)}</p>`);
    if (fallen.length) logLines.unshift(`<p><span class="d">MEM</span>Remembered: ${fallen.map((f) => esc(f.name)).join(', ')}</p>`);
    const log = $('log');
    log.innerHTML = logLines.join('');
    log.scrollTop = log.scrollHeight;
  }

  private card(s: Survivor): string {
    const c = this.c;
    const others = alive(c).filter((o) => o.id !== s.id);
    const close = others.filter((o) => bondKind(bondValue(c, s.id, o.id)) === 'close').map((o) => o.name.split(' ')[0]);
    const rivals = others.filter((o) => bondKind(bondValue(c, s.id, o.id)) === 'rival').map((o) => o.name.split(' ')[0]);
    const traits = s.traits.map((t) => `<span class="chip" title="${esc(TRAITS[t].blurb)}">${TRAITS[t].name}</span>`).join('');
    const psi = s.psi ? `<span class="chip psi" title="${esc(PSI[s.psi].blurb)}">Psi · ${PSI[s.psi].name}</span>` : '';
    const grief = s.griefDays > 0 ? `<span class="chip grief">Grieving</span>` : '';
    const bar = (v: number, max: number, cls: string) =>
      `<div class="bar ${cls} ${v / max < 0.35 ? 'low' : ''}"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%"></i></div>`;
    const jobs = (Object.keys(JOBS) as JobId[]).map((j) => `<option value="${j}" ${j === s.job ? 'selected' : ''}>${JOBS[j].name}</option>`).join('');
    const bonds = [
      close.length ? `Close to <em>${esc(close.join(', '))}</em>` : '',
      rivals.length ? `At odds with <em>${esc(rivals.join(', '))}</em>` : '',
    ].filter(Boolean).join(' · ');
    return `<div class="card ${s.griefDays > 0 ? 'grieving' : ''}">
      <div class="row"><span class="name">${esc(s.name)}</span>
        <select data-id="${s.id}" aria-label="Job for ${esc(s.name)}">${jobs}</select></div>
      <div class="bg">${s.age}, ${esc(s.background)}</div>
      <div class="chips">${traits}${psi}${grief}</div>
      <div class="bars">
        <span>MOR</span>${bar(s.morale, 100, '')}<span>${Math.round(s.morale)}</span>
        <span>HP</span>${bar(s.hp, s.maxHp, 'hp')}<span>${Math.max(0, Math.round(s.hp))}/${s.maxHp}</span>
      </div>
      ${bonds ? `<div class="bonds">${bonds}</div>` : ''}
    </div>`;
  }
}
