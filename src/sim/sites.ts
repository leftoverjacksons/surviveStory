/**
 * Starting sites. Every game begins at one found structure the survivors
 * shelter in first, chosen per map: a gas station, a wayside chapel, a
 * roadside motel, a farmstead's barn, or a garden centre's glasshouse.
 *
 * Each site says where things are (the shelter, the fire, the stockpile, the
 * kitchen, the memorial), how it is repaired (clear it, then patch the fallen
 * part of its roof), how many it sleeps at each stage, what it becomes once
 * most people have homes, and a small advantage of its own.
 *
 * All sites sit just north of the highway (z ≈ 13), front door facing it.
 */
import { ANNEX, APRON, CAMP, CAR, KITCHEN, MEMORIAL, SIGN, STATION_BLOCKERS, STOCKPILE, STORE, STORE_DOOR, STORE_INSIDE } from './layout';
import type { Point, Rect } from './world';

export type SiteKind = 'station' | 'chapel' | 'motel' | 'farm' | 'glasshouse';
export const SITE_KINDS: SiteKind[] = ['station', 'chapel', 'motel', 'farm', 'glasshouse'];

export interface Shelter { x: number; z: number; w: number; d: number; h: number }

export interface Site {
  kind: SiteKind;
  /** Shown as the settlement's name. */
  place: string;
  /** The found building, as named in the log ("the old store"). */
  shelterName: string;
  /** What it becomes once most people have homes. */
  hallName: string;
  shelter: Shelter;
  roof: 'flat' | 'gable';
  /** Gable roofs: ridge along x or z, and pitch (radians). */
  ridge: 'x' | 'z';
  pitch: number;
  door: Point;
  inside: Point;
  clear: { name: string; beds: number; done: string; gives: { scrap?: number; glimmer?: number; food?: number } };
  patch: { name: string; beds: number; done: string; wood: number; scrap: number };
  /** The part of the roof that fell in; patched in the second repair. */
  collapse: { x: number; z: number; w: number; d: number };
  /** Cot positions (world), in order of use. */
  beds: Point[];
  hallBeds: Point[];
  hallTable: { x: number; z: number; len: number; axis: 'x' | 'z' };
  stove: Point;
  /** Firewood per winter day: derelict or cleared, then patched. */
  heat: [number, number];
  camp: Point;
  memorial: Point;
  stockpile: Rect;
  kitchen: Point;
  /** The kitchen stands under an existing roof (the station canopy). */
  kitchenCovered: boolean;
  annex: { x0: number; z0: number; w: number; d: number };
  paved: { rect: Rect; kind: 'asphalt' | 'concrete' }[];
  blockers: Rect[];
  /** Wrecks and heaps that belong to the site. */
  vehicles: { x: number; z: number; rot: number; scrap: number }[];
  junk: { x: number; z: number; scrap: number }[];
  /** An old tree nobody will cut. */
  oldTree: Point | null;
  /** What this place gives that others don't, in a sentence (shown on the shelter's card). */
  perk: string;
  /** The story's first line. */
  intro: string;
}

const r = (x0: number, z0: number, x1: number, z1: number): Rect => ({ x0, z0, x1, z1 });
const shelterRect = (s: Shelter): Rect => r(s.x - s.w / 2, s.z - s.d / 2, s.x + s.w / 2, s.z + s.d / 2);
const pad = (x: number, z: number, h = 0.5): Rect => r(x - h, z - h, x + h, z + h);

const STATION: Site = {
  kind: 'station',
  place: 'The Crossroads Station',
  shelterName: 'the old store',
  hallName: 'the commons hall',
  shelter: { ...STORE },
  roof: 'flat', ridge: 'x', pitch: 0,
  door: { ...STORE_DOOR }, inside: { ...STORE_INSIDE },
  clear: { name: 'Clear out the old store', beds: 4, gives: { scrap: 6 },
    done: 'The old store is swept out. Four can sleep dry inside, and there was scrap behind the counter.' },
  patch: { name: 'Patch the store roof', beds: 6, wood: 10, scrap: 6,
    done: 'Tarp and tin over the broken roof. The store sleeps six now, and nobody drips.' },
  collapse: { x: STORE.x + STORE.w * 0.3, z: STORE.z, w: STORE.w * 0.38, d: STORE.d + 0.5 },
  beds: [[-4, -1.3], [-2.6, -1.3], [-1.2, -1.3], [-4, 1.1], [-2.6, 1.1], [-1.2, 1.1]].map(([x, z]) => ({ x: STORE.x + x, z: STORE.z + z })),
  hallBeds: [{ x: STORE.x - 4.2, z: STORE.z - 1.6 }, { x: STORE.x + 3.2, z: STORE.z - 1.6 }],
  hallTable: { x: STORE.x - 0.6, z: STORE.z + 0.2, len: 5.6, axis: 'x' },
  stove: { x: STORE.x + 3.4, z: STORE.z + 0.9 },
  heat: [3, 2],
  camp: { ...CAMP }, memorial: { ...MEMORIAL }, stockpile: { ...STOCKPILE },
  kitchen: { ...KITCHEN }, kitchenCovered: true,
  annex: { ...ANNEX },
  paved: [{ rect: { ...APRON }, kind: 'asphalt' }],
  blockers: STATION_BLOCKERS.map((b) => ({ ...b })),
  vehicles: [{ x: CAR.x, z: CAR.z, rot: CAR.rot, scrap: 12 }],
  junk: [{ x: -3.5, z: -14, scrap: 8 }],
  oldTree: { x: 10.5, z: 5.5 },
  perk: 'A gas station: plenty of scrap in the wrecks around it.',
  intro: 'The old station at the crossroads holds. The vines hold it tighter.',
};
void SIGN;

const CHAPEL_S: Shelter = { x: -1, z: -7, w: 6.5, d: 10, h: 3.4 };
const CHAPEL: Site = {
  kind: 'chapel',
  place: 'The Wayside Chapel',
  shelterName: 'the chapel',
  hallName: 'the meeting house',
  shelter: CHAPEL_S,
  roof: 'gable', ridge: 'z', pitch: 0.85,
  door: { x: -1, z: -1.1 }, inside: { x: -1, z: -7 },
  clear: { name: 'Clear out the chapel', beds: 4, gives: { scrap: 3, glimmer: 4 },
    done: 'The chapel is swept out and the fallen plaster carried off. Four can sleep dry in the pews, and there were candles in the vestry cupboard.' },
  patch: { name: 'Mend the chapel roof', beds: 6, wood: 12, scrap: 4,
    done: 'Slates and tarp over the hole above the altar. The chapel sleeps six, and it is quieter in there than anywhere.' },
  collapse: { x: -1, z: -10.6, w: 6.9, d: 3.2 },
  beds: [[-2.9, -5.8], [0.9, -5.8], [-2.9, -7.8], [0.9, -7.8], [-2.9, -9.8], [0.9, -9.8]].map(([x, z]) => ({ x, z })),
  hallBeds: [{ x: -3.3, z: -10.9 }, { x: 1.3, z: -10.9 }],
  hallTable: { x: -1, z: -7.2, len: 4.4, axis: 'z' },
  stove: { x: 1.4, z: -3.3 },
  heat: [3, 3],
  camp: { x: -6.5, z: 2.5 }, memorial: { x: 5.5, z: -5 }, stockpile: r(-14, -4, -9, -0.5),
  kitchen: { x: 2.8, z: 4.5 }, kitchenCovered: false,
  annex: { x0: -7.25, z0: -11.75, w: 3, d: 5 },
  paved: [{ rect: r(-4, -2, 2, 10), kind: 'concrete' }],
  blockers: [shelterRect(CHAPEL_S), pad(-6.5, 2.5)],
  vehicles: [{ x: -9, z: 7, rot: 0.25, scrap: 12 }],
  junk: [{ x: -1, z: -14.5, scrap: 7 }, { x: 11, z: 5, scrap: 5 }],
  oldTree: { x: 9.5, z: -9.5 },
  perk: 'A chapel with its graveyard: sacred ground from the first day, and candles to gather glimmer from.',
  intro: 'The chapel by the road still has its bell. Nobody has rung it in years, but it is there.',
};

const MOTEL_S: Shelter = { x: -2, z: -8, w: 16, d: 5, h: 3 };
const MOTEL: Site = {
  kind: 'motel',
  place: 'The Wayfarer Motel',
  shelterName: 'the motel',
  hallName: 'the motel lodge',
  shelter: MOTEL_S,
  roof: 'flat', ridge: 'x', pitch: 0,
  door: { x: -4, z: -4.6 }, inside: { x: -3, z: -7.4 },
  clear: { name: 'Clear out the motel rooms', beds: 6, gives: { scrap: 8 },
    done: 'The motel rooms are cleared of mould and broken glass. Six can sleep behind doors that lock.' },
  patch: { name: 'Patch the end room\'s roof', beds: 8, wood: 14, scrap: 6,
    done: 'The caved-in end room has a roof again. Eight beds now, and people talk wistfully about hot water.' },
  collapse: { x: 4, z: -8, w: 4.2, d: 5.4 },
  beds: [[-8.9, -8.8], [-7.1, -8.8], [-4.9, -8.8], [-3.1, -8.8], [-0.9, -8.8], [0.9, -8.8], [3.1, -8.8], [4.9, -8.8]].map(([x, z]) => ({ x, z })),
  hallBeds: [{ x: -9, z: -9.2 }, { x: 5, z: -9.2 }],
  hallTable: { x: -2, z: -7.4, len: 8, axis: 'x' },
  stove: { x: 3.5, z: -9.3 },
  heat: [3, 3],
  camp: { x: 3, z: 1 }, memorial: { x: -11.5, z: 6 }, stockpile: r(7, -3.5, 12, 0),
  kitchen: { x: -4.5, z: 0.8 }, kitchenCovered: false,
  annex: { x0: -13, z0: -10.25, w: 3, d: 5 },
  paved: [{ rect: r(-13, -5, 11, 10), kind: 'asphalt' }],
  blockers: [shelterRect(MOTEL_S), r(-14.5, -0.5, -11, 3), r(-9, 4.5, -5, 7.5), pad(10.5, 8.5, 0.35), pad(3, 1)],
  vehicles: [{ x: 0.5, z: 6.5, rot: 1.5, scrap: 12 }, { x: 3.5, z: 6.8, rot: 1.62, scrap: 12 }],
  junk: [{ x: -2, z: -12, scrap: 7 }, { x: 12, z: -6, scrap: 6 }],
  oldTree: { x: 13, z: -1.5 },
  perk: 'A motel: rooms enough to sleep six from the start, and eight once the end room is roofed.',
  intro: 'The motel sign still stands over the lot. The rooms behind it have doors, and the doors have locks.',
};

const BARN_S: Shelter = { x: -1, z: -7, w: 9, d: 7, h: 3.6 };
const FARM: Site = {
  kind: 'farm',
  place: 'Aldermoor Farm',
  shelterName: 'the barn',
  hallName: 'the barn hall',
  shelter: BARN_S,
  roof: 'gable', ridge: 'x', pitch: 0.72,
  door: { x: -1, z: -2.6 }, inside: { x: -1, z: -7 },
  clear: { name: 'Muck out the barn', beds: 4, gives: { food: 10 },
    done: 'The barn is mucked out and the old hay forked into a dry corner. Four can sleep in the loft, and there were sacks of seed potatoes nobody had found.' },
  patch: { name: 'Re-roof the barn\'s broken end', beds: 6, wood: 14, scrap: 2,
    done: 'New boards over the barn\'s broken end. Six in the loft now, and the swallows are back.' },
  collapse: { x: -4.2, z: -7, w: 2.8, d: 7.8 },
  beds: [[-2, -9], [0, -9], [2, -9], [2, -5.4], [-4.3, -9], [-4.3, -5.4]].map(([x, z]) => ({ x, z })),
  hallBeds: [{ x: -4.8, z: -9.6 }, { x: 2.8, z: -9.6 }],
  hallTable: { x: -1, z: -6.8, len: 5.5, axis: 'x' },
  stove: { x: 2.8, z: -5 },
  heat: [2, 2],
  camp: { x: 5, z: -1.5 }, memorial: { x: -10, z: -5.5 }, stockpile: r(8, -4.5, 13, -1),
  kitchen: { x: -6, z: 3 }, kitchenCovered: false,
  annex: { x0: -8.5, z0: -10.25, w: 3, d: 5 },
  paved: [{ rect: r(-3, -3.5, 1, 10), kind: 'concrete' }],
  blockers: [shelterRect(BARN_S), r(4.4, -10.6, 7.6, -7.4), pad(5, -1.5)],
  vehicles: [{ x: 6.5, z: 5, rot: 0.9, scrap: 14 }],
  junk: [{ x: -1, z: -13, scrap: 7 }, { x: 10.5, z: 6.5, scrap: 5 }],
  oldTree: { x: -12, z: -7.5 },
  perk: 'A farmstead: a field already marked out, and seed stores in the barn.',
  intro: 'The barn at Aldermoor has outlasted the house. Swallows go in and out of the broken end.',
};

const GLASS_S: Shelter = { x: -1, z: -7, w: 11, d: 6, h: 2.6 };
const GLASSHOUSE: Site = {
  kind: 'glasshouse',
  place: 'The Glasshouses',
  shelterName: 'the glasshouse',
  hallName: 'the winter garden',
  shelter: GLASS_S,
  roof: 'gable', ridge: 'x', pitch: 0.45,
  door: { x: -1, z: -3.1 }, inside: { x: -1, z: -7 },
  clear: { name: 'Clear the glasshouse', beds: 4, gives: { scrap: 4 },
    done: 'The glasshouse is cleared of broken panes. Four can sleep between the old beds, and something green is still growing in them.' },
  patch: { name: 'Reglaze the glasshouse roof', beds: 6, wood: 8, scrap: 8,
    done: 'Salvaged panes and plastic sheet over the gaps. Six can sleep under the glass now, and it stays warm into the evening.' },
  collapse: { x: 2.5, z: -7, w: 3.2, d: 6.6 },
  beds: [[-5, -8.8], [-3.3, -8.8], [-1.6, -8.8], [0.1, -8.8], [2.1, -8.8], [3.7, -8.8]].map(([x, z]) => ({ x, z })),
  hallBeds: [{ x: -5.5, z: -9.3 }, { x: 3.8, z: -9.3 }],
  hallTable: { x: -1, z: -7.6, len: 6, axis: 'x' },
  stove: { x: 3.6, z: -7.4 },
  heat: [4, 3],
  camp: { x: 6, z: 1 }, memorial: { x: -10, z: 6 }, stockpile: r(8, -4, 13, -0.5),
  kitchen: { x: -5, z: 3.5 }, kitchenCovered: false,
  annex: { x0: -9.5, z0: -9.75, w: 3, d: 5 },
  paved: [{ rect: r(-7, -4, 5, 10), kind: 'concrete' }],
  blockers: [shelterRect(GLASS_S), r(6.5, -9.5, 9.5, -6.5), pad(6, 1)],
  vehicles: [{ x: -9.5, z: 8, rot: 0.1, scrap: 10 }],
  junk: [{ x: -1, z: -13, scrap: 7 }, { x: -12, z: -2, scrap: 6 }],
  oldTree: { x: 10, z: 6 },
  perk: 'A garden centre\'s glasshouse: the old beds inside still yield a little food from spring to autumn.',
  intro: 'Half the panes of the glasshouse are gone, and something green has been growing in there all along.',
};

export const SITES: Record<SiteKind, Site> = { station: STATION, chapel: CHAPEL, motel: MOTEL, farm: FARM, glasshouse: GLASSHOUSE };

/** A fresh copy of a site's definition. */
export const siteOf = (kind: SiteKind): Site => structuredClone(SITES[kind]);

/** Where each survivor sits in the evening around the fire (index = seat number). */
export function seatSpot(camp: Point, i: number, n: number): Point {
  const a = (i / Math.max(n, 1)) * Math.PI * 2 + 0.4;
  return { x: camp.x + Math.cos(a) * 1.7, z: camp.z + Math.sin(a) * 1.7 };
}

/** Where each survivor sleeps outdoors: bedrolls in a wider ring around the fire. */
export function bedSpot(camp: Point, i: number): Point {
  const a = i * 0.9 + 2.2;
  const rr = 3.3 + (i % 2) * 0.9;
  return { x: camp.x + Math.cos(a) * rr, z: camp.z + Math.sin(a) * rr };
}
