/**
 * The build menu (DESIGN §21): pick something, then place it in the world.
 * Plots for homes are drawn as outlines; buildings are placed as a footprint
 * (right-click or T turns it); ruins are clicked to restore them.
 */
import type { Colony } from '../sim/colony';
import { DEFS, MATERIALS, PLACEABLE, RARE, costText, tierFor, type SiteKind } from '../sim/buildings';
import { PLOT_MIN } from '../sim/homes';
import { FOLK_WORKS, type FolkWorkKind } from '../sim/folk';

export type BuildTool = { kind: 'plot' } | { kind: 'restore' } | { kind: 'place'; site: SiteKind; turn: number } | { kind: 'folk'; work: FolkWorkKind };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

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
      const tool: BuildTool = k === 'plot' ? { kind: 'plot' } : k === 'restore' ? { kind: 'restore' }
        : k.startsWith('folk:') ? { kind: 'folk', work: k.slice(5) as FolkWorkKind } : { kind: 'place', site: k as SiteKind, turn: 0 };
      this.close();
      this.onPick(tool);
    });
  }

  toggle() { if (this.open) this.close(); else this.show(); }
  close() { this.open = false; this.el.hidden = true; document.getElementById('build-btn')!.setAttribute('aria-pressed', 'false'); }

  show() {
    const v = this.col.village, r = this.col.community.resources;
    const rows = PLACEABLE.map(({ kind, blurb }) => {
      const tier = tierFor(v, this.col.community, kind);
      const def = DEFS[kind];
      const c = def.cost[tier];
      const short = MATERIALS.some((m) => c[m] > r[m]);
      // Rare salvage can't just be gathered: it has to come out of a cleared district.
      const rare = RARE.some((m) => c[m] > r[m]);
      return `<button type="button" data-build="${kind}"><b>${esc(def.name[tier])}</b><span>${esc(blurb)}</span><i class="${short ? 'short' : ''}">${esc(costText(c))}${rare ? ' (glass, copper and steel come from cleared districts)' : short ? ' (they\'ll gather it)' : ''}</i></button>`;
    }).join('');
    this.el.innerHTML = `<h3>Build</h3>
      <button type="button" data-build="plot"><b>Plot for a home</b><span>Click the corners of a plot (at least ${PLOT_MIN} squares). A household without a home builds on it: the house near the front, a yard behind.</span></button>
      ${rows}
      <button type="button" data-build="restore"><b>Restore a ruin</b><span>Click a building of the old world in a cleared district to patch it up and use it again.</span></button>
      <h3 class="folk">Ask the Folk <small>built at night, in the Wild, from their dew and song (${Math.floor(this.col.folk.dew)} · ${Math.floor(this.col.folk.song)})</small></h3>
      ${(Object.keys(FOLK_WORKS) as FolkWorkKind[]).map((k) => {
        const d = FOLK_WORKS[k], f = this.col.folk;
        const short = d.dew > f.dew || d.song > f.song;
        return `<button type="button" class="folk" data-build="folk:${k}" ${f.met ? '' : 'disabled title="Nobody has met the Folk yet"'}><b>${esc(d.name)}</b><span>${esc(d.blurb)}</span><i class="${short ? 'short' : ''}">${d.dew} dew · ${d.song} song${short ? ' (they\'ll gather it)' : ''}</i></button>`;
      }).join('')}`;
    this.open = true;
    this.el.hidden = false;
    document.getElementById('build-btn')!.setAttribute('aria-pressed', 'true');
  }

  /** A line under the controls saying what the current tool does, or why not. */
  hint(text: string | null) {
    this.hintEl.hidden = !text;
    if (text) this.hintEl.textContent = text;
  }
}
