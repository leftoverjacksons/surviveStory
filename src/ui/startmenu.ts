/**
 * The start menu (DESIGN §22.4): carry on the saved village, or start a new
 * one at a chosen site, with or without autopilot. Shown before the world is
 * built; `?new`, `?seed` and `?site` skip it (for links and scripts).
 */
import { SEASON_NAMES, dayOfSeason, seasonOf, yearOf } from '../sim/calendar';
import { SITES, SITE_KINDS, type SiteKind } from '../sim/sites';
import type { SaveFile } from '../sim/save';

export type StartChoice =
  | { kind: 'continue' }
  | { kind: 'new'; site: SiteKind | null; seed: number | null; autopilot: boolean };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function ago(ms: number): string {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : new Date(ms).toLocaleDateString();
}

export function startMenu(saved: SaveFile | null, why: string | null, autopilotDefault: boolean): Promise<StartChoice> {
  const el = document.getElementById('start')!;
  const day = saved?.day ?? 1;
  const cont = saved
    ? `<button type="button" class="primary big" id="start-continue"><b>Continue</b><span>${esc(saved.place)} · Year ${yearOf(day)}, ${SEASON_NAMES[seasonOf(day)]} day ${dayOfSeason(day)} · ${saved.colony.community.survivors.filter((s) => s.alive).length} people · saved ${esc(ago(saved.savedAt))}</span></button>`
    : '';
  const sites = [`<button type="button" data-site="" aria-pressed="true"><b>Anywhere</b><span>Let the seed decide</span></button>`,
    ...SITE_KINDS.map((k) => `<button type="button" data-site="${k}" aria-pressed="false"><b>${esc(SITES[k].place)}</b><span>${esc(k)}</span></button>`)].join('');
  el.innerHTML = `<div class="card">
      <h1>Survive Story</h1>
      <p class="tag">After the Quiet: a village of survivors, the land, and the things that live beside it.</p>
      ${why ? `<p class="warn">${esc(why)}</p>` : ''}
      ${cont}
      <details ${saved ? '' : 'open'} id="start-new">
        <summary>${saved ? 'Or start a new village' : 'Start a village'}</summary>
        <div class="h">Where they first shelter</div>
        <div class="sites">${sites}</div>
        <div class="row">
          <label>Seed <input id="start-seed" type="number" min="1" max="99999" placeholder="random"></label>
          <label><input id="start-auto" type="checkbox" ${autopilotDefault ? 'checked' : ''}> Autopilot (it plans and builds for itself)</label>
        </div>
        <button type="button" class="primary" id="start-new-go">${saved ? 'Start a new village' : 'Begin'}</button>
        ${saved ? '<div class="note">Starting anew replaces the saved village.</div>' : ''}
      </details>
    </div>`;
  el.hidden = false;
  let site: SiteKind | null = null;
  return new Promise((resolve) => {
    const done = (c: StartChoice) => { el.hidden = true; el.innerHTML = ''; resolve(c); };
    el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('#start-continue')) return done({ kind: 'continue' });
      const s = t.closest<HTMLButtonElement>('button[data-site]');
      if (s) {
        site = (s.dataset.site || null) as SiteKind | null;
        el.querySelectorAll('button[data-site]').forEach((b) => b.setAttribute('aria-pressed', String(b === s)));
        return;
      }
      const go = t.closest<HTMLButtonElement>('#start-new-go');
      if (go) {
        // Replacing a save takes a second click (browser dialogs are blocked where the game is embedded).
        if (saved && go.dataset.armed !== '1') {
          go.dataset.armed = '1';
          go.textContent = `Click again to replace ${saved.place}`;
          go.classList.add('danger');
          return;
        }
        const seed = Number((document.getElementById('start-seed') as HTMLInputElement).value) || null;
        const autopilot = (document.getElementById('start-auto') as HTMLInputElement).checked;
        done({ kind: 'new', site, seed, autopilot });
      }
    });
    document.getElementById('start-continue')?.focus();
  });
}
