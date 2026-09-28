/**
 * The request tray (DESIGN §23.4): everyday asks, answered whenever, without
 * pausing the game. Lives in the left column, above the events.
 */
import type { Colony } from '../sim/colony';
import { declineRequest, grantWork, putFirst, requestsOf, type Request } from '../sim/requests';
import { DEFS } from '../sim/buildings';

export interface TrayActions {
  /** Open the plot tool (for a household's home). */
  drawPlot(q: Request): void;
  /** Open the build tool for this building, near where it's wanted. */
  place(q: Request): void;
  /** Show who is asking. */
  show(q: Request): void;
  /** Something changed: redraw the HUD. */
  changed(): void;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export class Tray {
  private el = document.getElementById('asks')!;
  private list = document.getElementById('asks-list')!;
  private title = document.getElementById('asks-count')!;
  private key = '';

  constructor(private col: Colony, private act: TrayActions) {
    this.list.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ask]');
      if (!b) return;
      const q = requestsOf(this.col).find((x) => x.id === Number(b.dataset.ask));
      if (!q) return;
      const what = b.dataset.do;
      if (what === 'plot') this.act.drawPlot(q);
      else if (what === 'first') putFirst(this.col, q.id);
      else if (what === 'place') this.act.place(q);
      else if (what === 'let') grantWork(this.col, q.id);
      else if (what === 'no') declineRequest(this.col, q.id);
      else if (what === 'who') this.act.show(q);
      this.key = '';
      this.render();
      this.act.changed();
    });
  }

  render() {
    const col = this.col, day = col.community.day;
    const qs = requestsOf(col);
    const key = qs.map((q) => `${q.id}:${q.kind === 'plot' ? col.village.homeQueue.indexOf(q.household ?? -1) : ''}`).join(',') + `@${day}`;
    if (key === this.key) return;
    this.key = key;
    this.el.hidden = !qs.length;
    this.title.textContent = qs.length ? String(qs.length) : '';
    this.list.innerHTML = qs.map((q) => {
      const waited = day - q.since;
      const age = waited <= 0 ? 'today' : `${waited} day${waited === 1 ? '' : 's'}`;
      const left = q.kind === 'plot' ? '' : q.until - day <= 1 ? ' · <em>fading</em>' : '';
      const first = q.kind === 'plot' && col.village.homeQueue[0] === q.household;
      const buttons = q.kind === 'plot'
        ? `<button type="button" data-ask="${q.id}" data-do="plot">Draw a plot</button>${first ? '<span class="first">first in line</span>' : `<button type="button" data-ask="${q.id}" data-do="first">First in line</button>`}`
        : q.kind === 'work'
          ? `<button type="button" data-ask="${q.id}" data-do="let">Let them</button><button type="button" data-ask="${q.id}" data-do="no">Not now</button>`
          : `<button type="button" data-ask="${q.id}" data-do="place">Place a ${esc(DEFS[q.kind].name[0].toLowerCase())}</button><button type="button" data-ask="${q.id}" data-do="no">Not now</button>`;
      return `<div class="ask ${q.kind}"><p data-ask="${q.id}" data-do="who" title="Show who is asking">${esc(q.text)} <span class="age">${age}${left}</span></p><div class="row">${buttons}</div></div>`;
    }).join('');
  }
}
