/**
 * The world grid. One tile = one world unit (about a metre and a half of
 * fiction). World coordinates are centred on the map: tile (tx, tz) has its
 * centre at (tx - w/2 + 0.5, tz - h/2 + 0.5).
 */

export const Ground = {
  Grass: 0,
  Meadow: 1,
  Forest: 2,
  Asphalt: 3,
  Concrete: 4,
  Water: 5,
} as const;
export type GroundId = (typeof Ground)[keyof typeof Ground];

export type TreeKind = 'oak' | 'pine' | 'birch';

/** Zones the player paints. One per tile. */
export const Zone = { None: 0, Home: 1, Woodlot: 2, Field: 3, Sacred: 4 } as const;
export type ZoneKind = (typeof Zone)[keyof typeof Zone];

/** Field crop states. */
export const Crop = { Untilled: 0, Tilled: 1, Growing: 2, Ripe: 3 } as const;

/** Footfall thresholds: worn grass becomes a path, then a lane. */
export const PATH_WEAR = 25;
export const LANE_WEAR = 90;

export interface Tree {
  id: number;
  tx: number;
  tz: number;
  kind: TreeKind;
  size: number;
  felled: boolean;
  chop: number;      // minutes of work done
  reserved: number;  // survivor id or 0
  protected: boolean;
  /** 0..1; saplings grow to 1 before they can be felled. */
  growth: number;
  /** Planted by the village (woodlot) rather than wild. */
  planted: boolean;
}

export interface Bush {
  id: number;
  tx: number;
  tz: number;
  berries: number;
  max: number;
  regrowAt: number; // game minute when berries return
  reserved: number;
}

export interface Rock { tx: number; tz: number; size: number }

/** Salvage: a wrecked car or a heap of debris that yields scrap. */
export interface Heap { id: number; tx: number; tz: number; kind: 'car' | 'pile'; scrap: number; max: number; rot: number; reserved: number }
export interface WallBlock { tx: number; tz: number; h: number }

export type PoiKind = 'ruin' | 'ring' | 'pond';
export interface Poi { id: number; kind: PoiKind; tx: number; tz: number; name: string; discovered: boolean }

export interface Rect { x0: number; z0: number; x1: number; z1: number }
export interface Point { x: number; z: number }

export interface World {
  seed: number;
  w: number;
  h: number;
  ground: Uint8Array;
  blocked: Uint8Array;
  /** Heights at tile corners, (w+1) * (h+1). */
  heights: Float32Array;
  /** 0 = never seen, 255 = fully explored. */
  explored: Uint8Array;
  fogVersion: number;
  trees: Tree[];
  treeAt: Int32Array;
  bushes: Bush[];
  bushAt: Int32Array;
  rocks: Rock[];
  heaps: Heap[];
  walls: WallBlock[];
  /** Painted zones (see Zone). Home is where the community may build. */
  zone: Uint8Array;
  zoneVersion: number;
  /** Footfall per tile; decays daily. High wear becomes paths and lanes. */
  wear: Float32Array;
  wearVersion: number;
  /** Field tiles: crop state (see Crop) and growth 0..1. */
  cropState: Uint8Array;
  cropGrowth: Float32Array;
  cropVersion: number;
  pois: Poi[];
  home: Point;
  campfire: Point;
  stockpile: Rect;
  fairyRing: Point;
}

export const idx = (w: World, tx: number, tz: number) => tz * w.w + tx;
export const inBounds = (w: World, tx: number, tz: number) => tx >= 0 && tz >= 0 && tx < w.w && tz < w.h;
export const tileX = (w: World, tx: number) => tx - w.w / 2 + 0.5;
export const tileZ = (w: World, tz: number) => tz - w.h / 2 + 0.5;
export const toTileX = (w: World, x: number) => Math.floor(x + w.w / 2);
export const toTileZ = (w: World, z: number) => Math.floor(z + w.h / 2);

export function passable(w: World, tx: number, tz: number): boolean {
  if (!inBounds(w, tx, tz)) return false;
  const i = idx(w, tx, tz);
  return w.blocked[i] === 0 && w.ground[i] !== Ground.Water;
}

/** Movement cost multiplier for a tile (only meaningful if passable). */
export function tileCost(w: World, tx: number, tz: number): number {
  const i = idx(w, tx, tz);
  let c = 1;
  const g = w.ground[i];
  if (g === Ground.Asphalt || g === Ground.Concrete) c = 0.8;
  else if (g === Ground.Forest) c = 1.25;
  if (w.treeAt[i] >= 0) c += 0.9; // squeezing between trunks
  const wear = w.wear[i];
  if (wear >= LANE_WEAR) c *= 0.8; else if (wear >= PATH_WEAR) c *= 0.9;
  return c;
}

export function heightAt(w: World, x: number, z: number): number {
  const fx = x + w.w / 2, fz = z + w.h / 2;
  const x0 = Math.max(0, Math.min(w.w - 1, Math.floor(fx)));
  const z0 = Math.max(0, Math.min(w.h - 1, Math.floor(fz)));
  const u = Math.max(0, Math.min(1, fx - x0)), v = Math.max(0, Math.min(1, fz - z0));
  const W = w.w + 1;
  const a = w.heights[z0 * W + x0], b = w.heights[z0 * W + x0 + 1];
  const c = w.heights[(z0 + 1) * W + x0], d = w.heights[(z0 + 1) * W + x0 + 1];
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

/** Reveal a soft-edged disc of the map. Returns true if anything changed. */
export function reveal(w: World, x: number, z: number, radius: number): boolean {
  const cx = toTileX(w, x), cz = toTileZ(w, z);
  const r = Math.ceil(radius);
  // Walking through well-known country: nothing new to see.
  const k = Math.max(1, r - 1);
  const known = (tx: number, tz: number) => !inBounds(w, tx, tz) || w.explored[idx(w, tx, tz)] === 255;
  if (known(cx, cz) && known(cx + k, cz) && known(cx - k, cz) && known(cx, cz + k) && known(cx, cz - k)
    && known(cx + r, cz) && known(cx - r, cz) && known(cx, cz + r) && known(cx, cz - r)) return false;
  let changed = false;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const tx = cx + dx, tz = cz + dz;
      if (!inBounds(w, tx, tz)) continue;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const edge = radius - d; // tiles inside the rim
      const v = edge >= 2 ? 255 : Math.round(255 * (0.35 + 0.325 * edge));
      const i = idx(w, tx, tz);
      if (v > w.explored[i]) {
        w.explored[i] = v;
        changed = true;
      }
    }
  }
  if (changed) w.fogVersion++;
  return changed;
}

export const zoneAt = (w: World, tx: number, tz: number): number => (inBounds(w, tx, tz) ? w.zone[idx(w, tx, tz)] : Zone.None);
/** Home zone: where the community may build. */
export const inZone = (w: World, tx: number, tz: number) => zoneAt(w, tx, tz) === Zone.Home;

/** Whether a tile may take a zone kind. Only explored land can be zoned. */
export function zoneAllowed(w: World, tx: number, tz: number, kind: ZoneKind): boolean {
  if (!inBounds(w, tx, tz)) return false;
  const i = idx(w, tx, tz);
  if (w.explored[i] <= 128 || w.ground[i] === Ground.Water) return false;
  if (kind === Zone.Field || kind === Zone.Woodlot) {
    const g = w.ground[i];
    if (g === Ground.Asphalt || g === Ground.Concrete || w.blocked[i]) return false;
  }
  return true;
}

/** Paint a zone kind in a disc, or erase (kind = Zone.None). */
export function paintZone(w: World, x: number, z: number, radius: number, kind: ZoneKind): boolean {
  const cx = toTileX(w, x), cz = toTileZ(w, z);
  const r = Math.ceil(radius);
  let changed = false;
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const tx = cx + dx, tz = cz + dz;
    if (!inBounds(w, tx, tz) || Math.hypot(dx, dz) > radius) continue;
    const i = idx(w, tx, tz);
    if (kind !== Zone.None && !zoneAllowed(w, tx, tz, kind)) continue;
    if (w.zone[i] === kind) continue;
    if (w.zone[i] === Zone.Field) { w.cropState[i] = Crop.Untilled; w.cropGrowth[i] = 0; w.cropVersion++; }
    w.zone[i] = kind;
    changed = true;
  }
  if (changed) w.zoneVersion++;
  return changed;
}

export function isExplored(w: World, tx: number, tz: number): boolean {
  return inBounds(w, tx, tz) && w.explored[idx(w, tx, tz)] > 128;
}

export function exploredFraction(w: World): number {
  let n = 0;
  for (let i = 0; i < w.explored.length; i++) if (w.explored[i] > 128) n++;
  return n / w.explored.length;
}

/**
 * Visit tiles in rings of increasing Chebyshev distance from (cx, cz) and
 * return the first for which `test` returns true.
 */
export function findNearest(
  w: World, cx: number, cz: number, maxR: number, test: (tx: number, tz: number) => boolean,
): { tx: number; tz: number } | null {
  if (inBounds(w, cx, cz) && test(cx, cz)) return { tx: cx, tz: cz };
  for (let r = 1; r <= maxR; r++) {
    for (let k = -r; k <= r; k++) {
      const cand: [number, number][] = [[cx + k, cz - r], [cx + k, cz + r], [cx - r, cz + k], [cx + r, cz + k]];
      for (const [tx, tz] of cand) {
        if (inBounds(w, tx, tz) && test(tx, tz)) return { tx, tz };
      }
    }
  }
  return null;
}
