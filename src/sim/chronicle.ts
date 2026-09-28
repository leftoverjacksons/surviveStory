/**
 * The chronicle of a run (DESIGN §22.3): one sample of the village's numbers
 * a day, and the notable events picked out of the log, so a player coming
 * back after hours away can see what happened and when.
 */
import type { Colony } from './colony';
import { alive, communityMorale, type LogEntry } from './community';

export interface Sample {
  day: number;
  alive: number; morale: number; food: number; wood: number; scrap: number;
  homes: number; tier: number; tools: number; clothes: number; rare: number;
  folkStanding: number; folkLevel: number; cleared: number; influence: number;
}
export type EventKind = 'people' | 'building' | 'council' | 'veil' | 'milestone' | 'hardship';
export interface ChronicleEvent { day: number; kind: EventKind; text: string; tone: LogEntry['tone'] }
export interface Chronicle { samples: Sample[]; events: ChronicleEvent[]; seen: number }

export const createChronicle = (): Chronicle => ({ samples: [], events: [], seen: 0 });

/** What counts as notable, by what the log says. First match wins. */
const KINDS: [EventKind, RegExp][] = [
  ['hardship', /bitter night|slept out in the snow|stores are nearly bare|half rations|packed a bag|was given up|is gone \(/],
  ['people', /asked to stay|walked out of the green|has found someone to make a home with|did not come back|asked what day it was|walked back into the village|got up without waking/],
  ['council', /The council backed|settled it without you|Everyone woke having dreamt/],
  ['veil', /sat in the middle of the Choir|came back from .* quiet there now|Autopilot sent a team|was left to the Folk|has come to live at|The hill is growing|finished a .* in the Wild|The village danced at the Ring/],
  ['milestone', /Tools on the hooks|The village is thriving|can square timber|The first tools|cut a coat|first fish and roots|You can't get that from a junk heap|lights in its windows again|has the knack of joinery/],
  ['building', /(?<!until it) finished\.$|pegged out|walked the plot you pegged out|will keep a .* at the back of their yard|glasshouse on its sunny side/],
];

export function classify(text: string): EventKind | null {
  for (const [k, re] of KINDS) if (re.test(text)) return k;
  return null;
}

/** Once a day: take a sample, and read the new log lines for events. */
export function chronicleDaily(col: Colony) {
  const ch = (col.chronicle ??= createChronicle());
  const c = col.community, r = c.resources, v = col.village;
  ch.samples.push({
    day: c.day, alive: alive(c).length, morale: communityMorale(c), food: r.food + r.preserves, wood: r.wood, scrap: r.scrap,
    homes: v.buildings.filter((b) => b.kind === 'home').length, tier: v.needTier ?? 0, tools: r.tools, clothes: r.clothes,
    rare: r.glass + r.copper + r.steel, folkStanding: col.folk.standing, folkLevel: col.folk.level,
    cleared: col.haunts.filter((h) => h.state === 'cleared').length, influence: col.veil.influence,
  });
  // Ten years of days is 320 samples: keep them all, but never unbounded.
  if (ch.samples.length > 2000) ch.samples.splice(0, ch.samples.length - 2000);
  const total = c.logCount ?? 0;
  const fresh = Math.min(total - ch.seen, c.log.length);
  for (const e of c.log.slice(c.log.length - fresh)) {
    const kind = classify(e.text);
    if (kind) ch.events.push({ day: e.day, kind, text: e.text, tone: e.tone });
  }
  ch.seen = total;
  if (ch.events.length > 1500) ch.events.splice(0, ch.events.length - 1500);
}
