import * as THREE from 'three';

export type RoofMode = 'shown' | 'hidden' | 'cutaway';
export const ROOF_MODES: RoofMode[] = ['shown', 'hidden', 'cutaway'];

/** Everything above this height is sliced away in cutaway view. */
export const CUT_HEIGHT = 1.15;
const CUT_PLANE = new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT_HEIGHT);

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
    const want = this.mode === 'cutaway' ? [CUT_PLANE] : null;
    if ((m.clippingPlanes?.length ?? 0) === (want?.length ?? 0)) return;
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
