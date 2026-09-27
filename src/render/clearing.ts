/**
 * Haunted districts and clearings, drawn (DESIGN §19).
 *
 * Outside a clearing: at night, the spirits of haunted districts show as
 * faint lights to whoever could perceive them. Inside one: the district's
 * tiles, where the chosen survivor can move this turn, the wards, the
 * Hollow's reach, a ring under each of the team, and every spirit as the
 * team perceives it (a cold shimmer, a shape of light, or a named being).
 */
import * as THREE from 'three';
import type { Colony } from '../sim/colony';
import { alive } from '../sim/community';
import { cheb, readingOf, reachable, teamReading, type Clearing, type Reading, type Spirit } from '../sim/haunt';
import { resonanceAt } from '../sim/veil';
import { heightAt, tileX, tileZ } from '../sim/world';
import { glowTexture, makeRand } from './util';

const FAE_COLOR: Record<string, string> = { hob: '#ffd9a0', sprite: '#bff7ea', elder: '#e8e2ff', piper: '#d8ffb8' };
const COLOR: Record<Spirit['kind'], string> = { remnant: '#c9d4ff', hedge: '#b8ffb0', lamp: '#ffd89a', hollow: '#8a5ad0' };

let glow: THREE.Texture | null = null;
function halo(color: string, size: number, opacity: number): THREE.Sprite {
  glow ??= glowTexture();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}
const additive = (color: THREE.ColorRepresentation, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const flat = (color: string, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });

interface Form { group: THREE.Group; key: string; label?: HTMLDivElement; phase: number }

export class ClearingView {
  group = new THREE.Group();
  private ambient = new THREE.Group();
  private arena = new THREE.Group();
  private forms = new Map<string, Form>();
  private moveTiles: THREE.InstancedMesh;
  private hover: THREE.Mesh;
  private rings: THREE.Group = new THREE.Group();
  private reachKey = '';
  private rand = makeRand(77);

  constructor(private col: Colony, private labels: HTMLElement) {
    this.group.name = 'clearing';
    const tile = new THREE.PlaneGeometry(0.92, 0.92);
    tile.rotateX(-Math.PI / 2);
    this.moveTiles = new THREE.InstancedMesh(tile, flat('#5fe0c0', 0.28), 400);
    this.moveTiles.count = 0;
    this.moveTiles.frustumCulled = false;
    this.moveTiles.renderOrder = 5;
    this.hover = new THREE.Mesh(tile, flat('#ffffff', 0.35));
    this.hover.visible = false;
    this.hover.renderOrder = 6;
    this.arena.add(this.moveTiles, this.hover, this.rings);
    this.arena.visible = false;
    this.group.add(this.ambient, this.arena);
  }

  private y(tx: number, tz: number) { return heightAt(this.col.world, tileX(this.col.world, tx), tileZ(this.col.world, tz)); }

  private ring(tx: number, tz: number, r: number, color: string, opacity: number, width = 0.08): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - width, r, 40), flat(color, opacity));
    m.rotation.x = -Math.PI / 2;
    m.position.set(tileX(this.col.world, tx), this.y(tx, tz) + 0.06, tileZ(this.col.world, tz));
    m.renderOrder = 5;
    return m;
  }

  private build(s: Spirit, reading: Reading, named: boolean): Form {
    const g = new THREE.Group();
    const form: Form = { group: g, key: '', phase: this.rand() * 10 };
    const color = COLOR[s.kind];
    if (reading === 'chill') {
      const n = 18;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, r = 0.5 + this.rand() * 0.6;
        pos.set([Math.cos(a) * r, 0.3 + this.rand() * 1.4, Math.sin(a) * r], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: s.kind === 'hollow' ? '#6a4a8a' : '#cfe6ff', size: 0.12, transparent: true, opacity: 0.6, depthWrite: false }));
      pts.userData.spin = true;
      g.add(pts);
      return form;
    }
    const strong = reading === 'coherent';
    if (s.kind === 'hollow') {
      const size = 0.55 + s.integrity * 0.12;
      const core = new THREE.Mesh(new THREE.SphereGeometry(size, 18, 14), new THREE.MeshBasicMaterial({ color: '#07050a', transparent: true, opacity: 0.85, depthWrite: false }));
      core.position.y = 1.2;
      const rim = halo(color, size * 4.2, 0.55);
      rim.position.y = 1.2;
      g.add(rim, core);
    } else if (s.kind === 'lamp') {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), additive(new THREE.Color(color).multiplyScalar(3), 1));
      core.position.y = 1.1;
      core.userData.bob = true;
      const h = halo(color, strong ? 2.4 : 1.8, 0.8);
      h.position.y = 1.1;
      h.userData.bob = true;
      g.add(core, h);
    } else {
      const mat = additive(new THREE.Color(color).multiplyScalar(strong ? 0.75 : 0.5), strong ? 0.6 : 0.35);
      const h = s.kind === 'hedge' ? 0.9 : 1.75;
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.14, h * 0.45, 3, 8), mat);
      body.position.y = h * 0.46;
      const head = new THREE.Mesh(new THREE.SphereGeometry(h * 0.11, 10, 8), mat);
      head.position.y = h * 0.9;
      g.add(body, head);
      if (s.kind === 'hedge') {
        for (let i = 0; i < 5; i++) {
          const thorn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 4), mat);
          thorn.position.set(Math.cos(i * 1.3) * 0.16, h * (0.55 + i * 0.08), Math.sin(i * 1.3) * 0.16);
          thorn.rotation.z = Math.cos(i * 1.3) * 0.9;
          g.add(thorn);
        }
      }
      const glowS = halo(color, strong ? 3 : 2.2, strong ? 0.3 : 0.2);
      glowS.position.y = h * 0.6;
      g.add(glowS);
    }
    if (strong && named) {
      const el = document.createElement('div');
      el.className = 'label spirit';
      el.textContent = s.name.charAt(0).toUpperCase() + s.name.slice(1);
      this.labels.appendChild(el);
      form.label = el;
    }
    return form;
  }

  private drop(key: string) {
    const f = this.forms.get(key);
    if (!f) return;
    f.group.parent?.remove(f.group);
    f.label?.remove();
    f.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.forms.delete(key);
  }

  private place(f: Form, s: Spirit, t: number, parent: THREE.Group) {
    if (f.group.parent !== parent) parent.add(f.group);
    const w = this.col.world;
    const x = tileX(w, s.tx), z = tileZ(w, s.tz);
    const drift = s.kind === 'lamp' ? 0.25 : 0.08;
    f.group.position.set(x + Math.sin(t * 0.7 + f.phase) * drift, heightAt(w, x, z) + Math.sin(t * 1.3 + f.phase) * 0.08, z + Math.cos(t * 0.6 + f.phase) * drift);
    f.group.children.forEach((c) => {
      if (c.userData.spin) c.rotation.y = t * 0.4;
      if (c.userData.bob) c.position.y = 1.1 + Math.sin(t * 2 + f.phase) * 0.15;
    });
  }

  private label(f: Form, camera: THREE.Camera, width: number, height: number) {
    if (!f.label) return;
    const p = new THREE.Vector3(f.group.position.x, f.group.position.y + 2.4, f.group.position.z).project(camera);
    f.label.style.left = `${(p.x * 0.5 + 0.5) * width}px`;
    f.label.style.top = `${(-p.y * 0.5 + 0.5) * height}px`;
    f.label.hidden = p.z > 1;
  }

  /** Outside a clearing: the haunted districts at night, as the best perceiver would see them. */
  updateAmbient(t: number, night: number, viewer: number, camera: THREE.Camera, width: number, height: number) {
    this.ambient.visible = night > 0.3;
    const live = new Set<string>();
    if (this.ambient.visible) {
      const people = alive(this.col.community);
      const watchers = viewer ? people.filter((s) => s.id === viewer) : people;
      for (const h of this.col.haunts) {
        if (h.state === 'unknown' || h.state === 'cleared') continue;
        for (const s of h.spirits) {
          if (s.fate !== 'present') continue;
          // Perceived from afar: Sight and the land against its depth, but only up to a luminous shape.
          let best: Reading = 'none';
          const res = resonanceAt(this.col, tileX(this.col.world, s.tx), tileZ(this.col.world, s.tz));
          for (const p of watchers) {
            const v = p.sight + res * 40 - s.depth - 15;
            const r: Reading = v < -10 ? 'none' : v < 10 ? 'chill' : 'luminous';
            if (r === 'luminous' || (r === 'chill' && best === 'none')) best = r;
          }
          if (best === 'none') continue;
          const key = `a${h.district}.${s.id}.${best}`;
          live.add(key);
          let f = this.forms.get(key);
          if (!f) { f = this.build(s, best, false); f.key = key; this.forms.set(key, f); }
          this.place(f, s, t, this.ambient);
          this.label(f, camera, width, height);
        }
      }
    }
    for (const k of [...this.forms.keys()]) if (k.startsWith('a') && !live.has(k)) this.drop(k);
  }

  /** Inside a clearing. */
  updateArena(t: number, cl: Clearing | null, selUnit: number, hoverTile: { tx: number; tz: number } | null, camera: THREE.Camera, width: number, height: number) {
    this.arena.visible = !!cl;
    const live = new Set<string>();
    if (cl) {
      const w = this.col.world;
      const h = this.col.haunts[cl.haunt];
      const u = cl.units.find((x) => x.id === selUnit && x.state === 'in');
      // Where the chosen one can go this turn.
      const rk = u ? `${u.id}:${u.tx},${u.tz}:${u.ap}:${cl.turn}:${cl.units.map((x) => `${x.tx},${x.tz},${x.state}`).join(';')}:${h.spirits.map((s) => s.fate[0]).join('')}` : '';
      if (rk !== this.reachKey) {
        this.reachKey = rk;
        const m4 = new THREE.Matrix4();
        let n = 0;
        if (u) for (const k of reachable(this.col, cl, u).keys()) {
          if (n >= 400) break;
          const [tx, tz] = k.split(',').map(Number);
          m4.makeTranslation(tileX(w, tx), this.y(tx, tz) + 0.05, tileZ(w, tz));
          this.moveTiles.setMatrixAt(n++, m4);
        }
        this.moveTiles.count = n;
        this.moveTiles.instanceMatrix.needsUpdate = true;
        // Rings: under the team, wards, the Hollow's reach.
        for (const c of [...this.rings.children]) { this.rings.remove(c); (c as THREE.Mesh).geometry.dispose(); }
        for (const x of cl.units) if (x.state === 'in') {
          const frac = x.nerve / x.maxNerve;
          this.rings.add(this.ring(x.tx, x.tz, 0.55, x.id === selUnit ? '#ffffff' : frac < 0.35 ? '#ff7a6a' : frac < 0.65 ? '#ffd06a' : '#8af0c8', 0.9, x.id === selUnit ? 0.12 : 0.08));
        }
        for (const wd of cl.wards) this.rings.add(this.ring(wd.tx, wd.tz, wd.r + 0.5, '#ffcf7a', 0.55, 0.1));
        for (const s of h.spirits) if (s.kind === 'hollow' && s.fate === 'present' && s.known >= 1) this.rings.add(this.ring(s.tx, s.tz, 4.5, '#8a5ad0', 0.45, 0.12));
      }
      if (hoverTile) {
        this.hover.visible = true;
        this.hover.position.set(tileX(w, hoverTile.tx), this.y(hoverTile.tx, hoverTile.tz) + 0.07, tileZ(w, hoverTile.tz));
      } else this.hover.visible = false;
      // The spirits, as the team perceives them.
      for (const s of h.spirits) {
        if (s.fate !== 'present') continue;
        const r = u ? readingOf(this.col, u, s) : teamReading(this.col, cl, s);
        const best = teamReading(this.col, cl, s);
        const reading = RANK[Math.max(RANK.indexOf(r), RANK.indexOf(best))];
        if (reading === 'none') continue;
        const key = `c${s.id}.${reading}.${s.kind === 'hollow' ? s.integrity : ''}.${s.known}`;
        live.add(key);
        let f = this.forms.get(key);
        if (!f) { f = this.build(s, reading, s.known >= 1); f.key = key; this.forms.set(key, f); }
        this.place(f, s, t, this.arena);
        this.label(f, camera, width, height);
      }
      // The Folk who came along: small bright figures, gliding to where they stand.
      for (const u of cl.units) {
        if (!u.fae || u.state !== 'in') continue;
        const key = `f${u.id}`;
        live.add(key);
        let f = this.forms.get(key);
        if (!f) {
          const g = new THREE.Group();
          const color = FAE_COLOR[u.fae];
          const hgt = u.fae === 'elder' ? 1.25 : u.fae === 'sprite' ? 0.55 : u.fae === 'hob' ? 0.8 : 1.0;
          const m = additive(new THREE.Color(color).multiplyScalar(0.8), 0.7);
          const body = new THREE.Mesh(new THREE.CapsuleGeometry(hgt * 0.16, hgt * 0.4, 3, 8), m);
          body.position.y = hgt * 0.42 + (u.fae === 'sprite' ? 0.35 : 0);
          const head = new THREE.Mesh(new THREE.SphereGeometry(hgt * 0.15, 10, 8), m);
          head.position.y = hgt * 0.86 + (u.fae === 'sprite' ? 0.35 : 0);
          const glowS = halo(color, 1.8, 0.35);
          glowS.position.y = hgt * 0.6;
          g.add(body, head, glowS);
          g.position.set(tileX(w, u.tx), this.y(u.tx, u.tz), tileZ(w, u.tz));
          f = { group: g, key, phase: this.rand() * 10 };
          const el = document.createElement('div');
          el.className = 'label spirit';
          el.textContent = u.name;
          this.labels.appendChild(el);
          f.label = el;
          this.forms.set(key, f);
          this.arena.add(g);
        }
        const tx = tileX(w, u.tx), tz = tileZ(w, u.tz);
        const p = f.group.position;
        p.x += (tx - p.x) * 0.12; p.z += (tz - p.z) * 0.12;
        p.y = heightAt(w, p.x, p.z) + Math.abs(Math.sin(t * 3 + f.phase)) * 0.06;
        this.label(f, camera, width, height);
      }
      void cheb;
    }
    for (const k of [...this.forms.keys()]) if ((k.startsWith('c') || k.startsWith('f')) && !live.has(k)) this.drop(k);
  }
}

const RANK: Reading[] = ['none', 'chill', 'luminous', 'coherent'];
