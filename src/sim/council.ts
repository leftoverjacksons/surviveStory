/**
 * The village council, and the player's nudges.
 *
 * Every few days the council meets. Two or three survivors each put forward
 * something they want, and others line up behind them. The player backs one
 * (optionally sending a dream so the others don't feel passed over). Ignored,
 * the council settles it by itself after a day.
 */
import type { Colony } from './colony';
import { adjustBond, alive, bondValue, log, type Survivor } from './community';
import { dayOfSeason, seasonOf } from './calendar';
import { bedsTotal, hasBuilt, sharedBeds, storageCapacity, store, type SiteKind } from './buildings';
import { householdName, householdOf, waitingHouseholds } from './homes';
import type { Rng } from './rng';
import { communitySight, homeResonance, lanternGift, nurture, type EntityRequest } from './veil';
import { Zone, idx, paintZone, reveal, toTileX, toTileZ, type Point } from './world';
import { WILD_RADIUS, changeStanding, landWanted } from './folk';

export type ProposalKind =
  | 'build' | 'festival' | 'wild_ring' | 'rest_day' | 'open_gates' | 'close_gates' | 'offering' | 'grove' | 'home' | 'commons'
  | 'folk_festival' | 'folk_land' | 'folk_amends';

export interface Proposal {
  id: number;
  kind: ProposalKind;
  build?: SiteKind;
  title: string;
  pitch: string;
  proposer: number;
  support: number[];
  cost: { food?: number; wood?: number; glimmer?: number };
  request?: EntityRequest;
  /** Home petitions: the household asking. */
  household?: number;
}

export interface Council {
  active: { proposals: Proposal[]; deadline: number } | null;
  nextDay: number;
  nextId: number;
  gates: 'normal' | 'open' | 'closed';
  gatesUntil: number;
  restUntil: number;
  festivalUntil: number;
  /** A place the player marked with an omen, for scouts to seek. */
  omen: Point | null;
}

export const DREAM_COST = 15;
export const CALM_COST = 10;
export const OMEN_COST = 12;

export function createCouncil(): Council {
  return {
    active: null, nextDay: 3, nextId: 1, gates: 'normal', gatesUntil: 0, restUntil: 0, festivalUntil: 0, omen: null,
  };
}

const first = (s: Survivor) => s.name.split(' ')[0];
/** Proposal titles inside a sentence: lower-case the first word, keep names. */
const inline = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const has = (s: Survivor, t: string) => s.traits.includes(t as never);

const FESTIVALS: Record<string, [string, string]> = {
  spring: ['the Thaw Walk', 'Let\'s walk the bounds together and see what woke up.'],
  summer: ['a Midsummer fire', 'Long evening, big fire. We\'ve earned one night.'],
  autumn: ['a Harvest supper', 'Before we lock it all away, let\'s eat like people again.'],
  winter: ['a Midwinter vigil', 'The Veil\'s thin tonight. Let\'s keep the lanterns lit and remember.'],
};

interface Candidate { score: number; make: () => Omit<Proposal, 'id' | 'support'> }

/** Pick who speaks for a proposal: the best fit who hasn't already spoken. */
function voice(living: Survivor[], fit: (s: Survivor) => number, rng: Rng, taken: Set<number>): Survivor {
  const pool = living.filter((s) => !taken.has(s.id));
  let best = pool[0] ?? living[0], bestScore = -Infinity;
  for (const s of pool) {
    const sc = fit(s) + rng.next() * 0.5;
    if (sc > bestScore) { best = s; bestScore = sc; }
  }
  return best;
}

function candidates(col: Colony, rng: Rng, taken: Set<number>): Candidate[] {
  const c = col.community, v = col.village, r = c.resources;
  const living = alive(c);
  const pop = living.length;
  const day = c.day;
  const season = seasonOf(day);
  const out: Candidate[] = [];
  const buildCand = (kind: SiteKind, score: number, title: string, pitch: string, fit: (s: Survivor) => number) => {
    if (col.village.projects.some((p) => !p.done && p.kind === kind)) return;
    out.push({ score, make: () => ({ kind: 'build', build: kind, title, pitch, proposer: voice(living, fit, rng, taken).id, cost: {} }) });
  };

  if (season === 'summer' || season === 'autumn') {
    const tight = r.food > storageCapacity(v) * 0.6;
    buildCand('cellar', tight ? 2 : 0.8, 'Dig a root cellar',
      'Before the frost, we need somewhere cold to keep the harvest.',
      (s) => (s.role === 'farmer' ? 1 : 0) + (has(s, 'hoarder') ? 1 : 0));
  }
  const waiting = waitingHouseholds(v);
  if (bedsTotal(v) < pop + 1 && !waiting.length) {
    buildCand('hut', 1.8, 'Raise a bunkhouse', 'People are sleeping close enough to kick each other.',
      (s) => (s.role === 'builder' ? 1 : 0) + (col.beds.has(s.id) ? 0 : 1));
  }
  // Households without a home petition for one (not those already approved).
  if (store(v).level >= 1) {
    for (const h of waiting) {
      if (v.homeQueue.includes(h.id) || day - h.since < 1) continue;
      const speaker = living.filter((s) => h.members.includes(s.id) && !taken.has(s.id))
        .sort((a, b) => b.stats.empathy - a.stats.empathy)[0];
      if (!speaker) continue;
      const others = h.members.filter((m) => m !== speaker.id).map((m) => first(living.find((s) => s.id === m)!));
      const waited = day - h.since;
      const pitch = others.length
        ? `${others.join(' and ')} and I would like a place of our own. A house, a bit of ground behind it. We'll do most of the work.`
        : 'I\'d like a small place of my own. I don\'t need much. A door I can close.';
      out.push({
        score: 1.5 + Math.min(1.2, waited * 0.12) + h.members.length * 0.15,
        make: () => ({
          kind: 'home', household: h.id, title: `A home for ${householdName(c, h)}`, pitch, proposer: speaker.id, cost: {},
        }),
      });
    }
  }
  // Once most people have homes, the old shelter can become something shared.
  const st = store(v);
  const housed = living.filter((s) => householdOf(v, s.id)?.home).length;
  const unhoused = pop - housed;
  if (st.level === 2 && housed / pop >= 0.5 && sharedBeds(v) - (st.beds - 2) >= unhoused) {
    out.push({
      score: 2,
      make: () => ({
        kind: 'commons', title: `Turn ${v.site.shelterName} into ${v.site.hallName}`, cost: { wood: 8 },
        pitch: `Hardly anyone sleeps in ${v.site.shelterName} now. Let's put a long table in it, and a stove, and eat together on cold nights.`,
        proposer: voice(living, (s) => (has(s, 'storyteller') ? 2 : 0) + s.stats.empathy / 5 + (s.role === 'tender' ? 1 : 0), rng, taken).id,
      }),
    });
  }
  if (!hasBuilt(v, 'shrine')) {
    const hr = homeResonance(col);
    buildCand('shrine', hr < 0.45 ? 2 : 1, 'Build a shrine',
      hr < 0.45 ? 'The land around camp feels tired. Give it somewhere to rest.' : 'Somewhere to leave things for the ones we can\'t see.',
      (s) => s.sight / 30 + (s.role === 'attune' ? 1 : 0));
  }
  if (r.glimmer >= 8 && v.buildings.filter((b) => b.kind === 'lantern').length < 6) {
    buildCand('lantern', 0.9, 'Put up another solar lantern', 'The dark between the houses is too deep.',
      (s) => (s.role === 'attune' ? 1 : 0) + (has(s, 'skittish') ? 1 : 0));
  }
  if (!hasBuilt(v, 'workshop')) {
    buildCand('workshop', 1.2, 'Set up a workbench', 'Give me a bench and a vice and I\'ll build you anything.',
      (s) => (has(s, 'tinkerer') ? 2 : 0) + (s.role === 'builder' ? 0.5 : 0));
  }
  if (r.food >= 25 && r.wood >= 15 && col.minute > col.council.festivalUntil + 1440 * 6) {
    const [name, pitch] = FESTIVALS[season];
    const low = living.reduce((n, s) => n + s.morale, 0) / pop < 60;
    out.push({
      score: (low ? 1.8 : 1) + (dayOfSeason(day) > 5 ? 0.3 : 0),
      make: () => ({
        kind: 'festival', title: `Hold ${name}`, pitch, cost: { food: 15, wood: 10 },
        proposer: voice(living, (s) => (has(s, 'storyteller') ? 2 : 0) + (s.role === 'tender' ? 1 : 0) + s.stats.empathy / 5, rng, taken).id,
      }),
    });
  }
  // The Folk send word: through whoever sees them best.
  const f = col.folk, hill = col.world.folk.mound.name;
  const folkVoice = () => voice(living, (s) => s.sight / 20 + (s.role === 'attune' ? 1 : 0), rng, taken).id;
  if (f.met && f.standing >= 35 && r.food >= 20 && r.wood >= 8 && col.minute > col.council.festivalUntil + 1440 * 8) {
    out.push({
      score: 1.1,
      make: () => ({
        kind: 'folk_festival', title: `Hold a festival with the Folk of ${hill}`, cost: { food: 12, wood: 6 },
        pitch: 'They dance at the Ring when the moon\'s up. Let\'s bring the food and the fiddle and dance with them, for once.',
        proposer: folkVoice(),
      }),
    });
  }
  if (f.met && f.standing >= 40 && f.land < landWanted(f)) {
    out.push({
      score: 1.0,
      make: () => ({
        kind: 'folk_land', title: 'Give the Folk more of the woods by their hill', cost: {},
        pitch: `${f.beings.find((b) => b.known)?.name ?? 'One of them'} asked me for room. Their hill wants to grow, and it can't without the land.`,
        proposer: folkVoice(),
      }),
    });
  }
  if (f.met && f.standing < 25) {
    out.push({
      score: 1.6,
      make: () => ({
        kind: 'folk_amends', title: `Make amends with ${hill}`, cost: { food: 8, glimmer: 3 },
        pitch: 'We\'ve wronged them, and they\'re letting us know it. Bread and glimmer at the door, and say sorry properly.',
        proposer: folkVoice(),
      }),
    });
  }
  const ringTile = idx(col.world, toTileX(col.world, col.world.fairyRing.x), toTileZ(col.world, col.world.fairyRing.z));
  if (col.world.zone[ringTile] !== Zone.Sacred) {
    out.push({
      score: communitySight(col) > 20 ? 1.4 : 0.7,
      make: () => ({
        kind: 'wild_ring', title: 'Let the Ring grow wild', pitch: 'Nobody cuts, nobody builds near the Ring. Let it be.', cost: {},
        proposer: voice(living, (s) => s.sight / 25, rng, taken).id,
      }),
    });
  }
  const avgMorale = living.reduce((n, s) => n + s.morale, 0) / pop;
  if (avgMorale < 55 || living.some((s) => s.griefDays > 0)) {
    out.push({
      score: 1.5,
      make: () => ({
        kind: 'rest_day', title: 'Take a day of rest', pitch: 'One day. No axes, no hauling. Just sit with each other.', cost: {},
        proposer: voice(living, (s) => (s.role === 'tender' ? 1 : 0) + s.stats.empathy / 4, rng, taken).id,
      }),
    });
  }
  if (pop < 12 && bedsTotal(v) >= pop + 2 && col.council.gates !== 'open') {
    out.push({
      score: 1,
      make: () => ({
        kind: 'open_gates', title: 'Take in anyone who comes', pitch: 'There are people out there. Let\'s make it known we\'ll take them in.', cost: {},
        proposer: voice(living, (s) => s.stats.empathy / 4 + (has(s, 'tender') ? 1 : 0), rng, taken).id,
      }),
    });
  }
  if (r.food < pop * 6 && (season === 'autumn' || season === 'winter') && col.council.gates !== 'closed') {
    out.push({
      score: 1.3,
      make: () => ({
        kind: 'close_gates', title: 'No newcomers until spring', pitch: 'We can barely feed who we have. No more mouths until the thaw.', cost: {},
        proposer: voice(living, (s) => (has(s, 'hoarder') ? 2 : 0) + (has(s, 'stoic') ? 1 : 0), rng, taken).id,
      }),
    });
  }
  for (const req of col.veil.requests) {
    const by = living.find((s) => s.id === req.by);
    if (!by) continue;
    if (req.kind === 'offering' && r.glimmer >= 6) {
      out.push({
        score: 2.2,
        make: () => ({
          kind: 'offering', title: 'Leave glimmer for the Lantern Man', request: req, cost: { glimmer: 6 },
          pitch: 'He asked for a little glimmer. He showed me the way. I think we owe him.', proposer: by.id,
        }),
      });
    } else if (req.kind === 'grove') {
      out.push({
        score: 2.2,
        make: () => ({
          kind: 'grove', title: 'Keep the Moth Woman\'s grove', request: req, cost: {},
          pitch: 'She asked us to keep her grove unbroken. I said we would.', proposer: by.id,
        }),
      });
    }
  }
  return out;
}

function affinity(col: Colony, s: Survivor, p: Omit<Proposal, 'id' | 'support'>): number {
  switch (p.kind) {
    case 'home': {
      const h = col.village.households.find((x) => x.id === p.household);
      if (h?.members.includes(s.id)) return 1;
      const mine = householdOf(col.village, s.id);
      // Others waiting would rather their own petition went first; the settled are glad to help.
      return (mine && !mine.home ? -0.2 : 0.15) + (s.role === 'builder' ? 0.1 : 0);
    }
    case 'commons': return (has(s, 'storyteller') ? 0.3 : 0) + (householdOf(col.village, s.id)?.home ? 0.2 : -0.3);
    case 'build':
      if (p.build === 'cellar') return (s.role === 'farmer' ? 0.3 : 0) + (has(s, 'hoarder') ? 0.3 : 0);
      if (p.build === 'hut') return (col.beds.has(s.id) ? 0 : 0.5) + (s.role === 'builder' ? 0.1 : 0);
      if (p.build === 'shrine' || p.build === 'lantern') return s.sight / 100 + (has(s, 'skittish') ? 0.2 : 0);
      return s.role === 'builder' ? 0.2 : 0;
    case 'festival': return (has(s, 'storyteller') ? 0.3 : 0) + (s.morale < 55 ? 0.3 : 0.1);
    case 'rest_day': return s.morale < 55 ? 0.5 : s.role === 'builder' ? -0.2 : 0.05;
    case 'wild_ring': case 'grove': case 'offering': return s.sight / 80 - (has(s, 'stoic') ? 0.2 : 0);
    case 'open_gates': return s.stats.empathy / 20 - (has(s, 'hoarder') ? 0.3 : 0);
    case 'close_gates': return (has(s, 'hoarder') ? 0.4 : 0) - s.stats.empathy / 25;
    case 'folk_festival': return s.sight / 90 + (has(s, 'storyteller') ? 0.2 : 0) - (has(s, 'skittish') ? 0.2 : 0);
    case 'folk_land': return s.sight / 100 - (s.role === 'builder' ? 0.15 : 0);
    case 'folk_amends': return s.sight / 100 + (has(s, 'tender') ? 0.2 : 0) - (has(s, 'hoarder') ? 0.2 : 0);
  }
}

/** Convene the council if it is due. Called each morning. */
export function maybeConvene(col: Colony, rng: Rng) {
  const c = col.community;
  const council = col.council;
  if (council.active || c.day < council.nextDay) return;
  const living = alive(c);
  if (living.length < 3) return;
  const speakers = new Set<number>();
  const cands = candidates(col, rng, speakers).sort((a, b) => b.score + rng.next() * 0.6 - (a.score + rng.next() * 0.6));
  const picked: Proposal[] = [];
  const kinds = new Set<string>();
  for (const cand of cands) {
    if (picked.length >= 3) break;
    const p = cand.make();
    const key = p.kind === 'build' ? `build:${p.build}` : p.kind === 'home' ? `home:${p.household}` : p.kind;
    if (kinds.has(key) || speakers.has(p.proposer)) continue;
    if (p.kind === 'home' && picked.filter((x) => x.kind === 'home').length >= 2) continue;
    kinds.add(key);
    speakers.add(p.proposer);
    picked.push({ ...p, id: council.nextId++, support: [] });
  }
  if (picked.length < 2) { council.nextDay = c.day + 1; return; }
  // Everyone lines up behind one voice: their own, or the one they like best.
  for (const s of living) {
    const own = picked.find((p) => p.proposer === s.id);
    if (own) { own.support.push(s.id); continue; }
    let best = picked[0], bestScore = -Infinity;
    for (const p of picked) {
      const sc = bondValue(c, s.id, p.proposer) / 100 + affinity(col, s, p) + rng.range(-0.25, 0.25);
      if (sc > bestScore) { best = p; bestScore = sc; }
    }
    best.support.push(s.id);
  }
  council.active = { proposals: picked, deadline: col.minute + 1440 };
  const names = picked.map((p) => first(c.survivors.find((s) => s.id === p.proposer)!));
  log(c, `The council met by the fire. ${names.join(', ')} each spoke for something.`, 'info');
}

/** Resolve the open council. `choice` is a proposal id; `dream` spends Influence to soften it. */
export function resolveCouncil(col: Colony, choice: number, dream = false, auto = false): boolean {
  const council = col.council;
  const c = col.community;
  if (!council.active) return false;
  const chosen = council.active.proposals.find((p) => p.id === choice);
  if (!chosen) return false;
  const r = c.resources;
  if ((chosen.cost.food ?? 0) > r.food || (chosen.cost.wood ?? 0) > r.wood || (chosen.cost.glimmer ?? 0) > r.glimmer) return false;
  if (dream && col.veil.influence < DREAM_COST) dream = false;
  if (dream) col.veil.influence -= DREAM_COST;
  r.food -= chosen.cost.food ?? 0;
  r.wood -= chosen.cost.wood ?? 0;
  r.glimmer -= chosen.cost.glimmer ?? 0;

  const who = (id: number) => c.survivors.find((s) => s.id === id)!;
  const bump = (s: Survivor, m: number) => { s.morale = Math.max(0, Math.min(100, s.morale + m)); };
  for (const id of chosen.support) bump(who(id), 3);
  const passed = council.active.proposals.filter((p) => p !== chosen);
  for (const p of passed) {
    bump(who(p.proposer), dream ? 1 : -4);
    for (const id of p.support) if (id !== p.proposer && !chosen.support.includes(id)) bump(who(id), dream ? 0 : -1);
  }
  applyProposal(col, chosen);
  const proposer = first(who(chosen.proposer));
  if (auto) log(c, `The council settled it without you: ${proposer}'s "${inline(chosen.title)}".`, 'info');
  else if (dream) log(c, `Everyone woke having dreamt the same thing. The council backed ${proposer}: ${inline(chosen.title)}.`, 'strange');
  else {
    const hurt = passed.map((p) => first(who(p.proposer)));
    log(c, `The council backed ${proposer}: ${inline(chosen.title)}.${hurt.length ? ` ${hurt.join(' and ')} took it quietly.` : ''}`, 'good');
  }
  council.active = null;
  council.nextDay = c.day + 4;
  return true;
}

function applyProposal(col: Colony, p: Proposal) {
  const c = col.community, w = col.world;
  const living = alive(c);
  switch (p.kind) {
    case 'build':
      col.village.priority = p.build;
      break;
    case 'festival':
      col.council.festivalUntil = col.minute + 1440;
      for (const s of living) s.morale = Math.min(100, s.morale + 8);
      for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) adjustBond(c, living[i].id, living[j].id, 2);
      nurture(col, w.home.x, w.home.z, 0.08, 3);
      break;
    case 'wild_ring':
      paintZone(w, w.fairyRing.x, w.fairyRing.z, 5, Zone.Sacred);
      break;
    case 'folk_festival': {
      col.council.festivalUntil = col.minute + 1440;
      for (const s of living) s.morale = Math.min(100, s.morale + 6);
      for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) adjustBond(c, living[i].id, living[j].id, 1);
      changeStanding(col, 8);
      nurture(col, w.folk.mound.x, w.folk.mound.z, 0.1, 3);
      const stranger = col.folk.beings.find((b) => !b.known);
      if (stranger) stranger.known = true;
      log(c, `The village danced at the Ring with the Folk of ${w.folk.mound.name} until the stars went pale.${stranger ? ` ${stranger.name} danced with everyone, and told them their name.` : ''}`, 'strange');
      break;
    }
    case 'folk_land': {
      const m = w.folk.mound;
      paintZone(w, m.x, m.z, WILD_RADIUS + 2 + col.folk.level * 1.2, Zone.Wild);
      changeStanding(col, 4);
      log(c, `The village walked the bounds around ${m.name} and left more of the woods to the Folk. That night the hill hummed.`, 'good');
      break;
    }
    case 'folk_amends':
      changeStanding(col, 12);
      col.folk.offendedUntil = 0;
      log(c, `Bread, glimmer and an apology were left at the door in ${w.folk.mound.name}. In the morning the bowl had been washed and left on the step.`, 'good');
      break;
    case 'rest_day':
      col.council.restUntil = col.minute + 1440;
      for (const s of living) { s.morale = Math.min(100, s.morale + 6); s.griefDays = Math.max(0, s.griefDays - 1); }
      break;
    case 'open_gates':
      col.council.gates = 'open';
      col.council.gatesUntil = c.day + 12;
      break;
    case 'close_gates':
      col.council.gates = 'closed';
      col.council.gatesUntil = c.day + 12;
      break;
    case 'offering': {
      nurture(col, w.fairyRing.x, w.fairyRing.z, 0.12, 3);
      nurture(col, w.home.x, w.home.z, 0.06, 3);
      const s = living.find((x) => x.id === p.proposer);
      if (s) s.sight = Math.min(100, s.sight + 8);
      if (p.request) lanternGift(col, p.request);
      col.veil.requests = col.veil.requests.filter((q) => q !== p.request);
      break;
    }
    case 'grove':
      if (p.request) paintZone(w, p.request.x, p.request.z, 4.5, Zone.Sacred);
      col.veil.requests = col.veil.requests.filter((q) => q !== p.request);
      col.veil.mothBlessing = c.day + 24;
      log(c, 'That night the moths came into the village in thousands, and settled on the gardens, and left before dawn. Everything growing seems to stand a little taller.', 'strange');
      break;
    case 'home':
      if (p.household && !col.village.homeQueue.includes(p.household)) col.village.homeQueue.push(p.household);
      break;
    case 'commons': {
      const st = store(col.village);
      st.level = 3;
      st.beds = 2;
      st.name = col.village.site.hallName;
      col.village.bedsDirty = true;
      log(c, `The cots came out of ${col.village.site.shelterName} and a long table went in. ${col.village.site.hallName.charAt(0).toUpperCase() + col.village.site.hallName.slice(1)}: supper on cold nights, and a place to talk.`, 'good');
      for (const s of living) s.morale = Math.min(100, s.morale + 4);
      break;
    }
  }
}

/** Called daily: settle a council the player left alone, and expire policies. */
export function councilDaily(col: Colony) {
  const council = col.council;
  if (council.active && col.minute >= council.active.deadline) {
    const affordable = council.active.proposals.filter((p) => resolvable(col, p));
    const top = (affordable.length ? affordable : council.active.proposals).sort((a, b) => b.support.length - a.support.length)[0];
    if (!resolveCouncil(col, top.id, false, true)) { council.active = null; council.nextDay = col.community.day + 4; }
  }
  if (council.gates !== 'normal' && col.community.day >= council.gatesUntil) council.gates = 'normal';
  // Stale requests fade.
  if (col.veil.requests.length > 3) col.veil.requests.splice(0, col.veil.requests.length - 3);
}

export function resolvable(col: Colony, p: Proposal): boolean {
  const r = col.community.resources;
  return (p.cost.food ?? 0) <= r.food && (p.cost.wood ?? 0) <= r.wood && (p.cost.glimmer ?? 0) <= r.glimmer;
}

// ---------- nudges ----------

/** Quiet a troubled mind. The survivor wakes calmer and can't say why. */
export function nudgeCalm(col: Colony, survivorId: number): boolean {
  const s = alive(col.community).find((x) => x.id === survivorId);
  if (!s || col.veil.influence < CALM_COST) return false;
  col.veil.influence -= CALM_COST;
  s.griefDays = 0;
  s.morale = Math.min(100, s.morale + 15);
  const sensed = s.sight > 40 ? ' They say someone sat with them in the night.' : '';
  log(col.community, `${first(s)} felt a strange calm settle over them.${sensed}`, 'strange');
  return true;
}

/** Light a way through the mist: reveals a patch and draws the scouts there. */
export function nudgeOmen(col: Colony, x: number, z: number): boolean {
  if (col.veil.influence < OMEN_COST) return false;
  col.veil.influence -= OMEN_COST;
  reveal(col.world, x, z, 6);
  col.council.omen = { x, z };
  // Someone lost to the Folk: the light shows the searchers exactly where.
  const led = col.folk.led;
  if (led && Math.hypot(led.x - x, led.z - z) < 16) {
    led.hint = { x: led.x, z: led.z, r: 1.5 };
    log(col.community, 'A light hung over the trees all morning, just where the searchers had not yet looked.', 'strange');
    return true;
  }
  const scout = alive(col.community).find((s) => s.role === 'scout') ?? alive(col.community)[0];
  if (scout) log(col.community, `${first(scout)} dreamt of a light out in the mist, and means to go and find it.`, 'strange');
  return true;
}
