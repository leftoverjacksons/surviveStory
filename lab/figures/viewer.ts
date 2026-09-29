/**
 * Figure lab viewer (not part of the game). Shows candidate figures from
 * lab/figures/out/ beside the game's current figures, each through the game's
 * own makeCharacter (recolouring, height) and the game's clips (anims.glb),
 * under the game's camera: orthographic, pitch atan(1/√2), 30 world units
 * tall at zoom 1, and optionally drawn at 1/3 resolution like the pixel look.
 *
 *   npx vite  →  http://localhost:5173/lab/figures/
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeCharacter, type Outfit } from '../../src/render/characters';

const GAME = import.meta.glob('../../src/assets/people/*.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const LAB = import.meta.glob('./out/*.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const SHOW_GAME = ['man_walker', 'woman_forager', 'child_mender'];

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
const scene = new THREE.Scene();
scene.background = new THREE.Color('#8fa87a');
scene.add(new THREE.HemisphereLight('#fff4dc', '#5a6a40', 1.1));
const sun = new THREE.DirectionalLight('#ffe2b0', 2.2);
sun.position.set(-6, 10, 4);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ color: '#7d9560' }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const VIEW = 30, PITCH = Math.atan(1 / Math.SQRT2);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
let yaw = Math.PI / 4;
const ui = {
  clip: document.getElementById('clip') as HTMLSelectElement,
  zoom: document.getElementById('zoom') as HTMLInputElement,
  zv: document.getElementById('zv')!,
  pixel: document.getElementById('pixel') as HTMLInputElement,
  spin: document.getElementById('spin') as HTMLInputElement,
};

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

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
async function outfit(name: string, url: string): Promise<Outfit | null> {
  const gltf = await loader.loadAsync(url);
  if (!merge(gltf.scene)) return null;
  const extras = (gltf.scene.userData ?? {}) as { slots?: string[]; colors?: [number, number, number][] };
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene, true);
  return { name, female: false, child: name.startsWith('child'), template: gltf.scene, slots: extras.slots ?? [], colors: extras.colors ?? [], height: box.max.y - box.min.y || 1 };
}

const byName = (g: Record<string, string>) => Object.entries(g).map(([p, u]) => [p.split('/').pop()!.replace('.glb', ''), u] as const);
const anims = await loader.loadAsync(byName(GAME).find(([n]) => n === 'anims')![1]);
const clips = new Map(anims.animations.map((c) => [c.name, c]));
for (const n of clips.keys()) ui.clip.add(new Option(n, n, n === 'Walk', n === 'Walk'));

const entries = [...byName(GAME).filter(([n]) => SHOW_GAME.includes(n)), ...byName(LAB)];
const outfits = (await Promise.all(entries.map(([n, u]) => outfit(n, u)))).filter((o): o is Outfit => !!o);
const adultH = outfits.filter((o) => SHOW_GAME.includes(o.name) && !o.child).map((o) => o.height)[0] ?? 1.7;
for (const o of outfits) if (o.child) o.height = adultH;
// ?raw: keep a generated figure's own colours (its clothing slots are not re-hued).
const RAW = new URLSearchParams(location.search).has('raw');
if (RAW) for (const o of outfits) if (!SHOW_GAME.includes(o.name)) o.slots = o.slots.map((s) => (/^cloth/.test(s) ? `pack_${s}` : s));
const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
const chars = outfits.map((o, i) => {
  const c = makeCharacter(o, { skin: i, hair: i + 2, hue: 0.08 + i * 0.21, tall: o.child ? 0.74 : 1 }, mat);
  c.root.position.x = (i - (outfits.length - 1) / 2) * 1.1;
  c.root.traverse((m) => { m.castShadow = true; });
  scene.add(c.root);
  return c;
});
function play() {
  const clip = clips.get(ui.clip.value);
  for (const c of chars) { c.mixer.stopAllAction(); if (clip) c.mixer.clipAction(clip).play(); }
}
ui.clip.onchange = play;
play();
console.log('figures:', outfits.map((o) => `${o.name} (${o.slots.join(', ')})`).join('; '));

function resize() {
  canvas.classList.toggle('pixel', ui.pixel.checked);
  renderer.setPixelRatio(ui.pixel.checked ? 1 / 3 : Math.min(2, devicePixelRatio));
  renderer.setSize(innerWidth, innerHeight, false);
  const a = innerWidth / innerHeight, h = VIEW / 2;
  Object.assign(cam, { left: -h * a, right: h * a, top: h, bottom: -h });
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
ui.pixel.onchange = resize;
resize();

const look = new THREE.Vector3(0, 0.9, 0);
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (ui.spin.checked) yaw += dt * 0.4;
  const z = Number(ui.zoom.value);
  ui.zv.textContent = z.toFixed(2);
  const d = 80, horiz = Math.cos(PITCH) * d;
  cam.position.set(look.x + Math.sin(yaw) * horiz, look.y + Math.sin(PITCH) * d, look.z + Math.cos(yaw) * horiz);
  cam.lookAt(look);
  if (cam.zoom !== z) { cam.zoom = z; cam.updateProjectionMatrix(); }
  for (const c of chars) c.mixer.update(dt);
  renderer.render(scene, cam);
});
/** Centre the camera on figure i (debug and screenshots). */
const focus = (i: number) => look.set(chars[i].root.position.x, 0.9, 0);
Object.assign(window, { __lab: { chars, outfits, cam, look, focus, mixers: chars.map((c) => c.mixer) } });
