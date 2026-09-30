/**
 * The Folk's settlement (DESIGN §25.3), drawn. The hills are real ground
 * (raised in the terrain); what stands on and in them is of the Veil. On the
 * Great Hill's crown, the hearth-hall: a seven-sided lodge of light. On each
 * knowe, a round lodge (the upper floor) facing the Great Hill, with its
 * character beside it: a dew well, reed pipes, a lantern tree, a cradle, an
 * open door. Most eyes see only a shimmer; with Sight they are clear at night,
 * and in the Veil view they are plain by day. Underground, in the Veil view
 * only, each knowe's lower floor glows through the earth, joined by a tunnel
 * to the hall.
 */
import * as THREE from 'three';
import type { Colony } from '../sim/colony';
import { alive } from '../sim/community';
import { folkRuins, knowes, type Knowe } from '../sim/townhouse';
import type { Ruin } from '../sim/oldworld';
import { heightAt } from '../sim/world';
import { worldUniforms } from './util';

const ghost = (color: string, opacity: number, depthTest = true) => new THREE.MeshBasicMaterial({
  color: new THREE.Color(color), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest, side: THREE.DoubleSide, toneMapped: false,
});

/** Sight at which the topside is clear by night (below it: a shimmer). */
export const TOPSIDE_SIGHT = 45;

export class TownhouseView {
  readonly group = new THREE.Group();
  private top = new THREE.Group();
  private under = new THREE.Group();
  private key = '';
  /** Materials and their full opacity, faded together each frame. */
  private topMats: [THREE.MeshBasicMaterial, number][] = [];
  private underMats: [THREE.MeshBasicMaterial, number][] = [];

  constructor(private col: Colony) {
    this.group.name = 'townhouse';
    this.under.renderOrder = 5;
    this.group.add(this.top, this.under);
    this.sync();
  }

  private mat(list: [THREE.MeshBasicMaterial, number][], color: string, full: number, depthTest = true) {
    const m = ghost(color, 0, depthTest);
    list.push([m, full]);
    return m;
  }

  sync() {
    const f = this.col.folk;
    const dead = this.col.community.survivors.filter((s) => !s.alive && !s.departed && !s.taken).length;
    const ruins = folkRuins(this.col);
    const key = `${knowes(f).map((k) => `${k.id}${k.kind}`).join(',')}|${Math.min(12, dead)}|${ruins.map((r) => r.id).join(',')}`;
    if (key === this.key) return;
    this.key = key;
    for (const g of [this.top, this.under]) for (const c of [...g.children]) { g.remove(c); c.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
    for (const [m] of [...this.topMats, ...this.underMats]) m.dispose();
    this.topMats = []; this.underMats = [];
    const w = this.col.world, m = w.folk.mound;
    const crown = heightAt(w, m.x, m.z);
    const hall = new THREE.Vector3(m.x, crown - 2.4, m.z);
    this.top.add(this.hallLodge());
    // The hall itself, underground.
    const room = new THREE.Mesh(new THREE.SphereGeometry(1.8, 14, 8), this.mat(this.underMats, '#ffcf8a', 0.45, false));
    room.scale.y = 0.55;
    room.position.copy(hall);
    this.under.add(room);
    for (const k of knowes(f)) {
      this.top.add(this.knoweLodge(k, Math.min(12, Math.max(3, dead))));
      // The lower floor, and a tunnel back to the hall.
      const at = new THREE.Vector3(k.x, heightAt(w, k.x, k.z) - 1.1, k.z);
      const floor = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), this.mat(this.underMats, '#9ff2e0', 0.35, false));
      floor.scale.y = 0.45;
      floor.position.copy(at);
      this.under.add(floor);
      // A tunnel back to the hall: sagging deeper in the middle, and bending a little, like a root.
      const mid = at.clone().add(hall).multiplyScalar(0.5);
      const side = new THREE.Vector3(hall.z - at.z, 0, at.x - hall.x).normalize().multiplyScalar(at.distanceTo(hall) * 0.15 * (k.id % 2 ? 1 : -1));
      mid.add(side).setY(Math.min(at.y, hall.y) - 0.8);
      const curve = new THREE.QuadraticBezierCurve3(at, mid, hall);
      this.under.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.12, 6), this.mat(this.underMats, '#9ff2e0', 0.14, false)));
    }
    // The Folk living in the old buildings of districts given to them (DESIGN §26): the house as they see it,
    // whole and lit, standing in the ruin.
    for (const q of ruins) this.top.add(this.ruinHome(q));
    // The door's passage down to the hall.
    const dx = m.x + Math.cos(m.door) * m.r * 0.8, dz = m.z + Math.sin(m.door) * m.r * 0.8;
    const door = new THREE.Vector3(dx, heightAt(w, dx, dz) + 0.3, dz);
    const pd = door.distanceTo(hall);
    const passage = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, pd, 6), this.mat(this.underMats, '#ffcf8a', 0.3, false));
    passage.position.copy(door).add(hall).multiplyScalar(0.5);
    passage.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hall.clone().sub(door).normalize());
    this.under.add(passage);
    for (const o of this.under.children) o.renderOrder = 5;
  }

  /** A ruin as the Folk keep it: its walls whole again in light, a pale roof, warm windows and a lit door. */
  private ruinHome(q: Ruin): THREE.Group {
    const w = this.col.world;
    const g = new THREE.Group();
    const pale = this.mat(this.topMats, '#bff7ea', 0.18), warm = this.mat(this.topMats, '#ffd9a0', 0.6);
    g.position.set(q.x, heightAt(w, q.x, q.z), q.z);
    g.rotation.y = q.yaw;
    const h = Math.max(1.6, Math.min(q.h, 4));
    const walls = new THREE.Mesh(new THREE.BoxGeometry(q.w + 0.1, h, q.d + 0.1), pale);
    walls.position.y = h / 2;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(q.w, q.d) * 0.55, Math.min(q.w, q.d) * 0.5, 4, 1, true), pale);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(q.w / Math.hypot(q.w, q.d) * 1.4, 1, q.d / Math.hypot(q.w, q.d) * 1.4);
    roof.position.y = h + Math.min(q.w, q.d) * 0.25;
    g.add(walls, roof);
    // Windows along the front, and the door.
    const n = Math.max(1, Math.min(4, Math.floor(q.w / 1.6)));
    for (let i = 0; i < n; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.4), warm);
      win.position.set((i - (n - 1) / 2) * (q.w / (n + 0.5)), h * 0.62, q.d / 2 + 0.07);
      g.add(win);
    }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.85), warm);
    door.position.set(0, 0.43, q.d / 2 + 0.07);
    g.add(door);
    return g;
  }

  /** The hearth-hall on the Great Hill's crown: seven sides, a conical roof, the fire's light through the smoke-hole. */
  private hallLodge(): THREE.Group {
    const w = this.col.world, m = w.folk.mound;
    const g = new THREE.Group();
    const pale = this.mat(this.topMats, '#bff7ea', 0.24), warm = this.mat(this.topMats, '#ffd9a0', 0.55), bright = this.mat(this.topMats, '#e6fff8', 0.7);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
    g.position.set(m.x, heightAt(w, m.x, m.z) - 0.1, m.z);
    add(new THREE.CylinderGeometry(2.1, 2.25, 1.6, 7, 1, true), pale, 0, 0.8, 0);
    add(new THREE.ConeGeometry(2.7, 1.9, 7, 1, true), pale, 0, 2.55, 0);
    add(new THREE.SphereGeometry(0.24, 8, 6), warm, 0, 3.4, 0);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; add(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 4), bright, Math.cos(a) * 2.2, 0.95, Math.sin(a) * 2.2); }
    g.rotation.y = -m.door;
    return g;
  }

  /** A knowe's upper floor, facing the Great Hill, with its character beside it. */
  private knoweLodge(k: Knowe, names: number): THREE.Group {
    const w = this.col.world, m = w.folk.mound;
    const g = new THREE.Group();
    const pale = this.mat(this.topMats, '#bff7ea', 0.24), warm = this.mat(this.topMats, '#ffd9a0', 0.55), bright = this.mat(this.topMats, '#e6fff8', 0.7);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
    g.position.set(k.x, heightAt(w, k.x, k.z) - 0.05, k.z);
    // Facing the hall: local +x points at the Great Hill.
    g.rotation.y = -Math.atan2(m.z - k.z, m.x - k.x);
    // The lodge: a round wall, a domed thatch, a door-glow toward the hill.
    add(new THREE.CylinderGeometry(0.95, 1.0, 0.9, 10, 1, true), pale, 0, 0.45, 0);
    add(new THREE.SphereGeometry(1.15, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), pale, 0, 0.85, 0).scale.y = 0.75;
    add(new THREE.PlaneGeometry(0.4, 0.7), warm, 1.0, 0.36, 0).rotation.y = Math.PI / 2;
    add(new THREE.SphereGeometry(0.09, 6, 4), bright, 0, 1.75, 0);
    // Its character, off to one side.
    const s = new THREE.Group();
    s.position.set(-0.3, 0, 1.55);
    g.add(s);
    const put = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); s.add(o); return o; };
    switch (k.kind) {
      case 'dwelling':
        put(new THREE.SphereGeometry(0.45, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), pale, 0, 0, 0);
        break;
      case 'dewcellar':
        put(new THREE.TorusGeometry(0.4, 0.07, 6, 14), pale, 0, 0.28, 0).rotation.x = Math.PI / 2;
        put(new THREE.CircleGeometry(0.35, 14), bright, 0, 0.3, 0).rotation.x = -Math.PI / 2;
        for (const sd of [-1, 1]) put(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 4), pale, 0, 0.5, sd * 0.45);
        break;
      case 'gallery':
        for (let i = 0; i < 6; i++) put(new THREE.CylinderGeometry(0.06, 0.08, 1.3 + i * 0.28, 6, 1, true), pale, (i % 2) * 0.14, (1.3 + i * 0.28) / 2, (i - 2.5) * 0.18);
        break;
      case 'archive':
        put(new THREE.CylinderGeometry(0.1, 0.18, 2, 6, 1, true), pale, 0, 1, 0);
        for (let i = 0; i < names; i++) {
          const a = (i / names) * Math.PI * 2, r = 0.4 + (i % 3) * 0.18;
          put(new THREE.SphereGeometry(0.07, 6, 4), warm, Math.cos(a) * r, 1.3 + (i % 4) * 0.25, Math.sin(a) * r);
        }
        put(new THREE.SphereGeometry(0.85, 10, 6), pale, 0, 2.1, 0).scale.y = 0.55;
        break;
      case 'nursery':
        for (const sd of [-1, 1]) put(new THREE.CylinderGeometry(0.04, 0.04, 1.7, 4), pale, 0, 0.85, sd * 0.55).rotation.x = sd * 0.3;
        put(new THREE.TorusGeometry(0.28, 0.06, 5, 10, Math.PI), bright, 0, 0.72, 0).rotation.set(Math.PI, 0, 0);
        break;
      case 'guestroom':
        put(new THREE.BoxGeometry(0.9, 1.2, 1.0), pale, 0, 0.6, 0);
        put(new THREE.PlaneGeometry(0.4, 0.85), warm, 0.46, 0.43, 0).rotation.y = Math.PI / 2;
        break;
    }
    return g;
  }

  /** Fade in and out with the dark, the village's Sight and the Veil view. */
  update(t: number, night: number) {
    this.sync();
    const sight = alive(this.col.community).reduce((n, s) => Math.max(n, s.sight), 0);
    const veil = worldUniforms.uVeil.value;
    // Most eyes: a faint shimmer, day or night. With Sight: clear after dark. The Veil view shows it plainly.
    const top = Math.min(1, Math.max(sight >= TOPSIDE_SIGHT ? 0.08 + 0.85 * night : 0.07, veil));
    const shimmer = 0.85 + Math.sin(t * 0.9) * 0.15;
    for (const [m, full] of this.topMats) m.opacity = full * top * shimmer;
    for (const [m, full] of this.underMats) m.opacity = full * veil;
    this.under.visible = veil > 0.02;
  }
}
