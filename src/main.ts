import * as THREE from 'three';
import { advanceDay, createCommunity, killSurvivor, recruit, setJob } from './sim/community';
import { IsoCamera, Sky, createComposer, createRenderer } from './render/stage';
import { buildTerrain, heightAt } from './render/terrain';
import { buildStation, buildVines, CAMP } from './render/station';
import { buildFairyRing, buildTrees, Herd } from './render/nature';
import { Fireflies, Orb, Wisps } from './render/mystic';
import { Camp } from './render/camp';
import { windUniforms } from './render/util';
import { Hud } from './ui/hud';

// ---------- simulation ----------
const community = createCommunity(Date.now() % 100000);

// ---------- scene ----------
const view = document.getElementById('view')!;
const renderer = createRenderer(view);
const scene = new THREE.Scene();
const iso = new IsoCamera(view.clientWidth / view.clientHeight);
const sky = new Sky(scene);
const { composer, bloom } = createComposer(renderer, scene, iso.camera, view.clientWidth, view.clientHeight);

scene.add(buildTerrain());
const station = buildStation();
scene.add(station.group);
scene.add(buildVines(station.surfaces, station.edges));
scene.add(buildTrees());

const ringCenter = new THREE.Vector3(-17, 0, -11);
const mushroomGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#b9fff0'), toneMapped: false });
scene.add(buildFairyRing(ringCenter, mushroomGlow));

const herd = new Herd(6);
scene.add(herd.group);

const wisps = new Wisps([
  ringCenter,
  new THREE.Vector3(-4, 0.8, 2),        // under the canopy
  new THREE.Vector3(CAMP.x - 2, 0.6, CAMP.z - 3),
  new THREE.Vector3(18, 0, -14),
  new THREE.Vector3(-22, 0, 6),
  new THREE.Vector3(8, 0, 22),
]);
scene.add(wisps.group);
const fireflies = new Fireflies();
scene.add(fireflies.points);
const orb = new Orb();
scene.add(orb.group);

const camp = new Camp();
scene.add(camp.group);
camp.sync(community.survivors);

// ---------- time ----------
let hour = 17.6;
let timeRunning = false;
const HOURS_PER_SECOND = 0.35;

// ---------- HUD ----------
const hud = new Hud(community, {
  onEndDay() {
    advanceDay(community);
    hour = 7;
    camp.sync(community.survivors);
    hud.render();
  },
  onKill(id) {
    const reports = killSurvivor(community, id, 'lost beyond the treeline');
    const dead = community.survivors.find((s) => s.id === id);
    const worst = reports.sort((a, b) => b.moraleLoss - a.moraleLoss).slice(0, 3);
    if (dead && worst.length) {
      const names = worst.map((r) => {
        const s = community.survivors.find((x) => x.id === r.survivorId)!;
        return `${s.name.split(' ')[0]} −${Math.round(r.moraleLoss)}`;
      });
      community.log.push({ day: community.day, text: `Morale hit — ${names.join(', ')}.`, tone: 'bad' });
    }
    camp.sync(community.survivors);
    hud.render();
  },
  onRecruit() {
    recruit(community);
    camp.sync(community.survivors);
    hud.render();
  },
  onJob(id, job) {
    setJob(community, id, job);
    hud.render();
  },
  onRotate(dir) { iso.snap(dir); },
  onHour(h) { hour = h; },
  onTogglePlay() { timeRunning = !timeRunning; return timeRunning; },
});
hud.render();

// ---------- input ----------
const canvas = renderer.domElement;
const pointers = new Map<number, { x: number; y: number; button: number }>();
let pinchDist = 0, pinchAngle = 0;

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
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
    else iso.pan(-dx * worldPerPx, dy * worldPerPx / Math.sin(Math.atan(1 / Math.SQRT2)));
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
const release = (e: PointerEvent) => { pointers.delete(e.pointerId); pinchDist = 0; };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  iso.zoomBy(Math.exp(-e.deltaY * 0.0012));
}, { passive: false });

const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('select, input, button')) return;
  const k = e.key.toLowerCase();
  if (k === 'q') iso.snap(-1);
  else if (k === 'e') iso.snap(1);
  else if (k === 'l') hud.toggleLabels();
  else if (k === ' ') { e.preventDefault(); hud.togglePlay(); }
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
let t = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  t += dt;

  const panSpeed = 18 * dt;
  if (keys.has('w') || keys.has('arrowup')) iso.pan(0, panSpeed);
  if (keys.has('s') || keys.has('arrowdown')) iso.pan(0, -panSpeed);
  if (keys.has('a') || keys.has('arrowleft')) iso.pan(-panSpeed, 0);
  if (keys.has('d') || keys.has('arrowright')) iso.pan(panSpeed, 0);

  if (timeRunning) {
    hour = (hour + dt * HOURS_PER_SECOND) % 24;
    hud.setHour(hour);
  }
  sky.setHour(hour);
  iso.update(dt);
  iso.target.y = heightAt(iso.target.x, iso.target.z) * 0.5;

  windUniforms.uTime.value = t;
  const pointScale = renderer.getPixelRatio() * iso.zoom;
  wisps.update(t, dt, sky.night, pointScale);
  fireflies.update(t, sky.night, pointScale);
  orb.update(t, dt, sky.night);
  herd.update(dt);
  camp.update(t, dt);
  mushroomGlow.color.setRGB(0.5, 1.2, 1.0).multiplyScalar(0.4 + sky.night * 1.6);
  bloom.strength = 0.45 + sky.night * 0.5;

  composer.render();

  hud.updateClock(community.day, hour, iso.headingDeg);
  hud.placeLabels((id, out) => {
    if (!camp.headPosition(id, headPos)) return false;
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
Object.assign(window, { __game: { community, iso, setHour: (h: number) => { hour = h; hud.setHour(h); } } });
