import { Rng } from './rng';
import { fbm, smoothstep } from './noise';
import {
  APRON, CAMP, CAR, HIGHWAY_Z, STATION_BLOCKERS, STOCKPILE,
} from './layout';
import {
  Ground, idx, inBounds, reveal, tileX, tileZ, toTileX, toTileZ,
  type Bush, type Rect, type Tree, type TreeKind, type World,
} from './world';

export const MAP_SIZE = 256;
const HOME_CLEAR = 15; // no wild trees this close to the station; sparse beyond

/** The highway: straight past the station, meandering further out. */
export function highwayZ(x: number): number {
  return HIGHWAY_Z + smoothstep(28, 70, Math.abs(x)) * Math.sin(x * 0.028) * 14;
}

const RUIN_NAMES = ['Pell Street', 'the Motor Court', 'Harrow Farm', 'the Relay Station', 'Old Ashby', 'the Clinic Row'];

export function generateWorld(seed: number, size = MAP_SIZE): World {
  const rng = new Rng(seed ^ 0x5eed);
  const n = size * size;
  const w: World = {
    seed, w: size, h: size,
    ground: new Uint8Array(n),
    blocked: new Uint8Array(n),
    heights: new Float32Array((size + 1) * (size + 1)),
    explored: new Uint8Array(n),
    fogVersion: 0,
    trees: [], treeAt: new Int32Array(n).fill(-1),
    bushes: [], bushAt: new Int32Array(n).fill(-1),
    rocks: [], heaps: [], walls: [], pois: [],
    zone: new Uint8Array(n), zoneVersion: 0,
    home: { x: 0, z: 0 },
    campfire: { ...CAMP },
    stockpile: { ...STOCKPILE },
    fairyRing: { x: 0, z: 0 },
  };

  const inRect = (x: number, z: number, r: Rect, pad = 0) =>
    x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

  // --- base biomes ---
  for (let tz = 0; tz < size; tz++) {
    for (let tx = 0; tx < size; tx++) {
      const x = tileX(w, tx), z = tileZ(w, tz);
      const forest = fbm(x * 0.028, z * 0.028, seed + 11);
      const meadow = fbm(x * 0.05, z * 0.05, seed + 23);
      const wet = fbm(x * 0.022, z * 0.022, seed + 37);
      const dHome = Math.hypot(x, z);
      let g: number = Ground.Grass;
      if (meadow > 0.6) g = Ground.Meadow;
      if (forest > 0.53 && dHome > HOME_CLEAR + 4) g = Ground.Forest;
      if (wet < 0.3 && dHome > 34) g = Ground.Water;
      w.ground[idx(w, tx, tz)] = g;
    }
  }

  // --- roads ---
  const paveDisc = (x: number, z: number, r: number) => {
    const cx = toTileX(w, x), cz = toTileZ(w, z), R = Math.ceil(r);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const tx = cx + dx, tz = cz + dz;
      if (!inBounds(w, tx, tz)) continue;
      if (Math.hypot(tileX(w, tx) - x, tileZ(w, tz) - z) <= r) w.ground[idx(w, tx, tz)] = Ground.Asphalt;
    }
  };
  for (let x = -size / 2; x < size / 2; x += 0.5) paveDisc(x, highwayZ(x), 3.1);

  const drawRoad = (pts: [number, number][], width: number) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      for (let s = 0; s <= len; s += 0.5) {
        const t = s / len;
        paveDisc(ax + (bx - ax) * t, az + (bz - az) * t, width);
      }
    }
  };

  // Ruin sites: one along each branch road, one out on the highway.
  const sites: { x: number; z: number }[] = [];
  const north = { x: -30 + rng.range(-10, 10), z: -78 + rng.range(-12, 8) };
  const south = { x: 44 + rng.range(-10, 10), z: 76 + rng.range(-8, 10) };
  const east = { x: 96, z: highwayZ(96) - 14 };
  const west = { x: -92, z: highwayZ(-92) + 16 };
  sites.push(north, south, east, west);
  const hx = -26;
  drawRoad([[hx, highwayZ(hx)], [hx - 6, -20], [north.x + 8, -50], [north.x, north.z + 8]], 1.8);
  const sx = 38;
  drawRoad([[sx, highwayZ(sx)], [sx + 4, 40], [south.x, south.z - 8]], 1.8);

  // --- station apron ---
  for (let tz = 0; tz < size; tz++) for (let tx = 0; tx < size; tx++) {
    const x = tileX(w, tx), z = tileZ(w, tz);
    const i = idx(w, tx, tz);
    if (inRect(x, z, APRON)) w.ground[i] = Ground.Asphalt;
    for (const b of STATION_BLOCKERS) if (inRect(x, z, b, 0.4)) w.blocked[i] = 1;
    // Keep water well away from roads.
    if (w.ground[i] === Ground.Water) {
      const near = [[-2, 0], [2, 0], [0, -2], [0, 2]].some(([dx, dz]) =>
        inBounds(w, tx + dx, tz + dz) && w.ground[idx(w, tx + dx, tz + dz)] === Ground.Asphalt);
      if (near) w.ground[i] = Ground.Grass;
    }
  }

  // --- ruins ---
  let poiId = 1;
  sites.forEach((site, si) => {
    const houses = rng.int(3, 6);
    for (let hIdx = 0; hIdx < houses; hIdx++) {
      const bw = rng.int(5, 9), bd = rng.int(4, 7);
      const ox = Math.round(site.x + rng.range(-14, 14)), oz = Math.round(site.z + rng.range(-12, 12));
      const tx0 = toTileX(w, ox), tz0 = toTileZ(w, oz);
      for (let dz = 0; dz < bd; dz++) for (let dx = 0; dx < bw; dx++) {
        const tx = tx0 + dx, tz = tz0 + dz;
        if (!inBounds(w, tx, tz)) continue;
        const i = idx(w, tx, tz);
        w.ground[i] = Ground.Concrete;
        const edge = dx === 0 || dz === 0 || dx === bw - 1 || dz === bd - 1;
        const door = (dz === bd - 1 && dx === Math.floor(bw / 2)) || (dx === 0 && dz === Math.floor(bd / 2));
        if (edge && !door && rng.chance(0.72)) {
          w.blocked[i] = 1;
          w.walls.push({ tx, tz, h: rng.range(0.6, 3.0) });
        }
      }
    }
    w.pois.push({ id: poiId++, kind: 'ruin', tx: toTileX(w, site.x), tz: toTileZ(w, site.z), name: RUIN_NAMES[si % RUIN_NAMES.length], discovered: false });
  });

  // --- fairy ring: a clearing within sight of home ---
  const ringA = rng.range(3.4, 4.2); // roughly north-west
  w.fairyRing = { x: Math.round(Math.cos(ringA) * 19), z: Math.round(Math.sin(ringA) * 19) };
  w.pois.push({ id: poiId++, kind: 'ring', tx: toTileX(w, w.fairyRing.x), tz: toTileZ(w, w.fairyRing.z), name: 'the Ring', discovered: true });

  // --- heights (at tile corners) ---
  // Distance (in tiles) to the nearest paved/built tile, so roads and ruins sit flat.
  const flatDist = new Float32Array(n).fill(99);
  const queue: number[] = [];
  for (let i = 0; i < n; i++) {
    const g = w.ground[i];
    if (g === Ground.Asphalt || g === Ground.Concrete) { flatDist[i] = 0; queue.push(i); }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const d = flatDist[i];
    if (d >= 8) continue;
    const tx = i % size, tz = (i / size) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x2 = tx + dx, z2 = tz + dz;
      if (!inBounds(w, x2, z2)) continue;
      const j = idx(w, x2, z2);
      if (flatDist[j] > d + 1) { flatDist[j] = d + 1; queue.push(j); }
    }
  }
  const S = size + 1;
  for (let vz = 0; vz <= size; vz++) for (let vx = 0; vx <= size; vx++) {
    const x = vx - size / 2, z = vz - size / 2;
    let d = 99, wet = false;
    for (const [dx, dz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
      const tx = vx + dx, tz = vz + dz;
      if (!inBounds(w, tx, tz)) continue;
      const i = idx(w, tx, tz);
      d = Math.min(d, flatDist[i]);
      if (w.ground[i] === Ground.Water) wet = true;
    }
    const hills = Math.max(0, fbm(x * 0.03 + 7, z * 0.03 - 3, seed + 51, 4) - 0.38) * 11;
    const homeFlat = smoothstep(14, 26, Math.hypot(x, z));
    let hgt = hills * smoothstep(1, 7, d) * homeFlat;
    if (wet) hgt = -0.9;
    w.heights[vz * S + vx] = hgt;
  }

  // --- trees ---
  const kindAt = (x: number, z: number): TreeKind => {
    const k = fbm(x * 0.06, z * 0.06, seed + 71);
    return k > 0.62 ? 'pine' : k < 0.36 ? 'birch' : 'oak';
  };
  const addTree = (tx: number, tz: number, kind: TreeKind, size: number, prot = false) => {
    const t: Tree = { id: w.trees.length, tx, tz, kind, size, felled: false, chop: 0, reserved: 0, protected: prot };
    w.trees.push(t);
    w.treeAt[idx(w, tx, tz)] = t.id;
  };
  for (let tz = 0; tz < size; tz++) for (let tx = 0; tx < size; tx++) {
    const i = idx(w, tx, tz);
    const x = tileX(w, tx), z = tileZ(w, tz);
    if (w.blocked[i] || Math.hypot(x, z) < HOME_CLEAR) continue;
    if (Math.hypot(x - w.fairyRing.x, z - w.fairyRing.z) < 4.5) continue;
    const g = w.ground[i];
    const edge = smoothstep(HOME_CLEAR, HOME_CLEAR + 12, Math.hypot(x, z)); // thin near home
    const p = (g === Ground.Forest ? 0.42 : g === Ground.Grass ? 0.035 : g === Ground.Meadow ? 0.008 : 0) * (0.3 + 0.7 * edge);
    if (rng.chance(p)) addTree(tx, tz, kindAt(x, z), rng.range(0.75, 1.45));
  }
  // The old tree that grew up against the canopy. Nobody will cut it.
  addTree(toTileX(w, 10.5), toTileZ(w, 5.5), 'oak', 1.35, true);

  // --- berry bushes ---
  let bushId = 0;
  for (let tz = 0; tz < size; tz++) for (let tx = 0; tx < size; tx++) {
    const i = idx(w, tx, tz);
    if (w.blocked[i] || w.treeAt[i] >= 0) continue;
    const g = w.ground[i];
    if (g === Ground.Asphalt || g === Ground.Concrete || g === Ground.Water) continue;
    const d = Math.hypot(tileX(w, tx), tileZ(w, tz));
    const p = (d > 9 && d < 34 ? 0.022 : 0.006) * (g === Ground.Forest ? 0.6 : 1);
    if (rng.chance(p)) {
      const max = rng.int(3, 6);
      const b: Bush = { id: bushId++, tx, tz, berries: max, max, regrowAt: 0, reserved: 0 };
      w.bushes.push(b);
      w.bushAt[i] = b.id;
    }
  }

  // --- rocks ---
  for (let tz = 0; tz < size; tz++) for (let tx = 0; tx < size; tx++) {
    const i = idx(w, tx, tz);
    if (w.blocked[i] || w.treeAt[i] >= 0 || w.bushAt[i] >= 0) continue;
    const g = w.ground[i];
    if (g === Ground.Asphalt || g === Ground.Concrete || g === Ground.Water) continue;
    if (Math.hypot(tileX(w, tx), tileZ(w, tz)) < 14) continue;
    if (rng.chance(0.004)) {
      w.rocks.push({ tx, tz, size: rng.range(0.4, 1.2) });
      w.blocked[i] = 1;
    }
  }

  // Ponds big enough to name become points of interest.
  let pondPois = 0;
  for (let tries = 0; tries < 400 && pondPois < 3; tries++) {
    const tx = rng.int(20, size - 20), tz = rng.int(20, size - 20);
    if (w.ground[idx(w, tx, tz)] !== Ground.Water) continue;
    if (w.pois.some((p) => Math.hypot(p.tx - tx, p.tz - tz) < 40)) continue;
    w.pois.push({ id: poiId++, kind: 'pond', tx, tz, name: ['Still Water', 'the Mirror Pond', 'Heron Pool'][pondPois], discovered: false });
    pondPois++;
  }

  // --- salvage: wrecks along the highway, debris in the ruins, the station's own car ---
  const addHeap = (x: number, z: number, kind: 'car' | 'pile', scrap: number, rot: number) => {
    const tx = toTileX(w, x), tz = toTileZ(w, z);
    if (!inBounds(w, tx, tz)) return;
    const i = idx(w, tx, tz);
    if (w.blocked[i] && kind !== 'car') return;
    if (w.treeAt[i] >= 0) { w.trees[w.treeAt[i]].felled = true; w.treeAt[i] = -1; }
    w.heaps.push({ id: w.heaps.length, tx, tz, kind, scrap, max: scrap, rot, reserved: 0 });
    w.blocked[i] = 1;
    if (kind === 'car') {
      // A car is about three tiles long: block along its axis.
      for (const k of [-1.4, 1.4]) {
        const bx = toTileX(w, x + Math.cos(rot) * k), bz = toTileZ(w, z - Math.sin(rot) * k);
        if (inBounds(w, bx, bz)) {
          const j = idx(w, bx, bz);
          if (w.treeAt[j] >= 0) { w.trees[w.treeAt[j]].felled = true; w.treeAt[j] = -1; }
          w.blocked[j] = 1;
        }
      }
    }
  };
  addHeap(CAR.x, CAR.z, 'car', 12, CAR.rot);
  for (let x = -size / 2 + 10; x < size / 2 - 10; x += rng.range(16, 30)) {
    if (Math.abs(x) < 16 || !rng.chance(0.55)) continue;
    const side = rng.chance(0.5) ? 1 : -1;
    addHeap(x, highwayZ(x) + side * rng.range(1, 2.5), 'car', rng.int(10, 16), rng.range(-0.4, 0.4) + (rng.chance(0.5) ? Math.PI : 0));
  }
  for (const site of sites) {
    for (let k = 0; k < 3; k++) addHeap(site.x + rng.range(-12, 12), site.z + rng.range(-10, 10), 'pile', rng.int(6, 10), rng.range(0, 6));
  }
  addHeap(-3.5, -14, 'pile', 8, 0.4);  // junk behind the store
  addHeap(13, -6, 'pile', 6, 1.1);
  // Wrecks that never made it past the station, just up the road each way.
  addHeap(-19, highwayZ(-19) - 1.6, 'car', 12, 0.1);
  addHeap(21, highwayZ(21) + 1.6, 'car', 12, Math.PI - 0.15);
  addHeap(-12, 17.5, 'pile', 6, 2.0);

  reveal(w, 0, 0, 24);
  // The starting home zone: the clearing they can already see, minus roads and water.
  for (let tz = 0; tz < size; tz++) for (let tx = 0; tx < size; tx++) {
    const i = idx(w, tx, tz);
    if (Math.hypot(tileX(w, tx), tileZ(w, tz)) <= 20 && w.ground[i] !== Ground.Water) w.zone[i] = 1;
  }
  return w;
}
