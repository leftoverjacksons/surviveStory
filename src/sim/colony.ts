/**
 * The living colony: survivors as agents on the world grid who choose their
 * own tasks from their role, their needs, and the time of day.
 *
 * Time unit: game minutes. The renderer advances the colony with tick().
 */
import {
  alive, adjustBond, bondValue, communityMorale, dailyRollover, killSurvivor, log, recruit, remember,
  traitSum, withRng, TUNING, type Community, type Survivor,
} from './community';
import type { RoleId } from './data';
import {
  daysUntilWinter, seasonIndex, seasonOf, weatherOn, weatherWorkFactor, DAYS_PER_SEASON, DAYS_PER_YEAR, SEASON_NAMES, SEASON_SCALE,
  type Season, type Weather,
} from './calendar';
import {
  assignBeds, bedsTotal, completeProject, heatNeed, storageCapacity, STORE_PER_HEAD, createVillage, footCenter, hasBuilt, materialsReady,
  outstanding, plan, store, MAX_ACTIVE, newProject, GARDEN_YIELD, MATERIALS, type Building, type Material, type Project, type Village,
} from './buildings';
import {
  SITE_CREW, YARD, homeComfort, homeOf, householdName, householdOf, householdsDaily, onHomeBuilt, planHome, plotPoint,
  type Plot,
  plotFence,
} from './homes';
import { bedSpot, seatSpot } from './sites';
import { SKILLED, aspirationsDaily, knowhowDaily, knows, learn, skill, type Craft } from './purpose';
import { catchRate, fishingDaily, fishingSpot, onFisheryBuilt, planFishery, pondOf } from './fishing';
import { highwayZ } from './worldgen';
import { FENCE_WORK_PER_UNIT, alongPerimeter, fenceWood, perimeter, wantsFence } from './fields';
import { breakRule, createFolk, endLed, folkDaily, folkTick, leaveOffering, maybeLeadAway, type FolkSociety } from './folk';
import { planRestore, ruinDoor } from './restore';
import { rareDaily, ruinToStrip, strip } from './rare';
import { autopilotDaily } from './autopilot';
import { requestsDaily, type Request } from './requests';
import { committed } from './dilemmas';
import { crossed, syncHedges } from './hedges';
import { chronicleDaily, type Chronicle } from './chronicle';
import { TRADES, clothFrom, clothed, finishBatch, needComfort, needRows, needTier, pickTrade, toolFactor, tradeDemand, tradesDaily } from './trades';
import { createHaunts, hauntDaily, heapHaunted, senseDistrict, type Clearing, type Haunt, type TakenRecord } from './haunt';
import {
  PSI_SIGHT, createVeil, disturb, growthFactor, healFactor, homeResonance, nurture, resonanceAt, veilDaily, veilHourly, type Veil,
} from './veil';
import { councilDaily, createCouncil, maybeConvene, type Council } from './council';
import { findPath } from './path';
import {
  Crop, Ground, LANE_WEAR, PATH_WEAR, Zone, findNearest, idx, isExplored, passable, reveal, tileX, tileZ, toTileX, toTileZ,
  type Heap, type Point, type Tree, type World,
} from './world';

export const MIN_PER_DAY = 1440;
export const WALK_SPEED = 0.9;      // tiles per game minute
export const WOOD_TARGET = 30;      // spare wood kept on hand beyond projects and winter
export const FIRE_WOOD_PER_DAY = 2;  // the fire; more in winter (see fireWood)
export const START_MINUTE = 7 * 60; // day 1, 07:00

export type Anim = 'idle' | 'walk' | 'chop' | 'build' | 'carry' | 'forage' | 'sleep' | 'sit' | 'eat' | 'look' | 'fish';
export type ItemKind = 'wood' | 'food' | 'scrap' | 'glimmer' | 'glass' | 'copper' | 'steel';
export const MAX_POP = 24;

export interface Needs { food: number; rest: number; social: number } // 0..100, 100 = satisfied

export type Task =
  | { kind: 'chop'; tree: number; stage: 'go' | 'work' }
  | { kind: 'haul'; item: number; stage: 'go' | 'deliver' }
  | { kind: 'forage'; bush: number; stage: 'go' | 'work' | 'deliver'; t: number }
  | { kind: 'eat'; stage: 'go' | 'eat'; t: number; place: MealPlace; building: number }
  | { kind: 'sleep'; stage: 'go' | 'sleep' }
  | { kind: 'social'; stage: 'go' | 'sit'; place: 'fire' | 'home' | 'hall' | 'bench' | 'tavern'; building: number }
  | { kind: 'craft'; building: number; stage: 'go' | 'work'; t: number }
  | { kind: 'strip'; ruin: number; stage: 'go' | 'work' | 'deliver'; t: number }
  | { kind: 'yard'; plot: number; item: number; stage: 'go' | 'work'; t: number }
  | { kind: 'fence'; field: number; stage: 'go' | 'work'; t: number }
  | { kind: 'practice'; building: number; stage: 'go' | 'work'; t: number }
  | { kind: 'fish'; fishery: number; stage: 'go' | 'fish' | 'deliver'; t: number; boat: boolean; catch: number }
  | { kind: 'leisure'; what: 'fish' | 'cards' | 'herbs'; stage: 'go' | 'do'; t: number }
  | { kind: 'scout'; stage: 'go' | 'look'; t: number }
  | { kind: 'attune'; stage: 'go' | 'sit'; t: number }
  | { kind: 'offer'; stage: 'go' | 'leave'; t: number }
  | { kind: 'lost'; stage: 'wait' }
  | { kind: 'search'; stage: 'go' | 'look'; t: number }
  | { kind: 'tend'; stage: 'go' | 'sit'; t: number }
  | { kind: 'wander'; stage: 'go' | 'pause'; t: number }
  | { kind: 'build'; project: number; stage: 'go' | 'work' }
  | { kind: 'supply'; project: number; mat: Material; amount: number; stage: 'go' | 'deliver' }
  | { kind: 'salvage'; heap: number; stage: 'go' | 'work' | 'deliver'; t: number }
  | { kind: 'garden'; building: number; stage: 'go' | 'work'; t: number }
  | { kind: 'farm'; tile: number; action: FarmAction; stage: 'go' | 'work' | 'deliver'; t: number }
  | { kind: 'plant'; tile: number; stage: 'go' | 'work'; t: number }
  | { kind: 'scrounge'; stage: 'go' | 'work' | 'deliver'; t: number; fishing: boolean };

export type FarmAction = 'till' | 'sow' | 'tend' | 'harvest';
export type MealPlace = 'home' | 'hall' | 'kitchen' | 'fire';

export interface Agent {
  id: number;
  x: number;
  z: number;
  facing: number;
  path: Point[];
  pathI: number;
  task: Task | null;
  needs: Needs;
  carry: { kind: ItemKind; amount: number } | null;
  anim: Anim;
  activity: string;
  lastTile: number;
  /** Where the agent is looking while working (world point), if anywhere. */
  lookAt: Point | null;
  /** Inside a building (hidden from view); `door` is where they come back out. */
  indoors: boolean;
  door: Point | null;
  /** Building they are inside, if indoors (0 = none). */
  inside: number;
  /** Out on the water in the boat (their `door` is where they climbed in). */
  afloat: boolean;
  sleptIndoors: boolean;
}

export interface Item { id: number; kind: ItemKind; amount: number; x: number; z: number; reserved: number }

export type ColonyEvent =
  | { type: 'felled'; tree: number; dirX: number; dirZ: number }
  | { type: 'discovered'; poi: number }
  | { type: 'planted'; tree: number };

export interface Colony {
  world: World;
  community: Community;
  minute: number;
  agents: Agent[];
  items: Item[];
  nextItemId: number;
  events: ColonyEvent[];
  unreachable: Set<string>;
  village: Village;
  /** Survivor id → building id where they sleep. */
  beds: Map<number, number>;
  /** Today's weather. */
  weather: Weather;
  /** Field/woodlot tiles claimed by an agent (tile index → survivor id). */
  claims: Map<number, number>;
  /** Woodlot tiles waiting for a sapling. */
  replant: number[];
  /** Field tiles tended today. */
  tended: Set<number>;
  /** Consecutive miserable days per survivor (for leaving). */
  lowDays: Map<number, number>;
  /** One-off hints already given. */
  hints: Set<string>;
  private_fieldCache: { version: number; tiles: number[] };
  veil: Veil;
  council: Council;
  /** The Folk of the hill: their standing with the village, their people and works. */
  folk: FolkSociety;
  /** Who still lives in each district of the old world (see haunt.ts). */
  haunts: Haunt[];
  /** A team in the Veil right now: time at home stands still until it ends. */
  clearing: Clearing | null;
  lastClearing?: Clearing;
  /** Survivors taken into the Veil, and when they will come back. */
  taken: TakenRecord[];
  /** Food gained and spent this year, by source (for balancing and the HUD). */
  ledger: Record<string, number>;
  /** Daily samples and notable events, for the chronicle panel (chronicle.ts). */
  chronicle?: Chronicle;
  /** Searches that found nothing, and the minute until which they aren't repeated (saved, so runs stay deterministic). */
  memo?: Record<string, number>;
  /** Asks waiting in the request tray (requests.ts). */
  requests?: Request[];
  /** Crossings of fence tiles, toward putting a gate in (hedges.ts). */
  fenceCross?: Record<number, number>;
}

/** Has this search come up empty recently? (See `hush`.) */
const quiet = (col: Colony, key: string) => ((col.memo ??= {})[key] ?? -1) > col.minute;
/** A search found nothing: don't repeat it for a while. Idle people ask many times a minute. */
const hush = (col: Colony, key: string, minutes: number) => { (col.memo ??= {})[key] = col.minute + minutes; };

/** Add (or, if negative, spend) food, noting where it came from. */
export function gainFood(col: Colony, source: string, amount: number) {
  col.community.resources.food += amount;
  col.ledger[source] = (col.ledger[source] ?? 0) + amount;
}

// ---------- time ----------
export const hourOf = (col: Colony) => (col.minute % MIN_PER_DAY) / 60;
export const dayOf = (col: Colony) => Math.floor(col.minute / MIN_PER_DAY) + 1;
const isNight = (h: number) => h >= 22 || h < 6;
const isEvening = (h: number) => h >= 19 && h < 22;
export const seasonNow = (col: Colony): Season => seasonOf(dayOf(col));

// ---------- setup ----------
export function createColony(world: World, community: Community): Colony {
  const col: Colony = {
    world, community, minute: START_MINUTE, agents: [], items: [], nextItemId: 1, events: [], unreachable: new Set(),
    village: createVillage(world), beds: new Map(),
    weather: weatherOn(1, world.seed), claims: new Map(), replant: [], tended: new Set(), lowDays: new Map(),
    hints: new Set(), private_fieldCache: { version: -1, tiles: [] },
    veil: createVeil(world), council: createCouncil(), folk: createFolk(world), haunts: createHaunts(world), clearing: null, taken: [], ledger: {},
  };
  // The first line of the story names where it starts.
  const opening = community.log.find((l) => l.day === 1 && l.tone === 'info');
  if (opening && community.day === 1) opening.text = world.site.intro;
  syncAgents(col);
  replan(col);
  return col;
}

function makeAgent(col: Colony, s: Survivor, i: number): Agent {
  const living = alive(col.community).length;
  const seat = seatSpot(col.world.campfire, i, Math.max(living, 1));
  return {
    id: s.id, x: seat.x, z: seat.z, facing: 0, path: [], pathI: 0, task: null,
    needs: { food: 70 + (s.id * 7) % 25, rest: 80, social: 60 },
    carry: null, anim: 'idle', activity: 'Waking up', lastTile: -1, lookAt: null,
    indoors: false, door: null, inside: 0, afloat: false, sleptIndoors: false,
  };
}

/**
 * Add agents for new survivors; drop agents (and their claims) for the dead.
 * Beds are reassigned when anyone comes or goes, or when `force` is set
 * (buildings finished, households changed).
 */
export function syncAgents(col: Colony, force = false) {
  const living = alive(col.community);
  let changed = force || living.length !== col.agents.length;
  if (!changed) for (let i = 0; i < living.length; i++) if (!col.agents.some((a) => a.id === living[i].id)) { changed = true; break; }
  if (!changed) return;
  const ids = new Set(living.map((s) => s.id));
  for (const a of col.agents) if (!ids.has(a.id)) releaseClaims(col, a.id);
  col.agents = col.agents.filter((a) => ids.has(a.id));
  living.forEach((s, i) => {
    if (!col.agents.some((a) => a.id === s.id)) col.agents.push(makeAgent(col, s, i));
  });
  col.beds = assignBeds(col.village, living.map((s) => s.id));
}

/** Pick a planner voice: the builder with the sharpest wits, else anyone. */
function leadName(col: Colony): string {
  const living = alive(col.community);
  const pool = living.filter((s) => s.role === 'builder');
  const lead = (pool.length ? pool : living).reduce((a, b) => (b.stats.wits > a.stats.wits ? b : a), living[0]);
  return lead ? first(lead) : 'Someone';
}

export function replan(col: Colony) {
  const pop = alive(col.community).length;
  if (!pop) return;
  col.village.woodReserve = winterReserve(col);
  withRng(col.community, (rng) => {
    const v = col.village;
    const urgent = () => {
      const pending = v.projects.filter((p) => !p.done && (p.kind === 'home' || p.kind === 'hut' || p.kind === 'annex' || p.kind === 'patch_roof')).length * 2;
      return bedsTotal(v) + pending < pop;
    };
    if (store(v).level >= 1) while (planHome(col, rng, leadName(col), urgent())) { /* up to two homes at once */ }
    if (store(v).level >= 1) planFishery(col, rng, leadName(col));
    // A cleared district of the village's: patch up one of its buildings.
    if (v.projects.filter((p) => !p.done).length < MAX_ACTIVE) planRestore(col, leadName(col), (p) => newProject(v, p));
    while (plan(col.world, col.village, col.community, rng, leadName(col), seasonIndex(dayOf(col)), col)) { /* fill up to the active limit */ }
  });
}

const activeProjects = (col: Colony) => col.village.projects.filter((p) => !p.done);
const projectById = (col: Colony, id: number) => col.village.projects.find((p) => p.id === id);
const buildingById = (col: Colony, id: number) => col.village.buildings.find((b) => b.id === id);

/** Free everything an agent reserved; `kind` limits the search to what that task can hold. */
function releaseClaims(col: Colony, id: number, kind?: Task['kind']) {
  const all = kind === undefined;
  if (all || kind === 'chop') for (const t of col.world.trees) if (t.reserved === id) t.reserved = 0;
  if (all || kind === 'forage') for (const b of col.world.bushes) if (b.reserved === id) b.reserved = 0;
  if (all || kind === 'haul') for (const it of col.items) if (it.reserved === id) it.reserved = 0;
  if (all || kind === 'salvage') for (const h of col.world.heaps) if (h.reserved === id) h.reserved = 0;
  if (all || kind === 'farm' || kind === 'plant') for (const [tile, who] of col.claims) if (who === id) col.claims.delete(tile);
}

const survivorOf = (col: Colony, id: number) => col.community.survivors.find((s) => s.id === id)!;
const first = (s: Survivor) => s.name.split(' ')[0];

function workRate(s: Survivor, role: RoleId, col?: Colony) {
  const weather = col ? weatherWorkFactor(col.weather) : 1;
  // Push: a shove from nowhere helps with the heavy lifting.
  const push = role === 'builder' && s.psi === 'push' && s.sight >= PSI_SIGHT ? 1.2 : 1;
  const tools = col ? toolFactor(col, role) : 1;
  return traitSum(s, (t) => t.roleBonus?.[role], 1, 'add') * (0.7 + s.morale / 200) * weather * push * tools;
}

/** The land's answer where it grows: resonance, and the Moth Woman's blessing. */
function landFactor(col: Colony, x: number, z: number) {
  return growthFactor(resonanceAt(col, x, z)) * (col.community.day < col.veil.mothBlessing ? 1.12 : 1);
}

// ---------- movement ----------
function setDest(col: Colony, a: Agent, x: number, z: number, stopShort = false): boolean {
  const w = col.world;
  let gx = toTileX(w, x), gz = toTileZ(w, z);
  let exact: Point | null = { x, z };
  if (!passable(w, gx, gz) && !stopShort) {
    const near = findNearest(w, gx, gz, 4, (tx, tz) => passable(w, tx, tz));
    if (!near) return false;
    gx = near.tx; gz = near.tz; exact = null;
  }
  let sx = toTileX(w, a.x), sz = toTileZ(w, a.z);
  if (!passable(w, sx, sz)) {
    // Standing somewhere that has since been built over (or a doorstep on a wall
    // tile): step to the nearest open ground first.
    const out = findNearest(w, sx, sz, 4, (tx, tz) => passable(w, tx, tz));
    if (!out) return false;
    sx = out.tx; sz = out.tz;
    a.x = tileX(w, sx); a.z = tileZ(w, sz);
  }
  if (sx === gx && sz === gz) {
    a.path = exact && !stopShort ? [exact] : [];
    a.pathI = 0;
    return true;
  }
  const blockedGoal = !passable(w, gx, gz);
  if (blockedGoal) {
    // stopShort onto a blocked tile: path to its best open neighbour instead.
    const near = findNearest(w, gx, gz, 2, (tx, tz) => passable(w, tx, tz));
    if (!near) return false;
    gx = near.tx; gz = near.tz;
  }
  const p = findPath(w, sx, sz, gx, gz);
  if (!p) return false;
  const pts = p.map((i) => ({ x: tileX(w, i % w.w), z: tileZ(w, (i / w.w) | 0) }));
  if (stopShort && !blockedGoal) pts.pop();
  else if (exact && !stopShort) pts[pts.length - 1] = exact;
  a.path = pts;
  a.pathI = 0;
  return true;
}

/** Advance along the path. Returns true once the destination is reached. */
function walk(col: Colony, a: Agent, dt: number): boolean {
  let budget = WALK_SPEED * dt * (a.carry ? 0.85 : 1);
  while (budget > 0 && a.pathI < a.path.length) {
    const t = a.path[a.pathI];
    const dx = t.x - a.x, dz = t.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4) a.facing = Math.atan2(dx, dz);
    if (d <= budget) {
      a.x = t.x; a.z = t.z; budget -= d; a.pathI++;
    } else {
      a.x += (dx / d) * budget; a.z += (dz / d) * budget; budget = 0;
    }
  }
  const w = col.world;
  const tile = idx(w, toTileX(w, a.x), toTileZ(w, a.z));
  if (tile !== a.lastTile) {
    a.lastTile = tile;
    // Footfall wears the grass into paths, then lanes.
    const g = w.ground[tile];
    if (g !== Ground.Asphalt && g !== Ground.Concrete && w.zone[tile] !== Zone.Field) {
      const before = w.wear[tile];
      w.wear[tile] = before + 1;
      if ((before < PATH_WEAR && before + 1 >= PATH_WEAR) || (before < LANE_WEAR && before + 1 >= LANE_WEAR)) w.wearVersion++;
    }
    const s = survivorOf(col, a.id);
    if (crossed(col, tile) && !col.hints.has(`gate${Math.floor(dayOf(col) / 4)}`)) {
      col.hints.add(`gate${Math.floor(dayOf(col) / 4)}`);
      log(col.community, `${first(s)} got tired of climbing the fence in the same place, and put a gate in.`, 'info');
    }
    if (reveal(w, a.x, a.z, s.role === 'scout' ? 11 : 7)) checkDiscoveries(col, s);
  }
  return a.pathI >= a.path.length;
}

function face(a: Agent, p: Point) {
  a.facing = Math.atan2(p.x - a.x, p.z - a.z);
  a.lookAt = p;
}

function checkDiscoveries(col: Colony, s: Survivor) {
  for (const p of col.world.pois) {
    if (p.discovered || !isExplored(col.world, p.tx, p.tz)) continue;
    p.discovered = true;
    const d = p.kind === 'ruin' ? col.world.districts.find((x) => x.name === p.name) : undefined;
    const RUIN_SAYS: Record<string, string> = {
      suburb: 'a close of houses, doors open, gardens gone to meadow',
      strip: 'a row of shops round a car park, signs still up, the cars where they were left',
      works: 'a works yard and a steel shed full of pigeons',
      farmstead: 'a barn and a silo, the fields long since hedges',
      oldtown: 'an old high street and a chapel, ivy to the gutters',
      garden: 'a garden centre, the glasshouses run wild',
    };
    const what = p.kind === 'ruin' ? RUIN_SAYS[d?.kind ?? ''] ?? 'roofless houses swallowed by ivy' : p.kind === 'pond' ? 'a still pond full of sky' : 'something';
    log(col.community, `${first(s)} found ${p.name}: ${what}.`, 'good');
    if (d) senseDistrict(col, d, s);
    remember(s, col.community.day, `Found ${p.name}.`);
    col.events.push({ type: 'discovered', poi: p.id });
  }
}

// ---------- choosing work ----------
function groundWood(col: Colony) {
  return col.items.reduce((sum, it) => sum + (it.kind === 'wood' ? it.amount : 0), 0);
}

/** Firewood the village burns per day: the fire, plus heating occupied buildings in the cold. */
export function fireWood(col: Colony, season: Season = seasonNow(col)): number {
  const fire = season === 'winter' ? 5 : FIRE_WOOD_PER_DAY;
  if (season !== 'winter' && season !== 'autumn') return fire;
  const occupied = new Set(col.beds.values());
  const heat = col.village.buildings.filter((b) => occupied.has(b.id)).reduce((n, b) => n + heatNeed(b), 0);
  return fire + (season === 'winter' ? heat : Math.ceil(heat / 2));
}

/** Timber set aside for the first fence a worked field is waiting on (at most 25). */
function fenceHold(col: Colony): number {
  const f = col.world.fields.find((x) => x.fence === 0 && wantsFence(col.world, x));
  return f ? Math.min(25, fenceWood(f)) : 0;
}

/** Wood worth keeping on hand: projects, spare, and (from late summer) enough for winter. */
export function woodWanted(col: Colony): number {
  const need = activeProjects(col).reduce((n, p) => n + outstanding(p, 'wood'), 0);
  // A worked field waiting for its fence: its timber has to be cut too (pickFence wants it all on hand).
  const fence = col.world.fields.filter((f) => f.fence === 0 && wantsFence(col.world, f)).reduce((n, f) => n + fenceWood(f) + 10, 0);
  return WOOD_TARGET + need + winterReserve(col) + (committed(col, 'all_hands') ? 40 : 0) + Math.min(fence, 30);
}

/** From late summer: the firewood the rest of winter will burn. Optional building doesn't touch it. */
export function winterReserve(col: Colony): number {
  const day = dayOf(col);
  const toWinter = daysUntilWinter(day);
  const winterLeft = toWinter === 0 ? DAYS_PER_SEASON - ((day - 1) % DAYS_PER_SEASON) : DAYS_PER_SEASON;
  return toWinter <= DAYS_PER_SEASON + 6 ? fireWood(col, 'winter') * winterLeft : 0;
}

function hasWoodlot(col: Colony): boolean {
  const z = col.world.zone;
  for (let i = 0; i < z.length; i++) if (z[i] === Zone.Woodlot) return true;
  return false;
}

function pickTree(col: Colony, a: Agent): Task | null {
  const c = col.community.resources;
  if (c.wood + groundWood(col) >= woodWanted(col)) return null;
  if (quiet(col, 'tree')) return null;
  const w = col.world;
  const home = { tx: toTileX(w, w.home.x), tz: toTileZ(w, w.home.z) };
  // With a woodlot marked, cut there; otherwise nearest home. Never on sacred ground.
  const woodlot = hasWoodlot(col);
  const season = seasonNow(col);
  const desperate = c.wood < 4 && (season === 'winter' || season === 'autumn');
  const ok = (tx: number, tz: number, inLot: boolean) => {
    const i = idx(w, tx, tz);
    const id = w.treeAt[i];
    if (id < 0) return false;
    if (inLot !== (w.zone[i] === Zone.Woodlot) || w.zone[i] === Zone.Sacred) return false;
    // The Wild is the Folk's: only cut there when the woodpile is nearly gone in the cold.
    if (w.zone[i] === Zone.Wild && !desperate) return false;
    const t = w.trees[id];
    return !t.felled && !t.protected && t.growth >= 1 && t.reserved === 0 && isExplored(w, tx, tz) && !col.unreachable.has(`t${id}`);
  };
  let found = woodlot ? findNearest(w, home.tx, home.tz, 70, (tx, tz) => ok(tx, tz, true)) : null;
  if (!found) {
    // Anywhere near, then (once all that is cut) further out.
    found = findNearest(w, home.tx, home.tz, 45, (tx, tz) => ok(tx, tz, false))
      ?? findNearest(w, home.tx, home.tz, 70, (tx, tz) => ok(tx, tz, false));
    if (!found) hush(col, 'tree', 60);
    if (found && !col.hints.has('woodlot')) {
      col.hints.add('woodlot');
      log(col.community, `${first(survivorOf(col, a.id))} is cutting wherever there's a tree. "We should mark out a woodlot, and replant what we take."`, 'info');
    }
  }
  if (!found) return null;
  const tree = w.trees[w.treeAt[idx(w, found.tx, found.tz)]];
  if (!setDest(col, a, tileX(w, tree.tx), tileZ(w, tree.tz), true)) {
    col.unreachable.add(`t${tree.id}`);
    return null;
  }
  tree.reserved = a.id;
  return { kind: 'chop', tree: tree.id, stage: 'go' };
}

function pickHaul(col: Colony, a: Agent): Task | null {
  let best: Item | null = null, bestD = Infinity;
  for (const it of col.items) {
    if (it.reserved) continue;
    const d = Math.hypot(it.x - a.x, it.z - a.z);
    if (d < bestD) { best = it; bestD = d; }
  }
  if (!best || !setDest(col, a, best.x, best.z)) return null;
  best.reserved = a.id;
  return { kind: 'haul', item: best.id, stage: 'go' };
}

function pickForage(col: Colony, a: Agent): Task | null {
  const w = col.world;
  // The Wild's berries are the Folk's; only the hungry take them.
  const hungry = (rationing(col) && !committed(col, 'ration')) || col.community.resources.food < col.agents.length * 2;
  const key = hungry ? 'forageH' : 'forage';
  if (quiet(col, key)) return null;
  const found = findNearest(w, toTileX(w, a.x), toTileZ(w, a.z), 40, (tx, tz) => {
    const id = w.bushAt[idx(w, tx, tz)];
    if (id < 0) return false;
    const b = w.bushes[id];
    return b.berries > 0 && b.reserved === 0 && isExplored(w, tx, tz) && !col.unreachable.has(`b${id}`)
      && w.zone[idx(w, tx, tz)] !== Zone.Field && (hungry || w.zone[idx(w, tx, tz)] !== Zone.Wild);
  });
  if (!found) { hush(col, key, 30); return null; }
  const bush = w.bushes[w.bushAt[idx(w, found.tx, found.tz)]];
  if (!setDest(col, a, tileX(w, bush.tx), tileZ(w, bush.tz), true)) {
    col.unreachable.add(`b${bush.id}`);
    return null;
  }
  bush.reserved = a.id;
  return { kind: 'forage', bush: bush.id, stage: 'go', t: 0 };
}

function pickScout(col: Colony, a: Agent): Task | null {
  const w = col.world;
  const omen = col.council.omen;
  if (omen) {
    col.council.omen = null;
    if (setDest(col, a, omen.x, omen.z)) return { kind: 'scout', stage: 'go', t: 0 };
  }
  if (quiet(col, 'scout')) return null;
  const t = withRng(col.community, (rng) => {
    for (let tries = 0; tries < 10; tries++) {
      const ang = rng.range(0, Math.PI * 2);
      const dx = Math.cos(ang), dz = Math.sin(ang);
      for (let r = 8; r < 110; r += 1) {
        const x = w.home.x + dx * r, z = w.home.z + dz * r;
        const tx = toTileX(w, x), tz = toTileZ(w, z);
        if (!isExplored(w, tx, tz)) {
          const back = Math.max(4, r - 3);
          if (setDest(col, a, w.home.x + dx * back, w.home.z + dz * back)) return { kind: 'scout', stage: 'go', t: 0 } as Task;
          break;
        }
      }
    }
    return null;
  });
  // Nothing unexplored within reach this time: look again in a couple of hours.
  if (!t) hush(col, 'scout', 120);
  return t;
}

/** Trees standing on a building site (or in a field) come down first. */
function pickClearing(col: Colony, a: Agent): Task | null {
  const w = col.world;
  for (const i of fieldTiles(col)) {
    const id = w.treeAt[i];
    if (id < 0) continue;
    const tree = w.trees[id];
    if (tree.felled || tree.reserved || tree.protected || col.unreachable.has(`t${id}`)) continue;
    if (!setDest(col, a, tileX(w, tree.tx), tileZ(w, tree.tz), true)) { col.unreachable.add(`t${id}`); continue; }
    tree.reserved = a.id;
    return { kind: 'chop', tree: id, stage: 'go' };
  }
  for (const p of activeProjects(col)) {
    for (const id of p.clearTrees) {
      const tree = w.trees[id];
      if (tree.felled || tree.reserved || col.unreachable.has(`t${id}`)) continue;
      if (!setDest(col, a, tileX(w, tree.tx), tileZ(w, tree.tz), true)) { col.unreachable.add(`t${id}`); continue; }
      tree.reserved = a.id;
      return { kind: 'chop', tree: id, stage: 'go' };
    }
  }
  return null;
}

function pickSupply(col: Colony, a: Agent): Task | null {
  const res = col.community.resources;
  for (const p of activeProjects(col)) {
    for (const m of MATERIALS) {
      const need = outstanding(p, m);
      // Keep the fire fed, and leave a worked field's fence timber on the pile.
      const have = Math.floor(res[m] - (m === 'wood' ? FIRE_WOOD_PER_DAY * 2 + 2 + fenceHold(col) : 0));
      if (need <= 0 || have < 1) continue;
      const amount = Math.min(need, have, m === 'glimmer' ? 6 : 10);
      if (!deliver(col, a)) return null;
      p.incoming[m] += amount;
      return { kind: 'supply', project: p.id, mat: m, amount, stage: 'go' };
    }
  }
  return null;
}

/** A spot just outside a footprint, nearest the agent. */
function workSpot(col: Colony, a: Agent, p: Project): Point {
  const w = col.world;
  if (p.kind === 'clear_store' || p.kind === 'patch_roof') {
    const st = buildingById(col, p.target)!;
    const k = (a.id % 5) - 2;
    return { x: st.door.x + k * 1.2, z: st.door.z + 0.4 };
  }
  const f = p.foot;
  const cands: Point[] = [];
  for (let dx = -1; dx <= f.w; dx++) for (const dz of [-1, f.d]) cands.push({ x: tileX(w, f.tx + dx), z: tileZ(w, f.tz + dz) });
  for (let dz = 0; dz < f.d; dz++) for (const dx of [-1, f.w]) cands.push({ x: tileX(w, f.tx + dx), z: tileZ(w, f.tz + dz) });
  const open = cands.filter((c) => passable(w, toTileX(w, c.x), toTileZ(w, c.z)));
  if (!open.length) return footCenter(w, f);
  // Spread builders around the site.
  open.sort((m, n) => Math.hypot(m.x - a.x, m.z - a.z) - Math.hypot(n.x - a.x, n.z - a.z));
  return open[(a.id * 3) % Math.min(open.length, 6)];
}

function buildable(col: Colony, p: Project) {
  return !p.done && materialsReady(p) && p.clearTrees.every((id) => col.world.trees[id].felled);
}

function pickBuild(col: Colony, a: Agent): Task | null {
  // People work on their own future home first.
  const mine = householdOf(col.village, a.id)?.id;
  const projects = activeProjects(col).sort((p, q) => Number(q.household === mine && !!mine) - Number(p.household === mine && !!mine));
  for (const p of projects) {
    if (!buildable(col, p)) continue;
    const crew = col.agents.filter((o) => o !== a && o.task?.kind === 'build' && o.task.project === p.id).length;
    if (crew >= SITE_CREW && !(mine && p.household === mine)) continue;
    const spot = workSpot(col, a, p);
    if (setDest(col, a, spot.x, spot.z)) return { kind: 'build', project: p.id, stage: 'go' };
  }
  return null;
}

/** Record what was salvaged and where from; the first haul from each place is news. */
function noteSalvage(col: Colony, s: Survivor, h: Heap, take: number) {
  const w = col.world, v = col.village;
  const ruin = h.source !== undefined ? w.ruins[h.source] : undefined;
  const material = h.material ?? (h.kind === 'car' ? 'car panels' : 'odds and ends');
  const from = ruin?.name ?? (h.kind === 'car' ? 'a wreck on the road' : 'a junk heap');
  const key = `${material}|${from}`;
  const isFirst = !Object.keys(v.salvaged).some((k) => k.endsWith(`|${from}`));
  v.salvaged[key] = (v.salvaged[key] ?? 0) + take;
  col.community.resources.cloth += clothFrom(ruin?.kind, h.kind === 'car', take);
  if (isFirst && ruin) log(col.community, `${first(s)} brought back ${material} from ${from}.`);
}

function pickSalvage(col: Colony, a: Agent): Task | null {
  const res = col.community.resources;
  const trade = tradeDemand(col);
  const need = activeProjects(col).reduce((n, p) => n + outstanding(p, 'scrap'), 0) + trade.scrap;
  if (res.scrap >= need + 4 && trade.cloth <= 0) return null;
  const w = col.world;
  let best = null, bestD = Infinity;
  for (const h of w.heaps) {
    if (h.scrap <= 0 || h.reserved || !isExplored(w, h.tx, h.tz) || col.unreachable.has(`h${h.id}`)) continue;
    if (heapHaunted(col, h.tx, h.tz)) continue; // nobody will go that close to what lives there
    const d = Math.hypot(tileX(w, h.tx) - a.x, tileZ(w, h.tz) - a.z);
    if (d < bestD && d < 95) { best = h; bestD = d; }
  }
  // Nothing left where they've been: go looking along the roads nearby (walking there explores it).
  if (!best) {
    const c = w.campfire;
    for (const h of w.heaps) {
      if (h.scrap <= 0 || h.reserved || isExplored(w, h.tx, h.tz) || col.unreachable.has(`h${h.id}`) || heapHaunted(col, h.tx, h.tz)) continue;
      const d = Math.hypot(tileX(w, h.tx) - c.x, tileZ(w, h.tz) - c.z);
      if (d < bestD && d < 45) { best = h; bestD = d; }
    }
  }
  if (!best) return null;
  if (!setDest(col, a, tileX(w, best.tx), tileZ(w, best.tz), true)) { col.unreachable.add(`h${best.id}`); return null; }
  best.reserved = a.id;
  return { kind: 'salvage', heap: best.id, stage: 'go', t: 0 };
}

/** Stripping a ruin in a cleared district for glass, copper or steel (two at a time at most). */
function pickStrip(col: Colony, a: Agent): Task | null {
  const h = hourOf(col);
  if (h >= 15) return null; // too far to go out this late
  const others = col.agents.filter((o) => o !== a && o.task?.kind === 'strip');
  if (others.length >= 2) return null;
  const r = ruinToStrip(col, a, new Set(others.map((o) => (o.task as { ruin: number }).ruin)));
  if (!r) return null;
  const d = ruinDoor(col.world, r);
  if (!setDest(col, a, d.x, d.z)) return null;
  return { kind: 'strip', ruin: r.id, stage: 'go', t: 0 };
}

/** A maker goes to whichever bench the village is shortest from. */
function pickCraft(col: Colony, a: Agent): Task | null {
  if (hourOf(col) >= 18) return null;
  const busy = new Set(col.agents.filter((o) => o !== a && o.task?.kind === 'craft').map((o) => (o.task as { building: number }).building));
  const b = pickTrade(col, busy, a.id);
  if (!b) return null;
  const c = footCenter(col.world, b.foot);
  if (!setDest(col, a, (c.x + b.door!.x) / 2, (c.z + b.door!.z) / 2)) return null;
  return { kind: 'craft', building: b.id, stage: 'go', t: 0 };
}

function pickGarden(col: Colony, a: Agent): Task | null {
  const g = col.village.buildings.find((b) => (b.kind === 'garden' || b.kind === 'dome') && b.tended < 90
    && !col.agents.some((o) => o !== a && o.task?.kind === 'garden' && o.task.building === b.id));
  if (!g) return null;
  const c = footCenter(col.world, g.foot);
  if (!setDest(col, a, c.x, c.z)) return null;
  return { kind: 'garden', building: g.id, stage: 'go', t: 0 };
}

/** In winter, when the stores run low, meals are halved. */
export function rationing(col: Colony): boolean {
  if (committed(col, 'ration')) return true;
  return seasonNow(col) === 'winter' && col.community.resources.food < col.agents.length * 6;
}

/** Winter hunger: ice-fishing at the nearest pond, or picking over old tins. */
/** The walkable shore tile nearest home, if any within 45 tiles. It hardly moves, so it is found once a day. */
function nearestShore(col: Colony): { tx: number; tz: number } | null {
  const w = col.world, memo = (col.memo ??= {});
  if (memo.shoreDay !== col.community.day) {
    const home = { tx: toTileX(w, w.home.x), tz: toTileZ(w, w.home.z) };
    const f = findNearest(w, home.tx, home.tz, 45, (tx, tz) => passable(w, tx, tz) && isExplored(w, tx, tz)
      && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => w.ground[idx(w, tx + dx, tz + dz)] === Ground.Water));
    memo.shoreDay = col.community.day;
    memo.shore = f ? idx(w, f.tx, f.tz) : -1;
  }
  return memo.shore >= 0 ? { tx: memo.shore % w.w, tz: Math.floor(memo.shore / w.w) } : null;
}

function pickScrounge(col: Colony, a: Agent): Task | null {
  const w = col.world;
  const shore = nearestShore(col);
  const spot = shore
    ? { x: tileX(w, shore.tx), z: tileZ(w, shore.tz) }
    : { x: w.home.x + ((a.id * 37) % 21) - 10, z: w.home.z + ((a.id * 53) % 21) - 10 };
  if (!setDest(col, a, spot.x, spot.z)) return null;
  return { kind: 'scrounge', stage: 'go', t: 0, fishing: !!shore };
}

// ---------- fields ----------
export function fieldTiles(col: Colony): number[] {
  const cache = col.private_fieldCache;
  if (cache.version !== col.world.zoneVersion) {
    cache.version = col.world.zoneVersion;
    cache.tiles = [];
    const z = col.world.zone;
    for (let i = 0; i < z.length; i++) if (z[i] === Zone.Field) cache.tiles.push(i);
  }
  return cache.tiles;
}

export function fertility(w: World, i: number): number {
  const g = w.ground[i];
  return g === Ground.Meadow ? 1.25 : g === Ground.Forest ? 0.7 : 1;
}

/** Sowing is only worth it early enough for the crop to ripen before frost. */
function canSow(day: number): boolean {
  const si = seasonIndex(day), ds = ((day - 1) % DAYS_PER_SEASON) + 1;
  return si === 0 || (si === 1 && ds <= DAYS_PER_SEASON / 2);
}

function farmActionFor(col: Colony, i: number, day: number): FarmAction | null {
  const w = col.world;
  if (w.treeAt[i] >= 0 || w.bushAt[i] >= 0 || w.blocked[i]) return null;
  const st = w.cropState[i];
  if (st === Crop.Ripe) return 'harvest';
  if (seasonIndex(day) === 3) return null;
  if (st === Crop.Growing) return col.tended.has(i) ? null : 'tend';
  if (!canSow(day)) return null;
  return st === Crop.Tilled ? 'sow' : 'till';
}

const FARM_ORDER: Record<FarmAction, number> = { harvest: 0, sow: 1, till: 2, tend: 3 };

function pickFarm(col: Colony, a: Agent, only?: FarmAction): Task | null {
  const w = col.world;
  const day = dayOf(col);
  let best = -1, bestAction: FarmAction | null = null, bestScore = Infinity;
  for (const i of fieldTiles(col)) {
    if (col.claims.has(i)) continue;
    const act = farmActionFor(col, i, day);
    if (!act || (only && act !== only)) continue;
    const d = Math.hypot(tileX(w, i % w.w) - a.x, tileZ(w, (i / w.w) | 0) - a.z);
    const score = FARM_ORDER[act] * 40 + d;
    if (score < bestScore) { bestScore = score; best = i; bestAction = act; }
  }
  if (best < 0 || !bestAction) return null;
  if (!setDest(col, a, tileX(w, best % w.w), tileZ(w, (best / w.w) | 0))) return null;
  col.claims.set(best, a.id);
  return { kind: 'farm', tile: best, action: bestAction, stage: 'go', t: 0 };
}

/** Saplings go back into felled woodlot tiles, and into bare woodlot ground. */
function pickPlant(col: Colony, a: Agent): Task | null {
  if (seasonNow(col) === 'winter') return null;
  const w = col.world;
  const free = (i: number) => w.treeAt[i] < 0 && !w.blocked[i] && w.bushAt[i] < 0 && !col.claims.has(i) && w.zone[i] === Zone.Woodlot;
  let tile = col.replant.find(free) ?? -1;
  if (tile < 0) {
    // Establish new woodland on bare woodlot ground, in a loose grid.
    const home = { tx: toTileX(w, w.home.x), tz: toTileZ(w, w.home.z) };
    if (quiet(col, 'plant')) return null;
    const f = findNearest(w, home.tx, home.tz, 70, (tx, tz) => (tx * 7 + tz * 3) % 5 === 0 && free(idx(w, tx, tz)));
    if (!f) { hush(col, 'plant', 60); return null; }
    tile = idx(w, f.tx, f.tz);
  }
  if (!setDest(col, a, tileX(w, tile % w.w), tileZ(w, (tile / w.w) | 0), true)) return null;
  col.claims.set(tile, a.id);
  return { kind: 'plant', tile, stage: 'go', t: 0 };
}

function pickWander(col: Colony, a: Agent): Task | null {
  const w = col.world;
  return withRng(col.community, (rng) => {
    for (let i = 0; i < 6; i++) {
      const x = w.home.x + rng.range(-9, 9), z = w.home.z + rng.range(-9, 9);
      if (passable(w, toTileX(w, x), toTileZ(w, z)) && setDest(col, a, x, z)) {
        return { kind: 'wander', stage: 'go', t: rng.range(10, 30) } as Task;
      }
    }
    return null;
  });
}

/** A cheap per-day coin for habits, 0..99, stable through the day. */
const habit = (col: Colony, key: number) => ((dayOf(col) * 2654435761 + key * 40503) >>> 0) % 100;

function goInside(a: Agent, b: Building) {
  a.door = { x: a.x, z: a.z };
  a.x = b.inside.x; a.z = b.inside.z;
  a.indoors = true;
  a.inside = b.id;
}

const plotById = (col: Colony, id: number | undefined) => col.village.plots.find((p) => p.id === id);
const hallOpen = (col: Colony) => store(col.village).level >= 3;

/** Where to eat: supper at home for those who have one, else the hall, the kitchen, or the fire. */
function mealPlace(col: Colony, a: Agent, s: Survivor): { place: MealPlace; building: number; spot: Point } {
  const v = col.village;
  const h = hourOf(col);
  const home = homeOf(v, s.id);
  const st = store(v);
  const supper = h >= 16 || h < 9;
  if (home && (supper || habit(col, s.id) < 30)) {
    const sociable = s.traits.includes('storyteller') || a.needs.social < 35;
    if (!(hallOpen(col) && sociable && habit(col, s.id + 7) < 50)) return { place: 'home', building: home.id, spot: home.door };
  }
  if (hallOpen(col) && supper) return { place: 'hall', building: st.id, spot: st.door };
  // Fishers out at the pond eat smoked fish by the hut rather than walk home.
  if (s.role === 'fisher') {
    for (const f of v.fisheries) {
      const hut = v.buildings.find((b) => b.id === f.hut);
      if (hut && Math.hypot(hut.door.x - a.x, hut.door.z - a.z) < 30) return { place: 'fire', building: 0, spot: hut.door };
    }
  }
  if (hasBuilt(v, 'kitchen')) return { place: 'kitchen', building: 0, spot: { x: v.site.kitchen.x - 3.5 + (col.agents.indexOf(a) % 8), z: v.site.kitchen.z } };
  return { place: 'fire', building: 0, spot: seatOf(col, a) };
}

/** Where to spend the evening: at home some nights, the hall in bad weather, else the fire. */
function eveningPlace(col: Colony, a: Agent, s: Survivor): { place: 'fire' | 'home' | 'hall' | 'bench' | 'tavern'; building: number; spot: Point } {
  const v = col.village;
  const hh = householdOf(v, s.id);
  const home = homeOf(v, s.id);
  const season = seasonNow(col);
  if (home && hh && habit(col, hh.id * 13) < 45) {
    const plot = plotById(col, home.plot);
    const bench = plot?.yard.find((y) => y.kind === 'bench' && y.progress >= 1);
    if (plot && bench && season !== 'winter' && col.weather !== 'rain' && col.weather !== 'snow' && habit(col, hh.id * 5) < 60) {
      const k = hh.members.indexOf(s.id);
      return { place: 'bench', building: home.id, spot: plotPoint(plot, bench.u + (k - 0.5) * 0.5, bench.v) };
    }
    return { place: 'home', building: home.id, spot: home.door };
  }
  // The tavern: most evenings, for whoever isn't home with their own.
  const tavern = v.buildings.find((b) => b.kind === 'tavern');
  if (tavern && habit(col, s.id * 11 + 5) < 55) return { place: 'tavern', building: tavern.id, spot: tavern.door };
  const st = store(v);
  if (hallOpen(col) && (season === 'winter' || col.weather === 'rain' || col.weather === 'snow')) return { place: 'hall', building: st.id, spot: st.door };
  return { place: 'fire', building: 0, spot: seatOf(col, a) };
}

/** Somewhere to stand while working on a yard feature. */
function yardSpot(plot: Plot, i: number, a: Agent): Point {
  const y = plot.yard[i];
  if (y.kind === 'fence') {
    // Work along the sides and back, in the order the fence goes up.
    const path = plotFence(plot);
    const lens = path.slice(0, -1).map((p, k) => Math.hypot(path[k + 1].x - p.x, path[k + 1].z - p.z));
    let d = Math.min(0.999, y.progress) * lens.reduce((m, n) => m + n, 0);
    for (let k = 0; k < lens.length; k++) {
      if (d <= lens[k]) {
        const f = d / lens[k];
        const p = { x: path[k].x + (path[k + 1].x - path[k].x) * f, z: path[k].z + (path[k + 1].z - path[k].z) * f };
        // A step inside the plot.
        const cx = plot.corners.reduce((m, q) => m + q.x, 0) / plot.corners.length, cz = plot.corners.reduce((m, q) => m + q.z, 0) / plot.corners.length;
        const l = Math.hypot(cx - p.x, cz - p.z) || 1;
        return { x: p.x + ((cx - p.x) / l) * 0.7, z: p.z + ((cz - p.z) / l) * 0.7 };
      }
      d -= lens[k];
    }
  }
  const side = (a.id % 2 ? 1 : -1) * Math.min(0.6, y.w / 3);
  return plotPoint(plot, y.u + side, y.v - y.d / 2 - 0.5);
}

/** Home improvements: build the next yard feature, or tend the vegetable beds. */
/** Fence a field that is in use: one person at a time walks the outline, building as they go. */
function pickFence(col: Colony, a: Agent): Task | null {
  const w = col.world, res = col.community.resources;
  for (const f of w.fields) {
    if (!wantsFence(w, f)) continue;
    if (col.agents.some((o) => o !== a && o.task?.kind === 'fence' && o.task.field === f.id)) continue;
    // Timber for the whole fence must be on hand, with some to spare.
    if (f.fence === 0 && res.wood < fenceWood(f) + 10) continue;
    const { p } = alongPerimeter(f.pts, f.fence);
    if (setDest(col, a, p.x, p.z, true)) return { kind: 'fence', field: f.id, stage: 'go', t: 0 };
  }
  return null;
}

function pickYard(col: Colony, a: Agent, s: Survivor): Task | null {
  const v = col.village;
  const home = homeOf(v, s.id);
  const plot = plotById(col, home?.plot);
  if (!plot) return null;
  const season = seasonNow(col);
  const res = col.community.resources;
  for (let i = 0; i < plot.yard.length; i++) {
    const y = plot.yard[i];
    if (col.agents.some((o) => o !== a && o.task?.kind === 'yard' && o.task.plot === plot.id && o.task.item === i)) continue;
    let want = false;
    if (y.progress < 1) {
      const outdoorsOnly = y.kind === 'beds' || y.kind === 'fruit' || y.kind === 'flowers';
      if (season === 'winter' && outdoorsOnly) continue;
      const c = YARD[y.kind].cost;
      // Don't raid the village stores for a yard.
      if (y.progress === 0 && (res.wood < c.wood + 12 || res.scrap < c.scrap + 3)) continue;
      want = true;
    } else if (y.kind === 'beds' && y.tended < 45 && season !== 'winter') want = true;
    if (!want) continue;
    const spot = yardSpot(plot, i, a);
    if (setDest(col, a, spot.x, spot.z)) return { kind: 'yard', plot: plot.id, item: i, stage: 'go', t: 0 };
  }
  return null;
}

/** What each practice place teaches. */
const PRACTICE: Record<string, { craft: Craft; doing: string; done: string }> = {
  workshop: { craft: 'joinery', doing: 'Practising joints at the workbench', done: 'Cutting joints at the workbench, for the love of it' },
  netshed: { craft: 'netmending', doing: 'Mending nets in the net shed', done: 'Mending nets in the net shed, quick as anything' },
};

/** Practise a craft where it's taught (joinery at the workbench, nets in the net shed). */
function pickPractice(col: Colony, a: Agent, s: Survivor, where: 'workshop' | 'netshed' = 'workshop'): Task | null {
  if (skill(s, PRACTICE[where].craft) >= 0.95) return null;
  const bench = col.village.buildings.find((b) => b.kind === where);
  if (!bench) return null;
  const c = footCenter(col.world, bench.foot);
  if (!setDest(col, a, c.x + ((a.id % 3) - 1) * 0.8, c.z + 0.2)) return null;
  return { kind: 'practice', building: bench.id, stage: 'go', t: 0 };
}

/** Time off: fishing at the pond, cards by the fire, gathering herbs in the meadow. */
function pickLeisure(col: Colony, a: Agent, s: Survivor): Task | null {
  const w = col.world;
  const season = seasonNow(col);
  const k = habit(col, s.id * 7 + Math.floor(col.minute / 240));
  if (season !== 'winter' && col.weather !== 'rain' && k < 35) {
    const shore = nearestShore(col);
    if (shore && setDest(col, a, tileX(w, shore.tx) + ((a.id % 3) - 1) * 0.6, tileZ(w, shore.tz))) return { kind: 'leisure', what: 'fish', stage: 'go', t: 0 };
  }
  if (season !== 'winter' && k < 60) {
    for (let i = 0; i < 4; i++) {
      const ang = ((s.id * 2.3 + i * 1.7 + col.minute / 500) % 6.283);
      const r = 14 + ((s.id * 5 + i * 3) % 9);
      const x = w.home.x + Math.cos(ang) * r, z = w.home.z + Math.sin(ang) * r;
      const tx = toTileX(w, x), tz = toTileZ(w, z);
      if (passable(w, tx, tz) && isExplored(w, tx, tz) && w.ground[idx(w, tx, tz)] === Ground.Meadow && setDest(col, a, x, z)) {
        return { kind: 'leisure', what: 'herbs', stage: 'go', t: 0 };
      }
    }
  }
  const st = store(col.village);
  const spot = hallOpen(col) && (season === 'winter' || col.weather === 'rain') ? st.door : seatOf(col, a);
  return setDest(col, a, spot.x, spot.z) ? { kind: 'leisure', what: 'cards', stage: 'go', t: 0 } : null;
}

const fisheryById = (col: Colony, id: number) => col.village.fisheries.find((f) => f.id === id);
const hasBuilding = (col: Colony, id: number) => id > 0 && col.village.buildings.some((b) => b.id === id);

/** A fisher's day: out to the jetty (or the boat), fish, carry the catch home. */
function pickFish(col: Colony, a: Agent): Task | null {
  const h = hourOf(col);
  if (h >= 16) return null; // too late to walk out and back
  const f = col.village.fisheries.filter((x) => hasBuilding(col, x.jetty))
    .sort((p, q) => col.agents.filter((o) => o.task?.kind === 'fish' && o.task.fishery === p.id).length
      - col.agents.filter((o) => o.task?.kind === 'fish' && o.task.fishery === q.id).length)[0];
  if (!f) return null;
  const others = col.agents.filter((o) => o !== a && o.task?.kind === 'fish' && o.task.fishery === f.id);
  const boat = hasBuilding(col, f.boat) && seasonNow(col) !== 'winter' && !others.some((o) => o.task?.kind === 'fish' && o.task.boat);
  const spot = fishingSpot(col, f, others.length, false);
  if (!setDest(col, a, spot.x, spot.z)) return null;
  return { kind: 'fish', fishery: f.id, stage: 'go', t: 0, boat, catch: 0 };
}

/** Free time goes to what someone hopes for. */
function pursue(col: Colony, a: Agent, s: Survivor): Task | null {
  switch (s.aspiration?.kind) {
    case 'craft': return pickBuild(col, a) ?? pickPractice(col, a, s);
    case 'garden': case 'home': case 'kin': return pickYard(col, a, s) ?? pickBuild(col, a);
    case 'explore': return s.role === 'scout' ? null : pickScout(col, a);
    case 'veil': {
      const r = col.world.fairyRing;
      const ang = (s.id * 1.3) % (Math.PI * 2);
      return setDest(col, a, r.x + Math.cos(ang) * 1.4, r.z + Math.sin(ang) * 1.4) ? { kind: 'attune', stage: 'go', t: 0 } : null;
    }
    default: return pickYard(col, a, s);
  }
}

/**
 * An offering for the Folk: bread left at the door in the hill. One a day,
 * by whoever is most drawn to it (Sight, a hope for the Veil, the Ring's
 * attuners), and only while there is food to spare.
 */
function pickOffering(col: Colony, a: Agent, s: Survivor): Task | null {
  const f = col.folk, c = col.community;
  if (f.offeredDay === c.day || f.standing >= 85 || c.resources.food < col.agents.length * 3) return null;
  // Every day while they are wary; once friendly, every third day keeps the peace.
  if (f.standing >= 50 && c.day - f.offeredDay < 3) return null;
  if (col.agents.some((o) => o.task?.kind === 'offer')) return null;
  const pull = s.sight + (s.aspiration?.kind === 'veil' ? 25 : 0) + (s.role === 'attune' ? 20 : 0) + (f.standing < 30 ? 15 : 0);
  if (pull < 35 || habit(col, s.id * 7 + c.day) > pull) return null;
  const m = col.world.folk.mound;
  const d = m.r + 1.3;
  if (!setDest(col, a, m.x + Math.cos(m.door) * d, m.z + Math.sin(m.door) * d)) return null;
  return { kind: 'offer', stage: 'go', t: 0 };
}

function seatOf(col: Colony, a: Agent): Point {
  const living = col.agents;
  return seatSpot(col.world.campfire, living.indexOf(a), living.length);
}

function chooseTask(col: Colony, a: Agent, s: Survivor): Task | null {
  const h = hourOf(col);
  const res = col.community.resources;
  // Led off by the Folk: they sit where the light left them until someone comes.
  const led = col.folk.led;
  if (led?.id === s.id) return { kind: 'lost', stage: 'wait' };
  // By day, the ones who love them (or the scouts) go looking.
  if (led && h >= 6 && h < 19 && s.role !== 'rest') {
    if (!led.searchers.includes(s.id) && led.searchers.length < 2
      && (bondValue(col.community, s.id, led.id) >= 20 || s.role === 'scout' || led.searchers.length === 0)) led.searchers.push(s.id);
    if (led.searchers.includes(s.id)) {
      const p = { x: led.hint.x + (habit(col, s.id) / 100 - 0.5) * led.hint.r, z: led.hint.z + (habit(col, s.id + 3) / 100 - 0.5) * led.hint.r };
      if (setDest(col, a, p.x, p.z)) return { kind: 'search', stage: 'go', t: 0 };
    }
  }
  // Woken by hunger in the night: eat something before going back to bed.
  if (a.needs.food < 15 && res.food >= 1) {
    const m = mealPlace(col, a, s);
    if (setDest(col, a, m.spot.x, m.spot.z)) return { kind: 'eat', stage: 'go', t: 0, place: m.place, building: m.building };
  }
  if (a.needs.rest < 12 || isNight(h) || s.hp < s.maxHp * 0.25) {
    const b = col.beds.get(s.id);
    const bed = b !== undefined ? buildingById(col, b)!.door : bedSpot(col.world.campfire, s.id);
    if (setDest(col, a, bed.x, bed.z)) return { kind: 'sleep', stage: 'go' };
  }
  if (a.needs.food < 38 && res.food >= 1) {
    const m = mealPlace(col, a, s);
    if (setDest(col, a, m.spot.x, m.spot.z)) return { kind: 'eat', stage: 'go', t: 0, place: m.place, building: m.building };
  }
  if (isEvening(h)) {
    // After supper, someone takes bread to the hill.
    const o = h < 20.5 ? pickOffering(col, a, s) : null;
    if (o) return o;
    const e = eveningPlace(col, a, s);
    if (setDest(col, a, e.spot.x, e.spot.z)) return { kind: 'social', stage: 'go', place: e.place, building: e.building };
  }
  // After the day's work, people follow what they hope for, or potter about their yards.
  if (h >= 17 && s.role !== 'rest' && res.food >= col.agents.length * 4 && habit(col, s.id * 3) < 55) {
    const y = pursue(col, a, s) ?? pickYard(col, a, s);
    if (y) return y;
  }
  let t: Task | null = null;
  // A council rest day: no work, just company.
  if (col.minute < col.council.restUntil) {
    const seat = seatOf(col, a);
    if (setDest(col, a, seat.x, seat.z)) return { kind: 'tend', stage: 'go', t: 0 };
  }
  // When the stores run low, everyone who can goes out foraging (or, in winter, scrounging).
  const pop = col.agents.length;
  if (res.food < pop * 2 && s.role !== 'rest') {
    t = seasonNow(col) === 'winter'
      ? (s.role === 'forager' || s.role === 'farmer' || s.role === 'scout' ? pickScrounge(col, a) : null)
      : s.role !== 'scout' ? pickFarm(col, a, 'harvest') ?? pickForage(col, a) : null;
    if (t) {
      if (!col.hints.has('famine')) {
        col.hints.add('famine');
        log(col.community, 'The stores are nearly bare. Everyone who can is out foraging.', 'bad');
      }
      return t;
    }
  }
  switch (s.role) {
    case 'builder':
      // All hands to the woodpile: no building for now (a council commitment).
      if (committed(col, 'all_hands')) { t = pickTree(col, a) ?? pickForage(col, a) ?? pickHaul(col, a); break; }
      t = pickHaul(col, a) ?? pickClearing(col, a) ?? pickSupply(col, a)
        ?? (col.replant.length >= 3 ? pickPlant(col, a) : null) ?? pickBuild(col, a)
        ?? pickSalvage(col, a) ?? pickStrip(col, a) ?? pickTree(col, a) ?? pickPlant(col, a);
      break;
    case 'farmer':
      t = pickFarm(col, a) ?? pickGarden(col, a) ?? pickFence(col, a) ?? pickForage(col, a) ?? pickHaul(col, a);
      if (!fieldTiles(col).length && seasonNow(col) === 'spring' && !col.hints.has('field')) {
        col.hints.add('field');
        log(col.community, `${first(s)} keeps looking at the meadow. "We could plant here, if someone marked out a field."`, 'info');
      }
      break;
    case 'forager':
      t = pickGarden(col, a) ?? pickForage(col, a) ?? pickFarm(col, a, 'harvest')
        ?? (seasonNow(col) === 'winter' ? pickTree(col, a) : null) ?? pickHaul(col, a);
      break;
    case 'scout': t = pickScout(col, a); break;
    case 'maker':
      t = pickCraft(col, a) ?? pickSalvage(col, a) ?? pickStrip(col, a) ?? pickHaul(col, a) ?? pickSupply(col, a) ?? pickBuild(col, a);
      break;
    case 'fisher':
      // In heavy rain, mend nets in the shed; otherwise out on the water.
      t = (col.weather === 'rain' ? pickPractice(col, a, s, 'netshed') : null) ?? pickFish(col, a)
        ?? pickPractice(col, a, s, 'netshed') ?? pickHaul(col, a);
      break;
    case 'attune': {
      const r = col.world.fairyRing;
      const ang = (s.id * 1.3) % (Math.PI * 2);
      if (setDest(col, a, r.x + Math.cos(ang) * 1.2, r.z + Math.sin(ang) * 1.2)) t = { kind: 'attune', stage: 'go', t: 0 };
      break;
    }
    case 'tender':
    case 'rest': {
      const seat = seatOf(col, a);
      if (setDest(col, a, seat.x, seat.z)) t = { kind: 'tend', stage: 'go', t: 0 };
      break;
    }
  }
  // Anyone at a loose end brings in a ripe harvest or lends a hand on a building site.
  if (!t && s.role !== 'rest') t = pickFarm(col, a, 'harvest') ?? pickBuild(col, a) ?? pursue(col, a, s) ?? pickYard(col, a, s);
  return t ?? pickLeisure(col, a, s) ?? pickWander(col, a);
}

// ---------- running tasks ----------
function stockpileSpot(col: Colony, a: Agent): Point {
  const r = col.world.stockpile;
  const k = (a.id * 0.618) % 1, m = (a.id * 0.382 + col.minute * 0.001) % 1;
  return { x: r.x0 + 0.6 + k * (r.x1 - r.x0 - 1.2), z: r.z0 + 0.6 + m * (r.z1 - r.z0 - 1.2) };
}

function deliver(col: Colony, a: Agent): boolean {
  const spot = stockpileSpot(col, a);
  return setDest(col, a, spot.x, spot.z);
}

function endTask(col: Colony, a: Agent) {
  const t = a.task;
  if (t?.kind === 'supply') {
    // Undo an unfinished delivery: return what was carried, free the promise.
    const p = projectById(col, t.project);
    const pending = t.stage === 'deliver' ? (a.carry?.amount ?? 0) : t.amount;
    if (p) p.incoming[t.mat] = Math.max(0, p.incoming[t.mat] - pending);
    if (a.carry && t.stage === 'deliver') { col.community.resources[t.mat] += a.carry.amount; a.carry = null; }
  }
  if ((a.indoors || a.afloat) && a.door) {
    a.x = a.door.x; a.z = a.door.z;
    a.indoors = false;
    a.afloat = false;
  }
  if (t?.kind === 'fish' && t.catch >= 0.5 && t.stage !== 'deliver') {
    // Cut short with fish in the basket: it's not wasted.
    gainFood(col, 'fishing', t.catch);
  }
  a.inside = 0;
  releaseClaims(col, a.id, t?.kind);
  a.task = null;
  a.path = [];
  a.pathI = 0;
  a.lookAt = null;
}

function runTask(col: Colony, a: Agent, s: Survivor, dt: number) {
  const w = col.world;
  const res = col.community.resources;
  const t = a.task!;
  a.lookAt = null;

  switch (t.kind) {
    case 'chop': {
      const tree = w.trees[t.tree];
      if (tree.felled || tree.reserved !== a.id) return endTask(col, a);
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = `Heading out to fell a ${tree.kind}`;
        if (walk(col, a, dt)) t.stage = 'work';
        return;
      }
      const tp = { x: tileX(w, tree.tx), z: tileZ(w, tree.tz) };
      face(a, tp);
      a.anim = 'chop';
      tree.chop += dt * workRate(s, 'builder', col);
      const need = 20 + tree.size * 25;
      a.activity = `Felling a ${tree.kind} · ${Math.min(99, Math.round((tree.chop / need) * 100))}%`;
      if (tree.chop >= need) {
        tree.felled = true;
        const ti = idx(w, tree.tx, tree.tz);
        w.treeAt[ti] = -1;
        if (w.zone[ti] === Zone.Woodlot) col.replant.push(ti);
        if (w.zone[ti] === Zone.Wild) breakRule(col, s, 'cut');
        // Cutting thins the Veil: gently in a woodlot, sharply near the Ring.
        const nearRing = Math.hypot(tp.x - w.fairyRing.x, tp.z - w.fairyRing.z) < 14;
        disturb(col, tp.x, tp.z, (w.zone[ti] === Zone.Woodlot ? 0.012 : 0.03) * (nearRing ? 2 : 1));
        const len = Math.hypot(tp.x - a.x, tp.z - a.z) || 1;
        col.events.push({ type: 'felled', tree: tree.id, dirX: (tp.x - a.x) / len, dirZ: (tp.z - a.z) / len });
        col.items.push({ id: col.nextItemId++, kind: 'wood', amount: Math.round(3 + tree.size * 5), x: tp.x, z: tp.z, reserved: 0 });
        endTask(col, a);
      }
      return;
    }
    case 'haul': {
      if (t.stage === 'go') {
        const item = col.items.find((it) => it.id === t.item);
        if (!item || item.reserved !== a.id) return endTask(col, a);
        a.anim = 'walk'; a.activity = `Going to fetch ${item.kind}`;
        if (walk(col, a, dt)) {
          const take = Math.min(12, item.amount);
          item.amount -= take;
          a.carry = { kind: item.kind, amount: take };
          if (item.amount <= 0) col.items = col.items.filter((it) => it !== item);
          else item.reserved = 0;
          if (!deliver(col, a)) { a.carry = null; return endTask(col, a); }
          t.stage = 'deliver';
        }
        return;
      }
      a.anim = 'carry'; a.activity = `Hauling ${a.carry?.kind ?? 'goods'} to the stockpile`;
      if (walk(col, a, dt)) {
        if (a.carry) res[a.carry.kind] += a.carry.amount;
        a.carry = null;
        endTask(col, a);
      }
      return;
    }
    case 'forage': {
      const bush = w.bushes[t.bush];
      if (t.stage === 'go') {
        if (bush.berries <= 0 || bush.reserved !== a.id) return endTask(col, a);
        a.anim = 'walk'; a.activity = 'Off to pick berries';
        if (walk(col, a, dt)) t.stage = 'work';
        return;
      }
      if (t.stage === 'work') {
        face(a, { x: tileX(w, bush.tx), z: tileZ(w, bush.tz) });
        a.anim = 'forage'; a.activity = 'Picking berries';
        t.t += dt * workRate(s, 'forager');
        if (t.t >= 20) {
          // Spring gives young greens, not a full crop of berries.
          const seasonYield = seasonNow(col) === 'spring' ? 0.15 : 0.25;
          const amount = Math.max(1, Math.round(bush.berries * seasonYield * (1 + (workRate(s, 'forager') - 1) * 0.5)));
          if (w.zone[idx(w, bush.tx, bush.tz)] === Zone.Wild) breakRule(col, s, 'forage');
          bush.berries = 0;
          bush.regrowAt = col.minute + (7 / landFactor(col, tileX(w, bush.tx), tileZ(w, bush.tz))) * MIN_PER_DAY;
          bush.reserved = 0;
          a.carry = { kind: 'food', amount };
          if (!deliver(col, a)) { gainFood(col, 'forage', amount); a.carry = null; return endTask(col, a); }
          t.stage = 'deliver';
        }
        return;
      }
      a.anim = 'carry'; a.activity = 'Bringing berries home';
      if (walk(col, a, dt)) {
        if (a.carry) gainFood(col, 'forage', a.carry.amount);
        a.carry = null;
        endTask(col, a);
      }
      return;
    }
    case 'eat': {
      if (t.stage === 'go') {
        a.anim = 'walk';
        a.activity = t.place === 'home' ? 'Heading home to eat' : t.place === 'hall' ? 'Going to the hall for supper' : 'Going to eat';
        if (walk(col, a, dt)) {
          const cost = rationing(col) ? 0.5 : 1;
          if (res.food < cost) return endTask(col, a);
          gainFood(col, 'eaten', -cost);
          t.stage = 'eat';
          const b = t.building ? buildingById(col, t.building) : undefined;
          if (b) goInside(a, b);
        }
        return;
      }
      const rations = rationing(col);
      if (t.place === 'fire') face(a, w.campfire); else if (t.place === 'kitchen') a.facing = 0;
      a.anim = 'eat';
      let company = 0;
      if (t.place === 'home' || t.place === 'hall') {
        const mates = col.agents.filter((o) => o !== a && o.inside === t.building && (o.task?.kind === 'eat' || o.task?.kind === 'social'));
        company = mates.length;
        a.needs.social = Math.min(100, a.needs.social + dt * ((company ? 14 : 3) / 60));
        const names = mates.slice(0, 2).map((o) => first(survivorOf(col, o.id)));
        a.activity = rations ? 'Eating half a ration' : t.place === 'home'
          ? (names.length ? `Supper at home with ${names.join(' and ')}` : 'Cooking supper at home')
          : 'Supper in the commons hall';
      } else {
        a.activity = rations ? 'Eating half a ration' : t.place === 'kitchen' ? 'Eating a hot meal in the kitchen' : 'Eating by the fire';
      }
      t.t += dt;
      a.needs.food = Math.min(100, a.needs.food + dt * 2.8);
      if (t.t >= (rations ? 10 : t.place === 'home' || t.place === 'hall' ? 30 : 20)) {
        if (!rations && (t.place === 'home' || t.place === 'hall')) s.morale = Math.min(100, s.morale + (company ? 1.5 : 0.8));
        endTask(col, a);
      }
      return;
    }
    case 'sleep': {
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = 'Turning in';
        if (walk(col, a, dt)) {
          t.stage = 'sleep';
          const b = col.beds.get(s.id);
          const bld = b !== undefined ? buildingById(col, b) : undefined;
          a.sleptIndoors = !!bld;
          if (bld) goInside(a, bld);
        }
        return;
      }
      a.anim = 'sleep';
      a.activity = a.indoors ? `Asleep in ${buildingById(col, col.beds.get(s.id) ?? -1)?.name ?? 'bed'}` : 'Asleep by the fire';
      a.needs.rest = Math.min(100, a.needs.rest + dt * ((col.veil.thinSleep ? 10.5 : 13) / 60));
      const h = hourOf(col);
      if ((!isNight(h) && a.needs.rest >= 85) || a.needs.food < 8) endTask(col, a);
      return;
    }
    case 'social': {
      if (t.stage === 'go') {
        a.anim = 'walk';
        a.activity = { fire: 'Heading to the fire', home: 'Heading home for the evening', hall: 'Heading to the hall', bench: 'Heading home for the evening', tavern: 'Heading to the tavern' }[t.place];
        if (walk(col, a, dt)) {
          t.stage = 'sit';
          const b = t.building && (t.place === 'home' || t.place === 'hall' || t.place === 'tavern') ? buildingById(col, t.building) : undefined;
          if (b) goInside(a, b);
        }
        return;
      }
      a.anim = 'sit';
      if (t.place === 'fire') {
        face(a, w.campfire);
        a.activity = 'Talking by the fire';
        a.needs.social = Math.min(100, a.needs.social + dt * (25 / 60));
      } else {
        const mates = col.agents.filter((o) => o !== a && o.task?.kind === 'social' && o.task.stage === 'sit' && o.task.place === t.place && o.task.building === t.building);
        const names = mates.slice(0, 2).map((o) => first(survivorOf(col, o.id)));
        if (t.place === 'bench') {
          const b = buildingById(col, t.building);
          if (b) face(a, { x: a.x * 2 - b.inside.x, z: a.z * 2 - b.inside.z }); // looking out over the lane
        }
        a.activity = t.place === 'tavern' ? (names.length ? `At the tavern with ${names.join(' and ')}` : 'Nursing a cup at the tavern')
          : t.place === 'hall' ? 'Spending the evening in the commons hall'
          : t.place === 'bench' ? (names.length ? `Sitting out on the bench with ${names.join(' and ')}` : 'Sitting out on the bench')
          : names.length ? `A quiet evening in with ${names.join(' and ')}` : 'A quiet evening at home';
        a.needs.social = Math.min(100, a.needs.social + dt * ((t.place === 'hall' || t.place === 'tavern' ? 25 : mates.length ? 20 : 6) / 60));
      }
      if (!isEvening(hourOf(col))) endTask(col, a);
      return;
    }
    case 'leisure': {
      if (t.stage === 'go') {
        a.anim = 'walk';
        a.activity = { fish: 'Off to the pond with a line', herbs: 'Wandering out into the meadow', cards: 'Looking for someone to play cards with' }[t.what];
        if (walk(col, a, dt)) {
          t.stage = 'do';
          if (t.what === 'cards' && hallOpen(col) && Math.hypot(a.x - store(col.village).door.x, a.z - store(col.village).door.z) < 1.5) goInside(a, store(col.village));
        }
        return;
      }
      t.t += dt;
      if (t.what === 'fish') {
        a.anim = 'sit'; a.activity = 'Fishing at the pond';
        if (t.t >= 90) { if (habit(col, a.id + Math.floor(col.minute)) < 40) gainFood(col, 'fishing', 1); endTask(col, a); }
      } else if (t.what === 'herbs') {
        a.anim = 'forage'; a.activity = 'Picking yarrow and meadowsweet';
        if (t.t >= 60) { if (habit(col, a.id * 3 + Math.floor(col.minute)) < 15) res.medicine += 1; endTask(col, a); }
      } else {
        a.anim = 'sit';
        const others = col.agents.filter((o) => o !== a && o.task?.kind === 'leisure' && o.task.what === 'cards' && o.task.stage === 'do' && Math.hypot(o.x - a.x, o.z - a.z) < 4);
        if (!a.indoors) face(a, w.campfire);
        a.activity = others.length ? `Playing cards with ${others.slice(0, 2).map((o) => first(survivorOf(col, o.id))).join(' and ')}` : 'Laying out a hand of patience';
        a.needs.social = Math.min(100, a.needs.social + dt * ((others.length ? 18 : 3) / 60));
        if (others.length && habit(col, a.id + Math.floor(col.minute / 30)) < 2) adjustBond(col.community, a.id, others[0].id, 1);
        if (t.t >= 60) endTask(col, a);
      }
      return;
    }
    case 'fish': {
      const f = fisheryById(col, t.fishery);
      if (!f || !hasBuilding(col, f.jetty)) return endTask(col, a);
      const pond = pondOf(w, f);
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = `Walking out to ${pond.name} to fish`;
        if (walk(col, a, dt)) {
          t.stage = 'fish';
          if (t.boat) {
            const out = fishingSpot(col, f, 0, true);
            a.door = { x: a.x, z: a.z };
            a.x = out.x; a.z = out.z;
            a.afloat = true;
          }
        }
        return;
      }
      if (t.stage === 'fish') {
        const season = seasonNow(col);
        const [dx, dz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][f.facing];
        a.facing = Math.atan2(dx, dz);
        a.anim = 'fish';
        const rate = catchRate(col, f, s, t.boat, season) * workRate(s, 'fisher', col);
        const got = Math.min(pond.stock, (dt / 60) * rate);
        pond.stock -= got;
        t.catch += got;
        t.t += dt;
        a.activity = `${season === 'winter' ? 'Fishing through the ice' : t.boat ? 'Out in the boat' : 'Fishing off the jetty'} at ${pond.name} · ${Math.floor(t.catch)} caught`;
        // Net-mending comes with time on the water, faster beside someone who knows it.
        if (!knows(s, 'netmending')) {
          const teacher = col.agents.some((o) => o !== a && o.task?.kind === 'fish' && o.task.fishery === f.id && knows(survivorOf(col, o.id), 'netmending'));
          if (learn(s, 'netmending', dt * (0.00003 + (teacher ? 0.00008 : 0)))) {
            log(col.community, `${first(s)} has learned to mend and set nets properly. The catch will show it.`, 'good');
            remember(s, col.community.day, 'Learned to mend nets.');
          }
        }
        if (hourOf(col) >= 16.5 || t.catch >= 12 || a.needs.food < 20) {
          if (a.afloat && a.door) { a.x = a.door.x; a.z = a.door.z; a.afloat = false; }
          a.carry = { kind: 'food', amount: Math.round(t.catch * 10) / 10 };
          if (!deliver(col, a)) { gainFood(col, 'fishing', t.catch); t.catch = 0; a.carry = null; return endTask(col, a); }
          t.stage = 'deliver';
        }
        return;
      }
      a.anim = 'carry'; a.activity = `Carrying the catch home from ${pond.name}`;
      if (walk(col, a, dt)) {
        if (a.carry) gainFood(col, 'fishing', a.carry.amount);
        a.carry = null;
        t.catch = 0;
        endTask(col, a);
      }
      return;
    }
    case 'strip': {
      const r = w.ruins[t.ruin];
      if (!r) return endTask(col, a);
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = `Walking out to strip ${r.name}`;
        if (walk(col, a, dt)) t.stage = 'work';
        return;
      }
      if (t.stage === 'work') {
        face(a, r);
        a.anim = 'build'; a.activity = `Stripping ${r.name}`;
        t.t += dt * workRate(s, 'builder', col);
        if (t.t >= 50) {
          const got = strip(col, r, 3, first(s));
          if (!got) return endTask(col, a);
          a.carry = { kind: got.mat, amount: got.amount };
          if (!deliver(col, a)) { res[got.mat] += got.amount; a.carry = null; return endTask(col, a); }
          t.stage = 'deliver';
        }
        return;
      }
      a.anim = 'carry'; a.activity = `Carrying ${a.carry?.kind ?? 'salvage'} home`;
      if (walk(col, a, dt)) {
        if (a.carry) res[a.carry.kind as 'glass'] += a.carry.amount;
        a.carry = null;
        endTask(col, a);
      }
      return;
    }
    case 'craft': {
      const b = buildingById(col, t.building);
      const def = b ? TRADES[b.kind as keyof typeof TRADES] : undefined;
      if (!b || !def) return endTask(col, a);
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = `Going to the ${b.name.toLowerCase()}`;
        if (walk(col, a, dt)) t.stage = 'work';
        return;
      }
      face(a, footCenter(w, b.foot));
      a.anim = b.kind === 'tailor' ? 'sit' : 'build';
      a.activity = def.doing;
      t.t += dt * workRate(s, 'maker', col);
      if (t.t >= def.minutes) {
        finishBatch(col, b, first(s));
        endTask(col, a);
      }
      return;
    }
    case 'practice': {
      const b = buildingById(col, t.building);
      if (!b) return endTask(col, a);
      const P = PRACTICE[b.kind] ?? PRACTICE.workshop;
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = b.kind === 'netshed' ? 'Heading to the net shed' : 'Heading to the workbench to practise';
        if (walk(col, a, dt)) t.stage = 'work';
        return;
      }
      face(a, footCenter(w, b.foot));
      a.anim = b.kind === 'netshed' ? 'sit' : 'build';
      const teacher = col.agents.find((o) => o !== a && o.task?.kind === 'practice' && o.task.building === t.building && knows(survivorOf(col, o.id), P.craft));
      a.activity = knows(s, P.craft) ? P.done : `${P.doing} · ${Math.round((skill(s, P.craft) / SKILLED) * 100)}%`;
      const knack = P.craft === 'joinery' ? (s.traits.includes('tinkerer') ? 1.8 : 1) : (s.traits.includes('stoic') ? 1.4 : 1);
      if (learn(s, P.craft, dt * (0.00006 + (teacher ? 0.0001 : 0)) * knack)) {
        log(col.community, P.craft === 'joinery' ? `${first(s)} has the knack of joinery now, from evenings at the workbench.`
          : `${first(s)} can mend a net as fast as they can talk now.`, 'good');
        remember(s, col.community.day, P.craft === 'joinery' ? 'Learned to joint timber.' : 'Learned to mend nets.');
      }
      t.t += dt;
      if (t.t >= 90) endTask(col, a);
      return;
    }
    case 'fence': {
      const f = w.fields.find((x) => x.id === t.field);
      if (!f || f.fence >= 1) return endTask(col, a);
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = 'Going to fence the field';
        if (walk(col, a, dt)) t.stage = 'work';
        return;
      }
      if (f.fence === 0) {
        const need = fenceWood(f);
        if (res.wood < need) return endTask(col, a);
        res.wood -= need;
        f.fence = 0.0001;
        log(col.community, `${first(s)} has started fencing the field, post by post.`, 'info');
      }
      a.anim = 'build';
      const len = perimeter(f.pts);
      const before = f.fence;
      f.fence = Math.min(1, f.fence + (dt * workRate(s, 'builder', col)) / (len * FENCE_WORK_PER_UNIT));
      a.activity = `Fencing the field · ${Math.round(f.fence * 100)}%`;
      if (f.fence >= 1) {
        log(col.community, `The field is fenced now, with a gate towards the village.`, 'good');
        return endTask(col, a);
      }
      // Every couple of metres, walk on to the next stretch.
      if (Math.floor(f.fence * len / 2) !== Math.floor(before * len / 2)) {
        const { p } = alongPerimeter(f.pts, f.fence);
        if (!setDest(col, a, p.x, p.z, true)) return endTask(col, a);
        t.stage = 'go';
      }
      return;
    }
    case 'yard': {
      const plot = plotById(col, t.plot);
      const y = plot?.yard[t.item];
      if (!plot || !y) return endTask(col, a);
      if (t.stage === 'go') {
        a.anim = 'walk';
        a.activity = y.progress >= 1 ? 'Heading home to see to the vegetables' : `Heading home to work on ${YARD[y.kind].name}`;
        if (walk(col, a, dt)) t.stage = 'work';
        return;
      }
      face(a, y.kind === 'fence' ? { x: a.x + plot.n.x, z: a.z + plot.n.z } : plotPoint(plot, y.u, y.v));
      if (y.progress < 1) {
        if (y.progress === 0) {
          const c = YARD[y.kind].cost;
          if (res.wood < c.wood || res.scrap < c.scrap) return endTask(col, a);
          res.wood -= c.wood; res.scrap -= c.scrap;
          y.progress = 0.001;
        }
        a.anim = y.kind === 'beds' || y.kind === 'fruit' || y.kind === 'flowers' ? 'forage' : 'build';
        y.progress = Math.min(1, y.progress + (dt * workRate(s, 'builder', col)) / YARD[y.kind].work);
        a.activity = `Making ${YARD[y.kind].name} at home · ${Math.min(99, Math.round(y.progress * 100))}%`;
        if (y.progress >= 1) {
          const h = householdOf(col.village, s.id);
          const who = h && h.members.length > 1 ? householdName(col.community, h) : first(s);
          log(col.community, `${who} finished ${YARD[y.kind].name} ${y.kind === 'fence' ? 'around their plot' : 'in their yard'}.`, 'good');
          remember(s, col.community.day, `Made ${YARD[y.kind].name} at home.`);
          if (y.kind === 'fruit' || y.kind === 'flowers') nurture(col, a.x, a.z, 0.01);
          if (y.kind !== 'fence') return endTask(col, a);
          // The fence walker picks the next stretch.
        } else if (y.kind === 'fence') {
          // Walk along as the fence goes up.
          const spot = yardSpot(plot, t.item, a);
          if (Math.hypot(spot.x - a.x, spot.z - a.z) > 1.5 && setDest(col, a, spot.x, spot.z)) { t.stage = 'go'; return; }
        }
      } else {
        a.anim = 'forage';
        a.activity = 'Weeding the vegetable beds at home';
        y.tended += dt * workRate(s, 'farmer');
        if (y.tended >= 60) return endTask(col, a);
      }
      t.t += dt;
      if (t.t >= 90) endTask(col, a);
      return;
    }
    case 'tend': {
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = s.role === 'rest' ? 'Going to rest' : 'Going to tend the fire';
        if (walk(col, a, dt)) t.stage = 'sit';
        return;
      }
      face(a, w.campfire);
      a.anim = 'sit';
      a.activity = s.role === 'rest' ? 'Resting by the fire' : 'Tending the fire';
      t.t += dt;
      if (s.role === 'rest') s.hp = Math.min(s.maxHp, s.hp + dt / 60);
      // Company: anyone nearby feels a little less alone.
      for (const o of col.agents) {
        if (o !== a && Math.hypot(o.x - a.x, o.z - a.z) < 5) o.needs.social = Math.min(100, o.needs.social + dt * (6 / 60));
      }
      if (t.t >= 60) endTask(col, a);
      return;
    }
    case 'lost': {
      if (col.folk.led?.id !== s.id) return endTask(col, a);
      a.anim = 'idle'; a.activity = `Lost in the woods near ${w.folk.mound.name}`;
      return;
    }
    case 'search': {
      const led = col.folk.led;
      if (!led) return endTask(col, a);
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = `Searching the woods for ${first(survivorOf(col, led.id))}`;
        if (walk(col, a, dt)) t.stage = 'look';
        return;
      }
      a.anim = 'idle'; a.activity = `Calling for ${first(survivorOf(col, led.id))} among the trees`;
      if (Math.hypot(a.x - led.x, a.z - led.z) < 5) { endLed(col, s); return endTask(col, a); }
      t.t += dt;
      if (t.t >= 30) {
        // Closer each time: they follow broken twigs, a dropped glove, the humming.
        led.hint = { x: led.hint.x + (led.x - led.hint.x) * 0.45, z: led.hint.z + (led.z - led.hint.z) * 0.45, r: Math.max(2, led.hint.r * 0.6) };
        endTask(col, a);
      }
      return;
    }
    case 'offer': {
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = `Taking bread to ${w.folk.mound.name}`;
        if (walk(col, a, dt)) t.stage = 'leave';
        return;
      }
      a.anim = 'idle'; a.activity = 'Leaving an offering at the door in the hill';
      t.t += dt;
      if (t.t >= 10) {
        if (res.food >= 1 && leaveOffering(col, s)) gainFood(col, 'offerings', -1);
        endTask(col, a);
      }
      return;
    }
    case 'attune': {
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = 'Walking to the Ring';
        if (walk(col, a, dt)) t.stage = 'sit';
        return;
      }
      face(a, w.fairyRing);
      a.anim = 'sit'; a.activity = 'Sitting with the wisps';
      t.t += dt;
      res.glimmer += dt * 0.004 * workRate(s, 'attune') * (1 + s.stats.attunement * 0.2) * (0.3 + resonanceAt(col, w.fairyRing.x, w.fairyRing.z));
      if (t.t >= 120) endTask(col, a);
      return;
    }
    case 'scout': {
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = 'Scouting the edge of the map';
        if (walk(col, a, dt)) t.stage = 'look';
        return;
      }
      a.anim = 'look'; a.activity = 'Taking in the view';
      t.t += dt;
      if (t.t >= 20) endTask(col, a);
      return;
    }
    case 'build': {
      const p = projectById(col, t.project);
      if (!p || p.done || !buildable(col, p)) return endTask(col, a);
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = `Walking to the site: ${p.name.toLowerCase()}`;
        if (walk(col, a, dt)) t.stage = 'work';
        return;
      }
      face(a, p.kind === 'clear_store' || p.kind === 'patch_roof' ? buildingById(col, p.target)!.inside : footCenter(w, p.foot));
      a.anim = 'build';
      p.work += dt * workRate(s, 'builder', col);
      // Building teaches joinery: slowly alone, quickly beside someone who knows it.
      if (!knows(s, 'joinery')) {
        const teacher = col.agents.find((o) => o !== a && o.task?.kind === 'build' && o.task.project === p.id
          && o.task.stage === 'work' && knows(survivorOf(col, o.id), 'joinery'));
        const rate = (0.00002 + (teacher ? 0.00008 : 0)) * (s.traits.includes('tinkerer') ? 1.8 : 1)
          * (hasBuilt(col.village, 'workshop') ? 1.5 : 0.6) * (p.tier === 1 ? 1.3 : 1);
        if (learn(s, 'joinery', dt * rate)) {
          const by = teacher ? `, taught at ${first(survivorOf(col, teacher.id))}'s elbow` : '';
          log(col.community, `${first(s)} has the knack of joinery now${by}.`, 'good');
          remember(s, col.community.day, 'Learned to joint timber.');
        }
      }
      a.activity = `${p.kind === 'clear_store' || p.kind === 'patch_roof' ? p.name : `Building: ${p.name.toLowerCase()}`} · ${Math.min(99, Math.round((p.work / p.workNeeded) * 100))}%`;
      if (p.work >= p.workNeeded) {
        completeProject(w, col.village, col.community, p);
        if (p.fishery) {
          const b = col.village.buildings[col.village.buildings.length - 1];
          if (b && b.kind === p.kind) onFisheryBuilt(col, b, p.fishery);
        }
        if (p.kind === 'home') {
          const b = col.village.buildings.find((x) => x.kind === 'home' && x.plot === p.plot);
          if (b) onHomeBuilt(col, b);
        }
        remember(s, col.community.day, `Helped finish ${p.name.toLowerCase()}.`);
        syncAgents(col, true);
        replan(col);
        endTask(col, a);
      }
      return;
    }
    case 'supply': {
      const p = projectById(col, t.project);
      if (!p || p.done) return endTask(col, a);
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = `Fetching ${t.mat} for ${p.name.toLowerCase()}`;
        if (walk(col, a, dt)) {
          const take = Math.min(t.amount, Math.floor(res[t.mat]));
          if (take < 1) return endTask(col, a);
          res[t.mat] -= take;
          p.incoming[t.mat] -= t.amount - take;
          a.carry = { kind: t.mat, amount: take };
          const spot = workSpot(col, a, p);
          if (!setDest(col, a, spot.x, spot.z)) return endTask(col, a);
          t.stage = 'deliver';
        }
        return;
      }
      a.anim = 'carry'; a.activity = `Carrying ${t.mat} to ${p.name.toLowerCase()}`;
      if (walk(col, a, dt)) {
        const amt = a.carry?.amount ?? 0;
        p.delivered[t.mat] += amt;
        p.incoming[t.mat] = Math.max(0, p.incoming[t.mat] - amt);
        a.carry = null;
        a.task = null; // delivered: nothing to undo
        endTask(col, a);
      }
      return;
    }
    case 'salvage': {
      const h = w.heaps[t.heap];
      if (t.stage === 'go') {
        if (h.scrap <= 0 || h.reserved !== a.id) return endTask(col, a);
        a.anim = 'walk'; a.activity = h.kind === 'car' ? 'Off to strip a wrecked car' : 'Off to pick through a junk heap';
        if (walk(col, a, dt)) t.stage = 'work';
        return;
      }
      if (t.stage === 'work') {
        face(a, { x: tileX(w, h.tx), z: tileZ(w, h.tz) });
        a.anim = 'build'; a.activity = h.kind === 'car' ? 'Stripping a wreck for scrap' : 'Sorting through junk';
        t.t += dt * workRate(s, 'builder', col);
        if (t.t >= 30) {
          const take = Math.min(6, h.scrap);
          h.scrap -= take;
          noteSalvage(col, s, h, take);
          disturb(col, tileX(w, h.tx), tileZ(w, h.tz), 0.015);
          h.reserved = 0;
          a.carry = { kind: 'scrap', amount: take };
          if (!deliver(col, a)) { res.scrap += take; a.carry = null; return endTask(col, a); }
          t.stage = 'deliver';
        }
        return;
      }
      a.anim = 'carry'; a.activity = 'Hauling scrap home';
      if (walk(col, a, dt)) {
        if (a.carry) res.scrap += a.carry.amount;
        a.carry = null;
        endTask(col, a);
      }
      return;
    }
    case 'garden': {
      const g = buildingById(col, t.building);
      if (!g) return endTask(col, a);
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = `Going to tend the ${g.name.toLowerCase()}`;
        if (walk(col, a, dt)) t.stage = 'work';
        return;
      }
      a.anim = 'forage'; a.activity = `Weeding the ${g.name.toLowerCase()}`;
      g.tended += dt * workRate(s, 'forager');
      t.t += dt;
      if (t.t >= 60) endTask(col, a);
      return;
    }
    case 'farm': {
      const i = t.tile;
      const tp = { x: tileX(w, i % w.w), z: tileZ(w, (i / w.w) | 0) };
      if (t.stage === 'go') {
        a.anim = 'walk';
        a.activity = t.action === 'harvest' ? 'Going to bring in the harvest' : `Heading to the field to ${t.action}`;
        if (walk(col, a, dt)) t.stage = 'work';
        return;
      }
      if (t.stage === 'deliver') {
        a.anim = 'carry'; a.activity = 'Carrying the harvest to the stores';
        if (walk(col, a, dt)) {
          if (a.carry) gainFood(col, 'fields', a.carry.amount);
          a.carry = null;
          endTask(col, a);
        }
        return;
      }
      if (farmActionFor(col, i, dayOf(col)) !== t.action) {
        // Someone else did it, or the season turned. Deliver anything carried.
        if (a.carry && deliver(col, a)) { t.stage = 'deliver'; col.claims.delete(i); return; }
        return endTask(col, a);
      }
      const dur = { till: 16, sow: 10, tend: 12, harvest: 12 }[t.action];
      a.anim = t.action === 'till' ? 'build' : 'forage';
      a.activity = { till: 'Turning the soil', sow: 'Sowing seed', tend: 'Weeding and watering', harvest: 'Harvesting' }[t.action];
      a.facing = Math.atan2(tp.x - a.x + 0.01, tp.z - a.z + 0.3);
      t.t += dt * workRate(s, 'farmer', col);
      if (t.t < dur) return;
      w.cropVersion++;
      if (t.action === 'till') w.cropState[i] = Crop.Tilled;
      else if (t.action === 'sow') { w.cropState[i] = Crop.Growing; w.cropGrowth[i] = 0; }
      else if (t.action === 'tend') {
        // Tending covers the neighbouring rows too.
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const j = i + dz * w.w + dx;
          if (j >= 0 && j < w.cropState.length && w.cropState[j] === Crop.Growing) col.tended.add(j);
        }
      } else {
        w.cropState[i] = Crop.Untilled;
        w.cropGrowth[i] = 0;
        const amount = Math.round(3 * fertility(w, i) * (0.8 + workRate(s, 'farmer') * 0.2));
        a.carry = { kind: 'food', amount: (a.carry?.amount ?? 0) + amount };
        col.claims.delete(i);
        // Keep harvesting along the row until the basket is full.
        if (a.carry.amount < 10) {
          const next = pickFarm(col, a, 'harvest');
          if (next && next.kind === 'farm') { a.task = next; return; }
        }
        if (deliver(col, a)) { t.stage = 'deliver'; return; }
        gainFood(col, 'fields', a.carry.amount); a.carry = null;
      }
      endTask(col, a);
      return;
    }
    case 'scrounge': {
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = t.fishing ? 'Trudging out to fish through the ice' : 'Searching the ruins for old tins';
        if (walk(col, a, dt)) t.stage = 'work';
        return;
      }
      if (t.stage === 'work') {
        a.anim = t.fishing ? 'sit' : 'forage';
        a.activity = t.fishing ? 'Fishing through the ice' : 'Picking through old cupboards';
        t.t += dt;
        if (t.t < 100) return;
        a.carry = { kind: 'food', amount: t.fishing ? 3 : 2 };
        if (!deliver(col, a)) { gainFood(col, 'scrounge', a.carry.amount); a.carry = null; return endTask(col, a); }
        t.stage = 'deliver';
        return;
      }
      a.anim = 'carry'; a.activity = 'Bringing back what little there was';
      if (walk(col, a, dt)) {
        if (a.carry) gainFood(col, 'scrounge', a.carry.amount);
        a.carry = null;
        endTask(col, a);
      }
      return;
    }
    case 'plant': {
      const i = t.tile;
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = 'Carrying saplings to the woodlot';
        if (walk(col, a, dt)) t.stage = 'work';
        return;
      }
      face(a, { x: tileX(w, i % w.w), z: tileZ(w, (i / w.w) | 0) });
      a.anim = 'forage'; a.activity = 'Planting a sapling';
      t.t += dt;
      if (t.t < 15) return;
      if (w.treeAt[i] < 0 && !w.blocked[i]) {
        const tx = i % w.w, tz = (i / w.w) | 0;
        const kinds: Tree['kind'][] = ['oak', 'birch', 'pine'];
        const tree: Tree = {
          id: w.trees.length, tx, tz, kind: kinds[(tx + tz) % 3], size: 0.85 + ((tx * 13 + tz * 7) % 10) / 20,
          felled: false, chop: 0, reserved: 0, protected: false, growth: 0.05, planted: true,
        };
        w.trees.push(tree);
        w.treeAt[i] = tree.id;
        nurture(col, tileX(w, tx), tileZ(w, tz), 0.008);
        col.events.push({ type: 'planted', tree: tree.id });
      }
      col.replant = col.replant.filter((x) => x !== i);
      endTask(col, a);
      return;
    }
    case 'wander': {
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = 'Stretching their legs';
        if (walk(col, a, dt)) t.stage = 'pause';
        return;
      }
      a.anim = 'idle'; a.activity = 'Idling';
      t.t -= dt;
      if (t.t <= 0) endTask(col, a);
      return;
    }
  }
}

/** Evening and night pull people home unless they are mid-delivery. */
function shouldInterrupt(col: Colony, a: Agent): boolean {
  const t = a.task;
  if (!t || a.carry) return false;
  const h = hourOf(col);
  if (t.kind === 'lost') return false;
  if (isNight(h)) return t.kind !== 'sleep' && t.kind !== 'eat';
  if (isEvening(h)) return !['social', 'eat', 'sleep', 'offer'].includes(t.kind);
  if (a.needs.food < 15 && col.community.resources.food >= 1) return t.kind !== 'eat' && t.kind !== 'sleep';
  return false;
}

// ---------- hourly and daily ----------
const TALK_GOOD = [
  '{a} and {b} traded stories about the old highway.',
  '{a} taught {b} a card game from before.',
  '{a} and {b} argued, happily, about what the orb wants.',
  '{a} laughed at something {b} said.',
  '{a} and {b} named the stars they could still remember.',
];
const TALK_BAD = [
  '{a} and {b} sat on opposite sides of the fire.',
  '{a} took the last of the tea. {b} noticed.',
];

const STRANGE = [
  '{a} says the wisps spelled something tonight. {a} won\'t say what.',
  '{a} came back from the Ring humming a tune nobody taught them.',
  '{a} swears one of the mushrooms turned to watch them leave.',
  '{a} counted the wisps twice and got different numbers.',
  'The Ring was warm to the touch today, {a} says.',
  '{a} heard their own name in the rustle of the grass.',
];

function hourly(col: Colony) {
  const c = col.community;
  const living = alive(c);
  const homeRes = homeResonance(col);
  const needMood = needComfort(col, needRows(col));
  const dressed = clothed(col);
  withRng(c, (rng) => {
    for (const s of living) {
      const a = col.agents.find((x) => x.id === s.id);
      if (!a) continue;
      if (a.needs.food <= 0) {
        s.hp -= 0.12;
        if (s.hp <= 0) { killSurvivor(c, s.id, 'hunger'); continue; }
      } else if (a.needs.food > 30 && a.needs.rest > 30) {
        s.hp = Math.min(s.maxHp, s.hp + 0.25 * healFactor(homeRes));
      }
      const needs = (a.needs.food + a.needs.rest + a.needs.social) / 3;
      let friends = 0;
      for (const o of living) if (o !== s && bondValue(c, s.id, o.id) >= 20) friends += 0.5;
      const v = col.village;
      // Home: comfort of their own; crowding in shared sleeping rooms; waiting for a house.
      let home = 0;
      const bid = col.beds.get(s.id);
      const bed = bid !== undefined ? buildingById(col, bid) : undefined;
      if (bed?.kind === 'home') home += homeComfort(v, bed);
      else if (bed) {
        let n = 0;
        for (const x of col.beds.values()) if (x === bed.id) n++;
        home -= Math.min(4, Math.max(0, n - 4) * 0.8);
      }
      const hh = householdOf(v, s.id);
      if (hh && !hh.home && c.day - hh.since > 4) home -= 2;
      if (hallOpen(col)) home += 1;
      const comfort = home + (a.sleptIndoors ? 4 : -2) + (hasBuilt(v, 'kitchen') ? 2 : 0) + needMood
        - (seasonNow(col) === 'winter' ? 4 * (1 - dressed) : 0) + (hasBuilt(v, 'tavern') ? 1 : 0)
        + Math.min(1.5, v.buildings.filter((b) => b.kind === 'lantern').length * 0.5)
        - (rationing(col) ? 10 : 0) - (seasonNow(col) === 'winter' ? 5 : 0)
        + (homeRes < 0.3 ? -4 : homeRes > 0.6 ? 2 : 0) + (col.minute < col.council.festivalUntil ? 6 : 0);
      const target = TUNING.moraleBaseline + traitSum(s, (t) => t.moraleBaseline, 0, 'add')
        + (needs - 55) * 0.25 + Math.min(friends, 4) - (s.griefDays > 0 ? 15 : 0) + comfort;
      s.morale = Math.max(0, Math.min(100, s.morale + (target - s.morale) * 0.06));
    }

    // Households spending the evening together grow closer.
    const atHome = col.agents.filter((a) => a.task?.kind === 'social' && a.task.stage === 'sit' && (a.task.place === 'home' || a.task.place === 'bench'));
    for (const x of atHome) for (const y of atHome) {
      if (x.id >= y.id || x.task?.kind !== 'social' || y.task?.kind !== 'social' || x.task.building !== y.task.building) continue;
      adjustBond(c, x.id, y.id, 1.2);
      if (rng.chance(0.05)) {
        const [na, nb] = [first(survivorOf(col, x.id)), first(survivorOf(col, y.id))];
        log(c, rng.pick([
          `${na} and ${nb} stayed in tonight, talking by their own hearth.`,
          `${na} read aloud to ${nb} from a swollen paperback.`,
          `${na} and ${nb} sat out on the step and watched the wisps come up.`,
        ]), 'info');
      }
    }
    // Conversations around the fire (or in the hall).
    const sitting = col.agents.filter((a) => a.task?.kind === 'social' && a.task.stage === 'sit' && (a.task.place === 'fire' || a.task.place === 'hall'));
    if (sitting.length >= 2 && rng.chance(0.5)) {
      const [x, y] = rng.shuffle([...sitting]).slice(0, 2);
      const sa = survivorOf(col, x.id), sb = survivorOf(col, y.id);
      const bond = bondValue(c, sa.id, sb.id);
      const rate = traitSum(sa, (t) => t.bondRate, 1, 'mul') * traitSum(sb, (t) => t.bondRate, 1, 'mul');
      const good = bond > -30 || rng.chance(0.3);
      adjustBond(c, sa.id, sb.id, (good ? 3 : -2) * rate);
      if (good) nurture(col, col.world.home.x, col.world.home.z, 0.002, 2);
      else disturb(col, col.world.home.x, col.world.home.z, 0.006, 2);
      if (rng.chance(0.6)) {
        const line = rng.pick(good ? TALK_GOOD : TALK_BAD).replace('{a}', first(sa)).replace('{b}', first(sb));
        log(c, line, good ? 'info' : 'bad');
      }
    }

    // Attuners occasionally report something odd (never the same line twice running).
    const recent = new Set(c.log.slice(-12).map((l) => l.text));
    for (const a of col.agents) {
      if (a.task?.kind !== 'attune' || a.task.stage !== 'sit' || !rng.chance(0.035)) continue;
      const n = first(survivorOf(col, a.id));
      const lines = STRANGE.map((l) => l.replaceAll('{a}', n)).filter((l) => !recent.has(l));
      if (lines.length) log(c, rng.pick(lines), 'strange');
    }

    const hour = Math.floor(hourOf(col));
    veilHourly(col, rng, hour, hour >= 18 || hour < 6);
    if (hour === 8) maybeConvene(col, rng);
    if (hour === 1) maybeLeadAway(col, rng);
  });

  const season = seasonNow(col);
  const fruiting = season !== 'winter';
  if (fruiting) for (const b of col.world.bushes) if (b.berries === 0 && col.minute >= b.regrowAt) b.berries = b.max;
}

function daily(col: Colony) {
  const c = col.community;
  const r = c.resources;
  const day = dayOf(col);           // the new day that is starting
  const season = seasonOf(day);
  const lastSeason = seasonOf(day - 1);
  const winter = seasonOf(day - 1) === 'winter'; // the night just passed
  // Firewood: the fire, and heating for occupied buildings in the cold.
  const burn = fireWood(col, lastSeason);
  const cold = r.wood < burn;
  r.wood = Math.max(0, r.wood - burn);
  if (cold) {
    log(c, winter ? 'The woodpile ran out. It was a bitter night indoors.' : 'The fire burned low overnight. Nobody slept well.', 'bad');
    const warm = 1 - 0.5 * clothed(col);
    for (const s of alive(c)) {
      s.morale = Math.max(0, s.morale - (winter ? 8 : 4) * warm);
      if (winter) s.hp -= warm;
    }
  }
  if (winter) {
    // Anyone sleeping outdoors in winter suffers, firewood or not.
    const outside = col.agents.filter((a) => !col.beds.has(a.id));
    for (const a of outside) {
      const s = survivorOf(col, a.id);
      s.morale = Math.max(0, s.morale - 6);
      s.hp -= 1.5 * (1 - 0.4 * clothed(col));
    }
    if (outside.length) log(c, `${outside.length === 1 ? first(survivorOf(col, outside[0].id)) : `${outside.length} people`} slept out in the snow by the fire.`, 'bad');
  }
  for (const s of alive(c)) if (s.hp <= 0) killSurvivor(c, s.id, 'the cold');
  // Gardens that were tended yesterday yield food (not in winter).
  for (const g of col.village.buildings) {
    // A glass dome bears in every season, snow or not.
    if (g.kind === 'dome') {
      if (g.tended >= 60) { gainFood(col, 'domes', 3 * (lastSeason === 'winter' ? 0.8 : 1)); g.growth = Math.min(1, g.growth + 0.15); }
      else g.growth = Math.max(0.2, g.growth - 0.1);
      g.tended = 0;
      continue;
    }
    if (g.kind !== 'garden') continue;
    if (g.tended >= 60 && (lastSeason === 'summer' || lastSeason === 'autumn')) {
      gainFood(col, 'gardens', GARDEN_YIELD[g.tier]);
      g.growth = Math.min(1, g.growth + 0.15);
    } else g.growth = Math.max(0.1, g.growth - 0.1);
    g.tended = 0;
  }
  // Surplus food beyond what the stores can keep slowly spoils (slower in the cold).
  const cap = storageCapacity(col.village);
  if (r.food > cap) gainFood(col, 'spoiled', -(r.food - cap) * (lastSeason === 'winter' ? 0.03 : 0.25));
  dailyFields(col, lastSeason, season);
  dailyTrees(col, lastSeason);
  dailyWear(col);
  col.weather = weatherOn(day, col.world.seed);
  if (season !== lastSeason) {
    const lines: Record<Season, string> = {
      spring: 'The snow is going. Green is coming back up through the cracks.',
      summer: 'Summer. Long evenings, and the fields are filling out.',
      autumn: 'The first cold mornings. Time to bring everything in before the frost.',
      winter: 'Winter. The first snow fell overnight, and the land has gone quiet.',
    };
    log(c, `${SEASON_NAMES[season]}. ${lines[season]}`, 'good');
    if (season === 'winter') for (const b of col.world.bushes) b.berries = 0;
  }
  // (Half rations the council chose are announced when chosen, not as a shortage.)
  if (rationing(col) && !committed(col, 'ration') && !col.hints.has(`ration${dayOf(col) - (dayOf(col) - 1) % DAYS_PER_YEAR}`)) {
    col.hints.add(`ration${dayOf(col) - (dayOf(col) - 1) % DAYS_PER_YEAR}`);
    log(c, 'The cellar is running low. Meals are cut to half rations until spring.', 'bad');
  }
  veilDaily(col, { cold, rationing: rationing(col) });
  folkDaily(col);
  if (col.folk.led && c.day >= col.folk.led.until) endLed(col, null);
  hauntDaily(col);
  fishingDaily(col, (x, z, amt) => disturb(col, x, z, amt, 2));
  councilDaily(col);
  chronicleDaily(col);
  abandonStalled(col);
  autopilotDaily(col);
  tradesDaily(col);
  rareDaily(col);
  col.village.needTier = needTier(col);
  departures(col);
  dailyRollover(c);
  householdsDaily(col);
  dailyYards(col, lastSeason);
  syncAgents(col, true);
  knowhowDaily(col);
  aspirationsDaily(col);
  requestsDaily(col);
  syncHedges(col);
  col.unreachable.clear();
  arrivals(col);
  rebalanceWork(col);
  replan(col);
  log(c, `Day ${c.day}. Morale ${Math.round(communityMorale(c))}, food ${Math.floor(r.food)}, wood ${Math.floor(r.wood)}.`, 'info');
}

function dailyFields(col: Colony, lastSeason: Season, season: Season) {
  const w = col.world;
  const rain = col.weather === 'rain' ? 1.2 : 1;
  let lost = 0;
  for (const i of fieldTiles(col)) {
    const st = w.cropState[i];
    if (st !== Crop.Growing && st !== Crop.Ripe) continue;
    if (season === 'winter' && lastSeason !== 'winter') {
      // Frost takes whatever was left in the ground.
      w.cropState[i] = Crop.Untilled;
      w.cropGrowth[i] = 0;
      lost++;
      continue;
    }
    if (st === Crop.Growing && lastSeason !== 'winter') {
      const care = col.tended.has(i) ? 1.2 : 0.75;
      const land = landFactor(col, tileX(w, i % w.w), tileZ(w, (i / w.w) | 0));
      w.cropGrowth[i] = Math.min(1, w.cropGrowth[i] + (SEASON_SCALE / 20) * fertility(w, i) * care * rain * land);
      if (w.cropGrowth[i] >= 1) w.cropState[i] = Crop.Ripe;
    }
  }
  if (lost > 0) log(col.community, `Frost took ${lost} rows of crops that were never brought in.`, 'bad');
  col.tended.clear();
  w.cropVersion++;
}

/**
 * A site that has made no progress for two seasons although its materials
 * are in the stores is one nobody can get to or finish: it's given up, and
 * what was delivered goes back to the stores. (A site waiting on something
 * nobody has, like glass, waits: it no longer holds up the others.)
 */
function abandonStalled(col: Colony) {
  const day = col.community.day, v = col.village, r = col.community.resources;
  for (const p of [...v.projects]) {
    if (p.done) continue;
    const key = p.work + MATERIALS.reduce((n, m) => n + p.delivered[m], 0) + p.clearTrees.filter((id) => col.world.trees[id].felled).length;
    if (p.progressKey !== key || p.progressDay === undefined) { p.progressKey = key; p.progressDay = day; continue; }
    if (day - p.progressDay < DAYS_PER_SEASON * 2) continue;
    if (MATERIALS.some((m) => outstanding(p, m) > 0 && r[m] < 1)) continue;
    for (const m of MATERIALS) r[m] += p.delivered[m];
    v.projects = v.projects.filter((x) => x !== p);
    if (p.kind === 'home') {
      const plot = v.plots.find((x) => x.id === p.plot);
      if (plot) plot.household = 0;
    }
    if (v.priority === p.kind) v.priority = undefined;
    log(col.community, `${p.name} was given up: two seasons without progress. What was brought for it went back to the stores.`, 'bad');
  }
}

/** Yards: vegetable beds, fruit trees and hens feed the village a little. */
function dailyYards(col: Colony, lastSeason: Season) {
  // The glasshouse's old beds still bear, once it's cleared.
  if (col.village.site.kind === 'glasshouse' && store(col.village).level >= 1 && lastSeason !== 'winter') gainFood(col, 'site', 1.5);
  for (const plot of col.village.plots) {
    if (!plot.household) continue;
    for (const y of plot.yard) {
      if (y.progress < 1) continue;
      if (y.kind === 'beds') {
        const tended = y.tended >= 45;
        if (tended && (lastSeason === 'summer' || lastSeason === 'autumn')) gainFood(col, 'yards', 1.5 * landFactor(col, plot.hc.x, plot.hc.z));
        y.growth = lastSeason === 'winter' ? 0 : Math.max(0.1, Math.min(1, y.growth + (tended ? 0.12 : -0.08)));
        y.tended = 0;
      } else if (y.kind === 'fruit' && lastSeason !== 'winter') {
        y.growth = Math.min(1, y.growth + SEASON_SCALE / 30);
        if (y.growth >= 1 && lastSeason === 'autumn') gainFood(col, 'yards', 2);
      } else if (y.kind === 'coop') {
        gainFood(col, 'yards', lastSeason === 'winter' ? 0.3 : 0.8);
      }
    }
  }
}

function dailyTrees(col: Colony, lastSeason: Season) {
  if (lastSeason === 'winter') return;
  for (const t of col.world.trees) if (t.planted && !t.felled && t.growth < 1) t.growth = Math.min(1, t.growth + SEASON_SCALE / 24);
}

function dailyWear(col: Colony) {
  // Paths people have used a while are remembered (the memory fades over a year or so),
  // and kept trodden and cleared through the seasons; the rest slowly grow back over.
  const w = col.world, wear = w.wear;
  const mem = (w.pathMemory && w.pathMemory.length === wear.length) ? w.pathMemory : (w.pathMemory = new Float32Array(wear.length));
  for (let i = 0; i < wear.length; i++) {
    if (wear[i] <= 0 && mem[i] <= 0) continue;
    mem[i] = Math.max(mem[i] * 0.985, Math.min(1, wear[i] / LANE_WEAR));
    const kept = mem[i] >= 0.3 ? mem[i] * LANE_WEAR * 0.85 : 0;
    const next = wear[i] < 0.5 ? 0 : wear[i] * 0.93;
    wear[i] = Math.max(next, kept);
    if (mem[i] < 0.01) mem[i] = 0;
  }
  w.wearVersion++;
}

/** People who stay miserable for days eventually leave. */
function departures(col: Colony) {
  const c = col.community;
  for (const s of alive(c)) {
    const n = s.morale < 20 ? (col.lowDays.get(s.id) ?? 0) + 1 : 0;
    col.lowDays.set(s.id, n);
    if (n < 3 || alive(c).length <= 2) continue;
    s.alive = false;
    s.departed = true;
    log(c, `${s.name} packed a bag in the night and walked out along the highway. Nobody stopped them.`, 'bad');
    for (const o of alive(c)) if (bondValue(c, s.id, o.id) >= 20) o.morale = Math.max(0, o.morale - 5);
    break; // one departure per day at most
  }
}

/** Newcomers find their way in when there is room and the mood is good. */
function arrivals(col: Colony) {
  const c = col.community;
  const pop = alive(c).length;
  if (pop === 0 || pop >= MAX_POP || communityMorale(c) < 50) return;
  // Nobody travels in winter, and nobody stays where there's no food.
  if (seasonNow(col) === 'winter' || c.resources.food < pop * 6 || col.council.gates === 'closed') return;
  const building = activeProjects(col).some((p) => p.kind === 'hut' || p.kind === 'annex' || p.kind === 'patch_roof');
  if (bedsTotal(col.village) < pop && !building) return;
  withRng(c, (rng) => {
    // Word gets around: a settled, thriving village draws more people.
    const draw = [0.6, 1, 1.4, 1.8][col.village.needTier ?? 1];
    if (!rng.chance((col.council.gates === 'open' ? 0.4 : 0.18) * draw)) return;
    // Sometimes a group comes, and the council must decide (dilemmas.ts).
    if (pop >= 6 && pop <= MAX_POP - 3 && !col.council.active && !col.council.strangers && rng.chance(0.5)) {
      col.council.strangers = { n: rng.chance(0.4) ? 3 : 2 };
      return;
    }
    welcome(col, 1);
  });
}

/** Newcomers walk in off the highway and take up whatever work is short-handed. */
export function welcome(col: Colony, n: number) {
  const c = col.community;
  for (let k = 0; k < n && alive(c).length < MAX_POP; k++) {
    const s = recruit(c);
    s.role = neededRole(col);
    syncAgents(col);
    const a = col.agents.find((x) => x.id === s.id);
    if (a) {
      const side = (s.id % 2) ? 1 : -1;
      a.x = side * 22; a.z = highwayZ(side * 22);
    }
  }
}

/** Food in store (and in jars) per head. */
const foodPerHead = (col: Colony) => {
  const r = col.community.resources;
  return (r.food + r.preserves) / Math.max(1, alive(col.community).length);
};

/**
 * Work follows need (DESIGN §22.8): with the cellars still full after winter,
 * a farmer leaves the fields to build; with stores running low and fields untended, a
 * builder goes back to them. Every few days, one person at most, and never
 * someone whose work the player chose this season.
 */
function rebalanceWork(col: Colony) {
  const c = col.community;
  if (c.day % 4 !== 0) return;
  const living = alive(c);
  const free = living.filter((s) => s.roleSetDay === undefined || c.day - s.roleSetDay >= DAYS_PER_SEASON);
  const count = (r: RoleId) => living.filter((s) => s.role === r).length;
  const perHead = foodPerHead(col);
  const knack = (s: Survivor) => (s.traits.includes('green_thumb') ? 2 : 0) + s.stats.grit / 10 - (s.id % 5) / 10;
  // Judge the surplus in spring, once winter has eaten into it (a summer store is
  // always high just before it's needed), or any time it is far beyond use.
  const season = seasonOf(c.day);
  const surplus = c.day > DAYS_PER_YEAR && ((season === 'spring' && perHead > STORE_PER_HEAD * 1.4) || perHead > STORE_PER_HEAD * 2.4);
  if (surplus && count('farmer') > 2) {
    const s = free.filter((x) => x.role === 'farmer').sort((a, b) => knack(a) - knack(b))[0];
    if (!s) return;
    s.role = 'builder';
    log(c, `${s.name.split(' ')[0]} left the fields: the cellars are full, and there's building to do.`, 'info');
  } else if (perHead < 8 && seasonOf(c.day) !== 'winter' && fieldTiles(col).length > 20 * Math.max(1, count('farmer')) && count('builder') > 2) {
    const s = free.filter((x) => x.role === 'builder').sort((a, b) => knack(b) - knack(a))[0];
    if (!s) return;
    s.role = 'farmer';
    log(c, `${s.name.split(' ')[0]} went back to the fields: the stores are getting low.`, 'info');
  }
}

/** Newcomers take up whatever work is most short-handed. */
function neededRole(col: Colony): RoleId {
  const count = (r: RoleId) => alive(col.community).filter((s) => s.role === r).length;
  if (fieldTiles(col).length > 20 * Math.max(1, count('farmer')) && foodPerHead(col) < STORE_PER_HEAD) return 'farmer';
  const huts = col.village.fisheries.filter((f) => hasBuilding(col, f.hut)).length;
  if (huts > 0 && count('fisher') < huts) return 'fisher';
  // Standalone benches (from before backyard trades) want makers; a household's trade is staffed by its household.
  const benches = col.village.buildings.filter((b) => b.kind in TRADES && !b.household).length;
  if (benches > 0 && count('maker') < Math.min(3, Math.ceil(benches / 2))) return 'maker';
  // About one in four builds, so a growing village can keep building.
  if (count('builder') < Math.max(2, Math.round(alive(col.community).length / 4))) return 'builder';
  if (count('forager') < 1) return 'forager';
  if (count('farmer') < 1) return 'farmer';
  if (count('scout') < 1) return 'scout';
  return count('builder') <= count('farmer') ? 'builder' : 'farmer';
}

// ---------- main tick ----------
export function tick(col: Colony, dtMinutes: number) {
  // While a team is in the Veil, no time passes at home.
  if (col.clearing) return;
  let remaining = dtMinutes;
  while (remaining > 0) {
    const dt = Math.min(remaining, 0.5);
    remaining -= dt;
    const before = col.minute;
    col.minute += dt;
    syncAgents(col, col.village.bedsDirty);
    col.village.bedsDirty = false;

    for (const a of col.agents) {
      const s = survivorOf(col, a.id);
      a.needs.food = Math.max(0, a.needs.food - dt * (4.2 / 60));
      if (a.task?.kind !== 'sleep' || a.task.stage !== 'sleep') a.needs.rest = Math.max(0, a.needs.rest - dt * (5 / 60));
      a.needs.social = Math.max(0, a.needs.social - dt * (2.5 / 60));

      if (shouldInterrupt(col, a)) endTask(col, a);
      if (!a.task) a.task = chooseTask(col, a, s);
      if (a.task) runTask(col, a, s, dt);
      else { a.anim = 'idle'; a.activity = 'Thinking'; }
    }

    folkTick(col, dt);
    if (Math.floor(col.minute / 60) !== Math.floor(before / 60)) hourly(col);
    if (Math.floor(col.minute / MIN_PER_DAY) !== Math.floor(before / MIN_PER_DAY)) daily(col);
  }
}
