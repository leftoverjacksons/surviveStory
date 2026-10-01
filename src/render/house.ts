/**
 * Procedural houses. Each home is generated from its HouseSpec and seed:
 * footprint, wing, roof pitch and orientation, porch, chimney, materials and
 * trim all vary, so no two houses on a lane are the same.
 *
 * Local frame: door faces +z, width W along x, depth D along z; y = 0 is the
 * ground. Salvage houses are patched panel and tin; timber houses are timber
 * frame with limewashed daub under thatch or shingle.
 */
import * as THREE from 'three';
import { tagOutline } from './outlinecats';
import { homeLayout, type HouseSpec } from '../sim/homes';
import type { Material } from '../sim/oldworld';
import { GLOW, box, cyl, mat, smooth } from './kit';
import { enhance, glowTexture, makeRand } from './util';

const SHUTTERS = ['#5f7f6a', '#4f6f8a', '#8a4f3f', '#6f6a8a', '#8a7a4a', '#4f7a78'];
const BLANKETS = ['#6f7d5c', '#8a6a4a', '#5a6b7a', '#7a4f45', '#9a8a60', '#4f6a5a', '#7a6a8a'];

let glowTex: THREE.Texture | null = null;

type Surface = 'auto' | 'brick' | 'corrugated' | 'none';
interface Clad { color: string; surface: Surface }

/** How each kind of salvage looks nailed to a wall. */
const CLAD: Partial<Record<Material, { colors: string[]; surface: Surface }>> = {
  'vinyl siding': { colors: ['#b9c79a', '#c9b98e', '#9ab5bf', '#c7a38f', '#a7c0a4', '#d1c29a', '#8fa7b8'], surface: 'auto' },
  'corrugated steel': { colors: ['#8a9296', '#6f7d78', '#94877a', '#7a8a96'], surface: 'corrugated' },
  'garage doors': { colors: ['#d8d4c4', '#c8c0b0', '#b8c0c4'], surface: 'corrugated' },
  'car panels': { colors: ['#8a5a4a', '#5a7078', '#b8a88a', '#6a7a5a', '#4a5a78', '#9a6a3a', '#a8b0a8'], surface: 'none' },
  'pallets': { colors: ['#b8a070', '#a89064', '#c4ac7c'], surface: 'auto' },
  'interior doors': { colors: ['#c8b890', '#e0d8c4', '#a88a64', '#d8d0bc'], surface: 'auto' },
  'pews': { colors: ['#6b4f33', '#7a5a3c'], surface: 'auto' },
  'barn boards': { colors: ['#8a3a2e', '#7a4a34', '#6e3a30'], surface: 'auto' },
  'shop signs': { colors: ['#c8503a', '#3a6a9a', '#d8a040', '#4a8a5a', '#d06a3a'], surface: 'none' },
  'bricks': { colors: ['#8a4a3a', '#96583f', '#7d4536'], surface: 'brick' },
  'aluminium frame': { colors: ['#a8aca8', '#b8bcb8'], surface: 'corrugated' },
  'steel girders': { colors: ['#6a6e70', '#7a7470'], surface: 'corrugated' },
  'shop shelving': { colors: ['#9a9c98', '#b0b0a8'], surface: 'corrugated' },
};
/** Painted boards and tin, for a patched-up house. */
const PAINT = ['#d8d0bc', '#b9c79a', '#9ab5bf', '#c7a38f', '#e0d4b0', '#a7c0a4', '#c4b0c8'];
const TIN_PAINTED = ['#5f7a5a', '#8a4a3a', '#4f6a7a', '#6a6a5e'];

const clad = new Map<string, THREE.Material>();
/** A cladding material with its surface texture; plain ones share the kit's. */
function cm(c: Clad): THREE.Material {
  if (c.surface === 'auto') return mat(c.color);
  const key = `${c.color}|${c.surface}`;
  let m = clad.get(key);
  if (!m) { m = enhance(new THREE.MeshLambertMaterial({ color: c.color, flatShading: true }), { surface: c.surface }); clad.set(key, m); }
  return m;
}

interface Palette {
  /** Level 0: a patchwork of these; later, the first (tidied, often painted). */
  clad: Clad[];
  wall: Clad;
  frame: string; roof: string; roofKind: 'shingle' | 'slate' | 'tin'; shutter: string; tier: number;
  /** A brick course along the bottom (if bricks were salvaged). */
  brick: boolean;
  /** Big salvaged windows (plate glass, greenhouse glass). */
  bigWindows: boolean;
}

/**
 * The house's look from what it was built of and how far it has come:
 * level 0 is a patchwork of whatever was salvaged; level 1 is the same
 * house patched and tidied (straight cladding, white frames, a proper roof);
 * level 2 adds a glasshouse and solar panels (see buildHouse).
 */
function palette(level: number, materials: Material[] | undefined, rand: () => number): Palette {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const mats = materials?.length ? materials : ['corrugated steel', 'car panels', 'pallets'] as Material[];
  const walls = mats.filter((m) => CLAD[m]);
  const patch = (walls.length ? walls : ['corrugated steel' as Material]).map((m) => ({ color: pick(CLAD[m]!.colors), surface: CLAD[m]!.surface }));
  // Always something rough in the patchwork.
  if (patch.length < 3) patch.push({ color: pick(CLAD['pallets']!.colors), surface: 'auto' });
  const roofKind = mats.includes('roof slates') ? 'slate' : mats.includes('roof shingles') ? 'shingle' : 'tin';
  const tidy: Clad = patch[0].surface === 'none' || patch[0].surface === 'corrugated'
    ? (level >= 1 && rand() < 0.6 ? { color: pick(PAINT), surface: 'auto' } : patch[0])
    : patch[0];
  return {
    clad: patch,
    wall: level === 0 ? patch[0] : tidy,
    frame: level === 0 ? '#5b4632' : '#e8e4d8',
    roof: roofKind === 'slate' ? pick(['#3e4448', '#4a4a4e']) : roofKind === 'shingle' ? pick(['#5a5652', '#6e4f3a', '#4a4e52']) : level === 0 ? pick(['#7d8a8c', '#8a8f86', '#6f7a7a']) : pick(TIN_PAINTED),
    roofKind,
    shutter: pick(SHUTTERS),
    tier: level,
    brick: mats.includes('bricks'),
    bigWindows: mats.some((m) => m === 'plate glass' || m === 'greenhouse glass' || m === 'window glass'),
  };
}

/** A gable roof over a W×D block, ridge along local x. Returns meshes for the roof group. */
function gableRoof(len: number, span: number, pitch: number, eaves: number, pal: Palette, rand: () => number, k = 1): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const over = 0.35;
  const thick = pal.roofKind === 'tin' ? 0.06 : 0.12;
  const half = span / 2 + over;
  const rise = (span / 2) * Math.tan(pitch);
  const slopeLen = half / Math.cos(pitch);
  const roofM = pal.roofKind === 'tin' ? cm({ color: pal.roof, surface: 'corrugated' }) : mat(pal.roof);
  for (const s of [-1, 1]) {
    const slab = box(len + over * 2, thick, slopeLen * k, roofM, 0, eaves + rise / 2 - over * Math.tan(pitch) / 2 + thick / 2, s * (half / 2) * (2 - k));
    slab.rotation.x = s * pitch;
    out.push(slab);
    if (pal.roofKind === 'tin' && pal.tier === 0 && k >= 1 && rand() < 0.7) {
      // A tarp or a rust-red sheet patched over a hole.
      const patch = box(len * (0.25 + rand() * 0.3), thick + 0.02, slopeLen * 0.5, mat(rand() < 0.5 ? '#3f6f9a' : '#8a4a32'),
        (rand() - 0.5) * len * 0.5, eaves + rise / 2 - over * Math.tan(pitch) / 2 + thick / 2 + 0.02, s * half / 2);
      patch.rotation.x = s * pitch;
      out.push(patch);
    }
  }
  if (k >= 1) {
    // Gable ends, in the wall's material (or the frame's, on salvage houses).
    const shape = new THREE.Shape([new THREE.Vector2(-span / 2, 0), new THREE.Vector2(span / 2, 0), new THREE.Vector2(0, rise)]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false });
    geo.translate(0, 0, -0.07);
    const gm = cm(pal.wall);
    for (const sx of [-1, 1]) {
      const tri = new THREE.Mesh(geo, gm);
      tri.rotation.y = Math.PI / 2;
      tri.position.set(sx * (len / 2 - 0.02), eaves, 0);
      tri.castShadow = tri.receiveShadow = true;
      out.push(tri);
      if (pal.tier >= 1) {
        // A round vent high in the gable.
        out.push(cyl(0.18, 0.06, mat(pal.frame), sx * (len / 2 + 0.03), eaves + rise * 0.45, 0, 10).rotateZ(Math.PI / 2));
      }
    }
    {
      const ridge = box(len + over * 2 + 0.1, 0.12, 0.3, mat('#4a4a46'), 0, eaves + rise + 0.06, 0);
      out.push(ridge);
    }
  }
  return out;
}

interface WallOpts { door?: number; gap?: { at: number; w: number }; windows: number[] }

/**
 * One straight wall of length `len` along x (rotated into place by the
 * caller), `h` tall, with optional door, gap and windows (positions along it).
 */
function wall(len: number, h: number, pal: Palette, o: WallOpts, rand: () => number, glow: THREE.Mesh[], lit: boolean): THREE.Group {
  const g = new THREE.Group();
  const T = 0.16;
  // Solid runs between openings.
  const holes: [number, number][] = [];
  if (o.door !== undefined) holes.push([o.door - 0.47, o.door + 0.47]);
  if (o.gap) holes.push([o.gap.at - o.gap.w / 2, o.gap.at + o.gap.w / 2]);
  holes.sort((a, b) => a[0] - b[0]);
  let x = -len / 2;
  const runs: [number, number][] = [];
  for (const [a, b] of holes) { if (a > x) runs.push([x, a]); x = Math.max(x, b); }
  if (x < len / 2) runs.push([x, len / 2]);
  const wallM = cm(pal.wall);
  for (const [a, b] of runs) {
    if (pal.tier === 0) {
      // Salvage: a patchwork of whatever came home, panels a little uneven.
      const n = Math.max(1, Math.round((b - a) / 0.55));
      for (let i = 0; i < n; i++) {
        const w0 = (b - a) / n;
        const ph = h * (0.96 + rand() * 0.08);
        g.add(box(w0 - 0.02, ph, T, cm(pal.clad[Math.floor(rand() * pal.clad.length)]), a + w0 * (i + 0.5), ph / 2, 0));
      }
    } else {
      g.add(box(b - a, h, T, wallM, (a + b) / 2, h / 2, 0));
    }
    if (pal.brick) g.add(box(b - a + 0.01, 0.7, T + 0.03, cm({ color: '#8a4a3a', surface: 'brick' }), (a + b) / 2, 0.35, 0));
  }
  // Openings: lintel over the door and gap.
  for (const [a, b] of holes) g.add(box(b - a, h - 1.95, T, wallM, (a + b) / 2, 1.95 + (h - 1.95) / 2, 0));
  if (pal.tier >= 1) {
    // Painted corner boards and a fascia under the eaves.
    const fm = mat(pal.frame);
    for (const x of [-len / 2, len / 2]) g.add(box(0.12, h, T + 0.05, fm, x, h / 2, 0));
    g.add(box(len + 0.04, 0.12, T + 0.05, fm, 0, h - 0.06, 0));
  }
  if (o.door !== undefined) {
    g.add(box(0.86, 1.9, 0.07, mat(pal.tier === 0 ? '#3f6f9a' : ['#5b7a8a', '#8a4a3a', '#4a6a4a', '#e8e4d8'][Math.floor(rand() * 4)]), o.door, 0.97, T / 2 + 0.02));
    g.add(box(0.06, 0.06, 0.08, mat('#c8b070'), o.door + 0.3, 1.0, T / 2 + 0.07));
    g.add(box(1.0, 0.12, 0.3, mat('#7d7a70'), o.door, 0.06, T / 2 + 0.15)); // step
  }
  for (const wx of o.windows) {
    // Salvaged windows: odd sizes on a shack (some just plastic sheeting),
    // matched white frames once patched up, wide panes if plate glass came home.
    const ww = pal.bigWindows && pal.tier >= 1 ? 1.0 : pal.tier === 0 ? 0.45 + rand() * 0.35 : 0.64;
    const wh = pal.tier === 0 ? 0.4 + rand() * 0.3 : pal.bigWindows ? 0.8 : 0.62;
    const wy = 1.35 + (pal.tier === 0 ? (rand() - 0.5) * 0.15 : 0.05);
    const sheeting = pal.tier === 0 && rand() < 0.3;
    g.add(box(ww, wh, 0.06, sheeting ? mat('#b8c4c0') : tagOutline(mat('#2a3236', true, 'glass'), 'glass'), wx, wy, T / 2 + 0.02));
    const fm = mat(pal.frame);
    g.add(box(ww + 0.1, 0.07, 0.1, fm, wx, wy - wh / 2 - 0.02, T / 2 + 0.04));
    g.add(box(ww + 0.1, 0.06, 0.09, fm, wx, wy + wh / 2 + 0.02, T / 2 + 0.04));
    for (const s of [-1, 1]) g.add(box(0.06, wh + 0.1, 0.09, fm, wx + s * (ww / 2 + 0.02), wy, T / 2 + 0.04));
    if (pal.tier >= 1) g.add(box(0.04, wh, 0.08, fm, wx, wy, T / 2 + 0.05)); // mullion
    if (pal.tier >= 1 && rand() < 0.3) {
      for (const s of [-1, 1]) {
        const sh = box(0.28, wh + 0.06, 0.04, mat(pal.shutter), wx + s * (ww / 2 + 0.2), wy, T / 2 + 0.05);
        sh.rotation.y = s * 0.25;
        g.add(sh);
      }
    }
    const win = new THREE.Mesh(new THREE.PlaneGeometry(ww - 0.08, wh - 0.08), GLOW);
    win.position.set(wx, wy, T / 2 + 0.06);
    win.visible = false;
    g.add(win);
    if (lit && !sheeting) glow.push(win);
    // Window boxes on patched-up houses.
    if (pal.tier >= 1 && rand() < 0.35) {
      g.add(box(0.64, 0.14, 0.18, mat(pal.frame), wx, 1.05, T / 2 + 0.12));
      for (let f = 0; f < 4; f++) {
        const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(['#d8607a', '#e8c050', '#f0f0e0', '#b070c0'][Math.floor(rand() * 4)]));
        fl.position.set(wx - 0.22 + f * 0.15, 1.17, T / 2 + 0.12);
        g.add(fl);
      }
    }
  }
  return g;
}

/**
 * Walls of one rectangular block (W along x, D along z, centred at 0) with the
 * door on the +z side at `door`, windows spaced along the sides.
 */
function block(W: number, D: number, h: number, pal: Palette, rand: () => number, glow: THREE.Mesh[],
  opts: { door?: number; backGap?: { at: number; w: number }; skipFront?: boolean; hearthSide: number }): THREE.Group {
  const g = new THREE.Group();
  const winsAlong = (len: number, avoid: number[] = []) => {
    const n = len > 4 ? 2 : 1;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + (len * (i + 1)) / (n + 1) + (rand() - 0.5) * 0.3;
      if (avoid.every((a) => Math.abs(a - x) > 0.95)) out.push(x);
    }
    return out;
  };
  if (!opts.skipFront) {
    const front = wall(W, h, pal, { door: opts.door, windows: winsAlong(W, opts.door !== undefined ? [opts.door] : []) }, rand, glow, true);
    front.position.z = D / 2;
    g.add(front);
  }
  const back = wall(W, h, pal, { gap: opts.backGap, windows: rand() < 0.5 ? winsAlong(W, [opts.hearthSide * (W / 2 - 0.55), ...(opts.backGap ? [opts.backGap.at] : [])]) : [] }, rand, glow, false);
  back.rotation.y = Math.PI;
  back.position.z = -D / 2;
  g.add(back);
  for (const s of [-1, 1]) {
    const side = wall(D, h, pal, { windows: s === opts.hearthSide ? [] : winsAlong(D) }, rand, glow, s !== opts.hearthSide);
    side.rotation.y = s * Math.PI / 2;
    side.position.x = s * W / 2;
    g.add(side);
  }
  return g;
}

function interior(spec: HouseSpec, pal: Palette, rand: () => number): THREE.Group {
  const g = new THREE.Group();
  g.position.y = 0.06; // the floor sits just above the plinth
  const L = homeLayout(spec);
  const { W, D } = spec;
  g.add(box(W - 0.3, 0.05, D - 0.3, mat(pal.tier === 0 ? '#6b5236' : '#8a6a48'), 0, 0.2, 0));
  if (spec.wing) {
    const wg = spec.wing;
    g.add(box(wg.w - 0.3, 0.05, wg.d - 0.2, mat('#7a5e40'), wg.side * (W / 2 - wg.w / 2), 0.2, -D / 2 - wg.d / 2 + 0.05));
  }
  // Rug.
  g.add(box(1.4, 0.02, 1.0, mat(BLANKETS[Math.floor(rand() * BLANKETS.length)]), L.table.x, 0.23, L.table.z));
  // Beds.
  L.beds.forEach((b, i) => {
    const bed = new THREE.Group();
    bed.add(box(0.8, 0.16, 1.8, mat('#5b4330'), 0, 0.3, 0));
    bed.add(box(0.72, 0.08, 1.45, mat(BLANKETS[(spec.seed + i) % BLANKETS.length]), 0, 0.42, 0.15));
    bed.add(box(0.55, 0.09, 0.28, mat('#e8e0cc'), 0, 0.42, -0.68));
    bed.add(box(0.8, 0.5, 0.08, mat('#5b4330'), 0, 0.45, -0.9));
    bed.position.set(b.x, 0, b.z);
    bed.rotation.y = b.yaw;
    g.add(bed);
  });
  // Table and stools.
  g.add(box(1.1, 0.07, 0.7, mat('#7a5a3a'), L.table.x, 0.72, L.table.z));
  for (const [dx, dz] of [[-0.45, -0.28], [0.45, -0.28], [-0.45, 0.28], [0.45, 0.28]]) g.add(box(0.07, 0.5, 0.07, mat('#5b4330'), L.table.x + dx, 0.45, L.table.z + dz));
  g.add(cyl(0.1, 0.12, mat('#c8b890'), L.table.x + 0.2, 0.8, L.table.z, 8));
  for (const s of L.seats.slice(0, Math.min(4, spec.beds + 1))) g.add(box(0.34, 0.3, 0.34, mat('#6b4f33'), s.x, 0.37, s.z));
  // Hearth: a stone firebox with a glow.
  const hx = L.hearth.x, hz = L.hearth.z;
  g.add(box(1.0, 0.9, 0.8, mat('#8f877a'), hx, 0.45, hz));
  g.add(box(0.6, 0.45, 0.1, mat('#1f1a16'), hx, 0.42, hz + 0.36));
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffae4a').multiplyScalar(2.4), toneMapped: false }));
  fire.position.set(hx, 0.36, hz + 0.3);
  g.add(fire);
  glowTex ??= glowTexture();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff9a4a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.45 }));
  halo.position.set(hx, 0.5, hz + 0.45);
  halo.scale.setScalar(1.2);
  g.add(halo);
  // A shelf of pots and a chest.
  const sx = -spec.chimney * (W / 2 - 0.35);
  g.add(box(0.3, 0.9, 0.9, mat('#6b4f33'), sx, 0.65, D / 2 - 1.0));
  for (let i = 0; i < 3; i++) g.add(cyl(0.08, 0.14, mat(['#b0603a', '#c8b890', '#6f8a6a'][i]), sx, 1.18, D / 2 - 1.3 + i * 0.3, 7));
  g.add(box(0.8, 0.4, 0.45, mat('#7a5634'), -spec.chimney * 0.4, 0.4, -D / 2 + 0.4));
  return g;
}

/**
 * A house at construction progress p (0..1). Returns the building group;
 * roof pieces sit in a child tagged `roofGroup` so they can be lifted off.
 */
/** Ground height under a house-local point, relative to the house's floor datum. */
export type LocalGround = (x: number, z: number) => number;

const FOUNDATION = enhance(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
FOUNDATION.userData.noMerge = true;

/**
 * The foundation walls a house stands on: they run from the plinth down to
 * the ground along every outside wall, so on a slope the downhill side shows
 * a tall base of dry stone (or, for salvage houses, stacked timber cribbing)
 * while the uphill side stays low. The terrain itself is never reshaped.
 * Returns the tallest drop, so the caller can add an undercroft or steps.
 */
function foundation(rects: [number, number, number, number][], ground: LocalGround, tier: number, top: number, seed: number): { mesh: THREE.Mesh | null; drop: number; worst: { x: number; z: number; nx: number; nz: number; drop: number } } {
  const rand = makeRand(seed);
  const pos: number[] = [], col: number[] = [];
  const base = tier === 0 ? [[0.42, 0.32, 0.21], [0.35, 0.27, 0.18], [0.47, 0.37, 0.25]] : [[0.56, 0.53, 0.48], [0.5, 0.48, 0.44], [0.62, 0.59, 0.53]];
  const course = tier === 0 ? 0.16 : 0.22;
  let drop = 0;
  let worst = { x: 0, z: 0, nx: 0, nz: 1, drop: 0 };
  const quad = (ax: number, az: number, bx: number, bz: number, y0a: number, y0b: number, y1: number, c: number[]) => {
    // Two triangles, facing outward (counter-clockwise seen from outside).
    pos.push(ax, y1, az, ax, y0a, az, bx, y0b, bz, ax, y1, az, bx, y0b, bz, bx, y1, bz);
    for (let k = 0; k < 6; k++) col.push(c[0], c[1], c[2]);
  };
  for (const [cx, cz, w, d] of rects) {
    const hw = w / 2 + 0.12, hd = d / 2 + 0.12;
    // Corners in order so each edge's outward side is on its right.
    const cs = [[cx - hw, cz + hd], [cx + hw, cz + hd], [cx + hw, cz - hd], [cx - hw, cz - hd]];
    for (let e = 0; e < 4; e++) {
      const [ax, az] = cs[e], [bx, bz] = cs[(e + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(len / 0.45));
      const nx = -(bz - az) / len, nz = (bx - ax) / len;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
        const g0 = Math.min(top - 0.02, ground(x0 + nx * 0.2, z0 + nz * 0.2)) - 0.2;
        const g1 = Math.min(top - 0.02, ground(x1 + nx * 0.2, z1 + nz * 0.2)) - 0.2;
        const dd = top - Math.max(g0, g1) - 0.2;
        if (dd > worst.drop && i > 0 && i < n - 1) worst = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, nx, nz, drop: dd };
        drop = Math.max(drop, top - Math.min(g0, g1) - 0.2);
        // Courses of stone (or timber), each cell its own shade.
        const rows = Math.max(1, Math.ceil((top - Math.min(g0, g1)) / course));
        for (let r = 0; r < rows; r++) {
          const yt = Math.min(top, Math.min(g0, g1) + (r + 1) * course);
          const ya = Math.max(g0, Math.min(g0, g1) + r * course), yb = Math.max(g1, Math.min(g0, g1) + r * course);
          if (yt <= Math.min(ya, yb) + 1e-3) continue;
          const c = base[Math.floor(rand() * 3)], k = 0.9 + rand() * 0.18;
          quad(x0, z0, x1, z1, Math.min(ya, yt), Math.min(yb, yt), yt, [c[0] * k, c[1] * k, c[2] * k]);
        }
      }
    }
  }
  if (!pos.length) return { mesh: null, drop, worst };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, FOUNDATION);
  mesh.castShadow = mesh.receiveShadow = true;
  return { mesh, drop, worst };
}

/** A foundation under a plain rectangular building of W×D (local frame), up to `top`. */
export function foundationUnder(W: number, D: number, ground: LocalGround, tier: number, seed: number, top = 0.02): THREE.Mesh | null {
  return foundation([[0, 0, W - 0.24, D - 0.24]], ground, tier, top, seed).mesh;
}

export function buildHouse(spec: HouseSpec, tier: number, p: number, glow: THREE.Mesh[], ground: LocalGround = () => 0): THREE.Group {
  const g = new THREE.Group();
  g.userData.building = true;
  const rand = makeRand(spec.seed);
  const pal = palette(tier, spec.clad, rand);
  const { W, D, wall: H, chimney } = spec;
  const roof = new THREE.Group();
  roof.userData.roofGroup = true;
  const wg = spec.wing;
  const wingAt = wg ? { x: wg.side * (W / 2 - wg.w / 2), z: -D / 2 - wg.d / 2 } : null;

  // Plinth.
  const plinthK = smooth(0.05, 0.2, p);
  const doorX = -chimney * Math.min(W * 0.2, W / 2 - 1.1);
  if (plinthK > 0) {
    const stone = mat(tier === 0 ? '#6b5236' : '#8f877a');
    g.add(box(W + 0.24, 0.24 * plinthK, D + 0.24, stone, 0, 0.12 * plinthK, 0));
    if (wg && wingAt) g.add(box(wg.w + 0.24, 0.24 * plinthK, wg.d + 0.1, stone, wingAt.x, 0.12 * plinthK, wingAt.z));
    // Down the slope to the ground.
    const rects: [number, number, number, number][] = [[0, 0, W, D]];
    if (wg && wingAt) rects.push([wingAt.x, wingAt.z, wg.w, wg.d - 0.14]);
    const f = foundation(rects, ground, tier, 0.24 * plinthK, spec.seed);
    if (f.mesh) g.add(f.mesh);
    // A tall base gets a little undercroft door: somewhere to keep roots and tools.
    if (p >= 1 && f.worst.drop > 1.0) {
      const u = box(0.55, Math.min(0.8, f.worst.drop - 0.25), 0.06, mat('#2a2622'), f.worst.x + f.worst.nx * 0.13, 0.24 - f.worst.drop + Math.min(0.8, f.worst.drop - 0.25) / 2 + 0.05, f.worst.z + f.worst.nz * 0.13);
      u.rotation.y = Math.atan2(f.worst.nx, f.worst.nz);
      g.add(u);
    }
    // Steps down from the door when the ground falls away in front of it.
    const fall = 0.24 - ground(doorX, D / 2 + (spec.porch ? 1.3 : 0.7));
    if (p >= 1 && fall > 0.2) {
      const n = Math.min(7, Math.ceil(fall / 0.2)), rise = fall / (n + 1);
      const z0 = D / 2 + 0.3 + (spec.porch ? 0.1 : 0);
      for (let i = 0; i < n; i++) {
        const y = 0.24 - rise * (i + 1);
        const gz = ground(doorX, z0 + i * 0.3 + 0.15);
        const h = Math.max(0.1, y - gz + 0.15);
        g.add(box(1.0 - i * 0.02, h, 0.3, mat(tier === 0 ? '#6b5a44' : '#8a8478'), doorX, y - h / 2, z0 + i * 0.3 + 0.15));
      }
    }
  }
  // Corner posts, then walls rising.
  const postK = smooth(0.15, 0.3, p);
  if (postK > 0 && p < 1) {
    for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) g.add(box(0.14, H * postK, 0.14, mat('#6b4f33'), x, 0.24 + (H * postK) / 2, z));
  }
  const wallK = smooth(0.3, 0.72, p);
  if (wallK > 0) {
    const walls = new THREE.Group();
    walls.add(block(W, D, H, pal, rand, glow, {
      door: doorX, hearthSide: chimney,
      backGap: wg ? { at: wg.side * (W / 2 - wg.w / 2), w: Math.min(0.9, wg.w - 0.6) } : undefined,
    }));
    if (wg && wingAt) {
      const wing = block(wg.w, wg.d, H - 0.3, pal, rand, glow, { skipFront: true, hearthSide: -wg.side });
      wing.position.set(wingAt.x, 0, wingAt.z);
      walls.add(wing);
    }
    walls.position.y = 0.24;
    walls.scale.y = wallK;
    g.add(walls);
  }
  // Rafters, then the roof itself.
  const along = spec.ridge === 'along';
  const pitch = tier === 0 ? Math.min(spec.pitch, 0.45) : spec.pitch;
  const roofK = smooth(0.8, 1, p);
  if (p > 0.72) {
    const main = new THREE.Group();
    if (roofK > 0) for (const m of gableRoof(along ? W : D, along ? D : W, pitch, H + 0.24, pal, rand, roofK)) main.add(m);
    else {
      const len = along ? W : D, span = along ? D : W;
      const rise = (span / 2) * Math.tan(pitch);
      for (let i = 0; i <= Math.round(len / 0.8); i++) for (const s of [-1, 1]) {
        const r = box(0.08, 0.08, (span / 2 + 0.3) / Math.cos(pitch), mat('#8a6a44'), -len / 2 + (len * i) / Math.round(len / 0.8), H + 0.24 + rise / 2, (s * span) / 4);
        r.rotation.x = s * pitch;
        main.add(r);
      }
    }
    if (!along) main.rotation.y = Math.PI / 2;
    roof.add(main);
    if (wg && wingAt) {
      // The wing's roof runs the other way, a little lower.
      const wr = new THREE.Group();
      const wAlong = !along;
      for (const m of gableRoof(wAlong ? wg.w : wg.d + 0.3, wAlong ? wg.d + 0.3 : wg.w, pitch * 0.9, H - 0.3 + 0.24, pal, rand, Math.max(0.3, roofK))) wr.add(m);
      if (!wAlong) wr.rotation.y = Math.PI / 2;
      wr.position.set(wingAt.x, 0, wingAt.z - 0.15);
      roof.add(wr);
    }
  }
  // Chimney through the roof above the hearth.
  if (p > 0.6) {
    const L = homeLayout(spec);
    const span = along ? D : W;
    const top = H + 0.24 + (span / 2) * Math.tan(pitch) + 0.5;
    if (tier === 0 || !pal.brick) {
      // A stovepipe: salvaged flue, a rain cap, soot at the top.
      const pipe = mat('#4a4a48');
      roof.add(cyl(0.12, top - H + 0.3, pipe, L.hearth.x, H + 0.24 + (top - H + 0.3) / 2 - 0.3, L.hearth.z - 0.15, 8));
      roof.add(cyl(0.22, 0.05, mat('#2e2c2a'), L.hearth.x, top + 0.34, L.hearth.z - 0.15, 8));
    } else {
      const brick = cm({ color: '#8a4a3a', surface: 'brick' });
      g.add(box(0.55, H, 0.55, brick, L.hearth.x, 0.24 + H / 2, L.hearth.z - 0.15));
      roof.add(box(0.55, top - H - 0.24, 0.55, brick, L.hearth.x, H + 0.24 + (top - H - 0.24) / 2, L.hearth.z - 0.15));
      roof.add(box(0.65, 0.1, 0.65, mat('#6b6458'), L.hearth.x, top + 0.02, L.hearth.z - 0.15));
    }
  }
  if (p >= 1) {
    const span = along ? D : W, len = along ? W : D;
    const rise = (span / 2) * Math.tan(pitch);
    // A shack's rain catcher: an old satellite dish on a bracket, tipped up.
    if (tier === 0 && rand() < 0.6) {
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 5, 0, Math.PI * 2, 0, 0.9), mat('#c8c8c0'));
      dish.rotation.x = Math.PI;
      dish.position.set(chimney * (W / 2 - 0.4), H + 0.5, D / 2 + 0.2);
      dish.castShadow = true;
      roof.add(dish);
    }
    if (tier >= 2) {
      // Solar panels from the old roofs, on the front slope.
      const n = Math.max(2, Math.floor(len / 1.3));
      const slope = new THREE.Group();
      for (let i = 0; i < n; i++) {
        if (Math.abs(-len / 2 + (len * (i + 0.5)) / n - (along ? homeLayout(spec).hearth.x : 0)) < 0.5 && along) continue;
        slope.add(box(1.0, 0.05, 1.4, mat('#2a3a5a'), -len / 2 + (len * (i + 0.5)) / n, 0, 0));
        slope.add(box(1.04, 0.03, 0.05, mat('#a8aca8'), -len / 2 + (len * (i + 0.5)) / n, 0.02, 0));
      }
      // Halfway down the front slope, just proud of it.
      slope.position.set(0, H + 0.24 + rise * 0.5 + 0.1, span * 0.25);
      slope.rotation.x = pitch;
      const holder = new THREE.Group();
      holder.add(slope);
      if (!along) holder.rotation.y = Math.PI / 2;
      roof.add(holder);
      // A lean-to glasshouse on the side away from the hearth.
      const side = -chimney, gw = 1.6, gd = Math.min(D - 0.6, 3.2), gh = 2.1;
      const gx = side * (W / 2 + gw / 2);
      const frame = mat('#e8e4d8'), glass = tagOutline(mat('#9ec4bf', true, 'glass'), 'glass');
      const gy = Math.min(0, ground(gx, 0));
      g.add(box(gw, 0.3 - gy, gd, cm({ color: '#8a4a3a', surface: 'brick' }), gx, (0.3 + gy) / 2, 0));
      for (const z of [-gd / 2, gd / 2]) for (const x of [gx - side * gw / 2 + side * 0.05, gx + side * gw / 2 - side * 0.05]) {
        const hh = x === gx + side * gw / 2 - side * 0.05 ? gh - 0.6 : gh;
        g.add(box(0.07, hh, 0.07, frame, x, 0.3 + hh / 2, z));
      }
      for (const z of [-gd / 2 + 0.03, gd / 2 - 0.03]) g.add(box(gw - 0.1, gh - 0.7, 0.03, glass, gx, 0.3 + (gh - 0.7) / 2 + 0.05, z));
      g.add(box(0.03, gh - 0.9, gd - 0.1, glass, gx + side * (gw / 2 - 0.05), 0.3 + (gh - 0.9) / 2 + 0.05, 0));
      const lid = box(gw + 0.1, 0.04, gd + 0.1, glass, gx, 0.3 + gh - 0.3, 0);
      lid.rotation.z = side * -Math.atan2(0.6, gw);
      roof.add(lid);
      // Seedlings on staging inside.
      g.add(box(gw * 0.6, 0.06, gd * 0.8, mat('#6b4f33'), gx, 0.95, 0));
      for (let k = 0; k < 6; k++) {
        const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), mat(['#5f8a3a', '#7a9a44', '#4f7a34'][k % 3]));
        pl.position.set(gx + (rand() - 0.5) * gw * 0.5, 1.08, (rand() - 0.5) * gd * 0.7);
        g.add(pl);
      }
    }
  }
  // Porch over the door.
  if (spec.porch && p >= 1) {
    const fm = mat(pal.frame);
    for (const s of [-1, 1]) {
      // Posts reach the ground, wherever it is; a stone pad under each.
      const gy = Math.min(0.1, ground(doorX + s * 0.75, D / 2 + 1.0));
      g.add(box(0.1, 2.2 - gy, 0.1, fm, doorX + s * 0.75, (2.2 + gy) / 2, D / 2 + 1.0));
      g.add(box(0.2, 0.12, 0.2, mat('#7d7a70'), doorX + s * 0.75, gy + 0.03, D / 2 + 1.0));
    }
    const pr = box(1.9, 0.08, 1.35, mat(pal.roof), doorX, 2.3, D / 2 + 0.62);
    pr.rotation.x = 0.28;
    roof.add(pr);
  }
  if (p >= 1) g.add(interior(spec, pal, rand));
  g.add(roof);
  return g;
}
