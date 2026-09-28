/**
 * The trades, the cellar and the shrine (DESIGN §21.6). Trade buildings are
 * small procedural salvage houses (render/house.ts), clad in whatever the
 * village has brought home, with the tools of their trade around them: an
 * anvil and grindstone under a tin lean-to, a washing line of cut cloth,
 * smoke racks hung with fish, a tavern porch with benches, barrels, a sign
 * and a string of bulbs.
 *
 * Local frame as in village.ts: the door faces +z; W along x, D along z.
 */
import * as THREE from 'three';
import type { HouseSpec } from '../sim/homes';
import { BULB, box, cyl, mat, smooth } from './kit';
import { buildHouse } from './house';
import { makeRand } from './util';

const CLOTH = ['#b84a3a', '#d8b84a', '#4a7aa8', '#6a9a5a', '#c89ab0', '#e0d8c4', '#7a5a8a'];

/** A small house body for a trade. */
function body(W: number, D: number, tier: number, p: number, seed: number, clad: HouseSpec['clad'], glow: THREE.Mesh[], o: Partial<HouseSpec> = {}) {
  const spec: HouseSpec = {
    W, D, wall: 2.1, ridge: 'along', pitch: 0.5, wing: null, porch: false, chimney: seed % 2 ? 1 : -1, beds: 0, seed, clad, ...o,
  };
  return buildHouse(spec, tier, p, glow);
}

export function tradeMesh(kind: string, W: number, D: number, tier: number, p: number, seed: number, clad: HouseSpec['clad'], glow: THREE.Mesh[]): THREE.Group {
  const g = new THREE.Group();
  const rand = makeRand(seed * 31 + 7);
  const wood = mat('#7a5a3a'), dark = mat('#4a3a2a'), iron = mat('#4e5456'), stone = mat('#8f877a');
  const k = smooth(0.6, 1, p); // props arrive at the end
  switch (kind) {
    case 'toolshop': {
      const bw = Math.max(2.4, W - 1.3);
      const h = body(bw, D, tier, p, seed, clad, glow, { chimney: -1, wall: 2.0 });
      h.position.x = -(W - bw) / 2;
      g.add(h);
      if (k > 0) {
        const x0 = W / 2 - 0.65;
        // An open-sided forge under a tin lean-to.
        for (const z of [-D / 2 + 0.3, D / 2 - 0.3]) g.add(box(0.1, 1.9, 0.1, dark, W / 2 - 0.1, 0.95, z));
        const tin = box(1.5, 0.04, D + 0.2, mat('#8a9296'), x0, 1.95, 0);
        tin.rotation.z = -0.22;
        g.add(tin);
        g.add(cyl(0.22, 0.55, wood, x0, 0.27, 0.45));             // stump
        g.add(box(0.46, 0.14, 0.2, iron, x0, 0.62, 0.45));         // anvil
        g.add(box(0.2, 0.1, 0.14, iron, x0 + 0.26, 0.64, 0.45));   // its horn
        const wheel = cyl(0.3, 0.1, stone, x0, 0.62, -0.55, 12);   // grindstone
        wheel.rotation.x = Math.PI / 2;
        g.add(wheel);
        g.add(box(0.08, 0.5, 0.5, wood, x0, 0.3, -0.55));
        // Tools hung on the wall.
        for (let i = 0; i < 4; i++) g.add(box(0.05, 0.5 + rand() * 0.3, 0.04, iron, x0 - 0.5 + i * 0.16, 1.2, -D / 2 + 0.12));
      }
      break;
    }
    case 'tailor': {
      g.add(body(W, Math.max(2.2, D - 0.5), tier, p, seed, clad, glow, { wall: 2.0 }));
      if (k > 0) {
        // A washing line of cut cloth from the corner to a post.
        const x1 = W / 2 + 0.55, z0 = -D / 2 + 0.2, z1 = D / 2 + 0.1;
        g.add(box(0.07, 1.7, 0.07, dark, x1, 0.85, z1));
        g.add(box(0.07, 1.7, 0.07, dark, x1, 0.85, z0));
        g.add(box(0.02, 0.02, z1 - z0, mat('#d8d0bc'), x1, 1.62, (z0 + z1) / 2));
        const n = 4 + Math.floor(rand() * 2);
        for (let i = 0; i < n; i++) {
          const len = 0.4 + rand() * 0.35;
          g.add(box(0.03, len, 0.34, mat(CLOTH[Math.floor(rand() * CLOTH.length)]), x1, 1.6 - len / 2, z0 + 0.3 + i * ((z1 - z0 - 0.5) / Math.max(1, n - 1))));
        }
        // A bolt of cloth and a basket by the door.
        g.add(cyl(0.14, 0.7, mat(CLOTH[seed % CLOTH.length]), -W / 2 + 0.5, 0.14, D / 2 + 0.2, 8).rotateZ(Math.PI / 2));
        g.add(cyl(0.2, 0.26, mat('#a88a54'), -W / 2 + 0.35, 0.13, D / 2 - 0.1));
      }
      break;
    }
    case 'smokehouse': {
      const b = body(Math.min(2.2, W), Math.min(2.2, D), tier, p, seed, clad, glow, { wall: 2.3, pitch: 0.75, ridge: 'across' });
      b.position.set(-(W - Math.min(2.2, W)) / 2, 0, -(D - Math.min(2.2, D)) / 2);
      g.add(b);
      if (k > 0) {
        // Drying racks hung with fish and roots.
        const rx = W / 2 - 0.25, rz = D / 2 - 0.2;
        for (const x of [rx - 1.1, rx]) g.add(box(0.06, 1.3, 0.06, dark, x, 0.65, rz));
        for (const y of [0.9, 1.25]) {
          g.add(box(1.2, 0.04, 0.04, wood, rx - 0.55, y, rz));
          for (let i = 0; i < 5; i++) g.add(box(0.06, 0.22, 0.03, mat(rand() < 0.6 ? '#a8905a' : '#7a6a4a'), rx - 1.0 + i * 0.22, y - 0.13, rz));
        }
        // Split wood for the smoke.
        for (let i = 0; i < 3; i++) g.add(box(0.7, 0.14, 0.14, mat('#8a6a44'), W / 2 - 0.45, 0.08 + i * 0.14, -D / 2 + 0.35 + (i % 2) * 0.1));
      }
      break;
    }
    case 'tavern': {
      g.add(body(W, D - 0.5, tier, p, seed, clad, glow, { wall: 2.3, porch: true, pitch: 0.55 }));
      if (k > 0) {
        const front = (D - 0.5) / 2 + 0.25;
        // Benches, a table made of a cable drum, barrels.
        for (const x of [-W / 2 + 0.6, W / 2 - 1.2]) {
          g.add(box(1.0, 0.08, 0.3, wood, x, 0.42, front + 0.6));
          for (const dx of [-0.4, 0.4]) g.add(box(0.08, 0.4, 0.26, dark, x + dx, 0.2, front + 0.6));
        }
        const drum = cyl(0.4, 0.1, wood, W / 2 - 0.5, 0.62, front + 0.5, 10);
        g.add(drum);
        g.add(cyl(0.1, 0.6, dark, W / 2 - 0.5, 0.3, front + 0.5));
        for (let i = 0; i < 2; i++) g.add(cyl(0.2, 0.46, mat('#6a4a2a'), -W / 2 + 0.3, 0.23, -0.2 + i * 0.45, 10));
        // A hanging sign on a bracket.
        g.add(box(0.08, 2.2, 0.08, dark, -W / 2 - 0.1, 1.1, front + 0.2));
        g.add(box(0.7, 0.05, 0.05, dark, -W / 2 + 0.2, 2.1, front + 0.2));
        g.add(box(0.5, 0.36, 0.04, mat(CLOTH[seed % 3]), -W / 2 + 0.3, 1.8, front + 0.2));
        // A string of bulbs along the front.
        const n = 7;
        for (let i = 0; i < n; i++) {
          const x = -W / 2 + 0.3 + (i / (n - 1)) * (W - 0.6);
          const sag = Math.sin((i / (n - 1)) * Math.PI) * 0.18;
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), BULB);
          bulb.position.set(x, 2.35 - sag, front + 0.05);
          g.add(bulb);
          glow.push(bulb);
        }
      }
      break;
    }
  }
  return g;
}

/** A root cellar dug into a turfed mound, with a timber (or stone) door front. */
export function cellarMesh(W: number, D: number, tier: number, p: number): THREE.Group {
  const g = new THREE.Group();
  const k = smooth(0.05, 0.8, p);
  if (k <= 0) return g;
  const turf = mat('#5f7a42'), earth = mat('#6b5236'), wood = mat('#6b4f33'), stone = mat('#8f877a');
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), p >= 0.95 ? turf : earth);
  mound.scale.set(W / 2, 1.1 * k, D / 2);
  mound.position.z = -0.15;
  mound.castShadow = true;
  g.add(mound);
  if (p > 0.5) {
    const face = tier === 1 ? stone : wood;
    g.add(box(1.5, 1.1, 0.2, face, 0, 0.55, D / 2 - 0.45));
    g.add(box(0.7, 0.85, 0.06, mat('#3a2a1c'), 0, 0.45, D / 2 - 0.32));   // door
    g.add(box(1.7, 0.12, 0.3, face, 0, 1.14, D / 2 - 0.45));               // lintel
    for (let i = 0; i < 2; i++) g.add(box(0.8, 0.08, 0.26, stone, 0, 0.04 - i * 0.04, D / 2 - 0.1 + i * 0.26));
  }
  if (p >= 1) g.add(cyl(0.05, 0.5, mat('#4e5456'), W / 4, 1.2, -0.3)); // a vent pipe
  return g;
}

/** A wayside shrine: a little roofed niche on a cairn, with candles and flowers. */
export function shrineMesh(_W: number, D: number, tier: number, p: number, seed: number, glow: THREE.Mesh[]): THREE.Group {
  const g = new THREE.Group();
  const rand = makeRand(seed * 13 + 1);
  const k = smooth(0.05, 0.9, p);
  if (k <= 0) return g;
  const stone = mat(tier === 1 ? '#a8a090' : '#8f877a'), wood = mat('#6b4f33'), moss = mat('#5f7a42');
  // Cairn of stacked stones.
  for (let i = 0; i < 5 * k; i++) {
    const s = 0.9 - i * 0.12;
    g.add(box(s, 0.18, s * 0.8, stone, (rand() - 0.5) * 0.08, 0.09 + i * 0.17, (rand() - 0.5) * 0.08).rotateY(rand() * 0.6));
  }
  if (p > 0.6) {
    const y0 = 0.85;
    g.add(box(0.5, 0.5, 0.38, tier === 1 ? stone : wood, 0, y0 + 0.25, 0));
    g.add(box(0.36, 0.34, 0.05, mat('#2a2420'), 0, y0 + 0.24, 0.18));       // the niche
    for (const s of [-1, 1]) g.add(box(0.36, 0.04, 0.5, wood, s * 0.16, y0 + 0.62, 0).rotateZ(s * -0.6));
  }
  if (p >= 1) {
    // Candles in jars, flowers, a scatter of offerings.
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), BULB);
      c.position.set(-0.3 + i * 0.3, 0.2, D / 2 - 0.35 + (i % 2) * 0.08);
      g.add(c);
      glow.push(c);
      g.add(cyl(0.05, 0.1, mat('#b8c8b0'), c.position.x, 0.08, c.position.z, 6));
    }
    for (let i = 0; i < 6; i++) {
      const a = rand() * Math.PI * 2, r = 0.6 + rand() * 0.25;
      g.add(box(0.08, 0.08, 0.08, mat(CLOTH[Math.floor(rand() * CLOTH.length)]), Math.cos(a) * r, 0.1, Math.sin(a) * r));
      g.add(box(0.03, 0.12, 0.03, moss, Math.cos(a) * r, 0.04, Math.sin(a) * r));
    }
  }
  return g;
}

const DOME_GLASS = new THREE.MeshLambertMaterial({ color: '#cfeee8', transparent: true, opacity: 0.32, depthWrite: false, flatShading: true });
const DOME_STEEL = new THREE.LineBasicMaterial({ color: '#5a6266' });

/** A geodesic greenhouse: faceted glass on a steel frame, green inside. */
export function domeMesh(W: number, D: number, p: number, growth: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const rand = makeRand(seed * 17 + 3);
  const R = Math.min(W, D) / 2;
  g.add(cyl(R + 0.05, 0.22, mat('#8f877a'), 0, 0.11, 0, 16)); // footing ring
  const k = smooth(0.1, 0.8, p);
  if (k <= 0) return g;
  const geo = new THREE.SphereGeometry(R, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  // The frame goes up first, the glass last.
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), DOME_STEEL);
  frame.scale.set(1, k, 1);
  frame.position.y = 0.2;
  g.add(frame);
  if (p > 0.75) {
    const glass = new THREE.Mesh(geo, DOME_GLASS);
    glass.position.y = 0.2;
    glass.renderOrder = 2;
    g.add(glass);
    // A door frame on the front.
    g.add(box(0.9, 1.5, 0.08, mat('#5a6266'), 0, 0.95, R - 0.12));
  }
  if (p >= 1) {
    // Beds of green inside, fuller as it grows.
    const leaf = [mat('#5f8a3a'), mat('#7aa04a'), mat('#4a7a3a')];
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2, r = rand() * (R - 0.6);
      const h = 0.2 + growth * (0.3 + rand() * 0.5);
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.22 + rand() * 0.12, h, 5), leaf[i % 3]);
      c.position.set(Math.cos(a) * r, 0.22 + h / 2, Math.sin(a) * r);
      g.add(c);
    }
    g.add(box(R * 1.3, 0.16, 0.5, mat('#4a3a2a'), 0, 0.28, -0.2));
  }
  return g;
}
