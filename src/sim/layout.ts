/**
 * Fixed layout of the starting gas station, in world coordinates. Shared by
 * world generation (which tiles are blocked or paved) and the renderer.
 */
import type { Point, Rect } from './world';

export const APRON: Rect = { x0: -10, z0: -6, x1: 10, z1: 8 };
export const CANOPY = { x: 0, z: 1.5, w: 11, d: 7, y: 4.4 };
export const STORE = { x: -1, z: -9, w: 10, h: 3.6, d: 5.5 };
export const CAMP: Point = { x: 6.5, z: -2.5 };
export const MEMORIAL: Point = { x: -7.4, z: -3.6 };
export const STOCKPILE: Rect = { x0: 5, z0: -9, x1: 10, z1: -5.5 };
export const SIGN: Point = { x: 9, z: 9.4 };
export const CAR = { x: -6.8, z: 5.8, rot: 0.35 };
/** The old highway runs east-west past the station at this z (near the centre). */
export const HIGHWAY_Z = 13;

/** Footprints survivors cannot walk through. (The station's car is a salvage heap.) */
export const STATION_BLOCKERS: Rect[] = [
  { x0: STORE.x - STORE.w / 2, z0: STORE.z - STORE.d / 2, x1: STORE.x + STORE.w / 2, z1: STORE.z + STORE.d / 2 },
  { x0: -4.2, z0: CANOPY.z - 1.6 - 0.55, x1: 4.2, z1: CANOPY.z - 1.6 + 0.55 }, // pump island A
  { x0: -4.2, z0: CANOPY.z + 1.6 - 0.55, x1: 4.2, z1: CANOPY.z + 1.6 + 0.55 }, // pump island B
  { x0: -9, z0: 4.8, x1: -4.6, z1: 6.8 },                                     // the old car
  { x0: -8.7, z0: -1.6, x1: -6.4, z1: -0.4 },                                 // barrels
  { x0: SIGN.x - 0.3, z0: SIGN.z - 0.3, x1: SIGN.x + 0.3, z1: SIGN.z + 0.3 },
  { x0: CAMP.x - 0.5, z0: CAMP.z - 0.5, x1: CAMP.x + 0.5, z1: CAMP.z + 0.5 },  // fire pit
];

/** Where each survivor sits in the evening (index = seat number). */
export function seatSpot(i: number, n: number): Point {
  const a = (i / Math.max(n, 1)) * Math.PI * 2 + 0.4;
  return { x: CAMP.x + Math.cos(a) * 1.7, z: CAMP.z + Math.sin(a) * 1.7 };
}

/** Where each survivor sleeps: bedrolls in a wider ring around the fire. */
export function bedSpot(i: number): Point {
  const a = i * 0.9 + 2.2;
  const r = 3.3 + (i % 2) * 0.9;
  return { x: CAMP.x + Math.cos(a) * r, z: CAMP.z + Math.sin(a) * r };
}

/** The store's front door (outside) and a point inside, for sleeping indoors. */
export const STORE_DOOR: Point = { x: STORE.x + 0.7, z: STORE.z + STORE.d / 2 + 0.9 };
export const STORE_INSIDE: Point = { x: STORE.x, z: STORE.z };
/** The lean-to annex against the store's west wall. */
export const ANNEX = { x0: STORE.x - STORE.w / 2 - 3, z0: STORE.z - STORE.d / 2 + 0.25, w: 3, d: 5 };
/** The kitchen goes under the canopy, between the pump islands. */
export const KITCHEN = { x: 0, z: CANOPY.z };
