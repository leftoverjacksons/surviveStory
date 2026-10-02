/**
 * Figure Studio: a local tool, separate from the game, for turning character
 * images into figures on the survivors' skeleton. Talks to server.py (/api),
 * which runs gen.py → rig.py → pack.mjs; see README.md.
 */
import { Stage, REFS, type StageFigure } from './stage';
import { Composer } from './compose';
import { ProportionsPanel } from './proportions';

/** rig.py --head / --hair: workshop faces (lab/workshop/faces.py) and hair, or keep the generated head. */
const HEADS = ['keep', 'face', 'soft', 'broad', 'long', 'elder'];
const HAIRS = ['curly', 'bun', 'swept', 'none'];

interface Slot { index: number; name: string; label: string; color: [number, number, number]; count: number }
interface Figure {
  id: string; name: string; body: 'man' | 'woman' | 'child'; status?: string; error?: string | null;
  params: Record<string, string | number>; files: string[]; slots: Slot[]; names: Record<string, string>;
  done: string[]; stamp?: number; library?: string; game?: string; parts?: string; front: string; back?: string; kind?: 'body' | 'garment'; category?: string;
}
interface LibEntry { file: string; name: string; body: string; generator: string; licence: string; added: string }
interface Body { name: string; file: string; build: string; from: string; added: string }
interface SheetItem { index: number; front: string; back: string | null; guess?: string; parser?: Record<string, number>; size: [number, number] }
interface Sheet { id: string; name: string; status?: string; error?: string | null; gap: number; front: string; back?: string; items?: SheetItem[]; made: Record<string, string> }
interface State { env: Record<string, unknown>; figures: Figure[]; library: LibEntry[]; bodies: Body[]; sheets: Sheet[]; queue: number }

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const api = async (path: string, body?: unknown) => {
  const r = await fetch(`/api/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? r.statusText);
  return j;
};
const work = (f: Figure, file: string) => `/api/work/${f.id}/${file}?v=${f.stamp ?? 0}`;

let state: State = { env: {}, figures: [], library: [], bodies: [], sheets: [], queue: 0 };
let sheetSel: string | null = null;  // a selected sheet owns the right-hand column
let selected: string | null = localStorage.getItem('studio.sel');
let shownKey = '';
let detailKey = '';

// ---------------------------------------------------------------- stage
const stage = new Stage($<HTMLCanvasElement>('c'));
await stage.init();
const composer = new Composer($('detail'), () => { detailKey = ''; refreshStage(); });
const composing = () => $<HTMLSelectElement>('show').value === 'compose';
const proportioning = () => $<HTMLSelectElement>('show').value === 'proportions';
const props = new ProportionsPanel($('detail'), stage, api, () => state.figures.find((x) => x.id === selected));
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
  if (!proportioning()) props.leave();
  render();
});
$('refs').addEventListener('input', () => refreshStage());
// Mouse: drag turns the view (left/right) and tilts it (up/down); right- or shift-drag moves it up and down;
// the wheel zooms (kept in step with the slider).
{
  const cv = $<HTMLCanvasElement>('c');
  let drag: { x: number; y: number; pan: boolean } | null = null;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) stage.look.y += dy * 0.05 / stage.opts.zoom;
    else {
      stage.yaw -= dx * 0.01;
      stage.pitch = Math.min(1.45, Math.max(-0.3, stage.pitch + dy * 0.008));
    }
  });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const z = $<HTMLInputElement>('zoom');
    const v = Math.min(Number(z.max), Math.max(Number(z.min), stage.opts.zoom * Math.pow(1.1, -e.deltaY / 100)));
    z.value = String(v);
    z.dispatchEvent(new Event('input'));
  }, { passive: false });
}

// Pixel mode snaps the zoom to the game's range, and back to a close-up when it's off.
$('pixel').addEventListener('input', () => {
  const z = $<HTMLInputElement>('zoom');
  z.value = $<HTMLInputElement>('pixel').checked ? '2' : '4';
  z.dispatchEvent(new Event('input'));
});

function refreshStage() {
  if (proportioning()) { shownKey = 'proportions'; void props.sync(); return; }
  const gf = $<HTMLSelectElement>('show').value === 'figure' ? state.figures.find((x) => x.id === selected) : undefined;
  if (gf?.kind === 'garment') {  // unrigged: shown as an object, not on the skeleton
    const key = 'garment:' + gf.id + (gf.stamp ?? 0) + gf.files.includes('garment.glb');
    if (key !== shownKey) { shownKey = key; void stage.showObject(gf.files.includes('garment.glb') ? work(gf, 'garment.glb') : null); }
    return;
  }
  if (stage.holdStill) { stage.holdStill = false; shownKey = ''; }
  const refs = $<HTMLInputElement>('refs').checked ? REFS.map((n) => Stage.ref(n)) : [];
  let figs: StageFigure[];
  if ($<HTMLSelectElement>('show').value === 'bodies') {
    figs = [...refs, ...(state.bodies ?? []).map((b) => ({ name: b.name, url: `/api/library/${b.file}` }))];
  } else if (composing()) {
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
const picked: { front?: string; back?: string; sheet?: string; sheetBack?: string } = {};
function dropZone(id: string, key: 'front' | 'back' | 'sheet' | 'sheetBack') {
  const el = $(id), input = el.querySelector('input')!;
  const take = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    const r = new FileReader();
    r.onload = () => {
      picked[key] = r.result as string;
      el.style.backgroundImage = `url(${picked[key]})`;
      el.classList.add('has');
      if (key === 'front' && !$<HTMLInputElement>('name').value) $<HTMLInputElement>('name').value = file.name.replace(/\.[^.]+$/, '');
      if (key === 'sheet' && !$<HTMLInputElement>('sheetName').value) $<HTMLInputElement>('sheetName').value = file.name.replace(/\.[^.]+$/, '');
      $<HTMLButtonElement>('make').disabled = !picked.front;
      $<HTMLButtonElement>('splitSheet').disabled = !picked.sheet;
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
dropZone('dropSheet', 'sheet');
dropZone('dropSheetBack', 'sheetBack');
$('splitSheet').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('splitSheet');
  btn.disabled = true;
  try {
    const r = await api('sheets', { name: $<HTMLInputElement>('sheetName').value || 'sheet', front: picked.sheet, back: picked.sheetBack });
    for (const id of ['dropSheet', 'dropSheetBack']) { $(id).style.backgroundImage = ''; $(id).classList.remove('has'); }
    delete picked.sheet; delete picked.sheetBack;
    $<HTMLInputElement>('sheetName').value = '';
    selectSheet(r.id);
  } catch (e) { alertBox(String(e)); btn.disabled = false; }
  void poll();
});
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
      params: { backend: $<HTMLSelectElement>('backend').value, preset: $<HTMLSelectElement>('preset').value, octree: num('octree'), seed: num('seed'), tris: num('tris'), final: num('final'), k: num('k'), head: $<HTMLSelectElement>('head').value, hair: $<HTMLSelectElement>('hair').value, cut: $<HTMLSelectElement>('cut').value },
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
  $('sheets').innerHTML = (state.sheets ?? []).map((sh) => `
    <div class="item ${sh.id === sheetSel ? 'sel' : ''}" data-sheet="${esc(sh.id)}"><img src="/api/sheets/${esc(sh.id)}/${esc(sh.front)}" alt="" />
    <div><div>${esc(sh.name)}</div><div class="st ${statusClass(sh.status)}">${esc(sh.status ?? '')} · ${sh.items?.length ?? 0} items · ${Object.keys(sh.made ?? {}).length} made</div></div></div>`).join('')
    || '<div class="empty">None yet.</div>';
  $('bodies').innerHTML = (state.bodies ?? []).map((b) => `
    <div class="item" data-body="${esc(b.name)}"><img src="/api/library/${esc(b.file.replace('.glb', '.png'))}" alt="" />
    <div><div>${esc(b.name)}</div><div class="st">build ${esc(b.build)} · ${esc(b.added)}</div></div></div>`).join('')
    || '<div class="empty">None yet: Show → Proportions, then "Save body".</div>';
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
$('bodies').addEventListener('click', () => { $<HTMLSelectElement>('show').value = 'bodies'; render(); });
$('sheets').addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>('[data-sheet]')?.dataset.sheet;
  if (id) selectSheet(id);
});
function selectSheet(id: string) { sheetSel = id; detailKey = ''; render(); }

function select(id: string) {
  selected = id;
  sheetSel = null;
  try { localStorage.setItem('studio.sel', id); } catch { /* private mode */ }
  if (!proportioning()) $<HTMLSelectElement>('show').value = 'figure';  // (Proportions stays: it shows the selected figure)
  detailKey = '';
  render();
}

// ---------------------------------------------------------------- detail panel
const SLOT_NAMES = ['skin', 'hair', 'cloth', 'boot', 'hat', 'pack', 'strap', 'eye'];
const armed = new Set<string>(); // two-click confirmations (browser dialogs are blocked in some frames)

// ---------------------------------------------------------------- sheet panel
const CATS = ['body', 'hair', 'hat', 'scarf', 'cloak', 'top', 'belt', 'bag', 'backpack', 'gloves', 'trousers', 'wraps', 'boots', 'bedroll', 'other'];
const edits = new Map<string, { use: boolean; cat: string; name: string }>();  // per sheet:item, kept across refreshes
function renderSheet(sh: Sheet) {
  const key = JSON.stringify(sh) + [...armed].join();
  if (key === detailKey) return;
  detailKey = key;
  const busy = sh.status === 'splitting';
  const items = sh.items ?? [];
  const count: Record<string, number> = {};
  const ed = (it: SheetItem) => {
    const k = `${sh.id}:${it.index}`;
    if (!edits.has(k)) {
      const cat = it.guess ?? 'other';
      count[cat] = (count[cat] ?? 0) + 1;
      edits.set(k, { use: true, cat, name: `${sh.name} ${cat}${count[cat] > 1 ? ' ' + count[cat] : ''}` });
    }
    return edits.get(k)!;
  };
  const made = (it: SheetItem) => state.figures.find((f) => f.id === sh.made?.[String(it.index)]);
  $('detail').innerHTML = `
    <h1>${esc(sh.name)}</h1>
    <div class="sub">${esc(sh.id)} · <span class="st ${statusClass(sh.status)}">${esc(sh.status)}</span>${sh.back ? ' · with a back sheet' : ''}</div>
    ${sh.error ? `<div class="note" style="border-color:var(--bad);margin-top:8px;white-space:pre-wrap;font-family:monospace;font-size:11px">${esc(sh.error)}</div>` : ''}
    <div class="imgs" style="margin-top:8px"><img src="/api/sheets/${esc(sh.id)}/${esc(sh.front)}" alt="" />${sh.back ? `<img src="/api/sheets/${esc(sh.id)}/${esc(sh.back)}" alt="" />` : ''}</div>
    <label>Separation <span class="sub">${sh.gap}: raise it if an item falls into pieces, lower it if two items come out as one</span></label>
    <div class="row"><input id="sGap" type="range" min="0.5" max="10" step="0.5" value="${sh.gap}" /><button id="sSplit" ${busy ? 'disabled' : ''}>Split again</button></div>
    <h2>${items.length} items</h2>
    <div class="sub">Untick what you don't want; check each one's category (a guess). A body becomes a figure (rigged, fitted, ready for Proportions); everything else a garment (generated and coloured, unrigged until fitting).</div>
    <div class="grid">${items.map((it) => {
      const e = ed(it), f = made(it);
      return `<div class="cell ${e.use ? '' : 'off'}">
        <div class="pics"><img src="/api/sheets/${esc(sh.id)}/${esc(it.front)}" alt="" />${it.back ? `<img src="/api/sheets/${esc(sh.id)}/${esc(it.back)}" alt="" title="back" />` : ''}</div>
        <label style="margin-top:4px"><input type="checkbox" data-use="${it.index}" ${e.use ? 'checked' : ''} /> make #${it.index}</label>
        <select data-cat="${it.index}">${CATS.map((c) => `<option ${c === e.cat ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <input type="text" data-name="${it.index}" value="${esc(e.name)}" />
        ${f ? `<div class="st ${statusClass(f.status)}" data-open="${esc(f.id)}" style="cursor:pointer">→ ${esc(f.status)}</div>` : ''}
      </div>`;
    }).join('')}</div>
    <div class="actions">
      <button class="primary" id="sMake" ${busy || !items.length ? 'disabled' : ''}>Make selected</button>
      <button id="sDel" class="warn">${armed.has('sdel') ? 'Click again to delete the sheet' : 'Delete sheet'}</button>
    </div>
    <div class="sub">Generation takes about a minute an item on a GPU (much longer on a CPU); items queue one at a time. With a back sheet, each item is generated from both views.</div>`;
  const get = (i: number) => edits.get(`${sh.id}:${i}`)!;
  $('detail').querySelectorAll<HTMLInputElement>('[data-use]').forEach((el) => { el.onchange = () => { get(+el.dataset.use!).use = el.checked; el.closest('.cell')!.classList.toggle('off', !el.checked); }; });
  $('detail').querySelectorAll<HTMLSelectElement>('select[data-cat]').forEach((el) => { el.onchange = () => { get(+el.dataset.cat!).cat = el.value; }; });
  $('detail').querySelectorAll<HTMLInputElement>('[data-name]').forEach((el) => { el.oninput = () => { get(+el.dataset.name!).name = el.value; }; });
  $('detail').querySelectorAll<HTMLElement>('[data-open]').forEach((el) => { el.onclick = () => select(el.dataset.open!); });
  $('sSplit').onclick = async () => { try { await api(`sheets/${sh.id}/split`, { gap: Number($<HTMLInputElement>('sGap').value) }); for (const k of [...edits.keys()]) if (k.startsWith(sh.id + ':')) edits.delete(k); } catch (e) { alertBox(String(e)); } void poll(); };
  $('sMake').onclick = async () => {
    const num = (id: string) => Number($<HTMLInputElement>(id).value);
    const chosen = items.filter((it) => get(it.index).use).map((it) => ({ index: it.index, category: get(it.index).cat, name: get(it.index).name }));
    try {
      await api(`sheets/${sh.id}/make`, { items: chosen, params: { backend: $<HTMLSelectElement>('backend').value, preset: $<HTMLSelectElement>('preset').value, octree: num('octree'), seed: num('seed'), tris: num('tris'), final: num('final'), k: num('k'), head: 'keep' } });
    } catch (e) { alertBox(String(e)); }
    void poll();
  };
  $('sDel').onclick = () => {
    if (armed.has('sdel')) { armed.delete('sdel'); void api(`sheets/${sh.id}/delete`, {}).then(() => { sheetSel = null; void poll(); }); }
    else { armed.add('sdel'); setTimeout(() => { armed.delete('sdel'); detailKey = ''; render(); }, 4000); }
    detailKey = ''; render();
  };
}

function renderDetail() {
  if (composing() || proportioning()) return;  // the Compose / Proportions panel owns the right-hand column
  const sh = sheetSel ? state.sheets?.find((x) => x.id === sheetSel) : undefined;
  if (sh) { renderSheet(sh); return; }
  const f = state.figures.find((x) => x.id === selected);
  const key = JSON.stringify(f ?? null) + [...armed].join();
  if (key === detailKey) return;
  detailKey = key;
  if (!f) { $('detail').innerHTML = '<div class="empty">Select or make a figure.</div>'; return; }
  const busy = !!f.status && (f.status.startsWith('running') || f.status === 'queued');
  const imgs = [f.front, f.back, f.files.includes('front.png') ? 'front.png' : '', f.files.includes('back.png') ? 'back.png' : '',
    ...['labels_front_vis.png', 'labels_back_vis.png'].filter((x) => f.files.includes(x))].filter(Boolean) as string[];
  const rgb = (c: number[]) => `rgb(${c.map((x) => Math.round(x * 255)).join(',')})`;
  if (f.kind === 'garment') {  // from a sheet: generated and coloured, unrigged (fitting onto bodies comes next)
    $('detail').innerHTML = `
      <h1>${esc(f.name)}</h1>
      <div class="sub">${esc(f.category ?? 'garment')} · ${esc(f.id)} · <span class="st ${statusClass(f.status)}">${esc(f.status)}</span></div>
      ${f.error ? `<div class="note" style="border-color:var(--bad);margin-top:8px;white-space:pre-wrap;font-family:monospace;font-size:11px">${esc(f.error)}</div>` : ''}
      <h2>Images</h2>
      <div class="imgs">${imgs.map((i) => `<img src="${work(f, i)}" title="${esc(i)}" alt="" />`).join('')}</div>
      <div class="note" style="margin-top:8px">A garment: generated and coloured from its drawing${f.back ? ' (front and back)' : ' (front; the back is filled from the sides)'}, not rigged. Fitting garments onto bodies is the next step.</div>
      <div class="row">
        <div><label>Seed</label><input id="dSeed" type="number" value="${esc(f.params.seed ?? 1234)}" /></div>
        <div><label>Quality</label><select id="dPreset">${['turbo', 'full'].map((p) => `<option ${p === (f.params.preset ?? 'turbo') ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      </div>
      <div class="actions">
        <button id="gGen" ${busy ? 'disabled' : ''}>Generate again</button>
        <button id="gCol" ${busy || !f.done.includes('generate') ? 'disabled' : ''}>Colour again</button>
        <button id="aDel" class="warn" ${busy ? 'disabled' : ''}>${armed.has('del') ? 'Click again to delete' : 'Delete'}</button>
      </div>
      <h2>Log</h2><pre id="log">…</pre>`;
    void loadLog(f);
    const act = async (path: string, body: unknown = {}) => { try { await api(`figures/${f.id}/${path}`, body); } catch (e) { alertBox(String(e)); } void poll(); };
    const params = () => ({ seed: Number($<HTMLInputElement>('dSeed').value), preset: $<HTMLSelectElement>('dPreset').value });
    $('gGen').onclick = () => act('run', { steps: ['generate', 'garment'], params: params() });
    $('gCol').onclick = () => act('run', { steps: ['garment'] });
    $('aDel').onclick = () => {
      if (armed.has('del')) { armed.delete('del'); void act('delete'); selected = null; } else { armed.add('del'); setTimeout(() => { armed.delete('del'); renderDetail(); }, 4000); }
      renderDetail();
    };
    return;
  }
  $('detail').innerHTML = `
    <h1>${esc(f.name)}</h1>
    <div class="sub">${esc(f.id)} · <span class="st ${statusClass(f.status)}">${esc(f.status)}</span></div>
    ${f.error ? `<div class="note" style="border-color:var(--bad);margin-top:8px;white-space:pre-wrap;font-family:monospace;font-size:11px">${esc(f.error)}</div>` : ''}
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
      <div><label>Working triangles</label><input id="dTris" type="number" value="${esc(f.params.tris ?? 30000)}" step="5000" /></div>
      <div><label>Saved triangles</label><input id="dFinal" type="number" value="${esc(f.params.final ?? 12000)}" step="1000" /></div>
      <div><label>Colour slots</label><input id="dK" type="number" value="${esc(f.params.k ?? 10)}" min="3" max="14" /></div>
    </div>
    <div class="row">
      <div><label>Head (face)</label><select id="dHead">${HEADS.map((h) => `<option value="${h}" ${h === (f.params.head ?? 'keep') ? 'selected' : ''}>${h === 'keep' ? 'generated' : `workshop: ${h}`}</option>`).join('')}</select></div>
      <div><label>Cut parts by</label><select id="dCut">${['garments', 'bones'].map((c) => `<option ${c === (f.params.cut ?? 'garments') ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
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
  const params = () => ({ seed: num('dSeed'), preset: $<HTMLSelectElement>('dPreset').value, tris: num('dTris'), final: num('dFinal'), k: num('dK'), head: $<HTMLSelectElement>('dHead').value, hair: $<HTMLSelectElement>('dHair').value, cut: $<HTMLSelectElement>('dCut').value });
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
