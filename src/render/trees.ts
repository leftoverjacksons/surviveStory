import * as THREE from 'three';
import { heightAt, type Tree, type World } from '../sim/world';
import { enhance, makeRand } from './util';
import { clumpOverlaps, fitClump, trunkBlocked, type Obstacle } from './clearance';

interface Slot { mesh: THREE.InstancedMesh; index: number }

const CH = 32;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/** Visual recipe for one tree, deterministic from its id. */
interface Part { geo: 'trunk' | 'blob' | 'cone'; pos: THREE.Vector3; rot: THREE.Euler; scale: THREE.Vector3; color: THREE.Color }

function recipe(t: Tree, w: World): Part[] {
  const rand = makeRand(t.id * 7919 + 13);
  const x = t.tx - w.w / 2 + 0.5 + (rand() - 0.5) * 0.4;
  const z = t.tz - w.h / 2 + 0.5 + (rand() - 0.5) * 0.4;
  const y = heightAt(w, x, z);
  const s = t.size;
  const parts: Part[] = [];
  const lean = new THREE.Euler((rand() - 0.5) * 0.12, 0, (rand() - 0.5) * 0.12);
  if (t.kind === 'pine') {
    const h = (3.2 + rand() * 2) * s;
    parts.push({ geo: 'trunk', pos: new THREE.Vector3(x, y, z), rot: lean, scale: new THREE.Vector3(s * 0.8, h * 0.45, s * 0.8), color: new THREE.Color('#4a3829') });
    const tiers = 3;
    for (let i = 0; i < tiers; i++) {
      const r = (1.3 - i * 0.32) * s;
      const col = new THREE.Color().setHSL(0.36 + rand() * 0.04, 0.35 + rand() * 0.1, 0.14 + rand() * 0.05 + i * 0.015);
      parts.push({ geo: 'cone', pos: new THREE.Vector3(x, y + h * 0.3 + i * h * 0.22, z), rot: new THREE.Euler(0, rand() * 6, 0), scale: new THREE.Vector3(r, h * 0.36, r), color: col });
    }
    return parts;
  }
  const birch = t.kind === 'birch';
  const h = (birch ? 3.4 + rand() * 1.8 : 2.8 + rand() * 1.6) * s;
  parts.push({
    geo: 'trunk', pos: new THREE.Vector3(x, y, z), rot: lean,
    scale: new THREE.Vector3(s * (birch ? 0.6 : 1), h, s * (birch ? 0.6 : 1)),
    color: new THREE.Color(birch ? '#d8d4c6' : '#4a3a2c'),
  });
  const blobs = birch ? 2 + Math.floor(rand() * 2) : 3 + Math.floor(rand() * 2);
  const hue = birch ? 0.2 + rand() * 0.04 : 0.23 + rand() * 0.07;
  for (let b = 0; b < blobs; b++) {
    const r = (birch ? 0.8 + rand() * 0.5 : 1.1 + rand() * 0.8) * s;
    const col = new THREE.Color().setHSL(hue + (rand() - 0.5) * 0.03, 0.42 + rand() * 0.15, (birch ? 0.3 : 0.2) + rand() * 0.1);
    parts.push({
      geo: 'blob',
      pos: new THREE.Vector3(x + (rand() - 0.5) * 1.3 * s, y + h + (rand() - 0.3) * 1.1 * s, z + (rand() - 0.5) * 1.3 * s),
      rot: new THREE.Euler(rand() * 3, rand() * 3, rand() * 3),
      scale: new THREE.Vector3(r, r * (0.75 + rand() * 0.3), r),
      color: col,
    });
  }
  return parts;
}

/**
 * All standing trees, instanced per 32×32 chunk so off-screen chunks cull.
 * Felled trees are hidden and replaced by a short falling animation and a stump.
 */
/** Scale a tree recipe about its base for a sapling at `g` of full size. */
function grown(parts: Part[], g: number): Part[] {
  if (g >= 1) return parts;
  const k = Math.max(0.12, g);
  const base = parts[0].pos;
  return parts.map((p) => ({
    ...p,
    pos: base.clone().add(p.pos.clone().sub(base).multiplyScalar(k)),
    scale: p.scale.clone().multiplyScalar(k),
  }));
}

/**
 * A leaf clump: a sphere with its vertices pushed in and out a little, so
 * canopies read as foliage rather than balls. Shared corners move together
 * (the offset is a function of position), so the surface stays closed.
 */
function lumpy(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 5.1 + v.y * 1.7) * 0.5 + Math.sin(v.z * 4.3 - v.x * 2.9) * 0.35 + Math.sin(v.y * 6.7 + v.z * 1.3) * 0.25;
    // Flatter underneath, as real crowns are.
    const k = (1 + n * 0.11) * (v.y < 0 ? 1 - 0.18 * -v.y : 1);
    pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Shape a tree's canopy around nearby buildings (see clearance.ts). */
function fitted(parts: Part[], obs: Obstacle[]): Part[] {
  if (!obs.length) return parts;
  const base = parts[0].pos;
  if (trunkBlocked(obs, base.x, base.z)) return parts.map((p) => ({ ...p, scale: new THREE.Vector3(0, 0, 0) }));
  return parts.map((p, i) => {
    if (i === 0 || p.geo === 'trunk') return p;
    const pos = p.pos.clone();
    const k = fitClump(obs, pos, Math.max(p.scale.x, p.scale.z), base);
    if (k === 1 && pos.equals(p.pos)) return p;
    return { ...p, pos, scale: p.scale.clone().multiplyScalar(k) };
  });
}

export class TreeField {
  private obs: Obstacle[] = [];
  /** Trees whose canopy was reshaped last time, so they can be restored. */
  private shaped = new Set<number>();
  group = new THREE.Group();
  private slots = new Map<number, Slot[]>();
  private geos: Record<Part['geo'], THREE.BufferGeometry>;
  private trunkMat = enhance(new THREE.MeshLambertMaterial({ flatShading: true }));
  private leafMat = enhance(new THREE.MeshLambertMaterial({ flatShading: true }), { wind: 0.04, season: 'broadleaf', shade: 1 });
  private pineMat = enhance(new THREE.MeshLambertMaterial({ flatShading: true }), { wind: 0.03, season: 'conifer', shade: 2 });
  private falling: { g: THREE.Group; t: number; axis: THREE.Vector3; pivot: THREE.Vector3 }[] = [];
  private stumps: THREE.InstancedMesh;
  private stumpCount = 0;

  constructor(private world: World) {
    const trunk = new THREE.CylinderGeometry(0.16, 0.28, 1, 6);
    trunk.translate(0, 0.5, 0);
    const cone = new THREE.ConeGeometry(1, 1, 7);
    this.geos = { trunk, blob: lumpy(new THREE.IcosahedronGeometry(1, 1)), cone };

    // Bucket trees into chunks.
    const buckets = new Map<number, Tree[]>();
    for (const t of world.trees) {
      if (t.felled) continue;
      const key = Math.floor(t.tz / CH) * 1000 + Math.floor(t.tx / CH);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(t);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (const trees of buckets.values()) {
      const recipes = trees.map((t) => ({ t, parts: recipe(t, world) }));
      const count = (g: Part['geo']) => recipes.reduce((n, r) => n + r.parts.filter((p) => p.geo === g).length, 0);
      const meshes = {
        trunk: new THREE.InstancedMesh(this.geos.trunk, this.trunkMat, count('trunk')),
        blob: new THREE.InstancedMesh(this.geos.blob, this.leafMat, Math.max(1, count('blob'))),
        cone: new THREE.InstancedMesh(this.geos.cone, this.pineMat, Math.max(1, count('cone'))),
      };
      const next = { trunk: 0, blob: 0, cone: 0 };
      for (const { t, parts } of recipes) {
        const slots: Slot[] = [];
        for (const p of parts) {
          const mesh = meshes[p.geo];
          const i = next[p.geo]++;
          q.setFromEuler(p.rot);
          m.compose(p.pos, q, p.scale);
          mesh.setMatrixAt(i, m);
          mesh.setColorAt(i, p.color);
          slots.push({ mesh, index: i });
        }
        this.slots.set(t.id, slots);
      }
      for (const [k, mesh] of Object.entries(meshes)) {
        mesh.count = next[k as Part['geo']];
        if (mesh.count === 0) continue;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        this.group.add(mesh);
      }
    }

    this.stumps = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.22, 0.3, 0.35, 7).translate(0, 0.17, 0),
      enhance(new THREE.MeshLambertMaterial({ color: '#6a5238', flatShading: true })),
      4096,
    );
    this.stumps.count = 0;
    this.stumps.castShadow = this.stumps.receiveShadow = true;
    this.stumps.frustumCulled = false;
    this.group.add(this.stumps);
  }

  /** Hide a standing tree and play it falling in direction (dirX, dirZ). */
  fell(treeId: number, dirX: number, dirZ: number) {
    const slots = this.slots.get(treeId) ?? [];
    const t = this.world.trees[treeId];
    if (!slots.length && !t.planted) return;
    // Too many falling at once (fast-forward, or a clearing gang): skip the animation.
    const animate = this.falling.length < 6;
    const parts = animate ? fitted(grown(recipe(t, this.world), t.growth), this.obs) : [];
    const g = new THREE.Group();
    const base = animate ? parts[0].pos.clone() : grown(recipe(t, this.world), 1)[0].pos.clone();
    for (const p of parts) {
      const col = p.color.clone();
      // Clones lose the shader patch, so re-apply it with the same seasonal style.
      const mat = p.geo === 'trunk' ? enhance(this.trunkMat.clone())
        : p.geo === 'cone' ? enhance(this.pineMat.clone(), { season: 'conifer', shade: 2 })
        : enhance(this.leafMat.clone(), { season: 'broadleaf', shade: 1 });
      (mat as THREE.MeshLambertMaterial).color = col;
      mat.transparent = true;
      const mesh = new THREE.Mesh(this.geos[p.geo], mat);
      mesh.position.copy(p.pos).sub(base);
      mesh.rotation.copy(p.rot);
      mesh.scale.copy(p.scale);
      mesh.castShadow = true;
      g.add(mesh);
    }
    g.position.copy(base);
    if (animate) this.group.add(g);
    this.youngKey = '';
    for (const s of slots) {
      s.mesh.setMatrixAt(s.index, ZERO);
      s.mesh.instanceMatrix.needsUpdate = true;
    }
    this.slots.delete(treeId);
    const axis = new THREE.Vector3(dirZ, 0, -dirX).normalize();
    if (animate) this.falling.push({ g, t: 0, axis, pivot: base });

    if (this.stumpCount < 4096) {
      const m = new THREE.Matrix4().compose(base, new THREE.Quaternion(), new THREE.Vector3(t.size, t.size, t.size));
      this.stumps.setMatrixAt(this.stumpCount++, m);
      this.stumps.count = this.stumpCount;
      this.stumps.instanceMatrix.needsUpdate = true;
    }
  }

  // ---- planted trees (woodlots): a small dynamic set, rebuilt when they grow ----
  private young: THREE.InstancedMesh[] = [];
  private youngKey = '';

  syncPlanted() {
    const planted = this.world.trees.filter((t) => t.planted && !t.felled);
    const key = planted.map((t) => `${t.id}:${Math.round(t.growth * 20)}`).join(',');
    if (key === this.youngKey) return;
    this.youngKey = key;
    for (const m of this.young) this.group.remove(m);
    this.young = [];
    if (!planted.length) return;
    const all = planted.map((t) => fitted(grown(recipe(t, this.world), t.growth), this.obs));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (const [geo, mat] of [['trunk', this.trunkMat], ['blob', this.leafMat], ['cone', this.pineMat]] as const) {
      const parts = all.flat().filter((p) => p.geo === geo);
      if (!parts.length) continue;
      const mesh = new THREE.InstancedMesh(this.geos[geo], mat, parts.length);
      parts.forEach((p, i) => {
        q.setFromEuler(p.rot);
        m.compose(p.pos, q, p.scale);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, p.color);
      });
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
      this.young.push(mesh);
    }
  }

  /**
   * Buildings changed: reshape the canopies of standing wild trees near any
   * of them (and restore trees that no longer need it).
   */
  setObstacles(obs: Obstacle[]) {
    this.obs = obs;
    this.youngKey = '';
    const w = this.world;
    const near = new Set<number>();
    for (const o of obs) {
      const R = Math.ceil(o.hw + o.hd + 4);
      const cx = Math.floor(o.cx + w.w / 2), cz = Math.floor(o.cz + w.h / 2);
      for (let tz = cz - R; tz <= cz + R; tz++) for (let tx = cx - R; tx <= cx + R; tx++) {
        if (tx < 0 || tz < 0 || tx >= w.w || tz >= w.h) continue;
        const id = w.treeAt[tz * w.w + tx];
        if (id >= 0) near.add(id);
      }
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    const touched = new Set<THREE.InstancedMesh>();
    const next = new Set<number>();
    for (const id of new Set([...near, ...this.shaped])) {
      const slots = this.slots.get(id);
      const t = w.trees[id];
      if (!slots || !t || t.felled || t.planted) continue;
      const raw = recipe(t, w);
      const parts = near.has(id) ? fitted(raw, obs) : raw;
      if (parts !== raw && parts.some((p, i) => p !== raw[i])) next.add(id);
      parts.forEach((p, i) => {
        const s = slots[i];
        if (!s) return;
        q.setFromEuler(p.rot);
        m.compose(p.pos, q, p.scale);
        s.mesh.setMatrixAt(s.index, m);
        touched.add(s.mesh);
      });
    }
    this.shaped = next;
    for (const mesh of touched) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
  }

  /** Debug: leaf clumps (before, after fitting) that still reach into a building. */
  overlaps(obs: Obstacle[] = this.obs): { before: number; after: number; trees: number } {
    let before = 0, after = 0, trees = 0;
    for (const t of this.world.trees) {
      if (t.felled) continue;
      const raw = grown(recipe(t, this.world), t.growth);
      const fit = fitted(raw, obs);
      let hit = false;
      raw.forEach((p, i) => {
        if (p.geo === 'trunk') return;
        if (clumpOverlaps(obs, p.pos, Math.max(p.scale.x, p.scale.z) * 0.9)) { before++; hit = true; }
        const f = fit[i];
        if (f.scale.x > 0 && clumpOverlaps(obs, f.pos, Math.max(f.scale.x, f.scale.z) * 0.9)) after++;
      });
      if (hit) trees++;
    }
    return { before, after, trees };
  }

  update(dt: number) {
    for (const f of this.falling) {
      f.t += dt;
      // Accelerating topple over ~1.3s, then fade out.
      const k = Math.min(1, (f.t / 1.3) ** 2);
      f.g.quaternion.setFromAxisAngle(f.axis, k * (Math.PI / 2 - 0.12));
      if (f.t > 2.2) {
        const fade = Math.max(0, 1 - (f.t - 2.2) / 1.2);
        f.g.traverse((o) => {
          const mm = (o as THREE.Mesh).material as THREE.Material | undefined;
          if (mm) mm.opacity = fade;
        });
      }
    }
    for (const f of this.falling.filter((f) => f.t > 3.4)) {
      this.group.remove(f.g);
      f.g.traverse((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose());
    }
    this.falling = this.falling.filter((f) => f.t <= 3.4);
  }
}
