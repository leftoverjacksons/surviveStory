import * as THREE from 'three';
import type { Colony } from '../sim/colony';
import { alive } from '../sim/community';
import { PHENOMENA, readingFor, type Phenomenon, type Reading } from '../sim/veil';
import { heightAt } from '../sim/world';
import { glowTexture, makeRand } from './util';

/** Resonance per cell as a texture, for the Veil view on the ground. */
export class ResonanceTexture {
  texture: THREE.DataTexture;
  private data: Uint8Array;
  private version = -1;
  private last = -Infinity;
  constructor(private col: Colony) {
    const v = col.veil;
    this.data = new Uint8Array(v.cw * v.ch);
    this.texture = new THREE.DataTexture(this.data, v.cw, v.ch, THREE.RedFormat, THREE.UnsignedByteType);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.sync(0, true);
  }
  sync(now: number, force = false) {
    const v = this.col.veil;
    if (!force && (v.version === this.version || now - this.last < 1)) return;
    this.version = v.version;
    this.last = now;
    for (let i = 0; i < this.data.length; i++) this.data[i] = Math.round(v.res[i] * 255);
    this.texture.needsUpdate = true;
  }
}

const ORDER: Reading[] = ['none', 'chill', 'luminous', 'coherent'];

interface View { group: THREE.Group; reading: Reading; kind: string; label?: HTMLDivElement; phase: number; motes?: THREE.Points }

let glow: THREE.Texture | null = null;
const additive = (color: THREE.ColorRepresentation, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

function halo(color: string, size: number, opacity: number): THREE.Sprite {
  glow ??= glowTexture();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

function figure(mat: THREE.Material, height = 1.8): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, height * 0.42, 3, 10), mat);
  body.position.y = height * 0.48;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), mat);
  head.position.y = height * 0.9;
  g.add(body, head);
  return g;
}

function stag(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.z = rz;
    g.add(m);
  };
  box(1.3, 0.55, 0.45, 0, 1.1, 0);
  for (const [x, z] of [[0.5, 0.15], [0.5, -0.15], [-0.5, 0.15], [-0.5, -0.15]]) box(0.1, 0.95, 0.1, x, 0.48, z);
  box(0.2, 0.7, 0.2, 0.7, 1.55, 0, -0.35);
  box(0.45, 0.22, 0.22, 0.95, 1.9, 0);
  // Antlers.
  for (const s of [-1, 1]) {
    box(0.05, 0.7, 0.05, 0.85, 2.3, s * 0.15, s * 0.3);
    box(0.05, 0.35, 0.05, 0.75, 2.45, s * 0.3, -s * 0.8);
  }
  return g;
}

/** The hidden layer, drawn as the chosen viewer perceives it. */
export class PhenomenaView {
  group = new THREE.Group();
  private views = new Map<number, View>();
  private rand = makeRand(12);

  constructor(private col: Colony, private labels: HTMLElement) {}

  /** The reading shown: the selected survivor's, else the best any survivor would have. */
  private readingOf(p: Phenomenon, viewer: number): Reading {
    const living = alive(this.col.community);
    if (viewer) {
      const s = living.find((x) => x.id === viewer);
      if (s) return readingFor(this.col, s, p);
    }
    let best: Reading = 'none';
    for (const s of living) {
      const r = readingFor(this.col, s, p);
      if (ORDER.indexOf(r) > ORDER.indexOf(best)) best = r;
    }
    return best;
  }

  private build(p: Phenomenon, reading: Reading): View {
    const def = PHENOMENA[p.kind];
    const g = new THREE.Group();
    const view: View = { group: g, reading, kind: p.kind, phase: this.rand() * 10 };
    if (reading === 'none') return view;
    if (reading === 'chill') {
      // A cold shimmer: frost motes turning slowly in the air.
      const n = 26;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, r = 0.9 + this.rand() * 0.8;
        pos.set([Math.cos(a) * r, 0.4 + this.rand() * 1.6, Math.sin(a) * r], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      view.motes = new THREE.Points(geo, new THREE.PointsMaterial({
        color: p.kind === 'hollow' ? '#6a4a8a' : '#cfe6ff', size: 0.12, transparent: true, opacity: 0.55, depthWrite: false,
      }));
      g.add(view.motes);
      return view;
    }
    const strong = reading === 'coherent';
    const color = def.color;
    if (p.kind === 'hollow') {
      const core = new THREE.Mesh(new THREE.SphereGeometry(strong ? 1.1 : 0.8, 20, 16),
        new THREE.MeshBasicMaterial({ color: '#07050a', transparent: true, opacity: strong ? 0.85 : 0.6, depthWrite: false }));
      core.position.y = 1.4;
      const rim = halo('#8a5ad0', strong ? 4.5 : 3.2, 0.5);
      rim.position.y = 1.4;
      g.add(rim, core);
    } else if (p.kind === 'orb') {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 16), additive(new THREE.Color(color).multiplyScalar(3), strong ? 0.95 : 0.6));
      core.position.y = strong ? 3 : 6;
      const h = halo(color, strong ? 9 : 6, 0.8);
      h.position.copy(core.position);
      g.add(core, h);
    } else if (p.kind === 'choir') {
      for (let i = 0; i < (strong ? 12 : 7); i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), additive(new THREE.Color(color).multiplyScalar(4), 1));
        m.userData.orbit = i;
        g.add(m);
        const h = halo(color, 0.9, 0.7);
        h.userData.orbit = i;
        g.add(h);
      }
    } else {
      const mat = additive(new THREE.Color(color).multiplyScalar(strong ? 0.75 : 0.5), strong ? 0.6 : 0.35);
      const form = p.kind === 'stag' ? stag(mat) : figure(mat, p.kind === 'moth_woman' ? 2.3 : 1.8);
      g.add(form);
      if (p.kind === 'moth_woman') {
        for (const s of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5), additive(new THREE.Color(color).multiplyScalar(0.9), strong ? 0.5 : 0.28));
          wing.material.side = THREE.DoubleSide;
          wing.material.opacity *= 0.7;
          wing.position.set(s * 0.7, 1.6, -0.1);
          wing.rotation.y = s * 0.5;
          wing.userData.wing = s;
          g.add(wing);
        }
      }
      if (p.kind === 'lantern_man') {
        const lamp = halo('#ffcf7a', strong ? 1.8 : 1.2, 0.8);
        lamp.position.set(0.45, 1.1, 0.2);
        lamp.userData.lamp = true;
        g.add(lamp);
      }
      const h = halo(color, strong ? 4 : 2.8, strong ? 0.3 : 0.2);
      h.position.y = 1.2;
      g.add(h);
    }
    if (strong) {
      const el = document.createElement('div');
      el.className = 'label spirit';
      el.textContent = def.name.replace(/^the /, 'The ').replace(/^a /, 'A ');
      this.labels.appendChild(el);
      view.label = el;
    }
    return view;
  }

  private dispose(v: View) {
    this.group.remove(v.group);
    v.label?.remove();
    v.group.traverse((o) => {
      (o as THREE.Mesh).geometry?.dispose();
    });
  }

  update(t: number, viewer: number, camera: THREE.Camera, width: number, height: number) {
    const live = new Set<number>();
    const tmp = new THREE.Vector3();
    for (const p of this.col.veil.phenomena) {
      live.add(p.id);
      const reading = this.readingOf(p, viewer);
      let v = this.views.get(p.id);
      if (!v || v.reading !== reading) {
        if (v) this.dispose(v);
        v = this.build(p, reading);
        this.views.set(p.id, v);
        this.group.add(v.group);
      }
      const g = v.group;
      g.position.set(p.x + Math.sin(t * 0.3 + v.phase) * 0.4, heightAt(this.col.world, p.x, p.z) + Math.sin(t * 0.9 + v.phase) * 0.12, p.z + Math.cos(t * 0.25 + v.phase) * 0.4);
      g.rotation.y = t * 0.15 + v.phase;
      if (v.motes) v.motes.rotation.y = t * 0.4;
      g.children.forEach((c) => {
        if (c.userData.orbit !== undefined) {
          const i = c.userData.orbit as number;
          const a = t * 0.8 + (i / 12) * Math.PI * 2;
          c.position.set(Math.cos(a) * 2.2, 1.2 + Math.sin(t * 2 + i) * 0.4, Math.sin(a) * 2.2);
        }
        if (c.userData.wing) c.rotation.y = (c.userData.wing as number) * (0.5 + Math.sin(t * 5 + v!.phase) * 0.25);
        if (c.userData.lamp) (c as THREE.Sprite).material.opacity = 0.7 + Math.sin(t * 7 + v!.phase) * 0.2;
      });
      if (v.label) {
        tmp.set(g.position.x, g.position.y + 2.8, g.position.z).project(camera);
        v.label.style.left = `${(tmp.x * 0.5 + 0.5) * width}px`;
        v.label.style.top = `${(-tmp.y * 0.5 + 0.5) * height}px`;
        v.label.hidden = tmp.z > 1;
      }
    }
    for (const [id, v] of this.views) if (!live.has(id)) { this.dispose(v); this.views.delete(id); }
  }
}
