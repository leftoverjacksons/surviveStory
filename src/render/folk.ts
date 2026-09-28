/**
 * The Folk, drawn (DESIGN §19). The hill, its door, the path stones and the
 * things they make are solid and seen by everyone; the Folk themselves are
 * drawn as the chosen viewer perceives them (a light, a small bright figure,
 * or someone with a name), and only when they are out.
 */
import * as THREE from 'three';
import { mergeStatic } from './merge';
import type { Colony } from '../sim/colony';
import { alive } from '../sim/community';
import { folkReading, standingWord, type Fae, type FolkWork } from '../sim/folk';
import { Ground, heightAt, idx, inBounds, toTileX, toTileZ } from '../sim/world';
import { enhance, glowTexture, lambert, makeRand, shadowed, worldUniforms } from './util';

type Reading = 'none' | 'chill' | 'luminous' | 'coherent';
const ORDER: Reading[] = ['none', 'chill', 'luminous', 'coherent'];
const HEIGHT: Record<Fae['kind'], number> = { hob: 0.75, sprite: 0.5, elder: 1.25, piper: 0.95 };
const COLOR: Record<Fae['kind'], string> = { hob: '#ffd9a0', sprite: '#bff7ea', elder: '#e8e2ff', piper: '#d8ffb8' };

let glow: THREE.Texture | null = null;
function halo(color: string, size: number, opacity: number): THREE.Sprite {
  glow ??= glowTexture();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}
const additive = (color: THREE.ColorRepresentation, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

interface Being { group: THREE.Group; reading: Reading; label?: HTMLDivElement; phase: number; mats: THREE.Material[] }

const ORDER_MAT = new THREE.MeshBasicMaterial({ color: '#c9b8ff', transparent: true, opacity: 0.45, depthWrite: false });
const ORDER_LIT = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e6dcff').multiplyScalar(2), toneMapped: false });

export class FolkView {
  group = new THREE.Group();
  private works = new THREE.Group();
  private beingsGroup = new THREE.Group();
  private beings = new Map<number, Being>();
  private doorLight: THREE.Sprite;
  private motes: THREE.Points;
  private lanterns: THREE.Sprite[] = [];
  private key = '';
  private rand = makeRand(31);
  private stone = enhance(lambert('#b9b4a4'), { surface: 'auto' });
  private darkStone = enhance(lambert('#8d8878'), { surface: 'auto' });

  constructor(private col: Colony, private labels: HTMLElement) {
    this.group.name = 'folk';
    const w = col.world, m = w.folk.mound;
    // The door in the hill: two standing stones and a lintel, dark between.
    const door = new THREE.Group();
    const dx = Math.cos(m.door), dz = Math.sin(m.door);
    const px = m.x + dx * m.r * 0.78, pz = m.z + dz * m.r * 0.78;
    const gy = heightAt(w, px, pz);
    door.position.set(px, gy - 0.1, pz);
    door.rotation.y = Math.atan2(dx, dz);
    const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
      b.position.set(x, y, z);
      door.add(b);
      return b;
    };
    box(0.34, 1.25, 0.4, -0.55, 0.62, 0, this.stone).rotation.z = 0.04;
    box(0.34, 1.2, 0.4, 0.55, 0.6, 0, this.darkStone).rotation.z = -0.05;
    box(1.6, 0.3, 0.5, 0, 1.33, 0, this.stone).rotation.z = 0.03;
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 1.15), new THREE.MeshBasicMaterial({ color: '#0e0b10' }));
    hole.position.set(0, 0.62, -0.05);
    door.add(hole);
    // A threshold stone where offerings are left.
    box(0.9, 0.12, 0.5, 0, 0.06, 0.45, this.darkStone);
    this.doorLight = halo('#ffcf8a', 2.4, 0);
    this.doorLight.position.set(0, 0.7, 0.1);
    door.add(this.doorLight);
    this.group.add(shadowed(door));

    // A kerb of low stones around the foot of the hill, and foxgloves on its crown.
    const kerb: THREE.Matrix4[] = [], crown: THREE.Matrix4[] = [];
    {
      const q0 = new THREE.Quaternion(), e0 = new THREE.Euler(), s0 = new THREE.Vector3(), p0 = new THREE.Vector3();
      const n = 22;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        let da = a - m.door; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < 0.32) continue; // the way in
        const rr = m.r + 0.55 + (this.rand() - 0.5) * 0.15;
        const x = m.x + Math.cos(a) * rr, z = m.z + Math.sin(a) * rr;
        kerb.push(new THREE.Matrix4().compose(p0.set(x, heightAt(w, x, z) + 0.05, z), q0.setFromEuler(e0.set((this.rand() - 0.5) * 0.3, -a, (this.rand() - 0.5) * 0.3)), s0.set(0.34, 0.3 + this.rand() * 0.25, 0.5 + this.rand() * 0.2)));
      }
      for (let i = 0; i < 16; i++) {
        const a = this.rand() * Math.PI * 2, rr = Math.sqrt(this.rand()) * m.r * 0.6;
        const x = m.x + Math.cos(a) * rr, z = m.z + Math.sin(a) * rr;
        crown.push(new THREE.Matrix4().compose(p0.set(x, heightAt(w, x, z), z), q0.identity(), s0.setScalar(0.8 + this.rand() * 0.5)));
      }
    }
    const kerbMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0), this.darkStone, kerb.length);
    kerb.forEach((m4, i) => kerbMesh.setMatrixAt(i, m4));
    const foxglove = new THREE.ConeGeometry(0.07, 0.5, 5);
    foxglove.translate(0, 0.25, 0);
    const crownMesh = new THREE.InstancedMesh(foxglove, enhance(lambert('#c07ac8'), { surface: 'none', wind: 0.2 }), crown.length);
    crown.forEach((m4, i) => crownMesh.setMatrixAt(i, m4));
    for (const im of [kerbMesh, crownMesh]) { im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); this.group.add(im); }

    // Path stones and pale flowers along the Folk paths; motes over them at night.
    const stones: THREE.Matrix4[] = [], flowers: THREE.Matrix4[] = [], motePos: number[] = [];
    const q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (const path of w.folk.paths) {
      let carry = 0, k = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len;
        for (let d = carry; d < len; d += 0.85) {
          const x = a.x + ((b.x - a.x) * d) / len, z = a.z + ((b.z - a.z) * d) / len;
          const tx = toTileX(w, x), tz = toTileZ(w, z);
          if (!inBounds(w, tx, tz) || w.ground[idx(w, tx, tz)] === Ground.Water) continue;
          const side = (k++ % 2 ? 1 : -1) * (0.25 + this.rand() * 0.2);
          const sx = x + nx * side * 0.4, sz = z + nz * side * 0.4;
          stones.push(new THREE.Matrix4().compose(p.set(sx, heightAt(w, sx, sz) + 0.02, sz), q.setFromEuler(e.set(0, this.rand() * 3, 0)), s.set(0.32 + this.rand() * 0.14, 0.08, 0.26 + this.rand() * 0.1)));
          if (this.rand() < 0.7) {
            const fx = x - nx * side * 0.9, fz = z - nz * side * 0.9;
            flowers.push(new THREE.Matrix4().compose(p.set(fx, heightAt(w, fx, fz) + 0.07, fz), q.identity(), s.setScalar(0.7 + this.rand() * 0.5)));
          }
          if (this.rand() < 0.5) motePos.push(x, heightAt(w, x, z) + 0.3 + this.rand() * 0.6, z);
          carry = d + 0.85 - len;
        }
      }
    }
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[]) => {
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, ms.length));
      ms.forEach((m4, i) => im.setMatrixAt(i, m4));
      im.count = ms.length;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.group.add(im);
    };
    inst(new THREE.CylinderGeometry(0.5, 0.55, 1, 7), this.stone, stones);
    inst(new THREE.IcosahedronGeometry(0.07, 0), enhance(lambert('#f4f0dc'), { surface: 'none' }), flowers);
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(motePos, 3));
    this.motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: '#c8fff0', size: 0.14, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.motes.frustumCulled = false;
    this.group.add(this.motes, this.works, this.beingsGroup);
    this.sync();
  }

  /** Rebuild the things the Folk have made, when they change. */
  sync() {
    const f = this.col.folk;
    const key = f.works.map((k) => `${k.kind}${Math.round(k.grown * 4)}${k.built === undefined ? '' : `b${Math.round(k.built * 3)}`}`).join(',');
    if (key === this.key) return;
    this.key = key;
    for (const c of [...this.works.children]) { this.works.remove(c); c.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
    this.lanterns = [];
    for (const k of f.works) this.works.add(k.built === undefined ? this.work(k) : this.order(k));
    shadowed(this.works, true, true);
    // Toadstools, stones and flowers by the dozen: one draw per material (the lit lanterns stay live).
    mergeStatic(this.works, new Set(this.lanterns), false, (x, z) => heightAt(this.col.world, x, z));
  }

  /** An order not yet built: a faint lavender outline, filling in night by night. */
  private order(k: FolkWork): THREE.Group {
    const g = new THREE.Group();
    g.position.set(k.x, heightAt(this.col.world, k.x, k.z) + 0.04, k.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 20), ORDER_MAT);
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    const b = k.built ?? 0;
    // Stakes of light around it, one more lit for each night's work.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const lit = i / 6 < b + 0.01;
      const m = new THREE.Mesh(new THREE.SphereGeometry(lit ? 0.07 : 0.045, 6, 4), lit ? ORDER_LIT : ORDER_MAT);
      m.position.set(Math.cos(a) * 0.67, 0.1 + (lit ? 0.12 : 0), Math.sin(a) * 0.67);
      g.add(m);
    }
    g.userData.noShadow = true;
    return g;
  }

  private work(k: FolkWork): THREE.Group {
    const w = this.col.world;
    const g = new THREE.Group();
    g.position.set(k.x, heightAt(w, k.x, k.z), k.z);
    g.scale.setScalar(0.3 + 0.7 * k.grown);
    const r = makeRand(Math.floor(k.x * 13 + k.z * 7));
    const cap = enhance(lambert('#d8c9a8'), { surface: 'none' }), red = enhance(lambert('#b8483a'), { surface: 'none' });
    const toad = (x: number, z: number, h: number, mat: THREE.Material) => {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, h, 5), cap);
      stem.position.set(x, h / 2, z);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      top.position.set(x, h, z);
      g.add(stem, top);
    };
    if (k.kind === 'ring') {
      const n = 11;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.3, rr = 0.95 + r() * 0.15;
        toad(Math.cos(a) * rr, Math.sin(a) * rr, 0.12 + r() * 0.1, r() < 0.3 ? red : cap);
      }
    } else if (k.kind === 'cairn') {
      let y = 0;
      for (let i = 0; i < 5; i++) {
        const sz = 0.42 - i * 0.07;
        const st = new THREE.Mesh(new THREE.DodecahedronGeometry(sz, 0), i % 2 ? this.darkStone : this.stone);
        st.scale.y = 0.55;
        st.position.set((r() - 0.5) * 0.08, y + sz * 0.5, (r() - 0.5) * 0.08);
        st.rotation.y = r() * 3;
        y += sz * 0.8;
        g.add(st);
      }
    } else if (k.kind === 'lantern') {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), this.stone);
      post.position.y = 0.45;
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 4), this.darkStone);
      hood.position.y = 1.02;
      hood.rotation.y = Math.PI / 4;
      const l = halo('#bff7ea', 1.3, 0.0);
      l.position.y = 0.86;
      this.lanterns.push(l);
      g.add(post, hood, l);
    } else if (k.kind === 'bower') {
      const wood = enhance(lambert('#6b5236'), { surface: 'none' });
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 5, 12, Math.PI), wood);
      arch.rotation.y = r() * Math.PI;
      const leaves = enhance(lambert('#6f8f45'), { season: 'broadleaf' });
      for (let i = 0; i < 6; i++) {
        const a = (i / 5) * Math.PI;
        const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), leaves);
        lf.position.set(Math.cos(a) * 0.75, Math.sin(a) * 0.75, 0);
        arch.add(lf);
      }
      g.add(arch);
    } else {
      const cols = ['#f2e6ff', '#ffe08a', '#b9d8ff', '#ffc6d9'];
      for (let i = 0; i < 14; i++) {
        const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), enhance(lambert(cols[i % cols.length]), { surface: 'none' }));
        fl.position.set((r() - 0.5) * 1.6, 0.12 + r() * 0.1, (r() - 0.5) * 1.6);
        g.add(fl);
      }
    }
    return g;
  }

  private readingOf(fae: Fae, viewer: number): Reading {
    const living = alive(this.col.community);
    const at = (s: (typeof living)[number]) => folkReading(this.col, s, fae.x, fae.z) as Reading;
    if (viewer) {
      const s = living.find((x) => x.id === viewer);
      if (s) return at(s);
    }
    let best: Reading = 'none';
    for (const s of living) { const r = at(s); if (ORDER.indexOf(r) > ORDER.indexOf(best)) best = r; }
    return best;
  }

  private build(fae: Fae, reading: Reading): Being {
    const g = new THREE.Group();
    const b: Being = { group: g, reading, phase: this.rand() * 10, mats: [] };
    if (reading === 'none') return b;
    const color = COLOR[fae.kind];
    const light = halo(color, reading === 'chill' ? 0.7 : 1.6, reading === 'chill' ? 0.55 : 0.35);
    light.position.y = reading === 'chill' ? 0.6 : HEIGHT[fae.kind] * 0.6;
    g.add(light);
    if (reading !== 'chill') {
      const strong = reading === 'coherent';
      const mat = additive(new THREE.Color(color).multiplyScalar(strong ? 0.8 : 0.5), strong ? 0.7 : 0.4);
      const h = HEIGHT[fae.kind];
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.16, h * 0.4, 3, 8), mat);
      body.position.y = h * 0.42;
      const head = new THREE.Mesh(new THREE.SphereGeometry(h * 0.15, 10, 8), mat);
      head.position.y = h * 0.86;
      g.add(body, head);
      if (fae.kind === 'elder') {
        const hood = new THREE.Mesh(new THREE.ConeGeometry(h * 0.2, h * 0.3, 8), mat);
        hood.position.y = h * 1.02;
        g.add(hood);
      }
      if (fae.kind === 'sprite') {
        for (const sd of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), additive(color, strong ? 0.45 : 0.25));
          (wing.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
          wing.position.set(sd * 0.16, h * 0.62, -0.04);
          wing.userData.wing = sd;
          g.add(wing);
        }
      }
      b.mats.push(mat);
      if (strong && fae.known) {
        const el = document.createElement('div');
        el.className = 'label spirit';
        el.textContent = fae.name.replace(/^the /, 'The ');
        this.labels.appendChild(el);
        b.label = el;
      }
    }
    return b;
  }

  private drop(b: Being) {
    this.beingsGroup.remove(b.group);
    b.label?.remove();
    b.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }

  update(t: number, night: number, viewer: number, camera: THREE.Camera, width: number, height: number) {
    const f = this.col.folk, w = this.col.world;
    const veil = worldUniforms.uVeil.value;
    const warm = standingWord(f.standing);
    const target = night * (warm === 'soured' ? 0 : warm === 'wary' ? 0.35 : warm === 'friendly' ? 0.75 : 1);
    this.doorLight.material.opacity += (target * (0.85 + Math.sin(t * 1.3) * 0.1) - this.doorLight.material.opacity) * 0.05;
    (this.motes.material as THREE.PointsMaterial).opacity = night * (0.12 + 0.7 * veil) * (0.8 + Math.sin(t * 0.7) * 0.2);
    for (const l of this.lanterns) l.material.opacity = night * (0.5 + Math.sin(t * 2 + l.id) * 0.1);

    const live = new Set<number>();
    const tmp = new THREE.Vector3();
    for (const fae of f.beings) {
      if (fae.act === 'in') continue;
      live.add(fae.id);
      const reading = this.readingOf(fae, viewer);
      let b = this.beings.get(fae.id);
      if (!b || b.reading !== reading) {
        if (b) this.drop(b);
        b = this.build(fae, reading);
        this.beings.set(fae.id, b);
        this.beingsGroup.add(b.group);
      }
      const g = b.group;
      const dance = fae.act === 'dance' ? 0.25 : 0;
      const bob = Math.abs(Math.sin(t * (fae.act === 'walk' ? 7 : 2) + b.phase)) * (fae.act === 'walk' ? 0.08 : 0.04) + dance * Math.abs(Math.sin(t * 5 + b.phase));
      g.position.set(fae.x + Math.sin(t * 3 + b.phase) * dance, heightAt(w, fae.x, fae.z) + bob + (fae.kind === 'sprite' ? 0.35 + Math.sin(t * 2 + b.phase) * 0.1 : 0), fae.z + Math.cos(t * 3 + b.phase) * dance);
      g.rotation.y = fae.act === 'walk' ? Math.atan2(fae.to.x - fae.x, fae.to.z - fae.z) : t * (fae.act === 'dance' ? 2 : 0.2) + b.phase;
      for (const c of g.children) if (c.userData.wing) c.rotation.y = (c.userData.wing as number) * (0.4 + Math.sin(t * 14 + b.phase) * 0.35);
      // Easier to see at night; by day only as a shimmer.
      const vis = 0.35 + 0.65 * night;
      g.children.forEach((c) => { const m = (c as THREE.Mesh).material as THREE.Material & { opacity: number }; if (m && m.userData.base === undefined) m.userData.base = m.opacity; if (m) m.opacity = m.userData.base * vis; });
      if (b.label) {
        tmp.set(g.position.x, g.position.y + HEIGHT[fae.kind] + 0.9, g.position.z).project(camera);
        b.label.style.left = `${(tmp.x * 0.5 + 0.5) * width}px`;
        b.label.style.top = `${(-tmp.y * 0.5 + 0.5) * height}px`;
        b.label.hidden = tmp.z > 1;
      }
    }
    for (const [id, b] of this.beings) if (!live.has(id)) { this.drop(b); this.beings.delete(id); }
  }
}
