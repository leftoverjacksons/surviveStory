/**
 * The studio's 3D view. Figures (the game's and the studio's) go through the
 * game's own makeCharacter (recolouring, height) and play the game's clips
 * (anims.glb), under the game's camera: orthographic, pitch atan(1/√2), 30
 * world units tall at zoom 1; optionally drawn at 1/3 resolution like the
 * game's pixel look.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeCharacter, type Character, type Outfit } from '../../src/render/characters';

const GAME = import.meta.glob('../../src/assets/people/*.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const gameUrl = (n: string) => Object.entries(GAME).find(([p]) => p.endsWith(`/${n}.glb`))?.[1];
/** Current figures shown for comparison. */
export const REFS = ['man_walker', 'woman_forager', 'child_mender'];

/** Same as the game's mergeOutfit: one skinned mesh per outfit with a slot attribute. */
function merge(root: THREE.Object3D): THREE.SkinnedMesh | null {
  const parts: THREE.SkinnedMesh[] = [];
  root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) parts.push(o as THREE.SkinnedMesh); });
  if (!parts.length) return null;
  const skeleton = parts[0].skeleton;
  const geos = parts.map((p) => {
    const g = new THREE.BufferGeometry(), src = p.geometry;
    g.setIndex(src.index);
    g.setAttribute('position', src.attributes.position);
    const map = p.skeleton.bones.map((b) => skeleton.bones.indexOf(b));
    const si = src.attributes.skinIndex, sw = src.attributes.skinWeight, n = si.count;
    const idx = new Uint16Array(n * 4), w = new Float32Array(n * 4), s = new Float32Array(n);
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { idx[i * 4 + k] = Math.max(0, map[si.getComponent(i, k)]); w[i * 4 + k] = sw.getComponent(i, k); }
    const slot = src.attributes._slot;
    for (let i = 0; i < n; i++) s[i] = slot ? slot.getX(i) : 0;
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
    g.setAttribute('slot', new THREE.Float32BufferAttribute(s, 1));
    return g;
  });
  const merged = mergeGeometries(geos, false);
  if (!merged) return null;
  merged.computeVertexNormals();
  const mesh = new THREE.SkinnedMesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.bind(skeleton, parts[0].bindMatrix);
  parts[0].parent!.add(mesh);
  for (const p of parts) p.parent?.remove(p);
  return mesh;
}

export interface StageFigure { name: string; url: string; child?: boolean; ref?: boolean }

export class Stage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  look = new THREE.Vector3(0, 0.9, 0);
  chars: Character[] = [];
  opts = { zoom: 4, pixel: false, raw: true, spin: false, clip: 'Walk' };
  clips = new Map<string, THREE.AnimationClip>();
  private loader = new GLTFLoader();
  private yaw = Math.PI / 4;
  private group = new THREE.Group();
  private mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  private adultH = 1.7;
  private token = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.scene.background = new THREE.Color('#8fa87a');
    this.scene.add(new THREE.HemisphereLight('#fff4dc', '#5a6a40', 1.1));
    const sun = new THREE.DirectionalLight('#ffe2b0', 2.2);
    sun.position.set(-6, 10, 4);
    this.scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ color: '#7d9560' }));
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground, this.group);
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!);
    const t = new THREE.Timer();
    this.renderer.setAnimationLoop(() => { t.update(); this.frame(t.getDelta()); });
  }

  async init() {
    const anims = await this.loader.loadAsync(gameUrl('anims')!);
    this.clips = new Map(anims.animations.map((c) => [c.name, c]));
    const box = new THREE.Box3();
    const ref = await this.loader.loadAsync(gameUrl(REFS[0])!);
    merge(ref.scene); ref.scene.updateMatrixWorld(true);
    box.setFromObject(ref.scene, true);
    this.adultH = box.max.y - box.min.y || 1.7;
  }

  static ref(name: string): StageFigure { return { name, url: gameUrl(name)!, child: name.startsWith('child'), ref: true }; }

  private async outfit(f: StageFigure): Promise<Outfit | null> {
    const gltf = await this.loader.loadAsync(f.url);
    if (!merge(gltf.scene)) return null;
    const ex = (gltf.scene.userData ?? {}) as { slots?: string[]; colors?: [number, number, number][] };
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene, true);
    let slots = ex.slots ?? [];
    // "Own colours": a generated figure's clothing keeps its colours (named like a pack, which the game never re-hues).
    if (this.opts.raw && !f.ref) slots = slots.map((s) => (/^cloth/.test(s) ? `pack_${s}` : s));
    const child = !!f.child;
    return { name: f.name, female: false, child, template: gltf.scene, slots, colors: ex.colors ?? [], height: child ? this.adultH : box.max.y - box.min.y || 1 };
  }

  /** Show these figures in a row, replacing whatever was shown. */
  async show(figs: StageFigure[]) {
    const token = ++this.token;
    const outfits = await Promise.all(figs.map((f) => this.outfit(f).catch((e) => { console.warn(f.name, e); return null; })));
    if (token !== this.token) return;
    this.group.clear();
    this.chars = [];
    const shown = outfits.filter((o): o is Outfit => !!o);
    shown.forEach((o, i) => {
      const c = makeCharacter(o, { skin: i, hair: i + 2, hue: 0.08 + i * 0.21, tall: o.child ? 0.74 : 1 }, this.mat);
      c.root.position.x = (i - (shown.length - 1) / 2) * 1.1;
      this.group.add(c.root);
      this.chars.push(c);
    });
    this.play();
    // Look at the last figure (the newest) when showing one against the references.
    this.look.set(this.chars.length ? this.chars[this.chars.length - 1].root.position.x * (shown.length > 1 ? 0.5 : 1) : 0, 0.9, 0);
  }

  play() {
    const clip = this.clips.get(this.opts.clip);
    for (const c of this.chars) { c.mixer.stopAllAction(); if (clip) c.mixer.clipAction(clip).play(); }
  }

  resize() {
    const el = this.canvas.parentElement!;
    const w = el.clientWidth, h = el.clientHeight;
    this.canvas.classList.toggle('pixel', this.opts.pixel);
    this.renderer.setPixelRatio(this.opts.pixel ? 1 / 3 : Math.min(2, devicePixelRatio));
    this.renderer.setSize(w, h, false);
    const a = w / Math.max(1, h), half = 15;
    Object.assign(this.cam, { left: -half * a, right: half * a, top: half, bottom: -half });
    this.cam.updateProjectionMatrix();
  }

  private frame(dt: number) {
    if (this.opts.spin) this.yaw += dt * 0.4;
    const d = 80, horiz = Math.cos(Math.atan(1 / Math.SQRT2)) * d;
    this.cam.position.set(this.look.x + Math.sin(this.yaw) * horiz, this.look.y + Math.sin(Math.atan(1 / Math.SQRT2)) * d, this.look.z + Math.cos(this.yaw) * horiz);
    this.cam.lookAt(this.look);
    if (this.cam.zoom !== this.opts.zoom) { this.cam.zoom = this.opts.zoom; this.cam.updateProjectionMatrix(); }
    for (const c of this.chars) c.mixer.update(dt);
    this.renderer.render(this.scene, this.cam);
  }
}
