/**
 * Proportions: fit a body's skeleton, then reshape the body, and save it as a base body with its own
 * build (lab/figures/body.py; lab/workshop/builds.json).
 *
 * 1. Fit skeleton: the build the figure is rigged on (rig.py; --build auto measures the mesh) is drawn
 *    over the body as lines. Move the joints onto the body with the sliders; "Apply fit" re-rigs on them.
 * 2. Reshape: the same sliders now change the body. Every bone moves to its joint in the new build and
 *    stretches along its own length (thickness across it); heads, hands and feet scale whole; each
 *    vertex blends its bones by its weights (exactly as body.py bakes it). "Save body" files it.
 *
 * derive() and bones() are lab/workshop/kit.py's derive() and set_build() bone table, ported.
 */
import * as THREE from 'three';
import type { Character } from '../../src/render/characters';

type V3 = [number, number, number];
type F = Record<string, number>;
export interface BuildsFile { adult: Record<string, V3>; adult_head_c: V3; adult_head_r: V3; builds: Record<string, Record<string, number | string>> }

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];

/** kit.derive: joints, head centre and radii for build factors b. */
export function derive(bf: BuildsFile, b: F) {
  const A = bf.adult;
  const off = (a: string, c: string) => sub(A[a], A[c]);
  const ho = off('hip', 'pelvis'); const hipOff: V3 = [ho[0] * b.hip_x, ho[1], ho[2]];
  const P = -hipOff[2] - off('knee', 'hip')[2] * b.upper_leg - off('ankle', 'knee')[2] * b.lower_leg + A.ankle[2] * b.foot;
  const J: Record<string, V3> = { pelvis: [0, 0, P] };
  for (const [j, p, f] of [['waist', 'pelvis', 'spine'], ['belly', 'waist', 'spine'], ['chest', 'belly', 'spine'], ['neck', 'chest', 'spine'], ['head', 'neck', 'neck']] as const)
    J[j] = add(J[p], mul(off(j, p), b[f]));
  J.hip = add(J.pelvis, hipOff);
  J.knee = add(J.hip, mul(off('knee', 'hip'), b.upper_leg));
  J.ankle = add(J.knee, mul(off('ankle', 'knee'), b.lower_leg));
  J.toe = add(J.ankle, mul(off('toe', 'ankle'), b.foot));
  const so = off('shoulder', 'neck');
  J.shoulder = add(J.neck, [so[0] * b.shoulder_x, so[1], so[2] * b.shoulder_z]);
  J.elbow = add(J.shoulder, mul(off('elbow', 'shoulder'), b.upper_arm));
  J.wrist = add(J.elbow, mul(off('wrist', 'elbow'), b.lower_arm));
  J.hand = add(J.wrist, mul(off('hand', 'wrist'), b.hand));
  const hc = add(add(J.head, mul(sub(bf.adult_head_c, A.head), b.head)), [0, 0, b.head_lift ?? 0]);
  return { J, hc, hr: mul(bf.adult_head_r, b.head) };
}

/** kit.set_build's bone table (without Root): name → [head, tail], Blender coordinates (Z up, face -Y). */
export function bones(bf: BuildsFile, b: F): Record<string, [V3, V3]> {
  const { J } = derive(bf, b);
  const out: Record<string, [V3, V3]> = {
    Hips: [J.pelvis, J.waist], Abdomen: [J.waist, J.belly], Torso: [J.belly, J.chest], Chest: [J.chest, J.neck],
    Neck: [J.neck, J.head], Head: [J.head, [0, 0, J.head[2] + 0.25 * b.head]],
  };
  const sym = (name: string, h: V3, t: V3) => {
    out[`${name}.L`] = [h, t];
    out[`${name}.R`] = [[-h[0], h[1], h[2]], [-t[0], t[1], t[2]]];
  };
  sym('Shoulder', [0.04 * b.shoulder_x, 0, J.shoulder[2]], J.shoulder);
  sym('UpperArm', J.shoulder, J.elbow); sym('LowerArm', J.elbow, J.wrist); sym('Wrist', J.wrist, J.hand);
  sym('UpperLeg', J.hip, J.knee); sym('LowerLeg', J.knee, J.ankle); sym('Foot', J.ankle, J.toe);
  return out;
}

/** Per bone: [along-length ratio, across ratio], or ['u', uniform ratio]. Kept in step with body.py#rule. */
function rule(name: string, o: F, n: F): [number | 'u', number] {
  const r = (k: string) => (n[k] ?? 1) / (o[k] ?? 1);
  const base = name.split('.')[0];
  if (['Hips', 'Abdomen', 'Torso', 'Chest'].includes(base)) return [r('spine'), r('torso')];
  if (base === 'Neck') return [r('neck'), 1];
  if (base === 'Head') return ['u', r('head')];
  if (base === 'UpperArm') return [r('upper_arm'), r('limb')];
  if (base === 'LowerArm') return [r('lower_arm'), r('limb')];
  if (base === 'Wrist') return ['u', r('hand')];
  if (base === 'UpperLeg') return [r('upper_leg'), r('limb')];
  if (base === 'LowerLeg') return [r('lower_leg'), r('limb')];
  if (base === 'Foot') return ['u', r('foot')];
  return [1, 1];
}

// Blender (x, y, z) ↔ glTF/three (x, z, -y).
const toB = (x: number, y: number, z: number): V3 => [x, -z, y];

/** Reshape positions (three coordinates, bind pose) from build o to build n, by the skin weights. */
export function reshape(bf: BuildsFile, o: F, n: F, src: Float32Array, out: Float32Array, si: THREE.BufferAttribute, sw: THREE.BufferAttribute, boneNames: string[]) {
  const ob = bones(bf, o), nb = bones(bf, n);
  const key = (s: string) => s.replace(/\./g, '');
  const byKey = new Map(Object.keys(ob).map((k) => [key(k), k]));
  // Per skeleton bone: head before, head after, 3×3 matrix (row-major), all in Blender coordinates.
  const D = boneNames.map((bn) => {
    const name = byKey.get(key(bn));
    if (!name) return null;
    const [h0, t0] = ob[name], [h1] = nb[name];
    const [a, c] = rule(name, o, n);
    let M: number[];
    if (a === 'u') M = [c, 0, 0, 0, c, 0, 0, 0, c];
    else {
      const d = sub(t0, h0), L = Math.hypot(...d) || 1, u: V3 = [d[0] / L, d[1] / L, d[2] / L];
      M = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M.push((i === j ? c : 0) + (a - c) * u[i] * u[j]);
    }
    return { h0, h1, M };
  });
  const cnt = src.length / 3;
  for (let v = 0; v < cnt; v++) {
    const p = toB(src[v * 3], src[v * 3 + 1], src[v * 3 + 2]);
    let x = 0, y = 0, z = 0, wt = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(v, k);
      const d = w > 0 ? D[si.getComponent(v, k)] : null;
      if (!d) continue;
      const q = sub(p, d.h0), M = d.M;
      x += w * (d.h1[0] + M[0] * q[0] + M[1] * q[1] + M[2] * q[2]);
      y += w * (d.h1[1] + M[3] * q[0] + M[4] * q[1] + M[5] * q[2]);
      z += w * (d.h1[2] + M[6] * q[0] + M[7] * q[1] + M[8] * q[2]);
      wt += w;
    }
    if (wt > 0) { x /= wt; y /= wt; z /= wt; } else [x, y, z] = p;
    out[v * 3] = x; out[v * 3 + 1] = z; out[v * 3 + 2] = -y;  // back to three
  }
}

/** The sliders: factor, label, range; `shape` = only meaningful when reshaping (no joint moves). */
export const SLIDERS: { k: string; label: string; min: number; max: number; shape?: boolean }[] = [
  { k: 'head', label: 'Head size', min: 0.6, max: 2.2 },
  { k: 'neck', label: 'Neck', min: 0.3, max: 1.8 },
  { k: 'spine', label: 'Torso length', min: 0.5, max: 1.8 },
  { k: 'shoulder_x', label: 'Shoulder width', min: 0.5, max: 1.8 },
  { k: 'shoulder_z', label: 'Shoulder height', min: 0.4, max: 1.6 },
  { k: 'hip_x', label: 'Hip width', min: 0.5, max: 2 },
  { k: 'upper_arm', label: 'Upper arm', min: 0.4, max: 2.6 },
  { k: 'lower_arm', label: 'Forearm', min: 0.4, max: 2.6 },
  { k: 'hand', label: 'Hands', min: 0.4, max: 2.6 },
  { k: 'upper_leg', label: 'Thigh', min: 0.35, max: 1.8 },
  { k: 'lower_leg', label: 'Shin', min: 0.35, max: 1.8 },
  { k: 'foot', label: 'Feet', min: 0.5, max: 2.4 },
  { k: 'limb', label: 'Limb thickness', min: 0.5, max: 2, shape: true },
  { k: 'torso', label: 'Body thickness', min: 0.5, max: 2, shape: true },
];

const KEYS = ['spine', 'neck', 'upper_leg', 'lower_leg', 'foot', 'upper_arm', 'lower_arm', 'hand', 'head', 'head_lift', 'shoulder_x', 'shoulder_z', 'hip_x', 'limb', 'torso', 'belly'];
export const clean = (b: Record<string, number | string>): F => Object.fromEntries(KEYS.map((k) => [k, Number(b[k] ?? (k === 'head_lift' ? 0 : 1))]));

/** The live preview on a shown character: reshaped positions and the skeleton as lines. */
export class Preview {
  private src: Float32Array;
  private pos: THREE.BufferAttribute;
  private lines: THREE.LineSegments;
  private local: Float32Array;
  constructor(private c: Character, private bf: BuildsFile) {
    const g = c.mesh.geometry;
    // Packed figures store positions quantised, with a scale and offset on the mesh: work in the skeleton's
    // space (the bind matrix takes mesh positions there) and convert back after reshaping.
    const raw = g.attributes.position as THREE.BufferAttribute, n = raw.count, v = new THREE.Vector3();
    this.src = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(raw, i).applyMatrix4(c.mesh.bindMatrix); this.src.set([v.x, v.y, v.z], i * 3); }
    this.local = new Float32Array(n * 3);
    this.pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    g.setAttribute('position', this.pos);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(17 * 2 * 3), 3));
    this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#ffe066', depthTest: false, transparent: true }));
    this.lines.renderOrder = 10;
    c.mesh.add(this.lines);
    c.mesh.skeleton.pose();
  }

  /** Mesh from base → shape (reshape), lines at the skeleton of `skel`. */
  update(base: F, shape: F, skel: F) {
    const g = this.c.mesh.geometry;
    reshape(this.bf, base, shape, this.src, this.local, g.attributes.skinIndex as THREE.BufferAttribute,
      g.attributes.skinWeight as THREE.BufferAttribute, this.c.mesh.skeleton.bones.map((b) => b.name));
    const inv = this.c.mesh.bindMatrixInverse, v = new THREE.Vector3(), out = this.pos.array as Float32Array;
    for (let i = 0; i < this.local.length; i += 3) {
      v.set(this.local[i], this.local[i + 1], this.local[i + 2]).applyMatrix4(inv);
      out[i] = v.x; out[i + 1] = v.y; out[i + 2] = v.z;
    }
    this.pos.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const bs = bones(this.bf, skel), arr = this.lines.geometry.attributes.position.array as Float32Array;
    let i = 0;
    for (const [h, t] of Object.values(bs)) for (const p of [h, t]) {
      v.set(p[0], p[2], -p[1]).applyMatrix4(inv);
      arr[i++] = v.x; arr[i++] = v.y; arr[i++] = v.z;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.setDrawRange(0, i / 3);
  }

  dispose() { this.lines.removeFromParent(); }
}

// ---------------------------------------------------------------- the panel
interface Fig { id: string; name: string; files: string[]; stamp?: number; status?: string; params: Record<string, string | number> }
type Api = (path: string, body?: unknown) => Promise<any>;
interface StageLike { still(url: string): Promise<Character | null> }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class ProportionsPanel {
  private bf: BuildsFile | null = null;
  private base: F | null = null;   // the build the figure is rigged on
  private fit: F | null = null;    // step 1: where the joints should be
  private shape: F | null = null;  // step 2: the new proportions
  private step: 'fit' | 'shape' = 'fit';
  private preview: Preview | null = null;
  private key = '';
  private note = '';
  private status: string | undefined;
  constructor(private el: HTMLElement, private stage: StageLike, private api: Api, private figure: () => Fig | undefined) {}

  /** Leaving the panel: forget the shown body (the next visit reloads it). */
  leave() { this.preview?.dispose(); this.preview = null; this.key = ''; }

  /** Called on every studio refresh: (re)load when the figure or its rig changed. */
  async sync() {
    const f = this.figure();
    const key = f ? `${f.id}:${f.stamp ?? 0}:${f.files.includes('packed.glb')}` : '';
    if (key === this.key) {  // same body: only the job status may have changed (buttons)
      if (f && f.status !== this.status) { this.status = f.status; this.render(); }
      return;
    }
    this.status = f?.status;
    this.key = key;
    this.preview?.dispose(); this.preview = null;
    if (!f || !f.files.includes('packed.glb')) { this.el.innerHTML = '<h1>Proportions</h1><div class="empty">Select a rigged figure (a body works best: one in shorts, A-pose).</div>'; return; }
    this.bf ??= await this.api('builds');
    const built = f.files.includes('rigged.build.json')
      ? await fetch(`/api/work/${f.id}/rigged.build.json?v=${f.stamp ?? 0}`).then((r) => r.json()) : null;
    this.note = built ? '' : 'This figure was rigged before builds were recorded: shown on the hero build. "Auto-fit" or "Apply fit" re-rigs it.';
    this.base = clean(built ?? this.bf!.builds.hero);
    this.fit = { ...this.base }; this.shape = { ...this.base };
    const c = await this.stage.still(`/api/work/${f.id}/packed.glb?v=${f.stamp ?? 0}`);
    if (c) this.preview = new Preview(c, this.bf!);
    this.render();
    this.update();
  }

  private update() {
    if (!this.preview || !this.base) return;
    if (this.step === 'fit') this.preview.update(this.base, this.base, this.fit!);
    else this.preview.update(this.base, this.shape!, this.shape!);
  }

  render() {
    const f = this.figure();
    if (!f || !this.bf || !this.base) return;
    const busy = !!f.status && (f.status.startsWith('running') || f.status === 'queued');
    const vals = this.step === 'fit' ? this.fit! : this.shape!;
    const builds = Object.keys(this.bf.builds);
    this.el.innerHTML = `
      <h1>Proportions</h1>
      <div class="sub">${esc(f.name)} · rigged on ${esc(f.params.build ?? 'hero')}${busy ? ` · <span class="st running">${esc(f.status)}</span>` : ''}</div>
      ${this.note ? `<div class="note" style="margin-top:8px">${esc(this.note)}</div>` : ''}
      <div class="actions" style="margin-top:10px">
        <button id="pFit" class="${this.step === 'fit' ? 'primary' : ''}">1. Fit skeleton</button>
        <button id="pShape" class="${this.step === 'shape' ? 'primary' : ''}">2. Reshape</button>
      </div>
      <div class="sub" style="margin:6px 0 8px">${this.step === 'fit'
        ? 'Move the joints (yellow lines) onto the body: the hips at the top of the legs, the knees, the neck, the shoulders, the hands. The body does not change. "Apply fit" re-rigs it on these joints (about 15 s on a CPU).'
        : 'Change the body: every bone stretches along its length, heads, hands and feet scale whole. Then name it and save it as a base body with its own build.'}</div>
      ${SLIDERS.filter((s) => this.step === 'shape' || !s.shape).map((s) => `
        <label>${esc(s.label)} <span class="sub" id="pv_${s.k}">${vals[s.k].toFixed(2)}${this.step === 'shape' ? ` (${Math.round((vals[s.k] / this.base![s.k]) * 100)}%)` : ''}</span></label>
        <input type="range" data-k="${s.k}" min="${s.min}" max="${s.max}" step="0.01" value="${vals[s.k]}" style="width:100%" />`).join('')}
      ${this.step === 'fit' ? `
        <div class="actions">
          <button id="pAuto" ${busy ? 'disabled' : ''}>Auto-fit (measure the body)</button>
          <button id="pApply" class="primary" ${busy ? 'disabled' : ''}>Apply fit</button>
          <button id="pReset">Reset</button>
        </div>` : `
        <label>Start from a build</label>
        <select id="pPreset"><option value="">(this body)</option>${builds.map((b) => `<option>${esc(b)}</option>`).join('')}</select>
        <label>Body name</label><input id="pName" type="text" value="${esc(f.name)}" />
        <div class="actions">
          <button id="pSave" class="primary" ${busy ? 'disabled' : ''}>Save body to library</button>
          <button id="pReset">Reset</button>
        </div>`}`;
    const $ = (id: string) => this.el.querySelector<HTMLElement>('#' + id);
    $('pFit')!.onclick = () => { this.step = 'fit'; this.render(); this.update(); };
    $('pShape')!.onclick = () => { this.step = 'shape'; this.render(); this.update(); };
    this.el.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((inp) => {
      inp.oninput = () => {
        const k = inp.dataset.k!, v = Number(inp.value);
        (this.step === 'fit' ? this.fit! : this.shape!)[k] = v;
        const lab = this.el.querySelector('#pv_' + k);
        if (lab) lab.textContent = v.toFixed(2) + (this.step === 'shape' ? ` (${Math.round((v / this.base![k]) * 100)}%)` : '');
        this.update();
      };
    });
    $('pReset')!.onclick = () => { if (this.step === 'fit') this.fit = { ...this.base! }; else this.shape = { ...this.base! }; this.render(); this.update(); };
    const run = async (path: string, body: unknown) => { try { await this.api(`figures/${f.id}/${path}`, body); } catch (e) { this.note = String(e); this.render(); } };
    if (this.step === 'fit') {
      $('pAuto')!.onclick = () => run('run', { steps: ['rig', 'pack'], params: { build: 'auto' } });
      $('pApply')!.onclick = () => run('fit', { factors: this.fit });
    } else {
      const pre = $('pPreset') as HTMLSelectElement;
      pre.onchange = () => { if (pre.value) { this.shape = { ...clean(this.bf!.builds[pre.value]), limb: this.shape!.limb, torso: this.shape!.torso }; this.render(); this.update(); } };
      $('pSave')!.onclick = () => run('body', { name: ($('pName') as HTMLInputElement).value, factors: this.shape });
    }
  }
}
