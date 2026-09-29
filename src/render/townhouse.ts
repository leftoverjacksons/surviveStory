/**
 * The townhouse (DESIGN §24.9), drawn. Above ground: ghostly buildings on the
 * hill, one for each chamber (a seven-sided lodge of light on the crown,
 * domed bowers, a dew well, reed pipes, a lantern tree, a cradle, a guest
 * lodge). Most eyes see only a shimmer; with Sight they are clear at night,
 * and in the Veil view they are plain by day. Under the hill, in the Veil
 * view only, the chambers glow through the earth, joined by tunnels to the
 * hearth-hall.
 */
import * as THREE from 'three';
import type { Colony } from '../sim/colony';
import { alive } from '../sim/community';
import { chambers, type Chamber } from '../sim/townhouse';
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
    const key = `${chambers(f).map((c) => c.kind).join(',')}|${Math.min(12, dead)}`;
    if (key === this.key) return;
    this.key = key;
    for (const g of [this.top, this.under]) for (const c of [...g.children]) { g.remove(c); c.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
    for (const [m] of [...this.topMats, ...this.underMats]) m.dispose();
    this.topMats = []; this.underMats = [];
    const w = this.col.world, m = w.folk.mound;
    const crown = heightAt(w, m.x, m.z);
    const hall = new THREE.Vector3(m.x, crown - 1.6, m.z);
    for (const c of chambers(f)) {
      this.top.add(this.topside(c, Math.min(12, Math.max(3, dead))));
      // Under the hill: the room, and a tunnel back to the hall.
      const at = c.kind === 'hearth' ? hall.clone() : new THREE.Vector3(m.x + Math.cos(c.a) * m.r * 0.62, crown - 1.2 - c.depth * 1.4, m.z + Math.sin(c.a) * m.r * 0.62);
      const room = new THREE.Mesh(new THREE.SphereGeometry(c.kind === 'hearth' ? 1.1 : 0.55, 12, 8), this.mat(this.underMats, c.kind === 'hearth' ? '#ffcf8a' : '#9ff2e0', c.kind === 'hearth' ? 0.45 : 0.35, false));
      room.scale.y = 0.6;
      room.position.copy(at);
      this.under.add(room);
      if (c.kind !== 'hearth') {
        const d = at.distanceTo(hall);
        const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, d, 6), this.mat(this.underMats, '#9ff2e0', 0.25, false));
        tunnel.position.copy(at).add(hall).multiplyScalar(0.5);
        tunnel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hall.clone().sub(at).normalize());
        this.under.add(tunnel);
      }
    }
    // The door's passage down to the hall.
    const door = new THREE.Vector3(m.x + Math.cos(m.door) * m.r * 0.78, heightAt(w, m.x + Math.cos(m.door) * m.r * 0.78, m.z + Math.sin(m.door) * m.r * 0.78) + 0.3, m.z + Math.sin(m.door) * m.r * 0.78);
    const pd = door.distanceTo(hall);
    const passage = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, pd, 6), this.mat(this.underMats, '#ffcf8a', 0.3, false));
    passage.position.copy(door).add(hall).multiplyScalar(0.5);
    passage.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hall.clone().sub(door).normalize());
    this.under.add(passage);
    for (const o of this.under.children) o.renderOrder = 5;
  }

  /** A chamber's ghostly counterpart above ground. */
  private topside(c: Chamber, names: number): THREE.Group {
    const w = this.col.world, m = w.folk.mound;
    const g = new THREE.Group();
    const pale = this.mat(this.topMats, '#bff7ea', 0.24), warm = this.mat(this.topMats, '#ffd9a0', 0.55), bright = this.mat(this.topMats, '#e6fff8', 0.7);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
    if (c.kind === 'hearth') {
      // The townhouse on the crown: seven sides, a conical roof, the fire's light through the smoke-hole.
      g.position.set(m.x, heightAt(w, m.x, m.z) - 0.1, m.z);
      add(new THREE.CylinderGeometry(1.35, 1.45, 1.1, 7, 1, true), pale, 0, 0.55, 0);
      add(new THREE.ConeGeometry(1.75, 1.25, 7, 1, true), pale, 0, 1.72, 0);
      add(new THREE.SphereGeometry(0.16, 8, 6), warm, 0, 2.3, 0);
      // Posts at the seven corners.
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; add(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 4), bright, Math.cos(a) * 1.4, 0.65, Math.sin(a) * 1.4); }
      g.rotation.y = -m.door;
      return g;
    }
    const x = m.x + Math.cos(c.a) * m.r * 0.95, z = m.z + Math.sin(c.a) * m.r * 0.95;
    g.position.set(x, heightAt(w, x, z), z);
    g.rotation.y = -c.a;
    switch (c.kind) {
      case 'bowers':
        for (const [dx, dz, r] of [[0, -0.5, 0.55], [0.2, 0.55, 0.45]] as const) {
          add(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), pale, dx, 0, dz);
          add(new THREE.CircleGeometry(0.14, 8), warm, dx + r * 0.98, 0.18, dz).rotation.y = Math.PI / 2;
        }
        break;
      case 'dewcellar':
        add(new THREE.TorusGeometry(0.45, 0.08, 6, 14), pale, 0, 0.3, 0).rotation.x = Math.PI / 2;
        add(new THREE.CircleGeometry(0.4, 14), bright, 0, 0.32, 0).rotation.x = -Math.PI / 2;
        for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 4), pale, 0, 0.55, s * 0.5);
        add(new THREE.BoxGeometry(0.06, 0.06, 1.1), pale, 0, 1.1, 0);
        break;
      case 'gallery':
        for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.07, 0.09, 1.4 + i * 0.3, 6, 1, true), pale, (i % 2) * 0.15, (1.4 + i * 0.3) / 2, (i - 2.5) * 0.2);
        break;
      case 'archive': {
        add(new THREE.CylinderGeometry(0.1, 0.18, 2, 6, 1, true), pale, 0, 1, 0);
        for (let i = 0; i < names; i++) {
          const a = (i / names) * Math.PI * 2, r = 0.45 + (i % 3) * 0.2;
          add(new THREE.SphereGeometry(0.07, 6, 4), warm, Math.cos(a) * r, 1.3 + (i % 4) * 0.25, Math.sin(a) * r);
        }
        add(new THREE.SphereGeometry(0.9, 10, 6), pale, 0, 2.1, 0).scale.y = 0.55;
        break;
      }
      case 'nursery':
        for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 4), pale, 0, 0.9, s * 0.6).rotation.x = s * 0.3;
        add(new THREE.TorusGeometry(0.3, 0.06, 5, 10, Math.PI), bright, 0, 0.75, 0).rotation.set(Math.PI, 0, 0);
        break;
      case 'guestroom':
        add(new THREE.BoxGeometry(1.1, 1.4, 1.2), pale, 0, 0.7, 0);
        add(new THREE.ConeGeometry(0.95, 0.7, 4, 1, true), pale, 0, 1.75, 0).rotation.y = Math.PI / 4;
        add(new THREE.PlaneGeometry(0.45, 0.95), warm, 0.56, 0.48, 0).rotation.y = Math.PI / 2;
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
