import { describe, expect, it } from 'vitest';
import {
  dayOfSeason, daysUntilWinter, daylightHours, seasonLook, seasonOf, weatherOn, DAYS_PER_SEASON, DAYS_PER_YEAR,
} from '../src/sim/calendar';

const S = DAYS_PER_SEASON;
import { createCommunity } from '../src/sim/community';
import { createColony, fieldTiles, fireWood, tick, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { Crop, LANE_WEAR, PATH_WEAR, Zone, idx, paintZone, toTileX, toTileZ, zoneAllowed } from '../src/sim/world';

describe('calendar', () => {
  it('runs four seasons of equal length', () => {
    expect(DAYS_PER_YEAR).toBe(4 * S);
    expect(seasonOf(1)).toBe('spring');
    expect(seasonOf(S + 1)).toBe('summer');
    expect(seasonOf(2 * S + 1)).toBe('autumn');
    expect(seasonOf(3 * S + 1)).toBe('winter');
    expect(seasonOf(4 * S + 1)).toBe('spring');
    expect(dayOfSeason(S + 2)).toBe(2);
    expect(daysUntilWinter(1)).toBe(3 * S);
    expect(daysUntilWinter(3 * S + 3)).toBe(0);
  });

  it('has long summer days and short winter ones', () => {
    expect(daylightHours(1.5 * S + 1)).toBeGreaterThan(15);
    expect(daylightHours(3.5 * S + 1)).toBeLessThan(9);
  });

  it('only snows in winter, and snow lies in winter', () => {
    for (let d = 1; d <= 3 * S; d++) expect(weatherOn(d, 7)).not.toBe('snow');
    expect(seasonLook(3.5 * S + 1, false).snow).toBeGreaterThan(0.9);
    expect(seasonLook(1.6 * S, false).snow).toBe(0);
    expect(seasonLook(2.5 * S + 1, false).autumn).toBeGreaterThan(0.9);
  });
});

/** Paint a field on the best open patch near home, like a player would. */
function markField(col: Colony) {
  const w = col.world;
  let best = { x: 0, z: 0, n: -1 };
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    const x = Math.cos(a) * 22, z = Math.sin(a) * 22;
    let n = 0;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const tx = toTileX(w, x + dx), tz = toTileZ(w, z + dz);
      if (zoneAllowed(w, tx, tz, Zone.Field) && w.treeAt[idx(w, tx, tz)] < 0 && w.bushAt[idx(w, tx, tz)] < 0) n++;
    }
    if (n > best.n) best = { x, z, n };
  }
  paintZone(w, best.x, best.z, 3.5, Zone.Field);
  return best;
}

function runTo(col: Colony, day: number) {
  while (Math.floor(col.minute / 1440) + 1 < day) tick(col, 10);
}

describe('the living year', () => {
  const col = createColony(generateWorld(12), createCommunity(12));
  markField(col);
  // A woodlot in the nearest forest, and sacred ground around the Ring.
  paintZone(col.world, col.world.fairyRing.x, col.world.fairyRing.z, 4, Zone.Sacred);
  const sacredTrees = col.world.trees.filter((t) => col.world.zone[idx(col.world, t.tx, t.tz)] === Zone.Sacred && !t.felled).map((t) => t.id);

  it('farmers till and sow in spring', () => {
    runTo(col, Math.round(S * 0.85));
    const w = col.world;
    const sown = fieldTiles(col).filter((i) => w.cropState[i] >= Crop.Growing).length;
    expect(sown).toBeGreaterThan(fieldTiles(col).length * 0.5);
  });

  it('crops ripen and are harvested by late autumn', () => {
    const before = col.community.resources.food;
    runTo(col, 3 * S);
    const w = col.world;
    const ripeLeft = fieldTiles(col).filter((i) => w.cropState[i] === Crop.Ripe).length;
    expect(ripeLeft).toBeLessThan(fieldTiles(col).length * 0.3);
    expect(col.community.resources.food).toBeGreaterThan(before);
  });

  it('frost clears the fields at the start of winter', () => {
    runTo(col, 3 * S + 2);
    const w = col.world;
    expect(fieldTiles(col).every((i) => w.cropState[i] <= Crop.Tilled)).toBe(true);
  });

  it('burns more firewood in winter', () => {
    expect(fireWood(col, 'winter')).toBeGreaterThan(fireWood(col, 'summer'));
  });

  it('never fells trees on sacred ground', () => {
    for (const id of sacredTrees) expect(col.world.trees[id].felled).toBe(false);
  });

  it('wears paths, and lanes where people walk most', () => {
    const wear = col.world.wear;
    let paths = 0, lanes = 0;
    for (let i = 0; i < wear.length; i++) { if (wear[i] >= PATH_WEAR) paths++; if (wear[i] >= LANE_WEAR) lanes++; }
    expect(paths).toBeGreaterThan(20);
    expect(lanes).toBeGreaterThan(3);
  });

  it('keeps everyone alive through the first winter with a field marked', () => {
    runTo(col, 49);
    expect(col.community.survivors.filter((s) => !s.alive).length).toBe(0);
  });
});

describe('woodlots', () => {
  it('cut inside the woodlot and replant it', () => {
    const col = createColony(generateWorld(4), createCommunity(4));
    const w = col.world;
    // Find the densest patch of trees near home and mark it.
    let best = { x: 0, z: 0, n: -1 };
    for (let r = 16; r <= 26; r += 2) for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      let n = 0;
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        const i = idx(w, toTileX(w, x + dx), toTileZ(w, z + dz));
        if (w.treeAt[i] >= 0 && w.explored[i] > 128) n++;
      }
      if (n > best.n) best = { x, z, n };
    }
    paintZone(w, best.x, best.z, 4.5, Zone.Woodlot);
    const standingOutside = new Set(w.trees.filter((t) => !t.felled && w.zone[idx(w, t.tx, t.tz)] !== Zone.Woodlot).map((t) => t.id));
    runTo(col, 8);
    const inLot = (t: { tx: number; tz: number }) => w.zone[idx(w, t.tx, t.tz)] === Zone.Woodlot;
    const felledInLot = w.trees.filter((t) => t.felled && inLot(t)).length;
    const matureLeftInLot = w.trees.filter((t) => !t.felled && inLot(t) && t.growth >= 1).length;
    const siteTrees = new Set(col.village.projects.flatMap((p) => p.clearTrees));
    const cutElsewhere = w.trees.filter((t) => t.felled && standingOutside.has(t.id) && !siteTrees.has(t.id)).length;
    expect(felledInLot).toBeGreaterThan(3);
    // Trees outside the woodlot (other than building sites) only fall once the woodlot is exhausted.
    if (cutElsewhere > 0) expect(matureLeftInLot).toBe(0);
    expect(w.trees.some((t) => t.planted)).toBe(true);
  });
});
