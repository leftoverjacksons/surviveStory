import * as THREE from 'three';
import { enhance, type EnhanceOptions } from './util';

export type RoofMode = 'shown' | 'hidden' | 'cutaway';
export const ROOF_MODES: RoofMode[] = ['shown', 'cutaway'];

/** Everything above this height is sliced away in cutaway view. */
export const CUT_HEIGHT = 1.15;
const planes = new Map<number, THREE.Plane>();
/** The slicing plane at a world height (shared by everything cut at that height). */
function planeAt(h: number): THREE.Plane {
  const k = Math.round(h * 20) / 20;
  let p = planes.get(k);
  if (!p) { p = new THREE.Plane(new THREE.Vector3(0, -1, 0), k); planes.set(k, p); }
  return p;
}

/**
 * A building stands on its own floor (raised on a foundation on a slope, or
 * on higher ground): it is cut at knee height above that floor, not above
 * y = 0. Materials are shared between buildings, so one standing higher gets
 * a copy of each of its materials that cuts at its own height (copies are
 * shared by buildings on the same floor height, to the nearest 5 cm).
 */
const copies = new Map<string, THREE.Material>();
export function cutMaterialFor(m: THREE.Material, height: number): THREE.Material {
  const k = Math.round(height * 20) / 20;
  if (Math.abs(k - CUT_HEIGHT) < 0.03) return m;
  const key = `${m.uuid}@${k}`;
  let c = copies.get(key);
  if (!c) {
    c = m.clone();
    if (m.userData.enhance) enhance(c, m.userData.enhance as EnhanceOptions);
    c.userData.cutAt = k;
    copies.set(key, c);
  }
  return c;
}

/**
 * Lets the player look inside: roofs can be lifted off, and walls cut away
 * at knee height (a clipping plane on building materials, so walls, windows
 * and the ivy on them all cut cleanly).
 */
export class RoofControl {
  mode: RoofMode = 'shown';
  private roofs = new Set<THREE.Object3D>();
  private cut = new Set<THREE.Material>();

  addRoof(o: THREE.Object3D) {
    this.roofs.add(o);
    o.visible = this.mode === 'shown';
  }

  removeRoof(o: THREE.Object3D) { this.roofs.delete(o); }

  addCutMaterial(m: THREE.Material) {
    if (this.cut.has(m)) return;
    this.cut.add(m);
    this.applyCut(m);
  }

  private applyCut(m: THREE.Material) {
    const want = this.mode === 'cutaway' ? [planeAt((m.userData.cutAt as number | undefined) ?? CUT_HEIGHT)] : null;
    if ((m.clippingPlanes?.length ?? 0) === (want?.length ?? 0) && m.clippingPlanes?.[0] === want?.[0]) return;
    m.clippingPlanes = want;
    m.clipShadows = true;
    m.needsUpdate = true;
  }

  set(mode: RoofMode) {
    this.mode = mode;
    for (const o of this.roofs) o.visible = mode === 'shown';
    for (const m of this.cut) this.applyCut(m);
  }

  next(): RoofMode {
    const i = ROOF_MODES.indexOf(this.mode);
    this.set(ROOF_MODES[(i + 1) % ROOF_MODES.length]);
    return this.mode;
  }
}
