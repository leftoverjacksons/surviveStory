/**
 * Figure Studio: a local tool, separate from the game, for turning character
 * images into figures on the survivors' skeleton. Talks to server.py (/api),
 * which runs gen.py → rig.py → pack.mjs; see README.md.
 */
import { Stage, REFS, type StageFigure } from './stage';
import { Composer } from './compose';

/** rig.py --head / --hair: workshop faces (lab/workshop/faces.py) and hair, or keep the generated head. */
const HEADS = ['keep', 'face', 'soft', 'broad', 'long', 'elder'];
const HAIRS = ['curly', 'bun', 'swept', 'none'];

interface Slot { index: number; name: string; label: string; color: [number, number, number]; count: number }
interface Figure {
  id: string; name: string; body: 'man' | 'woman' | 'child'; status?: string; error?: string | null;
  params: Record<string, string | number>; files: string[]; slots: Slot[]; names: Record<string, string>;
  done: string[]; stamp?: number; library?: string; game?: string; parts?: string; front: string; back?: string;
}
interface LibEntry { file: string; name: string; body: string; generator: string; licence: string; added: string }
interface State { env: Record<string, unknown>; figures: Figure[]; library: LibEntry[]; queue: number }

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const api = async (path: string, body?: unknown) => {
  const r = await fetch(`/api/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? r.statusText);
  return j;
};
const work = (f: Figure, file: string) => `/api/work/${f.id}/${file}?v=${f.stamp ?? 0}`;

let state: State = { env: {}, figures: [], library: [], queue: 0 };
let selected: string | null = localStorage.getItem('studio.sel');
let shownKey = '';
let detailKey = '';

// ---------------------------------------------------------------- stage
const stage = new Stage($<HTMLCanvasElement>('c'));
await stage.init();
const composer = new Composer($('detail'), () => { detailKey = ''; refreshStage(); });
const composing = () => $<HTMLSelectElement>('show').value === 'compose';
for (const n of stage.clips.keys()) $<HTMLSelectElement>('clip').add(new Option(n, n, n === 'Walk', n === 'Walk'));
const bind = (id: string, key: 'zoom' | 'pixel' | 'raw' | 'spin' | 'clip', after?: () => void) => {
  const el = $<HTMLInputElement>(id);
  const read = () => {
    const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
    (stage.opts as Record<string, unknown>)[key] = v;
    after?.();
  };
  el.addEventListener('input', read);
  read();
};
bind('zoom', 'zoom');
bind('pixel', 'pixel', () => stage.resize());
bind('raw', 'raw', () => { shownKey = ''; refreshStage(); });
bind('spin', 'spin');
bind('clip', 'clip', () => stage.play());
$('show').addEventListener('input', async () => {
  if (composing()) { await composer.load(); composer.render(); } else detailKey = '';
  render();
});
$('refs').addEventListener('input', () => refreshStage());
// Pixel mode snaps the zoom to the game's range, and back to a close-up when it's off.
$('pixel').addEventListener('input', () => {
  const z = $<HTMLInputElement>('zoom');
  z.value = $<HTMLInputElement>('pixel').checked ? '2' : '4';
  z.dispatchEvent(new Event('input'));
});

function refreshStage() {
  const refs = $<HTMLInputElement>('refs').checked ? REFS.map((n) => Stage.ref(n)) : [];
  let figs: StageFigure[];
  if (composing()) {
    figs = [...(composer.mode === 'crowd' ? [] : refs), ...composer.figures()];
  } else if ($<HTMLSelectElement>('show').value === 'library') {
    figs = [...refs, ...state.library.map((e) => ({ name: e.file, url: `/api/library/${e.file}`, child: e.body === 'child' }))];
  } else {
    const f = state.figures.find((x) => x.id === selected);
    figs = [...refs, ...(f && f.files.includes('packed.glb') ? [{ name: f.id, url: work(f, 'packed.glb'), child: f.body === 'child' }] : [])];
  }
  const key = JSON.stringify([figs.map((f) => [f.url, f.compose, f.seed]), stage.opts.raw]);
  if (key === shownKey) return;
  shownKey = key;
  void stage.show(figs);
}

// ---------------------------------------------------------------- new figure form
const picked: { front?: string; back?: string } = {};
function dropZone(id: string, key: 'front' | 'back') {
  const el = $(id), input = el.querySelector('input')!;
  const take = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    const r = new FileReader();
    r.onload = () => {
      picked[key] = r.result as string;
      el.style.backgroundImage = `url(${picked[key]})`;
      el.classList.add('has');
      if (key === 'front' && !$<HTMLInputElement>('name').value) $<HTMLInputElement>('name').value = file.name.replace(/\.[^.]+$/, '');
      $<HTMLButtonElement>('make').disabled = !picked.front;
    };
    r.readAsDataURL(file);
  };
  el.addEventListener('click', () => input.click());
  input.addEventListener('change', () => take(input.files?.[0]));
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('over'); take(e.dataTransfer?.files[0]); });
  return take;
}
const takeFront = dropZone('dropFront', 'front');
const takeBack = dropZone('dropBack', 'back');
// Paste: the first image goes to the front view, the next to the back.
addEventListener('paste', (e) => {
  const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
  if (f) (picked.front ? takeBack : takeFront)(f);
});
$('make').addEventListener('click', async () => {
  const num = (id: string) => Number($<HTMLInputElement>(id).value);
  const btn = $<HTMLButtonElement>('make');
  btn.disabled = true;
  try {
    const r = await api('figures', {
      name: $<HTMLInputElement>('name').value || 'figure', body: $<HTMLSelectElement>('body').value, front: picked.front, back: picked.back,
      params: { backend: $<HTMLSelectElement>('backend').value, preset: $<HTMLSelectElement>('preset').value, octree: num('octree'), seed: num('seed'), tris: num('tris'), k: num('k'), head: $<HTMLSelectElement>('head').value, hair: $<HTMLSelectElement>('hair').value },
    });
    select(r.id);
    for (const id of ['dropFront', 'dropBack']) { $(id).style.backgroundImage = ''; $(id).classList.remove('has'); }
    delete picked.front; delete picked.back;
    $<HTMLInputElement>('name').value = '';
  } catch (e) {
    alertBox(String(e));
    btn.disabled = false;
  }
  void poll();
});
/** The artifact/browser dialogs are avoided throughout (see CLAUDE.md); errors show in the detail panel. */
function alertBox(msg: string) { $('detail').insertAdjacentHTML('afterbegin', `<div class="note" style="border-color:var(--bad)">${esc(msg)}</div>`); }

// ---------------------------------------------------------------- lists
function statusClass(s = '') { return s.startsWith('running') || s === 'queued' ? 'running' : s; }
function renderLists() {
  const e = state.env as Record<string, string | number | boolean>;
  $('env').innerHTML = e.error ? `<span style="color:var(--bad)">${esc(e.error)}</span>`
    : e.torch === undefined ? 'Checking the environment…'
    : `${e.cuda ? `GPU <b>${esc(e.gpu)}</b>, ${e.vram} GB${Number(e.vram) < 7 ? ' (offloading)' : ''}` : '<b>CPU only</b> (about 1–4 min a figure)'}`
      + `<br>Hunyuan code ${e.hy3d_repo ? '✓' : '✗ (run setup.py)'} · Blender ${e.blender ? '✓' : '✗'} · HF token ${e.hf_token ? '✓' : '—'}`
      + (state.queue ? `<br>${state.queue} job(s) waiting` : '');
  $('figures').innerHTML = state.figures.map((f) => `
    <div class="item ${f.id === selected ? 'sel' : ''}" data-id="${esc(f.id)}">
      <img src="${work(f, f.files.includes('front.png') ? 'front.png' : f.front)}" alt="" />
      <div><div>${esc(f.name)} <span class="sub">· ${esc(f.body)}</span></div>
      <div class="st ${statusClass(f.status)}">${esc(f.status ?? '')}${f.library ? ' · in library' : ''}${f.game ? ' · in game' : ''}</div></div>
    </div>`).join('') || '<div class="empty">No figures yet.</div>';
  $('library').innerHTML = state.library.map((l) => `
    <div class="item" data-lib="${esc(l.file)}"><img src="/api/library/${esc(l.file.replace('.glb', '.png'))}" alt="" />
    <div><div>${esc(l.name)} <span class="sub">· ${esc(l.body)}</span></div><div class="st">${esc(l.file)}</div></div></div>`).join('')
    || '<div class="empty">Empty.</div>';
}
$('figures').addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id;
  if (id) select(id);
});
$('library').addEventListener('click', () => { $<HTMLSelectElement>('show').value = 'library'; refreshStage(); });

function select(id: string) {
  selected = id;
  try { localStorage.setItem('studio.sel', id); } catch { /* private mode */ }
  $<HTMLSelectElement>('show').value = 'figure';
  detailKey = '';
  render();
}

// ---------------------------------------------------------------- detail panel
const SLOT_NAMES = ['skin', 'hair', 'cloth', 'boot', 'hat', 'pack', 'strap', 'eye'];
const armed = new Set<string>(); // two-click confirmations (browser dialogs are blocked in some frames)

function renderDetail() {
  if (composing()) return;  // the Compose panel owns the right-hand column
  const f = state.figures.find((x) => x.id === selected);
  const key = JSON.stringify(f ?? null) + [...armed].join();
  if (key === detailKey) return;
  detailKey = key;
  if (!f) { $('detail').innerHTML = '<div class="empty">Select or make a figure.</div>'; return; }
  const busy = !!f.status && (f.status.startsWith('running') || f.status === 'queued');
  const imgs = [f.front, f.back, f.files.includes('front.png') ? 'front.png' : '', f.files.includes('back.png') ? 'back.png' : ''].filter(Boolean) as string[];
  const rgb = (c: number[]) => `rgb(${c.map((x) => Math.round(x * 255)).join(',')})`;
  $('detail').innerHTML = `
    <h1>${esc(f.name)}</h1>
    <div class="sub">${esc(f.id)} · <span class="st ${statusClass(f.status)}">${esc(f.status)}</span></div>
    ${f.error ? `<div class="note" style="border-color:var(--bad);margin-top:8px">${esc(f.error)}</div>` : ''}
    <div class="row" style="margin-top:8px">
      <div><label>Name</label><input id="dName" type="text" value="${esc(f.name)}" /></div>
      <div><label>Body</label><select id="dBody">${['man', 'woman', 'child'].map((b) => `<option ${b === f.body ? 'selected' : ''}>${b}</option>`).join('')}</select></div>
    </div>
    <h2>Images</h2>
    <div class="imgs">${imgs.map((i) => `<img src="${work(f, i)}" title="${esc(i)}" alt="" />`).join('')}</div>
    <h2>Colour slots</h2>
    ${f.slots.length ? `<div class="sub">What each colour region is. The game re-colours skin, hair and clothing per survivor, and keeps boots, hats, packs and straps.</div>
      ${f.slots.map((s) => `<div class="slot"><div class="sw" style="background:${rgb(s.color)}"></div>
        <select data-slot="${s.index}">${SLOT_NAMES.map((n) => `<option ${n === (f.names[s.index] ?? s.name) ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <div class="n">${s.count} v</div></div>`).join('')}
      <div class="actions"><button id="aNames" ${busy ? 'disabled' : ''}>Apply slot names</button></div>`
      : '<div class="sub">After rigging.</div>'}
    <h2>Redo</h2>
    <div class="row">
      <div><label>Seed</label><input id="dSeed" type="number" value="${esc(f.params.seed ?? 1234)}" /></div>
      <div><label>Quality</label><select id="dPreset">${['turbo', 'full'].map((p) => `<option ${p === (f.params.preset ?? 'turbo') ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
    </div>
    <div class="row">
      <div><label>Triangles</label><input id="dTris" type="number" value="${esc(f.params.tris ?? 12000)}" step="1000" /></div>
      <div><label>Colour slots</label><input id="dK" type="number" value="${esc(f.params.k ?? 10)}" min="3" max="14" /></div>
    </div>
    <div class="row">
      <div><label>Head (face)</label><select id="dHead">${HEADS.map((h) => `<option value="${h}" ${h === (f.params.head ?? 'keep') ? 'selected' : ''}>${h === 'keep' ? 'generated' : `workshop: ${h}`}</option>`).join('')}</select></div>
      <div><label>Hair</label><select id="dHair">${HAIRS.map((h) => `<option ${h === (f.params.hair ?? 'curly') ? 'selected' : ''}>${h}</option>`).join('')}</select></div>
    </div>
    <div class="actions">
      <button id="aGen" ${busy ? 'disabled' : ''}>Generate again</button>
      <button id="aRig" ${busy || !f.done.includes('generate') ? 'disabled' : ''}>Rig again</button>
    </div>
    <h2>Keep it</h2>
    <div class="note">Hunyuan3D outputs are for prototypes: its licence forbids showing them in the EU, UK or South Korea.</div>
    <div class="actions">
      <button class="primary" id="aLib" ${busy || !f.files.includes('packed.glb') ? 'disabled' : ''}>${f.library ? 'Update in library' : 'Add to library'}</button>
      <button id="aGame" class="${armed.has('game') ? 'warn' : ''}" ${busy || !f.library ? 'disabled' : ''}>${armed.has('game') ? 'Click again: copy into src/assets/people' : f.game ? 'Update in game' : 'Send to game'}</button>
      <button id="aDel" class="warn" ${busy ? 'disabled' : ''}>${armed.has('del') ? 'Click again to delete' : 'Delete'}</button>
    </div>
    <div class="note">Parts: the figure cut into head, top, bottom, feet and hands on the workshop's skeleton, to mix with the workshop's parts in Show → Compose.</div>
    <div class="actions">
      <button id="aParts" ${busy || !f.done.includes('rig') ? 'disabled' : ''}>${f.parts ? 'Update parts in library' : 'Add parts to library'}</button>
    </div>
    <h2>Log</h2><pre id="log">…</pre>`;
  void loadLog(f);

  const act = async (path: string, body: unknown = {}) => { try { await api(`figures/${f.id}/${path}`, body); } catch (e) { alertBox(String(e)); } void poll(); };
  const num = (id: string) => Number($<HTMLInputElement>(id).value);
  const params = () => ({ seed: num('dSeed'), preset: $<HTMLSelectElement>('dPreset').value, tris: num('dTris'), k: num('dK'), head: $<HTMLSelectElement>('dHead').value, hair: $<HTMLSelectElement>('dHair').value });
  const edit = () => act('edit', { name: $<HTMLInputElement>('dName').value, body: $<HTMLSelectElement>('dBody').value });
  $('dName').addEventListener('change', edit);
  $('dBody').addEventListener('change', edit);
  $('aGen').onclick = () => act('run', { steps: ['generate', 'rig', 'pack'], params: params() });
  $('aRig').onclick = () => act('run', { steps: ['rig', 'pack'], params: params() });
  $('aParts').onclick = () => act('run', { steps: ['parts'] });
  const aNames = document.getElementById('aNames');
  if (aNames) aNames.onclick = () => {
    const names: Record<string, string> = {};
    document.querySelectorAll<HTMLSelectElement>('[data-slot]').forEach((s) => { names[s.dataset.slot!] = s.value; });
    void act('names', { names });
  };
  $('aLib').onclick = () => act('library');
  const twice = (btn: string, key: string, go: () => void) => {
    $(btn).onclick = () => {
      if (armed.has(key)) { armed.delete(key); go(); } else { armed.add(key); setTimeout(() => { armed.delete(key); renderDetail(); }, 4000); }
      renderDetail();
    };
  };
  twice('aGame', 'game', () => void act('game'));
  twice('aDel', 'del', () => { void act('delete'); selected = null; });
}

async function loadLog(f: Figure) {
  if (!f.files.includes('log.txt')) return;
  const t = await fetch(work(f, 'log.txt') + `&t=${Date.now()}`).then((r) => r.text()).catch(() => '');
  const el = document.getElementById('log');
  // Progress bars write carriage returns: keep each bar's last state only.
  if (el) { el.textContent = t.split('\n').map((l) => l.split('\r').pop()).slice(-40).join('\n'); el.scrollTop = el.scrollHeight; }
}

// ---------------------------------------------------------------- polling
function render() { renderLists(); renderDetail(); refreshStage(); }
async function poll() {
  try {
    state = await api('state');
    render();
    const f = state.figures.find((x) => x.id === selected);
    if (f?.status?.startsWith('running')) void loadLog(f);
  } catch {
    $('env').innerHTML = '<span style="color:var(--bad)">No backend: run <b>npm run figures</b> (or python lab/figures/server.py).</span>';
  }
}
setInterval(poll, 2000);
void poll();
Object.assign(window, { __studio: { stage, composer, get state() { return state; }, select, refUrl: (n: string) => Stage.ref(n).url } });
