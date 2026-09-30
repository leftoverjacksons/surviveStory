/**
 * The request tray (DESIGN §23.4): everyday asks, answered whenever, without
 * pausing the game. Lives in the left column, above the events.
 */
import type { Colony } from '../sim/colony';
import { declineRequest, grantWork, putFirst, requestsOf, type Request } from '../sim/requests';
import { DEFS } from '../sim/buildings';
import { KNOWES, KNOWE_WAIT, letFolkChoose } from '../sim/townhouse';
import { log } from '../sim/community';

export interface TrayActions {
  /** Open the plot tool (for a household's home). */
  drawPlot(q: Request): void;
  /** Open the build tool for this building, near where it's wanted. */
  place(q: Request): void;
  /** Show who is asking. */
  show(q: Request): void;
  /** The Folk's new knowe waits for a place (DESIGN §25.6): open the placement. */
  placeKnowe(): void;
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
      const kn = (e.target as HTMLElement).closest<HTMLElement>('[data-knowe]');
      if (kn) {
        if (kn.dataset.knowe === 'place') this.act.placeKnowe();
        else {
          const k = letFolkChoose(this.col);
          log(this.col.community, k ? `The village left it to the Folk: overnight ${k.name} rose beside ${this.col.world.folk.mound.name}.` : 'The Folk could find no room for another knowe.', 'strange');
        }
        this.key = '';
        this.render();
        this.act.changed();
        return;
      }
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
    const pend = col.folk.pendingKnowe;
    const key = qs.map((q) => `${q.id}:${q.kind === 'plot' ? col.village.homeQueue.indexOf(q.household ?? -1) : ''}`).join(',') + `@${day}|${pend ? pend.kind : ''}`;
    if (key === this.key) return;
    this.key = key;
    const n = qs.length + (pend ? 1 : 0);
    this.el.hidden = !n;
    this.title.textContent = n ? String(n) : '';
    // The Folk's new knowe, first: where should it rise? (They choose after a few days.)
    const knowe = pend ? `<div class="ask folk"><p>The Folk of ${esc(col.world.folk.mound.name)} will raise a new knowe: ${esc(KNOWES[pend.kind].name.toLowerCase())}. Where should it rise? <span class="age">${Math.max(0, KNOWE_WAIT - (day - pend.since))} day${KNOWE_WAIT - (day - pend.since) === 1 ? '' : 's'} before they choose</span></p><div class="row"><button type="button" data-knowe="place">Choose where</button><button type="button" data-knowe="let">Let them choose</button></div></div>` : '';
    this.list.innerHTML = knowe + qs.map((q) => {
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
