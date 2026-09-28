import { describe, expect, it } from 'vitest';
import { createCommunity } from '../src/sim/community';
import { createColony, tick } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import { councilFavourite, resolveCouncil } from '../src/sim/council';

describe('the council asks (DESIGN §21.5)', () => {
  it('a backed building waits for the player to place it, and is not proposed again meanwhile', () => {
    let checked = 0;
    for (const seed of [2, 3, 4, 5, 6, 7, 8, 9]) {
      const col = createColony(generateWorld(seed), createCommunity(seed));
      col.village.autoPlan = false;
      for (let m = 0; m < 1440 * 12 && !col.council.active?.proposals.some((p) => p.kind === 'build'); m += 60) {
        tick(col, 60);
        // Answer the others the way the council would, so the next one comes.
        const a = col.council.active;
        if (a && !a.proposals.some((p) => p.kind === 'build')) resolveCouncil(col, councilFavourite(col)!.id, false, true);
      }
      const b = col.council.active?.proposals.find((p) => p.kind === 'build');
      if (!b) continue;
      checked++;
      expect(resolveCouncil(col, b.id)).toBe(true);
      expect(col.village.priority).toBe(b.build);
      // Nothing is sited by itself; the agreement waits.
      tick(col, 1440 * 2);
      expect(col.village.projects.some((p) => !p.done && p.kind === b.build)).toBe(false);
      expect(col.village.priority).toBe(b.build);
      // The next council doesn't ask for it again.
      col.council.nextDay = col.community.day;
      for (let m = 0; m < 1440 && !col.council.active; m += 60) tick(col, 60);
      if (col.council.active) expect(col.council.active.proposals.some((p) => p.kind === 'build' && p.build === b.build)).toBe(false);
    }
    expect(checked).toBeGreaterThan(2);
  }, 120000);

  it('left alone (headless), the council still settles itself on its favourite', () => {
    const col = createColony(generateWorld(3), createCommunity(3));
    for (let m = 0; m < 1440 * 8 && !col.council.active; m += 60) tick(col, 60);
    const a = col.council.active!;
    expect(a).toBeTruthy();
    const fav = councilFavourite(col)!;
    expect(a.proposals.every((p) => p.support.length <= fav.support.length || (p.cost.food ?? 0) > col.community.resources.food)).toBe(true);
    // Settled at the first morning after its day is up.
    tick(col, 1440 * 2 + 60);
    expect(col.council.active?.proposals[0].id === a.proposals[0].id).toBe(false);
    expect(col.community.log.some((l) => /settled it without you/.test(l.text))).toBe(true);
  }, 60000);
});
