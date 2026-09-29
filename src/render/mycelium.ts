/**
 * The mycelium, seen (DESIGN §24.10): in the Veil view, pale threads through
 * the ground from the hill, each cell joined to its strongest neighbour
 * (so it reads as a branching network), with a small glow where it is
 * thick. Gold-green while the Folk bless, violet while they curse, grey
 * between.
 */
import * as THREE from 'three';
import type { Colony } from '../sim/colony';
import { CELL, REACH, folkMood } from '../sim/mycelium';
import { heightAt } from '../sim/world';
import { worldUniforms } from './util';

const BLESS = new THREE.Color('#e0c030'), CURSE = new THREE.Color('#8a3ad0'), NEUTRAL = new THREE.Color('#5a8ab0');

export class MyceliumView {
  readonly group = new THREE.Group();
  private lines: THREE.LineSegments | null = null;
  private knots: THREE.Points | null = null;
  private key = '';
  private lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  private knotMat = new THREE.PointsMaterial({ vertexColors: true, size: 5, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });

  constructor(private col: Colony) { this.group.name = 'mycelium'; }

  private rebuild() {
    const col = this.col, my = col.mycelium!, w = col.world;
    for (const o of [this.lines, this.knots]) if (o) { this.group.remove(o); o.geometry.dispose(); }
    const mood = folkMood(col);
    const tint = mood > 0 ? BLESS : mood < 0 ? CURSE : NEUTRAL;
    const pos: number[] = [], colr: number[] = [], kp: number[] = [], kc: number[] = [];
    const centre = (c: number) => {
      const cx = c % my.cw, cz = Math.floor(c / my.cw);
      // A little jitter per cell, so the threads don't run on a grid.
      const j = ((c * 2654435761) >>> 0) / 4294967296;
      const x = (cx + 0.5) * CELL - w.w / 2 + (j - 0.5) * CELL * 0.7;
      const z = (cz + 0.5) * CELL - w.h / 2 + (((c * 40503) >>> 0) % 1000 / 1000 - 0.5) * CELL * 0.7;
      return new THREE.Vector3(x, heightAt(w, x, z) + 0.08, z);
    };
    const col3 = new THREE.Color();
    for (let c = 0; c < my.m.length; c++) {
      const v = my.m[c];
      if (v < REACH * 0.8) continue;
      const cx = c % my.cw, cz = Math.floor(c / my.cw);
      // Joined to the neighbour it grew from (the strongest).
      let best = -1, bv = v;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= my.cw || nz >= my.ch) continue;
        const n = nz * my.cw + nx;
        if (my.m[n] > bv) { bv = my.m[n]; best = n; }
      }
      const a = centre(c);
      col3.copy(tint).lerp(new THREE.Color('#ffffff'), Math.max(0, v - 0.6) * 0.6);
      if (best >= 0) {
        const b = centre(best);
        // A bend in the middle.
        const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3((b.z - a.z) * 0.18, 0, (a.x - b.x) * 0.18));
        mid.y = heightAt(w, mid.x, mid.z) + 0.08;
        pos.push(a.x, a.y, a.z, mid.x, mid.y, mid.z, mid.x, mid.y, mid.z, b.x, b.y, b.z);
        for (let k = 0; k < 4; k++) colr.push(col3.r, col3.g, col3.b);
      }
      if (v > 0.55) { kp.push(a.x, a.y + 0.05, a.z); kc.push(col3.r, col3.g, col3.b); }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    this.lines = new THREE.LineSegments(lg, this.lineMat);
    const kg = new THREE.BufferGeometry();
    kg.setAttribute('position', new THREE.Float32BufferAttribute(kp, 3));
    kg.setAttribute('color', new THREE.Float32BufferAttribute(kc, 3));
    this.knots = new THREE.Points(kg, this.knotMat);
    for (const o of [this.lines, this.knots]) { o.frustumCulled = false; o.renderOrder = 4; this.group.add(o); }
  }

  update(t: number) {
    const veil = worldUniforms.uVeil.value;
    this.group.visible = veil > 0.05 && !!this.col.mycelium;
    if (!this.group.visible) return;
    const key = `${this.col.mycelium!.version}|${Math.sign(folkMood(this.col))}`;
    if (key !== this.key) { this.key = key; this.rebuild(); }
    this.lineMat.opacity = veil * 0.9;
    this.knotMat.opacity = veil * (0.6 + Math.sin(t * 1.3) * 0.2);
  }
}
