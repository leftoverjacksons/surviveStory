/**
 * The mound as a townhouse (DESIGN §24.9). Under the hill the Folk live in a
 * Nunnehi townhouse: a hearth-hall with chambers dug off it, one more each
 * time the hill grows, chosen by what the hill lacks. Each chamber does
 * something small and real. Above ground each has a ghostly counterpart
 * (render/townhouse.ts) that most people can't see: clear with Sight, or in
 * the Veil view.
 */
import { alive } from './community';
import type { Colony } from './colony';
import type { FolkSociety } from './folk';

export type ChamberKind = 'hearth' | 'bowers' | 'dewcellar' | 'gallery' | 'archive' | 'nursery' | 'guestroom';

export interface Chamber {
  kind: ChamberKind;
  /** Where it lies off the hall: bearing from the hill's centre (radians) and depth below the crown (0..1). */
  a: number;
  depth: number;
  /** The hill's growth it was dug at. */
  level: number;
}

export const CHAMBERS: Record<ChamberKind, { name: string; blurb: string; topside: string }> = {
  hearth: { name: 'Hearth-hall', blurb: 'The townhouse itself: seven sides round a fire that never goes out. Where they gather and decide.', topside: 'a seven-sided lodge of light on the crown of the hill' },
  bowers: { name: 'Sleeping bowers', blurb: 'Rooms of woven root and moss. Each gives two of them somewhere to rest (counts toward Rest).', topside: 'small domed lodges round the hill\'s shoulder' },
  dewcellar: { name: 'Dew-cellar', blurb: 'Where the night\'s dew is kept cool. Two more dew each night.', topside: 'a well with a bowl of dew that shines' },
  gallery: { name: 'Song-gallery', blurb: 'A long, echoing chamber where the pipers practise. Two more song each night.', topside: 'tall reed pipes that hum in the wind' },
  archive: { name: 'Root-archive', blurb: 'Their memory, written in roots: the names of the village\'s dead are kept here too. Grief in the village eases sooner.', topside: 'a tree hung with small lanterns, one for each name' },
  nursery: { name: 'Nursery', blurb: 'Where the young of the hill are sung to. The hill grows faster.', topside: 'a cradle of light swinging in the branches' },
  guestroom: { name: 'Guest-room', blurb: 'A room with a door the size of a person. Their hobs come down one night more to help the village.', topside: 'a lodge with a door left open, lit from inside' },
};

/** The townhouse a new hill starts with. */
export const firstChambers = (door: number): Chamber[] => [
  { kind: 'hearth', a: 0, depth: 0.5, level: 0 },
  { kind: 'bowers', a: door + Math.PI * 0.75, depth: 0.7, level: 0 },
];

export const chambers = (f: FolkSociety): Chamber[] => f.chambers ?? [];
export const chamberCount = (f: FolkSociety, kind: ChamberKind) => chambers(f).filter((c) => c.kind === kind).length;

/** What the hill lacks most: the next chamber it digs. */
export function nextChamber(col: Colony): ChamberKind {
  const f = col.folk;
  const has = (k: ChamberKind) => chamberCount(f, k) > 0;
  if (chamberCount(f, 'bowers') * 2 < f.beings.length) return 'bowers';
  if (!has('dewcellar') && f.dew < 12) return 'dewcellar';
  if (!has('gallery') && f.song < 12) return 'gallery';
  if (!has('archive') && col.community.survivors.some((s) => !s.alive && !s.departed && !s.taken)) return 'archive';
  if (!has('nursery') && f.level >= 3) return 'nursery';
  if (!has('guestroom') && f.standing >= 70) return 'guestroom';
  if (!has('dewcellar')) return 'dewcellar';
  if (!has('gallery')) return 'gallery';
  return 'bowers';
}

/** The hill has grown: dig the chamber it lacks. Returns it. */
export function digChamber(col: Colony): Chamber {
  const f = col.folk, m = col.world.folk.mound;
  const kind = nextChamber(col);
  const n = chambers(f).length;
  // Chambers spiral out from the hall, away from the door, deeper as they go.
  const c: Chamber = { kind, a: m.door + Math.PI + (n % 2 ? 1 : -1) * (0.5 + Math.floor(n / 2) * 0.7), depth: Math.min(1, 0.55 + n * 0.06), level: f.level };
  (f.chambers ??= []).push(c);
  return c;
}

/** Daily: what the chambers do beyond dew, song and rest (those are read where they're used). */
export function townhouseDaily(col: Colony) {
  const f = col.folk;
  // The root-archive keeps the names of the dead: those grieving in the village mend a little sooner.
  if (chamberCount(f, 'archive') && f.standing >= 20 && col.community.day % 2 === 0) {
    for (const s of alive(col.community)) if (s.griefDays > 0) s.griefDays--;
  }
}
