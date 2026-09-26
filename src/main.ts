import * as THREE from 'three';
import { createColony, hourOf, replan, syncAgents, tick } from './sim/colony';
import { createCommunity, killSurvivor, recruit, setRole } from './sim/community';
import { CAMP } from './sim/layout';
import { generateWorld } from './sim/worldgen';
import { Zone, heightAt, paintZone } from './sim/world';
import { daylightHours, seasonLook } from './sim/calendar';
import { IsoCamera, Sky, createComposer, createRenderer } from './render/stage';
import { FogTexture, WearTexture, buildTerrain } from './render/terrain';
import { FieldsView, Precipitation } from './render/land';
import { buildStation, buildVines } from './render/station';
import { TreeField } from './render/trees';
import { Bushes, Herds, buildFairyRing, buildRuins } from './render/nature';
import { Fireflies, Orb, Wisps } from './render/mystic';
import { People } from './render/people';
import { Camp } from './render/camp';
import { HeapsView, VillageView, bedSlot } from './render/village';
import { RoofControl } from './render/roofs';
import { PhenomenaView, ResonanceTexture } from './render/veil';
import { nudgeCalm, nudgeOmen, resolveCouncil } from './sim/council';
import { worldUniforms } from './render/util';
import { Hud, type ZoneTool } from './ui/hud';

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
const { composer, bloom, syncXray } = createComposer(renderer, scene, iso.camera, view.clientWidth, view.clientHeight);
renderer.localClippingEnabled = true;
const roofs = new RoofControl();

const fog = new FogTexture(world);
worldUniforms.uFogTex.value = fog.texture;
const wear = new WearTexture(world);
worldUniforms.uWearTex.value = wear.texture;
const resonance = new ResonanceTexture(colony);
worldUniforms.uResTex.value = resonance.texture;
worldUniforms.uFogSize.value = world.w;

scene.add(buildTerrain(world));
const station = buildStation();
scene.add(station.group);
const vines = buildVines(station.surfaces, station.edges);
scene.add(vines.walls, vines.roofs);
for (const r of station.roofs) if (r !== station.store.fallen) roofs.addRoof(r); // the fallen slab is managed with the store's repairs
roofs.addRoof(vines.roofs);
for (const m of station.cutMaterials) roofs.addCutMaterial(m);
roofs.addCutMaterial(vines.walls.material as THREE.Material);
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
const villageView = new VillageView(world, colony.village, station.store, roofs);
scene.add(villageView.group);
const heaps = new HeapsView(world);
scene.add(heaps.group);
const fields = new FieldsView(world);
scene.add(fields.group);
const precip = new Precipitation();
scene.add(precip.group);
const phenomena = new PhenomenaView(colony, document.getElementById('labels')!);
scene.add(phenomena.group);
let veilView = false;
let omenMode = false;
const people = new People(world);
scene.add(people.group);

function syncScene() {
  syncAgents(colony);
  people.sync(community.survivors, colony.agents);
  camp.sync(community, colony.items, colony.beds);
  villageView.sync();
  heaps.sync();
  fields.sync();
  trees.syncPlanted();
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
  onZoneTool(mode) { setOmen(false); setZoneTool(mode); },
  onCouncil(id, dream) {
    resolveCouncil(colony, id, dream);
    hud.render();
  },
  onVeilView() { veilView = !veilView; hud.setVeilView(veilView); hud.render(); },
  onCalm() {
    if (people.selected) nudgeCalm(colony, people.selected);
    hud.render();
  },
  onOmen() { setZoneTool(null); setOmen(!omenMode); },
});

const roofBtn = document.getElementById('roof-btn')!;
function cycleRoofs() {
  const m = roofs.next();
  villageView.sync();
  roofBtn.textContent = `Roofs: ${m === 'cutaway' ? 'cut away' : m}`;
  roofBtn.setAttribute('aria-pressed', String(m !== 'shown'));
}
roofBtn.addEventListener('click', cycleRoofs);

/** Which bed an indoor sleeper is in: their rank among the building's assigned sleepers. */
function bedOf(a: { id: number }) {
  const bid = colony.beds.get(a.id);
  if (bid === undefined) return null;
  const b = colony.village.buildings.find((x) => x.id === bid);
  if (!b) return null;
  const mates = [...colony.beds.entries()].filter(([, v]) => v === bid).map(([k]) => k).sort((x, y) => x - y);
  return bedSlot(world, b, mates.indexOf(a.id));
}

function setOmen(on: boolean) {
  omenMode = on;
  hud.setOmenMode(on);
  hud.render();
}

let zoneTool: ZoneTool | null = null;
const ZONE_OF: Record<ZoneTool, number> = { home: Zone.Home, field: Zone.Field, woodlot: Zone.Woodlot, sacred: Zone.Sacred, erase: Zone.None };
function setZoneTool(mode: ZoneTool | null) {
  zoneTool = mode;
  hud.setZoneMode(mode);
  worldUniforms.uZone.value = mode ? 1 : 0.18;
}
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
function paintAt(clientX: number, clientY: number) {
  if (!zoneTool) return;
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, iso.camera);
  if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) paintZone(world, hitPoint.x, hitPoint.z, 2.5, ZONE_OF[zoneTool] as never);
}

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
  if (zoneTool && e.button === 0 && pointers.size === 1) paintAt(e.clientX, e.clientY);
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
    else if (zoneTool && p.button === 0) paintAt(e.clientX, e.clientY);
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
  if (zoneTool && p?.button === 0) { replan(colony); return; }
  if (omenMode && p?.button === 0 && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) <= 6) {
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, iso.camera);
    if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) nudgeOmen(colony, hitPoint.x, hitPoint.z);
    setOmen(false);
    return;
  }
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
  else if (k === 'r') cycleRoofs();
  else if (k === 'v') { veilView = !veilView; hud.setVeilView(veilView); hud.render(); }
  else if (k === 'escape') { select(0); setZoneTool(null); setOmen(false); }
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
const vignette = document.getElementById('vignette')!;
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
  const dayFrac = colony.minute / 1440 + 1;
  const weather = colony.weather;
  const look = seasonLook(dayFrac, weather === 'snow');
  worldUniforms.uSnow.value = look.snow;
  worldUniforms.uAutumn.value = look.autumn;
  worldUniforms.uBare.value = look.bare;
  worldUniforms.uBlossom.value = look.blossom;
  const gloom = weather === 'rain' ? 1 : weather === 'snow' ? 0.7 : weather === 'overcast' ? 0.6 : weather === 'fog' ? 0.4 : 0;
  sky.follow(iso.target);
  sky.setHour(hour, daylightHours(dayFrac), gloom, weather === 'fog' ? 1 : weather === 'rain' ? 0.3 : 0, look.snow);
  precip.update(dt, t, iso.target, weather === 'rain' ? 'rain' : weather === 'snow' ? 'snow' : null);
  // Seeing through their eyes: a selected survivor's Sight tints the world and reveals the Veil.
  const viewer = people.selected ? community.survivors.find((s) => s.id === people.selected) : undefined;
  const sightK = viewer ? viewer.sight / 100 : 0;
  worldUniforms.uVeil.value += ((veilView ? 1 : sightK * 0.6) - worldUniforms.uVeil.value) * Math.min(1, dt * 3);
  vignette.style.opacity = viewer ? (0.1 + sightK * 0.75).toFixed(2) : '0';
  resonance.sync(t);
  phenomena.update(t, people.selected, iso.camera, view.clientWidth, view.clientHeight);
  wear.sync(t);
  fog.sync();
  worldUniforms.uTime.value = t;
  const pointScale = renderer.getPixelRatio() * iso.zoom;
  wisps.update(t, dt, sky.night, pointScale);
  fireflies.update(t, sky.night, pointScale);
  orb.update(t, dt, sky.night);
  herds.update(dt, colony.agents);
  trees.update(dt);
  bushes.update(dt);
  people.update(t, dt, colony.agents, bedOf, roofs.mode !== 'shown');
  camp.update(t, community.resources.wood > 0);
  const occupied = new Set<number>();
  for (const a of colony.agents) if (a.indoors) { const b = colony.beds.get(a.id); if (b !== undefined) occupied.add(b); }
  villageView.update(sky.night, occupied, t);
  mushroomGlow.color.setRGB(0.5, 1.2, 1.0).multiplyScalar(0.4 + sky.night * 1.6);
  bloom.strength = 0.45 + sky.night * 0.5;

  syncXray();
  composer.render();

  uiTimer += dt;
  if (uiTimer > 0.25) {
    uiTimer = 0;
    people.sync(community.survivors, colony.agents);
    camp.sync(community, colony.items, colony.beds);
    villageView.sync();
    heaps.sync();
    fields.sync(t);
    trees.syncPlanted();
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
Object.assign(window, { __game: { colony, iso, setSpeed, select, setZoneTool, paint: (x: number, z: number, r: number, k: number) => paintZone(world, x, z, r, k as never), tick: (m: number) => tick(colony, m), refresh: () => { syncScene(); hud.render(); } } });
