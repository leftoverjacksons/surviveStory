/** Shared building-kit helpers: cached flat-shaded materials and primitive meshes. */
import * as THREE from 'three';
import { enhance } from './util';

// ---------- shared materials ----------

const matCache = new Map<string, THREE.Material>();
export function mat(color: string, fog = true, tag = ''): THREE.MeshLambertMaterial {
  const key = `${color}${fog}${tag}`;
  let m = matCache.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    if (fog) enhance(m);
    matCache.set(key, m);
  }
  return m;
}
export const GLOW = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc27a').multiplyScalar(1.6), toneMapped: false });
export const GHOST = new THREE.MeshBasicMaterial({ color: '#9ff2e0', transparent: true, opacity: 0.55, depthWrite: false });
export const WISP = new THREE.MeshBasicMaterial({ color: new THREE.Color('#bff7ea').multiplyScalar(3), toneMapped: false });


export function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
export function cyl(r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 7): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
export const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

