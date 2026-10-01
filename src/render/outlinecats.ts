/**
 * Outlines by kind of thing (DESIGN §39). The pixel look's outlines come from
 * the depth buffer alone, so on their own they can't tell a house from a
 * tree. Every draw in the main pass writes a category into the stencil
 * buffer; the outline pass draws lines only where the nearer surface's
 * category is switched on (a line lands on the nearer surface, so a tree in
 * front of a house is the tree's to outline).
 *
 * The category comes from the material if it says (glass, foliage), else
 * from the scene group the object belongs to. Transparent materials keep
 * whatever is behind them, except glass.
 */
import * as THREE from 'three';

export const OUTLINE_CATS = [
  { key: 'other', label: 'Everything else' },
  { key: 'ground', label: 'Ground and rocks' },
  { key: 'plants', label: 'Plants (trees, bushes, crops, ivy)' },
  { key: 'built', label: 'Built (homes, works, yards, fences)' },
  { key: 'old', label: 'Old world (ruins, wrecks)' },
  { key: 'glass', label: 'Glass' },
  { key: 'people', label: 'People and animals' },
  { key: 'folk', label: 'The Folk and spirits' },
] as const;
export type OutlineCat = (typeof OUTLINE_CATS)[number]['key'];
export const catIndex = (k: OutlineCat) => OUTLINE_CATS.findIndex((c) => c.key === k);

/** Which scene groups are which (the nearest named ancestor wins). */
const GROUPS: Record<string, OutlineCat> = {
  terrain: 'ground', tufts: 'plants', trees: 'plants', bushes: 'plants',
  village: 'built', site: 'built', plots: 'built', camp: 'built', fields: 'built', gathering: 'built', placement: 'built',
  ruins: 'old', oldworld: 'old', heaps: 'old',
  people: 'people', herds: 'people',
  folk: 'folk', townhouse: 'folk', mycelium: 'folk', clearing: 'folk',
};
const PLANT_SEASONS = new Set(['broadleaf', 'conifer', 'grass']);

/** Say what a material is, for outlines (glass panes, crops). */
export function tagOutline<T extends THREE.Material>(mat: T, cat: OutlineCat): T {
  mat.userData.ocat = catIndex(cat);
  return mat;
}

function categoryOf(obj: THREE.Object3D, mat: THREE.Material): number {
  if (mat.userData.ocat !== undefined) return mat.userData.ocat;
  const season = mat.userData.enhance?.season;
  if (season && PLANT_SEASONS.has(season)) return catIndex('plants');
  let k = obj.userData.ocat as number | undefined;
  if (k === undefined) {
    k = 0;
    for (let o: THREE.Object3D | null = obj; o; o = o.parent) {
      const g = GROUPS[o.name];
      if (g) { k = catIndex(g); break; }
    }
    obj.userData.ocat = k;
  }
  return k;
}

const GLASS = catIndex('glass');
const GROUND = catIndex('ground');
let installed = false;

/** Make every draw mark its category in the stencil buffer (once; harmless where there is no stencil). */
export function installOutlineCategories() {
  if (installed) return;
  installed = true;
  THREE.Object3D.prototype.onBeforeRender = function (_r, _s, _c, _g, material: THREE.Material) {
    if (!material || material.userData.noOutlineCat) return;
    const k = categoryOf(this, material);
    // See-through things keep the category of what's behind them; glass marks itself.
    if (material.transparent && k !== GLASS) { material.stencilWrite = false; return; }
    material.stencilWrite = true;
    material.stencilRef = k;
    material.stencilFunc = THREE.AlwaysStencilFunc;
    material.stencilZPass = THREE.ReplaceStencilOp;
    material.stencilFail = THREE.KeepStencilOp;
    material.stencilZFail = THREE.KeepStencilOp;
    material.stencilWriteMask = 0xff;
  };
}

/**
 * Turns the stencil's categories into a mask texture the outline shader can
 * read (red: lines allowed; green: ground, which yields the line along an
 * object's foot to that object, so a house keeps its whole outline with the
 * ground's lines off): one full-screen quad per category that is switched on, tested
 * against the stencil of the frame just drawn (whose depth-stencil texture
 * this target shares; it is never sampled here, so there is no feedback loop).
 */
export class OutlineMask {
  target: THREE.WebGLRenderTarget | null = null;
  private quad: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private clear = new THREE.Color();
  /** Which categories get lines, by index. */
  on: boolean[] = OUTLINE_CATS.map(() => true);
  constructor() {
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false });
    m.userData.noOutlineCat = true;
    m.stencilWrite = true; // enables the stencil test in three.js
    m.stencilWriteMask = 0;
    m.stencilFunc = THREE.EqualStencilFunc;
    m.stencilFail = m.stencilZFail = m.stencilZPass = THREE.KeepStencilOp;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
    this.quad.frustumCulled = false;
  }
  get all() { return this.on.every(Boolean); }
  /** Draw the mask for the frame in `from` (its depth-stencil texture is borrowed, never sampled). */
  render(renderer: THREE.WebGLRenderer, from: THREE.WebGLRenderTarget): THREE.Texture {
    let t = this.target;
    if (!t || t.depthTexture !== from.depthTexture || t.width !== from.width || t.height !== from.height) {
      // A new framebuffer around the borrowed attachment; the old one gives it back first (disposing would free it).
      if (t) { t.depthTexture = null; t.dispose(); }
      t = this.target = new THREE.WebGLRenderTarget(from.width, from.height, { depthBuffer: true, stencilBuffer: true });
      t.depthTexture = from.depthTexture;
    }
    const auto = renderer.autoClear, alpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clear);
    renderer.autoClear = false;
    renderer.setRenderTarget(t);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    // Red: this kind gets lines. Green: this is the ground, which gives its line at an object's foot to the object.
    for (let k = 0; k < this.on.length; k++) {
      if (!this.on[k] && k !== GROUND) continue;
      this.quad.material.stencilRef = k;
      this.quad.material.color.setRGB(this.on[k] ? 1 : 0, k === GROUND ? 1 : 0, 0);
      renderer.render(this.quad, this.cam);
    }
    renderer.setClearColor(this.clear, alpha);
    renderer.autoClear = auto;
    return t.texture;
  }
}
