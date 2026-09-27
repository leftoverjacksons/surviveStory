/**
 * Fields drawn as outlines. The player clicks the corners of a field; the
 * tiles inside become Field zone (so the farming work is unchanged), and
 * the outline itself is kept: the soil follows it, furrows run along the
 * contour, and once the field is in use the farmers fence it, with a gate
 * on the side facing the village.
 */
import { Crop, Zone, idx, inBounds, tileX, tileZ, toTileX, toTileZ, zoneAllowed, type Point, type World } from './world';

export interface FieldPlot {
  id: number;
  /** Corners, in order (world x/z). */
  pts: Point[];
  tiles: number[];
  /** Fence progress along the perimeter, 0..1. */
  fence: number;
  /** Which edge (from pts[i] to pts[i+1]) has the gate. */
  gate: number;
}

const FENCE_WOOD_PER_UNIT = 0.35;

export function pointInPolygon(p: Point, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function perimeter(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += Math.hypot(b.x - a.x, b.z - a.z); }
  return s;
}

export const fenceWood = (f: FieldPlot) => Math.ceil(perimeter(f.pts) * FENCE_WOOD_PER_UNIT);

/** The field (if any) that owns a tile. */
export function fieldOfTile(w: World, i: number): FieldPlot | undefined {
  const id = w.fieldAt[i];
  return id > 0 ? w.fields.find((f) => f.id === id) : undefined;
}

/** The field under a point, if any. */
export function fieldAtPoint(w: World, x: number, z: number): FieldPlot | undefined {
  return w.fields.find((f) => pointInPolygon({ x, z }, f.pts));
}

/**
 * Lay out a field from its corners. Only tiles that could be a field
 * (explored, not road or water or built on, not already another field)
 * are taken. Returns null if too little of it is usable.
 */
export function createField(w: World, pts: Point[], campfire: Point): FieldPlot | null {
  if (pts.length < 3) return null;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  const tiles: number[] = [];
  for (let tz = toTileZ(w, z0); tz <= toTileZ(w, z1); tz++) for (let tx = toTileX(w, x0); tx <= toTileX(w, x1); tx++) {
    if (!inBounds(w, tx, tz)) continue;
    const i = idx(w, tx, tz);
    if (w.fieldAt[i] > 0 || !zoneAllowed(w, tx, tz, Zone.Field)) continue;
    if (pointInPolygon({ x: tileX(w, tx), z: tileZ(w, tz) }, pts)) tiles.push(i);
  }
  if (tiles.length < 4) return null;
  // The gate goes on the edge whose middle is nearest the fire.
  let gate = 0, best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const d = Math.hypot((a.x + b.x) / 2 - campfire.x, (a.z + b.z) / 2 - campfire.z);
    if (d < best) { best = d; gate = i; }
  }
  const f: FieldPlot = { id: (w.fields.reduce((m, x) => Math.max(m, x.id), 0)) + 1, pts: pts.map((p) => ({ ...p })), tiles, fence: 0, gate };
  for (const i of tiles) {
    w.zone[i] = Zone.Field;
    w.fieldAt[i] = f.id;
    w.cropState[i] = Crop.Untilled; w.cropGrowth[i] = 0;
  }
  w.fields.push(f);
  w.zoneVersion++; w.cropVersion++;
  return f;
}

export function deleteField(w: World, id: number): boolean {
  const f = w.fields.find((x) => x.id === id);
  if (!f) return false;
  for (const i of f.tiles) {
    if (w.fieldAt[i] !== id) continue;
    w.fieldAt[i] = 0;
    w.zone[i] = Zone.None;
    w.cropState[i] = Crop.Untilled; w.cropGrowth[i] = 0;
  }
  w.fields = w.fields.filter((x) => x !== f);
  w.zoneVersion++; w.cropVersion++;
  return true;
}

/** A field is worth fencing once most of it has been worked. */
export function wantsFence(w: World, f: FieldPlot): boolean {
  if (f.fence >= 1) return false;
  const worked = f.tiles.filter((i) => w.cropState[i] !== Crop.Untilled).length;
  return worked >= f.tiles.length * 0.5;
}

/** A point along the perimeter at fraction t (0..1), and the edge it is on. */
export function alongPerimeter(pts: Point[], t: number): { p: Point; edge: number } {
  const total = perimeter(pts);
  let d = t * total;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (d <= len || i === pts.length - 1) {
      const k = len > 0 ? Math.min(1, d / len) : 0;
      return { p: { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k }, edge: i };
    }
    d -= len;
  }
  return { p: { ...pts[0] }, edge: 0 };
}

/** Minutes of work per unit of fence. */
export const FENCE_WORK_PER_UNIT = 22;

/** An eight-sided field of radius r around a point (for probes and tests). */
export function roundField(w: World, cx: number, cz: number, r: number, campfire: Point): FieldPlot | null {
  const pts: Point[] = [];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; pts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r }); }
  return createField(w, pts, campfire);
}
