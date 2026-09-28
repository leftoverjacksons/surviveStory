/**
 * The old world: districts of ruined buildings around the village, laid out
 * the way people built before (a cul-de-sac of houses, a retail park with
 * its car park, a works yard, a farmstead, an old high street, a garden
 * centre). Which districts appear depends on the starting site.
 *
 * Every ruin knows what it is made of. Salvage taken from it carries that
 * provenance (material and source), so the log and the village's store can
 * say where things came from. The player still sees a single "scrap".
 */
import type { Rng } from './rng';
import type { SiteKind } from './sites';
import { Ground, idx, inBounds, toTileX, toTileZ, type World } from './world';

export type RuinKind = 'house' | 'garage' | 'shop' | 'bigbox' | 'warehouse' | 'shed' | 'barn' | 'silo' | 'farmhouse' | 'terrace' | 'chapel' | 'glasshouse';
export type DistrictKind = 'suburb' | 'strip' | 'works' | 'farmstead' | 'oldtown' | 'garden';

/** What salvage is, by where it came from. */
export type Material =
  | 'vinyl siding' | 'roof shingles' | 'window glass' | 'interior doors' | 'copper pipe'
  | 'garage doors' | 'car panels' | 'shop shelving' | 'plate glass' | 'shop signs'
  | 'corrugated steel' | 'steel girders' | 'pallets' | 'barn boards' | 'fence wire'
  | 'bricks' | 'roof slates' | 'pews' | 'greenhouse glass' | 'aluminium frame';

export interface Ruin {
  id: number;
  kind: RuinKind;
  /** Its old address or name ("14 Maple Close", "Harrow Retail Park, unit 3"). */
  name: string;
  district: number;
  /** Centre, size (along its own axes) and heading. The front faces local +z. */
  x: number; z: number; w: number; d: number; yaw: number;
  /** Wall height to the eaves. */
  h: number;
  /** 0 = standing, 1 = a shell. */
  decay: number;
  materials: Material[];
  seed: number;
  /** Paint or brick colour index, for the renderer. */
  tone: number;
  /** Patched up and in use again (see restore.ts). */
  restored?: boolean;
  /** Rare salvage already stripped out of it (see rare.ts). */
  stripped?: number;
}

export interface District {
  id: number;
  kind: DistrictKind;
  name: string;
  x: number; z: number;
  ruins: number[];
}

/** Salvage the world starts with, to be placed once trees are down. */
export interface HeapSpot { x: number; z: number; kind: 'car' | 'pile'; scrap: number; rot: number; source: number; material: Material }

const MATERIALS: Record<RuinKind, Material[]> = {
  house: ['vinyl siding', 'roof shingles', 'window glass', 'interior doors', 'copper pipe'],
  garage: ['garage doors', 'car panels', 'roof shingles'],
  shop: ['shop shelving', 'plate glass', 'shop signs', 'steel girders'],
  bigbox: ['shop shelving', 'steel girders', 'corrugated steel', 'plate glass'],
  warehouse: ['corrugated steel', 'steel girders', 'pallets'],
  shed: ['corrugated steel', 'pallets'],
  barn: ['barn boards', 'corrugated steel', 'fence wire'],
  silo: ['corrugated steel'],
  farmhouse: ['bricks', 'roof slates', 'window glass', 'interior doors'],
  terrace: ['bricks', 'roof slates', 'window glass', 'copper pipe'],
  chapel: ['bricks', 'roof slates', 'pews'],
  glasshouse: ['greenhouse glass', 'aluminium frame'],
};

const STREETS = ['Maple', 'Linden', 'Hawthorn', 'Sorrel', 'Birch', 'Rowan', 'Alder', 'Heron', 'Larch', 'Juniper'];
const PLACES = ['Harrow', 'Ashcombe', 'Kiln', 'Westfield', 'Mill', 'Cotter', 'Greyfield', 'Tanner', 'Oakham', 'Brook'];

/** Which districts surround each starting site, nearest first. */
const NEAR: Record<SiteKind, DistrictKind[]> = {
  station: ['suburb', 'strip', 'works'],
  chapel: ['oldtown', 'suburb', 'farmstead'],
  motel: ['strip', 'suburb', 'works'],
  farm: ['farmstead', 'suburb', 'works'],
  glasshouse: ['garden', 'suburb', 'strip'],
};
const FAR: DistrictKind[] = ['suburb', 'works', 'strip', 'oldtown'];

export interface OldWorldTools {
  drawRoad: (pts: [number, number][], width: number) => void;
  highwayZ: (x: number) => number;
  /** Is this spot free of the starting site and water? */
  clear: (x: number, z: number) => boolean;
}

/**
 * Lay out districts: three near the village (by starting site), and the four
 * far ruin sites the roads already lead to. Returns salvage to place later.
 */
export function layOldWorld(w: World, rng: Rng, siteKind: SiteKind, far: { x: number; z: number }[], t: OldWorldTools): HeapSpot[] {
  const heaps: HeapSpot[] = [];
  const places = [...PLACES].sort(() => rng.next() - 0.5);
  const streets = [...STREETS].sort(() => rng.next() - 0.5);
  let placeI = 0, streetI = 0;

  const ruinAt = (r: Omit<Ruin, 'id' | 'materials' | 'seed'>): Ruin | null => {
    // Keep clear of the site, water and other ruins.
    const cs = Math.cos(r.yaw), sn = Math.sin(r.yaw);
    const pts: [number, number][] = [];
    for (let a = -0.4; a <= 0.41; a += 0.2) for (let b = -0.4; b <= 0.41; b += 0.2) {
      const lx = a * r.w, lz = b * r.d;
      pts.push([r.x + lx * cs + lz * sn, r.z - lx * sn + lz * cs]);
    }
    for (const [x, z] of pts) {
      if (!t.clear(x, z)) return null;
      const tx = toTileX(w, x), tz = toTileZ(w, z);
      if (!inBounds(w, tx, tz) || w.blocked[idx(w, tx, tz)]) return null;
    }
    const ruin: Ruin = { ...r, id: w.ruins.length, materials: MATERIALS[r.kind], seed: rng.int(1, 1e6) };
    w.ruins.push(ruin);
    // Block its footprint (people salvage from the heaps at the door) and pave under it.
    const R = Math.ceil(Math.hypot(r.w, r.d) / 2) + 1;
    const cx = toTileX(w, r.x), cz = toTileZ(w, r.z);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const tx = cx + dx, tz = cz + dz;
      if (!inBounds(w, tx, tz)) continue;
      const x = tx - w.w / 2 + 0.5 - r.x, z = tz - w.h / 2 + 0.5 - r.z;
      const lx = x * cs - z * sn, lz = x * sn + z * cs;
      if (Math.abs(lx) <= r.w / 2 + 0.2 && Math.abs(lz) <= r.d / 2 + 0.2) {
        const i = idx(w, tx, tz);
        w.blocked[i] = 1;
        w.ground[i] = Ground.Concrete;
      }
    }
    return ruin;
  };
  /** A point in front of a ruin (local +z), `out` beyond its wall. */
  const front = (r: Ruin, out: number, along = 0) => {
    const cs = Math.cos(r.yaw), sn = Math.sin(r.yaw);
    const lz = r.d / 2 + out;
    return { x: r.x + along * cs + lz * sn, z: r.z - along * sn + lz * cs };
  };
  const pave = (x: number, z: number, hw: number, hd: number, yaw: number, kind: number) => {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const R = Math.ceil(Math.hypot(hw, hd)) + 1;
    const cx = toTileX(w, x), cz = toTileZ(w, z);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const tx = cx + dx, tz = cz + dz;
      if (!inBounds(w, tx, tz)) continue;
      const i = idx(w, tx, tz);
      if (w.ground[i] === Ground.Water || w.blocked[i]) continue;
      const px = tx - w.w / 2 + 0.5 - x, pz = tz - w.h / 2 + 0.5 - z;
      const lx = px * cs - pz * sn, lz = px * sn + pz * cs;
      if (Math.abs(lx) <= hw && Math.abs(lz) <= hd) w.ground[i] = kind;
    }
  };
  const salvageFrom = (r: Ruin, n: number, scrap: [number, number]) => {
    for (let k = 0; k < n; k++) {
      const p = front(r, 1.2, (k - (n - 1) / 2) * 2.2);
      heaps.push({ x: p.x, z: p.z, kind: 'pile', scrap: rng.int(scrap[0], scrap[1]), rot: rng.range(0, 6), source: r.id, material: rng.pick(r.materials) });
    }
  };
  const decay = () => Math.min(1, Math.max(0, rng.range(0.15, 0.85) + (rng.chance(0.15) ? 0.3 : 0)));

  const build = (kind: DistrictKind, cx: number, cz: number, facing: number, id: number): District => {
    const place = places[placeI++ % places.length];
    const street = streets[streetI++ % streets.length];
    const d: District = { id, kind, name: '', x: cx, z: cz, ruins: [] };
    const add = (r: Ruin | null) => { if (r) { d.ruins.push(r.id); } return r; };
    const cs = Math.cos(facing), sn = Math.sin(facing);
    /** District-local (u across, v along the approach) to world. */
    const L = (u: number, v: number) => ({ x: cx + u * cs + v * sn, z: cz - u * sn + v * cs });

    if (kind === 'suburb') {
      d.name = `${street} Close`;
      // A turning circle at the end of a short street; houses face it.
      const c = L(0, 0);
      const road = L(0, 22);
      t.drawRoad([[road.x, road.z], [c.x, c.z]], 1.6);
      t.drawRoad([[c.x, c.z], [c.x + 0.01, c.z]], 4.2);
      let no = 1;
      const n = rng.int(5, 7);
      for (let k = 0; k < n; k++) {
        const a = facing + Math.PI + (k / (n - 1) - 0.5) * 2.9 + rng.range(-0.1, 0.1);
        const rr = 11 + rng.range(-0.6, 0.8);
        const hx = c.x + Math.sin(a) * rr, hz = c.z + Math.cos(a) * rr;
        const yaw = Math.atan2(c.x - hx, c.z - hz);
        const house = add(ruinAt({ kind: 'house', name: `${no} ${street} Close`, district: id, x: hx, z: hz, w: rng.range(6.5, 8), d: rng.range(5.5, 6.5), yaw, h: rng.range(2.5, 2.9), decay: decay(), tone: rng.int(0, 7) }));
        no += 2;
        if (!house) continue;
        const dp = front(house, 2.6);
        pave(dp.x, dp.z, 1.3, 2.4, yaw, Ground.Concrete);
        salvageFrom(house, 1, [7, 11]);
        if (rng.chance(0.55)) {
          const side = rng.chance(0.5) ? 1 : -1;
          const gx = house.x + Math.cos(yaw) * side * (house.w / 2 + 2.1), gz = house.z - Math.sin(yaw) * side * (house.w / 2 + 2.1);
          const gar = add(ruinAt({ kind: 'garage', name: `the garage at ${no - 2} ${street} Close`, district: id, x: gx, z: gz, w: 3.6, d: 5.4, yaw, h: 2.4, decay: decay(), tone: house.tone }));
          if (gar && rng.chance(0.6)) {
            const cp = front(gar, 2.6);
            heaps.push({ x: cp.x, z: cp.z, kind: 'car', scrap: rng.int(10, 15), rot: -Math.PI / 2 + yaw + rng.range(-0.15, 0.15), source: gar.id, material: 'car panels' });
          }
        }
      }
      // Two more along the street.
      for (const side of [-1, 1]) {
        const p = L(side * 9.5, 13);
        const house = add(ruinAt({ kind: 'house', name: `${no} ${street} Close`, district: id, x: p.x, z: p.z, w: 7, d: 6, yaw: facing + (side > 0 ? -Math.PI / 2 : Math.PI / 2), h: 2.7, decay: decay(), tone: rng.int(0, 7) }));
        no += 1;
        if (house) salvageFrom(house, 1, [6, 10]);
      }
    } else if (kind === 'strip') {
      d.name = `${place} Retail Park`;
      // A car park in front of a row of units, a big box at one end.
      const lot = L(0, 3);
      pave(lot.x, lot.z, 17, 8, facing, Ground.Asphalt);
      const road = L(0, 26);
      t.drawRoad([[road.x, road.z], [lot.x, lot.z]], 1.8);
      const units = rng.int(4, 5);
      for (let k = 0; k < units; k++) {
        const p = L(-12 + k * 5.2, -9);
        const shop = add(ruinAt({ kind: 'shop', name: `${place} Retail Park, unit ${k + 1}`, district: id, x: p.x, z: p.z, w: 5, d: 8, yaw: facing, h: 3.6, decay: decay(), tone: rng.int(0, 7) }));
        if (shop) salvageFrom(shop, 1, [7, 11]);
      }
      const bp = L(16, -10);
      const big = add(ruinAt({ kind: 'bigbox', name: `the ${place} superstore`, district: id, x: bp.x, z: bp.z, w: 14, d: 13, yaw: facing, h: 5.5, decay: decay(), tone: rng.int(0, 7) }));
      if (big) salvageFrom(big, 2, [10, 14]);
      for (let k = 0; k < rng.int(3, 6); k++) {
        const p = L(rng.range(-14, 14), rng.range(-1, 8));
        heaps.push({ x: p.x, z: p.z, kind: 'car', scrap: rng.int(10, 16), rot: facing + (rng.chance(0.5) ? 0 : Math.PI) + rng.range(-0.3, 0.3), source: big?.id ?? -1, material: 'car panels' });
      }
    } else if (kind === 'works') {
      d.name = `${place} Works`;
      const yard = L(0, 0);
      pave(yard.x, yard.z, 16, 13, facing, Ground.Concrete);
      const road = L(0, 26);
      t.drawRoad([[road.x, road.z], [yard.x, yard.z]], 1.8);
      const wp = L(-3, -5);
      const wh = add(ruinAt({ kind: 'warehouse', name: `the ${place} works`, district: id, x: wp.x, z: wp.z, w: 18, d: 12, yaw: facing, h: 6.2, decay: decay(), tone: rng.int(0, 7) }));
      if (wh) salvageFrom(wh, 3, [10, 15]);
      const sp = L(11, 5);
      const shed = add(ruinAt({ kind: 'shed', name: `the ${place} works shed`, district: id, x: sp.x, z: sp.z, w: 7, d: 9, yaw: facing - Math.PI / 2, h: 3.4, decay: decay(), tone: rng.int(0, 7) }));
      if (shed) salvageFrom(shed, 1, [8, 12]);
    } else if (kind === 'farmstead') {
      d.name = `${place} Farm`;
      const yard = L(0, 0);
      pave(yard.x, yard.z, 9, 7, facing, Ground.Concrete);
      const road = L(0, 24);
      t.drawRoad([[road.x, road.z], [yard.x, yard.z]], 1.4);
      const bp = L(-7, -6);
      const barn = add(ruinAt({ kind: 'barn', name: `the barn at ${place} Farm`, district: id, x: bp.x, z: bp.z, w: 12, d: 8, yaw: facing, h: 3.6, decay: decay(), tone: rng.int(0, 7) }));
      if (barn) salvageFrom(barn, 2, [8, 12]);
      const sp = L(1.5, -8);
      add(ruinAt({ kind: 'silo', name: `the silo at ${place} Farm`, district: id, x: sp.x, z: sp.z, w: 3.6, d: 3.6, yaw: facing, h: 7.5, decay: decay() * 0.5, tone: rng.int(0, 7) }));
      const fp = L(8, 1);
      const fh = add(ruinAt({ kind: 'farmhouse', name: `${place} farmhouse`, district: id, x: fp.x, z: fp.z, w: 7.5, d: 6, yaw: facing - Math.PI / 2, h: 2.8, decay: decay(), tone: rng.int(0, 7) }));
      if (fh) salvageFrom(fh, 1, [7, 11]);
    } else if (kind === 'oldtown') {
      d.name = `Old ${place}`;
      // A high street: terraces both sides, a chapel at its head.
      const a = L(0, 20), b = L(0, -14);
      t.drawRoad([[a.x, a.z], [b.x, b.z]], 1.9);
      let no = 1;
      for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
        const p = L(side * 6.2, 12 - k * 5);
        const tr = add(ruinAt({ kind: 'terrace', name: `${no} ${place} High Street`, district: id, x: p.x, z: p.z, w: 4.8, d: 6, yaw: facing + (side > 0 ? -Math.PI / 2 : Math.PI / 2), h: 3.2, decay: decay(), tone: rng.int(0, 7) }));
        no++;
        if (tr && rng.chance(0.6)) salvageFrom(tr, 1, [6, 10]);
      }
      const cp = L(0, -20);
      const ch = add(ruinAt({ kind: 'chapel', name: `St ${street}'s`, district: id, x: cp.x, z: cp.z, w: 7, d: 12, yaw: facing, h: 4.2, decay: decay() * 0.7, tone: rng.int(0, 7) }));
      if (ch) salvageFrom(ch, 1, [8, 12]);
    } else {
      d.name = `${place} Garden Centre`;
      const lot = L(0, 6);
      pave(lot.x, lot.z, 10, 5, facing, Ground.Asphalt);
      const road = L(0, 24);
      t.drawRoad([[road.x, road.z], [lot.x, lot.z]], 1.6);
      for (const u of [-9, 9]) {
        const p = L(u, -6);
        const gh = add(ruinAt({ kind: 'glasshouse', name: `the ${place} glasshouses`, district: id, x: p.x, z: p.z, w: 11, d: 8, yaw: facing, h: 2.6, decay: decay(), tone: rng.int(0, 7) }));
        if (gh) salvageFrom(gh, 1, [7, 11]);
      }
      const sp = L(0, -3);
      const shop = add(ruinAt({ kind: 'shop', name: `the ${place} garden shop`, district: id, x: sp.x, z: sp.z, w: 5, d: 7, yaw: facing, h: 3.2, decay: decay(), tone: rng.int(0, 7) }));
      if (shop) salvageFrom(shop, 1, [7, 11]);
    }
    return d;
  };

  // Near districts: at 40–62 units, spread around the village.
  const near = NEAR[siteKind];
  const a0 = rng.range(0, Math.PI * 2);
  near.forEach((kind, k) => {
    for (let tries = 0; tries < 24; tries++) {
      const a = a0 + (k / near.length) * Math.PI * 2 + rng.range(-0.5, 0.5);
      const r = rng.range(40, 60);
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (Math.abs(z - t.highwayZ(x)) < 12) continue;
      if (!t.clear(x, z) || w.districts.some((o) => Math.hypot(o.x - x, o.z - z) < 30)) continue;
      // Face the village: the approach (local +v) points home.
      const facing = Math.atan2(-x, -z);
      const d = build(kind, x, z, facing, w.districts.length);
      if (d.ruins.length >= 2) { w.districts.push(d); return; }
      // Too cramped here: undo and try elsewhere.
      for (const id of d.ruins) w.ruins[id].decay = -1;
    }
  });
  // The far sites at the ends of the roads.
  far.forEach((p, k) => {
    const facing = Math.atan2(-p.x, -p.z);
    const d = build(FAR[k % FAR.length], p.x, p.z, facing, w.districts.length);
    if (d.ruins.length) w.districts.push(d);
  });
  // Drop any ruins from abandoned attempts (their tiles stay paved: old foundations).
  const dead = new Set(w.ruins.filter((r) => r.decay < 0).map((r) => r.id));
  if (dead.size) {
    for (const r of w.ruins) if (dead.has(r.id)) {
      const cs = Math.cos(r.yaw), sn = Math.sin(r.yaw);
      const R = Math.ceil(Math.hypot(r.w, r.d) / 2) + 1;
      const cx = toTileX(w, r.x), cz = toTileZ(w, r.z);
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        const tx = cx + dx, tz = cz + dz;
        if (!inBounds(w, tx, tz)) continue;
        const x = tx - w.w / 2 + 0.5 - r.x, z = tz - w.h / 2 + 0.5 - r.z;
        if (Math.abs(x * cs - z * sn) <= r.w / 2 + 0.2 && Math.abs(x * sn + z * cs) <= r.d / 2 + 0.2) w.blocked[idx(w, tx, tz)] = 0;
      }
    }
    const keep = w.ruins.filter((r) => !dead.has(r.id));
    const remap = new Map(keep.map((r, i) => [r.id, i]));
    keep.forEach((r, i) => { r.id = i; });
    w.ruins = keep;
    for (const d of w.districts) d.ruins = d.ruins.filter((id) => remap.has(id)).map((id) => remap.get(id)!);
    for (let i = heaps.length - 1; i >= 0; i--) {
      if (dead.has(heaps[i].source)) heaps.splice(i, 1);
      else heaps[i].source = remap.get(heaps[i].source) ?? -1;
    }
  }
  return heaps;
}
