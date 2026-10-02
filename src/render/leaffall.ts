/**
 * Falling leaves (DESIGN §42): in late autumn, single leaves drop from the
 * broadleaf trees near the view, tumbling and drifting on the wind, and lie
 * on the ground a while before they fade into the litter (the ground's own
 * leaf cover, util.ts `uLitter`).
 *
 * A small fixed pool of instances updated on the CPU each frame; one draw.
 * Leaves come only from standing oaks and birches on explored ground, so
 * nothing falls out of the fog of war.
 */
import * as THREE from 'three';
import { heightAt, type World } from '../sim/world';
import { tagOutline } from './outlinecats';
import { PIXEL, makeRand } from './util';

interface Leaf { x: number; y: number; z: number; ground: number; ph: number; spin: number; landed: number; alive: boolean }

/** Autumn leaf colours: mostly orange and gold, some red, some brown. */
const COLOURS = ['#c8561c', '#d9822b', '#e0a83a', '#b8401f', '#9c3a1c', '#8a6236', '#d4b04a'].map((c) => new THREE.Color(c));

export class LeafFall {
  mesh: THREE.InstancedMesh;
  private leaves: Leaf[] = [];
  private readonly N = PIXEL ? 280 : 500;
  private rand = makeRand(1717);
  private near: number[] = [];
  private nearAt = new THREE.Vector2(1e9, 1e9);
  private debt = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(private world: World) {
    // One leaf: a small pointed diamond, a little longer than wide.
    const g = new THREE.BufferGeometry();
    const L = PIXEL ? 0.2 : 0.14, W = L * 0.62;
    // Both faces carry the same upward normal: a tumbling leaf is lit like one lying flat,
    // instead of flashing black when its underside turns to the camera (DoubleSide flips the normal).
    const quad = [0, 0, -L, W, 0, 0, 0, 0, L * 0.8, -W, 0, 0];
    g.setAttribute('position', new THREE.Float32BufferAttribute([...quad, ...quad], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 8 }, () => [0, 1, 0]).flat(), 3));
    g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]);
    const mat = tagOutline(new THREE.MeshLambertMaterial(), 'plants');
    this.mesh = new THREE.InstancedMesh(g, mat, this.N);
    this.mesh.name = 'leaffall';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    for (let i = 0; i < this.N; i++) {
      this.leaves.push({ x: 0, y: 0, z: 0, ground: 0, ph: 0, spin: 0, landed: 0, alive: false });
      this.mesh.setColorAt(i, COLOURS[i % COLOURS.length]);
    }
  }

  /** Broadleaf trees near the view, refreshed when the view moves on. */
  private candidates(cx: number, cz: number): number[] {
    if (Math.hypot(cx - this.nearAt.x, cz - this.nearAt.y) < 8) return this.near;
    this.nearAt.set(cx, cz);
    const w = this.world, R = 46;
    this.near = [];
    for (const t of w.trees) {
      if (t.felled || t.kind === 'pine' || t.growth < 0.6) continue;
      const x = t.tx - w.w / 2 + 0.5, z = t.tz - w.h / 2 + 0.5;
      if (Math.abs(x - cx) > R || Math.abs(z - cz) > R) continue;
      if (!w.explored[t.tz * w.w + t.tx]) continue;
      this.near.push(t.id);
    }
    return this.near;
  }

  /**
   * `fall` 0..1 (seasonLook.leafFall), `wind` the shader wind strength (uWind),
   * dt in seconds.
   */
  update(dt: number, t: number, center: THREE.Vector3, fall: number, wind: number) {
    dt = Math.min(dt, 0.1);
    const w = this.world;
    // Spawn: up to ~40 a second at the height of leaf fall, more in a breeze.
    if (fall > 0.01) {
      const trees = this.candidates(center.x, center.z);
      if (trees.length) {
        this.debt += dt * fall * (PIXEL ? 26 : 40) * (0.6 + 0.6 * wind);
        for (const l of this.leaves) {
          if (this.debt < 1) break;
          if (l.alive) continue;
          this.debt -= 1;
          const tr = w.trees[trees[Math.floor(this.rand() * trees.length)]];
          // From round the crown's edge, where a falling leaf is seen (under the crown it's hidden).
          const a = this.rand() * Math.PI * 2, rr = (1.1 + this.rand() * 0.7) * tr.size;
          const x = tr.tx - w.w / 2 + 0.5 + Math.cos(a) * rr;
          const z = tr.tz - w.h / 2 + 0.5 + Math.sin(a) * rr;
          l.x = x; l.z = z;
          l.ground = heightAt(w, x, z) + 0.03;
          l.y = l.ground + (2.6 + this.rand() * 2.2) * tr.size;
          l.ph = this.rand() * 100; l.spin = 1.5 + this.rand() * 2.5;
          l.landed = 0; l.alive = true;
        }
        this.debt = Math.min(this.debt, 4);
      }
    } else this.debt = 0;
    // Move: a slow fall with a side-to-side flutter, the breeze carrying them one way.
    const drift = 0.25 + 0.55 * wind;
    let n = 0;
    for (let i = 0; i < this.N; i++) {
      const l = this.leaves[i];
      if (!l.alive) continue;
      let scale = 1;
      if (!l.landed) {
        const flutter = Math.sin(t * 2.3 + l.ph);
        l.y -= dt * (0.55 + 0.35 * Math.abs(flutter));
        l.x += dt * (drift + flutter * 0.7);
        l.z += dt * (drift * 0.45 + Math.cos(t * 1.7 + l.ph) * 0.5);
        if (l.y <= l.ground) { l.y = l.ground; l.landed = t; }
        this.e.set(t * l.spin + l.ph, t * l.spin * 0.7, Math.sin(t * l.spin + l.ph) * 1.2);
      } else {
        // Lying flat, then sinking into the litter.
        const age = t - l.landed;
        if (age > 9) { l.alive = false; continue; }
        scale = age > 6 ? 1 - (age - 6) / 3 : 1;
        this.e.set(0, l.ph, 0);
      }
      this.q.setFromEuler(this.e);
      this.p.set(l.x, l.y, l.z);
      this.s.setScalar(scale);
      this.m.compose(this.p, this.q, this.s);
      // Keep each leaf's colour by moving it with its slot.
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, COLOURS[i % COLOURS.length]);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
