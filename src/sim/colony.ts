/**
 * The living colony: survivors as agents on the world grid who choose their
 * own tasks from their role, their needs, and the time of day.
 *
 * Time unit: game minutes. The renderer advances the colony with tick().
 */
import {
  alive, adjustBond, bondValue, communityMorale, dailyRollover, killSurvivor, log, remember,
  traitSum, withRng, TUNING, type Community, type Survivor,
} from './community';
import type { RoleId } from './data';
import { bedSpot, seatSpot } from './layout';
import { findPath } from './path';
import {
  findNearest, idx, isExplored, passable, reveal, tileX, tileZ, toTileX, toTileZ,
  type Point, type World,
} from './world';

export const MIN_PER_DAY = 1440;
export const WALK_SPEED = 0.9;      // tiles per game minute
export const WOOD_TARGET = 60;      // builders stop felling once the pile reaches this
export const FIRE_WOOD_PER_DAY = 4;
export const START_MINUTE = 7 * 60; // day 1, 07:00

export type Anim = 'idle' | 'walk' | 'chop' | 'carry' | 'forage' | 'sleep' | 'sit' | 'eat' | 'look';
export type ItemKind = 'wood' | 'food';

export interface Needs { food: number; rest: number; social: number } // 0..100, 100 = satisfied

export type Task =
  | { kind: 'chop'; tree: number; stage: 'go' | 'work' }
  | { kind: 'haul'; item: number; stage: 'go' | 'deliver' }
  | { kind: 'forage'; bush: number; stage: 'go' | 'work' | 'deliver'; t: number }
  | { kind: 'eat'; stage: 'go' | 'eat'; t: number }
  | { kind: 'sleep'; stage: 'go' | 'sleep' }
  | { kind: 'social'; stage: 'go' | 'sit' }
  | { kind: 'scout'; stage: 'go' | 'look'; t: number }
  | { kind: 'attune'; stage: 'go' | 'sit'; t: number }
  | { kind: 'tend'; stage: 'go' | 'sit'; t: number }
  | { kind: 'wander'; stage: 'go' | 'pause'; t: number };

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
}

export interface Item { id: number; kind: ItemKind; amount: number; x: number; z: number; reserved: number }

export type ColonyEvent =
  | { type: 'felled'; tree: number; dirX: number; dirZ: number }
  | { type: 'discovered'; poi: number };

export interface Colony {
  world: World;
  community: Community;
  minute: number;
  agents: Agent[];
  items: Item[];
  nextItemId: number;
  events: ColonyEvent[];
  unreachable: Set<string>;
}

// ---------- time ----------
export const hourOf = (col: Colony) => (col.minute % MIN_PER_DAY) / 60;
export const dayOf = (col: Colony) => Math.floor(col.minute / MIN_PER_DAY) + 1;
const isNight = (h: number) => h >= 22 || h < 6;
const isEvening = (h: number) => h >= 19 && h < 22;

// ---------- setup ----------
export function createColony(world: World, community: Community): Colony {
  const col: Colony = {
    world, community, minute: START_MINUTE, agents: [], items: [], nextItemId: 1, events: [], unreachable: new Set(),
  };
  syncAgents(col);
  return col;
}

function makeAgent(col: Colony, s: Survivor, i: number): Agent {
  const living = alive(col.community).length;
  const seat = seatSpot(i, Math.max(living, 1));
  return {
    id: s.id, x: seat.x, z: seat.z, facing: 0, path: [], pathI: 0, task: null,
    needs: { food: 70 + (s.id * 7) % 25, rest: 80, social: 60 },
    carry: null, anim: 'idle', activity: 'Waking up', lastTile: -1, lookAt: null,
  };
}

/** Add agents for new survivors; drop agents (and their claims) for the dead. */
export function syncAgents(col: Colony) {
  const living = alive(col.community);
  const ids = new Set(living.map((s) => s.id));
  for (const a of col.agents) if (!ids.has(a.id)) releaseClaims(col, a.id);
  col.agents = col.agents.filter((a) => ids.has(a.id));
  living.forEach((s, i) => {
    if (!col.agents.some((a) => a.id === s.id)) col.agents.push(makeAgent(col, s, i));
  });
}

function releaseClaims(col: Colony, id: number) {
  for (const t of col.world.trees) if (t.reserved === id) t.reserved = 0;
  for (const b of col.world.bushes) if (b.reserved === id) b.reserved = 0;
  for (const it of col.items) if (it.reserved === id) it.reserved = 0;
}

const survivorOf = (col: Colony, id: number) => col.community.survivors.find((s) => s.id === id)!;
const first = (s: Survivor) => s.name.split(' ')[0];

function workRate(s: Survivor, role: RoleId) {
  return traitSum(s, (t) => t.roleBonus?.[role], 1, 'add') * (0.7 + s.morale / 200);
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
  const sx = toTileX(w, a.x), sz = toTileZ(w, a.z);
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
    const s = survivorOf(col, a.id);
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
    const what = p.kind === 'ruin' ? 'roofless houses swallowed by ivy' : p.kind === 'pond' ? 'a still pond full of sky' : 'something';
    log(col.community, `${first(s)} found ${p.name}: ${what}.`, 'good');
    remember(s, col.community.day, `Found ${p.name}.`);
    col.events.push({ type: 'discovered', poi: p.id });
  }
}

// ---------- choosing work ----------
function groundWood(col: Colony) {
  return col.items.reduce((sum, it) => sum + (it.kind === 'wood' ? it.amount : 0), 0);
}

function pickTree(col: Colony, a: Agent): Task | null {
  const c = col.community.resources;
  if (c.wood + groundWood(col) >= WOOD_TARGET) return null;
  const w = col.world;
  const home = { tx: toTileX(w, w.home.x), tz: toTileZ(w, w.home.z) };
  const found = findNearest(w, home.tx, home.tz, 45, (tx, tz) => {
    const id = w.treeAt[idx(w, tx, tz)];
    if (id < 0) return false;
    const t = w.trees[id];
    return !t.felled && !t.protected && t.reserved === 0 && isExplored(w, tx, tz) && !col.unreachable.has(`t${id}`);
  });
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
  const found = findNearest(w, toTileX(w, a.x), toTileZ(w, a.z), 40, (tx, tz) => {
    const id = w.bushAt[idx(w, tx, tz)];
    if (id < 0) return false;
    const b = w.bushes[id];
    return b.berries > 0 && b.reserved === 0 && isExplored(w, tx, tz) && !col.unreachable.has(`b${id}`);
  });
  if (!found) return null;
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
  return withRng(col.community, (rng) => {
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

function seatOf(col: Colony, a: Agent): Point {
  const living = col.agents;
  return seatSpot(living.indexOf(a), living.length);
}

function chooseTask(col: Colony, a: Agent, s: Survivor): Task | null {
  const h = hourOf(col);
  const res = col.community.resources;
  if (a.needs.rest < 12 || isNight(h) || s.hp < s.maxHp * 0.25) {
    const bed = bedSpot(s.id);
    if (setDest(col, a, bed.x, bed.z)) return { kind: 'sleep', stage: 'go' };
  }
  if (a.needs.food < 38 && res.food >= 1) {
    const seat = seatOf(col, a);
    if (setDest(col, a, seat.x, seat.z)) return { kind: 'eat', stage: 'go', t: 0 };
  }
  if (isEvening(h)) {
    const seat = seatOf(col, a);
    if (setDest(col, a, seat.x, seat.z)) return { kind: 'social', stage: 'go' };
  }
  let t: Task | null = null;
  switch (s.role) {
    case 'builder': t = pickHaul(col, a) ?? pickTree(col, a); break;
    case 'forager': t = pickForage(col, a) ?? pickHaul(col, a); break;
    case 'scout': t = pickScout(col, a); break;
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
  return t ?? pickWander(col, a);
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
  releaseClaims(col, a.id);
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
      tree.chop += dt * workRate(s, 'builder');
      const need = 20 + tree.size * 25;
      a.activity = `Felling a ${tree.kind} · ${Math.min(99, Math.round((tree.chop / need) * 100))}%`;
      if (tree.chop >= need) {
        tree.felled = true;
        w.treeAt[idx(w, tree.tx, tree.tz)] = -1;
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
          const amount = Math.max(1, Math.round(bush.berries * 0.5 * (1 + (workRate(s, 'forager') - 1) * 0.5)));
          bush.berries = 0;
          bush.regrowAt = col.minute + 4 * MIN_PER_DAY;
          bush.reserved = 0;
          a.carry = { kind: 'food', amount };
          if (!deliver(col, a)) { res.food += amount; a.carry = null; return endTask(col, a); }
          t.stage = 'deliver';
        }
        return;
      }
      a.anim = 'carry'; a.activity = 'Bringing berries home';
      if (walk(col, a, dt)) {
        if (a.carry) res.food += a.carry.amount;
        a.carry = null;
        endTask(col, a);
      }
      return;
    }
    case 'eat': {
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = 'Going to eat';
        if (walk(col, a, dt)) {
          if (res.food < 1) return endTask(col, a);
          res.food -= 1;
          t.stage = 'eat';
        }
        return;
      }
      face(a, w.campfire);
      a.anim = 'eat'; a.activity = 'Eating by the fire';
      t.t += dt;
      a.needs.food = Math.min(100, a.needs.food + dt * 2.8);
      if (t.t >= 20) endTask(col, a);
      return;
    }
    case 'sleep': {
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = 'Turning in';
        if (walk(col, a, dt)) t.stage = 'sleep';
        return;
      }
      a.anim = 'sleep'; a.activity = 'Asleep';
      a.needs.rest = Math.min(100, a.needs.rest + dt * (13 / 60));
      const h = hourOf(col);
      if ((!isNight(h) && a.needs.rest >= 85) || a.needs.food < 8) endTask(col, a);
      return;
    }
    case 'social': {
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = 'Heading to the fire';
        if (walk(col, a, dt)) t.stage = 'sit';
        return;
      }
      face(a, w.campfire);
      a.anim = 'sit'; a.activity = 'Talking by the fire';
      a.needs.social = Math.min(100, a.needs.social + dt * (25 / 60));
      if (!isEvening(hourOf(col))) endTask(col, a);
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
    case 'attune': {
      if (t.stage === 'go') {
        a.anim = 'walk'; a.activity = 'Walking to the Ring';
        if (walk(col, a, dt)) t.stage = 'sit';
        return;
      }
      face(a, w.fairyRing);
      a.anim = 'sit'; a.activity = 'Sitting with the wisps';
      t.t += dt;
      res.glimmer += dt * 0.004 * workRate(s, 'attune') * (1 + s.stats.attunement * 0.2);
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
  if (isNight(h)) return t.kind !== 'sleep';
  if (isEvening(h)) return !['social', 'eat', 'sleep'].includes(t.kind);
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
  withRng(c, (rng) => {
    for (const s of living) {
      const a = col.agents.find((x) => x.id === s.id);
      if (!a) continue;
      if (a.needs.food <= 0) {
        s.hp -= 1;
        if (s.hp <= 0) { killSurvivor(c, s.id, 'hunger'); continue; }
      } else if (a.needs.food > 30 && a.needs.rest > 30) {
        s.hp = Math.min(s.maxHp, s.hp + 0.25);
      }
      const needs = (a.needs.food + a.needs.rest + a.needs.social) / 3;
      let friends = 0;
      for (const o of living) if (o !== s && bondValue(c, s.id, o.id) >= 20) friends += 0.6;
      const target = TUNING.moraleBaseline + traitSum(s, (t) => t.moraleBaseline, 0, 'add')
        + (needs - 55) * 0.3 + Math.min(friends, 6) - (s.griefDays > 0 ? 15 : 0);
      s.morale = Math.max(0, Math.min(100, s.morale + (target - s.morale) * 0.06));
    }

    // Conversations around the fire.
    const sitting = col.agents.filter((a) => a.task?.kind === 'social' && a.task.stage === 'sit');
    if (sitting.length >= 2 && rng.chance(0.5)) {
      const [x, y] = rng.shuffle([...sitting]).slice(0, 2);
      const sa = survivorOf(col, x.id), sb = survivorOf(col, y.id);
      const bond = bondValue(c, sa.id, sb.id);
      const rate = traitSum(sa, (t) => t.bondRate, 1, 'mul') * traitSum(sb, (t) => t.bondRate, 1, 'mul');
      const good = bond > -30 || rng.chance(0.3);
      adjustBond(c, sa.id, sb.id, (good ? 3 : -2) * rate);
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
  });

  for (const b of col.world.bushes) if (b.berries === 0 && col.minute >= b.regrowAt) b.berries = b.max;
}

function daily(col: Colony) {
  const c = col.community;
  const r = c.resources;
  if (r.wood >= FIRE_WOOD_PER_DAY) r.wood -= FIRE_WOOD_PER_DAY;
  else {
    r.wood = 0;
    log(c, 'The fire burned low overnight. Nobody slept well.', 'bad');
    for (const s of alive(c)) s.morale = Math.max(0, s.morale - 4);
  }
  dailyRollover(c);
  col.unreachable.clear();
  log(c, `Day ${c.day}. Morale ${Math.round(communityMorale(c))}, food ${Math.floor(r.food)}, wood ${Math.floor(r.wood)}.`, 'info');
}

// ---------- main tick ----------
export function tick(col: Colony, dtMinutes: number) {
  let remaining = dtMinutes;
  while (remaining > 0) {
    const dt = Math.min(remaining, 0.5);
    remaining -= dt;
    const before = col.minute;
    col.minute += dt;
    syncAgents(col);

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

    if (Math.floor(col.minute / 60) !== Math.floor(before / 60)) hourly(col);
    if (Math.floor(col.minute / MIN_PER_DAY) !== Math.floor(before / MIN_PER_DAY)) daily(col);
  }
}
