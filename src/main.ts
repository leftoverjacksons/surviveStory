import * as THREE from 'three';
import { createColony, hourOf, syncAgents, tick } from './sim/colony';
import { createCommunity, killSurvivor, recruit, setRole } from './sim/community';
import { CAMP } from './sim/layout';
import { generateWorld } from './sim/worldgen';
import { heightAt } from './sim/world';
import { IsoCamera, Sky, createComposer, createRenderer } from './render/stage';
import { FogTexture, buildTerrain } from './render/terrain';
import { buildStation, buildVines } from './render/station';
import { TreeField } from './render/trees';
import { Bushes, Herds, buildFairyRing, buildRuins } from './render/nature';
import { Fireflies, Orb, Wisps } from './render/mystic';
import { People } from './render/people';
import { Camp } from './render/camp';
import { worldUniforms } from './render/util';
import { Hud } from './ui/hud';

// ---------- simulation ----------
const seed = Date.now() % 100000;
const world = generateWorld(seed);
const community = createCommunity(seed);
const colony = createColony(world, community);

/** Game minutes per real second at each speed setting. */
const SPEEDS = [0, 2, 6, 16]; // labelled 1×, 3×, 8×
let speed = 1;

// ---------- scene ----------
const view = document.getElementById('view')!;
const renderer = createRenderer(view);
const scene = new THREE.Scene();
const iso = new IsoCamera(view.clientWidth / view.clientHeight);
iso.bounds = world.w / 2 - 8;
const sky = new Sky(scene);
const { composer, bloom } = createComposer(renderer, scene, iso.camera, view.clientWidth, view.clientHeight);

const fog = new FogTexture(world);
worldUniforms.uFogTex.value = fog.texture;
worldUniforms.uFogSize.value = world.w;

scene.add(buildTerrain(world));
const station = buildStation();
scene.add(station.group);
scene.add(buildVines(station.surfaces, station.edges));
const trees = new TreeField(world);
scene.add(trees.group);
const bushes = new Bushes(world);
scene.add(bushes.group);
scene.add(buildRuins(world));

const mushroomGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#b9fff0'), toneMapped: false });
scene.add(buildFairyRing(world, mushroomGlow));
const herds = new Herds(world);
scene.add(herds.group);

const ring = new THREE.Vector3(world.fairyRing.x, 0, world.fairyRing.z);
const wisps = new Wisps(world, [
  ring, ring.clone().add(new THREE.Vector3(3, 0, 2)),
  new THREE.Vector3(-4, 0.8, 2),
  new THREE.Vector3(CAMP.x - 2, 0.6, CAMP.z - 3),
  new THREE.Vector3(18, 0, -14),
  new THREE.Vector3(-20, 0, 8),
  new THREE.Vector3(8, 0, 22),
]);
scene.add(wisps.group);
const fireflies = new Fireflies(world);
scene.add(fireflies.points);
const orb = new Orb();
scene.add(orb.group);

const camp = new Camp(world);
scene.add(camp.group);
const people = new People(world);
scene.add(people.group);

function syncScene() {
  syncAgents(colony);
  people.sync(community.survivors, colony.agents);
  camp.sync(community, colony.items);
}
syncScene();

// ---------- HUD ----------
let following = false;
const hud = new Hud(colony, {
  onKill(id) {
    const reports = killSurvivor(community, id, 'lost beyond the treeline');
    const worst = reports.sort((a, b) => b.moraleLoss - a.moraleLoss).slice(0, 3);
    if (worst.length) {
      const names = worst.map((r) => {
        const s = community.survivors.find((x) => x.id === r.survivorId)!;
        return `${s.name.split(' ')[0]} −${Math.round(r.moraleLoss)}`;
      });
      community.log.push({ day: community.day, text: `Morale hit: ${names.join(', ')}.`, tone: 'bad' });
    }
    if (people.selected === id) select(0);
    syncScene();
    hud.render();
  },
  onRecruit() {
    recruit(community);
    syncScene();
    hud.render();
  },
  onRole(id, role) {
    setRole(community, id, role);
    const a = colony.agents.find((x) => x.id === id);
    if (a && !a.carry) a.task = null; // re-plan with the new role
    hud.render();
  },
  onRotate(dir) { iso.snap(dir); },
  onSpeed(level) { setSpeed(level); },
  onSelect(id) { select(id); },
  onFollow() { setFollow(!following); },
});

function setSpeed(level: number) {
  speed = level;
  hud.setSpeed(level);
}
function select(id: number) {
  people.selected = id;
  hud.select(id);
  if (!id) setFollow(false);
}
function setFollow(on: boolean) {
  following = on && people.selected !== 0;
  hud.setFollowing(following);
}
hud.render();

// ---------- input ----------
const canvas = renderer.domElement;
const pointers = new Map<number, { x: number; y: number; button: number; sx: number; sy: number }>();
let pinchDist = 0, pinchAngle = 0;
const raycaster = new THREE.Raycaster();

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, sx: e.clientX, sy: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    pinchAngle = Math.atan2(b.y - a.y, b.x - a.x);
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (pointers.size === 1) {
    const worldPerPx = (iso.camera.top - iso.camera.bottom) / canvas.clientHeight;
    if (p.button === 2 || e.ctrlKey || e.altKey) iso.rotateBy(-dx * 0.008);
    else {
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 6) setFollow(false);
      iso.pan(-dx * worldPerPx, (dy * worldPerPx) / Math.sin(Math.atan(1 / Math.SQRT2)));
    }
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    if (pinchDist > 0) iso.zoomBy(d / pinchDist);
    let dAng = ang - pinchAngle;
    dAng = Math.atan2(Math.sin(dAng), Math.cos(dAng));
    iso.rotateBy(-dAng);
    pinchDist = d;
    pinchAngle = ang;
  }
});
canvas.addEventListener('pointerup', (e) => {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  pinchDist = 0;
  if (!p || p.button !== 0 || Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) return;
  // A click: try to select a survivor.
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, iso.camera);
  const hit = raycaster.intersectObjects(people.pickables(), true)[0];
  let o: THREE.Object3D | null = hit?.object ?? null;
  while (o && o.userData.survivorId === undefined) o = o.parent;
  select(o ? (o.userData.survivorId as number) : 0);
});
canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); pinchDist = 0; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  iso.zoomBy(Math.exp(-e.deltaY * 0.0012));
}, { passive: false });

const keys = new Set<string>();
let lastSpeed = 1;
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('select, input, button, summary')) return;
  const k = e.key.toLowerCase();
  if (k === 'q') iso.snap(-1);
  else if (k === 'e') iso.snap(1);
  else if (k === 'l') hud.toggleLabels();
  else if (k === 'f') setFollow(!following);
  else if (k === ' ') {
    e.preventDefault();
    if (speed === 0) setSpeed(lastSpeed); else { lastSpeed = speed; setSpeed(0); }
  } else if (k === '1' || k === '2' || k === '3') setSpeed(Number(k));
  else if (k === 'escape') select(0);
  else keys.add(k);
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

window.addEventListener('resize', () => {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  iso.resize(w / h);
});

// ---------- loop ----------
const clock = new THREE.Clock();
const headPos = new THREE.Vector3();
const followPos = new THREE.Vector3();
let t = 0;
let uiTimer = 0;

// Adaptive quality: if frames are slow, lower resolution, then drop fire shadows.
let perfFrames = 0, perfTime = 0, perfStep = 0;
function adaptQuality(dt: number) {
  perfFrames++; perfTime += dt;
  if (perfTime < 3) return;
  const fps = perfFrames / perfTime;
  perfFrames = 0; perfTime = 0;
  if (fps >= 38 || perfStep >= 2) return;
  perfStep++;
  if (perfStep === 1) {
    renderer.setPixelRatio(1);
    composer.setPixelRatio(1);
  } else {
    renderer.shadowMap.type = THREE.PCFShadowMap;
    sky.sun.shadow.mapSize.set(1024, 1024);
    sky.sun.shadow.map?.dispose();
    sky.sun.shadow.map = null;
  }
  console.info(`Quality lowered (step ${perfStep}) at ${fps.toFixed(0)} fps`);
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  t += dt;
  adaptQuality(dt);

  // Simulation.
  if (speed > 0) tick(colony, dt * SPEEDS[speed]);
  for (const ev of colony.events) {
    if (ev.type === 'felled') trees.fell(ev.tree, ev.dirX, ev.dirZ);
  }
  colony.events.length = 0;

  // Camera.
  const panSpeed = 18 * dt;
  if (keys.has('w') || keys.has('arrowup')) { iso.pan(0, panSpeed); setFollow(false); }
  if (keys.has('s') || keys.has('arrowdown')) { iso.pan(0, -panSpeed); setFollow(false); }
  if (keys.has('a') || keys.has('arrowleft')) { iso.pan(-panSpeed, 0); setFollow(false); }
  if (keys.has('d') || keys.has('arrowright')) { iso.pan(panSpeed, 0); setFollow(false); }
  if (following && people.worldPosition(people.selected, followPos)) {
    iso.target.x += (followPos.x - iso.target.x) * Math.min(1, dt * 4);
    iso.target.z += (followPos.z - iso.target.z) * Math.min(1, dt * 4);
  }
  iso.update(dt);
  iso.target.y = heightAt(world, iso.target.x, iso.target.z) * 0.6;

  // World.
  const hour = hourOf(colony);
  sky.follow(iso.target);
  sky.setHour(hour);
  fog.sync();
  worldUniforms.uTime.value = t;
  const pointScale = renderer.getPixelRatio() * iso.zoom;
  wisps.update(t, dt, sky.night, pointScale);
  fireflies.update(t, sky.night, pointScale);
  orb.update(t, dt, sky.night);
  herds.update(dt, colony.agents);
  trees.update(dt);
  bushes.update(dt);
  people.update(t, dt, colony.agents);
  camp.update(t, community.resources.wood > 0);
  mushroomGlow.color.setRGB(0.5, 1.2, 1.0).multiplyScalar(0.4 + sky.night * 1.6);
  bloom.strength = 0.45 + sky.night * 0.5;

  composer.render();

  uiTimer += dt;
  if (uiTimer > 0.25) {
    uiTimer = 0;
    people.sync(community.survivors, colony.agents);
    camp.sync(community, colony.items);
    hud.render();
  }
  hud.updateClock(iso.headingDeg);
  hud.placeLabels((id, out) => {
    if (!people.headPosition(id, headPos)) return false;
    headPos.project(iso.camera);
    out.x = (headPos.x * 0.5 + 0.5) * view.clientWidth;
    out.y = (-headPos.y * 0.5 + 0.5) * view.clientHeight;
    return true;
  });

  requestAnimationFrame(frame);
}

requestAnimationFrame(() => {
  frame();
  const boot = document.getElementById('boot')!;
  boot.style.opacity = '0';
  setTimeout(() => boot.remove(), 700);
});

// Exposed for automated checks and debugging.
Object.assign(window, { __game: { colony, iso, setSpeed, select, tick: (m: number) => tick(colony, m) } });
