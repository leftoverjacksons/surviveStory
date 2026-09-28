/**
 * The chronicle panel (DESIGN §22.3): how the run went, for a player coming
 * back after hours away. Small multiples (one measure per chart, each on its
 * own axis) with a crosshair shared across all of them, the notable events
 * with filters, and a table of means by season.
 */
import type { Colony } from '../sim/colony';
import { DAYS_PER_SEASON, DAYS_PER_YEAR, SEASON_NAMES, seasonOf, yearOf } from '../sim/calendar';
import type { EventKind, Sample } from '../sim/chronicle';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

interface Measure { key: keyof Sample; title: string; fmt: (v: number) => string; step?: boolean }
const MEASURES: Measure[] = [
  { key: 'alive', title: 'People', fmt: (v) => v.toFixed(0) },
  { key: 'morale', title: 'Morale', fmt: (v) => v.toFixed(0) },
  { key: 'food', title: 'Food (with preserves)', fmt: (v) => v.toFixed(0) },
  { key: 'wood', title: 'Firewood and timber', fmt: (v) => v.toFixed(0) },
  { key: 'tier', title: 'Needs tier', fmt: (v) => ['Struggling', 'Getting by', 'Settled', 'Thriving'][Math.round(v)] ?? v.toFixed(0), step: true },
  { key: 'homes', title: 'Homes', fmt: (v) => v.toFixed(0), step: true },
  { key: 'tools', title: 'Tools', fmt: (v) => v.toFixed(0) },
  { key: 'clothes', title: 'Clothes', fmt: (v) => v.toFixed(0) },
  { key: 'scrap', title: 'Scrap', fmt: (v) => v.toFixed(0) },
  { key: 'rare', title: 'Glass · copper · steel', fmt: (v) => v.toFixed(0) },
  { key: 'folkStanding', title: 'Standing with the Folk', fmt: (v) => v.toFixed(0) },
  { key: 'cleared', title: 'Districts cleared', fmt: (v) => v.toFixed(0), step: true },
];
const KIND_LABEL: Record<EventKind, string> = {
  people: 'People', hardship: 'Hardship', council: 'Council', veil: 'Veil & Folk', milestone: 'Milestones', building: 'Building',
};

const W = 260, H = 64, PAD = 2;

export class ChronicleView {
  private el: HTMLElement;
  open = false;
  private key = '';
  private filter: EventKind | 'all' = 'all';
  private hoverI: number | null = null;

  constructor(private col: Colony) {
    this.el = document.getElementById('chronicle')!;
    document.getElementById('chronicle-btn')!.addEventListener('click', () => this.toggle());
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('#chronicle-close')) { this.toggle(false); return; }
      const f = t.closest<HTMLButtonElement>('button[data-kind]');
      if (f) { this.filter = f.dataset.kind as EventKind | 'all'; this.key = ''; this.render(); }
    });
    this.el.addEventListener('pointermove', (e) => {
      const svg = (e.target as Element).closest('svg.spark');
      const s = this.samples();
      if (!svg || s.length < 2) return;
      const r = svg.getBoundingClientRect();
      const i = Math.round(((e.clientX - r.left) / r.width) * (s.length - 1));
      this.hover(Math.max(0, Math.min(s.length - 1, i)));
    });
    this.el.addEventListener('pointerleave', () => this.hover(null));
  }

  toggle(on = !this.open) {
    this.open = on;
    this.el.hidden = !on;
    document.getElementById('chronicle-btn')!.setAttribute('aria-pressed', String(on));
    this.key = '';
    if (on) this.render();
  }

  private samples() { return this.col.chronicle?.samples ?? []; }

  /** Rebuild when a new day's sample arrives (cheap to call every frame). */
  render() {
    if (!this.open) return;
    const ch = this.col.chronicle;
    const s = this.samples();
    const key = `${s.length}:${ch?.events.length ?? 0}:${this.filter}`;
    if (key === this.key) return;
    this.key = key;
    const day = this.col.community.day;
    const charts = s.length < 2
      ? '<div class="empty">The chronicle starts with the first morning. Come back in a day or two.</div>'
      : `<div class="sparks">${MEASURES.map((m) => this.chart(m, s)).join('')}</div>
         <div class="axis-note">Day ${s[0].day} to ${s[s.length - 1].day}. Shaded: winters. Hover a chart to read every measure on that day.</div>`;
    const events = (ch?.events ?? []).filter((e) => this.filter === 'all' || e.kind === this.filter);
    const counts = new Map<EventKind, number>();
    for (const e of ch?.events ?? []) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
    const chips = [`<button type="button" data-kind="all" aria-pressed="${this.filter === 'all'}">All · ${ch?.events.length ?? 0}</button>`,
      ...(Object.keys(KIND_LABEL) as EventKind[]).map((k) => `<button type="button" data-kind="${k}" aria-pressed="${this.filter === k}">${KIND_LABEL[k]} · ${counts.get(k) ?? 0}</button>`)].join('');
    // Newest first, under a heading for each season.
    let last = '';
    const list = events.slice(-250).reverse().map((e) => {
      const head = `Year ${yearOf(e.day)} · ${SEASON_NAMES[seasonOf(e.day)]}`;
      const h = head !== last ? `<li class="season">${head}</li>` : '';
      last = head;
      return `${h}<li class="${e.tone} k-${e.kind}"><span class="d">D${e.day}</span><span class="kind">${KIND_LABEL[e.kind]}</span>${esc(e.text)}</li>`;
    }).join('');
    this.el.innerHTML = `<div class="top"><h2>Chronicle · day ${day}</h2><button type="button" id="chronicle-close">Close</button></div>
      ${charts}
      <div class="chips" role="group" aria-label="Filter events">${chips}</div>
      <ol class="events">${list || '<li class="empty">Nothing of note yet.</li>'}</ol>
      <details class="table"><summary>Numbers by season</summary>${this.table(s)}</details>`;
    if (this.hoverI !== null) this.hover(Math.min(this.hoverI, s.length - 1));
  }

  /** One measure as a line (or steps) over the days, winters shaded. */
  private chart(m: Measure, s: Sample[]): string {
    const vals = s.map((x) => x[m.key] as number);
    const max = Math.max(1, ...vals) * 1.05, n = s.length;
    const x = (i: number) => PAD + (i / (n - 1)) * (W - PAD * 2);
    const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
    let d = '';
    vals.forEach((v, i) => {
      if (i === 0) d = `M${x(0).toFixed(1)},${y(v).toFixed(1)}`;
      else if (m.step) d += `H${x(i).toFixed(1)}V${y(v).toFixed(1)}`;
      else d += `L${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    // Winter bands.
    const bands: string[] = [];
    for (let i = 0; i < n; i++) {
      if (seasonOf(s[i].day) !== 'winter' || (i > 0 && seasonOf(s[i - 1].day) === 'winter')) continue;
      let j = i;
      while (j + 1 < n && seasonOf(s[j + 1].day) === 'winter') j++;
      bands.push(`<rect x="${x(i).toFixed(1)}" y="0" width="${Math.max(1, x(j) - x(i)).toFixed(1)}" height="${H}" class="winter"/>`);
    }
    const lastV = vals[n - 1];
    return `<figure class="spark-fig" data-key="${m.key}">
      <figcaption><span>${esc(m.title)}</span><b class="val">${esc(m.fmt(lastV))}</b></figcaption>
      <svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(m.title)}: now ${esc(m.fmt(lastV))}, highest ${esc(m.fmt(Math.max(...vals)))}">
        ${bands.join('')}
        <line x1="0" x2="${W}" y1="${H - PAD}" y2="${H - PAD}" class="base"/>
        <path d="${d}" class="line"/>
        <line class="cross" x1="0" x2="0" y1="0" y2="${H}" visibility="hidden"/>
        <circle class="dot" r="3.5" cx="0" cy="0" visibility="hidden"/>
      </svg>
      <div class="range">0 – ${esc(m.fmt(Math.max(...vals)))}</div>
    </figure>`;
  }

  /** The shared crosshair: every chart shows its value on the hovered day. */
  private hover(i: number | null) {
    this.hoverI = i;
    const s = this.samples();
    for (const fig of this.el.querySelectorAll<HTMLElement>('figure.spark-fig')) {
      const m = MEASURES.find((q) => q.key === fig.dataset.key)!;
      const vals = s.map((x) => x[m.key] as number);
      const max = Math.max(1, ...vals) * 1.05, n = s.length;
      const cross = fig.querySelector<SVGLineElement>('line.cross')!, dot = fig.querySelector<SVGCircleElement>('circle.dot')!;
      const val = fig.querySelector<HTMLElement>('.val')!;
      if (i === null || n < 2) {
        cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden');
        val.textContent = m.fmt(vals[n - 1] ?? 0);
        fig.querySelector('figcaption')!.removeAttribute('data-day');
        continue;
      }
      const cx = PAD + (i / (n - 1)) * (W - PAD * 2), cy = H - PAD - (vals[i] / max) * (H - PAD * 2);
      cross.setAttribute('x1', String(cx)); cross.setAttribute('x2', String(cx)); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', String(cx)); dot.setAttribute('cy', String(cy)); dot.setAttribute('visibility', 'visible');
      val.textContent = `${m.fmt(vals[i])} · D${s[i].day}`;
    }
  }

  /** Means by season, for exact numbers. */
  private table(s: Sample[]): string {
    if (!s.length) return '';
    const groups = new Map<string, Sample[]>();
    for (const x of s) {
      const k = `Y${yearOf(x.day)} ${SEASON_NAMES[seasonOf(x.day)]}`;
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(x);
    }
    const head = `<tr><th>Season</th>${MEASURES.map((m) => `<th>${esc(m.title)}</th>`).join('')}</tr>`;
    const rows = [...groups].map(([k, xs]) => `<tr><th>${k}</th>${MEASURES.map((m) => {
      const mean = xs.reduce((n, x) => n + (x[m.key] as number), 0) / xs.length;
      return `<td>${m.step ? m.fmt(mean) : mean.toFixed(mean >= 100 ? 0 : 1)}</td>`;
    }).join('')}</tr>`).join('');
    return `<div class="scroll"><table>${head}${rows}</table></div><div class="axis-note">${DAYS_PER_SEASON} days a season, ${DAYS_PER_YEAR} a year.</div>`;
  }
}
