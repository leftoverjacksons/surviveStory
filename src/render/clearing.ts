/**
 * Haunted districts and clearings, drawn (DESIGN §19).
 *
 * Outside a clearing: at night, the spirits of haunted districts show as
 * faint lights to whoever could perceive them. Inside one: where the chosen
 * survivor can walk this turn (two soft rings, DESIGN §38.10), the way they
 * would walk to the cursor and a ghost of them standing there, the spirits
 * that would reach them there, the wards, the Hollow's reach, a ring under
 * each of the team, and every spirit as the team perceives it (a cold
 * shimmer, a shape of light, or a named being).
 */
import * as THREE from 'three';
import type { Colony } from '../sim/colony';
import { alive } from '../sim/community';
import { gridOf, occupantsFor, previewPath, reachOf, readingOf, teamReading, threatsAt, walkCost, type Clearing, type ItemKind, type Reach, type Reading, type Spirit, type Threat } from '../sim/haunt';
import { HEARTH_R, seenTiles } from '../sim/veilkit';
import { CELL, standable, type Pt } from '../sim/veilmove';
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
  private reach: ReachOverlay;
  private pathDots: THREE.InstancedMesh;
  private ghost: THREE.Group;
  private warn = new THREE.Group();
  /** Told what the team can see whenever it changes (main.ts darkens the rest through the fog texture). */
  onSeen: ((seen: Set<number> | null) => void) | null = null;
  /** Wards, echoes and found signs. */
  private marks = new THREE.Group();
  private placeMarks = new THREE.Group();
  private marksKey = '';
  private placeKey = '';
  private rings: THREE.Group = new THREE.Group();
  private reachKey = '';
  private previewKey = '';
  /** What the cursor would do, for the tip: cost in actions, and what would reach them there. */
  preview: { cost: number; threats: { spirit: Spirit; threat: Threat }[] } | null = null;
  private rand = makeRand(77);

  constructor(private col: Colony, private labels: HTMLElement) {
    this.group.name = 'clearing';
    this.reach = new ReachOverlay();
    const dot = new THREE.CircleGeometry(0.07, 10);
    dot.rotateX(-Math.PI / 2);
    this.pathDots = new THREE.InstancedMesh(dot, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }), 200);
    this.pathDots.count = 0;
    this.pathDots.frustumCulled = false;
    this.pathDots.renderOrder = 7;
    // A ghost of whoever is chosen, standing where the cursor is.
    this.ghost = new THREE.Group();
    const gm = new THREE.MeshBasicMaterial({ color: '#bff5e6', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.75, 3, 10), gm);
    body.position.y = 0.6;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), gm);
    head.position.y = 1.35;
    this.ghost.add(body, head);
    this.ghost.visible = false;
    this.arena.add(this.reach.mesh, this.pathDots, this.ghost, this.warn, this.rings, this.marks, this.placeMarks);
    this.arena.visible = false;
    this.group.add(this.ambient, this.arena);
  }


  private ring(x: number, z: number, r: number, color: string, opacity: number, width = 0.08): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - width, r, 48), flat(color, opacity));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, heightAt(this.col.world, x, z) + 0.07, z);
    m.renderOrder = 6;
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

  /** A flat strip along the ground from a to b (salt, iron, a ward line being laid). */
  private ribbon(a: Pt, b: Pt, color: string, opacity: number, width = 0.16): THREE.Mesh {
    const w = this.col.world;
    const len = Math.max(0.01, Math.hypot(b.x - a.x, b.z - a.z));
    const geo = new THREE.PlaneGeometry(len, width);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, flat(color, opacity));
    const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
    m.position.set(cx, heightAt(w, cx, cz) + 0.08, cz);
    m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    m.renderOrder = 6;
    return m;
  }

  /** An arc of ground at `dist` ± `r` from a point, `spread` either side of a bearing (a sounding's bearing-only echo). */
  private arc(from: Pt, bearing: number, spread: number, d: number, r: number, color: string, opacity: number): THREE.Mesh {
    const inner = Math.max(0.2, d - r), outer = d + r;
    const geo = new THREE.RingGeometry(inner, outer, 24, 1, -bearing - spread, spread * 2);
    const m = new THREE.Mesh(geo, flat(color, opacity));
    m.rotation.x = -Math.PI / 2;
    m.position.set(from.x, heightAt(this.col.world, from.x, from.z) + 0.07, from.z);
    m.renderOrder = 5;
    return m;
  }

  private drawMarks(cl: Clearing) {
    for (const c of [...this.marks.children]) { this.marks.remove(c); (c as THREE.Mesh).geometry.dispose(); }
    for (const wd of cl.wards) {
      if (wd.kind === 'salt' || wd.kind === 'iron') this.marks.add(this.ribbon(wd, { x: wd.x2!, z: wd.z2! }, wd.kind === 'salt' ? '#f2efe6' : '#4a4e55', 0.85, wd.kind === 'salt' ? 0.14 : 0.2));
      else if (wd.kind === 'pool') this.marks.add(this.ring(wd.x, wd.z, wd.r, '#ffcf7a', 0.5, 0.08));
      else if (wd.kind === 'hearth') this.marks.add(this.ring(wd.x, wd.z, HEARTH_R, '#ff9a4a', 0.65, 0.14));
      else if (wd.kind === 'rowan') this.marks.add(this.ring(wd.x, wd.z, wd.r, '#9ad86a', 0.75, 0.14));
      else if (wd.kind === 'bell') { this.marks.add(this.ring(wd.x, wd.z, 0.35, '#e8d48a', 0.9, 0.12)); this.marks.add(this.ring(wd.x, wd.z, wd.r, '#e8d48a', 0.22, 0.06)); }
    }
    // Echoes: violet, fading with age.
    for (const e of cl.echoes) {
      const fade = Math.max(0.25, 1 - (cl.turn - e.turn) * 0.25);
      if (e.quality === 'arc' && e.from) this.marks.add(this.arc(e.from, e.bearing!, e.spread!, e.dist!, e.r, '#b48cff', 0.3 * fade));
      else if (e.quality === 'ring' && e.from) this.marks.add(this.arc(e.from, 0, Math.PI, e.dist!, e.r, '#b48cff', 0.14 * fade));
      else this.marks.add(this.ring(e.x, e.z, Math.max(0.5, e.r), '#b48cff', (e.quality === 'exact' ? 0.9 : 0.6) * fade, e.quality === 'exact' ? 0.12 : 0.08));
    }
    // Signs found: a small pale mark where each was.
    for (const sg of cl.signs) if (sg.found) this.marks.add(this.ring(sg.x, sg.z, 0.28, '#fff2c8', 0.8, 0.1));
  }

  /** Laying a ward: show where it would go. */
  private drawPlacing(cl: Clearing, placing: { unit: number; item: ItemKind } | null, hover: Pt | null) {
    const u = placing && cl.units.find((x) => x.id === placing.unit);
    const key = u && hover ? `${placing!.item}|${u.x},${u.z}|${hover.x.toFixed(2)},${hover.z.toFixed(2)}` : '';
    if (key === this.placeKey) return;
    this.placeKey = key;
    for (const c of [...this.placeMarks.children]) { this.placeMarks.remove(c); (c as THREE.Mesh).geometry.dispose(); }
    if (!u || !hover || !placing) return;
    if (placing.item === 'salt' || placing.item === 'iron') {
      const d = Math.hypot(hover.x - u.x, hover.z - u.z), k = Math.min(1, 5 / Math.max(0.01, d));
      this.placeMarks.add(this.ribbon(u, { x: u.x + (hover.x - u.x) * k, z: u.z + (hover.z - u.z) * k }, placing.item === 'salt' ? '#f2efe6' : '#6a6e75', 0.5));
    } else {
      const ok = Math.hypot(hover.x - u.x, hover.z - u.z) <= 2.2;
      this.placeMarks.add(this.ring(hover.x, hover.z, placing.item === 'rowan' ? 2 : 4.5, ok ? (placing.item === 'rowan' ? '#9ad86a' : '#e8d48a') : '#ff7a5a', 0.55, 0.1));
    }
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

  /** Inside a clearing. `hover` is the point under the cursor, in world units. */
  updateArena(t: number, cl: Clearing | null, selUnit: number, hover: Pt | null, camera: THREE.Camera, width: number, height: number, placing: { unit: number; item: ItemKind } | null = null) {
    this.arena.visible = !!cl;
    const live = new Set<string>();
    if (!cl) {
      if (this.marksKey) this.onSeen?.(null);
      this.preview = null; this.previewKey = ''; this.reachKey = ''; this.marksKey = ''; this.placeKey = '';
    }
    if (cl) {
      const w = this.col.world;
      const h = this.col.haunts[cl.haunt];
      const u = cl.units.find((x) => x.id === selUnit && x.state === 'in');
      // The dark, the wards, the echoes and the signs: redrawn when anything about the light changes.
      const mk = `${cl.turn}|${cl.units.map((x) => `${x.x.toFixed(2)},${x.z.toFixed(2)},${x.state},${x.lantern ? `${x.lantern.state}${x.lantern.lit ? 1 : 0}${x.lantern.aim?.toFixed(2) ?? ''}` : ''}`).join(';')}|${cl.wards.map((x) => `${x.kind}${x.hp}`).join(',')}|${cl.echoes.map((e) => `${e.spirit}${e.quality}${e.turn}`).join(',')}|${cl.signs.filter((x) => x.found).length}`;
      if (mk !== this.marksKey) {
        this.marksKey = mk;
        this.onSeen?.(seenTiles(this.col, cl));
        this.drawMarks(cl);
      }
      this.drawPlacing(cl, placing, hover);
      // Where the chosen one can go this turn: two soft rings.
      const rk = `${u ? `${u.id}:${u.x},${u.z}:${u.ap}` : ''}:${cl.turn}:${cl.units.map((x) => `${x.x},${x.z},${x.state}`).join(';')}:${h.spirits.map((s) => s.fate[0]).join('')}:${cl.wards.length}`;
      let reach: Reach | null = null;
      if (u && !cl.outcome) reach = reachOf(this.col, cl, u);
      if (rk !== this.reachKey) {
        this.reachKey = rk;
        this.previewKey = '';
        this.reach.set(w, reach);
        // Rings: under the team, wards, the Hollow's reach.
        for (const c of [...this.rings.children]) { this.rings.remove(c); (c as THREE.Mesh).geometry.dispose(); }
        for (const x of cl.units) if (x.state === 'in') {
          const frac = x.nerve / x.maxNerve;
          this.rings.add(this.ring(x.x, x.z, 0.5, x.id === selUnit ? '#ffffff' : frac < 0.35 ? '#ff7a6a' : frac < 0.65 ? '#ffd06a' : '#8af0c8', 0.9, x.id === selUnit ? 0.1 : 0.07));
        }
        for (const s of h.spirits) if (s.kind === 'hollow' && s.fate === 'present' && s.known >= 1) this.rings.add(this.ring(tileX(w, s.tx), tileZ(w, s.tz), 4.6, '#8a5ad0', 0.45, 0.12));
      }
      this.reach.mesh.visible = !!reach;
      this.reach.tick(t);
      // The walk to the cursor: the way, a ghost of them there, and what would reach them.
      const pk = u && reach && hover ? `${rk}|${hover.x.toFixed(2)},${hover.z.toFixed(2)}` : '';
      if (pk !== this.previewKey) {
        this.previewKey = pk;
        this.preview = null;
        this.pathDots.count = 0;
        this.ghost.visible = false;
        for (const c of [...this.warn.children]) { this.warn.remove(c); (c as THREE.Mesh).geometry.dispose(); }
        const cost = u && reach && hover ? walkCost(reach, hover.x, hover.z, u.ap) : null;
        if (u && reach && hover && cost !== null && standable(gridOf(this.col, cl), occupantsFor(this.col, cl, u), hover.x, hover.z)) {
          const path = previewPath(this.col, cl, u, reach, hover.x, hover.z);
          if (path) {
            const m4 = new THREE.Matrix4();
            let n = 0;
            for (let i = 1; i < path.length && n < 200; i++) {
              const a = path[i - 1], b = path[i], len = Math.hypot(b.x - a.x, b.z - a.z);
              for (let d = i === 1 ? 0.45 : 0; d < len && n < 200; d += 0.32) {
                const x = a.x + ((b.x - a.x) * d) / len, z = a.z + ((b.z - a.z) * d) / len;
                m4.makeTranslation(x, heightAt(w, x, z) + 0.08, z);
                this.pathDots.setMatrixAt(n++, m4);
              }
            }
            this.pathDots.count = n;
            this.pathDots.instanceMatrix.needsUpdate = true;
            (this.pathDots.material as THREE.MeshBasicMaterial).color.set(cost > 1 && u.ap > 1 ? '#ffd27a' : '#bff5e6');
            this.ghost.position.set(hover.x, heightAt(w, hover.x, hover.z), hover.z);
            this.ghost.visible = true;
            const threats = threatsAt(this.col, cl, u, hover.x, hover.z);
            (this.ghost.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.color.set(threats.length ? '#ffb39a' : cost > 1 && u.ap > 1 ? '#ffe2a0' : '#bff5e6');
            for (const th of threats) this.warn.add(this.ring(tileX(w, th.spirit.tx), tileZ(w, th.spirit.tz), 0.95, '#ff7a5a', 0.85, 0.12));
            this.preview = { cost, threats };
          }
        }
      }
      for (const c of this.warn.children) ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 5) * 0.3;
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
          g.position.set(u.x, heightAt(w, u.x, u.z), u.z);
          f = { group: g, key, phase: this.rand() * 10 };
          const el = document.createElement('div');
          el.className = 'label spirit';
          el.textContent = u.name;
          this.labels.appendChild(el);
          f.label = el;
          this.forms.set(key, f);
          this.arena.add(g);
        }
        const tx = u.x, tz = u.z;
        const p = f.group.position;
        p.x += (tx - p.x) * 0.12; p.z += (tz - p.z) * 0.12;
        p.y = heightAt(w, p.x, p.z) + Math.abs(Math.sin(t * 3 + f.phase)) * 0.06;
        this.label(f, camera, width, height);
      }
    }
    for (const k of [...this.forms.keys()]) if ((k.startsWith('c') || k.startsWith('f')) && !live.has(k)) this.drop(k);
  }
}

const RANK: Reading[] = ['none', 'chill', 'luminous', 'coherent'];

/**
 * The two rings, drawn from the reach field as soft contours (not lit tiles):
 * a texture holds each cell's walking distance (red) and whether it can be
 * reached (green); the shader fills the inner ring faintly and draws both
 * edges, following walls and wrecks as the walk does.
 */
class ReachOverlay {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private tex: THREE.DataTexture | null = null;
  constructor() {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      uniforms: { uTex: { value: null }, uInner: { value: 0.5 }, uHasInner: { value: 1 }, uEdge: { value: 0.02 }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D uTex; uniform float uInner; uniform float uHasInner; uniform float uEdge; uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec2 f = texture2D(uTex, vUv).rg;
          float d = f.r, m = f.g;
          float aa = max(fwidth(m), 0.02);
          float inside = smoothstep(0.5 - aa, 0.5 + aa, m);
          float outerEdge = 1.0 - smoothstep(0.0, aa * 2.5, abs(m - 0.5));
          float ae = max(fwidth(d) * 1.2, uEdge);
          float innerFill = (1.0 - smoothstep(uInner - ae, uInner + ae, d)) * inside * uHasInner;
          float innerEdge = (1.0 - smoothstep(0.0, ae, abs(d - uInner))) * inside * uHasInner;
          vec3 teal = vec3(0.45, 0.95, 0.82), amber = vec3(1.0, 0.8, 0.45);
          float pulse = 0.85 + 0.15 * sin(uTime * 2.0);
          vec3 col = mix(amber, teal, max(innerFill, innerEdge));
          float a = innerFill * 0.13 + (inside - innerFill) * 0.06 + innerEdge * 0.75 * pulse + outerEdge * 0.8 * pulse;
          if (a < 0.01) discard;
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.mesh.renderOrder = 5;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }
  tick(t: number) { this.mesh.material.uniforms.uTime.value = t; }
  set(w: Parameters<typeof heightAt>[0], r: Reach | null) {
    if (!r) return;
    const f = r.field, n = f.n;
    const scale = r.outer * 1.25;
    const data = new Uint8Array(n * n * 2);
    for (let k = 0; k < n * n; k++) {
      const d = f.dist[k];
      if (isFinite(d)) { data[k * 2] = Math.min(255, Math.round((d / scale) * 255)); data[k * 2 + 1] = 255; }
    }
    // Unreachable cells take their reachable neighbours' distance, so the inner edge doesn't ring every wall.
    for (let pass = 0; pass < 2; pass++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      if (isFinite(f.dist[k]) || data[k * 2]) continue;
      let best = 255;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= n || b >= n) continue;
        const v = data[(b * n + a) * 2];
        if (v && v < best) best = v;
      }
      if (best < 255) data[k * 2] = best;
    }
    this.tex?.dispose();
    this.tex = new THREE.DataTexture(data, n, n, THREE.RGFormat, THREE.UnsignedByteType);
    this.tex.unpackAlignment = 1; // rows of two bytes a cell need not fill whole words
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.needsUpdate = true;
    const u = this.mesh.material.uniforms;
    u.uTex.value = this.tex;
    u.uInner.value = r.inner / scale;
    u.uHasInner.value = r.inner > 0 ? 1 : 0;
    u.uEdge.value = 0.05 / scale;
    // A sheet over the ground, one vertex a cell, lifted just above it.
    const x0 = f.ox - CELL / 2, z0 = f.oz - CELL / 2, size = n * CELL;
    const geo = new THREE.PlaneGeometry(size, size, n, n);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute, uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + x0 + size / 2, z = pos.getZ(i) + z0 + size / 2;
      pos.setXYZ(i, x, heightAt(w, x, z) + 0.05, z);
      uv.setXY(i, (x - x0) / size, (z - z0) / size);
    }
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
  }
}

