import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick, type Colony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { SAVE_VERSION, makeSave, restore, type SaveFile } from '../src/sim/save';

/** A fingerprint of everything that matters (typed arrays hashed, Maps and Sets as lists). */
function digest(col: Colony): string {
  const hash = (a: ArrayLike<number>) => { let h = 2166136261; for (let i = 0; i < a.length; i++) h = Math.imul(h ^ Math.round(a[i] * 1000), 16777619); return h >>> 0; };
  return JSON.stringify({ ...col, events: undefined, unreachable: undefined }, (_k, v) =>
    ArrayBuffer.isView(v) ? `#${hash(v as unknown as ArrayLike<number>)}` : v instanceof Map ? [...v] : v instanceof Set ? [...v] : v);
}

describe('saving and resuming (DESIGN §22.1)', () => {
  it('a restored colony carries on exactly as the original', () => {
    for (const seed of [3, 8]) {
      const a = createColony(generateWorld(seed), createCommunity(seed));
      a.village.autoPlan = true;
      for (let d = 0; d < 9; d++) tick(a, 1440);
      tick(a, 437); // mid-day, mid-task
      const file = structuredClone(makeSave(a, { x: 1, z: 2, zoom: 1.5, yaw: 0.8 }));
      const b = restore(file);
      if (typeof b === 'string') throw new Error(b);
      expect(digest(b)).toBe(digest(a));
      for (let d = 0; d < 6; d++) { tick(a, 1440); tick(b, 1440); }
      expect(b.community.day).toBe(a.community.day);
      expect(digest(b)).toBe(digest(a));
    }
  }, 120000);

  it('keeps shared references shared', () => {
    const a = createColony(generateWorld(4), createCommunity(4));
    const b = restore(structuredClone(makeSave(a))) as Colony;
    expect(b.village.site).toBe(b.world.site);
  });

  it('refuses a save from another version, and fills in fields added since', () => {
    const a = createColony(generateWorld(5), createCommunity(5));
    const old = structuredClone(makeSave(a)) as SaveFile;
    old.version = SAVE_VERSION + 1;
    expect(typeof restore(old)).toBe('string');
    const f = structuredClone(makeSave(a)) as SaveFile;
    delete (f.colony.community.resources as Partial<typeof a.community.resources>).steel;
    const b = restore(f) as Colony;
    expect(b.community.resources.steel).toBe(0);
  });
});
