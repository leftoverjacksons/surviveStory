import { Rng } from './rng';
import { fbm, smoothstep } from './noise';
import { HIGHWAY_Z } from './layout';
import { SITE_KINDS, siteOf, type SiteKind } from './sites';
import {
  Ground, Zone, idx, inBounds, reveal, tileX, tileZ, toTileX, toTileZ,
  type Bush, type Rect, type Tree, type TreeKind, type World,
} from './world';

export const MAP_SIZE = 256;
const HOME_CLEAR = 15; // no wild trees this close to the station; sparse beyond

/** The highway: straight past the station, meandering further out. */
export function highwayZ(x: number): number {
  return HIGHWAY_Z + smoothstep(28, 70, Math.abs(x)) * Math.sin(x * 0.028) * 14;
}

const RUIN_NAMES = ['Pell Street', 'the Motor Court', 'Harrow Farm', 'the Relay Station', 'Old Ashby', 'the Clinic Row'];

/** Which found structure a map starts at: chosen by the seed unless given. */
export function siteKindFor(seed: number): SiteKind {
  return SITE_KINDS[new Rng(seed ^ 0x517e).int(0, SITE_KINDS.length - 1)];
}

export function generateWorld(seed: number, size = MAP_SIZE, siteKind: SiteKind = siteKindFor(seed)): World {
  const rng = new Rng(seed ^ 0x5eed);
  const n = size * size;
  const site = siteOf(siteKind);
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
    ponds: [], pondAt: new Int32Array(n).fill(-1), deck: new Uint8Array(n), deckY: new Float32Array(n),
    zone: new Uint8Array(n), zoneVersion: 0,
    wear: new Float32Array(n), wearVersion: 0,
    cropState: new Uint8Array(n), cropGrowth: new Float32Array(n), cropVersion: 0,
    home: { x: 0, z: 0 },
    campfire: { ...site.camp },
    stockpile: { ...site.stockpile },
    fairyRing: { x: 0, z: 0 },
    site,
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

  // --- the starting site: its paving and what can't be walked through ---
  for (let tz = 0; tz < size; tz++) for (let tx = 0; tx < size; tx++) {
    const x = tileX(w, tx), z = tileZ(w, tz);
    const i = idx(w, tx, tz);
    for (const p of site.paved) if (inRect(x, z, p.rect)) w.ground[i] = p.kind === 'asphalt' ? Ground.Asphalt : Ground.Concrete;
    for (const b of site.blockers) if (inRect(x, z, b, 0.4)) w.blocked[i] = 1;
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
    const t: Tree = { id: w.trees.length, tx, tz, kind, size, felled: false, chop: 0, reserved: 0, protected: prot, growth: 1, planted: false };
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
  // The old tree at the site. Nobody will cut it.
  if (site.oldTree) {
    const ot = w.treeAt[idx(w, toTileX(w, site.oldTree.x), toTileZ(w, site.oldTree.z))];
    if (ot >= 0) { w.trees[ot].felled = true; w.treeAt[idx(w, toTileX(w, site.oldTree.x), toTileZ(w, site.oldTree.z))] = -1; }
    addTree(toTileX(w, site.oldTree.x), toTileZ(w, site.oldTree.z), site.kind === 'chapel' ? 'pine' : 'oak', 1.35, true);
  }

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

  // Water bodies: flood-fill, and give each a fish stock by size.
  const POND_NAMES = ['Still Water', 'the Mirror Pond', 'Heron Pool', 'Reed Mere', 'the Black Tarn', 'Willow Pool', 'Carp Water', 'the Long Pond', 'Otter Pool', 'Moth Water'];
  for (let i0 = 0; i0 < n; i0++) {
    if (w.ground[i0] !== Ground.Water || w.pondAt[i0] >= 0) continue;
    const id = w.ponds.length;
    const stack = [i0];
    w.pondAt[i0] = id;
    let count = 0, sx = 0, sz = 0;
    while (stack.length) {
      const i = stack.pop()!;
      const tx = i % size, tz = (i / size) | 0;
      count++; sx += tx; sz += tz;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x2 = tx + dx, z2 = tz + dz;
        if (!inBounds(w, x2, z2)) continue;
        const j = idx(w, x2, z2);
        if (w.ground[j] === Ground.Water && w.pondAt[j] < 0) { w.pondAt[j] = id; stack.push(j); }
      }
    }
    const max = Math.round(Math.min(220, 20 + count * 0.6));
    w.ponds.push({ id, tiles: count, cx: tileX(w, sx / count), cz: tileZ(w, sz / count), stock: max, max, name: POND_NAMES[id % POND_NAMES.length] });
  }

  // Ponds big enough to name become points of interest.
  let pondPois = 0;
  for (let tries = 0; tries < 400 && pondPois < 3; tries++) {
    const tx = rng.int(20, size - 20), tz = rng.int(20, size - 20);
    if (w.ground[idx(w, tx, tz)] !== Ground.Water) continue;
    if (w.pois.some((p) => Math.hypot(p.tx - tx, p.tz - tz) < 40)) continue;
    const pond = w.ponds[w.pondAt[idx(w, tx, tz)]];
    if (w.pois.some((p) => p.kind === 'pond' && p.name === pond.name)) continue;
    w.pois.push({ id: poiId++, kind: 'pond', tx, tz, name: pond.name, discovered: false });
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
  for (const v of site.vehicles) addHeap(v.x, v.z, 'car', v.scrap, v.rot);
  for (let x = -size / 2 + 10; x < size / 2 - 10; x += rng.range(16, 30)) {
    if (Math.abs(x) < 16 || !rng.chance(0.55)) continue;
    const side = rng.chance(0.5) ? 1 : -1;
    addHeap(x, highwayZ(x) + side * rng.range(1, 2.5), 'car', rng.int(10, 16), rng.range(-0.4, 0.4) + (rng.chance(0.5) ? Math.PI : 0));
  }
  for (const site of sites) {
    for (let k = 0; k < 3; k++) addHeap(site.x + rng.range(-12, 12), site.z + rng.range(-10, 10), 'pile', rng.int(6, 10), rng.range(0, 6));
  }
  for (const j of site.junk) addHeap(j.x, j.z, 'pile', j.scrap, 0.4 + j.x);
  // Wrecks that never made it past the station, just up the road each way.
  addHeap(-19, highwayZ(-19) - 1.6, 'car', 12, 0.1);
  addHeap(21, highwayZ(21) + 1.6, 'car', 12, Math.PI - 0.15);
  addHeap(-12, 17.5, 'pile', 6, 2.0);

  reveal(w, 0, 0, 28);
  // The starting home zone: the clearing they can already see, minus roads and water.
  for (let tz = 0; tz < size; tz++) for (let tx = 0; tx < size; tx++) {
    const i = idx(w, tx, tz);
    if (Math.hypot(tileX(w, tx), tileZ(w, tz)) <= 26 && w.ground[i] !== Ground.Water) w.zone[i] = Zone.Home;
  }
  // Site advantages written into the land.
  if (site.kind === 'chapel') {
    // The graveyard is sacred ground.
    for (let tz = 0; tz < size; tz++) for (let tx = 0; tx < size; tx++) {
      const x = tileX(w, tx), z = tileZ(w, tz);
      if (x > 3.5 && x < 11.5 && z > -12.5 && z < -2.5 && !w.blocked[idx(w, tx, tz)]) w.zone[idx(w, tx, tz)] = Zone.Sacred;
    }
  } else if (site.kind === 'farm') {
    // The old home field, still marked by its hedges.
    for (let tz = 0; tz < size; tz++) for (let tx = 0; tx < size; tx++) {
      const x = tileX(w, tx), z = tileZ(w, tz);
      const i = idx(w, tx, tz);
      if (x > 6 && x < 14 && z > -19 && z < -12 && !w.blocked[i] && w.ground[i] !== Ground.Water) {
        w.zone[i] = Zone.Field;
        if (w.treeAt[i] >= 0) { w.trees[w.treeAt[i]].felled = true; w.treeAt[i] = -1; }
        if (w.bushAt[i] >= 0) { w.bushes[w.bushAt[i]].berries = 0; w.bushes[w.bushAt[i]].max = 0; w.bushAt[i] = -1; }
      }
    }
    // The farmhouse burned long ago: a foundation and a chimney stack.
    for (let tz = toTileZ(w, 0); tz <= toTileZ(w, 4); tz++) for (let tx = toTileX(w, -14); tx <= toTileX(w, -9); tx++) {
      const edge = tz === toTileZ(w, 0) || tz === toTileZ(w, 4) || tx === toTileX(w, -14) || tx === toTileX(w, -9);
      if (!edge || (tx === toTileX(w, -11) && tz === toTileZ(w, 4))) continue;
      const i = idx(w, tx, tz);
      w.blocked[i] = 1;
      w.walls.push({ tx, tz, h: tx === toTileX(w, -14) && tz === toTileZ(w, 0) ? 4.2 : rng.range(0.4, 1.4) });
    }
  }
  return w;
}
