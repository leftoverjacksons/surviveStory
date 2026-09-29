import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { whyLocked } from '../src/sim/power';

const fresh = (seed = 3) => createColony(generateWorld(seed), createCommunity(seed));

describe('timber handling (DESIGN §24.19)', () => {
  it('felled trees come in as logs, and logs are split into wood by the stockpile', () => {
    const col = fresh();
    const res = col.community.resources;
    res.logs = 30;
    const wood0 = res.wood;
    for (let k = 0; k < 24 * 60 * 2; k++) tick(col, 1);
    // Some logs were split, and the wood they made is in the stores (less what the fire burned).
    expect(res.logs).toBeLessThan(30);
    expect(res.wood + (30 - res.logs!) >= wood0).toBe(true);
  }, 60000);

  it('the saw pit waits on joinery', () => {
    const col = fresh();
    expect(whyLocked(col, 'sawpit')).toMatch(/joinery/);
    expect(whyLocked(col, 'hut')).toBeNull();
  });
});
