/**
 * Councils that matter (DESIGN §23.5). The council convenes when there is a
 * real question, each answer spelled out with what it will do, and the ones
 * that last are kept as commitments the player can see:
 * - strangers at the gate: take them all in, take one, or send them on;
 * - the Folk ask for land: give it, offer the far side, or refuse;
 * - winter won't add up: all hands to the woodpile, ration now, or trust to luck;
 * - a quarrel: side with one, side with the other, or mend it over a meal.
 */
import type { Colony } from './colony';
import { welcome, fireWood } from './colony';
import { adjustBond, alive, bondValue, log, type Survivor } from './community';
import { DAYS_PER_SEASON, dayOfSeason, seasonOf } from './calendar';
import { bedsTotal } from './buildings';
import { WILD_RADIUS, changeStanding, landWanted } from './folk';
import { Zone, paintZone } from './world';
import type { Rng } from './rng';
import { FESTIVALS, type Proposal, type ProposalKind } from './council';

export type DilemmaKind = 'strangers' | 'folk_land' | 'winter' | 'quarrel' | 'celebrate';
export type CommitKind = 'ration' | 'all_hands';

export interface Question { kind: DilemmaKind; title: string; text: string }
export interface Commitment { kind: CommitKind; title: string; effect: string; until: number }

type Option = Omit<Proposal, 'id' | 'support'>;
const first = (s: Survivor) => s.name.split(' ')[0];

/** Is this commitment in force? */
export function committed(col: Colony, kind: CommitKind): boolean {
  return (col.council.commitments ?? []).some((k) => k.kind === kind && k.until > col.minute);
}

function commit(col: Colony, kind: CommitKind, title: string, effect: string, days: number) {
  const list = (col.council.commitments ??= []).filter((k) => k.until > col.minute && k.kind !== kind);
  list.push({ kind, title, effect, until: col.minute + days * 1440 });
  col.council.commitments = list;
}

/** A voice for an answer: whoever fits it best, and hasn't spoken yet. */
function speaker(col: Colony, fit: (s: Survivor) => number, taken: Set<number>, rng: Rng): Survivor {
  const pool = alive(col.community).filter((s) => !taken.has(s.id));
  const s = [...pool].sort((a, b) => fit(b) + rng.next() * 0.3 - (fit(a) + rng.next() * 0.3))[0] ?? alive(col.community)[0];
  taken.add(s.id);
  return s;
}
const has = (s: Survivor, t: string) => s.traits.includes(t as never);

/** The question the village faces now, if any (most pressing first), with its answers. */
export function dilemmaDue(col: Colony, rng: Rng): { question: Question; options: Option[] } | null {
  const c = col.community, council = col.council, f = col.folk;
  const asked = (council.asked ??= {});
  const day = c.day, pop = alive(c).length;
  const taken = new Set<number>();
  const since = (k: string) => day - (asked[k] ?? -99);

  // Winter won't add up (early autumn, once a year).
  if (seasonOf(day) === 'autumn' && dayOfSeason(day) <= 3 && since('winter') > DAYS_PER_SEASON * 2) {
    const woodNeed = Math.round(fireWood(col, 'winter') * DAYS_PER_SEASON);
    const foodNeed = Math.round(pop * 1.8 * DAYS_PER_SEASON);
    const wood = Math.floor(c.resources.wood), food = Math.floor(c.resources.food + c.resources.preserves);
    if (wood < woodNeed * 0.9 || food < foodNeed * 0.9) {
      asked.winter = day;
      const short = [wood < woodNeed * 0.9 ? `${wood} wood of about ${woodNeed}` : '', food < foodNeed * 0.9 ? `${food} food of about ${foodNeed}` : ''].filter(Boolean).join(', and ');
      return {
        question: { kind: 'winter', title: 'Winter won\'t add up', text: `Winter is ${DAYS_PER_SEASON * 1 + 1 - dayOfSeason(day)} days off. We have ${short} for it.` },
        options: [
          { kind: 'all_hands', title: 'All hands to the woodpile and the hedges', cost: {}, effect: 'For 4 days building stops: everyone cuts wood and forages.',
            pitch: 'Put the hammers down. Four days of cutting and picking and we\'ll see the spring.', proposer: speaker(col, (s) => (s.role === 'forager' || s.role === 'farmer' ? 1 : 0) + s.stats.grit / 10, taken, rng).id },
          { kind: 'ration', title: 'Go on half rations now', cost: {}, effect: 'For 8 days everyone eats half: the food lasts, but nobody is happy about it.',
            pitch: 'Tighten our belts now, while it\'s a choice and not a need.', proposer: speaker(col, (s) => (has(s, 'hoarder') ? 2 : 0) + (has(s, 'stoic') ? 1 : 0), taken, rng).id },
          { kind: 'trust', title: 'Carry on, and trust to luck', cost: {}, effect: 'Nothing changes. If it runs short in the snow, it runs short.',
            pitch: 'We always find a way. Let\'s not make the autumn miserable over a maybe.', proposer: speaker(col, (s) => (has(s, 'brave') ? 1.5 : 0) + s.morale / 50, taken, rng).id },
        ],
      };
    }
  }

  // Strangers at the gate (they arrive through arrivals(), colony.ts).
  const st = council.strangers;
  if (st) {
    council.strangers = undefined;
    asked.strangers = day;
    const beds = bedsTotal(col.village);
    return {
      question: { kind: 'strangers', title: `${st.n === 2 ? 'Two' : 'Three'} strangers at the gate`, text: `They came up the highway at dusk and asked to stay. There are ${beds} beds for ${pop} of us.` },
      options: [
        { kind: 'take_all', title: 'Take them all in', cost: {}, effect: `${st.n} more people: more hands, more mouths${beds < pop + st.n ? ', and not enough beds yet' : ''}.`, about: [st.n],
          pitch: 'Look at them. Nobody walks this far for nothing. There\'s room at the fire.', proposer: speaker(col, (s) => s.stats.empathy / 5 + (has(s, 'tender') ? 1.5 : 0), taken, rng).id },
        { kind: 'take_one', title: 'Take the one who can build', cost: {}, effect: 'One more pair of hands; the others walk on.', about: [1],
          pitch: 'One of them has built before. We can feed one more, not three.', proposer: speaker(col, (s) => (s.role === 'builder' ? 1.5 : 0) + s.stats.wits / 10, taken, rng).id },
        { kind: 'send_on', title: 'Send them on with food for the road', cost: { food: 8 * st.n }, effect: `${8 * st.n} food; nobody joins, and everyone feels decent about it.`,
          pitch: 'We give them a good meal and bread for the road. That\'s kind enough.', proposer: speaker(col, (s) => (has(s, 'hoarder') ? 2 : 0) + (has(s, 'skittish') ? 1 : 0), taken, rng).id },
      ],
    };
  }

  // Too long without a celebration (the Thriving need wants one every two seasons).
  const sinceFeast = (col.minute - council.festivalUntil) / 1440;
  if (day >= DAYS_PER_SEASON * 2 && sinceFeast >= DAYS_PER_SEASON * 1.5 && since('celebrate') >= 4 && c.resources.food >= 25 && c.resources.wood >= 15) {
    asked.celebrate = day;
    const [name, pitch] = FESTIVALS[seasonOf(day)];
    const opts: Option[] = [
      { kind: 'festival', title: `Hold ${name}`, cost: { food: 15, wood: 10 }, effect: '15 food and 10 wood; everyone\'s spirits and bonds lift, and the land around the village with them.',
        pitch, proposer: speaker(col, (s) => (has(s, 'storyteller') ? 2 : 0) + (s.role === 'tender' ? 1 : 0) + s.stats.empathy / 5, taken, rng).id },
    ];
    if (f.met && f.standing >= 35) opts.push({ kind: 'folk_festival', title: `Dance at the Ring with the Folk of ${col.world.folk.mound.name}`, cost: { food: 12, wood: 6 },
      effect: '12 food and 6 wood; spirits lift a little less, but the Folk are much warmer to us.',
      pitch: 'They dance at the Ring when the moon\'s up. Let\'s bring the food and the fiddle and dance with them, for once.', proposer: speaker(col, (s) => s.sight / 20 + (s.role === 'attune' ? 1 : 0), taken, rng).id });
    opts.push({ kind: 'not_now', title: 'Not now: there\'s too much to do', cost: {}, effect: 'The stores are spared; nobody celebrates, and it shows.',
      pitch: 'We can dance when the work\'s done. It never is, but still.', proposer: speaker(col, (s) => (has(s, 'hoarder') ? 1.5 : 0) + (s.role === 'builder' ? 1 : 0), taken, rng).id });
    return { question: { kind: 'celebrate', title: 'It has been a long while since anyone celebrated', text: `The last festival was ${Math.round(sinceFeast)} days ago.` }, options: opts };
  }

  // The Folk ask for land.
  if (f.met && f.standing >= 30 && f.land < landWanted(f) && since('folk_land') >= DAYS_PER_SEASON) {
    asked.folk_land = day;
    const hill = col.world.folk.mound.name;
    const who = f.beings.find((b) => b.known)?.name ?? 'One of them';
    return {
      question: { kind: 'folk_land', title: `${hill} wants to grow`, text: `${who} came to the edge of the woods and asked for room. Their hill can't grow without land.` },
      options: [
        { kind: 'folk_land', title: 'Give them the woods around the hill', cost: {}, effect: 'The Wild spreads all round the hill (nobody cuts or builds there); the Folk are much warmer to us.',
          pitch: 'They asked nicely. It\'s their woods more than ours anyway.', proposer: speaker(col, (s) => s.sight / 20 + (s.role === 'attune' ? 1 : 0), taken, rng).id },
        { kind: 'land_elsewhere', title: 'Offer them the far side of the hill', cost: {}, effect: 'The Wild grows away from the village, not toward it; the Folk are a little warmer.',
          pitch: 'Give them room, but on the far side. We\'ll need this side for houses.', proposer: speaker(col, (s) => (s.role === 'builder' ? 1 : 0) + s.stats.wits / 10, taken, rng).id },
        { kind: 'land_refuse', title: 'Keep the woods for the village', cost: {}, effect: 'The woods stay ours to cut; the Folk will be cooler with us, and their hill won\'t grow.',
          pitch: 'We need the timber. They\'ll have to make do.', proposer: speaker(col, (s) => (has(s, 'hoarder') ? 1.5 : 0) + (s.role === 'builder' ? 1 : 0) - s.sight / 40, taken, rng).id },
      ],
    };
  }

  // A quarrel that won't settle.
  if (since('quarrel') >= 6) {
    const living = alive(c);
    let pair: [Survivor, Survivor] | null = null, worst = -45;
    for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) {
      const b = bondValue(c, living[i].id, living[j].id);
      if (b <= worst) { worst = b; pair = [living[i], living[j]]; }
    }
    if (pair) {
      asked.quarrel = day;
      const [a, b] = pair;
      taken.add(a.id); taken.add(b.id);
      return {
        question: { kind: 'quarrel', title: `${first(a)} and ${first(b)} can't be in a room together`, text: 'It has gone past sharp words. Everyone is being asked to take a side.' },
        options: [
          { kind: 'side_a', title: `Side with ${first(a)}`, cost: {}, effect: `${first(a)} feels backed; ${first(b)} feels shut out, and those close to them notice.`, about: [a.id, b.id],
            pitch: 'I\'ve kept my temper longer than anyone would. Ask anyone.', proposer: a.id },
          { kind: 'side_b', title: `Side with ${first(b)}`, cost: {}, effect: `${first(b)} feels backed; ${first(a)} feels shut out, and those close to them notice.`, about: [b.id, a.id],
            pitch: 'I\'m not the one who started it, and everyone knows it.', proposer: b.id },
          { kind: 'mend', title: 'Sit them down over a meal and mend it', cost: { food: 10 }, effect: '10 food; the two of them come a long way back toward each other.', about: [a.id, b.id],
            pitch: 'Nobody takes sides. They eat together tonight, and they talk.', proposer: speaker(col, (s) => (has(s, 'tender') ? 2 : 0) + (has(s, 'storyteller') ? 1.5 : 0) + s.stats.empathy / 8, taken, rng).id },
        ],
      };
    }
  }
  return null;
}

/** How someone feels about an answer (on top of how they feel about who said it). */
export function dilemmaAffinity(col: Colony, s: Survivor, p: Option): number | undefined {
  switch (p.kind) {
    case 'take_all': return s.stats.empathy / 20 + (has(s, 'tender') ? 0.3 : 0) - (has(s, 'hoarder') ? 0.3 : 0);
    case 'take_one': return (s.role === 'builder' ? 0.2 : 0) + 0.1;
    case 'send_on': return (has(s, 'hoarder') ? 0.4 : 0) + (has(s, 'skittish') ? 0.2 : 0) - s.stats.empathy / 30;
    case 'land_elsewhere': return 0.15 + s.sight / 250;
    case 'land_refuse': return (has(s, 'hoarder') ? 0.3 : 0) + (s.role === 'builder' ? 0.2 : 0) - s.sight / 100;
    case 'all_hands': return (s.role === 'forager' || s.role === 'farmer' ? 0.2 : 0) - (s.role === 'builder' ? 0.15 : 0) + (has(s, 'hoarder') ? 0.2 : 0);
    case 'ration': return (has(s, 'hoarder') ? 0.4 : 0) + (has(s, 'stoic') ? 0.2 : 0) - (s.morale < 55 ? 0.3 : 0);
    case 'trust': return (has(s, 'brave') ? 0.3 : 0) + (s.morale > 70 ? 0.2 : 0) - (has(s, 'hoarder') ? 0.3 : 0);
    case 'side_a': case 'side_b': {
      const [mine, other] = p.about ?? [];
      return (bondValue(col.community, s.id, mine) - bondValue(col.community, s.id, other)) / 100;
    }
    case 'mend': return (has(s, 'tender') ? 0.3 : 0) + 0.15;
    case 'not_now': return (has(s, 'hoarder') ? 0.3 : 0) + (s.role === 'builder' ? 0.1 : 0) - (s.morale < 60 ? 0.3 : 0);
    default: return undefined;
  }
}

/** Carry out an answer. Returns false if the kind isn't a dilemma answer. */
export function applyDilemma(col: Colony, p: Proposal): boolean {
  const c = col.community, w = col.world, f = col.folk;
  const who = (id: number) => c.survivors.find((s) => s.id === id)!;
  const kind: ProposalKind = p.kind;
  switch (kind) {
    case 'take_all': case 'take_one': {
      const n = p.about?.[0] ?? 1;
      welcome(col, n);
      log(c, n > 1 ? `The strangers were given a place at the fire. There are ${alive(c).length} of us now.` : 'One of the strangers stayed; the others walked on at first light.', 'good');
      return true;
    }
    case 'send_on':
      for (const s of alive(c)) s.morale = Math.min(100, s.morale + 2);
      log(c, 'The strangers ate with us and went on up the road with bread in their packs. They waved from the rise.', 'info');
      return true;
    case 'land_elsewhere': {
      const m = w.folk.mound;
      const dx = m.x - w.campfire.x, dz = m.z - w.campfire.z, d = Math.hypot(dx, dz) || 1;
      const r = WILD_RADIUS + 1 + f.level;
      paintZone(w, m.x + (dx / d) * r * 0.6, m.z + (dz / d) * r * 0.6, r, Zone.Wild);
      changeStanding(col, 3);
      log(c, `The village offered ${m.name} the woods on its far side. The Folk took it, a little coolly.`, 'info');
      return true;
    }
    case 'land_refuse':
      changeStanding(col, -6);
      log(c, `The village kept its woods. That night nothing moved on ${w.folk.mound.name}, and the lights stayed out.`, 'bad');
      return true;
    case 'all_hands':
      commit(col, 'all_hands', 'All hands to the woodpile', 'Building stops; everyone cuts wood and forages.', 4);
      log(c, 'The hammers went quiet. Everyone went out to the woods and the hedges with axes and baskets.', 'info');
      return true;
    case 'ration':
      commit(col, 'ration', 'Half rations', 'Everyone eats half; the stores last longer.', 8);
      log(c, 'Half rations from today. Nobody complained out loud.', 'info');
      return true;
    case 'trust':
      log(c, 'They agreed to carry on as they were, and not to talk about it again.', 'info');
      return true;
    case 'side_a': case 'side_b': {
      const [a, b] = (p.about ?? []).map(who);
      if (!a || !b) return true;
      a.morale = Math.min(100, a.morale + 6);
      b.morale = Math.max(0, b.morale - 8);
      adjustBond(c, a.id, b.id, -5);
      for (const s of alive(c)) if (s !== b && bondValue(c, s.id, b.id) >= 30) s.morale = Math.max(0, s.morale - 2);
      log(c, `The council backed ${first(a)}. ${first(b)} left the fire early.`, 'info');
      return true;
    }
    case 'mend': {
      const [a, b] = (p.about ?? []).map(who);
      if (!a || !b) return true;
      adjustBond(c, a.id, b.id, 30);
      a.morale = Math.min(100, a.morale + 3); b.morale = Math.min(100, b.morale + 3);
      log(c, `${first(a)} and ${first(b)} ate together, and talked long after the fire went down.`, 'good');
      return true;
    }
    case 'not_now':
      log(c, 'No festival this time. The work went on.', 'info');
      return true;
    default: return false;
  }
}
