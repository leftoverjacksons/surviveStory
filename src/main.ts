import * as THREE from 'three';
import { createColony, hourOf, replan, syncAgents, tick } from './sim/colony';
import { createCommunity, killSurvivor, log, recruit, setRole } from './sim/community';
import { SITE_KINDS, type SiteKind } from './sim/sites';
import { generateWorld, siteKindFor } from './sim/worldgen';
import { Zone, heightAt, paintZone, reveal, tileX, tileZ, toTileX, toTileZ } from './sim/world';
import { createField, deleteField, fieldAtPoint } from './sim/fields';
import { daylightHours, seasonLook } from './sim/calendar';
import { IsoCamera, Sky, createComposer, createRenderer, lightPeopleLayer } from './render/stage';
import { FogTexture, WearTexture, ZoneTexture, buildTerrain } from './render/terrain';
import { FieldsView, Precipitation } from './render/land';
import { buildVines } from './render/station';
import { buildSite } from './render/sites';
import { mergeStatic } from './render/merge';
import { TreeField } from './render/trees';
import { RESTORED_GLOW, buildRuins as buildOldWorld, syncRuins } from './render/ruins';
import { loadAnimals, loadCharacters } from './render/characters';
import { obstacleKey, obstaclesFor } from './render/clearance';
import { Bushes, Herds, buildFairyRing, buildRuins } from './render/nature';
import { Fireflies, Orb, Wisps } from './render/mystic';
import { FolkView } from './render/folk';
import { ClearingView } from './render/clearing';
import { ClearingMenu, ClearingPanel, spiritLabel } from './ui/clearing';
import { playTurn } from './sim/clearbot';
import { act as veilAct, endTurn, finish, giveDistrict, moveUnit, reachable, startClearing, teamReading, type Clearing } from './sim/haunt';
import { People } from './render/people';
import { Camp } from './render/camp';
import { HeapsView, VillageView, bedSlot, seatSlot } from './render/village';
import { PlotsView } from './render/plots';
import { seasonIndex } from './sim/calendar';
import { RoofControl } from './render/roofs';
import { PhenomenaView, ResonanceTexture } from './render/veil';
import { nudgeCalm, nudgeOmen, resolveCouncil } from './sim/council';
import { PIXEL, worldUniforms } from './render/util';
import { Hud, type ZoneTool } from './ui/hud';

// ---------- simulation ----------
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || Date.now() % 100000;
// ?site=chapel (station, chapel, motel, farm, glasshouse) picks the start; otherwise the seed does.
const siteParam = params.get('site') as SiteKind | null;
const world = generateWorld(seed, undefined, siteParam && SITE_KINDS.includes(siteParam) ? siteParam : siteKindFor(seed));
document.querySelector('#place h1')!.textContent = world.site.place;
document.title = `Survive Story · ${world.site.place}`;
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
const { composer, bloom, grade, syncXray } = createComposer(renderer, scene, iso.camera, view.clientWidth, view.clientHeight);
renderer.localClippingEnabled = true;
const roofs = new RoofControl();

const fog = new FogTexture(world);
worldUniforms.uFogTex.value = fog.texture;
const zoneTex = new ZoneTexture(world);
worldUniforms.uZoneTex.value = zoneTex.texture;
const wear = new WearTexture(world);
worldUniforms.uWearTex.value = wear.texture;
const resonance = new ResonanceTexture(colony);
worldUniforms.uResTex.value = resonance.texture;
worldUniforms.uFogSize.value = world.w;

const terrainGroup = buildTerrain(world);
terrainGroup.name = 'terrain';
scene.add(terrainGroup);
const station = buildSite(world.site);
// The site's static parts, baked; roofs, the fallen section, door and lamps stay separate.
mergeStatic(station.group, new Set<THREE.Object3D>([...station.roofs, station.store.fallen, station.store.door, ...station.store.glow]), true);
station.group.traverse((o) => {
  const m = (o as THREE.Mesh).material as THREE.Material | undefined;
  if (o.userData.merged && m?.userData.cutShared) station.cutMaterials.push(m);
});
scene.add(station.group);
const vines = buildVines(station.surfaces, station.edges);
scene.add(vines.walls, vines.roofs);
for (const r of station.roofs) if (r !== station.store.fallen) roofs.addRoof(r); // the fallen slab is managed with the store's repairs
roofs.addRoof(vines.roofs);
for (const m of station.cutMaterials) roofs.addCutMaterial(m);
roofs.addCutMaterial(vines.walls.material as THREE.Material);
const trees = new TreeField(world);
trees.group.name = 'trees';
scene.add(trees.group);
const bushes = new Bushes(world);
bushes.group.name = 'bushes';
scene.add(bushes.group);
const ruinsGroup = buildRuins(world);
ruinsGroup.name = 'ruins';
scene.add(ruinsGroup);
const oldWorld = buildOldWorld(world);
oldWorld.name = 'oldworld';
scene.add(oldWorld);

const mushroomGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#b9fff0'), toneMapped: false });
scene.add(buildFairyRing(world, mushroomGlow));
const herds = new Herds(world);
herds.group.name = 'herds';
scene.add(herds.group);
loadAnimals().then((k) => herds.setKinds(k)).catch((e) => console.warn('animals:', e));

const ring = new THREE.Vector3(world.fairyRing.x, 0, world.fairyRing.z);
// Wisps belong to the Veil's places: the Ring, the Folk's hill and the paths between.
const mound = new THREE.Vector3(world.folk.mound.x, 0.4, world.folk.mound.z);
const wispAnchors = [
  ring, ring.clone().add(new THREE.Vector3(3, 0, 2)), ring.clone().add(new THREE.Vector3(-2, 0.5, -3)),
  mound, mound.clone().add(new THREE.Vector3(5, 0, -3)), mound.clone().add(new THREE.Vector3(-4, 0, 4)),
  ...world.folk.paths.flatMap((p) => [p[Math.floor(p.length / 3)], p[Math.floor((p.length * 2) / 3)]]).map((q) => new THREE.Vector3(q.x, 0, q.z)),
];
const wisps = new Wisps(world, wispAnchors, 7);
const orbSpots = [new THREE.Vector3(ring.x, 16, ring.z), new THREE.Vector3(mound.x, 14, mound.z)];
scene.add(wisps.group);
const fireflies = new Fireflies(world);
scene.add(fireflies.points);
const orb = new Orb(orbSpots);
scene.add(orb.group);

const camp = new Camp(world);
camp.group.name = 'camp';
scene.add(camp.group);
const villageView = new VillageView(world, colony.village, station.store, roofs);
scene.add(villageView.group);
const heaps = new HeapsView(world);
scene.add(heaps.group);
const plotsView = new PlotsView(world, colony.village);
villageView.group.name = 'village'; plotsView.group.name = 'plots'; heaps.group.name = 'heaps'; station.group.name = 'site';
scene.add(plotsView.group);
const fields = new FieldsView(world);
fields.group.name = 'fields';
scene.add(fields.group);
const precip = new Precipitation();
scene.add(precip.group);
const phenomena = new PhenomenaView(colony, document.getElementById('labels')!);
scene.add(phenomena.group);
const folkView = new FolkView(colony, document.getElementById('labels')!);
scene.add(folkView.group);
const clearingView = new ClearingView(colony, document.getElementById('labels')!);
scene.add(clearingView.group);
let veilView = false;
let omenMode = false;
const people = new People(world);
people.group.name = 'people';
scene.add(people.group);
// Character models load in the background; until then people are simple figures.
loadCharacters().then((kit) => { people.setKit(kit); lightPeopleLayer(scene); }).catch((e) => console.warn('characters:', e));

/** Trees make room for buildings (finished or planned). */
let clearanceKey = '';
const noClear = new URLSearchParams(location.search).has('noclear'); // for before/after comparisons
function syncClearance() {
  const k = obstacleKey(colony.village);
  if (k === clearanceKey || noClear) return;
  clearanceKey = k;
  trees.setObstacles(obstaclesFor(world, colony.village));
}

function syncScene() {
  syncAgents(colony);
  people.sync(community.survivors, colony.agents);
  camp.sync(community, colony.items, colony.beds);
  villageView.sync();
  plotsView.sync(seasonIndex(colony.community.day));
  heaps.sync();
  fields.sync();
  folkView.sync();
  syncClearance();
  trees.syncPlanted();
  lightPeopleLayer(scene);
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
  onFolkFocus(focus) { colony.folk.focus = focus; colony.folk.version++; hud.render(); },
  onClear(haunt, team, fae) {
    const r = startClearing(colony, haunt, team, fae);
    if (typeof r === 'string') { community.log.push({ day: community.day, text: r, tone: 'info' }); hud.render(); return; }
    enterVeil(r);
  },
  onGive(district, to) { giveDistrict(colony, district, to); hud.render(); },
});

const roofBtn = document.getElementById('roof-btn')!;
function cycleRoofs() {
  const m = roofs.next();
  villageView.sync();
  roofBtn.textContent = `Roofs: ${m === 'cutaway' ? 'cut away' : m}`;
  roofBtn.setAttribute('aria-pressed', String(m !== 'shown'));
}
roofBtn.addEventListener('click', cycleRoofs);

/**
 * Where someone indoors is drawn: sleepers in their bed (their rank among the
 * building's sleepers), everyone else at a seat by the table.
 */
function bedOf(a: (typeof colony.agents)[number]) {
  const bid = a.task?.kind === 'sleep' ? colony.beds.get(a.id) : a.inside;
  if (bid === undefined || !bid) return null;
  const b = colony.village.buildings.find((x) => x.id === bid);
  if (!b) return null;
  if (a.task?.kind !== 'sleep') {
    const mates = colony.agents.filter((o) => o.inside === bid && o.task?.kind !== 'sleep').map((o) => o.id).sort((x, y) => x - y);
    return seatSlot(world, colony.village, b, mates.indexOf(a.id));
  }
  const mates = [...colony.beds.entries()].filter(([, v]) => v === bid).map(([k]) => k).sort((x, y) => x - y);
  return bedSlot(world, colony.village, b, mates.indexOf(a.id));
}

function setOmen(on: boolean) {
  omenMode = on;
  hud.setOmenMode(on);
  hud.render();
}

let zoneTool: ZoneTool | null = null;
const ZONE_OF: Record<ZoneTool, number> = { home: Zone.Home, field: Zone.Field, woodlot: Zone.Woodlot, sacred: Zone.Sacred, fishing: Zone.Fishing, wild: Zone.Wild, erase: Zone.None };
function setZoneTool(mode: ZoneTool | null) {
  zoneTool = mode;
  if (mode !== 'field') clearDraft();
  hud.setZoneMode(mode);
  worldUniforms.uZone.value = mode ? 1 : 0;
}
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
// ---- fields are drawn as outlines: click the corners, close the shape ----
const draft: { x: number; z: number }[] = [];
const draftLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#f0a040', depthTest: false, transparent: true }));
draftLine.renderOrder = 10;
draftLine.frustumCulled = false;
const draftDots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#ffd080', size: 6, sizeAttenuation: false, depthTest: false }));
draftDots.renderOrder = 10;
draftDots.frustumCulled = false;
scene.add(draftLine, draftDots);
function groundAt(clientX: number, clientY: number): THREE.Vector3 | null {
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, iso.camera);
  return raycaster.ray.intersectPlane(groundPlane, hitPoint) ? hitPoint.clone() : null;
}
function drawDraft(cursor?: THREE.Vector3 | null) {
  const pts = draft.map((p) => new THREE.Vector3(p.x, heightAt(world, p.x, p.z) + 0.15, p.z));
  // Fresh geometry each time: setFromPoints reuses (and will not grow) an existing buffer.
  draftDots.geometry.dispose(); draftDots.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  if (cursor && draft.length) pts.push(new THREE.Vector3(cursor.x, heightAt(world, cursor.x, cursor.z) + 0.15, cursor.z));
  draftLine.geometry.dispose(); draftLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
}
function clearDraft() { draft.length = 0; drawDraft(); }
function closeDraft() {
  if (draft.length >= 3) {
    const f = createField(world, draft.slice(), world.campfire);
    if (f) {
      log(community, `A field is marked out: ${f.tiles.length} plots of ground, staked at the corners. The farmers will fence it once it's worked.`, 'good');
      replan(colony);
    } else {
      log(community, 'That field would take almost no workable ground (roads, water, buildings or unexplored land). Try again.', 'info');
    }
  }
  clearDraft();
  hud.render();
}
function fieldClick(clientX: number, clientY: number) {
  const g = groundAt(clientX, clientY);
  if (!g) return;
  if (!draft.length) {
    const f = fieldAtPoint(world, g.x, g.z);
    if (f) {
      if (confirm('Remove this field? Anything growing in it will be lost.')) { deleteField(world, f.id); replan(colony); hud.render(); }
      return;
    }
  }
  if (draft.length >= 3 && Math.hypot(g.x - draft[0].x, g.z - draft[0].z) < 1.2) { closeDraft(); return; }
  draft.push({ x: g.x, z: g.z });
  drawDraft(g);
}

function paintAt(clientX: number, clientY: number) {
  if (!zoneTool || zoneTool === 'field') return;
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

// ---------- the Veil: clearing a haunted district ----------
interface VeilMode { follow: boolean; cl: Clearing; sel: number; saved: Map<number, { x: number; z: number }>; hover: { tx: number; tz: number } | null; camera: { x: number; z: number; zoom: number } }
let veil: VeilMode | null = null;
const veilPanel = new ClearingPanel(colony, {
  onSelect(id) { if (veil) { veil.sel = id; veil.follow = true; renderVeil(); } },
  onAct(by, verb, target) {
    if (!veil) return;
    const err = veilAct(colony, veil.cl, by, verb, target);
    if (err) veil.cl.log.push(err);
    afterVeilAction();
  },
  onEndTurn() { if (veil) { endTurn(colony, veil.cl); afterVeilAction(); } },
  onLeave() { if (veil) { finish(colony, veil.cl, 'cleared'); afterVeilAction(); } },
  onWithdraw() { if (veil) { finish(colony, veil.cl, 'withdrew'); afterVeilAction(); } },
  onReturn() { exitVeil(); },
});
function renderVeil() { if (veil) veilPanel.render(veil.cl, veil.sel); }
function afterVeilAction() {
  if (!veil) return;
  veil.follow = true;
  const u = veil.cl.units.find((x) => x.id === veil!.sel && x.state === 'in' && x.ap > 0) ?? veil.cl.units.find((x) => x.state === 'in' && x.ap > 0);
  if (u) veil.sel = u.id;
  renderVeil();
}
function enterVeil(cl: Clearing) {
  setZoneTool(null); setOmen(false); hud.inspect(null); select(0); setFollow(false);
  const saved = new Map<number, { x: number; z: number }>();
  for (const u of cl.units) {
    const a = colony.agents.find((x) => x.id === u.id);
    if (a) { saved.set(u.id, { x: a.x, z: a.z }); a.x = tileX(world, u.tx); a.z = tileZ(world, u.tz); }
  }
  const d = world.districts[colony.haunts[cl.haunt].district];
  veil = { follow: true, cl, sel: cl.units[0]?.id ?? 0, saved, hover: null, camera: { x: iso.target.x, z: iso.target.z, zoom: iso.zoomGoal } };
  iso.target.x = d.x - (d.x / Math.hypot(d.x, d.z)) * 6; iso.target.z = d.z - (d.z / Math.hypot(d.x, d.z)) * 6;
  iso.zoomGoal = 1.9;
  renderVeil();
}
function exitVeil() {
  if (!veil) return;
  veilMenu.close(); veilMenu.tip(0, 0, null);
  for (const [id, p] of veil.saved) { const a = colony.agents.find((x) => x.id === id); if (a) { a.x = p.x; a.z = p.z; } }
  iso.target.x = veil.camera.x; iso.target.z = veil.camera.z; iso.zoomGoal = veil.camera.zoom;
  const cl = veil.cl;
  veil = null;
  veilPanel.hide();
  syncAgents(colony, true);
  syncScene();
  hud.render();
  if (cl.outcome === 'cleared') hud.inspect({ district: colony.haunts[cl.haunt].district });
}
const veilMenu = new ClearingMenu(colony, {
  onAct(by, verb, target) {
    if (!veil) return;
    const err = veilAct(colony, veil.cl, by, verb, target);
    if (err) veil.cl.log.push(err);
    afterVeilAction();
  },
  onApproach(by, t) {
    if (!veil) return;
    const err = moveUnit(colony, veil.cl, by, t.tx, t.tz);
    if (err) veil.cl.log.push(err);
    afterVeilAction();
  },
  onSelect(id) { if (veil) { veil.sel = id; veil.follow = true; renderVeil(); } },
});

/** Screen position of a world point. */
function toScreen(x: number, y: number, z: number) {
  const v = new THREE.Vector3(x, y, z).project(iso.camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
}

/** What is under the cursor in the Veil: one of the team, or a spirit they can perceive. */
function veilPick(cx: number, cy: number): { spirit: number } | { unit: number } | null {
  if (!veil) return null;
  let best: { spirit: number } | { unit: number } | null = null, bestD = Infinity;
  for (const u of veil.cl.units) {
    if (u.state !== 'in') continue;
    const a = colony.agents.find((q) => q.id === u.id);
    const x = a ? a.x : tileX(world, u.tx), z = a ? a.z : tileZ(world, u.tz);
    const p = toScreen(x, heightAt(world, x, z) + 0.8, z);
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < 30 && d < bestD) { best = { unit: u.id }; bestD = d; }
  }
  for (const s of colony.haunts[veil.cl.haunt].spirits) {
    if (s.fate !== 'present' || (teamReading(colony, veil.cl, s) === 'none' && s.known < 1)) continue;
    const x = tileX(world, s.tx), z = tileZ(world, s.tz);
    const p = toScreen(x, heightAt(world, x, z) + 1.1, z);
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < 38 && d < bestD) { best = { spirit: s.id }; bestD = d; }
  }
  return best;
}

/** The best tile this turn to walk to beside a target (or as near as possible). */
function approachTile(target: { tx: number; tz: number }) {
  if (!veil) return null;
  const u = veil.cl.units.find((x) => x.id === veil!.sel && x.state === 'in');
  if (!u) return null;
  let best: { tx: number; tz: number; d: number; steps: number } | null = null;
  for (const [k, steps] of reachable(colony, veil.cl, u)) {
    const [tx, tz] = k.split(',').map(Number);
    const d = Math.max(Math.abs(tx - target.tx), Math.abs(tz - target.tz));
    if (!best || d < best.d || (d === best.d && steps < best.steps)) best = { tx, tz, d, steps };
  }
  if (!best || best.d >= Math.max(Math.abs(u.tx - target.tx), Math.abs(u.tz - target.tz))) return null;
  return { tx: best.tx, tz: best.tz, beside: best.d <= 1 };
}

function veilClick(cx: number, cy: number, button: number) {
  if (!veil || veil.cl.outcome) return;
  if (veilMenu.isOpen) { veilMenu.close(); return; }
  const hit = veilPick(cx, cy);
  if (hit && 'spirit' in hit) {
    const s = colony.haunts[veil.cl.haunt].spirits.find((x) => x.id === hit.spirit)!;
    veilMenu.open(cx, cy, veil.cl, veil.sel, hit, approachTile(s));
    return;
  }
  if (hit && 'unit' in hit) {
    if (button === 0 && hit.unit !== veil.sel) { veil.sel = hit.unit; veil.follow = true; renderVeil(); return; }
    const u = veil.cl.units.find((x) => x.id === hit.unit)!;
    veilMenu.open(cx, cy, veil.cl, veil.sel, hit.unit === veil.sel ? { self: true } : { ally: hit.unit }, approachTile(u));
    return;
  }
  if (button !== 0) return;
  const g = groundAt(cx, cy);
  if (!g) return;
  const tx = toTileX(world, g.x), tz = toTileZ(world, g.z);
  const u = veil.cl.units.find((x) => x.id === veil!.sel && x.state === 'in');
  if (u && reachable(colony, veil.cl, u).has(`${tx},${tz}`)) {
    const err = moveUnit(colony, veil.cl, u.id, tx, tz);
    if (err) veil.cl.log.push(err);
    afterVeilAction();
  }
}

/** Hovering in the Veil: say what it is and that it can be clicked. */
function veilHover(cx: number, cy: number) {
  if (!veil || veil.cl.outcome) { veilMenu.tip(0, 0, null); return; }
  const hit = veilPick(cx, cy);
  if (!hit) { veilMenu.tip(0, 0, null); return; }
  if ('spirit' in hit) {
    const s = colony.haunts[veil.cl.haunt].spirits.find((x) => x.id === hit.spirit)!;
    veilMenu.tip(cx, cy, `${spiritLabel(s, teamReading(colony, veil.cl, s) === 'none' ? 'chill' : teamReading(colony, veil.cl, s))} · click for actions`);
  } else {
    const u = veil.cl.units.find((x) => x.id === hit.unit)!;
    veilMenu.tip(cx, cy, `${u.name} · Nerve ${Math.max(0, u.nerve)}/${u.maxNerve} · ${u.id === veil.sel ? 'right-click to ward' : 'click to choose, right-click to steady'}`);
  }
}

// ---------- input ----------
const canvas = renderer.domElement;
const pointers = new Map<number, { x: number; y: number; button: number; sx: number; sy: number }>();
let pinchDist = 0, pinchAngle = 0;
const raycaster = new THREE.Raycaster();
raycaster.layers.enableAll();

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
  if (zoneTool === 'field' && draft.length) drawDraft(groundAt(e.clientX, e.clientY));
  if (veil) { const g = groundAt(e.clientX, e.clientY); veil.hover = g ? { tx: toTileX(world, g.x), tz: toTileZ(world, g.z) } : null; if (!pointers.size) veilHover(e.clientX, e.clientY); }
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (pointers.size === 1) {
    const worldPerPx = (iso.camera.top - iso.camera.bottom) / canvas.clientHeight;
    if (p.button === 2 || e.ctrlKey || e.altKey) iso.rotateBy(-dx * 0.008);
    else if (zoneTool && zoneTool !== 'field' && p.button === 0) paintAt(e.clientX, e.clientY);
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
  if (veil) {
    if (p && (p.button === 0 || p.button === 2) && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) <= 6) veilClick(e.clientX, e.clientY, p.button);
    return;
  }
  if (zoneTool === 'field' && p?.button === 0) {
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) <= 6) fieldClick(e.clientX, e.clientY);
    return;
  }
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
  if (o) { select(o.userData.survivorId as number); return; }
  select(0);
  // The Folk's hill?
  if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
    const m = world.folk.mound;
    if (Math.hypot(hitPoint.x - m.x, hitPoint.z - m.z) < m.r + 1) { hud.inspect({ folk: true }); return; }
    // A district of the old world?
    const d = world.districts.find((x) => Math.hypot(hitPoint.x - x.x, hitPoint.z - x.z) < 20
      && world.pois.some((q) => q.kind === 'ruin' && q.name === x.name && q.discovered));
    if (d) { hud.inspect({ district: d.id }); return; }
  }
  // Not a person: a building?
  const bh = raycaster.intersectObjects([villageView.group, plotsView.group, station.group], true)[0];
  let q: THREE.Object3D | null = bh?.object ?? null;
  while (q && q.userData.buildingId === undefined && q.userData.projectId === undefined && q.userData.plotId === undefined) q = q.parent;
  if (q?.userData.plotId !== undefined) {
    // A yard: show the home on it (or the house going up).
    const pid = q.userData.plotId as number;
    const home = colony.village.buildings.find((b) => b.plot === pid);
    const proj = colony.village.projects.find((p) => !p.done && p.plot === pid);
    if (home) { hud.inspect({ building: home.id }); return; }
    if (proj) { hud.inspect({ project: proj.id }); return; }
  } else if (q) { hud.inspect(q.userData.buildingId !== undefined ? { building: q.userData.buildingId } : { project: q.userData.projectId }); return; }
  if (bh) {
    // The site itself: the shelter, or the kitchen (under the station canopy).
    const p = bh.point;
    const S = world.site.shelter, K = world.site.kitchen;
    const st = colony.village.buildings.find((b) => b.kind === 'store')!;
    const kitchen = colony.village.buildings.find((b) => b.kind === 'kitchen');
    if (Math.abs(p.x - S.x) < S.w / 2 + 0.4 && Math.abs(p.z - S.z) < S.d / 2 + 0.6) { hud.inspect({ building: st.id }); return; }
    if (kitchen && Math.abs(p.x - K.x) < 5.6 && Math.abs(p.z - K.z) < 3.6) { hud.inspect({ building: kitchen.id }); return; }
  }
  hud.inspect(null);
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
  else if (k === 'escape' && draft.length) clearDraft();
  else if (k === 'enter' && draft.length) closeDraft();
  else if (k === 'escape') { select(0); setZoneTool(null); setOmen(false); hud.inspect(null); }
  else keys.add(k);
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

window.addEventListener('resize', () => {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  iso.resize(w / h);
  if (PIXEL) iso.snapRows = Math.round(h / PIXEL);
});
if (PIXEL) iso.snapRows = Math.round(view.clientHeight / PIXEL);

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
    if (PIXEL) return; // already drawing at a fraction of the screen
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
  renderer.info.reset();
  const tSim = performance.now();
  if (speed > 0) tick(colony, dt * SPEEDS[speed]);
  perf.sim += (performance.now() - tSim - perf.sim) * 0.05;
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
  // Pixel art: shift the enlarged image by what the camera snap took away, so panning stays smooth.
  if (PIXEL) renderer.domElement.style.transform = `translate(${(iso.residual.x * PIXEL).toFixed(2)}px, ${(-iso.residual.y * PIXEL).toFixed(2)}px)`;
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
  sky.setHour(veil ? 23.4 : hour, daylightHours(dayFrac), veil ? 0 : gloom, weather === 'fog' ? 1 : weather === 'rain' ? 0.3 : 0, look.snow);
  precip.update(dt, t, iso.target, weather === 'rain' ? 'rain' : weather === 'snow' ? 'snow' : null);
  // Seeing through their eyes: a selected survivor's Sight tints the world and reveals the Veil.
  const viewer = people.selected ? community.survivors.find((s) => s.id === people.selected) : undefined;
  const sightK = viewer ? viewer.sight / 100 : 0;
  worldUniforms.uVeil.value += ((veilView || veil ? 1 : sightK * 0.6) - worldUniforms.uVeil.value) * Math.min(1, dt * 3);
  vignette.style.opacity = viewer ? (0.1 + sightK * 0.75).toFixed(2) : '0';
  resonance.sync(t);
  phenomena.update(t, people.selected, iso.camera, view.clientWidth, view.clientHeight);
  folkView.update(t, sky.night, people.selected, iso.camera, view.clientWidth, view.clientHeight);
  if (veil) {
    // The team stands where they stand in the Veil.
    const w = world;
    for (const u of veil.cl.units) {
      const a = colony.agents.find((x) => x.id === u.id);
      if (!a) continue;
      if (u.state !== 'in') { const o = veil.saved.get(u.id)!; a.x = o.x; a.z = o.z; continue; }
      const tx = tileX(w, u.tx), tz = tileZ(w, u.tz);
      const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
      if (d > 0.05) { const step = Math.min(d, dt * 6); a.x += (dx / d) * step; a.z += (dz / d) * step; a.facing = Math.atan2(dx, dz); a.anim = 'walk'; }
      else a.anim = 'idle';
      a.indoors = false; a.afloat = false;
    }
    // Keep the chosen one in view.
    const su = veil.cl.units.find((x) => x.id === veil!.sel && x.state === 'in');
    if (su && !pointers.size) {
      const fx = tileX(w, su.tx), fz = tileZ(w, su.tz);
      if (veil.follow) {
        iso.target.x += (fx - iso.target.x) * Math.min(1, dt * 2.5);
        iso.target.z += (fz - iso.target.z) * Math.min(1, dt * 2.5);
        if (Math.hypot(fx - iso.target.x, fz - iso.target.z) < 0.3) veil.follow = false;
      }
    }
  }
  clearingView.updateAmbient(t, veil ? 0 : sky.night, people.selected, iso.camera, view.clientWidth, view.clientHeight);
  clearingView.updateArena(t, veil?.cl ?? null, veil?.sel ?? 0, veil?.hover ?? null, iso.camera, view.clientWidth, view.clientHeight);
  wear.sync(t);
  fog.sync();
  zoneTex.sync();
  worldUniforms.uTime.value = t;
  const pointScale = renderer.getPixelRatio() * iso.zoom;
  wisps.update(t, dt, sky.night, pointScale);
  fireflies.update(t, sky.night, pointScale);
  orb.update(t, dt, sky.night);
  herds.update(dt, colony.agents);
  trees.update(dt);
  for (const m of debugMixers) m.update(dt);
  bushes.update(dt);
  people.update(t, dt, colony.agents, bedOf, roofs.mode !== 'shown');
  camp.update(t, community.resources.wood > 0);
  const occupied = new Set<number>();
  for (const a of colony.agents) if (a.indoors && a.inside) occupied.add(a.inside);
  plotsView.update(t, sky.night);
  RESTORED_GLOW.opacity = sky.night > 0.3 ? sky.night * 0.9 : 0;
  grade.uniforms.uNight.value = sky.night;
  villageView.update(sky.night, occupied, t);
  villageView.updateBoats(colony.agents.filter((a) => a.afloat && a.task?.kind === 'fish').map((a) => {
    const f = colony.village.fisheries.find((x) => a.task?.kind === 'fish' && x.id === a.task.fishery);
    return { x: a.x, z: a.z, facing: a.facing, boatId: f?.boat ?? 0 };
  }));
  mushroomGlow.color.setRGB(0.5, 1.2, 1.0).multiplyScalar(0.4 + sky.night * 1.6);
  bloom.strength = 0.45 + sky.night * 0.5;

  syncXray();
  const tDraw = performance.now();
  composer.render();
  perf.draw += (performance.now() - tDraw - perf.draw) * 0.05;
  perf.calls = renderer.info.render.calls;
  perf.triangles = renderer.info.render.triangles;

  uiTimer += dt;
  if (uiTimer > 0.25) {
    uiTimer = 0;
    people.sync(community.survivors, colony.agents);
    camp.sync(community, colony.items, colony.beds);
    villageView.sync();
    plotsView.sync(seasonIndex(colony.community.day));
    heaps.sync();
    fields.sync(t);
    folkView.sync();
    syncRuins(world, oldWorld);
    syncClearance();
    trees.syncPlanted();
    lightPeopleLayer(scene);
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
/** Frame statistics for profiling (see __game.stats). */
const perf = { sim: 0, draw: 0, calls: 0, triangles: 0 };
function stats() {
  let meshes = 0, casters = 0;
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible) { meshes++; if (o.castShadow) casters++; } });
  const byGroup: Record<string, number> = {};
  scene.children.forEach((c, i) => {
    let n = 0;
    c.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible) n++; });
    if (n) byGroup[c.name || `${c.type}#${i}`] = n;
  });
  // How many tree chunks each camera actually sees.
  const inView = (cam: THREE.Camera) => {
    cam.updateMatrixWorld();
    const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let n = 0;
    trees.group.traverse((o) => { const m = o as THREE.InstancedMesh; if (m.isInstancedMesh && m.visible && m.count > 0) { if (!m.boundingSphere) m.computeBoundingSphere(); const bs = m.boundingSphere!.clone().applyMatrix4(m.matrixWorld); if (f.intersectsSphere(bs)) n++; } });
    return n;
  };
  const treeChunks = { main: inView(iso.camera), sun: inView(sky.sun.shadow.camera) };
  const shadowLights: string[] = [];
  scene.traverse((o) => { const l = o as THREE.Light; if (l.isLight && l.castShadow) shadowLights.push(`${l.type}${(l as THREE.PointLight).shadow?.autoUpdate === false ? '(manual)' : ''}`); });
  return { ...perf, meshes, casters, programs: renderer.info.programs?.length ?? 0, geometries: renderer.info.memory.geometries, treeChunks, shadowLights, byGroup };
}
/** One controlled render, returning the draw calls it took (for profiling). */
function probeRender(opts: { shadows?: boolean; composer?: boolean } = {}) {
  const was = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = opts.shadows ?? was;
  renderer.shadowMap.needsUpdate = true;
  renderer.info.reset();
  if (opts.composer === false) renderer.render(scene, iso.camera); else composer.render();
  const out = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  renderer.shadowMap.enabled = was;
  return out;
}
/** Debug: drop a .glb into the scene at (x, z), playing its first clip (for comparing models). */
async function addModel(url: string, x: number, z: number, height = 1.7, clip = 'idle') {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  gltf.scene.scale.setScalar(height / (box.max.y - box.min.y || 1));
  gltf.scene.position.set(x, heightAt(world, x, z), z);
  gltf.scene.traverse((o) => { o.castShadow = true; o.layers.enable(1); });
  scene.add(gltf.scene);
  const a = gltf.animations.find((c) => c.name === clip) ?? gltf.animations[0];
  if (a) { const m = new THREE.AnimationMixer(gltf.scene); m.clipAction(a).play(); debugMixers.push(m); }
  return gltf.animations.map((c) => c.name);
}
const debugMixers: THREE.AnimationMixer[] = [];

const veilDebug = {
  /** Start a clearing on the first district of a kind, with the suggested team. */
  veilStart(kind = 'suburb', withFolk = false) {
    for (const p of world.pois) p.discovered = true;
    const hi = colony.haunts.findIndex((h) => world.districts[h.district].kind === kind);
    const by = [...colony.community.survivors.filter((x) => x.alive)].sort((a, b) => b.sight - a.sight);
    const team = [...new Set([by[0], by[1], by[by.length - 1], by[by.length - 2]].filter(Boolean).map((x) => x.id))];
    if (withFolk) { colony.folk.met = true; colony.folk.standing = Math.max(colony.folk.standing, 60); }
    const r = startClearing(colony, hi, team.slice(0, withFolk ? 3 : 4), withFolk ? colony.folk.beings.find((b) => b.kind === 'elder')?.id : undefined);
    if (typeof r !== 'string') enterVeil(r);
    return r;
  },
  veilTurns(n: number) { for (let i = 0; i < n && veil && !veil.cl.outcome; i++) playTurn(colony, veil.cl); afterVeilAction(); },
  veil: () => veil,
  /** Screen position of the nearest spirit the team perceives (for tests and screenshots). */
  veilSpiritScreen() {
    if (!veil) return null;
    const u = veil.cl.units.find((x) => x.id === veil!.sel) ?? veil.cl.units[0];
    const ss = colony.haunts[veil.cl.haunt].spirits.filter((s) => s.fate === 'present' && teamReading(colony, veil!.cl, s) !== 'none')
      .sort((a, b) => Math.max(Math.abs(a.tx - u.tx), Math.abs(a.tz - u.tz)) - Math.max(Math.abs(b.tx - u.tx), Math.abs(b.tz - u.tz)));
    const s = ss[0];
    if (!s) return null;
    const x = tileX(world, s.tx), z = tileZ(world, s.tz);
    iso.target.x = x; iso.target.z = z; veil.follow = false;
    return { id: s.id };
  },
  veilScreenOf(id: number) {
    if (!veil) return null;
    const s = colony.haunts[veil.cl.haunt].spirits.find((q) => q.id === id)!;
    const x = tileX(world, s.tx), z = tileZ(world, s.tz);
    return toScreen(x, heightAt(world, x, z) + 1.1, z);
  },
};
Object.assign(window, { __game: { ...veilDebug, stats, addModel, clearance: () => trees.overlaps(obstaclesFor(world, colony.village)), scene, probeRender, colony, iso, setSpeed, select, setZoneTool, paint: (x: number, z: number, r: number, k: number) => paintZone(world, x, z, r, k as never), reveal: (x: number, z: number, r: number) => reveal(world, x, z, r), field: (pts: { x: number; z: number }[]) => createField(world, pts, world.campfire), tick: (m: number) => tick(colony, m), inspect: (t: { building?: number; project?: number; folk?: boolean }) => hud.inspect(t), refresh: () => { syncScene(); hud.render(); } } });
