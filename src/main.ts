import * as THREE from 'three';
import { createColony, hourOf, replan, syncAgents, tick } from './sim/colony';
import { alive, createCommunity, killSurvivor, log, recruit, setRole } from './sim/community';
import { SITE_KINDS, seatSpot, type SiteKind } from './sim/sites';
import { generateWorld, siteKindFor } from './sim/worldgen';
import { Zone, heightAt, idx, paintZone, reveal, tileX, tileZ, toTileX, toTileZ } from './sim/world';
import { createField, deleteField, fieldAtPoint } from './sim/fields';
import { daylightHours, seasonLook, snowCold } from './sim/calendar';
import { IsoCamera, Sky, createComposer, createRenderer, lightPeopleLayer } from './render/stage';
import { FogTexture, WearTexture, ZoneTexture, buildTerrain } from './render/terrain';
import { FieldsView, Precipitation } from './render/land';
import { buildVines } from './render/station';
import { buildSite } from './render/sites';
import { mergeStatic } from './render/merge';
import { TreeField } from './render/trees';
import { RESTORED_GLOW, buildRuins as buildOldWorld, registerCutaway, syncRuins } from './render/ruins';
import { loadAnimals, loadCharacters, loadParts } from './render/characters';
import { obstacleKey, obstaclesFor } from './render/clearance';
import { Bushes, Herds, buildFairyRing, buildRuins } from './render/nature';
import { Fireflies, Orb, Wisps } from './render/mystic';
import { FolkView } from './render/folk';
import { ClearingView } from './render/clearing';
import { ClearingMenu, ClearingPanel, spiritLabel } from './ui/clearing';
import { BuildPanel, type BuildTool } from './ui/build';
import { PlacementView } from './render/placement';
import { DEFS, canPlace, completeProject, footAt, placeProject, tierFor, type SiteKind as PlaceKind } from './sim/buildings';
import { FOLK_WORKS, addFae, orderFolkWork, whyNotFolkWork } from './sim/folk';
import { backyardSite, isBackyard, placeBackyard, plotAtPoint, whyNotBackyard } from './sim/backyard';
import { claimPlot, homeForAsker, outlinePlot, plotFailAt } from './sim/homes';
import { DraftTiles } from './render/drafttiles';
import { Footprints } from './render/footprints';
import { KeepOut } from './render/keepout';
import { Tray } from './ui/tray';
import { GfxPanel } from './ui/gfx';
import { dropAnsweredHomes } from './sim/requests';
import { RESTORE, requestRestore, whyNotRestore } from './sim/restore';
import { Rng } from './sim/rng';
import { playTurn } from './sim/clearbot';
import { HAUNT_RADIUS, THREAT_TEXT, act as veilAct, approachPoint, endTurn, finish, giveDistrict, gridOf, moveUnit, occupantsFor, reachOf, spiritAt, startClearing, teamReading, type Clearing } from './sim/haunt';
import { cells as reachCells, standable } from './sim/veilmove';
import { People } from './render/people';
import { Camp } from './render/camp';
import { HeapsView, VillageView, bedSlot, seatSlot } from './render/village';
import { scheduleGathering } from './sim/gatherings';
import { KNOWE_R, placeKnowe, raiseKnowe, settleFolk, whyNotKnowe } from './sim/townhouse';
import { atFire, atStockpile, fireFor, fires, moveFire, moveStockpile, stockpileAt, whyNotFire, whyNotHamletFire, whyNotStockpile } from './sim/hearth';
import { MyceliumView } from './render/mycelium';
import { myceliumDaily } from './sim/mycelium';
import { powered, whyLocked } from './sim/power';
import { markHeap, razeRuin, razeYield, stopTow, towHeap, whyNotRaze, whyNotTow, yardSpot } from './sim/salvage';
import { cancelProject, keepStanding, placeKindOf, pullDownShelter, takeDown } from './sim/dismantle';
import { markDepave } from './sim/depave';
import { TownhouseView } from './render/townhouse';
import { GatheringView } from './render/gathering';
import { PlotsView } from './render/plots';
import { seasonIndex } from './sim/calendar';
import { RoofControl, type RoofMode } from './render/roofs';
import { PhenomenaView, ResonanceTexture } from './render/veil';
import { councilFavourite, nudgeCalm, nudgeOmen, resolveCouncil } from './sim/council';
import { PIXEL, worldUniforms } from './render/util';
import { Hud, type ZoneTool } from './ui/hud';

import { canSave, makeSave, restore } from './sim/save';
import { deleteSave, readSave, writeSave } from './ui/storage';
import { ChronicleView } from './ui/chronicle';
import { startMenu, type StartChoice } from './ui/startmenu';
import type { Colony } from './sim/colony';

// ---------- simulation ----------
const params = new URLSearchParams(location.search);
// A saved game carries on (DESIGN §22.1) unless ?new, ?seed or ?site asks for a fresh one.
const fresh = params.has('new') || params.has('seed') || params.has('site');
const saved = fresh ? null : await readSave();
let loaded: Colony | null = null, unloadable: string | null = null;
if (saved) {
  const r = restore(saved);
  if (typeof r === 'string') { console.warn(r); unloadable = r; } else loaded = r;
}
let lsAuto = false;
try { lsAuto = localStorage.getItem('ss-autopilot') === '1'; } catch { /* storage may be unavailable */ }
// ?site=chapel (station, chapel, motel, farm, glasshouse) picks the start; otherwise the seed does.
const siteParam = params.get('site') as SiteKind | null;
// The start menu (DESIGN §22.4): continue, or a new village. Links with ?new, ?seed or ?site go straight in.
const choice: StartChoice = fresh
  ? { kind: 'new', site: siteParam && SITE_KINDS.includes(siteParam) ? siteParam : null, seed: Number(params.get('seed')) || null, autopilot: params.has('auto') || lsAuto }
  : await startMenu(loaded ? saved : null, unloadable ? `The saved village couldn't be opened: ${unloadable}` : null, params.has('auto') || lsAuto);
if (choice.kind === 'new') {
  if (loaded || unloadable) await deleteSave();
  loaded = null;
}
const seed = loaded?.world.seed ?? ((choice.kind === 'new' && choice.seed) || Date.now() % 100000);
const world = loaded?.world ?? generateWorld(seed, undefined, (choice.kind === 'new' && choice.site) || siteKindFor(seed));
document.querySelector('#place h1')!.textContent = world.site.place;
document.title = `Survive Story · ${world.site.place}`;
const community = loaded?.community ?? createCommunity(seed);
const colony = loaded ?? createColony(world, community);
if (loaded) log(community, `Carried on from day ${community.day}, saved ${new Date(saved!.savedAt).toLocaleString()}.`, 'info');
// Later reloads carry on this game, not start another.
if (fresh) { const q = new URLSearchParams(location.search); for (const k of ['new', 'seed', 'site']) q.delete(k); history.replaceState(null, '', `${location.pathname}${q.size ? `?${q}` : ''}${location.hash}`); }
// The player places buildings and draws plots (DESIGN §21); ?auto keeps the old self-planning village.
// Autopilot (?auto, or the button): the village plans and places for itself, and the council settles itself after 10 s.
// A game saved on autopilot carries on on autopilot; a new one takes the menu's choice.
let autopilot = choice.kind === 'new' ? choice.autopilot : params.has('auto') || lsAuto || loaded?.village.autoPlan === true;
try { localStorage.setItem('ss-autopilot', autopilot ? '1' : '0'); } catch { /* ignore */ }
colony.village.autoPlan = autopilot;
colony.village.autopilot = autopilot;

/** Game minutes per real second at each speed setting. */
const SPEEDS = [0, 2, 6, 16]; // labelled 1×, 3×, 8×
let speed = 1;

// ---------- scene ----------
const view = document.getElementById('view')!;
// Side panels stay between the place card and the footer (which wraps to two rows on narrower screens).
{
  const foot = document.getElementById('controls')!;
  const place = document.getElementById('place')!;
  const measure = () => {
    document.documentElement.style.setProperty('--foot', `${Math.ceil(window.innerHeight - foot.getBoundingClientRect().top)}px`);
    document.documentElement.style.setProperty('--top', `${Math.ceil(place.getBoundingClientRect().bottom)}px`);
  };
  new ResizeObserver(measure).observe(foot);
  new ResizeObserver(measure).observe(place);
  window.addEventListener('resize', measure);
  measure();
}
const renderer = createRenderer(view);
const scene = new THREE.Scene();
const iso = new IsoCamera(view.clientWidth / view.clientHeight);
iso.bounds = world.w / 2 - 8;
if (saved?.camera && loaded) { iso.target.x = saved.camera.x; iso.target.z = saved.camera.z; iso.zoom = iso.zoomGoal = saved.camera.zoom; iso.yaw = iso.yawGoal = saved.camera.yaw; }
const sky = new Sky(scene);
const { composer, bloom, grade, outline, syncXray } = createComposer(renderer, scene, iso.camera, view.clientWidth, view.clientHeight);
/**
 * Keep the composer's buffers the renderer's size: its pixel ratio follows the renderer's, and its
 * size is given in CSS pixels. (It was built round a render target, so it took that target's width as
 * its own: setting only the ratio would scale the buffers down a second time.)
 */
function sizeComposer() {
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(view.clientWidth, view.clientHeight);
}
/** The pixel look's parts, adjusted live (ui/gfx.ts, key G; DESIGN §34). */
let pixelScale = PIXEL || 1;
const gfx = new GfxPanel({
  pixel: !!PIXEL,
  defaults: { px: PIXEL || 1, outline: true, steps: PIXEL ? 20 : 0, surface: 1, bloom: 1, exposure: renderer.toneMappingExposure, shadows: true, tufts: true, grassPaint: 0 },
  apply(s, changed) {
    if (PIXEL && (changed === null || changed === 'px')) {
      pixelScale = s.px;
      renderer.setPixelRatio(1 / s.px);
      sizeComposer();
      renderer.domElement.style.imageRendering = s.px > 1 ? 'pixelated' : 'auto';
      iso.snapRows = Math.round(view.clientHeight / s.px);
    }
    if (outline) outline.enabled = s.outline;
    if (PIXEL) grade.uniforms.uSteps.value = s.steps;
    worldUniforms.uSurface.value = s.surface;
    worldUniforms.uGrassPaint.value = s.grassPaint;
    renderer.toneMappingExposure = s.exposure;
    if (changed === null || changed === 'shadows') {
      if (renderer.shadowMap.enabled !== s.shadows) {
        renderer.shadowMap.enabled = s.shadows;
        scene.traverse((o) => { const m = (o as THREE.Mesh).material; if (m) for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true; });
      }
    }
    const tufts = scene.getObjectByName('tufts');
    if (tufts) tufts.visible = s.tufts;
  },
});
renderer.localClippingEnabled = true;
const roofs = new RoofControl();

const fog = new FogTexture(world);
worldUniforms.uFogTex.value = fog.texture;
const zoneTex = new ZoneTexture(world);
worldUniforms.uZoneTex.value = zoneTex.texture;
const wear = new WearTexture(world);
worldUniforms.uWearTex.value = wear.texture;
/** Footprints in the snow, and how deep the snow lies (DESIGN §35). */
const footprints = new Footprints(world);
worldUniforms.uFootTex.value = footprints.texture;
let snowCover = -1, roofSnow = -1, lastSnowMinute = -1;
const resonance = new ResonanceTexture(colony);
worldUniforms.uResTex.value = resonance.texture;
worldUniforms.uFogSize.value = world.w;

const terrainGroup = buildTerrain(world);
let lastGround = 0;
terrainGroup.name = 'terrain';
scene.add(terrainGroup);
gfx.refresh();
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
/** Where people sit round every fire: one seat per person who gathers there (sim: colony.ts#seatOf). */
function fireSeats(col: typeof colony) {
  const out: { x: number; z: number }[] = [];
  for (const f of fires(col)) {
    const n = col.agents.filter((a) => fireFor(col, a.id).id === f.id).length;
    // Exactly the sim's ring when anyone gathers there; a few seats waiting at an unused fire.
    const k = n > 0 ? n : 3;
    for (let i = 0; i < k; i++) out.push(seatSpot(f, i, k));
  }
  return out;
}
/** The found shelter pulled down (DESIGN §29): the site's old buildings leave the scene. */
const siteGone = () => !!colony.village.buildings.find((b) => b.kind === 'store')?.gone;
function syncSiteGone() {
  if (siteGone() && station.group.parent) scene.remove(station.group, vines.walls, vines.roofs);
}
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
registerCutaway(oldWorld, roofs);

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
const gatheringView = new GatheringView(world);
scene.add(gatheringView.group);
const fields = new FieldsView(world);
fields.group.name = 'fields';
scene.add(fields.group);
const precip = new Precipitation();
scene.add(precip.group);
const phenomena = new PhenomenaView(colony, document.getElementById('labels')!);
scene.add(phenomena.group);
const folkView = new FolkView(colony, document.getElementById('labels')!);
const townhouse = new TownhouseView(colony);
scene.add(townhouse.group);
const myceliumView = new MyceliumView(colony);
scene.add(myceliumView.group);
scene.add(folkView.group);
const clearingView = new ClearingView(colony, document.getElementById('labels')!);
scene.add(clearingView.group);
// Inside the Veil the world has its own dim light, enough to see into the houses.
const veilLight = new THREE.HemisphereLight('#c9b8ff', '#4a3a6a', 0);
scene.add(veilLight);
let veilView = false;
let omenMode = false;
const people = new People(world);
people.group.name = 'people';
scene.add(people.group);
// Character models load in the background; until then people are simple figures.
Promise.all([loadCharacters(), loadParts().catch((e) => { console.warn('parts:', e); return null; })])
  .then(([kit, parts]) => { people.setKit(kit, parts); folkView.setKit(kit); lightPeopleLayer(scene); }).catch((e) => console.warn('characters:', e));

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
  syncSiteGone();
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
/** The council's answer. Building choices go straight to placement (DESIGN §21); the day waits until it's placed. */
function answerCouncil(id: number, dream: boolean, settle: boolean) {
  const p = colony.council.active?.proposals.find((x) => x.id === id);
  if (!p || !resolveCouncil(colony, id, dream, settle)) return;
  councilHeld = false;
  // Under autopilot the village sites it itself (village.priority, planHome).
  const manual = colony.village.autoPlan === false;
  if (manual && p.kind === 'build' && p.build) councilPlace(p.build);
  else if (manual && p.kind === 'home' && !colony.village.plots.some((q) => !q.household)) councilPlace('plot');
  else resumeAfterCouncil();
  hud.render();
}

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
  onCouncil(id, dream, settle) { answerCouncil(id, dream, !!settle); },
  onFolkAsk() { hud.inspect(null); buildPanel.show(); document.querySelector('#build h3.folk')?.scrollIntoView({ block: 'start' }); },
  onAgreed(what) { setBuild(what === 'plot' ? { kind: 'plot' } : { kind: 'place', site: what, turn: 0 }); },
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
  onTakeDown(id, moving) {
    const b = colony.village.buildings.find((x) => x.id === id);
    if (!b) return;
    const why = takeDown(colony, b, moving);
    if (why) return;
    // Moving: place the same kind again straight away (its materials come back when it's down);
    // a home: draw the family a new plot (they are first in line for it).
    const kind = moving ? placeKindOf(b) : null;
    if (kind) setBuild({ kind: 'place', site: kind, turn: 0 });
    else if (moving && b.kind === 'home') setBuild({ kind: 'plot' }, 'Draw the family a new plot: their home goes up there.');
    hud.render();
  },
  onKeep(id) { keepStanding(colony, id); hud.render(); },
  onMoveCamp(which) { setBuild({ kind: which }); },
  onRuin(id, what) {
    const r = world.ruins[id];
    if (!r) return;
    const res = what === 'restore' ? requestRestore(colony, id) : razeRuin(colony, r);
    if (typeof res === 'string') log(community, `${r.name}: ${res}`, 'info');
    syncScene();
    hud.inspect({ ruin: id });
  },
  onHeap(id, what) {
    const h = world.heaps[id];
    if (!h) return;
    if (what === 'strip' || what === 'unstrip') markHeap(colony, h, what === 'strip');
    else if (what === 'stoptow') stopTow(colony, h);
    else if (what === 'tow') { setBuild({ kind: 'tow', heap: id }); return; }
    else if (what === 'yard') {
      const at = yardSpot(colony, h);
      const why = at ? towHeap(colony, h, at.x, at.z) : 'There is no room beside the stockpile for it.';
      if (why) { hud.note(why); return; }
    }
    hud.render();
  },
  onCallOff(id) {
    const p = colony.village.projects.find((x) => x.id === id);
    if (p && !cancelProject(colony, p)) { hud.inspect(null); syncScene(); }
    hud.render();
  },
});

const roofBtn = document.getElementById('roof-btn')!;
/** Set the roof view (the Veil opens buildings up for the team; it puts things back after). */
function setRoofs(mode: RoofMode) {
  roofs.set(mode);
  villageView.sync();
  roofBtn.textContent = `Roofs: ${mode === 'cutaway' ? 'cut away' : mode}`;
  roofBtn.setAttribute('aria-pressed', String(mode !== 'shown'));
}
function cycleRoofs() {
  const m = roofs.next();
  villageView.sync();
  roofBtn.textContent = `Roofs: ${m === 'cutaway' ? 'cut away' : m}`;
  roofBtn.setAttribute('aria-pressed', String(m !== 'shown'));
}
roofBtn.addEventListener('click', cycleRoofs);

/** See-through woods (worldUniforms.uThin): the Folk's Wild thinned by default, so their works show. */
const woodsBtn = document.getElementById('woods-btn')!;
const WOODS = ['solid', 'Wild ghosted', 'all ghosted'];
function setWoods(mode: number) {
  worldUniforms.uThin.value = mode;
  trees.setGhosts(mode);
  woodsBtn.textContent = `Woods: ${WOODS[mode]}`;
  woodsBtn.setAttribute('aria-pressed', String(mode !== 0));
  try { localStorage.setItem('woods', String(mode)); } catch { /* per-viewer nicety only */ }
}
let savedWoods = 1;
try { const v = Number(localStorage.getItem('woods') ?? 1); if (v === 0 || v === 1 || v === 2) savedWoods = v; } catch { /* default */ }
setWoods(savedWoods);
woodsBtn.addEventListener('click', () => setWoods((worldUniforms.uThin.value + 1) % 3));

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
const ZONE_OF: Record<ZoneTool, number> = { home: Zone.Home, field: Zone.Field, woodlot: Zone.Woodlot, sacred: Zone.Sacred, fishing: Zone.Fishing, wild: Zone.Wild, depave: Zone.None, erase: Zone.None };
function setZoneTool(mode: ZoneTool | null) {
  zoneTool = mode;
  if (mode && build) setBuild(null);
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
draftLine.visible = false; draftDots.visible = false; // replaced by lit ground tiles (drafttiles.ts)
scene.add(draftLine, draftDots);
const draftTiles = new DraftTiles(world);
scene.add(draftTiles.group);
/** Where a drawn plot can't go, tinted around the cursor while drawing one. */
const keepOut = new KeepOut(world, colony.village);
scene.add(keepOut.group);
function groundAt(clientX: number, clientY: number): THREE.Vector3 | null {
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, iso.camera);
  return raycaster.ray.intersectPlane(groundPlane, hitPoint) ? hitPoint.clone() : null;
}
function drawDraft(cursor?: THREE.Vector3 | null) {
  // On the ground's grid (DESIGN §34): the cursor tile, the corners, and every tile the outline runs through.
  draftTiles.update(draft, drafting() ? cursor ?? null : null);
}
function clearDraft() { draft.length = 0; drawDraft(); }
function closeDraft() {
  if (build?.kind === 'plot') {
    if (draft.length >= 3) {
      const rng = new Rng((world.seed ^ (community.day * 7919) ^ (colony.village.nextId * 104729)) >>> 0);
      const plan = outlinePlot(world, colony.village, draft.slice(), rng);
      if (typeof plan === 'string') { keepOut.markFail(plotFailAt); buildPanel.hint(`${plan} (Marked in yellow.) Keep clicking corners, or Esc to start again.`); return; }
      const plot = claimPlot(colony, plan, rng);
      // Drawn in answer to a household's ask: it is theirs, and their ask is answered.
      const why = plotFor ? homeForAsker(colony, plotFor, plot) : 'none';
      if (why) log(community, `A plot is pegged out: ${plot.tiles.length} squares, the house to stand near the front. It waits for a household.`, 'good');
      replan(colony);
      dropAnsweredHomes(colony);
      tray.render();
    }
    clearDraft();
    setBuild(null);
    syncScene();
    hud.render();
    return;
  }
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
/** A field clicked once for removal, waiting for the second click. */
let fieldArmed: { id: number; until: number } | null = null;
function fieldClick(clientX: number, clientY: number) {
  const g = groundAt(clientX, clientY);
  if (!g) return;
  if (!draft.length && build?.kind !== 'plot') {
    const f = fieldAtPoint(world, g.x, g.z);
    if (f) {
      // Click twice to remove (browser dialogs are blocked where the game is embedded).
      if (fieldArmed?.id === f.id && performance.now() < fieldArmed.until) {
        fieldArmed = null;
        buildPanel.hint(null);
        deleteField(world, f.id); replan(colony); hud.render();
      } else {
        fieldArmed = { id: f.id, until: performance.now() + 4000 };
        buildPanel.hint('Click the field again to remove it. Anything growing in it will be lost.');
        setTimeout(() => { if (fieldArmed?.id === f.id) { fieldArmed = null; buildPanel.hint(null); } }, 4000);
      }
      return;
    }
  }
  if (draft.length >= 3 && Math.hypot(g.x - draft[0].x, g.z - draft[0].z) < 1.2) { closeDraft(); return; }
  // Corners go on the grid, at the centre of the tile clicked.
  draft.push(draftTiles.snap(g));
  drawDraft(g);
}

// ---------- the build menu (DESIGN §21) ----------
let build: BuildTool | null = null;
/** Why this tool is open, when the council sent it (kept at the front of the hint). */
let buildWhy = '';
const lastPointer = { x: 0, y: 0 };
const placement = new PlacementView(world);
scene.add(placement.group);
const buildPanel = new BuildPanel(colony, (tool) => setBuild(tool));
/** The request tray: everyday asks, answered whenever (DESIGN §23.4). */
const tray = new Tray(colony, {
  drawPlot: (q) => { setBuild({ kind: 'plot' }, q.text); plotFor = q.household ?? 0; },
  place: (q) => { iso.target.x = q.x; iso.target.z = q.z; setBuild({ kind: 'place', site: q.kind as PlaceKind, turn: 0 }, q.text); },
  placeKnowe: () => { const m = world.folk.mound; iso.target.x = m.x; iso.target.z = m.z; setBuild({ kind: 'knowe' }); },
  show: (q) => { select(q.by); const a = colony.agents.find((x) => x.id === q.by); if (a) { iso.target.x = a.x; iso.target.z = a.z; } },
  changed: () => hud.render(),
});
/** Drawing an outline: a field, or a plot for a home. */
function drafting() { return zoneTool === 'field' || build?.kind === 'plot'; }
/** The household a plot is being drawn for (from their ask in the tray), or 0. */
let plotFor = 0;
function setBuild(tool: BuildTool | null, why = '') {
  plotFor = 0;
  if (tool) { setZoneTool(null); setOmen(false); hud.inspect(null); }
  else if (resumeAfterBuild) { resumeAfterBuild = false; resumeAfterCouncil(); }
  build = tool;
  buildWhy = tool ? why : '';
  if (tool?.kind !== 'plot') keepOut.show(null);
  clearDraft();
  placement.hide();
  draftLine.material.color.set(tool?.kind === 'plot' ? '#f4ecd0' : '#f0a040');
  buildPanel.hint(!tool ? null
    : (why ? `${why} ` : '') + (tool.kind === 'plot' ? 'Click the corners of the plot; click the first corner (or press Enter) to close it. The side nearest a path becomes the front. Esc to stop.'
    : tool.kind === 'restore' ? 'Click a ruin in a cleared district to restore it. Esc to stop.'
    : tool.kind === 'salvage' ? 'Click a wrecked car or junk heap to strip and clear it, or a ruin in a cleared district of yours to pull it down. Esc to stop.'
    : tool.kind === 'tow' ? 'Choose where to push the wreck: open ground, clear of plots, fields and trees, within 60 of where it stands. Esc to stop.'
    : tool.kind === 'fire' ? 'Choose where the fire goes: open ground, clear of buildings and the stockpile, with room round it for the seats and bedrolls. Esc to stop.'
    : tool.kind === 'stockpile' ? 'Choose where the stockpile goes: open ground, clear of the fire and buildings. Esc to stop.'
    : tool.kind === 'knowe' ? 'Choose where the new knowe rises: open ground round the Great Hill, in the Wild or on unclaimed land. Trees there are taken into the hill. Esc to stop.'
    : tool.kind === 'folk' ? `Ask the Folk for a ${FOLK_WORKS[tool.work].name.toLowerCase()}: click a spot in the Wild. They build it at night. Esc to stop.`
    : isBackyard(tool.site) ? `Click a household's plot to give them the ${DEFS[tool.site].name[tierFor(colony.village, community, tool.site)].toLowerCase()}: it goes at the back of their yard, and one of them works it. Esc to stop.`
    : `Place the ${DEFS[tool.site].name[tierFor(colony.village, community, tool.site)].toLowerCase()}: click to place, right-click or T to turn it. Esc to stop.`));
}

// ---------- the council waits for an answer (DESIGN §21.5) ----------
let councilHeld = false, resumeSpeed = 1, resumeAfterBuild = false;
/** Real time (ms) when an unanswered council settles itself under autopilot; the pointer over the council holds it. */
let councilAutoAt = 0;
const COUNCIL_AUTO_MS = 10000;
function setAutopilot(on: boolean) {
  autopilot = on;
  colony.village.autoPlan = on;
  colony.village.autopilot = on;
  try { localStorage.setItem('ss-autopilot', on ? '1' : '0'); } catch { /* ignore */ }
  document.getElementById('autopilot-btn')!.setAttribute('aria-pressed', String(on));
  if (on) { setBuild(null); councilAutoAt = performance.now() + COUNCIL_AUTO_MS; replan(colony); }
  log(community, on ? 'Autopilot on: the village plans and builds for itself, and the council settles itself if you don\'t answer.' : 'Autopilot off: placement is in your hands again.', 'info');
  hud.render();
}
document.getElementById('autopilot-btn')!.addEventListener('click', () => setAutopilot(!autopilot));
document.getElementById('gfx-btn')?.addEventListener('click', () => gfx.toggle());
document.getElementById('autopilot-btn')!.setAttribute('aria-pressed', String(autopilot));
document.getElementById('council')!.addEventListener('pointermove', () => { if (autopilot) councilAutoAt = performance.now() + COUNCIL_AUTO_MS; });
/** Each frame: under autopilot, count down an unanswered council and settle it on the favourite. */
function councilAutopilot() {
  if (!autopilot || !colony.council.active) return;
  if (!councilAutoAt) councilAutoAt = performance.now() + COUNCIL_AUTO_MS;
  const left = Math.ceil((councilAutoAt - performance.now()) / 1000);
  const el = document.getElementById('council-auto');
  if (el) { const t = `Autopilot: settling in ${Math.max(0, left)} s (hover here to hold)`; if (el.textContent !== t) el.textContent = t; }
  if (left > 0) return;
  councilAutoAt = 0;
  const fav = councilFavourite(colony);
  if (fav) answerCouncil(fav.id, false, true);
}

function holdForCouncil() {
  councilHeld = true;
  councilAutoAt = performance.now() + COUNCIL_AUTO_MS;
  resumeSpeed = speed;
  if (speed > 0) lastSpeed = speed;
  setSpeed(0);
  buildPanel.close();
  hud.render();
}
function resumeAfterCouncil() {
  if (resumeSpeed > 0 && !colony.council.active) setSpeed(resumeSpeed);
}
function councilPlace(what: PlaceKind | 'plot') {
  const why = what === 'plot' ? 'The council said yes to a house. Draw them a plot.'
    : `The council agreed: ${DEFS[what].name[what === 'lantern' ? 0 : colony.village.tier].toLowerCase()}. Choose where it goes.`;
  setBuild(what === 'plot' ? { kind: 'plot' } : { kind: 'place', site: what, turn: 0 }, why);
  resumeAfterBuild = true;
}
/** The old-world building under a point, if any. */
/** A wreck or junk heap with scrap left, within a step of this point. */
function heapAtPoint(x: number, z: number) {
  let best: (typeof world.heaps)[number] | null = null, bd = 1.6;
  for (const h of world.heaps) {
    if (h.scrap <= 0) continue;
    const d = Math.hypot(tileX(world, h.tx) - x, tileZ(world, h.tz) - z);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}
function ruinAtPoint(x: number, z: number) {
  return world.ruins.find((r) => {
    if (r.razed) return false;
    const cs = Math.cos(r.yaw), sn = Math.sin(r.yaw), px = x - r.x, pz = z - r.z;
    return Math.abs(px * cs - pz * sn) <= r.w / 2 + 0.3 && Math.abs(px * sn + pz * cs) <= r.d / 2 + 0.3;
  });
}
function placeHover(cx: number, cy: number) {
  if (!build || build.kind === 'plot') return;
  const g = groundAt(cx, cy);
  if (!g) { placement.hide(); return; }
  if (build.kind === 'salvage') {
    const h = heapAtPoint(g.x, g.z);
    const r = h ? null : ruinAtPoint(g.x, g.z) ?? null;
    const why = r ? whyNotRaze(colony, r) : null;
    placement.showRuin(r, !why);
    buildPanel.hint(h ? `${h.kind === 'car' ? 'A wrecked car' : 'A junk heap'} (${h.scrap} scrap)${h.marked ? ': already marked' : '. Click to strip it and clear it away.'}`
      : r ? (why ? `${r.name}: ${why}` : `${r.name}: click to pull it down for about ${razeYield(r)} scrap.`) : 'Click a wrecked car, a junk heap, or a ruin in a cleared district of yours. Esc to stop.');
    return;
  }
  if (build.kind === 'restore') {
    const r = ruinAtPoint(g.x, g.z) ?? null;
    const why = r ? whyNotRestore(colony, r) : null;
    placement.showRuin(r, !why);
    buildPanel.hint((buildWhy ? `${buildWhy} ` : '') + (r ? (why ? `${r.name}: ${why}` : `${r.name}: becomes ${RESTORE[r.kind]!.name(r)}. Click to restore it.`) : 'Click a ruin in a cleared district to restore it. Esc to stop.'));
    return;
  }
  if (build.kind === 'tow') {
    const h = world.heaps[build.heap];
    const why = h ? whyNotTow(colony, h, g.x, g.z) : 'It is gone.';
    placement.showFoot({ tx: toTileX(world, g.x) - (h?.kind === 'car' ? 1 : 0), tz: toTileZ(world, g.z) - (h?.kind === 'car' ? 1 : 0), w: h?.kind === 'car' ? 3 : 1, d: h?.kind === 'car' ? 3 : 1 }, 0, 0.6, !why);
    buildPanel.hint(why ?? 'Click to push it here. Esc to stop.');
    return;
  }
  if (build.kind === 'fire' || build.kind === 'stockpile') {
    const fire = build.kind === 'fire';
    const why = fire ? whyNotFire(colony, g.x, g.z) : whyNotStockpile(colony, g.x, g.z);
    if (fire) placement.showFoot({ tx: toTileX(world, g.x) - 2, tz: toTileZ(world, g.z) - 2, w: 5, d: 5 }, 0, 0.8, !why);
    else {
      const r = stockpileAt(colony, g.x, g.z);
      placement.showFoot({ tx: toTileX(world, r.x0), tz: toTileZ(world, r.z0), w: Math.max(1, Math.round(r.x1 - r.x0)), d: Math.max(1, Math.round(r.z1 - r.z0)) }, 0, 1.2, !why);
    }
    buildPanel.hint(why ?? `Click to move the ${fire ? 'fire' : 'stockpile'} here. Esc to stop.`);
    return;
  }
  if (build.kind === 'knowe') {
    const why = colony.folk.pendingKnowe ? whyNotKnowe(colony, g.x, g.z) : 'No knowe is waiting to be raised.';
    const R = Math.ceil(KNOWE_R);
    placement.showFoot({ tx: toTileX(world, g.x) - R, tz: toTileZ(world, g.z) - R, w: R * 2 + 1, d: R * 2 + 1 }, 0, 1.8, !why);
    buildPanel.hint(why ?? 'Click to raise the knowe here. Esc to stop.');
    return;
  }
  if (build.kind === 'folk') {
    const tx = toTileX(world, g.x), tz = toTileZ(world, g.z);
    const why = whyNotFolkWork(colony, tileX(world, tx), tileZ(world, tz));
    placement.showFoot({ tx, tz, w: 1, d: 1 }, 0, 0.5, !why);
    buildPanel.hint(why ?? `Click to ask for a ${FOLK_WORKS[build.work].name.toLowerCase()} here. Esc to stop.`);
    return;
  }
  if (isBackyard(build.site)) {
    // Backyard trades: pick a household's plot; the spot at the back is found for you.
    const plot = plotAtPoint(colony, g.x, g.z);
    const why = whyNotBackyard(colony, plot, build.site);
    const site = plot && !why ? backyardSite(colony, plot, build.site) : null;
    if (site) placement.showFoot(site.foot, site.facing, 2.2, true); else placement.hideFoot();
    buildPanel.hint((buildWhy ? `${buildWhy} ` : '') + (why ?? `Click to give this household the ${DEFS[build.site].name[0].toLowerCase()}. Esc to stop.`));
    return;
  }
  const { foot, facing } = footAt(build.site, toTileX(world, g.x), toTileZ(world, g.z), build.turn);
  // A hamlet fire goes only in a resettled district, away from other fires (DESIGN §28).
  const hamlet = build.site === 'hearth' ? whyNotHamletFire(colony, g.x, g.z) : null;
  if (hamlet) { placement.showFoot(foot, facing, 0.8, false); buildPanel.hint(`${hamlet} Esc to stop.`); return; }
  const fit = canPlace(world, colony.village, build.site, foot);
  placement.showFoot(foot, facing, build.site === 'lantern' ? 2.6 : 2.4, fit.ok);
  buildPanel.hint((buildWhy ? `${buildWhy} ` : '') + (fit.ok ? `Click to place. ${fit.trees.length ? `${fit.trees.length} tree${fit.trees.length > 1 ? 's' : ''} will come down.` : ''} Right-click or T to turn.` : `${fit.why ?? 'It won\'t fit there.'} Right-click or T to turn; Esc to stop.`));
}
function placeClick(cx: number, cy: number) {
  if (!build || build.kind === 'plot') return;
  const g = groundAt(cx, cy);
  if (!g) return;
  if (build.kind === 'salvage') {
    const h = heapAtPoint(g.x, g.z);
    if (h) { const why = markHeap(colony, h); if (why) { buildPanel.hint(why); return; } }
    else {
      const r = ruinAtPoint(g.x, g.z);
      if (!r) return;
      const why = razeRuin(colony, r);
      if (why) { buildPanel.hint(`${r.name}: ${why}`); return; }
    }
    // Stay in the tool: mark several in a row.
    hud.render();
    return;
  }
  if (build.kind === 'restore') {
    const r = ruinAtPoint(g.x, g.z);
    if (!r) return;
    const res = requestRestore(colony, r.id);
    if (typeof res === 'string') { buildPanel.hint(`${r.name}: ${res}`); return; }
  } else if (build.kind === 'tow') {
    const h = world.heaps[build.heap];
    const why = h ? towHeap(colony, h, g.x, g.z) : 'It is gone.';
    if (why) { buildPanel.hint(why); return; }
  } else if (build.kind === 'fire' || build.kind === 'stockpile') {
    const why = build.kind === 'fire' ? moveFire(colony, g.x, g.z) : moveStockpile(colony, g.x, g.z);
    if (why) { buildPanel.hint(why); return; }
  } else if (build.kind === 'knowe') {
    const res = placeKnowe(colony, g.x, g.z);
    if (typeof res === 'string') { buildPanel.hint(res); return; }
    log(community, `The village chose the place, and the Folk agreed: overnight ${res.name} rose beside ${world.folk.mound.name}.`, 'strange');
  } else if (build.kind === 'folk') {
    const res = orderFolkWork(colony, build.work, tileX(world, toTileX(world, g.x)), tileZ(world, toTileZ(world, g.z)));
    if (typeof res === 'string') { buildPanel.hint(res); return; }
  } else if (isBackyard(build.site)) {
    const plot = plotAtPoint(colony, g.x, g.z);
    const res = plot ? placeBackyard(colony, plot.id, build.site) : whyNotBackyard(colony, undefined, build.site)!;
    if (typeof res === 'string') { buildPanel.hint(res); return; }
    if (colony.village.priority === build.site) colony.village.priority = undefined;
  } else {
    // Power wants know-how (power.ts): joiners for a windmill, someone who knows wiring for panels and turbines.
    const locked = whyLocked(colony, build.site) ?? (build.site === 'hearth' ? whyNotHamletFire(colony, g.x, g.z) : null);
    if (locked) { buildPanel.hint(locked); return; }
    const { foot, facing } = footAt(build.site, toTileX(world, g.x), toTileZ(world, g.z), build.turn);
    const res = placeProject(world, colony.village, community, build.site, foot, facing);
    if (typeof res === 'string') { buildPanel.hint(`${res} Right-click or T to turn; Esc to stop.`); return; }
  }
  setBuild(null);
  syncScene();
  hud.render();
}

function paintAt(clientX: number, clientY: number) {
  if (!zoneTool || zoneTool === 'field') return;
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, iso.camera);
  if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
  // Depave marks paving to be broken up (DESIGN §24.12); Erase also unmarks it.
  if (zoneTool === 'depave') { markDepave(world, hitPoint.x, hitPoint.z, 2.5, true); return; }
  if (zoneTool === 'erase') markDepave(world, hitPoint.x, hitPoint.z, 2.5, false);
  paintZone(world, hitPoint.x, hitPoint.z, 2.5, ZONE_OF[zoneTool] as never);
}

function setSpeed(level: number) {
  // The council is waiting for an answer: remember the wish, and resume at it once answered.
  if (level > 0 && colony.council.active) { resumeSpeed = level; level = 0; }
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
interface VeilMode {
  roofMode: RoofMode; follow: boolean; cl: Clearing; sel: number; saved: Map<number, { x: number; z: number }>;
  /** The point under the cursor (world units). */
  hover: { x: number; z: number } | null;
  camera: { x: number; z: number; zoom: number };
  /** Each walker's progress along the way they last walked. */
  walking: Map<number, { trail: { x: number; z: number }[]; i: number }>;
}
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
    if (a) { saved.set(u.id, { x: a.x, z: a.z }); a.x = u.x; a.z = u.z; }
  }
  const d = world.districts[colony.haunts[cl.haunt].district];
  const roofMode = roofs.mode;
  setRoofs('cutaway');
  veil = { roofMode, follow: true, cl, sel: cl.units[0]?.id ?? 0, saved, hover: null, camera: { x: iso.target.x, z: iso.target.z, zoom: iso.zoomGoal }, walking: new Map() };
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
  setRoofs(veil.roofMode);
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
    const err = moveUnit(colony, veil.cl, by, t.x, t.z);
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
    const x = a ? a.x : u.x, z = a ? a.z : u.z;
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

/** The best place this turn to walk to beside a target (or as near as it can get). */
function approachTo(target: { x: number; z: number }) {
  if (!veil) return null;
  const u = veil.cl.units.find((x) => x.id === veil!.sel && x.state === 'in');
  return u ? approachPoint(colony, veil.cl, u, target) : null;
}

function veilClick(cx: number, cy: number, button: number) {
  if (!veil || veil.cl.outcome) return;
  if (veilMenu.isOpen) { veilMenu.close(); return; }
  const hit = veilPick(cx, cy);
  if (hit && 'spirit' in hit) {
    const s = colony.haunts[veil.cl.haunt].spirits.find((x) => x.id === hit.spirit)!;
    veilMenu.open(cx, cy, veil.cl, veil.sel, hit, approachTo(spiritAt(colony, s)));
    return;
  }
  if (hit && 'unit' in hit) {
    if (button === 0 && hit.unit !== veil.sel) { veil.sel = hit.unit; veil.follow = true; renderVeil(); return; }
    const u = veil.cl.units.find((x) => x.id === hit.unit)!;
    veilMenu.open(cx, cy, veil.cl, veil.sel, hit.unit === veil.sel ? { self: true } : { ally: hit.unit }, approachTo(u));
    return;
  }
  if (button !== 0) return;
  const g = groundAt(cx, cy);
  if (!g) return;
  const u = veil.cl.units.find((x) => x.id === veil!.sel && x.state === 'in');
  if (!u) return;
  const err = moveUnit(colony, veil.cl, u.id, g.x, g.z);
  if (err) veilMenu.tip(cx, cy, err);
  else afterVeilAction();
}

/** Hovering in the Veil: say what it is and that it can be clicked. */
function veilHover(cx: number, cy: number) {
  if (!veil || veil.cl.outcome) { veilMenu.tip(0, 0, null); return; }
  const hit = veilPick(cx, cy);
  if (!hit) {
    // Over the ground: what the walk would cost, and what would reach them there.
    const p = clearingView.preview;
    if (!p) { veilMenu.tip(0, 0, null); return; }
    const u = veil.cl.units.find((x) => x.id === veil!.sel);
    const cost = p.cost > 1 && (u?.ap ?? 0) > 1 ? 'Dash here: the whole turn' : 'Walk here: 1 action';
    const within = p.threats.map((th) => `${spiritLabel(th.spirit, teamReading(colony, veil!.cl, th.spirit) === 'none' ? 'chill' : teamReading(colony, veil!.cl, th.spirit))} (${THREAT_TEXT[th.threat]})`);
    veilMenu.tip(cx, cy, within.length ? `${cost} · within reach of ${within.join(', ')}` : cost);
    return;
  }
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

/** The building (or house going up) under the pointer, shown in the card; false if none. */
function inspectBuildingAt(clientX: number, clientY: number): boolean {
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, iso.camera);
  const bh = raycaster.intersectObjects([villageView.group, plotsView.group], true)[0];
  let q: THREE.Object3D | null = bh?.object ?? null;
  while (q && q.userData.buildingId === undefined && q.userData.projectId === undefined && q.userData.plotId === undefined) q = q.parent;
  if (!q) return false;
  if (q.userData.plotId !== undefined) {
    const pid = q.userData.plotId as number;
    const home = colony.village.buildings.find((b) => b.plot === pid && b.kind === 'home');
    const proj = colony.village.projects.find((x) => !x.done && x.plot === pid);
    if (home) hud.inspect({ building: home.id }); else if (proj) hud.inspect({ project: proj.id }); else return false;
    return true;
  }
  hud.inspect(q.userData.buildingId !== undefined ? { building: q.userData.buildingId } : { project: q.userData.projectId });
  return true;
}
/** The fire or the stockpile under the pointer (right-click: their card, to move them). */
function inspectCampAt(clientX: number, clientY: number): boolean {
  const g = groundAt(clientX, clientY);
  if (!g) return false;
  if (atFire(colony, g.x, g.z)) { hud.inspect({ camp: 'fire' }); return true; }
  if (atStockpile(colony, g.x, g.z)) { hud.inspect({ camp: 'stockpile' }); return true; }
  return false;
}
/**
 * A building of the old world under the pointer (DESIGN §37): a restored one opens as the building it now is
 * (a home shows its household); one still standing empty opens its own card, to restore or pull down.
 */
function inspectRuinAt(clientX: number, clientY: number): boolean {
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, iso.camera);
  const hit = raycaster.intersectObjects([oldWorld], true)[0];
  const p = hit?.point ?? groundAt(clientX, clientY);
  if (!p) return false;
  const ruin = ruinAtPoint(p.x, p.z);
  if (!ruin || !world.pois.some((q) => q.kind === 'ruin' && q.name === world.districts[ruin.district]?.name && q.discovered)) return false;
  const b = colony.village.buildings.find((x) => x.ruin === ruin.id);
  hud.inspect(b ? { building: b.id } : { ruin: ruin.id });
  return true;
}
/** A wreck or junk heap under the pointer (right-click: its card, DESIGN §30). */
function inspectHeapAt(clientX: number, clientY: number): boolean {
  const g = groundAt(clientX, clientY);
  const h = g ? heapAtPoint(g.x, g.z) : null;
  if (!h) return false;
  hud.inspect({ heap: h.id });
  return true;
}
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
  lastPointer.x = e.clientX; lastPointer.y = e.clientY;
  if (drafting()) drawDraft(groundAt(e.clientX, e.clientY));
  if (build?.kind === 'plot') keepOut.show(groundAt(e.clientX, e.clientY));
  if (build && build.kind !== 'plot' && !pointers.size) placeHover(e.clientX, e.clientY);
  if (veil) { const g = groundAt(e.clientX, e.clientY); veil.hover = g ? { x: g.x, z: g.z } : null; if (!pointers.size) veilHover(e.clientX, e.clientY); }
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
  if (drafting() && p?.button === 0) {
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) <= 6) fieldClick(e.clientX, e.clientY);
    return;
  }
  if (build && build.kind !== 'plot' && p && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) <= 6) {
    if (p.button === 2 && build.kind === 'place') { build.turn = (build.turn + 1) % 4; placeHover(e.clientX, e.clientY); return; }
    if (p.button === 0) { placeClick(e.clientX, e.clientY); return; }
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
  if (!p || Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) return;
  // A right-click on a building opens its card, where it can be taken down or moved (DESIGN §24.13).
  if (p.button === 2) { if (!inspectBuildingAt(e.clientX, e.clientY) && !inspectCampAt(e.clientX, e.clientY) && !inspectHeapAt(e.clientX, e.clientY)) inspectRuinAt(e.clientX, e.clientY); return; }
  if (p.button !== 0) return;
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
    // A building of the old world (restored: the building it is now), before its district (DESIGN §37)?
    if (inspectRuinAt(e.clientX, e.clientY)) return;
    // A district of the old world?
    const d = world.districts.find((x) => Math.hypot(hitPoint.x - x.x, hitPoint.z - x.z) < 20
      && world.pois.some((q) => q.kind === 'ruin' && q.name === x.name && q.discovered));
    if (d) { hud.inspect({ district: d.id }); return; }
  }
  // Not a person: a building?
  const bh = raycaster.intersectObjects(siteGone() ? [villageView.group, plotsView.group] : [villageView.group, plotsView.group, station.group], true)[0];
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
    if (!st.gone && Math.abs(p.x - S.x) < S.w / 2 + 0.4 && Math.abs(p.z - S.z) < S.d / 2 + 0.6) { hud.inspect({ building: st.id }); return; }
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
  else if (k === 'c') chronicle.toggle();
  else if (k === 'f') setFollow(!following);
  else if (k === ' ') {
    e.preventDefault();
    if (speed === 0) setSpeed(lastSpeed); else { lastSpeed = speed; setSpeed(0); }
  } else if (k === '1' || k === '2' || k === '3') setSpeed(Number(k));
  else if (k === 'r') cycleRoofs();
  else if (k === 'g') gfx.toggle();
  else if (k === 'o') setWoods((worldUniforms.uThin.value + 1) % 3);
  else if (k === 'b' && !veil) buildPanel.toggle();
  else if (k === 't' && build?.kind === 'place') { build.turn = (build.turn + 1) % 4; placeHover(lastPointer.x, lastPointer.y); }
  else if (k === 'escape' && build && !draft.length) setBuild(null);
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
  sizeComposer(); // (bloom is sized with it)
  iso.resize(w / h);
  if (PIXEL) iso.snapRows = Math.round(h / pixelScale);
});
if (PIXEL) iso.snapRows = Math.round(view.clientHeight / pixelScale);

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
    sizeComposer();
  } else {
    renderer.shadowMap.type = THREE.PCFShadowMap;
    sky.sun.shadow.mapSize.set(1024, 1024);
    sky.sun.shadow.map?.dispose();
    sky.sun.shadow.map = null;
  }
  console.info(`Quality lowered (step ${perfStep}) at ${fps.toFixed(0)} fps`);
}

const chronicle = new ChronicleView(colony);

// ---------- saving (DESIGN §22.1) ----------
let savedDay = community.day, saving = false;
async function saveNow(why: 'day' | 'leave' | 'manual') {
  if (saving || !canSave(colony)) return;
  saving = true;
  const file = makeSave(colony, { x: iso.target.x, z: iso.target.z, zoom: iso.zoomGoal, yaw: iso.yawGoal });
  const ok = await writeSave(file);
  saving = false;
  savedDay = community.day;
  const btn = document.getElementById('game-btn');
  if (btn && ok !== null) btn.title = `Saved day ${community.day} at ${new Date().toLocaleTimeString()}. Saves itself every morning. Click for a new game.`;
  if (why === 'manual' && ok === null) log(community, 'Could not save: this browser is blocking storage.', 'bad');
}
addEventListener('pagehide', () => { void saveNow('leave'); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void saveNow('leave'); });
// Back to the start menu: save first, so Continue is there.
document.getElementById('game-btn')!.addEventListener('click', async () => {
  await saveNow('manual');
  const q = new URLSearchParams(location.search);
  for (const k of ['new', 'seed', 'site', 'auto']) q.delete(k);
  location.search = q.toString();
});

/** Measurement: a fixed frame step (seconds), with adaptive quality held (see flicker). */
let fixedDt: number | null = null;
function frame() {
  const real = Math.min(clock.getDelta(), 0.1);
  const dt = fixedDt ?? real;
  t += dt;
  if (fixedDt === null) adaptQuality(dt);

  // Simulation.
  renderer.info.reset();
  const tSim = performance.now();
  if (speed > 0) tick(colony, dt * SPEEDS[speed]);
  if (colony.council.active && !councilHeld) holdForCouncil();
  // Save every morning.
  if (community.day !== savedDay && !colony.clearing) void saveNow('day');
  councilAutopilot();
  perf.sim += (performance.now() - tSim - perf.sim) * 0.05;
  for (const ev of colony.events) {
    if (ev.type === 'felled') trees.fell(ev.tree, ev.dirX, ev.dirZ);
    else if (ev.type === 'swallowed') trees.vanish(ev.tree);
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
  if (PIXEL) renderer.domElement.style.transform = `translate(${(iso.residual.x * pixelScale).toFixed(2)}px, ${(-iso.residual.y * pixelScale).toFixed(2)}px)`;
  iso.target.y = heightAt(world, iso.target.x, iso.target.z) * 0.6;

  // World.
  const hour = hourOf(colony);
  const dayFrac = colony.minute / 1440 + 1;
  const weather = colony.weather;
  const look = seasonLook(dayFrac, weather === 'snow');
  // Snow builds up while it falls and melts when it's warm enough (DESIGN §35); roofs catch it a little faster.
  {
    const dm = lastSnowMinute < 0 ? 0 : Math.max(0, Math.min(240, colony.minute - lastSnowMinute));
    lastSnowMinute = colony.minute;
    if (snowCover < 0) { snowCover = look.snow; roofSnow = look.snow; } // a loaded game starts as the season looks
    const cold = snowCold(dayFrac);
    if (weather === 'snow') {
      snowCover = Math.min(1, snowCover + dm / (60 * 7));
      roofSnow = Math.min(1, roofSnow + dm / (60 * 4.5));
    } else {
      const melt = (1 - cold) * dm / (1440 * 1.2) + (weather === 'rain' ? dm / (1440 * 0.5) : 0);
      snowCover = Math.max(0, snowCover - melt);
      roofSnow = Math.max(0, roofSnow - melt * 1.3); // a heated roof sheds it sooner
    }
  }
  worldUniforms.uSnow.value = snowCover;
  worldUniforms.uRoofSnow.value = roofSnow;
  footprints.update(colony.minute, snowCover, weather === 'snow',
    [...colony.agents.filter((a) => !a.indoors && !a.afloat).map((a) => ({ id: `a${a.id}`, x: a.x, z: a.z })), ...herds.positions()], t);
  worldUniforms.uAutumn.value = look.autumn;
  worldUniforms.uBare.value = look.bare;
  worldUniforms.uBlossom.value = look.blossom;
  const gloom = weather === 'rain' ? 1 : weather === 'snow' ? 0.7 : weather === 'overcast' ? 0.6 : weather === 'fog' ? 0.4 : 0;
  sky.follow(iso.target);
  sky.setHour(veil ? 20.75 : hour, daylightHours(dayFrac), veil ? 0 : gloom, weather === 'fog' ? 1 : weather === 'rain' ? 0.3 : 0, Math.max(snowCover, weather === 'snow' ? 0.5 : 0));
  precip.update(dt, t, iso.target, weather === 'rain' ? 'rain' : weather === 'snow' ? 'snow' : null, weather === 'snow' ? 0.45 + 0.55 * snowCover : 1);
  // Seeing through their eyes: a selected survivor's Sight tints the world and reveals the Veil.
  const viewer = people.selected ? community.survivors.find((s) => s.id === people.selected) : undefined;
  const sightK = viewer ? viewer.sight / 100 : 0;
  worldUniforms.uVeil.value += ((veilView || veil ? 1 : sightK * 0.6) - worldUniforms.uVeil.value) * Math.min(1, dt * 3);
  vignette.style.opacity = viewer ? (0.1 + sightK * 0.75).toFixed(2) : '0';
  resonance.sync(t);
  phenomena.update(t, people.selected, iso.camera, view.clientWidth, view.clientHeight);
  folkView.update(t, sky.night, people.selected, iso.camera, view.clientWidth, view.clientHeight);
  townhouse.update(t, sky.night);
  myceliumView.update(t, sky.night, sightK, veilView || !!veil);
  keepOut.update();
  if (veil) {
    // The team stands where they stand in the Veil.
    for (const u of veil.cl.units) {
      const a = colony.agents.find((x) => x.id === u.id);
      if (!a) continue;
      if (u.state !== 'in') { const o = veil.saved.get(u.id)!; a.x = o.x; a.z = o.z; continue; }
      // Walk the way they chose, corner by corner; otherwise glide to where they stand.
      let wk = veil.walking.get(u.id);
      if (u.trail && wk?.trail !== u.trail) { wk = { trail: u.trail, i: 1 }; veil.walking.set(u.id, wk); }
      const goal = wk && wk.i < wk.trail.length ? wk.trail[wk.i] : { x: u.x, z: u.z };
      const dx = goal.x - a.x, dz = goal.z - a.z, d = Math.hypot(dx, dz);
      if (d > 0.03) { const step = Math.min(d, dt * 4.5); a.x += (dx / d) * step; a.z += (dz / d) * step; a.facing = Math.atan2(dx, dz); a.anim = 'walk'; }
      else if (wk && wk.i < wk.trail.length) wk.i++;
      else a.anim = 'idle';
      a.indoors = false; a.afloat = false;
    }
    // Keep the chosen one in view.
    const su = veil.cl.units.find((x) => x.id === veil!.sel && x.state === 'in');
    if (su && !pointers.size) {
      const fx = su.x, fz = su.z;
      if (veil.follow) {
        iso.target.x += (fx - iso.target.x) * Math.min(1, dt * 2.5);
        iso.target.z += (fz - iso.target.z) * Math.min(1, dt * 2.5);
        if (Math.hypot(fx - iso.target.x, fz - iso.target.z) < 0.3) veil.follow = false;
      }
    }
  }
  clearingView.updateAmbient(t, veil ? 0 : sky.night, people.selected, iso.camera, view.clientWidth, view.clientHeight);
  veilLight.intensity += ((veil ? 1.6 : 0) - veilLight.intensity) * Math.min(1, dt * 2);
  clearingView.updateArena(t, veil?.cl ?? null, veil?.sel ?? 0, veil?.hover ?? null, iso.camera, view.clientWidth, view.clientHeight);
  wear.sync(t);
  fog.sync();
  zoneTex.sync();
  trees.setGhosts(worldUniforms.uThin.value); // zones changed: which chunks touch the Wild
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
  plotsView.update(t, sky.night, powered(colony));
  gatheringView.sync(colony);
  if (t - lastGround > 2) { lastGround = t; terrainGroup.userData.refreshGround?.(); }
  gatheringView.update(t, sky.night);
  RESTORED_GLOW.opacity = sky.night > 0.3 ? sky.night * 0.9 : 0;
  grade.uniforms.uNight.value = sky.night;
  villageView.update(sky.night, occupied, t);
  villageView.updateBoats(colony.agents.filter((a) => a.afloat && a.task?.kind === 'fish').map((a) => {
    const f = colony.village.fisheries.find((x) => a.task?.kind === 'fish' && x.id === a.task.fishery);
    return { x: a.x, z: a.z, facing: a.facing, boatId: f?.boat ?? 0 };
  }));
  mushroomGlow.color.setRGB(0.5, 1.2, 1.0).multiplyScalar(0.4 + sky.night * 1.6);
  bloom.strength = (0.45 + sky.night * 0.5) * gfx.s.bloom;

  syncXray();
  const tDraw = performance.now();
  composer.render();
  if (afterDraw) { const f = afterDraw; afterDraw = null; f(); }
  perf.draw += (performance.now() - tDraw - perf.draw) * 0.05;
  perf.calls = renderer.info.render.calls;
  perf.triangles = renderer.info.render.triangles;

  uiTimer += dt;
  if (uiTimer > 0.25) {
    uiTimer = 0;
    people.sync(community.survivors, colony.agents);
    camp.sync(community, colony.items, colony.beds);
    camp.seats(fireSeats(colony));
    villageView.sync();
    syncSiteGone();
    plotsView.sync(seasonIndex(colony.community.day));
    heaps.sync();
    fields.sync(t);
    folkView.sync();
    if (syncRuins(world, oldWorld)) registerCutaway(oldWorld, roofs);
    syncClearance();
    trees.syncPlanted();
    lightPeopleLayer(scene);
    hud.render();
    dropAnsweredHomes(colony);
    tray.render();
    buildPanel.badge();
    chronicle.render();
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
/** A one-shot callback run right after the next frame is drawn (the canvas is still readable). */
let afterDraw: (() => void) | null = null;

/**
 * Shimmer metric (DESIGN §23.7): step game time as play does, render each
 * frame, and compare consecutive frames of the finished image, with wind and
 * moving things (people, animals, wisps) held still. `changed`: share of
 * pixels whose brightness moved by more than 6/255; `flips`: share whose
 * change reversed direction from one frame to the next (glitter).
 */
async function flicker(frames = 24, minutesPerFrame = 2 / 30, opts: { shadows?: boolean; grade?: boolean; map?: boolean } = {}) {
  const was = { shadows: renderer.shadowMap.enabled, grade: grade.enabled };
  if (opts.shadows !== undefined) renderer.shadowMap.enabled = opts.shadows;
  if (opts.grade !== undefined) grade.enabled = opts.grade;
  const wind = worldUniforms.uWind.value;
  worldUniforms.uWind.value = 0;
  fixedDt = 1 / 30; // as if running at 30 fps, however slowly this browser draws
  t = 1000; // the same animation phase every time, so runs compare
  const hidden = scene.children.filter((o) => ['people', 'herds'].includes(o.name) || (o as THREE.Points).isPoints || o === wisps.group);
  for (const o of hidden) o.visible = false;
  const gl = renderer.getContext();
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const buf = new Uint8Array(w * h * 4);
  let prev: Float32Array | null = null, prevD: Float32Array | null = null;
  let changed = 0, flips = 0, n = 0;
  const heat = new Uint16Array(w * h);
  for (let f = 0; f < frames; f++) {
    tick(colony, minutesPerFrame);
    await new Promise<void>((res) => { afterDraw = () => { gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf); res(); }; });
    const lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) lum[i] = 0.3 * buf[i * 4] + 0.59 * buf[i * 4 + 1] + 0.11 * buf[i * 4 + 2];
    if (prev) {
      const d = new Float32Array(w * h);
      let c = 0, fl = 0;
      for (let i = 0; i < w * h; i++) {
        d[i] = lum[i] - prev[i];
        if (Math.abs(d[i]) > 6) c++;
        if (prevD && Math.abs(d[i]) > 6 && Math.abs(prevD[i]) > 6 && Math.sign(d[i]) !== Math.sign(prevD[i])) { fl++; heat[i]++; }
      }
      changed += c / (w * h); if (prevD) { flips += fl / (w * h); n++; }
      prevD = d;
    }
    prev = lum;
  }
  worldUniforms.uWind.value = wind;
  for (const o of hidden) o.visible = true;
  renderer.shadowMap.enabled = was.shadows; grade.enabled = was.grade;
  fixedDt = null;
  let map: string | undefined;
  if (opts.map) {
    // Where it flickers: white on the frame's own dimmed image (rows flipped: GL reads bottom-up).
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d')!, img = cx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (h - 1 - y) * w + x, o = (y * w + x) * 4, v = Math.min(255, heat[i] * 60);
      const base = (prev?.[i] ?? 0) * 0.35;
      img.data[o] = Math.max(base, v); img.data[o + 1] = Math.max(base, v * 0.4); img.data[o + 2] = base; img.data[o + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    map = cv.toDataURL('image/png');
  }
  return { changed: changed / Math.max(1, frames - 1), flips: flips / Math.max(1, n), pixels: w * h, map };
}

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
  /** Clear the nearest district with a house, restore the house and finish it (DESIGN §24.16). Returns the ruin. */
  /** Set how deep the snow lies, ground and roofs, 0..1 (DESIGN §35; it then builds up or melts from there). */
  snow(v: number) { snowCover = roofSnow = Math.max(0, Math.min(1, v)); },
  footprints: () => footprints,
  /** Tow the wreck nearest the fire to the yard (DESIGN §30); returns its id, and opens its card. */
  towNearest() {
    const c = world.campfire;
    const h = world.heaps.filter((x) => x.kind === 'car' && x.scrap > 0 && !x.tow).sort((a, b) => Math.hypot(tileX(world, a.tx) - c.x, tileZ(world, a.tz) - c.z) - Math.hypot(tileX(world, b.tx) - c.x, tileZ(world, b.tz) - c.z))[0];
    if (!h) return null;
    const at = yardSpot(colony, h);
    if (at) towHeap(colony, h, at.x, at.z);
    hud.inspect({ heap: h.id });
    return h.id;
  },
  /** Pull the found shelter down at once, and (with a point) raise a commons hall near it, built (DESIGN §29). */
  pullDown(x?: number, z?: number) {
    const st = colony.village.buildings.find((b) => b.kind === 'store')!;
    if (!st.gone) pullDownShelter(colony, st);
    if (x !== undefined && z !== undefined) {
      const w = world, v = colony.village;
      for (let r = 0; r < 14; r++) for (let a = 0; a < 16; a++) {
        const { foot, facing } = footAt('hall', toTileX(w, x + Math.cos(a) * r), toTileZ(w, z + Math.sin(a) * r), 0);
        if (!canPlace(w, v, 'hall', foot).ok) continue;
        const p = placeProject(w, v, community, 'hall', foot, facing);
        if (typeof p === 'string') continue;
        completeProject(w, v, community, p);
        syncScene();
        return p.foot;
      }
    }
    syncScene();
    return null;
  },
  /** Light a hamlet fire beside a point, built at once (DESIGN §28). Returns where, or null. */
  hamlet(x: number, z: number) {
    const w = world, v = colony.village;
    for (let r = 3; r < 14; r++) for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (whyNotHamletFire(colony, px, pz)) continue;
      const { foot, facing } = footAt('hearth', toTileX(w, px), toTileZ(w, pz), 0);
      if (!canPlace(w, v, 'hearth', foot).ok) continue;
      const p = placeProject(w, v, community, 'hearth', foot, facing);
      if (typeof p === 'string') continue;
      completeProject(w, v, community, p);
      syncScene();
      return { x: px, z: pz };
    }
    return null;
  },
  restoreHome() {
    const w = world, v = colony.village;
    const houses = w.ruins.filter((r) => RESTORE[r.kind]?.as === 'home').sort((a, b) => Math.hypot(a.x - w.campfire.x, a.z - w.campfire.z) - Math.hypot(b.x - w.campfire.x, b.z - w.campfire.z));
    for (const r of houses) {
      const d = w.districts[r.district], h = colony.haunts.find((x) => x.district === d.id)!;
      reveal(w, d.x, d.z, HAUNT_RADIUS + 4);
      h.state = 'cleared';
      w.haunted?.fill(0);
      w.zoneVersion++;
      if (!h.owner) giveDistrict(colony, d.id, 'village');
      const p = requestRestore(colony, r.id);
      if (typeof p === 'string') continue;
      // Done at once: the trees on its plot come down too, as the restorers would fell them (DESIGN §37).
      for (const id of p.clearTrees) {
        const tr = w.trees[id];
        tr.felled = true; w.treeAt[idx(w, tr.tx, tr.tz)] = -1;
        colony.events.push({ type: 'felled', tree: id, dirX: 1, dirZ: 0 });
      }
      completeProject(w, v, colony.community, p);
      syncScene();
      return r;
    }
    return null;
  },
  /** Put up a building of this kind near the fire at once (the first place it fits), for looking at. */
  buildNow(kind: PlaceKind, near = 8) {
    const w = world;
    for (let r = near; r < near + 20; r += 1.5) for (let a = 0; a < 6.28; a += 0.5) {
      const x = w.campfire.x + Math.cos(a) * r, z = w.campfire.z + Math.sin(a) * r;
      const { foot, facing } = footAt(kind, toTileX(w, x), toTileZ(w, z), 0);
      const p = placeProject(w, colony.village, community, kind, foot, facing);
      if (typeof p === 'string') continue;
      completeProject(w, colony.village, community, p);
      colony.village.projects = colony.village.projects.filter((q) => q !== p);
      syncScene();
      return { x, z };
    }
    return null;
  },
  /** Mark paving to be broken up (DESIGN §24.12). */
  depave: (x: number, z: number, r: number) => markDepave(world, x, z, r, true),
  /** Clear a district and give it away (DESIGN §26): 'village', 'folk' or 'shared'. */
  give(district: number, to: 'village' | 'folk' | 'shared') { const h = colony.haunts.find((x) => x.district === district); if (!h) return; h.state = 'cleared'; h.owner = null; const d = world.districts[district]; reveal(world, d.x, d.z, 22); giveDistrict(colony, district, to); syncScene(); hud.render(); },
  /** Move the fire or the stockpile (DESIGN §27); returns why not. */
  moveFire: (x: number, z: number) => { const r = moveFire(colony, x, z); syncScene(); return r; },
  moveStockpile: (x: number, z: number) => { const r = moveStockpile(colony, x, z); syncScene(); return r; },
  /** Grow the mycelium n days (and set the Folk's standing, if given). */
  spread(n = 10, standing?: number) { if (standing !== undefined) colony.folk.standing = standing; for (let i = 0; i < n; i++) myceliumDaily(colony); },
  /** Grow the hill n times, each raising a knowe (DESIGN §25.3). */
  dig(n = 1) { for (let i = 0; i < n; i++) { colony.folk.level++; addFae(colony.folk, colony.world, 'hob', colony.folk.level); raiseKnowe(colony); settleFolk(colony.folk); } },
  /** Put a gathering on (DESIGN §24.8): 'festival', 'folk_festival', or 'wedding' (the two closest free adults). */
  gather(kind: 'festival' | 'folk_festival' | 'wedding' = 'festival') {
    if (kind !== 'wedding') return scheduleGathering(colony, kind, kind === 'festival' ? 'The test festival' : 'the dance at the Ring');
    const [a, b] = alive(colony.community).filter((s) => s.age >= 18);
    return scheduleGathering(colony, 'wedding', `The wedding of ${a.name.split(' ')[0]} and ${b.name.split(' ')[0]}`, [a.id, b.id]);
  },
  veilTurns(n: number) { for (let i = 0; i < n && veil && !veil.cl.outcome; i++) playTurn(colony, veil.cl); afterVeilAction(); },
  veil: () => veil,
  /** Point the cursor at a place the chosen one could walk to, about `d` away (for screenshots of the walk preview). */
  veilHoverAt(d: number, bearing = 0) {
    if (!veil) return null;
    const u = veil.cl.units.find((x) => x.id === veil!.sel && x.state === 'in');
    const r = u && reachOf(colony, veil.cl, u);
    if (!u || !r) return null;
    let best: { x: number; z: number; e: number } | null = null;
    const g = gridOf(colony, veil.cl), occ = occupantsFor(colony, veil.cl, u);
    for (const c of reachCells(r.field)) {
      const e = Math.abs(c.d - d) + Math.abs(Math.atan2(c.z - u.z, c.x - u.x) - bearing) * 0.5;
      if ((!best || e < best.e) && standable(g, occ, c.x, c.z)) best = { x: c.x, z: c.z, e };
    }
    if (best) veil.hover = { x: best.x, z: best.z };
    return best && clearingView.preview;
  },
  /** Screen position of the nearest spirit the team perceives (for tests and screenshots). */
  veilSpiritScreen() {
    if (!veil) return null;
    const u = veil.cl.units.find((x) => x.id === veil!.sel) ?? veil.cl.units[0];
    const ss = colony.haunts[veil.cl.haunt].spirits.filter((s) => s.fate === 'present' && teamReading(colony, veil!.cl, s) !== 'none')
      .sort((a, b) => Math.hypot(tileX(world, a.tx) - u.x, tileZ(world, a.tz) - u.z) - Math.hypot(tileX(world, b.tx) - u.x, tileZ(world, b.tz) - u.z));
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
Object.assign(window, { __game: { ...veilDebug, stats, addModel, setWoods, flicker, clearance: () => trees.overlaps(obstaclesFor(world, colony.village)), scene, probeRender, colony, iso, setSpeed, select, setZoneTool, paint: (x: number, z: number, r: number, k: number) => paintZone(world, x, z, r, k as never), reveal: (x: number, z: number, r: number) => reveal(world, x, z, r), field: (pts: { x: number; z: number }[]) => createField(world, pts, world.campfire), tick: (m: number) => tick(colony, m), inspect: (t: { building?: number; project?: number; folk?: boolean; camp?: 'fire' | 'stockpile' }) => hud.inspect(t), refresh: () => { syncScene(); hud.render(); }, build: (t: BuildTool | null) => setBuild(t), buildPanel, hover: placeHover,
  place: (k: PlaceKind, x: number, z: number, turn = 0) => { const { foot, facing } = footAt(k, toTileX(world, x), toTileZ(world, z), turn); return placeProject(world, colony.village, community, k, foot, facing); },
  folkOrder: (k: never, x: number, z: number) => orderFolkWork(colony, k, x, z), folkWhy: (x: number, z: number) => whyNotFolkWork(colony, x, z),
  save: () => saveNow('manual'),
  fits: (k: PlaceKind, x: number, z: number, turn = 0) => canPlace(world, colony.village, k, footAt(k, toTileX(world, x), toTileZ(world, z), turn).foot).ok,
  screenOf: (x: number, z: number) => toScreen(x, heightAt(world, x, z), z),
  plotTry: (pts: { x: number; z: number }[]) => { const r = outlinePlot(world, colony.village, pts, new Rng(1)); return typeof r === 'string' ? r : 'ok'; } } });
