/**
 * Headless balance probe: runs many campaigns and reports survival statistics.
 * Usage: npm run sim -- [campaigns=500] [days=60]
 */
import { advanceDay, alive, communityMorale, createCommunity } from '../src/sim/community';

const campaigns = Number(process.argv[2] ?? 500);
const days = Number(process.argv[3] ?? 60);

let wiped = 0;
let totalAlive = 0;
let totalMorale = 0;
let starvedDays = 0;

for (let seed = 1; seed <= campaigns; seed++) {
  const c = createCommunity(seed);
  for (let d = 0; d < days && alive(c).length > 0; d++) advanceDay(c);
  const living = alive(c).length;
  if (living === 0) wiped++;
  totalAlive += living;
  totalMorale += communityMorale(c);
  starvedDays += c.log.filter((l) => l.text.startsWith('Not enough')).length;
}

console.log(`campaigns=${campaigns} days=${days}`);
console.log(`wipe rate:            ${((wiped / campaigns) * 100).toFixed(1)}%`);
console.log(`mean survivors alive: ${(totalAlive / campaigns).toFixed(2)}`);
console.log(`mean final morale:    ${(totalMorale / campaigns).toFixed(1)}`);
console.log(`mean hungry days:     ${(starvedDays / campaigns).toFixed(1)}`);
