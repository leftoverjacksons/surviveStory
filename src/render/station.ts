import * as THREE from 'three';
import { CANOPY, CAR, SIGN, STORE } from '../sim/layout';
import { PIXEL, enhance, enhanced, lambert, makeRand, shadowed } from './util';

/** Surfaces that vines should grow over, collected while building the station. */
export interface VineSurface {
  /** Returns a random point on the surface plus its outward normal. */
  sample(rand: () => number): { p: THREE.Vector3; n: THREE.Vector3 };
  weight: number;
  /** Ivy on a roof: lifted off with the roofs. */
  roof?: boolean;
}

export interface VineEdge { a: THREE.Vector3; b: THREE.Vector3 } // hanging-vine anchor lines


export function boxSurface(center: THREE.Vector3, size: THREE.Vector3, faces: ('px' | 'nx' | 'pz' | 'nz' | 'py')[], weight: number): VineSurface {
  return {
    weight,
    sample(rand) {
      const f = faces[Math.floor(rand() * faces.length)];
      const u = rand() - 0.5, v = rand();
      const p = center.clone(), n = new THREE.Vector3();
      const hx = size.x / 2, hz = size.z / 2;
      // Vines favour the lower part of walls: bias v toward 0.
      const vy = Math.pow(v, 1.6) * size.y - size.y / 2;
      switch (f) {
        case 'px': p.x += hx + 0.02; p.y += vy; p.z += u * size.z; n.set(1, 0, 0); break;
        case 'nx': p.x -= hx + 0.02; p.y += vy; p.z += u * size.z; n.set(-1, 0, 0); break;
        case 'pz': p.z += hz + 0.02; p.y += vy; p.x += u * size.x; n.set(0, 0, 1); break;
        case 'nz': p.z -= hz + 0.02; p.y += vy; p.x += u * size.x; n.set(0, 0, -1); break;
        case 'py': p.y += size.y / 2 + 0.02; p.x += u * size.x; p.z += (rand() - 0.5) * size.z; n.set(0, 1, 0); break;
      }
      return { p, n };
    },
  };
}

/**
 * The top face of a (possibly tilted) slab: points are sampled in the slab's
 * own frame and carried by its rotation, so ivy lies on a pitched roof
 * instead of cutting through it on a level plane.
 */
export function slabSurface(slab: THREE.Mesh, sx: number, thick: number, sz: number, weight: number): VineSurface {
  slab.updateMatrix();
  const m = slab.matrix.clone();
  const rot = new THREE.Matrix3().setFromMatrix4(m);
  const n = new THREE.Vector3(0, 1, 0).applyMatrix3(rot).normalize();
  return {
    weight,
    roof: true,
    sample(rand) {
      const p = new THREE.Vector3((rand() - 0.5) * sx, thick / 2 + 0.02, (rand() - 0.5) * sz).applyMatrix4(m);
      return { p, n: n.clone() };
    },
  };
}

export interface StoreParts { fallen: THREE.Mesh; door: THREE.Mesh; glow: THREE.Mesh[] }

export interface StationBuild {
  group: THREE.Group;
  surfaces: VineSurface[];
  edges: VineEdge[];
  store: StoreParts;
  /** Lifted off when roofs are hidden. */
  roofs: THREE.Object3D[];
  /** Sliced at knee height in cutaway view. */
  cutMaterials: THREE.Material[];
}

export function buildStation(): StationBuild {
  const g = new THREE.Group();
  const surfaces: VineSurface[] = [];
  const edges: VineEdge[] = [];
  const rand = makeRand(5);

  const concrete = lambert('#a39e90');
  const concreteDark = lambert('#6f6b62');
  const rust = lambert('#8a4b2a');
  const fasciaCream = lambert('#cfc6a8');
  const fasciaTeal = lambert('#4f7f7a');
  const glass = new THREE.MeshLambertMaterial({ color: '#1a2226', transparent: true, opacity: 0.85 });

  const roofs: THREE.Object3D[] = [];
  const storeWall = lambert('#a39e90');
  const cutMaterials: THREE.Material[] = [storeWall, glass];

  // --- store building: hollow, so its interior can be seen with the roof off ---
  const storeC = new THREE.Vector3(STORE.x, STORE.h / 2, STORE.z);
  const storeS = new THREE.Vector3(STORE.w, STORE.h, STORE.d);
  const T = 0.28; // wall thickness
  const x0s = STORE.x - STORE.w / 2, x1s = STORE.x + STORE.w / 2;
  const z0s = STORE.z - STORE.d / 2, z1s = STORE.z + STORE.d / 2;
  const wallBox = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), storeWall);
    m.position.set(x, y, z);
    g.add(m);
  };
  wallBox(STORE.w, STORE.h, T, STORE.x, STORE.h / 2, z0s + T / 2);                    // back
  wallBox(T, STORE.h, STORE.d, x0s + T / 2, STORE.h / 2, STORE.z);                    // west
  wallBox(T, STORE.h, STORE.d, x1s - T / 2, STORE.h / 2, STORE.z);                    // east
  const doorX = STORE.x + 0.7, doorHalf = 0.6;
  wallBox(doorX - doorHalf - x0s, STORE.h, T, (x0s + doorX - doorHalf) / 2, STORE.h / 2, z1s - T / 2);
  wallBox(x1s - doorX - doorHalf, STORE.h, T, (x1s + doorX + doorHalf) / 2, STORE.h / 2, z1s - T / 2);
  wallBox(doorHalf * 2, STORE.h - 2.3, T, doorX, 2.3 + (STORE.h - 2.3) / 2, z1s - T / 2); // lintel
  const floorMat = lambert('#5e5a52');
  const floor = new THREE.Mesh(new THREE.BoxGeometry(STORE.w - T * 2, 0.08, STORE.d - T * 2), floorMat);
  floor.position.set(STORE.x, 0.04, STORE.z);
  g.add(floor);
  // Fittings left from before: a counter and empty shelving.
  const fit = lambert('#7a6a55');
  cutMaterials.push(fit);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 0.7), fit);
  counter.position.set(STORE.x + 3.1, 0.5, STORE.z + 1.2);
  g.add(counter);
  for (const sx of [1.6, 3.2]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.0, 0.45), fit);
    shelf.position.set(STORE.x + sx, 1.0, z0s + T + 0.25);
    g.add(shelf);
  }
  surfaces.push(boxSurface(storeC, storeS, ['px', 'nx', 'pz', 'nz'], 3));
  // Roof slab, partly collapsed at one end.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(STORE.w * 0.62, 0.3, STORE.d + 0.6), concreteDark);
  roof.position.set(STORE.x - STORE.w * 0.19, STORE.h + 0.15, STORE.z);
  g.add(roof);
  roofs.push(roof);
  surfaces.push({ ...boxSurface(roof.position.clone(), new THREE.Vector3(STORE.w * 0.62, 0.3, STORE.d + 0.6), ['py'], 2), roof: true });
  const fallen = new THREE.Mesh(new THREE.BoxGeometry(STORE.w * 0.4, 0.3, STORE.d + 0.4), concreteDark);
  fallen.position.set(STORE.x + STORE.w * 0.3, STORE.h - 0.9, STORE.z + 0.2);
  fallen.rotation.z = -0.42;
  g.add(fallen);
  roofs.push(fallen);
  // Windows and door on the front face.
  const front = STORE.z + STORE.d / 2 + 0.01;
  const glow: THREE.Mesh[] = [];
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc27a').multiplyScalar(1.6), toneMapped: false });
  cutMaterials.push(glowMat);
  for (const wx of [-3.4, -1.4, 2.8]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 0.08), glass);
    win.position.set(STORE.x + wx, 1.7, front);
    g.add(win);
    // Lamplight behind the glass once people live inside.
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.15), glowMat);
    lamp.position.set(STORE.x + wx, 1.7, front + 0.05);
    lamp.visible = false;
    g.add(lamp);
    glow.push(lamp);
  }
  const doorMat = lambert('#141816');
  cutMaterials.push(doorMat);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.08), doorMat);
  door.position.set(STORE.x + 0.7, 1.1, front);
  g.add(door);

  // --- canopy ---
  const cy = CANOPY.y;
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(CANOPY.w, 0.5, CANOPY.d), concreteDark);
  canopy.position.set(CANOPY.x, cy, CANOPY.z);
  g.add(canopy);
  roofs.push(canopy);
  surfaces.push({ ...boxSurface(canopy.position.clone(), new THREE.Vector3(CANOPY.w, 0.5, CANOPY.d), ['py'], 4), roof: true });
  // Two-tone fascia band (unbranded).
  const band = (w: number, d: number, x: number, z: number) => {
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.32, d), fasciaCream);
    b1.position.set(x, cy + 0.1, z);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.14, d + 0.01), fasciaTeal);
    b2.position.set(x, cy - 0.12, z);
    g.add(b1, b2);
    roofs.push(b1, b2);
  };
  band(CANOPY.w + 0.1, 0.1, CANOPY.x, CANOPY.z + CANOPY.d / 2);
  band(CANOPY.w + 0.1, 0.1, CANOPY.x, CANOPY.z - CANOPY.d / 2);
  band(0.1, CANOPY.d, CANOPY.x + CANOPY.w / 2, CANOPY.z);
  band(0.1, CANOPY.d, CANOPY.x - CANOPY.w / 2, CANOPY.z);
  // Hanging-vine edges along the canopy rim.
  const x0 = CANOPY.x - CANOPY.w / 2, x1 = CANOPY.x + CANOPY.w / 2;
  const z0 = CANOPY.z - CANOPY.d / 2, z1 = CANOPY.z + CANOPY.d / 2;
  const ey = cy - 0.25;
  edges.push(
    { a: new THREE.Vector3(x0, ey, z1), b: new THREE.Vector3(x1, ey, z1) },
    { a: new THREE.Vector3(x1, ey, z0), b: new THREE.Vector3(x1, ey, z1) },
    { a: new THREE.Vector3(x0, ey, z0), b: new THREE.Vector3(x0, ey, z1) },
  );

  // Pillars.
  for (const px of [-3.6, 3.6]) {
    for (const pz of [CANOPY.z - 1.6, CANOPY.z + 1.6]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.4, cy, 0.4), concrete);
      if (!cutMaterials.includes(concrete)) cutMaterials.push(concrete);
      pil.position.set(px, cy / 2, pz);
      g.add(pil);
      surfaces.push(boxSurface(pil.position.clone(), new THREE.Vector3(0.4, cy, 0.4), ['px', 'nx', 'pz', 'nz'], 0.5));
    }
  }

  // Pump islands + pumps.
  for (const pz of [CANOPY.z - 1.6, CANOPY.z + 1.6]) {
    const island = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.22, 1.1), concrete);
    island.position.set(0, 0.11, pz);
    g.add(island);
    for (const px of [-1.8, 1.8]) {
      const pump = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 0.5), lambert('#8e3b2e'));
      body.position.y = 0.97;
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.52), lambert('#d6cfb5'));
      face.position.y = 1.35;
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.6), lambert('#5a2a22'));
      top.position.y = 1.8;
      const hose = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 4, 10, Math.PI), lambert('#1c1c1c'));
      hose.position.set(0.45, 0.9, 0);
      hose.rotation.y = Math.PI / 2;
      pump.add(body, face, top, hose);
      pump.position.set(px, 0, pz);
      pump.rotation.y = (rand() - 0.5) * 0.15;
      g.add(pump);
      surfaces.push(boxSurface(new THREE.Vector3(px, 0.97, pz), new THREE.Vector3(0.8, 1.5, 0.5), ['px', 'nx', 'pz', 'nz'], 0.25));
    }
  }

  // Tall roadside sign, leaning.
  const sign = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 8, 6), rust);
  pole.position.y = 4;
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 0.3), fasciaCream);
  board.position.y = 8.2;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.82, 0.4, 0.32), fasciaTeal);
  stripe.position.y = 7.7;
  sign.add(pole, board, stripe);
  sign.position.set(SIGN.x, 0, SIGN.z);
  sign.userData.noCut = true;
  sign.rotation.set(0.05, 0.4, -0.09);
  g.add(sign);
  surfaces.push(boxSurface(new THREE.Vector3(SIGN.x, 2.5, SIGN.z), new THREE.Vector3(0.35, 5, 0.35), ['px', 'nx', 'pz', 'nz'], 0.6));

  // Abandoned car, rusting into the apron.
  const car = new THREE.Group();
  const carBody = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 1.8), lambert('#6d5a44'));
  carBody.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.6), lambert('#5c4a39'));
  cabin.position.set(-0.3, 1.25, 0);
  const winMat = lambert('#1d2527');
  const ws = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 1.62), winMat);
  ws.position.set(-0.3, 1.28, 0);
  car.add(carBody, cabin, ws);
  for (const [wx, wz] of [[-1.4, 0.9], [1.4, 0.9], [-1.4, -0.9], [1.4, -0.9]]) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 8), lambert('#2a2826'));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(wx, 0.22, wz);
    car.add(rim);
  }
  car.position.set(CAR.x, -0.1, CAR.z);
  car.userData.noCut = true;
  car.rotation.set(0, CAR.rot, 0.04);
  g.add(car);
  surfaces.push(boxSurface(new THREE.Vector3(CAR.x, 0.8, CAR.z), new THREE.Vector3(4.2, 1.4, 1.8), ['py', 'pz', 'nx'], 0.8));

  // Fuel barrels, long empty.
  for (let i = 0; i < 3; i++) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.95, 10), lambert('#3f5a4a'));
    barrel.position.set(-8.3 + i * 0.75, 0.48, -1.2 + (i % 2) * 0.4);
    g.add(barrel);
  }

  // Snow settles on the station's roofs and ledges in winter.
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && (m as THREE.MeshLambertMaterial).isMeshLambertMaterial && !enhanced.has(m)) enhance(m, { fog: false });
  });
  return { group: shadowed(g), surfaces, edges, store: { fallen, door, glow }, roofs, cutMaterials };
}

/** Ivy split into what grows on the roofs (and hangs from them) and what climbs the walls. */
export function buildVines(surfaces: VineSurface[], edges: VineEdge[]): { walls: THREE.InstancedMesh; roofs: THREE.InstancedMesh } {
  return {
    walls: buildVineMesh(surfaces.filter((s) => !s.roof), [], 7000, 11),
    roofs: buildVineMesh(surfaces.filter((s) => s.roof), edges, 9000, 12),
  };
}

function buildVineMesh(surfaces: VineSurface[], edges: VineEdge[], total: number, seed: number): THREE.InstancedMesh {
  const rand = makeRand(seed);
  const leaf = new THREE.BufferGeometry();
  leaf.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, 0, 0.09, 0.1, 0, 0, 0.24, 0, -0.09, 0.1, 0,
  ]), 3));
  leaf.setIndex([0, 1, 2, 0, 2, 3]);
  leaf.computeVertexNormals();
  // Ivy is evergreen: no autumn colour or bare branches (pale leaves on a dark wall read as specks).
  const mat = enhance(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), { wind: 0.25, fog: false, season: 'conifer' });
  // The pixel look: fewer, larger leaves, so ivy reads as masses rather than grain.
  const big = PIXEL ? 1.7 : 1, sparse = PIXEL ? 0.4 : 1;
  const max = 16000;
  const mesh = new THREE.InstancedMesh(leaf, mat, max);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const col = new THREE.Color();
  const up = new THREE.Vector3(0, 0, 1);
  let n = 0;

  const put = (p: THREE.Vector3, normal: THREE.Vector3, scale: number) => {
    if (n >= max) return;
    q.setFromUnitVectors(up, normal);
    const spin = new THREE.Quaternion().setFromAxisAngle(normal, rand() * Math.PI * 2);
    q.premultiply(spin);
    s.setScalar(scale * big);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    col.setHSL(0.25 + rand() * 0.08, PIXEL ? 0.36 + rand() * 0.14 : 0.5 + rand() * 0.2, PIXEL ? 0.15 + rand() * 0.07 : 0.18 + rand() * 0.16);
    mesh.setColorAt(n, col);
    n++;
  };

  const totalW = surfaces.reduce((a, sf) => a + sf.weight, 0);
  for (const sf of surfaces) {
    const count = Math.floor((sf.weight / totalW) * total * sparse);
    for (let i = 0; i < count; i++) {
      const { p, n: nrm } = sf.sample(rand);
      // Clump: skip some samples to leave bare patches.
      if (Math.sin(p.x * 1.3 + p.z * 0.7) + Math.cos(p.y * 2.1 + p.x) < -0.6) continue;
      put(p, nrm.clone().add(new THREE.Vector3((rand() - 0.5) * 0.8, (rand() - 0.5) * 0.8, (rand() - 0.5) * 0.8)).normalize(), 0.8 + rand() * 0.9);
    }
  }

  // Hanging strands.
  const tmp = new THREE.Vector3();
  for (const e of edges) {
    const len = e.a.distanceTo(e.b);
    const strands = Math.floor(len * 2.6);
    for (let i = 0; i < strands; i++) {
      if (rand() < 1 - 0.7 * sparse) continue;
      tmp.lerpVectors(e.a, e.b, rand());
      const hang = 0.4 + Math.pow(rand(), 1.5) * 3.4;
      for (let y = 0; y < hang; y += 0.09) {
        const p = tmp.clone().add(new THREE.Vector3((rand() - 0.5) * 0.12, -y, (rand() - 0.5) * 0.12));
        const nrm = new THREE.Vector3(rand() - 0.5, rand() - 0.2, rand() - 0.5).normalize();
        put(p, nrm, 0.6 + rand() * 0.6);
      }
    }
  }

  mesh.count = n;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}
