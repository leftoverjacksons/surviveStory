/**
 * Saving and resuming a game (DESIGN §22.1).
 *
 * The whole colony is plain data (objects, arrays, Maps, Sets and typed
 * arrays; the random stream is a number on the community), so a save is the
 * colony itself, stored by structured clone (IndexedDB in the browser,
 * `structuredClone` in tests), which keeps shared references intact. Because
 * the simulation is deterministic, a restored colony carries on exactly as
 * the original would have.
 *
 * `SAVE_VERSION` goes up when the state's shape changes in a way `migrate`
 * can't fill in; older saves are then refused rather than half-loaded.
 */
import type { Colony } from './colony';
import { benchSpot } from './homes';
import { digChamber, firstChambers } from './townhouse';
import { createMycelium } from './mycelium';
import { settleLineage } from './lineage';

export const SAVE_VERSION = 1;

export interface SaveFile {
  version: number;
  savedAt: number;
  day: number;
  place: string;
  seed: number;
  colony: Colony;
  /** Where the camera was looking. */
  camera?: { x: number; z: number; zoom: number; yaw: number };
}

export function makeSave(col: Colony, camera?: SaveFile['camera'], now = Date.now()): SaveFile {
  return { version: SAVE_VERSION, savedAt: now, day: col.community.day, place: col.world.site.place, seed: col.world.seed, colony: col, camera };
}

/** Is it safe to save now? Not in the middle of a clearing (its view and state live outside the colony's day). */
export const canSave = (col: Colony) => !col.clearing;

/** Fill in anything a save from an earlier build lacks. Returns why not, if it can't be loaded. */
export function restore(save: SaveFile): Colony | string {
  if (!save || typeof save !== 'object' || !save.colony) return 'No saved game.';
  if (save.version !== SAVE_VERSION) return `The save is from an older version of the game (${save.version}, now ${SAVE_VERSION}).`;
  const col = save.colony;
  migrate(col);
  return col;
}

/** Defaults for fields added since saves began (keep this list short and additive). */
function migrate(col: Colony) {
  col.events = [];
  col.unreachable = new Set();
  if (col.clearing) col.clearing = null; // never saved mid-clearing, but be safe
  const r = col.community.resources as unknown as Record<string, number>;
  for (const k of ['cloth', 'tools', 'clothes', 'preserves', 'glass', 'copper', 'steel']) r[k] ??= 0;
  col.folk.dew ??= 0;
  col.folk.song ??= 0;
  col.community.logCount ??= col.community.log.length;
  col.requests ??= [];
  col.gatherings ??= [];
  for (const s of col.community.survivors) settleLineage(col.community, s);
  col.mycelium ??= createMycelium(col.world);
  if (!col.folk.chambers) {
    // A hill that grew before the townhouse (DESIGN §24.9): one chamber for each growth.
    col.folk.chambers = firstChambers(col.world.folk.mound.door);
    for (let i = 0; i < col.folk.level; i++) digChamber(col);
  }
  // Benches were once set in front of the door (DESIGN §23.7): move them along the wall.
  for (const p of col.village.plots) for (const y of p.yard) if (y.kind === 'bench') Object.assign(y, benchSpot(p));
}
