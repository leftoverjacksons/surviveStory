/**
 * Static mesh merging. A finished building is dozens of small boxes; drawing
 * each one separately (and again for every shadow pass) is what costs frame
 * time. `mergeStatic` bakes a group's static meshes into one mesh per
 * material, keeping apart anything that must stay separate:
 *
 * - roof pieces (so roofs can still be lifted off in cutaway view), which go
 *   into a child group tagged `roofGroup`;
 * - meshes tagged `userData.keep` (animated or toggled: window glow, cloth,
 *   hens, lantern halos) and sprites, which are left as they are.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { enhance, type EnhanceOptions } from './util';

/** Is this object (or an ancestor below `root`) a roof? */
function isRoof(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let q: THREE.Object3D | null = o; q && q !== root; q = q.parent) {
    if (q.userData.roofGroup) return true;
    // The village's rule: anything above wall height directly on a building is roof.
    if (q.parent?.userData.building && q.position.y > 2.25) return true;
  }
  return !!root.userData.roofGroup;
}

/** Tall outdoor things (signs, silos) that the cutaway shouldn't slice. */
function noCut(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let q: THREE.Object3D | null = o; q && q !== root; q = q.parent) if (q.userData.noCut) return true;
  return false;
}

function keep(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let q: THREE.Object3D | null = o; q && q !== root; q = q.parent) if (q.userData.keep || q.userData.cloth || q.userData.hen || q.userData.lanternHalo) return true;
  return false;
}

/**
 * Positions, normals, uvs and (optionally) a flat vertex colour, non-indexed,
 * so any mix of primitives can merge.
 */
type Ground = (x: number, z: number) => number;

function normalise(g: THREE.BufferGeometry, m: THREE.Matrix4, color?: THREE.Color, ground?: Ground): THREE.BufferGeometry {
  let out = g.index ? g.toNonIndexed() : g.clone();
  for (const name of Object.keys(out.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') out.deleteAttribute(name);
  if (!out.attributes.normal) out.computeVertexNormals();
  const n = out.attributes.position.count;
  if (!out.attributes.uv) out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (color) {
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = color.r; c[i * 3 + 1] = color.g; c[i * 3 + 2] = color.b; }
    out.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  out.clearGroups();
  out = out.applyMatrix4(m);
  if (color && ground) {
    // Baked contact shadow: surfaces darken towards the ground they stand on.
    const p = out.attributes.position, c = out.attributes.color;
    for (let i = 0; i < n; i++) {
      const t = Math.min(1, Math.max(0, (p.getY(i) - ground(p.getX(i), p.getZ(i))) / 0.9));
      const k = 0.7 + 0.3 * t * t * (3 - 2 * t);
      c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
    }
  }
  return out;
}

/**
 * Plain flat-shaded Lambert surfaces differ only by colour, so they can all
 * share one vertex-coloured material (per set of enhance options). `cut`
 * materials are the ones the cutaway view slices; they're kept apart from
 * outdoor things like fences.
 */
const shared = new Map<string, THREE.MeshLambertMaterial>();
function sharedMaterial(opts: unknown, cut: boolean): THREE.MeshLambertMaterial {
  const key = `${JSON.stringify(opts ?? null)}|${cut}`;
  let m = shared.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    m.userData.cutShared = cut;
    if (opts) enhance(m, opts as EnhanceOptions);
    shared.set(key, m);
  }
  return m;
}

function colourable(mat: THREE.Material): mat is THREE.MeshLambertMaterial {
  const l = mat as THREE.MeshLambertMaterial;
  return !!l.isMeshLambertMaterial && !l.map && !l.transparent && !l.vertexColors && l.side === THREE.FrontSide
    && (!l.emissive || l.emissive.getHex() === 0) && !mat.userData.noMerge;
}

/**
 * Merge only the meshes directly under `group` (not its child groups, which
 * may move), into one vertex-coloured mesh. For animated rigs: merge each
 * rigid part separately.
 */
/** `?nomerge` in the URL turns merging off, for before/after profiling. */
const disabled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nomerge');

export function mergeDirect(group: THREE.Object3D): void {
  if (disabled) return;
  const meshes = group.children.filter((c) => (c as THREE.Mesh).isMesh && colourable((c as THREE.Mesh).material as THREE.Material)) as THREE.Mesh[];
  if (meshes.length < 2) return;
  const geos = meshes.map((m) => {
    m.updateMatrix();
    return normalise(m.geometry, m.matrix, (m.material as THREE.MeshLambertMaterial).color);
  });
  const mat = sharedMaterial((meshes[0].material as THREE.Material).userData.enhance, false);
  const merged = new THREE.Mesh(mergeGeometries(geos, false)!, mat);
  merged.castShadow = meshes.some((m) => m.castShadow);
  merged.receiveShadow = true;
  for (const m of meshes) group.remove(m);
  group.add(merged);
}

/**
 * Merge the static meshes under `root` (in place). Returns how many meshes
 * were replaced. Glow meshes listed in `live` are kept separate.
 */
/**
 * `ground` gives the ground height under a root-local point, for the baked
 * contact shadow (default: the root stands on flat ground at y = 0).
 */
export function mergeStatic(root: THREE.Object3D, live: Set<THREE.Object3D> = new Set(), cut = false, ground: Ground = () => 0): number {
  if (disabled) return 0;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, { mat: THREE.Material; roof: boolean; geos: THREE.BufferGeometry[]; cast: boolean }>();
  const victims: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || live.has(m) || keep(m, root)) return;
    if (Array.isArray(m.material) || !m.visible) return;
    const own = m.material as THREE.Material;
    const roof = isRoof(m, root);
    const flat = colourable(own);
    const mat = flat ? sharedMaterial(own.userData.enhance, cut && !noCut(m, root)) : own;
    const key = `${mat.uuid}|${roof ? 'r' : 'w'}|${m.castShadow ? 1 : 0}`;
    let b = buckets.get(key);
    if (!b) { b = { mat, roof, geos: [], cast: m.castShadow }; buckets.set(key, b); }
    b.geos.push(normalise(m.geometry, new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld), flat ? (own as THREE.MeshLambertMaterial).color : undefined, roof ? undefined : ground));
    victims.push(m);
  });
  if (victims.length < 4) return 0;
  for (const m of victims) m.parent?.remove(m);
  // Drop groups left empty (but keep roofGroup markers meaningful: roofs go in a fresh group).
  const roofGroup = new THREE.Group();
  roofGroup.userData.roofGroup = true;
  for (const b of buckets.values()) {
    const geo = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    for (const g of b.geos) if (g !== geo) g.dispose();
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = true;
    mesh.userData.merged = true;
    (b.roof ? roofGroup : root).add(mesh);
  }
  if (roofGroup.children.length) root.add(roofGroup);
  return victims.length;
}
