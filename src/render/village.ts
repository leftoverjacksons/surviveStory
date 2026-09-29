import * as THREE from 'three';
import {
  footCenter, footFloor, type Footprint, type Project, type Village,
} from '../sim/buildings';
import { CAR } from '../sim/layout';
import type { Site } from '../sim/sites';
import type { Building } from '../sim/buildings';
import { WATER_Y, heightAt, tileX, tileZ, type Heap, type World } from '../sim/world';
import type { StoreParts } from './station';
import { homeLayout, houseFloor, housePoint } from '../sim/homes';
import { buildHouse, foundationUnder } from './house';
import { cellarMesh, domeMesh, shrineMesh, tradeMesh } from './trades';
import { hearthMesh, sawpitMesh, solarMesh, turbineMesh, windmillMesh } from './power';
import type { HouseSpec } from '../sim/homes';
import { mergeStatic } from './merge';
import type { RoofControl } from './roofs';
import { glowTexture, makeRand } from './util';

import { BULB, GHOST, GLOW, box, cyl, mat, smooth } from './kit';
let glowTex: THREE.Texture | null = null;

const PANELS = ['#8a5a3a', '#6d7b80', '#5f7f78', '#8e6a4f', '#7b4a3c', '#9a9486'];
const TARPS = ['#3f6f9a', '#b8703a', '#4e7a5a'];

/** Local frame: door faces +z; W along x, D along z. */
function localSize(f: Footprint, facing: number) {
  const swap = facing === 1 || facing === 3;
  return { W: (swap ? f.d : f.w) - 0.4, D: (swap ? f.w : f.d) - 0.4 };
}
const FACING_YAW = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

// ---------- building meshes (progress p in 0..1, 1 = finished) ----------

function scrapShack(W: number, D: number, p: number, seed: number, glow: THREE.Mesh[]): THREE.Group {
  const g = new THREE.Group();
  const rand = makeRand(seed);
  g.add(box(W, 0.12, D, mat('#6b5236'), 0, 0.06, 0));
  const H = 2.1;
  const wallK = smooth(0.12, 0.7, p);
  if (wallK > 0) {
    const h = H * wallK;
    const panel = 0.46;
    const wall = (len: number, along: 'x' | 'z', off: number, door: boolean) => {
      const n = Math.round(len / panel);
      for (let i = 0; i < n; i++) {
        const t = -len / 2 + panel * (i + 0.5);
        if (door && Math.abs(t) < 0.45) continue;
        const ph = h * (0.94 + rand() * 0.12);
        const m = mat(PANELS[Math.floor(rand() * PANELS.length)]);
        g.add(along === 'x' ? box(panel - 0.02, ph, 0.06, m, t, ph / 2 + 0.12, off) : box(0.06, ph, panel - 0.02, m, off, ph / 2 + 0.12, t));
      }
    };
    wall(W, 'x', D / 2, true);
    wall(W, 'x', -D / 2, false);
    wall(D, 'z', W / 2, false);
    wall(D, 'z', -W / 2, false);
    if (p >= 1) {
      const curtain = box(0.8, 1.7, 0.03, mat(TARPS[seed % TARPS.length]), 0, 0.97, D / 2 + 0.02);
      g.add(curtain);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), GLOW);
      win.position.set(W / 2 + 0.04, 1.4, 0);
      win.rotation.y = Math.PI / 2;
      win.visible = false;
      g.add(win);
      glow.push(win);
    }
  }
  if (p > 0.72) {
    const roof = box(W + 0.5, 0.06, D + 0.5, mat('#7d8a8c'), 0, H + 0.3, 0);
    roof.rotation.x = -0.14;
    g.add(roof);
    const tarp = box(W * 0.6, 0.03, D + 0.55, mat(TARPS[(seed + 1) % TARPS.length]), -W * 0.18, H + 0.36, 0);
    tarp.rotation.x = -0.14;
    g.add(tarp);
    g.add(cyl(0.08, 0.9, mat('#3a3a38'), W * 0.3, H + 0.7, -D * 0.25));
    for (const [x, z] of [[-W / 2, D / 2], [W / 2, -D / 2]]) g.add(box(0.25, 0.18, 0.25, mat('#5a5a50'), x, H + 0.45, z));
  }
  return g;
}

function timberCabin(W: number, D: number, p: number, glow: THREE.Mesh[]): THREE.Group {
  const g = new THREE.Group();
  g.add(box(W + 0.1, 0.2, D + 0.1, mat('#7d7a70'), 0, 0.1, 0));
  const H = 2.2;
  const logM = mat('#7a5634'), endM = mat('#a07a50');
  const rows = Math.floor((H / 0.24) * smooth(0.12, 0.7, p));
  for (let r = 0; r < rows; r++) {
    const y = 0.32 + r * 0.24;
    const side = (len: number, along: 'x' | 'z', off: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 7), logM);
      if (along === 'x') { m.rotation.z = Math.PI / 2; m.position.set(0, y, off); } else { m.rotation.x = Math.PI / 2; m.position.set(off, y + 0.12, 0); }
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    };
    // Front wall leaves a door gap for the lower rows.
    if (r < 8) {
      const seg = (W - 0.9) / 2;
      for (const sx of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, seg, 7), logM);
        m.rotation.z = Math.PI / 2;
        m.position.set(sx * (0.45 + seg / 2), y, D / 2);
        m.castShadow = true;
        g.add(m);
      }
    } else side(W + 0.3, 'x', D / 2);
    side(W + 0.3, 'x', -D / 2);
    side(D + 0.3, 'z', W / 2);
    side(D + 0.3, 'z', -W / 2);
  }
  if (p >= 1) {
    g.add(box(0.85, 1.85, 0.06, mat('#5b4330'), 0, 1.15, D / 2 + 0.05));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.45), GLOW);
    win.position.set(W / 2 + 0.14, 1.45, 0);
    win.rotation.y = Math.PI / 2;
    win.visible = false;
    g.add(win);
    glow.push(win);
    for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) g.add(cyl(0.13, 0.2, endM, x, 2.3, z));
  }
  if (p > 0.72) {
    const plank = mat('#5b4330');
    const slope = 0.62, half = (D + 0.8) / 2;
    for (const s of [-1, 1]) {
      const r = box(W + 0.6, 0.1, half / Math.cos(slope), plank, 0, H + 0.35 + Math.tan(slope) * half * 0.5, s * half * 0.5);
      r.rotation.x = s * slope;
      g.add(r);
    }
    g.add(box(0.45, 1.3, 0.45, mat('#7d7a70'), W * 0.3, H + 0.9, -D * 0.2));
  }
  return g;
}

function garden(W: number, D: number, tier: number, p: number, growth: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const rand = makeRand(seed);
  const leaf = mat('#5f8a3a'), leaf2 = mat('#7a9a44'), fruit = mat('#c0503a');
  const k = smooth(0.1, 1, p);
  const plantScale = p >= 1 ? 0.35 + growth * 0.75 : 0;
  if (tier === 0) {
    const tire = mat('#1f1f1e'), soil = mat('#3e2c1e');
    const nx = Math.max(2, Math.round(W / 1.1)), nz = Math.max(2, Math.round(D / 1.1));
    let i = 0;
    for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
      if (i++ / (nx * nz) > k) continue;
      const x = -W / 2 + (ix + 0.5) * (W / nx), z = -D / 2 + (iz + 0.5) * (D / nz);
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 6, 12), tire);
      t.rotation.x = Math.PI / 2;
      t.position.set(x, 0.12, z);
      t.castShadow = true;
      g.add(t);
      g.add(cyl(0.3, 0.05, soil, x, 0.2, z, 10));
      if (plantScale > 0) {
        const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), rand() < 0.5 ? leaf : leaf2);
        pl.position.set(x, 0.25 + 0.2 * plantScale, z);
        pl.scale.setScalar(plantScale);
        pl.castShadow = true;
        g.add(pl);
        if (growth > 0.6 && rand() < 0.5) g.add(box(0.08, 0.08, 0.08, fruit, x + 0.12, 0.45, z));
      }
    }
    return g;
  }
  // Fenced raised beds.
  const wood = mat('#8a6a44'), soil = mat('#3a2818');
  const beds = 2;
  for (let b = 0; b < beds; b++) {
    const z = -D / 2 + (b + 0.5) * (D / beds);
    if (b / beds > k) continue;
    g.add(box(W - 0.4, 0.3, D / beds - 0.5, wood, 0, 0.15, z));
    g.add(box(W - 0.5, 0.05, D / beds - 0.6, soil, 0, 0.31, z));
    if (plantScale > 0) {
      for (let x = -W / 2 + 0.5; x < W / 2 - 0.3; x += 0.45) {
        const pl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 5), rand() < 0.5 ? leaf : leaf2);
        pl.position.set(x, 0.33 + 0.22 * plantScale, z + (rand() - 0.5) * 0.3);
        pl.scale.setScalar(plantScale);
        pl.castShadow = true;
        g.add(pl);
      }
    }
  }
  if (p >= 0.5) {
    for (let x = -W / 2; x <= W / 2 + 0.01; x += W / 4) for (const z of [-D / 2, D / 2]) {
      if (z > 0 && Math.abs(x) < 0.3) continue; // gate
      g.add(box(0.08, 0.7, 0.08, wood, x, 0.35, z));
    }
    for (let z = -D / 2 + D / 3; z < D / 2; z += D / 3) for (const x of [-W / 2, W / 2]) g.add(box(0.08, 0.7, 0.08, wood, x, 0.35, z));
    for (const z of [-D / 2]) g.add(box(W, 0.05, 0.04, wood, 0, 0.55, z));
    for (const x of [-W / 2, W / 2]) g.add(box(0.04, 0.05, D, wood, x, 0.55, 0));
  }
  return g;
}

function workshop(W: number, D: number, tier: number, p: number): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#8a6a44'), dark = mat('#4a3a2a'), metal = mat('#7a8488');
  const k = smooth(0.1, 0.9, p);
  // Workbench and sawhorse.
  if (k > 0.2) {
    g.add(box(1.8, 0.1, 0.7, wood, 0, 0.85, -D / 2 + 0.7));
    for (const x of [-0.8, 0.8]) for (const z of [-D / 2 + 0.4, -D / 2 + 1.0]) g.add(box(0.08, 0.85, 0.08, dark, x, 0.42, z));
    g.add(box(0.5, 0.06, 0.15, metal, -0.4, 0.93, -D / 2 + 0.6));
    g.add(box(1.0, 0.1, 0.12, wood, 0.8, 0.55, D / 2 - 0.6));
  }
  if (tier === 0) {
    if (k > 0.5) {
      for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) g.add(box(0.1, 2.3, 0.1, dark, x, 1.15, z));
    }
    if (p > 0.72) {
      const tarp = box(W + 0.4, 0.03, D + 0.4, mat('#b8703a'), 0, 2.35, 0);
      tarp.rotation.x = 0.12;
      g.add(tarp);
    }
    return g;
  }
  const H = 2.4 * k;
  if (H > 0.1) {
    g.add(box(W, H, 0.1, wood, 0, H / 2, -D / 2));
    for (const x of [-W / 2, W / 2]) g.add(box(0.1, H, D, wood, x, H / 2, 0));
  }
  if (p > 0.72) {
    const roof = box(W + 0.5, 0.1, D + 0.6, mat('#5b4330'), 0, 2.55, 0.1);
    roof.rotation.x = 0.16;
    g.add(roof);
  }
  return g;
}

function kitchen(p: number, roofed = false): THREE.Group {
  const g = new THREE.Group();
  // Away from the station canopy, the kitchen gets a pergola of its own.
  if (roofed && p > 0.5) {
    const post = mat('#6b4f33');
    for (const [x, z] of [[-3.3, -1.2], [3.3, -1.2], [-3.3, 1.2], [3.3, 1.2]]) g.add(box(0.14, 2.5, 0.14, post, x, 1.25, z));
    if (p > 0.75) {
      g.add(box(7, 0.12, 0.16, post, 0, 2.5, -1.2));
      g.add(box(7, 0.12, 0.16, post, 0, 2.5, 1.2));
      const top = box(7.4, 0.06, 3.2, mat('#7d8a8c'), 0, 2.62, 0);
      top.rotation.x = 0.08;
      g.add(top);
    }
  }
  const wood = mat('#8a6a44', false), rust = mat('#6d3f2a', false);
  const k = smooth(0.1, 1, p);
  for (const x of [-2.2, 2.2]) {
    if (k < 0.3) continue;
    g.add(box(1.8, 0.08, 0.8, wood, x, 0.78, 0));
    for (const dx of [-0.8, 0.8]) g.add(box(0.08, 0.78, 0.7, wood, x + dx, 0.39, 0));
    g.add(box(1.8, 0.06, 0.28, wood, x, 0.45, 0.75));
    g.add(box(1.8, 0.06, 0.28, wood, x, 0.45, -0.75));
  }
  if (k > 0.6) {
    g.add(cyl(0.38, 0.9, rust, 0, 0.45, 0, 10));
    g.add(cyl(0.06, 1.8, mat('#3a3a38', false), 0, 1.8, 0));
    g.add(cyl(0.25, 0.22, mat('#2d2d2b', false), 0, 1.02, 0, 10));
  }
  if (p >= 1) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffae4a').multiplyScalar(3), toneMapped: false }));
    flame.position.set(0, 0.5, 0.36);
    g.add(flame);
    glowTex ??= glowTexture();
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff9a4a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
    halo.position.set(0, 0.55, 0.4);
    halo.scale.setScalar(1.4);
    g.add(halo);
  }
  return g;
}

function lantern(p: number): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#5b4330', true, 'lantern');
  const h = 2.5 * smooth(0, 0.6, p);
  if (h > 0.05) g.add(box(0.12, h, 0.12, wood, 0, h / 2, 0));
  if (p > 0.6) g.add(box(0.7, 0.08, 0.08, wood, 0.28, 2.4, 0));
  if (p >= 1) {
    // A salvaged lamp on a hook, wired to a small solar panel on top of the post.
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.16, 8, 1, true), mat('#3a3a38', true, 'lantern'));
    shade.position.set(0.55, 2.2, 0);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), BULB);
    bulb.position.set(0.55, 2.1, 0);
    const orb = bulb;
    g.add(shade, bulb);
    g.add(box(0.02, 0.2, 0.02, mat('#3a3a38', true, 'lantern'), 0.55, 2.34, 0));
    const panel = box(0.55, 0.04, 0.4, mat('#27364f', true, 'lantern'), 0, 2.62, 0);
    panel.rotation.x = -0.5;
    g.add(panel);
    glowTex ??= glowTexture();
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffd9a0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
    halo.position.copy(orb.position);
    halo.scale.setScalar(1.8);
    halo.userData.lanternHalo = true;
    g.add(halo);
  }
  return g;
}

function leanTo(W: number, D: number, p: number, glow: THREE.Mesh[]): THREE.Group {
  // Built against the store's west wall (+x side in local frame).
  const g = new THREE.Group();
  g.add(box(W, 0.12, D, mat('#6b5236'), 0, 0.06, 0));
  const k = smooth(0.12, 0.7, p);
  const rand = makeRand(77);
  if (k > 0) {
    const panel = 0.46;
    for (let i = 0; i < Math.round(D / panel); i++) {
      const z = -D / 2 + panel * (i + 0.5);
      const h = 2.0 * k;
      g.add(box(0.06, h, panel - 0.02, mat(PANELS[Math.floor(rand() * PANELS.length)]), -W / 2, h / 2 + 0.1, z));
    }
    for (const z of [-D / 2, D / 2]) {
      for (let i = 0; i < Math.round(W / panel); i++) {
        const x = -W / 2 + panel * (i + 0.5);
        if (z > 0 && Math.abs(x) < 0.45) continue;
        const h = (2.0 + (x + W / 2) / W * 1.0) * k;
        g.add(box(panel - 0.02, h, 0.06, mat(PANELS[Math.floor(rand() * PANELS.length)]), x, h / 2 + 0.1, z));
      }
    }
  }
  if (p > 0.72) {
    const roof = box(W + 0.5, 0.06, D + 0.4, mat('#7d8a8c'), 0.1, 2.75, 0);
    roof.rotation.z = Math.atan2(1.0, W);
    g.add(roof);
  }
  if (p >= 1) {
    g.add(box(0.8, 1.7, 0.03, mat('#3f6f9a'), 0, 0.95, D / 2 + 0.02));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), GLOW);
    win.position.set(-W / 2 - 0.04, 1.4, 0);
    win.rotation.y = -Math.PI / 2;
    win.visible = false;
    g.add(win);
    glow.push(win);
  }
  return g;
}

/** Mending the part of the shelter's roof that fell in: scaffold first, then the patch. */
/** Whether a group is (or contains) a building the cutaway slices. */
function isBuilding(g: THREE.Object3D): boolean {
  let found = false;
  g.traverse((o) => { if (o.userData.building) found = true; });
  return found;
}

// ---------- the fishery ----------

/** A plank jetty running out over the water (+z), from a little way up the bank. */
function jetty(D: number, tier: number, p: number): THREE.Group {
  const g = new THREE.Group();
  const plank = mat(tier === 0 ? '#8a7458' : '#7a5a3a'), post = mat('#4f3f30');
  const z0 = -D / 2 - 0.9, z1 = D / 2 + 0.3;
  const len = z1 - z0;
  const n = Math.round(len / 0.3);
  const posts = Math.ceil(len / 1.2) + 1;
  for (let i = 0; i < posts; i++) {
    if (i / posts > p * 1.3) break;
    const z = z0 + (len * i) / (posts - 1);
    for (const x of [-0.62, 0.62]) g.add(cyl(0.08, 1.4, post, x, -0.6, z, 6));
  }
  for (let i = 0; i < n; i++) {
    if (i / n > p) break;
    const pl = box(1.35, 0.06, 0.26, plank, 0, 0.02, z0 + 0.15 + i * 0.3);
    pl.rotation.y = ((i * 37) % 7 - 3) * 0.006;
    g.add(pl);
  }
  if (p >= 1) {
    // Rails along the landward half, a bollard and a lantern post at the end.
    for (const x of [-0.62, 0.62]) g.add(box(0.06, 0.06, len * 0.45, post, x, 0.55, z0 + len * 0.22));
    for (let z = z0; z < z0 + len * 0.45; z += 1.2) for (const x of [-0.62, 0.62]) g.add(box(0.07, 0.55, 0.07, post, x, 0.28, z));
    g.add(cyl(0.09, 0.35, mat('#3a3a38'), 0.45, 0.2, z1 - 0.25, 7));
    g.add(box(0.08, 1.6, 0.08, post, -0.55, 0.8, z1 - 0.2));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), GLOW);
    lamp.position.set(-0.55, 1.62, z1 - 0.2);
    g.add(lamp);
  }
  return g;
}

/** The fishing hut: a board shack facing the water, drying racks hung with fish. Tier 1 adds a smoker. */
function fishHut(W: number, D: number, tier: number, p: number, glow: THREE.Mesh[]): THREE.Group {
  const g = new THREE.Group();
  const board = mat(tier === 0 ? '#7a6a58' : '#6b5236'), dark = mat('#4a3a2a');
  const H = 2.2;
  const k = smooth(0.1, 0.7, p);
  g.add(box(W, 0.12, D, mat('#6b5236'), 0, 0.06, 0));
  if (k > 0) {
    const h = H * k;
    g.add(box(W, h, 0.1, board, 0, h / 2, -D / 2));
    for (const s of [-1, 1]) g.add(box(0.1, h, D, board, s * W / 2, h / 2, 0));
    for (const s of [-1, 1]) g.add(box(W * 0.32, h, 0.1, board, s * W * 0.34, h / 2, D / 2));
    for (let x = -W / 2 + 0.2; x < W / 2; x += 0.45) g.add(box(0.03, h, 0.02, dark, x, h / 2, D / 2 + 0.06));
  }
  if (p > 0.72) {
    const roof = box(W + 0.6, 0.08, D + 0.9, mat(tier === 0 ? '#6f7a7a' : '#5f4a3e'), 0, H + 0.35, 0.15);
    roof.rotation.x = -0.28;
    g.add(roof);
  }
  if (p >= 1) {
    g.add(box(0.8, 1.8, 0.05, mat('#4f6f8a'), 0, 0.95, D / 2 + 0.04));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.35), GLOW);
    win.position.set(W / 2 + 0.06, 1.4, 0);
    win.rotation.y = Math.PI / 2;
    win.visible = false;
    g.add(win);
    glow.push(win);
    // Drying racks beside the hut, hung with split fish.
    const pole = mat('#5b4330'), fish = mat('#b8c0c0'), fish2 = mat('#9aa6a2');
    for (const rx of [-W / 2 - 0.9]) {
      for (const dz of [-0.9, 0.9]) g.add(box(0.07, 1.6, 0.07, pole, rx, 0.8, dz));
      for (const y of [1.5, 1.05]) {
        g.add(box(0.05, 0.05, 1.9, pole, rx, y, 0));
        for (let z = -0.75; z <= 0.75; z += 0.25) {
          const f = box(0.05, 0.32, 0.12, (z * 8) % 2 ? fish : fish2, rx + 0.02, y - 0.18, z);
          f.rotation.z = 0.08;
          g.add(f);
        }
      }
    }
    // A smoker (brick) for the smokehouse.
    if (tier === 1) {
      g.add(box(0.8, 1.1, 0.8, mat('#8a5a44'), W / 2 + 0.7, 0.55, -D / 2 + 0.5));
      g.add(box(0.3, 0.8, 0.3, mat('#6b4436'), W / 2 + 0.7, 1.5, -D / 2 + 0.5));
    }
  }
  g.userData.building = true;
  return g;
}

/** The net shed: an open lean-to with nets draped to dry, floats and pots. */
function netShed(W: number, D: number, p: number): THREE.Group {
  const g = new THREE.Group();
  const post = mat('#5b4330');
  const k = smooth(0.1, 0.8, p);
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) {
    const h = (z < 0 ? 2.1 : 1.8) * k;
    if (h > 0.05) g.add(box(0.09, h, 0.09, post, x, h / 2, z));
  }
  if (p > 0.7) {
    const roof = box(W + 0.4, 0.06, D + 0.5, mat('#6f7a7a'), 0, 2.02, 0);
    roof.rotation.x = 0.14;
    g.add(roof);
    g.add(box(W, 1.6, 0.06, mat('#7a6a58'), 0, 0.85, -D / 2));
  }
  if (p >= 1) {
    const netM = new THREE.MeshLambertMaterial({ color: '#3f4a48', transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const net = new THREE.Mesh(new THREE.PlaneGeometry(D * 0.9, 1.3), netM);
      net.position.set(s * (W / 2 + 0.02), 1.1, 0);
      net.rotation.y = Math.PI / 2;
      g.add(net);
      for (let i = 0; i < 4; i++) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat('#d86a3a')).translateX(s * (W / 2 + 0.05)).translateY(1.72).translateZ(-D * 0.4 + i * D * 0.27));
    }
    for (let i = 0; i < 2; i++) g.add(box(0.5, 0.4, 0.5, mat('#6b5236'), -0.3 + i * 0.6, 0.2, D / 2 + 0.5));
  }
  return g;
}

/** A clinker rowing boat, oars shipped. */
function rowBoat(p: number): THREE.Group {
  const g = new THREE.Group();
  const hull = mat('#7a5a3a'), inside = mat('#5b4330'), stripe = mat('#4f7f7a');
  const k = smooth(0.1, 1, p);
  if (k <= 0) return g;
  g.add(box(0.9, 0.12, 2.2 * k, inside, 0, 0.06, 0));
  for (const s of [-1, 1]) {
    const side = box(0.08, 0.4, 2.3 * k, hull, s * 0.5, 0.25, 0);
    side.rotation.z = s * 0.22;
    g.add(side);
    g.add(box(0.09, 0.08, 2.3 * k, stripe, s * 0.55, 0.42, 0));
  }
  if (p >= 1) {
    const bow = box(0.7, 0.4, 0.5, hull, 0, 0.25, 1.25);
    bow.rotation.y = Math.PI / 4;
    bow.scale.set(0.8, 1, 0.8);
    g.add(bow);
    g.add(box(0.95, 0.4, 0.08, hull, 0, 0.25, -1.15));
    for (const z of [-0.35, 0.45]) g.add(box(0.9, 0.05, 0.25, inside, 0, 0.3, z));
    for (const s of [-1, 1]) {
      const oar = box(0.05, 0.05, 2.2, mat('#8a7458'), s * 0.3, 0.36, 0);
      oar.rotation.y = s * 0.08;
      g.add(oar);
    }
  }
  return g;
}

function roofPatch(site: Site, p: number): THREE.Group {
  const g = new THREE.Group();
  const S = site.shelter, C = site.collapse;
  const H = S.h;
  const wood = mat('#8a6a44', false);
  const cover = site.kind === 'glasshouse'
    ? new THREE.MeshLambertMaterial({ color: '#dcebe6', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })
    : mat(site.kind === 'farm' ? '#7a5a3a' : site.kind === 'chapel' ? '#5f666e' : '#7d8a8c', false);
  if (p < 1) {
    for (const [x, z] of [[-C.w / 2, -C.d / 2], [C.w / 2, -C.d / 2], [-C.w / 2, C.d / 2], [C.w / 2, C.d / 2]]) {
      g.add(box(0.08, H + 0.6, 0.08, wood, C.x + x, (H + 0.6) / 2, C.z + z));
    }
    g.add(box(C.w, 0.06, 0.3, wood, C.x, H * 0.6, C.z + C.d / 2));
  }
  const k = smooth(0.4, 1, p);
  if (k <= 0) return g;
  if (site.roof === 'flat') {
    const W = C.w, D = C.d;
    g.add(box(W, 0.08, D * k, cover, C.x, H + 0.12, C.z - D / 2 + (D * k) / 2));
    if (p >= 1) {
      const tarp = box(W * 0.7, 0.04, D * 0.6, mat('#3f6f9a', false), C.x - 0.3, H + 0.2, C.z + 0.4);
      tarp.rotation.z = 0.05;
      g.add(tarp);
      for (let i = 0; i < 4; i++) g.add(box(0.35, 0.18, 0.25, mat('#8a8070', false), C.x - W / 2 + 0.4 + i * (W - 0.8) / 3, H + 0.28, C.z + D / 2 - 0.4));
    }
    return g;
  }
  // Gable: two new slopes filling the gap in the roof.
  const alongX = site.ridge === 'x';
  const len = alongX ? C.w : C.d, span = alongX ? S.d : S.w;
  const half = span / 2 + 0.3, rise = (span / 2) * Math.tan(site.pitch);
  const grp = new THREE.Group();
  for (const s of [-1, 1]) {
    const slab = box(len * k, 0.1, half / Math.cos(site.pitch), cover, 0, H + rise / 2, (s * half) / 2);
    slab.rotation.x = s * site.pitch;
    grp.add(slab);
  }
  if (p >= 1 && site.kind !== 'glasshouse') {
    const tarp = box(len * 0.6, 0.04, half * 0.7, mat('#3f6f9a', false), 0, H + rise * 0.55, half * 0.4);
    tarp.rotation.x = site.pitch;
    grp.add(tarp);
  }
  if (!alongX) grp.rotation.y = Math.PI / 2;
  grp.position.set(C.x, 0, C.z);
  g.add(grp);
  return g;
}

function junkPile(site: Site, k: number): THREE.Group {
  // Debris dragged out of the shelter, shrinking as it is cleared away.
  const g = new THREE.Group();
  const rand = makeRand(5);
  const n = Math.ceil(9 * k);
  for (let i = 0; i < n; i++) {
    const m = mat(PANELS[i % PANELS.length], false);
    const b = box(0.3 + rand() * 0.5, 0.2 + rand() * 0.4, 0.3 + rand() * 0.5, m, site.door.x - 3 + rand() * 2.2, 0.2, site.door.z + 0.4 + rand() * 1.2);
    b.rotation.set(rand(), rand() * 3, rand());
    g.add(b);
  }
  return g;
}

function blueprint(f: Footprint, world: World): THREE.Group {
  const g = new THREE.Group();
  const c = footCenter(world, f);
  const W = f.w, D = f.d, t = 0.06;
  for (const [w, d, x, z] of [[W, t, 0, -D / 2], [W, t, 0, D / 2], [t, D, -W / 2, 0], [t, D, W / 2, 0]] as const) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), GHOST);
    edge.position.set(c.x + x, heightAt(world, c.x, c.z) + 0.08, c.z + z);
    g.add(edge);
  }
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) {
    const stake = box(0.06, 0.5, 0.06, mat('#c8b890'), c.x + x, heightAt(world, c.x, c.z) + 0.25, c.z + z);
    g.add(stake);
  }
  return g;
}

function materialPile(p: Project, f: Footprint, world: World): THREE.Group {
  const g = new THREE.Group();
  const c = footCenter(world, f);
  const x0 = c.x - f.w / 2 - 0.2, z0 = c.z + f.d / 2 + 0.2;
  const y = heightAt(world, c.x, c.z);
  const logs = Math.min(8, Math.ceil((p.delivered.wood - p.cost.wood * Math.min(1, p.work / p.workNeeded)) / 3));
  for (let i = 0; i < logs; i++) {
    const l = cyl(0.1, 1.1, mat('#6a4a30'), x0 + 0.1, y + 0.1 + Math.floor(i / 4) * 0.2, z0 - (i % 4) * 0.22);
    l.rotation.z = Math.PI / 2;
    g.add(l);
  }
  const sheets = Math.min(6, Math.ceil((p.delivered.scrap - p.cost.scrap * Math.min(1, p.work / p.workNeeded)) / 3));
  for (let i = 0; i < sheets; i++) g.add(box(0.9, 0.05, 0.6, mat(PANELS[i % PANELS.length]), x0 + 1.3, y + 0.05 + i * 0.06, z0 - 0.3));
  return g;
}

// ---------- beds ----------

interface Slot { x: number; z: number; yaw: number; y?: number }

/** Where the beds are inside a building, in its local frame (door toward +z). */
function localBeds(kind: string, tier: number): { x: number; z: number }[] {
  if (kind === 'annex') return [{ x: 0.1, z: -1.2 }, { x: 0.1, z: 1.0 }];
  if (kind === 'hut') return tier === 0 ? [{ x: -0.6, z: -0.1 }, { x: 0.6, z: -0.1 }] : [{ x: -0.8, z: -0.1 }, { x: 0, z: -0.1 }, { x: 0.8, z: -0.1 }];
  return [];
}

/** The hall: a long table down the middle of the old shelter, with benches both sides. */
function hallSeats(site: Site): Slot[] { return tableSeats(site.hallTable); }

/** A built commons hall (DESIGN §29): the long table runs down its length. */
function builtHallTable(world: World, b: Building): Site['hallTable'] {
  const c = footCenter(world, b.foot);
  return { x: c.x, z: c.z, len: Math.max(b.foot.w, b.foot.d) - 2, axis: b.foot.w >= b.foot.d ? 'x' : 'z' };
}

function tableSeats(T: Site['hallTable']): Slot[] {
  const out: Slot[] = [];
  const n = Math.max(2, Math.floor((T.len - 0.6) / 0.78) + 1);
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
    const a = -T.len / 2 + 0.5 + i * 0.78;
    out.push(T.axis === 'x'
      ? { x: T.x + a, z: T.z + s * 0.72, yaw: s > 0 ? Math.PI : 0, y: 0.18 }
      : { x: T.x + s * 0.72, z: T.z + a, yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2, y: 0.18 });
  }
  return out;
}

/** World position and heading of bed `index` in a building. */
export function bedSlot(world: World, village: Village, b: Building, index: number): Slot | null {
  // Beds in a restored ruin: in a row across the middle of the old house.
  if (b.ruin !== undefined) {
    const r = world.ruins[b.ruin];
    if (!r || index >= b.beds) return null;
    const cs = Math.cos(r.yaw), sn = Math.sin(r.yaw);
    const along = (index - (b.beds - 1) / 2) * 1.3;
    return { x: r.x + along * cs, z: r.z - along * sn, yaw: r.yaw };
  }
  if (b.kind === 'store') {
    const p = (b.level >= 3 ? village.site.hallBeds : village.site.beds)[index];
    return p ? { x: p.x, z: p.z, yaw: 0 } : null;
  }
  if (b.kind === 'home') {
    const plot = village.plots.find((x) => x.id === b.plot);
    const bed = plot ? homeLayout(plot.house).beds[index] : undefined;
    if (!plot || !bed) return null;
    const p = housePoint(plot.hc, plot.yaw, bed.x, bed.z);
    return { x: p.x, z: p.z, yaw: plot.yaw + bed.yaw, y: 0.36 };
  }
  const p = localBeds(b.kind, b.tier)[index];
  if (!p) return null;
  const c = footCenter(world, b.foot);
  const yaw = FACING_YAW[b.facing];
  return { x: c.x + p.x * Math.cos(yaw) + p.z * Math.sin(yaw), z: c.z - p.x * Math.sin(yaw) + p.z * Math.cos(yaw), yaw };
}

/** Where someone sits indoors (eating, or spending the evening): seat `index`. */
export function seatSlot(world: World, village: Village, b: Building, index: number): Slot | null {
  if (b.kind === 'store') { const seats = hallSeats(village.site); return seats[index % seats.length]; }
  if (b.kind === 'hall') { const seats = tableSeats(builtHallTable(world, b)); return seats[index % seats.length]; }
  if (b.kind === 'home') {
    const plot = village.plots.find((x) => x.id === b.plot);
    if (!plot) return null;
    const seats = homeLayout(plot.house).seats;
    const s = seats[index % seats.length];
    const p = housePoint(plot.hc, plot.yaw, s.x, s.z);
    return { x: p.x, z: p.z, yaw: plot.yaw + s.yaw, y: 0.1 };
  }
  return null;
}

function bedroll(color: string): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.72, 0.12, 1.7, mat(color), 0, 0.14, 0));
  g.add(box(0.5, 0.1, 0.3, mat('#cfc6a8'), 0, 0.24, -0.66));
  g.add(box(0.8, 0.08, 1.8, mat('#5b4632'), 0, 0.04, 0)); // pallet frame
  return g;
}

// ---------- the view ----------

interface Entry { key: string; group: THREE.Group; glow: THREE.Mesh[] }

export class VillageView {
  group = new THREE.Group();
  private entries = new Map<string, Entry>();
  private roofDone: THREE.Group | null = null;

  private storeInterior: THREE.Group | null = null;
  private storeInteriorKey = '';

  constructor(private world: World, private village: Village, private store: StoreParts, private roofs: RoofControl) {}

  private place(g: THREE.Group, f: Footprint, facing: number, raise = false, tier = 1, seed = 0) {
    const c = footCenter(this.world, f);
    const y = raise ? footFloor(this.world, f) : heightAt(this.world, c.x, c.z);
    g.position.set(c.x, y, c.z);
    g.rotation.y = FACING_YAW[facing];
    if (!raise) return;
    // On a slope, stand on a foundation rather than sinking into the hill.
    const yaw = FACING_YAW[facing];
    const ground = (x: number, z: number) => heightAt(this.world, c.x + x * Math.cos(yaw) + z * Math.sin(yaw), c.z - x * Math.sin(yaw) + z * Math.cos(yaw)) - y;
    const { W, D } = localSize(f, facing);
    const fm = foundationUnder(W + 0.2, D + 0.2, ground, tier, seed);
    if (fm) g.add(fm);
    g.userData.ground = ground;
  }

  private meshFor(kind: string, tier: number, f: Footprint, facing: number, p: number, growth: number, seed: number, glow: THREE.Mesh[], clad?: HouseSpec['clad']): THREE.Group {
    const { W, D } = localSize(f, facing);
    let g: THREE.Group;
    switch (kind) {
      case 'hut': g = tier === 0 ? scrapShack(W, D, p, seed, glow) : timberCabin(W, D, p, glow); break;
      case 'garden': g = garden(W + 0.2, D + 0.2, tier, p, growth, seed); break;
      case 'workshop': g = workshop(W, D, tier, p); break;
      case 'lantern': g = lantern(p); break;
      case 'cellar': g = cellarMesh(W + 0.2, D + 0.2, tier, p); break;
      case 'dome': g = domeMesh(W + 0.2, D + 0.2, p, growth, (f.tx * 7349 + f.tz * 131) >>> 0); break;
      case 'shrine': g = shrineMesh(W, D, tier, p, seed, glow); break;
      case 'toolshop': case 'tailor': case 'smokehouse': case 'tavern': case 'hall': g = tradeMesh(kind, W, D, tier, p, (f.tx * 7349 + f.tz * 131) >>> 0, clad, glow); break; // same look as a site and when finished
      case 'annex': g = leanTo(W + 0.3, D + 0.3, p, glow); break;
      case 'windmill': g = windmillMesh(p, seed); break;
      case 'solar': g = solarMesh(W, D, p); break;
      case 'turbine': g = turbineMesh(p); break;
      case 'sawpit': g = sawpitMesh(W, D, p); break;
      case 'hearth': g = hearthMesh(p); break;
      case 'jetty': {
        const len = (facing === 1 || facing === 3) ? f.w : f.d;
        g = jetty(len, tier, p);
        this.place(g, f, facing);
        // Level with the bank it starts from, not the pond bed.
        const c = footCenter(this.world, f);
        const dir = [[0, 1], [1, 0], [0, -1], [-1, 0]][facing];
        const bank = { x: c.x - dir[0] * (len / 2 + 0.5), z: c.z - dir[1] * (len / 2 + 0.5) };
        g.position.y = Math.max(0.05, heightAt(this.world, bank.x, bank.z) + 0.1);
        return g;
      }
      case 'fishhut': g = fishHut(W + 0.2, D + 0.2, tier, p, glow); break;
      case 'netshed': g = netShed(W + 0.2, D + 0.2, p); break;
      case 'boat': {
        g = rowBoat(p);
        this.place(g, f, facing);
        g.position.y = WATER_Y - 0.05;
        g.userData.boat = true;
        return g;
      }
      case 'kitchen': {
        g = kitchen(p, !this.village.site.kitchenCovered);
        const K = this.village.site.kitchen;
        g.position.set(K.x, heightAt(this.world, K.x, K.z), K.z);
        g.userData.building = true;
        return g;
      }
      default: g = new THREE.Group();
    }
    if (kind !== 'lantern') g.userData.building = true;
    if (p >= 1 && (kind === 'hut' || kind === 'annex')) {
      const colors = ['#6f7d5c', '#8a6a4a', '#5a6b7a', '#7a4f45'];
      localBeds(kind, tier).forEach((b, i) => {
        const bed = bedroll(colors[(seed + i) % colors.length]);
        bed.position.set(b.x, 0.08, b.z);
        g.add(bed);
      });
    }
    this.place(g, f, facing, kind !== 'lantern' && kind !== 'garden', tier, seed);
    return g;
  }

  /** A house on its plot, at progress p. */
  private homeMesh(plotId: number | undefined, tier: number, p: number, glow: THREE.Mesh[]): THREE.Group {
    const plot = this.village.plots.find((x) => x.id === plotId);
    if (!plot) return new THREE.Group();
    const y = houseFloor(this.world, plot);
    const ground = (x: number, z: number) => { const q = housePoint(plot.hc, plot.yaw, x, z); return heightAt(this.world, q.x, q.z) - y; };
    const g = buildHouse(plot.house, tier, p, glow, ground);
    g.position.set(plot.hc.x, y, plot.hc.z);
    g.rotation.y = plot.yaw;
    g.userData.ground = ground;
    return g;
  }

  /** Strings and stakes marking out where the house will stand. */
  private homeOutline(plotId: number | undefined): THREE.Group {
    const g = new THREE.Group();
    const plot = this.village.plots.find((x) => x.id === plotId);
    if (!plot) return g;
    const { W, D, wing } = plot.house;
    const rects: [number, number, number, number][] = [[0, 0, W, D]];
    if (wing) rects.push([wing.side * (W / 2 - wing.w / 2), -D / 2 - wing.d / 2, wing.w, wing.d]);
    for (const [cx, cz, w, d] of rects) {
      for (const [ew, ed, x, z] of [[w, 0.05, 0, -d / 2], [w, 0.05, 0, d / 2], [0.05, d, -w / 2, 0], [0.05, d, w / 2, 0]] as const) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(ew, 0.04, ed), GHOST);
        edge.position.set(cx + x, 0.08, cz + z);
        g.add(edge);
      }
      for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) g.add(box(0.06, 0.5, 0.06, mat('#c8b890'), cx + x, 0.25, cz + z));
    }
    g.position.set(plot.hc.x, heightAt(this.world, plot.hc.x, plot.hc.z), plot.hc.z);
    g.rotation.y = plot.yaw;
    return g;
  }

  private spinners: THREE.Object3D[] = [];
  private lastSpin = 0;

  private upsert(id: string, key: string, build: (glow: THREE.Mesh[]) => THREE.Group) {
    const e = this.entries.get(id);
    if (e && e.key === key) return;
    if (e) this.dispose(e.group);
    const glow: THREE.Mesh[] = [];
    const group = build(glow);
    // Finished buildings don't change: bake them into a few meshes.
    if (id.startsWith('b')) mergeStatic(group, new Set(glow), isBuilding(group), group.userData.ground ?? (() => 0));
    this.register(group);
    this.group.add(group);
    this.entries.set(id, { key, group, glow });
    this.spinners = [];
    this.group.traverse((o) => { if (o.userData.spin) this.spinners.push(o); });
  }

  /** Hand roofs and building materials to the roof control. */
  private register(root: THREE.Object3D) {
    root.traverse((o) => {
      if (o.userData.roofGroup) { this.roofs.addRoof(o); return; }
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mm = m.material as THREE.Material;
      let inBuilding = false;
      for (let q: THREE.Object3D | null = o; q; q = q.parent) if (q.userData.building) { inBuilding = true; break; }
      if (inBuilding && mm !== GHOST && mm.blending !== THREE.AdditiveBlending) this.roofs.addCutMaterial(mm);
      // Anything above wall height on a building is roof.
      if (o.parent?.userData.building && o.position.y > 2.25) this.roofs.addRoof(o);
    });
  }

  private dispose(g: THREE.Group) {
    g.traverse((o) => this.roofs.removeRoof(o));
    this.group.remove(g);
    g.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }

  /** Reconcile meshes with the village state. Cheap when nothing changed. */
  sync() {
    const v = this.village;
    const live = new Set<string>();
    const st = v.buildings.find((b) => b.kind === 'store')!;
    // Pulled down (DESIGN §29): nothing of it is drawn (main.ts hides the site's own meshes).
    if (st.gone) {
      this.store.fallen.visible = false;
      if (this.roofDone) { this.group.remove(this.roofDone); this.roofDone = null; }
      if (this.storeInterior) { this.group.remove(this.storeInterior); this.storeInterior = null; }
      this.storeInteriorKey = 'gone';
    }
    this.store.door.material = mat(st.level >= 1 ? '#6b4f33' : '#141816', false);
    this.store.fallen.visible = st.level < 2 && this.roofs.mode === 'shown' && !st.gone;
    if (st.level >= 2 && !this.roofDone && !st.gone) {
      this.roofDone = roofPatch(this.village.site, 1);
      this.roofDone.userData.roofGroup = true;
      mergeStatic(this.roofDone);
      this.register(this.roofDone);
      this.group.add(this.roofDone);
    }
    // Inside the shelter: junk before it's cleared, cots after, a long table once it's the hall.
    const site = this.village.site;
    const S = site.shelter;
    const ikey = st.gone ? 'gone' : `${st.level}:${st.beds}`;
    const hall = st.level >= 3;
    if (ikey !== this.storeInteriorKey) {
      this.storeInteriorKey = ikey;
      if (this.storeInterior) this.group.remove(this.storeInterior);
      const gi = new THREE.Group();
      if (st.level === 0) {
        const rand = makeRand(8);
        for (let i = 0; i < 14; i++) {
          const b = box(0.3 + rand() * 0.7, 0.2 + rand() * 0.5, 0.3 + rand() * 0.6, mat(PANELS[i % PANELS.length], false),
            S.x - S.w * 0.4 + rand() * S.w * 0.6, 0.2, S.z - S.d * 0.36 + rand() * S.d * 0.72);
          b.rotation.set(rand() * 0.5, rand() * 3, rand() * 0.5);
          gi.add(b);
        }
      } else if (hall) {
        // The commons hall: long table, benches, a stove, bunting, two guest cots.
        const T = site.hallTable;
        const tbl = new THREE.Group();
        tbl.add(box(T.len, 0.08, 0.9, mat('#7a5a3a', false), 0, 0.74, 0));
        for (const dx of [-T.len / 2 + 0.3, 0, T.len / 2 - 0.3]) for (const dz of [-0.3, 0.3]) tbl.add(box(0.08, 0.72, 0.08, mat('#5b4330', false), dx, 0.36, dz));
        for (const s of [-1, 1]) tbl.add(box(T.len - 0.2, 0.07, 0.3, mat('#6b4f33', false), 0, 0.42, s * 0.72));
        const cups = Math.floor(T.len / 0.9);
        for (let i = 0; i < cups; i++) tbl.add(cyl(0.09, 0.14, mat(['#b0603a', '#c8b890', '#6f8a6a'][i % 3], false), -T.len / 2 + 0.6 + i * 0.9, 0.85, i % 2 ? 0.15 : -0.15, 7));
        tbl.position.set(T.x, 0, T.z);
        if (T.axis === 'z') tbl.rotation.y = Math.PI / 2;
        gi.add(tbl);
        const stove = new THREE.Group();
        stove.add(cyl(0.42, 0.9, mat('#3a3a38', false), 0, 0.45, 0, 10));
        stove.add(cyl(0.08, 2.6, mat('#3a3a38', false), 0, 2.2, 0, 6));
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffae4a').multiplyScalar(2.4), toneMapped: false }));
        fl.position.set(0, 0.4, 0.38);
        stove.add(fl);
        stove.position.set(site.stove.x, 0, site.stove.z);
        gi.add(stove);
        const colors = ['#6f7d5c', '#8a6a4a'];
        site.hallBeds.forEach((b, i) => {
          const bed = bedroll(colors[i % colors.length]);
          bed.position.set(b.x, 0.08, b.z);
          gi.add(bed);
        });
      } else {
        const colors = ['#6f7d5c', '#8a6a4a', '#5a6b7a', '#7a4f45', '#9a8a60', '#4f6a5a', '#8a7a4a', '#5a6b5a'];
        for (let i = 0; i < st.beds && i < site.beds.length; i++) {
          const bed = bedroll(colors[i % colors.length]);
          bed.position.set(site.beds[i].x, 0.08, site.beds[i].z);
          gi.add(bed);
        }
        // A lamp on an upturned crate.
        gi.add(box(0.5, 0.5, 0.5, mat('#7b6243', false), site.inside.x + 0.8, 0.25, site.inside.z + 0.6));
      }
      gi.userData.building = true;
      mergeStatic(gi, new Set(), true);
      this.register(gi);
      this.storeInterior = gi;
      this.group.add(gi);
    }

    for (const b of v.buildings) {
      if (b.kind === 'store') continue;
      // A restored ruin (a home again, too) is drawn by the old world's renderer.
      if (b.ruin !== undefined) continue;
      if (b.kind === 'home') {
        const id = `b${b.id}`;
        live.add(id);
        this.upsert(id, `home${b.level}`, (glow) => {
          const g = this.homeMesh(b.plot, b.level, 1, glow);
          g.userData.buildingId = b.id;
          return g;
        });
        continue;
      }
      // A restored ruin is drawn by the old world's renderer.
      if (b.ruin !== undefined) continue;
      // An upgrade in progress keeps the old building standing until it's done.
      const id = `b${b.id}`;
      live.add(id);
      const key = `${b.kind}${b.tier}:${Math.round(b.growth * 5)}${b.kind === 'kitchen' && !v.site.kitchenCovered ? ':open' : ''}`;
      this.upsert(id, key, (glow) => {
        const g = this.meshFor(b.kind, b.tier, b.foot, b.facing, 1, b.growth, b.id, glow, b.clad);
        g.userData.buildingId = b.id;
        return g;
      });
    }
    for (const p of v.projects) {
      if (p.done) continue;
      const id = `p${p.id}`;
      live.add(id);
      const prog = p.work / p.workNeeded;
      const key = `${Math.floor(prog * 12)}:${p.delivered.wood}:${p.delivered.scrap}`;
      this.upsert(id, key, (glow) => {
        const g = new THREE.Group();
        g.userData.projectId = p.id;
        if (p.kind === 'clear_store') { g.add(junkPile(this.village.site, 1 - prog)); return g; }
        if (p.kind === 'restore') { g.add(materialPile(p, p.foot, this.world)); return g; }
        if (p.kind === 'home') {
          g.add(this.homeOutline(p.plot));
          g.add(materialPile(p, p.foot, this.world));
          if (p.work > 0) g.add(this.homeMesh(p.plot, p.tier, Math.min(0.99, prog), glow));
          return g;
        }
        if (p.kind === 'patch_roof') {
          const rp = roofPatch(this.village.site, prog);
          rp.userData.roofGroup = true;
          g.add(rp);
          return g;
        }
        if (p.kind === 'upgrade') {
          // Scaffold stakes and materials beside the building being rebuilt.
          g.add(blueprint(p.foot, this.world));
          g.add(materialPile(p, p.foot, this.world));
          if (prog > 0.5) {
            const target = v.buildings.find((b) => b.id === p.target);
            if (target) g.add(this.meshFor(target.kind, 1, p.foot, p.facing, (prog - 0.5) * 2 * 0.7, target.growth, target.id, glow, target.clad));
          }
          return g;
        }
        if (p.kind !== 'kitchen') g.add(blueprint(p.foot, this.world));
        g.add(materialPile(p, p.foot, this.world));
        if (p.work > 0) g.add(this.meshFor(p.kind, p.tier, p.foot, p.facing, Math.min(0.99, prog), 0.2, p.id, glow, p.clad));
        return g;
      });
    }
    // Upgraded buildings: hide the old mesh while the new one rises past halfway.
    for (const p of v.projects) {
      if (p.done || p.kind !== 'upgrade') continue;
      const e = this.entries.get(`b${p.target}`);
      if (e) e.group.visible = p.work / p.workNeeded < 0.5;
    }
    for (const [id, e] of this.entries) {
      if (!live.has(id)) { this.dispose(e.group); this.entries.delete(id); }
    }
  }

  /** A boat out on the water goes where its fisher is; otherwise it's moored. */
  updateBoats(afloat: { x: number; z: number; facing: number; boatId: number }[]) {
    for (const b of this.village.buildings) {
      if (b.kind !== 'boat') continue;
      const e = this.entries.get(`b${b.id}`);
      if (!e) continue;
      const who = afloat.find((a) => a.boatId === b.id);
      if (who) {
        e.group.position.set(who.x, WATER_Y - 0.05, who.z);
        e.group.rotation.y = who.facing + Math.PI / 2;
      } else {
        const c = footCenter(this.world, b.foot);
        e.group.position.set(c.x, WATER_Y - 0.05, c.z);
        e.group.rotation.y = [0, Math.PI / 2, Math.PI, -Math.PI / 2][b.facing];
      }
    }
  }

  /** Warm windows at night for buildings with someone asleep inside. */
  update(night: number, occupied: Set<number>, t: number) {
    const lit = night > 0.35;
    // Windmill sails and turbine blades turn (power.ts): a little faster in the wind of the cold months would be nice; steady for now.
    const dt = t - this.lastSpin; this.lastSpin = t;
    for (const s of this.spinners) s.rotation.z -= (s.userData.spin as number) * Math.min(0.1, Math.max(0, dt));
    const st = this.village.buildings.find((b) => b.kind === 'store')!;
    for (const m of this.store.glow) m.visible = lit && occupied.has(st.id) && !st.gone;
    for (const b of this.village.buildings) {
      const e = this.entries.get(`b${b.id}`);
      if (!e) continue;
      for (const m of e.glow) m.visible = lit && occupied.has(b.id);
      if (b.kind === 'lantern') {
        e.group.traverse((o) => {
          if (o.userData.lanternHalo) { const sp = o as THREE.Sprite; sp.scale.setScalar(0.6 + night * 1.4); sp.material.opacity = 0.15 + night * 0.7; }
        });
      }
    }
  }
}

// ---------- salvage heaps ----------

const PILE_TONES: Record<string, string[]> = {
  'vinyl siding': ['#b9c79a', '#c9b98e', '#9ab5bf', '#d1c29a', '#6b5a44'],
  'roof shingles': ['#5a5652', '#4a4e52', '#6a5a4e'],
  'window glass': ['#7fa0a4', '#9ec4bf', '#6a5a44'],
  'interior doors': ['#c8b890', '#a88a64', '#e0d8c4'],
  'copper pipe': ['#b8743a', '#8a5a34', '#6a6a66'],
  'garage doors': ['#d8d4c4', '#b8b4a8'],
  'car panels': ['#8a5a4a', '#5a7078', '#7a4428', '#a8b0a8'],
  'shop shelving': ['#9a9c98', '#c8c8c0', '#6a6a66'],
  'plate glass': ['#7fa0a4', '#9ec4bf'],
  'shop signs': ['#c8503a', '#3a6a9a', '#d8a040', '#e8dcc0'],
  'corrugated steel': ['#8a9296', '#7a4428', '#94877a'],
  'steel girders': ['#5a5a58', '#7a4428'],
  'pallets': ['#b8a070', '#9a8058'],
  'barn boards': ['#8a3a2e', '#7a4a34'],
  'fence wire': ['#6a6a66', '#8a8a86'],
  'bricks': ['#8a4a3a', '#96583f', '#c8c0b0'],
  'roof slates': ['#3e4448', '#4a4a4e'],
  'pews': ['#6b4f33', '#8a6a44'],
  'greenhouse glass': ['#9ec4bf', '#a8aca8'],
  'aluminium frame': ['#a8aca8', '#c8ccc8'],
};

export class HeapsView {
  group = new THREE.Group();
  private views = new Map<number, { g: THREE.Group; cabin?: THREE.Object3D; parts: THREE.Object3D[]; last: number }>();

  /** Heaps from world generation; later ones (caches) are added as they appear. */
  private initial: number;

  constructor(private world: World) {
    this.initial = world.heaps.length;
    for (const h of world.heaps) {
      // The station's own car is already modelled with the station.
      if (world.site.kind === 'station' && h.kind === 'car' && Math.hypot(tileX(world, h.tx) - CAR.x, tileZ(world, h.tz) - CAR.z) < 1.5) continue;
      const v = h.kind === 'car' ? this.car(h) : this.pile(h);
      this.views.set(h.id, v);
      this.group.add(v.g);
    }
  }

  /**
   * A wrecked car: one of a sedan, hatchback, van or pickup, in faded paint
   * with rust, flat tyres and dark glass. Wheels, doors and bonnet go as it is
   * stripped; the cabin last.
   */
  private car(h: Heap) {
    const rand = makeRand(h.id * 31 + 7);
    const g = new THREE.Group();
    const PAINT = ['#8a5a4a', '#5a7078', '#b8a88a', '#6a7a5a', '#8a8a86', '#4a5a78', '#9a6a3a', '#a8b0a8'];
    const paint = mat(PAINT[(h.id * 7 + (h.source ?? 0)) % PAINT.length], true, 'heap');
    const rust = mat('#7a4428', true, 'heap'), glass = mat('#1f2a2e', true, 'heap'), dark = mat('#2a2826', true, 'heap');
    const trim = mat('#5a5a58', true, 'heap');
    const type = ['sedan', 'hatch', 'van', 'pickup'][(h.id * 13 + 5) % 4];
    const parts: THREE.Object3D[] = [];
    const L = type === 'van' ? 4.4 : 4.1, Wd = 1.75;
    // Sits low on flat tyres, a little down at one corner.
    g.add(box(L, 0.55, Wd, paint, 0, 0.5, 0));
    g.add(box(L + 0.1, 0.16, Wd - 0.1, trim, 0, 0.32, 0)); // bumpers and sills
    for (const s of [-1, 1]) {
      g.add(box(0.05, 0.1, 0.3, mat('#d8d0b0', true, 'heap'), s * (L / 2 + 0.02), 0.62, 0.55));
      g.add(box(0.05, 0.1, 0.3, mat('#d8d0b0', true, 'heap'), s * (L / 2 + 0.02), 0.62, -0.55));
    }
    // Rust along the sills and wheel arches.
    for (let k = 0; k < 5; k++) {
      const s = rand() < 0.5 ? -1 : 1;
      g.add(box(0.3 + rand() * 0.6, 0.16 + rand() * 0.2, 0.02, rust, (rand() - 0.5) * L * 0.9, 0.35 + rand() * 0.3, s * (Wd / 2 + 0.01)));
    }
    const cabin = new THREE.Group();
    const cab = (x: number, len: number, hgt: number) => {
      cabin.add(box(len, hgt, Wd - 0.14, paint, x, 0.78 + hgt / 2, 0));
      cabin.add(box(len - 0.3, hgt * 0.62, Wd - 0.1, glass, x, 0.78 + hgt * 0.5, 0));
      cabin.add(box(len + 0.02, 0.07, Wd - 0.12, paint, x, 0.78 + hgt, 0));
    };
    if (type === 'sedan') cab(-0.2, 2.0, 0.62);
    else if (type === 'hatch') cab(-0.5, 2.3, 0.66);
    else if (type === 'van') cab(-0.4, 3.3, 1.05);
    else {
      cab(0.7, 1.4, 0.66);
      // The bed, with junk in it.
      for (const s of [-1, 1]) cabin.add(box(1.9, 0.35, 0.06, paint, -1.0, 0.95, s * (Wd / 2 - 0.05)));
      cabin.add(box(0.8, 0.3, 0.7, mat('#6a5a44', true, 'heap'), -1.2, 0.93, 0.2));
    }
    g.add(cabin);
    for (const [x, z] of [[-1.3, 0.82], [1.3, 0.82], [-1.3, -0.82], [1.3, -0.82]]) {
      const wh = new THREE.Group();
      const tyre = cyl(0.32, 0.22, dark, 0, 0, 0, 10);
      tyre.rotation.x = Math.PI / 2;
      const hub = cyl(0.15, 0.24, mat('#8a8a86', true, 'heap'), 0, 0, 0, 8);
      hub.rotation.x = Math.PI / 2;
      wh.add(tyre, hub);
      wh.position.set(x, 0.24, z);
      wh.scale.y = 0.8; // flat
      g.add(wh);
      parts.push(wh);
    }
    // Bonnet (sometimes already sprung) and doors: what gets taken first.
    const bonnet = box(1.1, 0.06, Wd - 0.2, paint, L / 2 - 0.6, 0.8, 0);
    if (rand() < 0.4) { bonnet.rotation.z = -0.6; bonnet.position.y += 0.25; }
    g.add(bonnet);
    parts.push(bonnet);
    for (const s of [-1, 1]) {
      const door = box(0.9, 0.5, 0.05, paint, 0.1, 0.72, s * (Wd / 2 + 0.03));
      if (rand() < 0.3) { door.rotation.y = s * 0.7; door.position.x += 0.3; door.position.z += s * 0.3; }
      g.add(door);
      parts.push(door);
    }
    const x = tileX(this.world, h.tx), z = tileZ(this.world, h.tz);
    g.position.set(x, heightAt(this.world, x, z) - 0.06, z);
    g.rotation.set(0, h.rot, (rand() - 0.5) * 0.06);
    return { g, cabin, parts, last: -1 };
  }

  private pile(h: Heap) {
    const rand = makeRand(h.id * 17 + 3);
    const g = new THREE.Group();
    const parts: THREE.Object3D[] = [];
    // Coloured by what it is, where it is known (siding, brick, steel, glass...).
    const tones = h.material ? PILE_TONES[h.material] ?? PANELS : PANELS;
    for (let i = 0; i < 8; i++) {
      const m = mat(tones[Math.floor(rand() * tones.length)], true, 'heap');
      const b = rand() < 0.3
        ? cyl(0.25, 0.7, m, (rand() - 0.5) * 1.2, 0.3, (rand() - 0.5) * 1.2)
        : box(0.3 + rand() * 0.8, 0.08 + rand() * 0.3, 0.3 + rand() * 0.7, m, (rand() - 0.5) * 1.3, 0.1 + rand() * 0.4, (rand() - 0.5) * 1.3);
      b.rotation.set(rand() * 0.8, rand() * 3, rand() * 0.8);
      g.add(b);
      parts.push(b);
    }
    const x = tileX(this.world, h.tx), z = tileZ(this.world, h.tz);
    g.position.set(x, heightAt(this.world, x, z), z);
    return { g, parts, last: -1 };
  }

  /** Piles shrink and cars get stripped as scrap is taken; new caches appear. */
  sync() {
    for (const h of this.world.heaps) {
      if (!this.views.has(h.id) && h.id >= this.initial) {
        const nv = h.kind === 'car' ? this.car(h) : this.pile(h);
        this.views.set(h.id, nv);
        this.group.add(nv.g);
      }
      const v = this.views.get(h.id);
      if (!v || v.last === h.scrap) continue;
      v.last = h.scrap;
      const frac = h.scrap / h.max;
      const keep = Math.ceil(v.parts.length * frac);
      v.parts.forEach((p, i) => { p.visible = i < keep; });
      if (v.cabin) v.cabin.visible = frac > 0.3;
    }
  }
}

