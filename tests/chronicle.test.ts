import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { classify } from '../src/sim/chronicle';

describe('the chronicle (DESIGN §22.3)', () => {
  it('samples every day and picks out what happened', () => {
    const col = createColony(generateWorld(5), createCommunity(5));
    col.village.autopilot = true;
    for (let d = 0; d < 20; d++) tick(col, 1440);
    const ch = col.chronicle!;
    expect(ch.samples.length).toBe(20);
    expect(ch.samples.at(-1)!.day).toBe(col.community.day - 1); // taken as each day ends
    expect(ch.events.length).toBeGreaterThan(3);
    expect(new Set(ch.events.map((e) => e.kind)).size).toBeGreaterThan(1);
    // Each log line is read once (two alike on one day, e.g. two lanterns finished, are two lines).
    const inLog = new Map<string, number>(), read = new Map<string, number>();
    for (const l of col.community.log) inLog.set(`${l.day}|${l.text}`, (inLog.get(`${l.day}|${l.text}`) ?? 0) + 1);
    for (const e of ch.events) read.set(`${e.day}|${e.text}`, (read.get(`${e.day}|${e.text}`) ?? 0) + 1);
    for (const [k, n] of read) expect(n).toBeLessThanOrEqual(inLog.get(k) ?? n);
  }, 60000);

  it('classifies the log by what it says', () => {
    expect(classify('Ada, former EMT, walked out of the green and asked to stay.')).toBe('people');
    expect(classify('Uri is gone (the cold). Their name is carved into the pump island.')).toBe('hardship');
    expect(classify('The council backed Jory: build a shrine.')).toBe('council');
    expect(classify('Root cellar finished.')).toBe('building');
    expect(classify('Oren sat in the middle of the Choir until it finished. They won\'t say what it was about.')).toBe('veil');
    expect(classify('Day 4. Morale 60, food 50, wood 30.')).toBeNull();
  });
});
