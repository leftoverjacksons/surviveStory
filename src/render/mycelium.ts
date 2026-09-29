/**
 * The mycelium, seen (DESIGN §24.10, redrawn in §25.1). In the Veil view:
 * a branching network rooted at the hill, drawn as soft, curved ribbons
 * that are thick near the hill and taper toward the tips. The strands sway a
 * little and brighter pulses run out along them from the hill to the tips.
 * Lavender while the Folk bless, pale blue-lavender between, a dim grey-violet
 * with slow, sparse pulses while they curse. Only on explored ground.
 *
 * The shape: every cell the network reaches is joined to the hill by the
 * cheapest path through strong ground (a tree). Only strands that lead to a
 * scattering of tips are kept, and a strand's width follows how many tips it
 * feeds, so trunks run out from the hill and split into branches.
 */
import * as THREE from 'three';
import type { Colony } from '../sim/colony';
import { CELL, REACH, cellAt, folkMood } from '../sim/mycelium';
import { Ground, heightAt } from '../sim/world';
import { enhance, worldUniforms } from './util';

const BLESS = new THREE.Color('#d6b4ff'), CURSE = new THREE.Color('#6e4a86'), NEUTRAL = new THREE.Color('#a6acec');

const VERT = /* glsl */ `
attribute vec3 aLat;
attribute float aHalf;
attribute float aAcross;
attribute float aDist;
attribute float aV;
uniform float uTime;
varying float vAcross;
varying float vDist;
varying float vV;
void main() {
  // A slow sideways sway, none at the hill, growing along the strand.
  float sway = sin(aDist * 0.32 - uTime * 0.8 + aV * 3.0) * 0.16 * min(1.0, aDist / 8.0);
  vec3 p = position + aLat * (aHalf + sway);
  p.y += sin(aDist * 0.5 - uTime * 1.1) * 0.02;
  vAcross = aAcross; vDist = aDist; vV = aV;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uSpeed;
uniform float uSpacing;
uniform float uPulse;
uniform vec3 uCol;
varying float vAcross;
varying float vDist;
varying float vV;
void main() {
  // Soft across the ribbon: a bright core fading to nothing at the edges.
  float a = abs(vAcross);
  float core = pow(1.0 - a, 3.0) + (1.0 - a) * 0.3;
  // Pulses: gaussian bumps travelling outward along the strands.
  float ph = fract((vDist - uTime * uSpeed) / uSpacing);
  float pulse = exp(-pow((ph - 0.5) * 10.0, 2.0)) * uPulse;
  float b = core * (0.32 + 0.45 * vV) + core * pulse * 1.3;
  vec3 c = mix(uCol, vec3(1.0), pulse * 0.45 * core);
  gl_FragColor = vec4(c * b, 1.0) * uOpacity;
}`;

/** A number in [0, 1) from a cell index (fixed per cell). */
const hash = (c: number, k = 0) => (((c * 2654435761) ^ (k * 40503)) >>> 0) / 4294967296;

export class MyceliumView {
  readonly group = new THREE.Group();
  /** The threads (Veil view only). */
  private veins = new THREE.Group();
  /** Toadstools where the network runs thick: seen by everyone (the user's backlog, §23.2). */
  private stools: THREE.InstancedMesh[] = [];
  private stoolKey = '';
  private strands: THREE.Mesh | null = null;
  private key = '';
  private mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, toneMapped: false,
    // Seen through trees and roofs: the Veil view shows what runs under everything.
    depthTest: false,
    blending: THREE.AdditiveBlending, premultipliedAlpha: true,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: {
      uTime: { value: 0 }, uOpacity: { value: 0 }, uSpeed: { value: 5 }, uSpacing: { value: 22 }, uPulse: { value: 1 },
      uCol: { value: NEUTRAL.clone() },
    },
  });

  constructor(private col: Colony) { this.group.name = 'mycelium'; this.group.add(this.veins); }

  /** Toadstools along the thick parts of the network: a few per cell, more where it is strongest. */
  private rebuildStools() {
    const col = this.col, my = col.mycelium!, w = col.world;
    for (const m of this.stools) { this.group.remove(m); m.geometry.dispose(); }
    this.stools = [];
    const mood = folkMood(col);
    const spots: { x: number; z: number; s: number; r: number }[] = [];
    for (let c = 0; c < my.m.length; c++) {
      const v = my.m[c];
      if (v < 0.45) continue;
      const n = Math.min(4, Math.floor((v - 0.4) * 7));
      const cx = c % my.cw, cz = Math.floor(c / my.cw);
      for (let k = 0; k < n; k++) {
        const h1 = ((c * 2654435761 + k * 97) >>> 0) / 4294967296, h2 = ((c * 40503 + k * 7919) >>> 0) % 1000 / 1000;
        const x = (cx + h1) * CELL - w.w / 2, z = (cz + h2) * CELL - w.h / 2;
        const tx = Math.floor(x + w.w / 2), tz = Math.floor(z + w.h / 2);
        if (tx < 0 || tz < 0 || tx >= w.w || tz >= w.h) continue;
        const i = tz * w.w + tx, g = w.ground[i];
        // On soil only: not paving, water, walls, fields or under a tree trunk.
        if (g === Ground.Water || g === Ground.Asphalt || g === Ground.Concrete || w.blocked[i] || w.treeAt[i] >= 0 || w.fieldAt?.[i] > 0) continue;
        spots.push({ x, z, s: 0.7 + h2 * 0.7, r: h1 * 6.28 });
      }
    }
    if (!spots.length) return;
    const stem = new THREE.CylinderGeometry(0.03, 0.045, 0.16, 5); stem.translate(0, 0.08, 0);
    const cap = new THREE.SphereGeometry(0.1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.7, 1); cap.translate(0, 0.15, 0);
    const capCol = mood > 0 ? '#c8563e' : mood < 0 ? '#7a5a8a' : '#b8a888';
    const mk = (geo: THREE.BufferGeometry, color: string) => {
      const im = new THREE.InstancedMesh(geo, enhance(new THREE.MeshLambertMaterial({ color }), { surface: 'none' }), spots.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
      spots.forEach((o, i) => im.setMatrixAt(i, m4.compose(p.set(o.x, heightAt(w, o.x, o.z), o.z), q.setFromEuler(e.set(0, o.r, 0)), sc.setScalar(o.s))));
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.group.add(im);
      this.stools.push(im);
    };
    mk(stem, '#e8e0cc');
    mk(cap, capCol);
  }

  /** The network as a tree rooted at the hill: which cell each grew from, and how far along it lies. */
  private tree() {
    const col = this.col, my = col.mycelium!, w = col.world;
    const n = my.m.length, cw = my.cw;
    const active = new Uint8Array(n);
    for (let c = 0; c < n; c++) {
      if (my.m[c] < REACH * 0.8) continue;
      // Only where the village has looked.
      const tx = Math.min(w.w - 1, (c % cw) * CELL + 2), tz = Math.min(w.h - 1, Math.floor(c / cw) * CELL + 2);
      if (w.explored[tz * w.w + tx] >= 128) active[c] = 1;
    }
    const root = cellAt(my, w, w.folk.mound.x, w.folk.mound.z);
    const parent = new Int32Array(n).fill(-1), cost = new Float32Array(n).fill(Infinity);
    if (root < 0) return { parent, cost, root, order: [] as number[] };
    active[root] = 1;
    // Dijkstra over eight neighbours; strong ground is cheap, and a little
    // per-cell roughness keeps the paths from running dead straight.
    cost[root] = 0;
    const open: number[] = [root], order: number[] = [];
    const done = new Uint8Array(n);
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (cost[open[i]] < cost[open[bi]]) bi = i;
      const c = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      if (done[c]) continue;
      done[c] = 1; order.push(c);
      const cx = c % cw, cz = Math.floor(c / cw);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= cw || nz >= my.ch) continue;
        const d = nz * cw + nx;
        if (!active[d] || done[d]) continue;
        const k = cost[c] + Math.hypot(dx, dz) * (1.5 - my.m[d]) * (0.7 + 0.6 * hash(d, 3));
        if (k < cost[d]) { cost[d] = k; parent[d] = c; open.push(d); }
      }
    }
    return { parent, cost, root, order };
  }

  private rebuild() {
    const col = this.col, my = col.mycelium!, w = col.world;
    if (this.strands) { this.veins.remove(this.strands); this.strands.geometry.dispose(); this.strands = null; }
    const { parent, root, order } = this.tree();
    if (root < 0 || order.length < 2) return;
    const n = my.m.length, cw = my.cw;
    // A cell's point: its centre, moved a little (fixed per cell) so nothing runs on the grid.
    const pt = (c: number) => {
      const x = ((c % cw) + 0.5 + (hash(c) - 0.5) * 0.75) * CELL - w.w / 2;
      const z = (Math.floor(c / cw) + 0.5 + (hash(c, 1) - 0.5) * 0.75) * CELL - w.h / 2;
      return new THREE.Vector2(x, z);
    };
    const P: (THREE.Vector2 | null)[] = new Array(n).fill(null);
    for (const c of order) P[c] = c === root ? new THREE.Vector2(w.folk.mound.x, w.folk.mound.z) : pt(c);
    // Tips: the frontier and a scattering of cells inside it. Each strand carries the tips beyond it.
    const kids: number[][] = Array.from({ length: n }, () => []);
    for (const c of order) if (parent[c] >= 0) kids[parent[c]].push(c);
    const flow = new Float32Array(n);
    for (let i = order.length - 1; i >= 0; i--) {
      const c = order[i];
      const tip = kids[c].length === 0 ? hash(c, 7) < 0.55 : hash(c, 7) < 0.12;
      if (tip) flow[c] += 1;
      if (parent[c] >= 0) flow[parent[c]] += flow[c];
    }
    // Along-strand distance, for the pulses and the sway.
    const along = new Float32Array(n);
    for (const c of order) if (parent[c] >= 0) along[c] = along[parent[c]] + P[c]!.distanceTo(P[parent[c]]!);
    const width = (c: number) => Math.min(2.2, 0.14 + 0.24 * Math.sqrt(flow[c]) + 0.1 * my.m[c]);
    // The child that carries most on (the strand continues through it; others branch off).
    const main = new Int32Array(n).fill(-1);
    for (const c of order) {
      let best = -1;
      for (const k of kids[c]) if (flow[k] > 0 && (best < 0 || flow[k] > flow[best])) best = k;
      main[c] = best;
    }
    const pos: number[] = [], lat: number[] = [], half: number[] = [], across: number[] = [], dist: number[] = [], vv: number[] = [];
    const index: number[] = [];
    const STEPS = 8;
    const cr = (p0: THREE.Vector2, p1: THREE.Vector2, p2: THREE.Vector2, p3: THREE.Vector2, t: number, out: THREE.Vector2) => {
      // Uniform Catmull-Rom between p1 and p2.
      const t2 = t * t, t3 = t2 * t;
      out.x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      out.y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      return out;
    };
    const q = new THREE.Vector2(), q2 = new THREE.Vector2();
    for (const c of order) {
      const p = parent[c];
      if (p < 0 || flow[c] <= 0) continue;
      const p2 = P[c]!;
      // Out of the hill's flank, not its centre.
      const p1 = p === root ? P[p]!.clone().add(p2.clone().sub(P[p]!).setLength(w.folk.mound.r * 0.85)) : P[p]!;
      const gp = parent[p];
      const p0 = gp >= 0 ? P[gp]! : p1.clone().multiplyScalar(2).sub(p2);
      const p3 = main[c] >= 0 ? P[main[c]]! : p2.clone().multiplyScalar(2).sub(p1);
      const w0 = main[p] === c ? width(p) : width(c) * 1.1;
      const w1 = main[c] >= 0 ? width(c) : width(c) * 0.25;
      const base = pos.length / 3;
      for (let s = 0; s <= STEPS; s++) {
        const t = s / STEPS;
        cr(p0, p1, p2, p3, t, q);
        cr(p0, p1, p2, p3, Math.min(1, t + 0.02), q2);
        let tx = q2.x - q.x, tz = q2.y - q.y;
        if (s === STEPS) { cr(p0, p1, p2, p3, 0.98, q2); tx = q.x - q2.x; tz = q.y - q2.y; }
        const len = Math.hypot(tx, tz) || 1;
        const lx = -tz / len, lz = tx / len;
        const y = heightAt(w, q.x, q.y) + 0.07;
        const hw = (w0 + (w1 - w0) * t) / 2;
        const d = along[p] + (along[c] - along[p]) * t;
        const v = my.m[p] + (my.m[c] - my.m[p]) * t;
        for (const side of [-1, 1]) {
          pos.push(q.x, y, q.y); lat.push(lx, 0, lz); half.push(side * hw); across.push(side); dist.push(d); vv.push(v);
        }
        if (s < STEPS) {
          const i = base + s * 2;
          index.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
        }
      }
    }
    if (!index.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aLat', new THREE.Float32BufferAttribute(lat, 3));
    g.setAttribute('aHalf', new THREE.Float32BufferAttribute(half, 1));
    g.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1));
    g.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1));
    g.setAttribute('aV', new THREE.Float32BufferAttribute(vv, 1));
    g.setIndex(index);
    this.strands = new THREE.Mesh(g, this.mat);
    this.strands.frustumCulled = false;
    this.strands.renderOrder = 4;
    this.veins.add(this.strands);
    // The mood: colour, and how the pulses run.
    const mood = folkMood(col);
    const u = this.mat.uniforms;
    u.uCol.value.copy(mood > 0 ? BLESS : mood < 0 ? CURSE : NEUTRAL);
    u.uSpeed.value = mood < 0 ? 2 : 5;
    u.uSpacing.value = mood < 0 ? 40 : 22;
    u.uPulse.value = mood < 0 ? 0.5 : 1;
  }

  /**
   * How much of it shows: all of it in the Veil view; otherwise a faint glow
   * through the eyes of someone with high Sight (strongest at night), and
   * barely anything to anyone on a dark night.
   */
  static strength(night: number, sight: number, veilView: boolean, veil: number): number {
    if (veilView) return veil;
    const seer = sight >= 0.45 ? (0.12 + 0.3 * (sight - 0.45) / 0.55) * (0.35 + 0.65 * night) : 0;
    return Math.max(night * 0.13, seer);
  }

  update(t: number, night = 0, sight = 0, veilView = false) {
    const veil = worldUniforms.uVeil.value;
    if (!this.col.mycelium) return;
    const sk = `${this.col.mycelium.version}|${Math.sign(folkMood(this.col))}`;
    if (sk !== this.stoolKey) { this.stoolKey = sk; this.rebuildStools(); }
    const show = MyceliumView.strength(night, sight, veilView, veil);
    this.veins.visible = show > 0.02;
    if (!this.veins.visible) return;
    // Rebuilt when the network grows, the mood turns, or more ground is explored (about once a day).
    const key = `${sk}|${this.col.community.day}`;
    if (key !== this.key) { this.key = key; this.rebuild(); }
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uOpacity.value = show;
    // Outside the Veil view it lies under trees and roofs like anything else on the ground.
    this.mat.depthTest = !veilView;
  }
}
