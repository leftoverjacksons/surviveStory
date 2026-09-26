import * as THREE from 'three';
import { CANOPY, CAR, SIGN, STORE } from '../sim/layout';
import { enhance, lambert, makeRand, shadowed } from './util';

/** Surfaces that vines should grow over, collected while building the station. */
export interface VineSurface {
  /** Returns a random point on the surface plus its outward normal. */
  sample(rand: () => number): { p: THREE.Vector3; n: THREE.Vector3 };
  weight: number;
}

export interface VineEdge { a: THREE.Vector3; b: THREE.Vector3 } // hanging-vine anchor lines


function boxSurface(center: THREE.Vector3, size: THREE.Vector3, faces: ('px' | 'nx' | 'pz' | 'nz' | 'py')[], weight: number): VineSurface {
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

export function buildStation(): { group: THREE.Group; surfaces: VineSurface[]; edges: VineEdge[] } {
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

  // --- store building ---
  const storeC = new THREE.Vector3(STORE.x, STORE.h / 2, STORE.z);
  const storeS = new THREE.Vector3(STORE.w, STORE.h, STORE.d);
  const store = new THREE.Mesh(new THREE.BoxGeometry(storeS.x, storeS.y, storeS.z), concrete);
  store.position.copy(storeC);
  g.add(store);
  surfaces.push(boxSurface(storeC, storeS, ['px', 'nx', 'pz', 'nz'], 3));
  // Roof slab, partly collapsed at one end.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(STORE.w * 0.62, 0.3, STORE.d + 0.6), concreteDark);
  roof.position.set(STORE.x - STORE.w * 0.19, STORE.h + 0.15, STORE.z);
  g.add(roof);
  surfaces.push(boxSurface(roof.position.clone(), new THREE.Vector3(STORE.w * 0.62, 0.3, STORE.d + 0.6), ['py'], 2));
  const fallen = new THREE.Mesh(new THREE.BoxGeometry(STORE.w * 0.4, 0.3, STORE.d + 0.4), concreteDark);
  fallen.position.set(STORE.x + STORE.w * 0.3, STORE.h - 0.9, STORE.z + 0.2);
  fallen.rotation.z = -0.42;
  g.add(fallen);
  // Windows and door on the front face.
  const front = STORE.z + STORE.d / 2 + 0.01;
  for (const wx of [-3.4, -1.4, 2.8]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 0.08), glass);
    win.position.set(STORE.x + wx, 1.7, front);
    g.add(win);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.08), lambert('#141816'));
  door.position.set(STORE.x + 0.7, 1.1, front);
  g.add(door);

  // --- canopy ---
  const cy = CANOPY.y;
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(CANOPY.w, 0.5, CANOPY.d), concreteDark);
  canopy.position.set(CANOPY.x, cy, CANOPY.z);
  g.add(canopy);
  surfaces.push(boxSurface(canopy.position.clone(), new THREE.Vector3(CANOPY.w, 0.5, CANOPY.d), ['py'], 4));
  // Two-tone fascia band (unbranded).
  const band = (w: number, d: number, x: number, z: number) => {
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.32, d), fasciaCream);
    b1.position.set(x, cy + 0.1, z);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.14, d + 0.01), fasciaTeal);
    b2.position.set(x, cy - 0.12, z);
    g.add(b1, b2);
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
  car.rotation.set(0, CAR.rot, 0.04);
  g.add(car);
  surfaces.push(boxSurface(new THREE.Vector3(CAR.x, 0.8, CAR.z), new THREE.Vector3(4.2, 1.4, 1.8), ['py', 'pz', 'nx'], 0.8));

  // Fuel barrels, long empty.
  for (let i = 0; i < 3; i++) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.95, 10), lambert('#3f5a4a'));
    barrel.position.set(-8.3 + i * 0.75, 0.48, -1.2 + (i % 2) * 0.4);
    g.add(barrel);
  }

  return { group: shadowed(g), surfaces, edges };
}

/** Leaves on walls, the canopy roof, and strands hanging from the rim. */
export function buildVines(surfaces: VineSurface[], edges: VineEdge[]): THREE.InstancedMesh {
  const rand = makeRand(11);
  const leaf = new THREE.BufferGeometry();
  leaf.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, 0, 0.09, 0.1, 0, 0, 0.24, 0, -0.09, 0.1, 0,
  ]), 3));
  leaf.setIndex([0, 1, 2, 0, 2, 3]);
  leaf.computeVertexNormals();
  const mat = enhance(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), { wind: 0.25, fog: false });
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
    s.setScalar(scale);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    col.setHSL(0.24 + rand() * 0.1, 0.5 + rand() * 0.25, 0.18 + rand() * 0.16);
    mesh.setColorAt(n, col);
    n++;
  };

  const totalW = surfaces.reduce((a, sf) => a + sf.weight, 0);
  for (const sf of surfaces) {
    const count = Math.floor((sf.weight / totalW) * 9000);
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
      if (rand() < 0.3) continue;
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
