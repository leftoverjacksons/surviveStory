/**
 * The build menu (DESIGN §21): pick something, then place it in the world.
 * Plots for homes are drawn as outlines; buildings are placed as a footprint
 * (right-click or T turns it); ruins are clicked to restore them.
 *
 * What the menu offers grows with the village (DESIGN §32, sim/unlocks.ts):
 * entries appear when something in the world points to them, greyed with the
 * step still missing, and open when it's taken.
 */
import { whyLocked } from '../sim/power';
import type { Colony } from '../sim/colony';
import { DEFS, MATERIALS, PLACEABLE, RARE, costText, tierFor, type SiteKind } from '../sim/buildings';
import { PLOT_MIN } from '../sim/homes';
import { FOLK_WORKS, type FolkWorkKind } from '../sim/folk';
import { MENU, SECTIONS, seenUnlocks, unlockOf, type MenuKind } from '../sim/unlocks';

export type BuildTool = { kind: 'plot' } | { kind: 'restore' } | { kind: 'salvage' } | { kind: 'knowe' } | { kind: 'fire' } | { kind: 'stockpile' } | { kind: 'tow'; heap: number } | { kind: 'place'; site: SiteKind; turn: number } | { kind: 'folk'; work: FolkWorkKind };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Menu entries that are tools, not buildings. */
const TOOLS = {
  plot: { name: 'Plot for a home', blurb: `Click the corners of a plot (at least ${PLOT_MIN} squares). A household without a home builds on it: the house near the front, a yard behind.` },
  restore: { name: 'Restore a ruin', blurb: 'Click a building of the old world in a cleared district to patch it up and use it again.' },
  salvage: { name: 'Strip and clear', blurb: 'Click a wrecked car or a junk heap: it is stripped for scrap first and cleared away. Click a ruin in a cleared district of yours: it is pulled down for a great deal of scrap, and the ground freed.' },
};

export class BuildPanel {
  private el: HTMLElement;
  private hintEl: HTMLElement;
  open = false;
  constructor(private col: Colony, private onPick: (t: BuildTool | null) => void) {
    this.el = document.getElementById('build')!;
    this.hintEl = document.getElementById('place-hint')!;
    document.getElementById('build-btn')!.addEventListener('click', () => this.toggle());
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-build]');
      if (!b) return;
      const k = b.dataset.build!;
      const tool: BuildTool = k === 'plot' ? { kind: 'plot' } : k === 'restore' ? { kind: 'restore' } : k === 'salvage' ? { kind: 'salvage' }
        : k.startsWith('folk:') ? { kind: 'folk', work: k.slice(5) as FolkWorkKind } : { kind: 'place', site: k as SiteKind, turn: 0 };
      this.close();
      this.onPick(tool);
    });
  }

  toggle() { if (this.open) this.close(); else this.show(); }

  close() {
    if (this.open) seenUnlocks(this.col);
    this.open = false; this.el.hidden = true;
    document.getElementById('build-btn')!.setAttribute('aria-pressed', 'false');
    this.badge();
  }

  /** A dot on the Build button while something new is waiting to be seen. */
  badge() {
    const btn = document.getElementById('build-btn')!;
    const n = (this.col.village.fresh ?? []).length;
    btn.classList.toggle('has-new', n > 0 && !this.open);
    btn.title = n > 0 ? 'Build (something new can be built)' : 'Build';
  }

  private entry(kind: MenuKind): string {
    const u = unlockOf(this.col, kind);
    if (u.state === 'hidden') return '';
    const fresh = (this.col.village.fresh ?? []).includes(kind) ? '<em class="new">new</em>' : '';
    const tool = TOOLS[kind as keyof typeof TOOLS];
    const name = tool ? tool.name : DEFS[kind as SiteKind].name[tierFor(this.col.village, this.col.community, kind as SiteKind)];
    const blurb = tool ? tool.blurb : PLACEABLE.find((p) => p.kind === kind)?.blurb ?? '';
    if (u.state === 'glimpsed') return `<button type="button" class="glimpsed" data-build="${kind}" disabled title="${esc(u.why ?? '')}"><b>${esc(name)}</b><span>${esc(blurb)}</span><i class="short">${esc(u.why ?? '')}</i></button>`;
    if (tool) return `<button type="button" data-build="${kind}"><b>${esc(name)}${fresh}</b><span>${esc(blurb)}</span></button>`;
    const r = this.col.community.resources;
    const def = DEFS[kind as SiteKind];
    const c = def.cost[tierFor(this.col.village, this.col.community, kind as SiteKind)];
    const short = MATERIALS.some((m) => c[m] > r[m]);
    // Rare salvage can't just be gathered: it has to come out of a cleared district.
    const rare = RARE.some((m) => c[m] > r[m]);
    // Power wants know-how, not an era (power.ts).
    const locked = whyLocked(this.col, kind);
    if (locked) return `<button type="button" class="glimpsed" data-build="${kind}" disabled title="${esc(locked)}"><b>${esc(name)}</b><span>${esc(blurb)}</span><i class="short">${esc(locked)}</i></button>`;
    return `<button type="button" data-build="${kind}"><b>${esc(name)}${fresh}</b><span>${esc(blurb)}</span><i class="${short ? 'short' : ''}">${esc(costText(c))}${rare ? ' (glass, copper and steel come from cleared districts)' : short ? ' (they\'ll gather it)' : ''}</i></button>`;
  }

  show() {
    const sections = SECTIONS.map((sec) => {
      const items = MENU.filter((m) => m.section === sec).map((m) => this.entry(m.kind)).filter(Boolean).join('');
      return items ? `<h3 class="sec">${esc(sec)}</h3>${items}` : '';
    }).join('');
    const f = this.col.folk;
    // The Folk's works: only once someone has met them.
    const folk = !f.met ? '' : `<h3 class="folk">Ask the Folk <small>built at night, in the Wild, from their dew and song (${Math.floor(f.dew)} · ${Math.floor(f.song)})</small></h3>
      ${(Object.keys(FOLK_WORKS) as FolkWorkKind[]).map((k) => {
        const d = FOLK_WORKS[k];
        const short = d.dew > f.dew || d.song > f.song;
        return `<button type="button" class="folk" data-build="folk:${k}"><b>${esc(d.name)}</b><span>${esc(d.blurb)}</span><i class="${short ? 'short' : ''}">${d.dew} dew · ${d.song} song${short ? ' (they\'ll gather it)' : ''}</i></button>`;
      }).join('')}`;
    this.el.innerHTML = `<h3>Build</h3>${sections}${folk}`;
    this.open = true;
    this.el.hidden = false;
    document.getElementById('build-btn')!.setAttribute('aria-pressed', 'true');
    this.badge();
  }

  /** A line under the controls saying what the current tool does, or why not. */
  hint(text: string | null) {
    this.hintEl.hidden = !text;
    if (text) this.hintEl.textContent = text;
  }
}
