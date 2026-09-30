/**
 * Compose: survivors dressed at run time from the workshop's parts library
 * (lab/workshop/build.py --parts → library/parts_<build>.glb + .json), the way
 * the game would: one part per slot, chosen from the survivor's role, clothes
 * and equipment, merged into one mesh. Changing a part re-composes the figure.
 *
 * Two modes: a recipe (pick parts by hand, or start from a workshop recipe),
 * and a village crowd (random survivors dressed by simple role rules, colours
 * varied per survivor as in the game).
 */
import type { StageFigure } from './stage';

interface Manifest {
  build: string;
  parts: Record<string, { category: string; slots: string[]; triangles: number }>;
  recipes: Record<string, { build: string; pool: string; parts: Record<string, string>; palette: Record<string, string> }>;
}

const LIB = (build: string) => `/api/library/parts_${build}.glb`;
const BUILDS = ['hero', 'stout'];
const ORDER = ['body', 'head', 'hair', 'beard', 'top', 'vest', 'bottom', 'legs', 'feet', 'hands', 'neck', 'waist', 'straps', 'bag', 'back', 'outer', 'held'];
const ALWAYS = new Set(['body', 'head']);
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Role rules: what a survivor in this role wears and carries (the game's decision, sketched). */
const ROLES: Record<string, (pick: (cat: string) => string, rnd: () => number) => Record<string, string>> = {
  gardener: (_pick, rnd) => ({ top: 'top.shirt_rolled', bottom: 'bottom.overalls', bag: rnd() < 0.7 ? 'bag.plant_sack' : '', held: rnd() < 0.8 ? 'held.trowel' : '', neck: rnd() < 0.5 ? 'neck.bandana' : '' }),
  scout: (_pick, rnd) => ({ top: 'top.tunic', bottom: 'bottom.baggy', legs: 'legs.wraps', outer: 'outer.cloak', back: 'back.bedroll', straps: 'straps.chest', held: rnd() < 0.6 ? 'held.lantern' : '', neck: 'neck.scarf' }),
  salvager: (pick, rnd) => ({ top: pick('top'), bottom: 'bottom.baggy', legs: rnd() < 0.5 ? 'legs.wraps' : '', bag: 'bag.satchel', waist: 'waist.belt', hands: 'hands.gloves_fingerless' }),
  builder: (_pick, rnd) => ({ top: 'top.shirt_rolled', vest: rnd() < 0.7 ? 'vest.waistcoat' : '', straps: rnd() < 0.6 ? 'straps.suspenders' : '', bottom: 'bottom.work', waist: 'waist.tool_belt', held: rnd() < 0.8 ? 'held.mallet' : '', beard: rnd() < 0.6 ? 'beard.full' : '' }),
  villager: (pick, rnd) => ({ top: pick('top'), bottom: pick('bottom'), neck: rnd() < 0.4 ? pick('neck') : '', waist: rnd() < 0.4 ? 'waist.belt' : '' }),
};

export class Composer {
  manifest: Manifest | null = null;
  build = 'hero';
  picks: Record<string, string> = {};
  palette: Record<string, string> = {};
  mode: 'recipe' | 'crowd' = 'recipe';
  crowdSeed = 1;
  crowd: StageFigure[] = [];
  constructor(private el: HTMLElement, private onChange: () => void) {}

  async load() {
    if (this.manifest) return true;
    try {
      this.manifest = await fetch('/api/library/parts_hero.json').then((r) => (r.ok ? r.json() : null));
    } catch { this.manifest = null; }
    if (this.manifest) this.useRecipe(Object.keys(this.manifest.recipes)[0]);
    return !!this.manifest;
  }

  private byCategory() {
    const out: Record<string, string[]> = {};
    for (const [n, p] of Object.entries(this.manifest!.parts)) (out[p.category] ??= []).push(n);
    return out;
  }

  useRecipe(name: string) {
    const r = this.manifest!.recipes[name];
    this.picks = { ...r.parts };
    this.palette = { ...r.palette };
    this.build = r.build;
    this.mode = 'recipe';
  }

  /** A crowd of survivors: roles → parts; colours from the game's per-survivor variety. */
  makeCrowd(n = 7) {
    let s = this.crowdSeed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const cats = this.byCategory();
    const pick = (cat: string) => cats[cat][Math.floor(rnd() * cats[cat].length)];
    const roles = Object.keys(ROLES);
    this.crowd = Array.from({ length: n }, (_, i) => {
      const role = roles[Math.floor(rnd() * roles.length)];
      const build = role === 'builder' || rnd() < 0.15 ? 'stout' : 'hero';
      const parts: Record<string, string> = { body: 'body.base', head: 'head.face', hair: pick('hair'), feet: 'feet.boots', ...ROLES[role](pick, rnd) };
      if (rnd() < 0.5 && !parts.hands) parts.hands = 'hands.gloves_fingerless';
      return { name: `${role} ${i + 1}`, url: LIB(build), seed: Math.floor(rnd() * 1000), compose: { parts: Object.values(parts).filter(Boolean) } };
    });
    this.mode = 'crowd';
  }

  figures(): StageFigure[] {
    if (!this.manifest) return [];
    if (this.mode === 'crowd') return this.crowd;
    return [{ name: 'composed', url: LIB(this.build), compose: { parts: Object.values(this.picks).filter(Boolean), palette: this.palette } }];
  }

  render() {
    const m = this.manifest;
    if (!m) {
      this.el.innerHTML = `<h1>Compose</h1><div class="note">No parts library yet. Build it with<br><b>python lab/workshop/build.py --parts</b></div>`;
      return;
    }
    const cats = this.byCategory();
    const tris = Object.values(this.picks).filter(Boolean).reduce((n, p) => n + (m.parts[p]?.triangles ?? 0), 0);
    this.el.innerHTML = `
      <h1>Compose</h1>
      <div class="sub">Survivors dressed from the parts library (${Object.keys(m.parts).length} parts; builds ${BUILDS.join(', ')}), one part per slot, merged into one mesh, as the game would at run time.</div>
      <h2>Start from</h2>
      <div class="row"><select id="cRecipe"><option value="">(custom)</option>${Object.keys(m.recipes).map((r) => `<option ${this.mode === 'recipe' && JSON.stringify(m.recipes[r].parts) === JSON.stringify(this.picks) ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
      <button id="cCrowd">${this.mode === 'crowd' ? 'Another crowd' : 'Village crowd'}</button></div>
      ${this.mode === 'crowd'
        ? `<div class="note" style="margin-top:8px">${this.crowd.map((f) => esc(f.name)).join(', ')}.<br>Parts from each survivor's role; colours varied per survivor (turn off “Own colours” to see the game's variety).</div>`
        : `<label>Build</label><select id="cBuild">${BUILDS.map((b) => `<option ${b === this.build ? 'selected' : ''}>${b}</option>`).join('')}</select>
      <h2>Parts (${tris} triangles)</h2>
      ${ORDER.filter((c) => cats[c]).map((c) => `<label>${c}</label><select data-cat="${c}">${ALWAYS.has(c) ? '' : '<option value="">(none)</option>'}${cats[c].map((p) => `<option value="${esc(p)}" ${this.picks[c] === p ? 'selected' : ''}>${esc(p.split('.')[1])}</option>`).join('')}</select>`).join('')}`}`;
    (this.el.querySelector('#cRecipe') as HTMLSelectElement).onchange = (e) => {
      const v = (e.target as HTMLSelectElement).value;
      if (v) this.useRecipe(v); else this.mode = 'recipe';
      this.render(); this.onChange();
    };
    (this.el.querySelector('#cCrowd') as HTMLButtonElement).onclick = () => { if (this.mode === 'crowd') this.crowdSeed++; this.makeCrowd(); this.render(); this.onChange(); };
    const cb = this.el.querySelector('#cBuild') as HTMLSelectElement | null;
    if (cb) cb.onchange = () => { this.build = cb.value; this.render(); this.onChange(); };
    this.el.querySelectorAll<HTMLSelectElement>('[data-cat]').forEach((s) => {
      s.onchange = () => { this.picks[s.dataset.cat!] = s.value; this.render(); this.onChange(); };
    });
  }
}
