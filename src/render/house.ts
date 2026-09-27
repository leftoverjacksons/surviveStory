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
import { homeLayout, type HouseSpec } from '../sim/homes';
import { GLOW, box, cyl, mat, smooth } from './kit';
import { enhance, glowTexture, makeRand } from './util';

const DAUB = ['#e9dcc0', '#e2d2b0', '#efe4cb', '#dccbb0', '#e6d6c4', '#d9d0bc'];
const FRAME = ['#4f3a28', '#5a4330', '#3f3226', '#634a34'];
const PANELS = ['#8a5a3a', '#6d7b80', '#5f7f78', '#8e6a4f', '#7b4a3c', '#9a9486', '#a88a5a'];
const SHUTTERS = ['#5f7f6a', '#4f6f8a', '#8a4f3f', '#6f6a8a', '#8a7a4a', '#4f7a78'];
const BLANKETS = ['#6f7d5c', '#8a6a4a', '#5a6b7a', '#7a4f45', '#9a8a60', '#4f6a5a', '#7a6a8a'];
const THATCH = ['#b89a5c', '#a88c52', '#c2a468'];
const SHINGLE = ['#6e4f3a', '#5f4a3e', '#7a5a44'];
const TIN = ['#7d8a8c', '#8a8f86', '#6f7a7a'];

let glowTex: THREE.Texture | null = null;

interface Palette {
  wall: string; frame: string; roof: string; roofKind: 'thatch' | 'shingle' | 'tin'; shutter: string; tier: number;
}

function palette(tier: number, rand: () => number): Palette {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  if (tier === 0) return { wall: pick(PANELS), frame: '#5b4632', roof: pick(TIN), roofKind: 'tin', shutter: pick(SHUTTERS), tier };
  const thatch = rand() < 0.55;
  return {
    wall: pick(DAUB), frame: pick(FRAME), roof: thatch ? pick(THATCH) : pick(SHINGLE), roofKind: thatch ? 'thatch' : 'shingle',
    shutter: pick(SHUTTERS), tier,
  };
}

/** A gable roof over a W×D block, ridge along local x. Returns meshes for the roof group. */
function gableRoof(len: number, span: number, pitch: number, eaves: number, pal: Palette, rand: () => number, k = 1): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const over = pal.roofKind === 'thatch' ? 0.45 : 0.35;
  const thick = pal.roofKind === 'thatch' ? 0.28 : pal.roofKind === 'tin' ? 0.06 : 0.12;
  const half = span / 2 + over;
  const rise = (span / 2) * Math.tan(pitch);
  const slopeLen = half / Math.cos(pitch);
  const roofM = mat(pal.roof);
  for (const s of [-1, 1]) {
    const slab = box(len + over * 2, thick, slopeLen * k, roofM, 0, eaves + rise / 2 - over * Math.tan(pitch) / 2 + thick / 2, s * (half / 2) * (2 - k));
    slab.rotation.x = s * pitch;
    out.push(slab);
    if (pal.roofKind === 'tin' && k >= 1 && rand() < 0.7) {
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
    const gm = mat(pal.tier === 0 ? pal.wall : pal.wall);
    for (const sx of [-1, 1]) {
      const tri = new THREE.Mesh(geo, gm);
      tri.rotation.y = Math.PI / 2;
      tri.position.set(sx * (len / 2 - 0.02), eaves, 0);
      tri.castShadow = tri.receiveShadow = true;
      out.push(tri);
      if (pal.tier === 1) {
        // A king post and collar in the gable, timber-frame style.
        out.push(box(0.1, rise * 0.9, 0.1, mat(pal.frame), sx * (len / 2 + 0.03), eaves + rise * 0.45, 0));
        out.push(box(0.1, 0.1, span * 0.55, mat(pal.frame), sx * (len / 2 + 0.03), eaves + rise * 0.45, 0));
      }
    }
    if (pal.roofKind !== 'tin') {
      const ridge = box(len + over * 2 + 0.1, 0.16, 0.34, mat(pal.roofKind === 'thatch' ? '#8c7040' : '#4a3a30'), 0, eaves + rise + 0.08, 0);
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
  const wallM = mat(pal.wall);
  for (const [a, b] of runs) {
    if (pal.tier === 0) {
      // Salvage: mismatched panels, a little uneven.
      const n = Math.max(1, Math.round((b - a) / 0.5));
      for (let i = 0; i < n; i++) {
        const w0 = (b - a) / n;
        const ph = h * (0.96 + rand() * 0.08);
        g.add(box(w0 - 0.02, ph, T, mat(rand() < 0.55 ? pal.wall : PANELS[Math.floor(rand() * PANELS.length)]), a + w0 * (i + 0.5), ph / 2, 0));
      }
    } else {
      g.add(box(b - a, h, T, wallM, (a + b) / 2, h / 2, 0));
    }
  }
  // Openings: lintel over the door and gap.
  for (const [a, b] of holes) g.add(box(b - a, h - 1.95, T, wallM, (a + b) / 2, 1.95 + (h - 1.95) / 2, 0));
  if (pal.tier === 1) {
    // Timber frame: sill, wall plate, posts, and a brace or two.
    const fm = mat(pal.frame);
    g.add(box(len + 0.04, 0.14, T + 0.05, fm, 0, 0.07, 0));
    g.add(box(len + 0.04, 0.14, T + 0.05, fm, 0, h - 0.07, 0));
    const posts = Math.max(2, Math.round(len / 1.4) + 1);
    for (let i = 0; i < posts; i++) {
      const px = -len / 2 + (len * i) / (posts - 1);
      if (holes.some(([a, b]) => px > a - 0.05 && px < b + 0.05)) continue;
      g.add(box(0.12, h, T + 0.05, fm, px, h / 2, 0));
      if (i < posts - 1 && rand() < 0.45) {
        const nx = -len / 2 + (len * (i + 1)) / (posts - 1);
        if (holes.some(([a, b]) => nx > a - 0.3 && px < b + 0.3)) continue;
        const bl = Math.hypot(nx - px, h * 0.8);
        const brace = box(0.09, bl, T + 0.04, fm, (px + nx) / 2, h * 0.45, 0);
        brace.rotation.z = Math.atan2(nx - px, h * 0.8) * (rand() < 0.5 ? 1 : -1);
        g.add(brace);
      }
    }
  }
  if (o.door !== undefined) {
    g.add(box(0.86, 1.9, 0.07, mat(pal.tier === 0 ? '#3f6f9a' : '#5b4330'), o.door, 0.97, T / 2 + 0.02));
    g.add(box(0.06, 0.06, 0.08, mat('#c8b070'), o.door + 0.3, 1.0, T / 2 + 0.07));
    g.add(box(1.0, 0.12, 0.3, mat('#7d7a70'), o.door, 0.06, T / 2 + 0.15)); // step
  }
  for (const wx of o.windows) {
    g.add(box(0.62, 0.56, 0.06, mat('#2a3236'), wx, 1.4, T / 2 + 0.02));
    g.add(box(0.72, 0.08, 0.1, mat(pal.frame), wx, 1.1, T / 2 + 0.04));
    for (const s of [-1, 1]) {
      const sh = box(0.3, 0.6, 0.04, mat(pal.shutter), wx + s * 0.48, 1.4, T / 2 + 0.05);
      sh.rotation.y = s * 0.25;
      g.add(sh);
    }
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.46), GLOW);
    win.position.set(wx, 1.4, T / 2 + 0.06);
    win.visible = false;
    g.add(win);
    if (lit) glow.push(win);
    // Window boxes on some timber houses.
    if (pal.tier === 1 && rand() < 0.35) {
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
  const pal = palette(tier, rand);
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
    const stone = mat(tier === 0 ? '#5a5a50' : '#8f877a');
    const lower = box(0.55, H, 0.55, stone, L.hearth.x, 0.24 + H / 2, L.hearth.z - 0.15);
    g.add(lower);
    const upper = box(0.55, top - H - 0.24, 0.55, stone, L.hearth.x, H + 0.24 + (top - H - 0.24) / 2, L.hearth.z - 0.15);
    roof.add(upper);
    roof.add(box(0.65, 0.1, 0.65, mat('#6b6458'), L.hearth.x, top + 0.02, L.hearth.z - 0.15));
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
