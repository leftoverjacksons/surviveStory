/**
 * The year: four seasons of eight days (twelve before DESIGN §21.9). Day 1 is the first day of spring.
 * Weather is drawn per day from the world seed, so it is deterministic.
 */

export const DAYS_PER_SEASON = 8;
/** Seasonal rates (growth per day) were tuned for twelve-day seasons; this keeps them per season. */
export const SEASON_SCALE = 12 / DAYS_PER_SEASON;
export const SEASONS_PER_YEAR = 4;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS_PER_YEAR;

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_NAMES: Record<Season, string> = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };

export type Weather = 'clear' | 'overcast' | 'rain' | 'fog' | 'snow';

/** Day numbers are 1-based. */
export const seasonIndex = (day: number) => Math.floor(((day - 1) % DAYS_PER_YEAR) / DAYS_PER_SEASON);
export const seasonOf = (day: number): Season => SEASONS[seasonIndex(day)];
export const dayOfSeason = (day: number) => ((day - 1) % DAYS_PER_SEASON) + 1;
export const yearOf = (day: number) => Math.floor((day - 1) / DAYS_PER_YEAR) + 1;

/** The full moon: once a season, two-thirds of the way through. */
export const isFullMoon = (day: number) => dayOfSeason(day) === Math.ceil(DAYS_PER_SEASON * 0.66);
/** Days until the next full moon (0 on the day). */
export function daysToFullMoon(day: number): number {
  const full = Math.ceil(DAYS_PER_SEASON * 0.66), d = dayOfSeason(day);
  return d <= full ? full - d : DAYS_PER_SEASON - d + full;
}

/** Days until the next winter begins (0 during winter). */
export function daysUntilWinter(day: number): number {
  const d = (day - 1) % DAYS_PER_YEAR;
  const winterStart = DAYS_PER_SEASON * 3;
  return d >= winterStart ? 0 : winterStart - d;
}

/** Hours of daylight: long summer days, short winter ones. */
export function daylightHours(dayFrac: number): number {
  // dayFrac: fractional day number. Peak at midsummer, low at midwinter.
  const phase = ((dayFrac - 1 - DAYS_PER_SEASON * 1.5) / DAYS_PER_YEAR) * Math.PI * 2;
  return 12 + Math.cos(phase) * 3.5;
}

function hash(n: number, seed: number) {
  let h = Math.imul(n ^ seed, 2654435761) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export function weatherOn(day: number, seed: number): Weather {
  const s = seasonOf(day);
  const r = hash(day, seed);
  switch (s) {
    case 'spring': return r < 0.3 ? 'rain' : r < 0.45 ? 'overcast' : r < 0.55 ? 'fog' : 'clear';
    case 'summer': return r < 0.12 ? 'rain' : r < 0.22 ? 'overcast' : 'clear';
    case 'autumn': return r < 0.25 ? 'rain' : r < 0.45 ? 'fog' : r < 0.6 ? 'overcast' : 'clear';
    case 'winter': return r < 0.4 ? 'snow' : r < 0.6 ? 'overcast' : r < 0.7 ? 'fog' : 'clear';
  }
}

export const WEATHER_NAMES: Record<Weather, string> = {
  clear: 'Clear', overcast: 'Overcast', rain: 'Rain', fog: 'Fog', snow: 'Snow',
};

/** Outdoor work slows in bad weather. */
export function weatherWorkFactor(w: Weather): number {
  return w === 'rain' ? 0.85 : w === 'snow' ? 0.8 : 1;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface SeasonLook {
  /** 0..1 snow cover on the ground and roofs. */
  snow: number;
  /** 0..1 autumn colour on broadleaf trees and grass. */
  autumn: number;
  /** 0..1 how bare broadleaf trees are. */
  bare: number;
  /** 0..1 spring blossom. */
  blossom: number;
  /** 0..1 how fast leaves are falling (DESIGN §42): late autumn, as the crowns go bare. */
  leafFall: number;
  /** 0..1 fallen leaves on the ground: builds through leaf fall, lies under the snow, gone in early spring. */
  litter: number;
}

/**
 * How cold it is for snow to lie (0..1, DESIGN §35): from late autumn to the thaw. Snow that falls
 * builds up; it melts when this drops, and not while it's deep winter.
 */
export function snowCold(dayFrac: number): number {
  const d = (((dayFrac - 1) % DAYS_PER_YEAR + DAYS_PER_YEAR) % DAYS_PER_YEAR) * (48 / DAYS_PER_YEAR);
  return smooth(34, 37, d) * (1 - smooth(45.5, 47.5, d));
}

/**
 * Visual season state for a fractional day (e.g. day 40.5 is midday on day 40).
 * Transitions are smooth across the season boundaries.
 */
export function seasonLook(dayFrac: number, snowing: boolean): SeasonLook {
  // Positions below are in a 48-day year, scaled to the real one.
  const d = (((dayFrac - 1) % DAYS_PER_YEAR + DAYS_PER_YEAR) % DAYS_PER_YEAR) * (48 / DAYS_PER_YEAR);
  const autumn = smooth(24, 29, d) * (1 - smooth(35, 38, d));
  const bare = smooth(33, 38, d) * (1 - smooth(46, 48, d)) + (d < 2 ? 1 - smooth(0, 2, d) : 0);
  const blossom = smooth(0, 2, d) * (1 - smooth(8, 12, d));
  // Snow lies from early winter until the thaw at the end of the year.
  let snow = smooth(36, 38.5, d) * (1 - smooth(46, 47.8, d));
  if (snowing) snow = Math.max(snow, 0.6);
  const leafFall = smooth(27, 30, d) * (1 - smooth(35, 38, d));
  const litter = d >= 20 ? smooth(27.5, 35, d) : d < 8 ? 1 - smooth(1.5, 6, d) : 0;
  return { snow, autumn, bare: Math.min(1, bare), blossom, leafFall, litter };
}
