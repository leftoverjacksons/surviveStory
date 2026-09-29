/**
 * Drawing a plot or a field, shown on the ground's own grid (DESIGN §34):
 * the cursor is a yellow tile, and every tile the outline will run through
 * is lit: corners brightest, the edges drawn so far, and the edge that would
 * close the shape back to the first corner fainter. This replaces a thin
 * line floating over the ground, which was hard to read.
 */
import * as THREE from 'three';
import { heightAt, idx, inBounds, tileX, tileZ, toTileX, toTileZ, type World } from '../sim/world';

const MAX = 1600;
const CURSOR = new THREE.Color('#ffe066');
const CORNER = new THREE.Color('#fff2a8');
const EDGE = new THREE.Color('#f2c230');
const CLOSING = new THREE.Color('#7a6420');

export class DraftTiles {
  group = new THREE.Group();
  private tiles: THREE.InstancedMesh;
  private key = '';

  constructor(private world: World) {
    const quad = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false, fog: false });
    this.tiles = new THREE.InstancedMesh(quad, mat, MAX);
    this.tiles.count = 0;
    this.tiles.frustumCulled = false;
    this.tiles.renderOrder = 10;
    this.group.add(this.tiles);
    this.group.name = 'drafttiles';
  }

  /** Snap a point to the centre of its tile (corners are placed on the grid). */
  snap(p: { x: number; z: number }) {
    const w = this.world;
    return { x: tileX(w, toTileX(w, p.x)), z: tileZ(w, toTileZ(w, p.z)) };
  }

  /** The corners placed so far, and the cursor (null: nothing to show). */
  update(pts: { x: number; z: number }[], cursor: { x: number; z: number } | null, color = EDGE) {
    const key = `${pts.map((p) => `${p.x},${p.z}`).join(';')}|${cursor ? `${toTileX(this.world, cursor.x)},${toTileZ(this.world, cursor.z)}` : ''}`;
    if (key === this.key) return;
    this.key = key;
    const w = this.world;
    const lit = new Map<number, THREE.Color>();
    // Later layers win: closing edge, then edges, then corners, then the cursor.
    const line = (a: { x: number; z: number }, b: { x: number; z: number }, c: THREE.Color) => {
      const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 0.25));
      for (let k = 0; k <= n; k++) {
        const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n;
        const tx = toTileX(w, x), tz = toTileZ(w, z);
        if (inBounds(w, tx, tz)) lit.set(idx(w, tx, tz), c);
      }
    };
    const c = cursor ? this.snap(cursor) : null;
    if (c && pts.length >= 2) line(c, pts[0], CLOSING);
    for (let i = 1; i < pts.length; i++) line(pts[i - 1], pts[i], color);
    if (c && pts.length) line(pts[pts.length - 1], c, color);
    for (const p of pts) lit.set(idx(w, toTileX(w, p.x), toTileZ(w, p.z)), CORNER);
    if (c) { const tx = toTileX(w, c.x), tz = toTileZ(w, c.z); if (inBounds(w, tx, tz)) lit.set(idx(w, tx, tz), CURSOR); }
    const m = new THREE.Matrix4();
    let n = 0;
    for (const [i, col] of lit) {
      if (n >= MAX) break;
      const x = tileX(w, i % w.w), z = tileZ(w, Math.floor(i / w.w));
      m.makeTranslation(x, heightAt(w, x, z) + 0.05, z);
      this.tiles.setMatrixAt(n, m);
      this.tiles.setColorAt(n, col);
      n++;
    }
    this.tiles.count = n;
    this.tiles.instanceMatrix.needsUpdate = true;
    if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
  }

  clear() { this.update([], null); }
}
