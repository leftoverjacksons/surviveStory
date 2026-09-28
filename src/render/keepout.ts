/**
 * Keep-out overlay for drawing a plot (DESIGN §23.3): tiles a plot may not
 * cover are tinted around the cursor, so "something is in the way" can be
 * seen before clicking, and the tile a refused plot failed on is marked.
 * The rules are the plot's own (`homes.ts#plotTileWhy`).
 */
import * as THREE from 'three';
import { heightAt, tileX, tileZ, toTileX, toTileZ, type World } from '../sim/world';
import { plotObstacles, plotTileWhy, type PlotBlock } from '../sim/homes';
import type { Village } from '../sim/buildings';

const R = 22;
const COLORS: Record<PlotBlock, THREE.Color> = {
  hard: new THREE.Color('#e0503a'),
  folk: new THREE.Color('#50c8aa'),
  haunted: new THREE.Color('#9a6ad8'),
  unexplored: new THREE.Color('#3a3a44'),
};

export class KeepOut {
  group = new THREE.Group();
  private tiles: THREE.InstancedMesh;
  private fail: THREE.Mesh;
  private key = '';
  private failUntil = 0;

  constructor(private world: World, private village: Village) {
    const quad = new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.38, depthWrite: false, toneMapped: false, fog: false });
    this.tiles = new THREE.InstancedMesh(quad, mat, (2 * R + 1) ** 2);
    this.tiles.count = 0;
    this.tiles.frustumCulled = false;
    this.tiles.renderOrder = 9;
    const ring = new THREE.RingGeometry(0.55, 0.8, 24).rotateX(-Math.PI / 2);
    this.fail = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, depthTest: false, toneMapped: false, fog: false }));
    this.fail.renderOrder = 11;
    this.fail.visible = false;
    this.group.add(this.tiles, this.fail);
    this.group.name = 'keepout';
    this.group.visible = false;
  }

  /** Show blocked tiles around a world point (while a plot is being drawn); null hides them. */
  show(at: { x: number; z: number } | null) {
    this.group.visible = !!at;
    if (!at) { this.key = ''; return; }
    const w = this.world;
    const cx = toTileX(w, at.x), cz = toTileZ(w, at.z);
    // Rebuild when the cursor moves to another tile, or the land changes under it.
    const key = `${cx},${cz}:${w.zoneVersion}:${this.village.buildings.length}:${this.village.projects.length}:${this.village.plots.length}`;
    if (key === this.key) return;
    this.key = key;
    const others = plotObstacles(this.village);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let tz = cz - R; tz <= cz + R; tz++) for (let tx = cx - R; tx <= cx + R; tx++) {
      if (Math.hypot(tx - cx, tz - cz) > R) continue;
      const bad = plotTileWhy(w, this.village, tx, tz, others);
      if (!bad) continue;
      const x = tileX(w, tx), z = tileZ(w, tz);
      m.makeTranslation(x, heightAt(w, x, z) + 0.08, z);
      this.tiles.setMatrixAt(n, m);
      // Fade toward the edge of the circle, so it reads as a lamp around the cursor.
      const fade = 1 - Math.max(0, Math.hypot(tx - cx, tz - cz) - R * 0.6) / (R * 0.4);
      this.tiles.setColorAt(n, COLORS[bad.kind].clone().multiplyScalar(0.35 + 0.65 * fade));
      n++;
    }
    this.tiles.count = n;
    this.tiles.instanceMatrix.needsUpdate = true;
    if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
  }

  /** Mark the tile a refused plot failed on, for a few seconds. */
  markFail(t: { tx: number; tz: number } | null) {
    if (!t) return;
    const w = this.world, x = tileX(w, t.tx), z = tileZ(w, t.tz);
    this.fail.position.set(x, heightAt(w, x, z) + 0.12, z);
    this.fail.visible = true;
    this.failUntil = performance.now() + 4000;
  }

  update() {
    if (!this.fail.visible) return;
    const left = this.failUntil - performance.now();
    if (left <= 0) { this.fail.visible = false; return; }
    const s = 1 + 0.25 * Math.sin(performance.now() / 120);
    this.fail.scale.set(s, 1, s);
  }
}
