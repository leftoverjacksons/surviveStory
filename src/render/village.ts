import * as THREE from 'three';
import {
  footCenter, type Footprint, type Project, type Village,
} from '../sim/buildings';
import { CAR } from '../sim/layout';
import type { Site } from '../sim/sites';
import type { Building } from '../sim/buildings';
import { heightAt, tileX, tileZ, type Heap, type World } from '../sim/world';
import type { StoreParts } from './station';
import { homeLayout, housePoint } from '../sim/homes';
import { buildHouse } from './house';
import type { RoofControl } from './roofs';
import { glowTexture, makeRand } from './util';

import { GHOST, GLOW, WISP, box, cyl, mat, smooth } from './kit';
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
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), WISP);
    orb.position.set(0.55, 2.05, 0);
    g.add(orb);
    g.add(box(0.02, 0.28, 0.02, mat('#3a3a38', true, 'lantern'), 0.55, 2.28, 0));
    glowTex ??= glowTexture();
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#9ff2e0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
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
function hallSeats(site: Site): Slot[] {
  const T = site.hallTable;
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
  void world;
  if (b.kind === 'store') { const seats = hallSeats(village.site); return seats[index % seats.length]; }
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

  private place(g: THREE.Group, f: Footprint, facing: number) {
    const c = footCenter(this.world, f);
    g.position.set(c.x, heightAt(this.world, c.x, c.z), c.z);
    g.rotation.y = FACING_YAW[facing];
  }

  private meshFor(kind: string, tier: number, f: Footprint, facing: number, p: number, growth: number, seed: number, glow: THREE.Mesh[]): THREE.Group {
    const { W, D } = localSize(f, facing);
    let g: THREE.Group;
    switch (kind) {
      case 'hut': g = tier === 0 ? scrapShack(W, D, p, seed, glow) : timberCabin(W, D, p, glow); break;
      case 'garden': g = garden(W + 0.2, D + 0.2, tier, p, growth, seed); break;
      case 'workshop': g = workshop(W, D, tier, p); break;
      case 'lantern': g = lantern(p); break;
      case 'annex': g = leanTo(W + 0.3, D + 0.3, p, glow); break;
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
    this.place(g, f, facing);
    return g;
  }

  /** A house on its plot, at progress p. */
  private homeMesh(plotId: number | undefined, tier: number, p: number, glow: THREE.Mesh[]): THREE.Group {
    const plot = this.village.plots.find((x) => x.id === plotId);
    if (!plot) return new THREE.Group();
    const g = buildHouse(plot.house, tier, p, glow);
    g.position.set(plot.hc.x, heightAt(this.world, plot.hc.x, plot.hc.z), plot.hc.z);
    g.rotation.y = plot.yaw;
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

  private upsert(id: string, key: string, build: (glow: THREE.Mesh[]) => THREE.Group) {
    const e = this.entries.get(id);
    if (e && e.key === key) return;
    if (e) this.dispose(e.group);
    const glow: THREE.Mesh[] = [];
    const group = build(glow);
    this.register(group);
    this.group.add(group);
    this.entries.set(id, { key, group, glow });
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
    this.store.door.material = mat(st.level >= 1 ? '#6b4f33' : '#141816', false);
    this.store.fallen.visible = st.level < 2 && this.roofs.mode === 'shown';
    if (st.level >= 2 && !this.roofDone) {
      this.roofDone = roofPatch(this.village.site, 1);
      this.roofDone.userData.roofGroup = true;
      this.register(this.roofDone);
      this.group.add(this.roofDone);
    }
    // Inside the shelter: junk before it's cleared, cots after, a long table once it's the hall.
    const site = this.village.site;
    const S = site.shelter;
    const ikey = `${st.level}:${st.beds}`;
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
      this.register(gi);
      this.storeInterior = gi;
      this.group.add(gi);
    }

    for (const b of v.buildings) {
      if (b.kind === 'store') continue;
      if (b.kind === 'home') {
        const id = `b${b.id}`;
        live.add(id);
        this.upsert(id, `home${b.tier}`, (glow) => {
          const g = this.homeMesh(b.plot, b.tier, 1, glow);
          g.userData.buildingId = b.id;
          return g;
        });
        continue;
      }
      // An upgrade in progress keeps the old building standing until it's done.
      const id = `b${b.id}`;
      live.add(id);
      const key = `${b.kind}${b.tier}:${Math.round(b.growth * 5)}`;
      this.upsert(id, key, (glow) => {
        const g = this.meshFor(b.kind, b.tier, b.foot, b.facing, 1, b.growth, b.id, glow);
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
            if (target) g.add(this.meshFor(target.kind, 1, p.foot, p.facing, (prog - 0.5) * 2 * 0.7, target.growth, target.id, glow));
          }
          return g;
        }
        if (p.kind !== 'kitchen') g.add(blueprint(p.foot, this.world));
        g.add(materialPile(p, p.foot, this.world));
        if (p.work > 0) g.add(this.meshFor(p.kind, p.tier, p.foot, p.facing, Math.min(0.99, prog), 0.2, p.id, glow));
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

  /** Warm windows at night for buildings with someone asleep inside. */
  update(night: number, occupied: Set<number>, t: number) {
    const lit = night > 0.35;
    const st = this.village.buildings.find((b) => b.kind === 'store')!;
    for (const m of this.store.glow) m.visible = lit && occupied.has(st.id);
    for (const b of this.village.buildings) {
      const e = this.entries.get(`b${b.id}`);
      if (!e) continue;
      for (const m of e.glow) m.visible = lit && occupied.has(b.id);
      if (b.kind === 'lantern') {
        e.group.traverse((o) => {
          if (o.userData.lanternHalo) (o as THREE.Sprite).scale.setScalar((1.4 + night * 1.2) * (1 + Math.sin(t * 2 + b.id) * 0.06));
        });
      }
    }
  }
}

// ---------- salvage heaps ----------

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

  private car(h: Heap) {
    const rand = makeRand(h.id * 31 + 7);
    const g = new THREE.Group();
    const body = mat(['#6d4a36', '#5a6068', '#7a5a3a', '#4e5f55'][h.id % 4], true, 'heap');
    const parts: THREE.Object3D[] = [];
    g.add(box(4.0, 0.7, 1.75, body, 0, 0.5, 0));
    const cabin = new THREE.Group();
    cabin.add(box(2.1, 0.65, 1.55, body, -0.3, 1.15, 0));
    cabin.add(box(1.9, 0.45, 1.57, mat('#1d2527', true, 'heap'), -0.3, 1.18, 0));
    g.add(cabin);
    for (const [x, z] of [[-1.3, 0.85], [1.3, 0.85], [-1.3, -0.85], [1.3, -0.85]]) {
      if (rand() < 0.4) continue;
      const w = cyl(0.3, 0.2, mat('#2a2826', true, 'heap'), x, 0.2, z, 8);
      w.rotation.x = Math.PI / 2;
      g.add(w);
      parts.push(w);
    }
    const hood = box(1.2, 0.05, 1.6, body, 1.5, 0.95, 0);
    hood.rotation.z = -0.5;
    g.add(hood);
    parts.push(hood);
    const x = tileX(this.world, h.tx), z = tileZ(this.world, h.tz);
    g.position.set(x, heightAt(this.world, x, z) - 0.1, z);
    g.rotation.set(0, h.rot, (rand() - 0.5) * 0.08);
    return { g, cabin, parts, last: -1 };
  }

  private pile(h: Heap) {
    const rand = makeRand(h.id * 17 + 3);
    const g = new THREE.Group();
    const parts: THREE.Object3D[] = [];
    for (let i = 0; i < 8; i++) {
      const m = mat(PANELS[Math.floor(rand() * PANELS.length)], true, 'heap');
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

