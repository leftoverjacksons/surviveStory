/**
 * The graphics panel (DESIGN §34): the pixel look's parts, adjusted live and
 * remembered in this browser. Key G, or the button under Testing tools.
 *
 * The look is several layers that can be told apart:
 * - pixel size: the scene drawn at 1/n of the screen and enlarged with hard
 *   pixels (1 = full resolution, no pixelation);
 * - outlines drawn from depth, for each kind of thing separately (DESIGN §39);
 * - colour steps (the grade's quantising);
 * - surface patterns: planks, brick, loam and leaves in world space;
 * - bloom, exposure, shadows;
 * - grass: tufts of geometry, and/or grass painted into the turf.
 * So "pixel textures without the overall pixel effect" is: pixel size 1,
 * surface patterns on.
 */
import { OUTLINE_CATS } from '../render/outlinecats';

export interface GfxSettings {
  px: number;
  outline: boolean;
  /** Kinds of thing drawn without outlines (render/outlinecats.ts keys). */
  outlineOff: string[];
  /** Size of an outline pixel on screen (0: the same as the scene's pixel size). */
  outlinePx: number;
  /** Broadleaf canopies as clouds of cut-out leaf cards instead of solid blobs (DESIGN §41). */
  leafCards: boolean;
  steps: number;
  surface: number;
  bloom: number;
  exposure: number;
  shadows: boolean;
  tufts: boolean;
  grassPaint: number;
}

export interface GfxHooks {
  /** The pixel look was on at load (`?smooth` turns it off, and most of these with it). */
  pixel: boolean;
  defaults: GfxSettings;
  apply(s: GfxSettings, changed: keyof GfxSettings | null): void;
}

const KEY = 'ss-gfx';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export class GfxPanel {
  s: GfxSettings;
  private el: HTMLElement;

  constructor(private hooks: GfxHooks) {
    let saved: Partial<GfxSettings> = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { /* ignore */ }
    this.s = { ...hooks.defaults, ...saved };
    this.el = document.createElement('section');
    this.el.id = 'gfx';
    this.el.className = 'hud panel';
    this.el.hidden = true;
    document.body.appendChild(this.el);
    this.el.addEventListener('input', (e) => this.read(e.target as HTMLInputElement));
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      if (b.id === 'gfx-close') this.toggle(false);
      if (b.id === 'gfx-reset') { this.s = { ...this.hooks.defaults }; this.save(); this.hooks.apply(this.s, null); this.render(); }
      const preset = b.dataset.preset;
      if (preset) { Object.assign(this.s, PRESETS[preset]); this.save(); this.hooks.apply(this.s, null); this.render(); }
    });
    hooks.apply(this.s, null);
  }

  /** Apply the settings again (once the scene has everything in it, e.g. the tufts). */
  refresh() { this.hooks.apply(this.s, null); }

  toggle(on = this.el.hidden) {
    this.el.hidden = !on;
    if (on) this.render();
  }

  private read(t: HTMLInputElement) {
    if (t.name.startsWith('oc-')) {
      const key = t.name.slice(3);
      this.s.outlineOff = t.checked ? this.s.outlineOff.filter((x) => x !== key) : [...new Set([...this.s.outlineOff, key])];
      this.save();
      this.hooks.apply(this.s, 'outlineOff');
      return;
    }
    const k = t.name as keyof GfxSettings;
    if (!k || !(k in this.s)) return;
    const v = t.type === 'checkbox' ? t.checked : Number(t.value);
    (this.s as unknown as Record<string, unknown>)[k] = v;
    this.save();
    this.hooks.apply(this.s, k);
    if (k === 'outline') this.el.querySelectorAll<HTMLInputElement>('.ocats input').forEach((x) => { x.disabled = !v; });
    const out = this.el.querySelector(`output[for="gfx-${k}"]`);
    if (out) out.textContent = fmt(k, v);
  }

  private save() { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch { /* ignore */ } }

  private render() {
    const s = this.s, px = this.hooks.pixel;
    const range = (k: keyof GfxSettings, label: string, min: number, max: number, step: number, note = '') =>
      `<label title="${esc(note)}"><span>${esc(label)}</span><input id="gfx-${k}" name="${k}" type="range" min="${min}" max="${max}" step="${step}" value="${s[k]}"><output for="gfx-${k}">${fmt(k, s[k])}</output></label>`;
    const check = (k: keyof GfxSettings, label: string, note = '') =>
      `<label title="${esc(note)}"><span>${esc(label)}</span><input name="${k}" type="checkbox" ${s[k] ? 'checked' : ''}></label>`;
    this.el.innerHTML = `<h3>Graphics<button type="button" id="gfx-close">Close</button></h3>
      ${px ? '' : '<div class="what">The pixel look is off for this page (?smooth): pixel size, outlines, colour steps and surface patterns do nothing here.</div>'}
      <div class="row presets">
        <button type="button" data-preset="pixel" title="The published look">Pixel art</button>
        <button type="button" data-preset="crisp" title="Full resolution, pixel-scale textures kept">Crisp + textures</button>
        <button type="button" data-preset="clean" title="Full resolution, no outlines or colour steps">Clean</button>
      </div>
      ${range('px', 'Pixel size', 1, 6, 1, '1 = full resolution: no pixelation')}
      ${check('outline', 'Outlines', 'Dark edges drawn from depth')}
      ${range('outlinePx', 'Outline pixel', 0, 8, 1, 'How big the outlines\' pixels are on screen, separately from the scene\'s. 0 = the same as Pixel size. With Pixel size 1 (no pixelation), 2–4 gives chunky pixel lines over a smooth picture.')}
      <details class="ocats" ${s.outlineOff.length ? 'open' : ''}><summary>Outlines on…</summary>
        ${OUTLINE_CATS.map((c) => `<label><span>${esc(c.label)}</span><input name="oc-${c.key}" type="checkbox" ${s.outlineOff.includes(c.key) ? '' : 'checked'} ${s.outline ? '' : 'disabled'}></label>`).join('')}
        <div class="row presets">
          <button type="button" data-preset="lines-built" title="Lines on built things, the old world and people; none on plants, ground or glass">Built only</button>
          <button type="button" data-preset="lines-all" title="Lines on everything">All</button>
        </div>
      </details>
      ${range('steps', 'Colour steps', 0, 32, 1, '0 = smooth colour; fewer steps = more posterised')}
      ${range('surface', 'Surface patterns', 0, 1, 0.05, 'Planks, brick, loam, leaves at pixel scale')}
      ${range('bloom', 'Glow (bloom)', 0, 2, 0.05)}
      ${range('exposure', 'Exposure', 0.7, 1.7, 0.02)}
      ${check('shadows', 'Shadows')}
      ${check('leafCards', 'Leaf cards (trees)', 'Prototype: broadleaf crowns drawn as clouds of small cut-out leaf cards instead of solid blobs')}
      ${check('tufts', 'Grass tufts (geometry)', 'The small triangles in the grass')}
      ${range('grassPaint', 'Grass painted in the turf', 0, 1, 0.05, 'Clumps drawn into the ground itself: no geometry')}
      <div class="row"><button type="button" id="gfx-reset">Reset</button></div>`;
  }
}

const fmt = (k: keyof GfxSettings, v: unknown) =>
  typeof v === 'boolean' ? '' : k === 'px' ? (Number(v) === 1 ? 'off' : `${v}×`) : k === 'outlinePx' ? (Number(v) === 0 ? 'same' : `${v}px`) : k === 'steps' ? (Number(v) === 0 ? 'off' : String(v)) : Number(v).toFixed(2);

const PRESETS: Record<string, Partial<GfxSettings>> = {
  'lines-built': { outline: true, outlineOff: ['ground', 'plants', 'glass'] },
  'lines-all': { outline: true, outlineOff: [] },
  pixel: { px: 3, outline: true, steps: 20, surface: 1 },
  crisp: { px: 1, outline: false, steps: 0, surface: 1 },
  clean: { px: 1, outline: false, steps: 0, surface: 0 },
};
