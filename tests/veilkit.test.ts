import { describe, expect, it } from 'vitest';
import { alive, createCommunity } from '../src/sim/community';
import { createColony } from '../src/sim/colony';
import { generateWorld } from '../src/sim/worldgen';
import {
  endTurn, faeUnitId, lanternAct, reaches, soundAct, spiritAt, startClearing, threatsAt, wardAct, type Clearing, type Spirit, type Unit,
} from '../src/sim/haunt';
import { addEcho, inRowan, lightAt, litTiles, seenTiles } from '../src/sim/veilkit';
import { idx, toTileX, toTileZ } from '../src/sim/world';

function setup(seed = 3, n = 3, kind = 'suburb') {
  const col = createColony(generateWorld(seed), createCommunity(seed));
  for (const p of col.world.pois) p.discovered = true;
  const r = col.community.resources;
  r.food += 60; r.scrap += 10; r.wood += 10;
  col.veil.influence += 40;
  const hi = col.haunts.findIndex((h) => col.world.districts[h.district].kind === kind);
  const team = [...alive(col.community)].sort((a, b) => b.sight - a.sight).slice(0, n).map((s) => s.id);
  return { col, hi, team };
}
const tileOf = (col: ReturnType<typeof setup>['col'], p: { x: number; z: number }) => idx(col.world, toTileX(col.world, p.x), toTileZ(col.world, p.z));
/** Keep the spirits out of it: everything at peace and far away (for testing the team's own kit). */
function hush(cl: Clearing, col: ReturnType<typeof setup>['col']) {
  for (const s of col.haunts[cl.haunt].spirits) { s.fate = 'rested'; }
}

describe('the kit (DESIGN §38.13)', () => {
  it('everyone packs two slots and a lantern, paid for from the stores', () => {
    const { col, hi, team } = setup();
    const r = col.community.resources;
    const before = { food: r.food, scrap: r.scrap, wood: r.wood };
    const cl = startClearing(col, hi, team, undefined, { [team[0]]: ['iron', 'bell'], [team[1]]: ['rowan', 'oil'], [team[2]]: ['salt', 'salt'] }) as Clearing;
    expect(cl.units[0].slots).toEqual(['iron', 'bell']);
    expect(cl.units[1].slots).toEqual(['rowan', 'oil']);
    expect(cl.units.every((u) => u.lantern?.lit && u.lantern.fuel > 0)).toBe(true);
    expect(r.scrap).toBe(before.scrap - 3); // iron 2, bell 1
    expect(r.wood).toBe(before.wood - 1); // rowan
    expect(r.food).toBeLessThan(before.food); // oil, and candles for the lanterns
    // A hearthstone is set down where they came in.
    expect(cl.wards.some((w) => w.kind === 'hearth')).toBe(true);
  });
});

describe('the dark and the light (DESIGN §38.11–38.12)', () => {
  it('ground is seen where light falls, and for a turn after it leaves', () => {
    const { col, hi, team } = setup();
    const cl = startClearing(col, hi, team.slice(0, 1)) as Clearing;
    hush(cl, col);
    const u = cl.units[0];
    // Somewhere open, away from the hearthstone, where a lantern lights a good patch.
    const x0 = u.x, z0 = u.z;
    for (let k = 0; k < 40; k++) {
      u.x = x0 + 8 + (k % 8) * 2; u.z = z0 + Math.floor(k / 8) * 3;
      if (litTiles(col, cl).size >= 55) break;
    }
    const here = tileOf(col, u), far = tileOf(col, { x: u.x + 12, z: u.z });
    expect(litTiles(col, cl).has(here)).toBe(true);
    expect(litTiles(col, cl).has(far)).toBe(false);
    endTurn(col, cl); // the lit ground is remembered for a turn
    lanternAct(col, cl, u.id, 'shutter');
    const now = litTiles(col, cl);
    const faded = cl.dusk.find((t) => !now.has(t))!;
    expect(faded).toBeDefined();
    expect(seenTiles(col, cl).has(faded)).toBe(true);
    endTurn(col, cl);
    expect(seenTiles(col, cl).has(faded)).toBe(false);
  });

  it('lanterns burn down and gutter out; the dark frightens; a relit lantern needs fuel', () => {
    const { col, hi, team } = setup();
    const cl = startClearing(col, hi, team.slice(0, 1), undefined, { [team[0]]: [] }) as Clearing;
    hush(cl, col);
    const u = cl.units[0];
    u.x += 8;
    const l = u.lantern!;
    const fuel = l.fuel;
    endTurn(col, cl);
    expect(l.fuel).toBe(fuel - 1);
    l.fuel = 1;
    const nerve = u.nerve;
    endTurn(col, cl);
    expect(l.lit).toBe(false);
    expect(u.nerve).toBe(nerve - 1); // stood in the dark at the end of that turn
    expect(lanternAct(col, cl, u.id, 'relight')).toMatch(/fuel/);
  });

  it('a lantern set down is a pool of light; lures fail inside it', () => {
    const { col, hi, team } = setup();
    const cl = startClearing(col, hi, team.slice(0, 2)) as Clearing;
    const [a, b] = cl.units;
    const lamp = col.haunts[hi].spirits.find((s) => s.kind === 'lamp') as Spirit;
    if (!lamp) return;
    const p = spiritAt(col, lamp);
    a.x = b.x = p.x + 5; a.z = p.z; b.z = p.z + 1;
    lanternAct(col, cl, a.id, 'set_down');
    expect(cl.wards.some((w) => w.kind === 'pool' && w.owner === a.id)).toBe(true);
    expect(lightAt(col, cl, b).lit).toBe(true);
    expect(reaches(col, cl, lamp, b)).toBeNull();
  });

  it('a torch beam on a lamp breaks its lure this turn', () => {
    const { col, hi, team } = setup();
    const cl = startClearing(col, hi, team.slice(0, 1)) as Clearing;
    const u = cl.units[0];
    const lamp = col.haunts[hi].spirits.find((s) => s.kind === 'lamp') as Spirit;
    if (!lamp) return;
    u.lantern = { kind: 'torch', state: 'raised', fuel: 9, max: 9, lit: true };
    const p = spiritAt(col, lamp);
    u.x = p.x + 4; u.z = p.z;
    lanternAct(col, cl, u.id, 'aim', lamp.id);
    cl.beamed = [lamp.id];
    expect(reaches(col, cl, lamp, u)).toBeNull();
    cl.beamed = [];
    expect(reaches(col, cl, lamp, u) === 'lure' || reaches(col, cl, lamp, u) === null).toBe(true);
  });
});

describe('finding spirits (DESIGN §38.14)', () => {
  it('a seer sounding the Veil hears echoes; only seers can; a call is heard back', () => {
    const { col, hi, team } = setup();
    const cl = startClearing(col, hi, team) as Clearing;
    const seer = cl.units.reduce((a, b) => (b.sight > a.sight ? b : a));
    const blind = cl.units.find((u) => u.sight < 35);
    seer.sight = Math.max(seer.sight, 60);
    const d = col.world.districts[col.haunts[hi].district];
    seer.x = d.x; seer.z = d.z;
    expect(soundAct(col, cl, seer.id, false)).toBeNull();
    expect(cl.echoes.length).toBeGreaterThan(0);
    if (blind) expect(soundAct(col, cl, blind.id, false)).toMatch(/Sight/);
    expect(soundAct(col, cl, seer.id, true)).toBeNull();
    expect(Object.keys(cl.heard).length).toBeGreaterThan(0);
    // Echoes fade: an exact echo is only a circle a turn later.
    const exact = cl.echoes.find((e) => e.quality === 'exact');
    endTurn(col, cl);
    if (exact) expect(cl.echoes.find((e) => e.spirit === exact.spirit)?.quality).not.toBe('exact');
  });

  it('two bearings from two places make a circle where they cross', () => {
    const { col, hi, team } = setup();
    const cl = startClearing(col, hi, team) as Clearing;
    const s = col.haunts[hi].spirits[0];
    const p = spiritAt(col, s);
    const arc = (fx: number, fz: number) => {
      const bearing = Math.atan2(p.z - fz, p.x - fx), d = Math.hypot(p.x - fx, p.z - fz);
      return { spirit: s.id, turn: cl.turn, quality: 'arc' as const, x: fx, z: fz, r: 3, from: { x: fx, z: fz }, bearing, spread: 0.35, dist: d, source: 'sound' as const };
    };
    addEcho(cl, arc(p.x - 8, p.z));
    addEcho(cl, arc(p.x, p.z - 8));
    const e = cl.echoes.find((x) => x.spirit === s.id)!;
    expect(e.quality).toBe('circle');
    expect(Math.hypot(e.x - p.x, e.z - p.z)).toBeLessThan(0.5);
  });

  it('signs are found where light falls, and point toward what left them', () => {
    const { col, hi, team } = setup();
    const cl = startClearing(col, hi, team.slice(0, 1)) as Clearing;
    const sg = cl.signs.find((x) => !x.found)!;
    expect(sg).toBeTruthy();
    const u = cl.units[0];
    u.x = sg.x + 1; u.z = sg.z;
    lanternAct(col, cl, u.id, 'shutter');
    lanternAct(col, cl, u.id, 'raise');
    expect(sg.found).toBe(true);
    expect(cl.echoes.some((e) => e.spirit === sg.spirit)).toBe(true);
  });
});

describe('wards (DESIGN §38.13)', () => {
  it('salt between a lamp and someone stops its lure', () => {
    const { col, hi, team } = setup();
    const cl = startClearing(col, hi, team.slice(0, 1), undefined, { [team[0]]: ['salt'] }) as Clearing;
    const u = cl.units[0] as Unit;
    const lamp = col.haunts[hi].spirits.find((s) => s.kind === 'lamp') as Spirit;
    if (!lamp) return;
    const p = spiritAt(col, lamp);
    u.x = p.x + 4; u.z = p.z;
    const before = reaches(col, cl, lamp, u);
    u.x = p.x + 2; u.z = p.z - 2.5;
    expect(wardAct(col, cl, u.id, 'salt', p.x + 2, p.z + 2.5)).toBeNull();
    u.x = p.x + 4; u.z = p.z;
    expect(reaches(col, cl, lamp, u)).toBeNull();
    void before;
  });

  it('inside rowan, Nerve stays at 2 or more', () => {
    const { col, hi, team } = setup();
    const cl = startClearing(col, hi, team.slice(0, 1), undefined, { [team[0]]: ['rowan'] }) as Clearing;
    hush(cl, col);
    const u = cl.units[0];
    u.x += 8;
    expect(wardAct(col, cl, u.id, 'rowan', u.x, u.z)).toBeNull();
    expect(inRowan(cl, u)).toBe(true);
    u.nerve = 1;
    endTurn(col, cl);
    expect(u.nerve).toBeGreaterThanOrEqual(2);
  });

  it('nobody is taken beside the hearthstone', () => {
    const { col, hi, team } = setup();
    const cl = startClearing(col, hi, team.slice(0, 1)) as Clearing;
    const u = cl.units[0];
    u.lured = true; u.nerve = 0;
    lanternAct(col, cl, u.id, 'shutter');
    expect(u.state).toBe('fled');
  });

  it('the Folk won\'t touch iron, and shrink from it', () => {
    const { col, hi, team } = setup(5, 2);
    col.folk.met = true; col.folk.standing = 60;
    const elder = col.folk.beings.find((b) => b.kind === 'elder')!;
    const cl = startClearing(col, hi, team, elder.id, { [team[0]]: ['iron'] }) as Clearing;
    hush(cl, col);
    const f = cl.units.find((x) => x.id === faeUnitId(elder.id))!;
    expect(wardAct(col, cl, f.id, 'iron', f.x + 2, f.z)).toMatch(/iron/);
    const u = cl.units.find((x) => !x.fae)!;
    expect(wardAct(col, cl, u.id, 'iron', u.x + 3, u.z)).toBeNull();
    f.x = u.x + 1; f.z = u.z + 0.5;
    const nerve = f.nerve;
    endTurn(col, cl);
    expect(f.nerve).toBeLessThan(nerve);
    expect(cl.ironLaid).toBe(true);
  });

  it('the walk preview knows a shuttered lantern goes unnoticed by a lamp', () => {
    const { col, hi, team } = setup();
    const cl = startClearing(col, hi, team.slice(0, 1)) as Clearing;
    const u = cl.units[0];
    const lamp = col.haunts[hi].spirits.find((s) => s.kind === 'lamp') as Spirit;
    if (!lamp) return;
    lamp.known = 1;
    const p = spiritAt(col, lamp);
    lanternAct(col, cl, u.id, 'shutter');
    expect(threatsAt(col, cl, u, p.x + 6, p.z).some((t) => t.spirit === lamp)).toBe(false);
  });
});
