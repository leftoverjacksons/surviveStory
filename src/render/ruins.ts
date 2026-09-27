/**
 * Ruins of the old world (see sim/oldworld.ts): suburban houses and garages,
 * retail units and a superstore, a works shed, a barn and silo, terraces and
 * a chapel, glasshouses. Built from boxes like the village, but in the old
 * world's materials (vinyl siding, brick, corrugated steel, plate glass,
 * shop signs), broken open by decay and grown over. Each district is merged
 * into a handful of meshes.
 */
import * as THREE from 'three';
import type { Ruin } from '../sim/oldworld';
import { heightAt, type World } from '../sim/world';
import { box, cyl, mat } from './kit';
import { mergeStatic } from './merge';
import { enhance, glowTexture, makeRand } from './util';

const SIDING = ['#b9c79a', '#c9b98e', '#9ab5bf', '#c7a38f', '#a7c0a4', '#d1c29a', '#8fa7b8', '#c4a4a8'];
const BRICK = ['#8a4a3a', '#7d4536', '#96583f', '#7a5040'];
const STEEL = ['#8a9296', '#6f7d78', '#94877a', '#7a8a96'];
const FASCIA = ['#c8503a', '#3a6a9a', '#d8a040', '#4a8a5a', '#8a4a8a', '#d06a3a'];
const IVY = ['#4f6b34', '#5f7a3a', '#3f5a2c'];

const cache = new Map<string, THREE.Material>();
/** A material with a named surface texture ('brick', 'corrugated'); plain ones share the kit's. */
function M(color: string, surface: 'auto' | 'brick' | 'corrugated' = 'auto'): THREE.Material {
  if (surface === 'auto') return mat(color);
  const key = `${color}|${surface}`;
  let m = cache.get(key);
  if (!m) { m = enhance(new THREE.MeshLambertMaterial({ color, flatShading: true }), { surface }); cache.set(key, m); }
  return m;
}

interface Opts {
  wall: THREE.Material;
  /** Windows along the front and back, as fractions of the wall (0..1). */
  windows?: number[];
  /** Door position along the front (fraction), if any. */
  door?: number;
  /** Width of a front opening (shopfront, garage door, loading bay). */
  opening?: { at: number; w: number; h: number; fill?: THREE.Material; fillH?: number };
  windowH?: [number, number];
}

/**
 * One wall along local x from -len/2 to len/2 at height h, broken by decay:
 * columns crumble away below the top, more where the wall has given way.
 */
function wall(g: THREE.Group, len: number, h: number, T: number, o: Opts, rand: () => number, decay: number, front: boolean) {
  const col = 0.55;
  const n = Math.max(1, Math.round(len / col));
  const cw = len / n;
  const breach = rand() * len - len / 2, breachW = decay * len * (0.25 + rand() * 0.4);
  const [w0, w1] = o.windowH ?? [0.95, 1.9];
  const glass = mat('#1f2a2e'), board = mat('#7a6446');
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + cw * (i + 0.5);
    const u = (x + len / 2) / len;
    // How much of this column still stands.
    const inBreach = Math.abs(x - breach) < breachW / 2;
    let top = h * (inBreach ? 0.15 + rand() * 0.45 : 1 - decay * rand() * 0.25);
    top = Math.max(0.25, top);
    const door = o.door !== undefined && front && Math.abs(u - o.door) * len < 0.55;
    const open = o.opening && front && Math.abs(x - o.opening.at * len + len / 2) < o.opening.w / 2;
    const win = !door && !open && (o.windows ?? []).some((f) => Math.abs(u - f) * len < 0.45);
    if (open) {
      const oh = o.opening!.h;
      if (top > oh) g.add(box(cw + 0.01, top - oh, T, o.wall, x, oh + (top - oh) / 2, 0));
      if (o.opening!.fill && !inBreach && rand() > decay * 0.6) {
        const fh = o.opening!.fillH ?? oh;
        g.add(box(cw + 0.01, fh, 0.06, o.opening!.fill, x, fh / 2, T / 2 - 0.03));
      }
      continue;
    }
    if (door) {
      if (top > 2.0) g.add(box(cw + 0.01, top - 2.0, T, o.wall, x, 2.0 + (top - 2.0) / 2, 0));
      continue;
    }
    if (win && top > w1) {
      g.add(box(cw + 0.01, w0, T, o.wall, x, w0 / 2, 0));
      g.add(box(cw + 0.01, top - w1, T, o.wall, x, w1 + (top - w1) / 2, 0));
      // Dark glass, broken glass, or boarded up.
      const r = rand();
      if (r < 0.45) g.add(box(cw + 0.01, w1 - w0, 0.05, glass, x, (w0 + w1) / 2, (front ? 1 : -1) * T * 0.2));
      else if (r < 0.7) g.add(box(cw + 0.01, (w1 - w0) * 0.9, 0.06, board, x, (w0 + w1) / 2, (front ? 1 : -1) * (T / 2 + 0.02)));
      continue;
    }
    g.add(box(cw + 0.01, top, T, o.wall, x, top / 2, 0));
  }
}

/** Four walls around a W×D footprint; front is +z. */
function shell(g: THREE.Group, W: number, D: number, h: number, o: Opts, rand: () => number, decay: number) {
  const T = 0.22;
  const sides: [number, number, number, boolean, number][] = [
    [0, D / 2, 0, true, W], [0, -D / 2, Math.PI, false, W], [W / 2, 0, Math.PI / 2, false, D], [-W / 2, 0, -Math.PI / 2, false, D],
  ];
  for (const [x, z, ry, front, len] of sides) {
    const s = new THREE.Group();
    wall(s, len + (front || ry === Math.PI ? T : -T), h, T, { ...o, windows: front || ry === Math.PI ? o.windows : [0.3, 0.7].filter(() => rand() < 0.6) }, rand, decay * (front ? 0.7 : 1), front);
    s.position.set(x, 0, z);
    s.rotation.y = ry;
    g.add(s);
  }
  // A floor slab, dark with dirt.
  g.add(box(W, 0.1, D, mat('#4a4740'), 0, 0.05, 0));
}

/** A gable roof over W×D (ridge along x), in strips; decay pulls strips away and bares the rafters. */
function gable(g: THREE.Group, W: number, D: number, h: number, pitch: number, cover: THREE.Material, rand: () => number, decay: number) {
  const rise = (D / 2) * Math.tan(pitch), slope = (D / 2 + 0.3) / Math.cos(pitch);
  const rafter = mat('#5a4632');
  const strips = Math.max(3, Math.round(W / 1.1));
  const hole = rand() * W - W / 2, holeW = decay * W * (0.3 + rand() * 0.5);
  for (const s of [-1, 1]) {
    for (let i = 0; i < strips; i++) {
      const x = -W / 2 - 0.2 + ((W + 0.4) * (i + 0.5)) / strips;
      const gone = Math.abs(x - hole) < holeW / 2 && (s > 0 || rand() < 0.6);
      const slab = gone
        ? box(0.08, 0.1, slope, rafter, x, h + rise / 2, s * D / 4)
        : box((W + 0.4) / strips + 0.01, 0.1, slope, cover, x, h + rise / 2, s * D / 4);
      slab.rotation.x = s * pitch;
      g.add(slab);
    }
  }
  // Gable ends.
  for (const e of [-1, 1]) {
    const tri = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, rise)]);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.2, bevelEnabled: false }), g.userData.wallMat ?? cover);
    m.rotation.y = Math.PI / 2;
    m.position.set(e * W / 2 - 0.1, h, 0);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
}

/** A flat roof in panels, with a parapet; decay opens holes. */
function flat(g: THREE.Group, W: number, D: number, h: number, cover: THREE.Material, rand: () => number, decay: number) {
  const nx = Math.max(1, Math.round(W / 1.6)), nz = Math.max(1, Math.round(D / 1.6));
  const hx = rand() * W - W / 2, hz = rand() * D - D / 2, hr = decay * Math.min(W, D) * 0.55;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = -W / 2 + (W * (i + 0.5)) / nx, z = -D / 2 + (D * (j + 0.5)) / nz;
    if (Math.hypot(x - hx, z - hz) < hr || rand() < decay * 0.12) continue;
    g.add(box(W / nx + 0.01, 0.14, D / nz + 0.01, cover, x, h + 0.07, z));
  }
  // Rooftop plant: air-handling units, vents, a skylight or two, moss in the corners.
  const units = Math.floor((W * D) / 30);
  for (let k = 0; k < units; k++) {
    const x = (rand() - 0.5) * (W - 2), z = (rand() - 0.5) * (D - 2);
    if (Math.hypot(x - hx, z - hz) < hr + 0.8) continue;
    const r = rand();
    if (r < 0.4) {
      g.add(box(1.2, 0.7, 0.9, mat('#9a9c98'), x, h + 0.5, z));
      g.add(cyl(0.28, 0.08, mat('#3a3c3a'), x, h + 0.88, z, 10));
    } else if (r < 0.7) {
      g.add(box(1.6, 0.12, 1.1, mat('#6a8a90'), x, h + 0.2, z));
      g.add(box(1.7, 0.18, 0.08, mat('#8a8a86'), x, h + 0.2, z + 0.58));
    } else g.add(cyl(0.14, 0.6, mat('#7a7c78'), x, h + 0.44, z, 6));
  }
  for (let k = 0; k < Math.round(W / 3); k++) {
    const x = (rand() - 0.5) * W * 0.9, z = (rand() < 0.5 ? -1 : 1) * (D / 2 - 0.5);
    g.add(box(0.8 + rand(), 0.06, 0.6 + rand() * 0.5, mat(IVY[Math.floor(rand() * 3)]), x, h + 0.16, z));
  }
  // Parapet.
  for (const s of [-1, 1]) {
    g.add(box(W + 0.2, 0.4, 0.18, cover, 0, h + 0.2, s * (D / 2)));
    g.add(box(0.18, 0.4, D + 0.2, cover, s * (W / 2), h + 0.2, 0));
  }
}

function ivy(g: THREE.Group, W: number, D: number, h: number, rand: () => number, amount: number) {
  const n = Math.round(amount * (W + D) * 1.2);
  for (let i = 0; i < n; i++) {
    const side = Math.floor(rand() * 4);
    const along = (rand() - 0.5) * (side < 2 ? W : D);
    const y = rand() * h * 0.8;
    const s = 0.25 + rand() * 0.5;
    const x = side === 2 ? W / 2 + 0.12 : side === 3 ? -W / 2 - 0.12 : along;
    const z = side === 0 ? D / 2 + 0.12 : side === 1 ? -D / 2 - 0.12 : along;
    g.add(box(side < 2 ? s : 0.08, s * 1.4, side < 2 ? 0.08 : s, mat(IVY[Math.floor(rand() * 3)]), x, y + s * 0.7, z));
  }
  // Scrub growing where the floor is open to the sky.
  for (let i = 0; i < Math.round(amount * 4); i++) {
    const r = 0.3 + rand() * 0.4;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(IVY[Math.floor(rand() * 3)]));
    b.position.set((rand() - 0.5) * W * 0.7, r * 0.6, (rand() - 0.5) * D * 0.7);
    b.castShadow = true;
    g.add(b);
  }
}

/** Faded lettering on a sign: pale blocks, like a word seen from far off. */
function lettering(g: THREE.Group, len: number, y: number, z: number, rand: () => number) {
  const n = Math.floor(len / 0.36);
  const pale = mat('#e8dcc0');
  for (let i = 0; i < n; i++) {
    if (rand() < 0.25) continue; // letters fallen off
    g.add(box(0.2, 0.3 + (rand() < 0.3 ? 0.1 : 0), 0.04, pale, -len / 2 + 0.2 + i * 0.36, y, z));
  }
}

export function buildRuin(r: Ruin): THREE.Group {
  const g = new THREE.Group();
  const rand = makeRand(r.seed);
  const { w: W, d: D, h } = r;
  // Restored: walls made good, roof patched, the worst of the growth cut back.
  const decay = r.restored ? Math.min(0.05, r.decay) : r.decay;
  const roofy = decay < 0.9;
  switch (r.kind) {
    case 'house': {
      const wallM = M(SIDING[r.tone % SIDING.length]);
      g.userData.wallMat = wallM;
      shell(g, W, D, h, { wall: wallM, windows: [0.2, 0.75], door: 0.45 }, rand, decay);
      // A brick plinth course, a chimney, a porch slab.
      g.add(box(W + 0.05, 0.45, D + 0.05, M(BRICK[r.tone % BRICK.length], 'brick'), 0, 0.22, 0));
      if (roofy) gable(g, W, D, h, 0.5, mat(['#5a5652', '#4a4e52', '#6a5a4e'][r.tone % 3]), rand, decay);
      if (rand() < 0.7) g.add(box(0.6, h * 0.5 + 1.8, 0.6, M(BRICK[(r.tone + 1) % BRICK.length], 'brick'), W / 2 - 0.9, (h * 0.5 + 1.8) / 2 + h * 0.5, -0.4));
      g.add(box(1.8, 0.14, 1.2, mat('#8a857a'), -W * 0.05, 0.07, D / 2 + 0.6));
      break;
    }
    case 'garage': {
      const wallM = M(SIDING[r.tone % SIDING.length]);
      shell(g, W, D, h, { wall: wallM, opening: { at: 0.5, w: 2.8, h: 2.0, fill: M('#b8b4a8', 'corrugated'), fillH: 2.0 - decay * 1.2 } }, rand, decay);
      if (roofy) flat(g, W, D, h, mat('#4f4c48'), rand, decay);
      break;
    }
    case 'shop': {
      const wallM = M(BRICK[r.tone % BRICK.length], 'brick');
      shell(g, W, D, h, { wall: wallM, opening: { at: 0.5, w: W * 0.8, h: 2.6, fill: mat('#2a363a'), fillH: 2.4 * (1 - decay * 0.7) } }, rand, decay * 0.8);
      if (roofy) flat(g, W, D, h, mat('#55534e'), rand, decay);
      // The shop sign: a coloured fascia with what's left of its letters.
      const fc = FASCIA[(r.tone + r.seed) % FASCIA.length];
      g.add(box(W + 0.1, 0.7, 0.14, mat(fc), 0, h - 0.1, D / 2 + 0.16));
      lettering(g, W * 0.8, h - 0.1, D / 2 + 0.25, rand);
      // Awning frame, its canvas long gone (or tattered).
      for (const s of [-1, 1]) g.add(box(0.06, 0.06, 1.2, mat('#3a3a38'), s * (W / 2 - 0.3), 2.75, D / 2 + 0.7));
      if (rand() < 0.5) {
        const aw = box(W * 0.6, 0.05, 1.2, mat(FASCIA[(r.tone + 2) % FASCIA.length]), (rand() - 0.5), 2.55, D / 2 + 0.7);
        aw.rotation.x = 0.35;
        g.add(aw);
      }
      break;
    }
    case 'bigbox': {
      const wallM = M(STEEL[r.tone % STEEL.length], 'corrugated');
      shell(g, W, D, h, { wall: wallM, opening: { at: 0.3, w: 4.5, h: 3.0, fill: mat('#2a363a'), fillH: 2.8 * (1 - decay) } }, rand, decay * 0.6);
      if (roofy) flat(g, W, D, h, mat('#6a6862'), rand, decay);
      const fc = FASCIA[(r.tone + r.seed) % FASCIA.length];
      g.add(box(W * 0.55, 1.2, 0.2, mat(fc), W * 0.12, h + 0.3, D / 2 + 0.15));
      lettering(g, W * 0.45, h + 0.3, D / 2 + 0.28, rand);
      // Entrance canopy on two posts.
      g.add(box(5.5, 0.18, 2.2, mat('#8a8a86'), -W * 0.2, 3.3, D / 2 + 1.2));
      for (const s of [-1, 1]) g.add(box(0.14, 3.3, 0.14, mat('#5a5a58'), -W * 0.2 + s * 2.5, 1.65, D / 2 + 2.1));
      break;
    }
    case 'warehouse':
    case 'shed': {
      const wallM = M(STEEL[r.tone % STEEL.length], 'corrugated');
      const big = r.kind === 'warehouse';
      shell(g, W, D, h, { wall: wallM, opening: big ? { at: 0.35, w: 4, h: 4.2, fill: M('#8a8478', 'corrugated'), fillH: 4.2 * (1 - decay * 0.8) } : { at: 0.5, w: W * 0.7, h: h - 0.4 }, windowH: [h - 1.4, h - 0.6], windows: big ? [0.7, 0.85] : [] }, rand, decay * 0.7);
      // A shallow roof on steel trusses; decay leaves only the trusses.
      const n = Math.max(3, Math.round(W / 3));
      for (let i = 0; i <= n; i++) g.add(box(0.14, 0.4, D, mat('#5a5a58'), -W / 2 + (W * i) / n, h + 0.2, 0));
      if (roofy) gable(g, W, D, h + 0.2, 0.12, M('#7a7a74', 'corrugated'), rand, decay);
      if (big) g.add(box(W * 0.5, 1.1, 2.5, mat('#6a6862'), W * 0.1, 0.55, D / 2 + 1.25)); // loading dock
      break;
    }
    case 'barn': {
      const wallM = mat(['#8a3a2e', '#7a4a34', '#6e3a30'][r.tone % 3]);
      g.userData.wallMat = wallM;
      shell(g, W, D, h, { wall: wallM, opening: { at: 0.5, w: 3.4, h: 3.2 } }, rand, decay * 0.8);
      if (roofy) gable(g, W, D, h, 0.75, M('#6a6a66', 'corrugated'), rand, decay);
      break;
    }
    case 'silo': {
      const body = cyl(W / 2, h, M('#9a9690', 'corrugated'), 0, h / 2, 0, 16);
      g.add(body);
      for (let i = 1; i < 5; i++) g.add(cyl(W / 2 + 0.04, 0.08, mat('#6a6660'), 0, (h * i) / 5, 0, 16));
      const cap = new THREE.Mesh(new THREE.ConeGeometry(W / 2 + 0.15, 1.3, 16), mat('#7a3a2e'));
      cap.position.y = h + 0.65;
      cap.rotation.z = decay * 0.25;
      cap.castShadow = true;
      g.add(cap);
      break;
    }
    case 'farmhouse':
    case 'terrace': {
      const wallM = M(BRICK[r.tone % BRICK.length], 'brick');
      g.userData.wallMat = wallM;
      shell(g, W, D, h, { wall: wallM, windows: r.kind === 'terrace' ? [0.25] : [0.2, 0.8], door: r.kind === 'terrace' ? 0.7 : 0.5 }, rand, decay);
      if (roofy) gable(g, W, D, h, 0.62, mat(['#3e4448', '#4a4a4e', '#524a46'][r.tone % 3]), rand, decay);
      if (rand() < 0.8) g.add(box(0.5, 1.4, 0.9, M(BRICK[(r.tone + 1) % BRICK.length], 'brick'), W / 2 - 0.2, h + 1.0, 0));
      break;
    }
    case 'chapel': {
      const wallM = mat('#8a8578');
      g.userData.wallMat = wallM;
      shell(g, W, D, h, { wall: wallM, windows: [0.5], door: 0.5, windowH: [1.2, 3.4] }, rand, decay * 0.7);
      if (roofy) gable(g, W, D, h, 0.9, mat('#3e4448'), rand, decay);
      // A small tower and spire over the door.
      g.add(box(2.2, h + 3.2, 2.2, wallM, 0, (h + 3.2) / 2, D / 2 - 1.1));
      const sp = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.6, 4), mat('#3e4448'));
      sp.position.set(0, h + 3.2 + 1.8, D / 2 - 1.1);
      sp.rotation.y = Math.PI / 4;
      sp.castShadow = true;
      g.add(sp);
      break;
    }
    case 'glasshouse': {
      // An aluminium frame, glass in some panes.
      const frame = mat('#a8aca8'), pane = mat('#9ec4bf');
      const nx = Math.round(W / 1.2), nz = Math.round(D / 1.2);
      for (let i = 0; i <= nx; i++) for (const s of [-1, 1]) g.add(box(0.06, h, 0.06, frame, -W / 2 + (W * i) / nx, h / 2, s * D / 2));
      for (let j = 0; j <= nz; j++) for (const s of [-1, 1]) g.add(box(0.06, h, 0.06, frame, s * W / 2, h / 2, -D / 2 + (D * j) / nz));
      const rise = 1.4;
      for (let i = 0; i <= nx; i++) for (const s of [-1, 1]) {
        const b = box(0.05, 0.05, Math.hypot(D / 2, rise), frame, -W / 2 + (W * i) / nx, h + rise / 2, s * D / 4);
        b.rotation.x = s * Math.atan2(rise, D / 2);
        g.add(b);
      }
      for (let i = 0; i < nx; i++) for (const s of [-1, 1]) {
        if (rand() < decay) continue;
        g.add(box(W / nx - 0.08, h - 0.1, 0.03, pane, -W / 2 + (W * (i + 0.5)) / nx, h / 2, s * D / 2));
        if (rand() < 1 - decay) {
          const p = box(W / nx - 0.08, 0.03, Math.hypot(D / 2, rise) - 0.1, pane, -W / 2 + (W * (i + 0.5)) / nx, h + rise / 2, s * D / 4);
          p.rotation.x = s * Math.atan2(rise, D / 2);
          g.add(p);
        }
      }
      // Beds gone wild inside.
      ivy(g, W * 0.6, D * 0.5, 0.2, rand, 3);
      break;
    }
  }
  if (r.kind !== 'glasshouse' && r.kind !== 'silo') ivy(g, W, D, h, rand, 0.4 + decay * 1.2);
  if (r.restored) {
    // Lived in again: a salvaged panel on the roof, and a warm window at night.
    if (r.kind !== 'glasshouse' && r.kind !== 'silo' && r.kind !== 'chapel') {
      const panel = box(Math.min(2.2, W * 0.35), 0.06, 1.2, mat('#27364f'), W * 0.18, h + 0.9, D * 0.12);
      panel.rotation.x = -0.45;
      g.add(panel);
    }
    // Lamplight at the windows, front and back (a soft glow that reads from any side).
    for (const side of [1, -1]) {
      const lit = new THREE.Sprite(RESTORED_GLOW);
      lit.position.set(side * W * 0.22, Math.min(h * 0.5, 1.4), side * (D / 2 + 0.3));
      lit.scale.setScalar(1.8);
      lit.userData.keep = true;
      g.add(lit);
    }
  }
  g.rotation.y = r.yaw;
  return g;
}

/** Windows of restored buildings: lit from dusk (the view sets its opacity by the night). */
export const RESTORED_GLOW = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffc978', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

function buildDistrict(world: World, id: number): THREE.Group {
  const d = new THREE.Group();
  d.userData.district = id;
  for (const r of world.ruins) {
    if (r.district !== id) continue;
    const g = buildRuin(r);
    g.position.set(r.x, heightAt(world, r.x, r.z), r.z);
    d.add(g);
  }
  mergeStatic(d, new Set(), false, (x, z) => heightAt(world, x, z));
  return d;
}

/** All ruins, one merged group per district. */
export function buildRuins(world: World): THREE.Group {
  const root = new THREE.Group();
  const ids = [...new Set(world.ruins.map((r) => r.district))];
  for (const id of ids) root.add(buildDistrict(world, id));
  root.userData.restoreKey = restoreKey(world);
  return root;
}

const restoreKey = (world: World) => world.ruins.map((r) => (r.restored ? 1 : 0)).join('');

/** Rebuild the districts whose ruins have been restored since last time. */
export function syncRuins(world: World, root: THREE.Group) {
  const key = restoreKey(world);
  const old: string = root.userData.restoreKey ?? '';
  if (key === old) return;
  root.userData.restoreKey = key;
  const changed = new Set(world.ruins.filter((_r, i) => key[i] !== old[i]).map((r) => r.district));
  for (const g of [...root.children]) {
    if (!changed.has(g.userData.district)) continue;
    root.remove(g);
    g.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    root.add(buildDistrict(world, g.userData.district));
  }
}
