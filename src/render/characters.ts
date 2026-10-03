/**
 * Survivor character models: Quaternius's CC0 "Ultimate Modular Men /
 * Women" (https://quaternius.com), trimmed and compressed by
 * scripts/characters.mjs. Every outfit shares one skeleton and one set of
 * animation clips.
 *
 * Each outfit's parts are merged into a single skinned mesh (one draw per
 * render pass). Every vertex carries a colour slot (skin, hair, a piece of
 * clothing), so each survivor gets their own skin tone, hair and muted
 * clothing colours from the same few meshes.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const URLS = import.meta.glob('../assets/people/*.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
/** Parts libraries by build (lab/workshop/build.py --parts): every part a skinned mesh on one skeleton. */
const PART_URLS = import.meta.glob('../assets/people/parts/*.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export interface Outfit {
  name: string;
  female: boolean;
  /** A child's build (DESIGN §24.14): drawn at its true size, not scaled up to an adult's height. */
  child: boolean;
  /** Root holding the bones and one merged SkinnedMesh, in bind pose. */
  template: THREE.Object3D;
  slots: string[];
  colors: [number, number, number][];
  /** Bind-pose height, for scaling to our world. */
  height: number;
}

export interface CharacterKit {
  outfits: Outfit[];
  clips: Map<string, THREE.AnimationClip>;
}

/**
 * Load a .glb. The single-file build inlines models as data: URLs; decode
 * those directly rather than fetch them (a page's security policy may not
 * allow fetching data: URLs).
 */
async function loadGlb(loader: GLTFLoader, url: string) {
  if (!url.startsWith('data:')) return loader.loadAsync(url);
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return loader.parseAsync(buf.buffer, '');
}

function mergeOutfit(scene: THREE.Object3D): THREE.SkinnedMesh | null {
  const parts: THREE.SkinnedMesh[] = [];
  scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) parts.push(o as THREE.SkinnedMesh); });
  if (!parts.length) return null;
  const skeleton = parts[0].skeleton;
  const geos = parts.map((p) => {
    const g = new THREE.BufferGeometry();
    const src = p.geometry;
    g.setIndex(src.index);
    // Positions as plain floats; skin indices remapped onto the shared skeleton.
    g.setAttribute('position', src.attributes.position);
    const map = p.skeleton.bones.map((b) => skeleton.bones.indexOf(b));
    const si = src.attributes.skinIndex, n = si.count;
    const idx = new Uint16Array(n * 4);
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) idx[i * 4 + k] = Math.max(0, map[si.getComponent(i, k)]);
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    const sw = src.attributes.skinWeight;
    const w = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) w[i * 4 + k] = sw.getComponent(i, k);
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
    const slot = src.attributes._slot;
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) s[i] = slot ? slot.getX(i) : 0;
    g.setAttribute('slot', new THREE.Float32BufferAttribute(s, 1));
    // Brightness over the slot colour, per vertex (studio figures: the source image's light and dark).
    const sh = src.attributes._shade;
    const d = new Float32Array(n).fill(1);
    if (sh) for (let i = 0; i < n; i++) d[i] = sh.getX(i);
    g.setAttribute('shade', new THREE.Float32BufferAttribute(d, 1));
    return g;
  });
  const merged = mergeGeometries(geos, false);
  if (!merged) return null;
  // No normals ship (flat shading doesn't need them); the soft look does.
  merged.computeVertexNormals();
  const mesh = new THREE.SkinnedMesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.bind(skeleton, parts[0].bindMatrix);
  parts[0].parent!.add(mesh);
  for (const p of parts) p.parent?.remove(p);
  return mesh;
}

export async function loadCharacters(): Promise<CharacterKit> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const outfits: Outfit[] = [];
  let clips = new Map<string, THREE.AnimationClip>();
  await Promise.all(Object.entries(URLS).map(async ([path, url]) => {
    const name = path.split('/').pop()!.replace('.glb', '');
    const gltf = await loadGlb(loader, url);
    if (name === 'anims') {
      clips = new Map(gltf.animations.map((c) => [c.name, c]));
      return;
    }
    const mesh = mergeOutfit(gltf.scene);
    if (!mesh) return;
    const extras = (gltf.scene.userData ?? {}) as { slots?: string[]; colors?: [number, number, number][] };
    gltf.scene.updateMatrixWorld(true);
    mesh.skeleton.pose();
    const box = new THREE.Box3().setFromObject(gltf.scene, true);
    outfits.push({
      name, female: name.startsWith('woman'), child: name.startsWith('child'), template: gltf.scene,
      slots: extras.slots ?? [], colors: extras.colors ?? [], height: box.max.y - box.min.y || 1,
    });
  }));
  outfits.sort((a, b) => a.name.localeCompare(b.name));
  // Children are scaled by the adults' height, so they stay child-sized.
  const adults = outfits.filter((o) => !o.child);
  const adultH = adults.reduce((n, o) => n + o.height, 0) / Math.max(1, adults.length);
  for (const o of outfits) if (o.child && adults.length) o.height = adultH;
  return { outfits, clips };
}

// ---------- composed from parts (DESIGN: lab/workshop) ----------

export interface PartsKit {
  /** Library scene by build ('hero', 'stout'); never modified, cloned per outfit. */
  libs: Map<string, THREE.Object3D>;
  /** Composed outfits by Dress.key: survivors dressed alike share geometry. */
  cache: Map<string, Outfit>;
  /** Figure height per build (body and head, without hair), so hairstyles don't change anyone's size. */
  heights: Map<string, number>;
}

/** glTF node names lose '.', '[', ']', ':' and '/' in three.js (PropertyBinding.sanitizeNodeName). */
const nodeName = (n: string) => n.replace(/\s/g, '_').replace(/[[\].:/]/g, '');

export async function loadParts(): Promise<PartsKit | null> {
  const entries = Object.entries(PART_URLS);
  if (!entries.length) return null;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const kit: PartsKit = { libs: new Map(), cache: new Map(), heights: new Map() };
  await Promise.all(entries.map(async ([path, url]) => {
    const build = path.split('/').pop()!.replace(/^parts_|\.glb$/g, '');
    kit.libs.set(build, (await loadGlb(loader, url)).scene);
  }));
  return kit;
}

/** One library scene with only these parts, merged into one skinned mesh. */
function composeScene(lib: THREE.Object3D, parts: string[]): { root: THREE.Object3D; mesh: THREE.SkinnedMesh } | null {
  const root = cloneSkinned(lib);
  root.userData = lib.userData;
  const keep = new Set(parts.map(nodeName));
  // Each part is a node (a mesh, or a group with one mesh per colour slot) beside the armature.
  const drop: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone || !o.parent || o === root) return;
    if (((o as THREE.SkinnedMesh).isSkinnedMesh || o.type === 'Group') && !keep.has(o.name) && !keep.has(o.parent.name)) drop.push(o);
  });
  for (const o of drop) o.removeFromParent();
  const mesh = mergeOutfit(root);
  return mesh ? { root, mesh } : null;
}

export function composeOutfit(kit: PartsKit, build: string, parts: string[], key: string): Outfit | null {
  const hit = kit.cache.get(key);
  if (hit) return hit;
  const lib = kit.libs.get(build) ?? kit.libs.get('hero');
  if (!lib) return null;
  if (!kit.heights.has(build)) {
    const base = composeScene(lib, ['body.base', 'head.face']);
    if (base) { base.root.updateMatrixWorld(true); base.mesh.skeleton.pose(); const b = new THREE.Box3().setFromObject(base.root, true); kit.heights.set(build, b.max.y - b.min.y || 1.6); }
  }
  const c = composeScene(lib, parts);
  if (!c) return null;
  c.root.updateMatrixWorld(true);
  c.mesh.skeleton.pose();
  const extras = (lib.userData ?? {}) as { slots?: string[]; colors?: [number, number, number][] };
  const outfit: Outfit = { name: key, female: false, child: false, template: c.root, slots: extras.slots ?? [], colors: extras.colors ?? [], height: kit.heights.get(build) ?? 1.6 };
  kit.cache.set(key, outfit);
  return outfit;
}

// ---------- one survivor ----------

const SKIN = ['#e8c0a0', '#d0a07a', '#a8764f', '#7d5537', '#5c3b26', '#f0d0b4'];
const BLUSH = new THREE.Color('#c85048');
const HAIR = ['#2a1d14', '#5a3b22', '#8a8070', '#1a1a1a', '#a0522d', '#c8b080', '#d8d4cc'];

/** A muted, post-collapse take on a piece of clothing: same lightness, new hue. */
function clothing(base: [number, number, number], hue: number, k: number, out: THREE.Color) {
  const c = new THREE.Color().setRGB(base[0], base[1], base[2], THREE.LinearSRGBColorSpace);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl, THREE.SRGBColorSpace);
  if (hsl.s < 0.12) return out.copy(c); // greys, blacks, whites stay
  return out.setHSL((hue + k * 0.13) % 1, Math.min(0.42, hsl.s * 0.6), hsl.l, THREE.SRGBColorSpace);
}

export interface Character {
  root: THREE.Object3D;
  mesh: THREE.SkinnedMesh;
  bone: (name: string) => THREE.Bone | undefined;
  mixer: THREE.AnimationMixer;
  scale: number;
}

/**
 * The clips (anims.glb) key every joint's offset (and a scale) as on the adult build they were made on.
 * Played as they are, they pull any other build's bones to adult lengths: the hero build's legs grow by
 * about half while walking. So each skeleton gets its own copy of a clip: joint offsets and scales are
 * dropped (every bone keeps its own length), and the hips' motion (bob, sway) is kept, scaled to this
 * body's hip height. The reference is the Idle clip's first hip position (standing at rest).
 */
const fittedClips = new Map<string, THREE.AnimationClip>();
let clipHipRef: THREE.Vector3 | null = null;
export function fitClip(clip: THREE.AnimationClip, ch: Character, all?: Map<string, THREE.AnimationClip>): THREE.AnimationClip {
  const sk = ch.mesh.skeleton;
  const hipB = sk.bones.find((b) => b.name === 'Hips');
  if (!hipB) return clip;
  // Rest offsets, recorded the first time (before any clip has moved the bones; templates are never animated).
  const rest = (b: THREE.Bone) => (b.userData.rest ??= b.position.clone()) as THREE.Vector3;
  const hip = rest(hipB);
  const key = clip.uuid + '|' + sk.bones.map((b) => rest(b).toArray().map((v) => v.toFixed(3)).join(',')).join(';');
  const done = fittedClips.get(key);
  if (done) return done;
  const hipTrack = (c: THREE.AnimationClip | undefined) => c?.tracks.find((t) => t.name === 'Hips.position');
  if (!clipHipRef) {
    const t = hipTrack(all?.get('Idle')) ?? hipTrack(clip);
    clipHipRef = t ? new THREE.Vector3().fromArray(t.values, 0) : hip.clone();
  }
  const k = hip.length() / Math.max(1e-6, clipHipRef.length());
  const tracks: THREE.KeyframeTrack[] = [];
  for (const t of clip.tracks) {
    if (t.name.endsWith('.scale')) continue;
    if (t.name.endsWith('.position')) {
      if (t.name !== 'Hips.position') continue;
      const v = t.values.slice();
      for (let j = 0; j < v.length; j += 3)
        for (let a = 0; a < 3; a++) v[j + a] = hip.getComponent(a) + (v[j + a] - clipHipRef.getComponent(a)) * k;
      tracks.push(new THREE.VectorKeyframeTrack(t.name, Array.from(t.times), Array.from(v)));
      continue;
    }
    tracks.push(t);
  }
  const out = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  fittedClips.set(key, out);
  return out;
}

/** A survivor's own copy of an outfit: own skeleton, own colours. */
export function makeCharacter(outfit: Outfit, seed: { skin: number; hair: number; hue: number; tall: number }, material: THREE.Material): Character {
  const root = cloneSkinned(outfit.template);
  let mesh!: THREE.SkinnedMesh;
  root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh; });
  // Own colour attribute; everything else shared with the template.
  const src = mesh.geometry;
  const geo = new THREE.BufferGeometry();
  geo.setIndex(src.index);
  for (const k of ['position', 'normal', 'skinIndex', 'skinWeight']) geo.setAttribute(k, src.attributes[k]);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, outfit.height / 2, 0), outfit.height);
  const slot = src.attributes.slot, n = slot.count;
  const pal = outfit.slots.map((name, i) => {
    const base = outfit.colors[i] ?? [0.5, 0.5, 0.5];
    const c = new THREE.Color();
    if (/^skin/i.test(name)) {
      c.set(SKIN[seed.skin % SKIN.length]);
      // Face details from the workshop's heads (lab/workshop/faces.py), derived from the skin.
      if (/^skin_blush/i.test(name)) c.lerp(BLUSH, 0.3);
      else if (/^skin_lip/i.test(name)) c.lerp(BLUSH, 0.35).multiplyScalar(0.82);
      else if (/^skin_shade/i.test(name)) c.multiplyScalar(0.72);
    }
    else if (/hair|eyebrow|moustache|beard/i.test(name)) c.set(HAIR[seed.hair % HAIR.length]);
    else if (/^eye$/i.test(name) || /boot|strap|pack|roll|hat/i.test(name)) c.setRGB(base[0], base[1], base[2], THREE.LinearSRGBColorSpace);
    else clothing(base, seed.hue, i, c);
    return c;
  });
  const col = new Float32Array(n * 3);
  const shade = src.attributes.shade;
  for (let i = 0; i < n; i++) {
    const c = pal[Math.round(slot.getX(i))] ?? pal[0];
    const k = shade ? shade.getX(i) : 1;
    col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  mesh.geometry = geo;
  mesh.material = material;
  mesh.frustumCulled = false;
  const scale = (1.7 * seed.tall) / outfit.height;
  root.scale.setScalar(scale);
  const bones = new Map<string, THREE.Bone>();
  // The loader strips '.' from node names (UpperLeg.L → UpperLegL); accept either.
  root.traverse((o) => { if ((o as THREE.Bone).isBone) bones.set(o.name.replace(/\./g, ''), o as THREE.Bone); });
  return { root, mesh, bone: (name) => bones.get(name.replace(/\./g, '')), mixer: new THREE.AnimationMixer(root), scale };
}

// ---------- wild animals ----------

const ANIMAL_URLS = import.meta.glob('../assets/animals/*.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export interface AnimalKind {
  template: THREE.Object3D;
  clips: Map<string, THREE.AnimationClip>;
  height: number;
  /** Rotation that turns the model to face +x (the game's animals walk along +x). */
  turn: number;
}

/** Deer and stags (Quaternius "Ultimate Animated Animal Pack", CC0), in their own colours. */
export async function loadAnimals(): Promise<Map<string, AnimalKind>> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const out = new Map<string, AnimalKind>();
  await Promise.all(Object.entries(ANIMAL_URLS).map(async ([path, url]) => {
    const name = path.split('/').pop()!.replace('.glb', '');
    const gltf = await loadGlb(loader, url);
    const mesh = mergeOutfit(gltf.scene);
    if (!mesh) return;
    const extras = (gltf.scene.userData ?? {}) as { colors?: [number, number, number][] };
    const cols = (extras.colors ?? []).map((c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace));
    const slot = mesh.geometry.attributes.slot, n = slot.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const c = cols[Math.round(slot.getX(i))] ?? new THREE.Color(0.5, 0.4, 0.3);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene, true);
    const size = box.getSize(new THREE.Vector3());
    // Longest horizontal axis is nose-to-tail; glTF models face +z.
    const turn = size.z >= size.x ? Math.PI / 2 : 0;
    out.set(name, { template: gltf.scene, clips: new Map(gltf.animations.map((c) => [c.name, c])), height: size.y || 1, turn });
  }));
  return out;
}

export interface AnimalBody { root: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; clip: string }

export function makeAnimal(kind: AnimalKind, height: number, material: THREE.Material): AnimalBody {
  const inner = cloneSkinned(kind.template);
  inner.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    m.material = material;
    m.castShadow = true;
    m.frustumCulled = false;
  });
  inner.scale.setScalar(height / kind.height);
  inner.rotation.y = kind.turn;
  const root = new THREE.Group();
  root.add(inner);
  const mixer = new THREE.AnimationMixer(inner);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const [n, c] of kind.clips) actions.set(n, mixer.clipAction(c));
  return { root, mixer, actions, clip: '' };
}

export function playAnimal(b: AnimalBody, name: string, fade = 0.3) {
  if (b.clip === name) return;
  const next = b.actions.get(name) ?? b.actions.get('Idle');
  if (!next) return;
  const prev = b.actions.get(b.clip);
  next.reset().play();
  if (prev) prev.crossFadeTo(next, fade, false);
  b.clip = name;
}
