/**
 * What an absent player would do (DESIGN §22.2): lay out fields and a
 * woodlot, and give the village more Home ground as it outgrows it. Only
 * with `village.autopilot` (the Autopilot button, the soak script); plain
 * self-planning (`autoPlan`) leaves zones to the player as before.
 */
import type { Colony } from './colony';
import { log } from './community';
import { seasonOf } from './calendar';
import { roundField } from './fields';
import { STORE_PER_HEAD } from './buildings';
import { Zone, idx, paintZone, toTileX, toTileZ, zoneAllowed, type World } from './world';
import { DAYS_PER_SEASON } from './calendar';
import { alive, communityMorale } from './community';
import { FOLK_SUITED, canClear, finish, giveDistrict, startClearing, type Clearing } from './haunt';
import { playTurn } from './clearbot';
import { WILD_RADIUS, folkNeeds, orderFolkWork, whyNotFolkWork, type FolkWorkKind } from './folk';

/** Best spot on a ring around home for a zone disc, by count of allowed tiles (and trees for woodlots). */
export function bestSpot(w: World, r0: number, r1: number, radius: number, kind: number, wantTrees: boolean, avoid: { x: number; z: number }[]) {
  const c = w.campfire;
  let best = { x: 0, z: 0, score: -1 };
  for (let r = r0; r <= r1; r += 3) for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
    if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < radius * 2.2)) continue;
    let score = 0;
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      if (Math.hypot(dx, dz) > radius) continue;
      const tx = toTileX(w, x + dx), tz = toTileZ(w, z + dz);
      if (!zoneAllowed(w, tx, tz, kind as never)) continue;
      const i = idx(w, tx, tz);
      if (w.zone[i] === Zone.Home || w.fieldAt[i] > 0 || w.blocked[i]) continue;
      score += wantTrees ? (w.treeAt[i] >= 0 ? 1 : 0.1) : (w.treeAt[i] >= 0 || w.bushAt[i] >= 0 ? 0 : 1);
    }
    if (score > best.score) best = { x, z, score };
  }
  return best;
}

/** Once a day, under autopilot. */
export function autopilotDaily(col: Colony) {
  if (!col.village.autopilot) return;
  const w = col.world, c = col.community, pop = col.agents.length;
  const fields = w.fields.map((f) => ({ x: f.pts.reduce((n, p) => n + p.x, 0) / f.pts.length, z: f.pts.reduce((n, p) => n + p.z, 0) / f.pts.length }));
  // Fields: about eight tiles a head, laid out in spring (sown before the summer's half-way mark).
  let tiles = 0;
  for (let i = 0; i < w.fieldAt.length; i++) if (w.fieldAt[i] > 0) tiles++;
  const season = seasonOf(c.day);
  // …and only while the stores are short of two seasons' eating (STORE_PER_HEAD a head).
  const perHead = (c.resources.food + c.resources.preserves) / Math.max(1, pop);
  if ((season === 'spring' || !w.fields.length) && tiles < pop * 8 && w.fields.length < 8 && (perHead < STORE_PER_HEAD || !w.fields.length)) {
    const s = bestSpot(w, 16, 30, 3.5, Zone.Field, false, fields);
    if (s.score > 20 && roundField(w, s.x, s.z, 4, w.campfire)) log(c, 'Autopilot marked out a new field.', 'info');
  }
  // A woodlot, and another once the first is thinning.
  let lot = 0;
  for (let i = 0; i < w.zone.length; i++) if (w.zone[i] === Zone.Woodlot) lot++;
  if (lot < 40 || (lot < 120 && pop >= 10 && c.day % 16 === 0)) {
    const s = bestSpot(w, 16, 30, 4.5, Zone.Woodlot, true, fields);
    if (s.score > 10) { paintZone(w, s.x, s.z, 4.5, Zone.Woodlot); log(c, 'Autopilot set aside a woodlot.', 'info'); }
    else {
      // Nothing left standing nearby: open ground, to be planted (bare woodlot is planted up).
      const o = bestSpot(w, 16, 34, 4.5, Zone.Woodlot, false, fields);
      if (o.score > 20) { paintZone(w, o.x, o.z, 4.5, Zone.Woodlot); log(c, 'Autopilot set aside bare ground for a woodlot, to be planted.', 'info'); }
    }
  }
  autopilotClear(col);
  autopilotFolk(col);
  // More Home ground when households find no room.
  if ((col.village.noPlotDay ?? -9) >= c.day - 1) {
    // Next to the village, not out in the woods: plots are found anywhere on Home ground now.
    // Wide enough for a few plots (each is ~8 × 11 tiles).
    const s = bestSpot(w, 14, 30, 9, Zone.Home, false, fields);
    if (s.score > 60) paintZone(w, s.x, s.z, 9, Zone.Home);
  }
}

/**
 * About once a season, when the village is well and there is Influence to
 * open the way, send a team into the nearest haunted district (played by the
 * test bot, as time at home stands still anyway), and give it to whoever
 * suits it.
 */
function autopilotClear(col: Colony) {
  const v = col.village, c = col.community;
  if (c.day - (v.autoClearDay ?? 0) < DAYS_PER_SEASON || col.clearing) return;
  const living = alive(c).filter((s) => s.hp >= s.maxHp * 0.6 && s.griefDays <= 0);
  if (living.length < 6 || communityMorale(c) < 55) return;
  const home = col.world.campfire;
  const options = col.haunts.map((h, i) => ({ h, i, d: col.world.districts[h.district] }))
    .filter(({ h }) => h.state !== 'cleared' && !canClear(col, h))
    .sort((a, b) => Math.hypot(a.d.x - home.x, a.d.z - home.z) - Math.hypot(b.d.x - home.x, b.d.z - home.z));
  if (!options.length) return;
  v.autoClearDay = c.day;
  const { h, i } = options[0];
  // Two who see, two who don't: seers to read the spirits, anchors to hold.
  const by = [...living].sort((a, b) => b.sight - a.sight);
  const team = [...new Set([by[0], by[1], by[by.length - 1], by[by.length - 2]].map((s) => s.id))];
  const cl = startClearing(col, i, team) as Clearing | string;
  if (typeof cl === 'string') return;
  for (let t = 0; t < 20 && !cl.outcome; t++) playTurn(col, cl);
  if (!cl.outcome) finish(col, cl, 'withdrew');
  if (h.state === 'cleared' && !h.owner) {
    const folk = FOLK_SUITED.includes(col.world.districts[h.district].kind) && col.folk.met && col.folk.standing >= 45;
    giveDistrict(col, h.district, folk ? 'folk' : 'village');
  }
  log(c, `Autopilot sent a team into ${col.world.districts[h.district].name}: ${cl.outcome ?? 'withdrew'}.`, 'info');
}

/**
 * Ask the Folk for what their hill lacks (DESIGN §22.12): a bower, a dancing
 * ring or a lantern, whichever need is unmet, one order at a time, on the
 * nearest free spot in the Wild. Without this the unattended runs never
 * grow the hill.
 */
function autopilotFolk(col: Colony) {
  const f = col.folk, w = col.world, m = w.folk.mound;
  if (!f.met || f.standing < 20 || f.works.some((k) => k.built !== undefined && k.built < 1)) return;
  const want: Record<string, FolkWorkKind> = { rest: 'bower', dance: 'ring', light: 'lantern' };
  const need = folkNeeds(col).find((n) => !n.met && want[n.id]);
  if (!need) return;
  for (let r = m.r + 2; r <= WILD_RADIUS + 8; r += 1.5) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
      const x = m.x + Math.cos(a + r) * r, z = m.z + Math.sin(a + r) * r;
      if (whyNotFolkWork(col, x, z)) continue;
      const k = orderFolkWork(col, want[need.id], x, z);
      if (typeof k !== 'string') log(col.community, `Autopilot asked the Folk for a ${want[need.id]}.`, 'info');
      return;
    }
  }
}
