import * as THREE from 'three';
import { heightAt, isPaved } from './terrain';
import { addWind, lambert, makeRand } from './util';

const inStationFootprint = (x: number, z: number) => x > -12 && x < 12 && z > -13 && z < 10;

export function buildTrees(): THREE.Group {
  const g = new THREE.Group();
  const rand = makeRand(17);
  const spots: { x: number; z: number; s: number }[] = [];

  // Treeline ring plus a few pioneers creeping toward the station.
  for (let i = 0; i < 140 && spots.length < 90; i++) {
    const a = rand() * Math.PI * 2;
    const r = 19 + Math.pow(rand(), 0.7) * 26;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (isPaved(x, z) || inStationFootprint(x, z)) continue;
    if (spots.some((o) => Math.hypot(o.x - x, o.z - z) < 2.6)) continue;
    spots.push({ x, z, s: 0.8 + rand() * 0.9 });
  }
  // One old tree has grown up right against the canopy corner.
  spots.push({ x: 6.6, z: 5.8, s: 1.35 });
  spots.push({ x: -11, z: -7.5, s: 1.1 });

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, lambert('#4a3a2c'), spots.length);
  const crownMat = addWind(new THREE.MeshLambertMaterial({ flatShading: true }), 0.04);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length * 4);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  let ci = 0;
  spots.forEach((t, i) => {
    const y = heightAt(t.x, t.z);
    const h = (3 + rand() * 2.5) * t.s;
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.1, 0, (rand() - 0.5) * 0.1));
    m.compose(p.set(t.x, y, t.z), q, s.set(t.s, h, t.s));
    trunks.setMatrixAt(i, m);
    const blobs = 2 + Math.floor(rand() * 3);
    const hue = 0.22 + rand() * 0.09;
    for (let b = 0; b < blobs; b++) {
      const r = (1.1 + rand() * 0.9) * t.s;
      p.set(t.x + (rand() - 0.5) * 1.4 * t.s, y + h + (rand() - 0.2) * 1.2 * t.s, t.z + (rand() - 0.5) * 1.4 * t.s);
      q.setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3));
      m.compose(p, q, s.set(r, r * (0.75 + rand() * 0.3), r));
      crowns.setMatrixAt(ci, m);
      col.setHSL(hue + (rand() - 0.5) * 0.03, 0.42 + rand() * 0.15, 0.2 + rand() * 0.1);
      crowns.setColorAt(ci, col);
      ci++;
    }
  });
  crowns.count = ci;
  for (const im of [trunks, crowns]) {
    im.castShadow = true;
    im.receiveShadow = true;
  }
  g.add(trunks, crowns);

  // Low shrubs and ferns hugging the buildings.
  const shrubs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.6, 0), addWind(new THREE.MeshLambertMaterial({ flatShading: true }), 0.1), 220);
  let si = 0;
  for (let i = 0; i < 600 && si < 220; i++) {
    const x = (rand() - 0.5) * 70, z = (rand() - 0.5) * 70;
    const nearWall = Math.abs(z + 11.9) < 1.5 && Math.abs(x + 1) < 7;
    if (isPaved(x, z) && !nearWall) continue;
    if (!nearWall && rand() < 0.5) continue;
    const r = 0.6 + rand() * 0.9;
    m.compose(p.set(x, heightAt(x, z) + r * 0.3, z), q.identity(), s.set(r, r * 0.7, r));
    shrubs.setMatrixAt(si, m);
    col.setHSL(0.2 + rand() * 0.1, 0.4, 0.18 + rand() * 0.1);
    shrubs.setColorAt(si, col);
    si++;
  }
  shrubs.count = si;
  shrubs.castShadow = shrubs.receiveShadow = true;
  g.add(shrubs);
  return g;
}

// ---------------- deer ----------------

class Deer {
  root = new THREE.Group();
  private legs: THREE.Object3D[] = [];
  private neck = new THREE.Group();
  private target = new THREE.Vector3();
  private state: 'walk' | 'graze' | 'alert' = 'graze';
  private timer = 0;
  private phase = Math.random() * 10;
  private heading = 0;

  constructor(private rand: () => number, x: number, z: number) {
    const coat = lambert('#8a5b3c'), belly = lambert('#c9a27d'), dark = lambert('#2b1d14');
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.42), coat);
    body.position.y = 0.95;
    const rump = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.3), belly);
    rump.position.set(-0.58, 1.0, 0);
    this.root.add(body, rump);
    for (const [lx, lz] of [[0.4, 0.14], [0.4, -0.14], [-0.4, 0.14], [-0.4, -0.14]]) {
      const hip = new THREE.Group();
      hip.position.set(lx, 0.8, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), coat);
      leg.position.y = -0.4;
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.11), dark);
      hoof.position.y = -0.8;
      hip.add(leg, hoof);
      this.legs.push(hip);
      this.root.add(hip);
    }
    this.neck.position.set(0.48, 1.1, 0);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), coat);
    neck.position.set(0.1, 0.25, 0);
    neck.rotation.z = -0.35;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.2), coat);
    head.position.set(0.32, 0.55, 0);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.12), dark);
    nose.position.set(0.53, 0.53, 0);
    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.1), coat);
    earL.position.set(0.18, 0.7, 0.12);
    earL.rotation.x = 0.5;
    const earR = earL.clone();
    earR.position.z = -0.12;
    earR.rotation.x = -0.5;
    this.neck.add(neck, head, nose, earL, earR);
    this.root.add(this.neck);
    this.root.scale.setScalar(0.85 + rand() * 0.25);
    this.root.traverse((o) => { o.castShadow = true; });
    this.root.position.set(x, heightAt(x, z), z);
    this.pickTarget();
    this.timer = rand() * 5;
  }

  private pickTarget() {
    for (let i = 0; i < 20; i++) {
      const a = this.rand() * Math.PI * 2, r = 14 + this.rand() * 22;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!inStationFootprint(x, z)) {
        this.target.set(x, 0, z);
        return;
      }
    }
  }

  update(dt: number) {
    this.timer -= dt;
    const pos = this.root.position;
    if (this.timer <= 0) {
      const roll = this.rand();
      this.state = roll < 0.45 ? 'walk' : roll < 0.85 ? 'graze' : 'alert';
      this.timer = this.state === 'walk' ? 4 + this.rand() * 6 : 3 + this.rand() * 5;
      if (this.state === 'walk') this.pickTarget();
    }
    let neckTarget = 0;
    if (this.state === 'walk') {
      const dx = this.target.x - pos.x, dz = this.target.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) this.state = 'graze';
      const want = Math.atan2(-dz, dx);
      let diff = want - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.heading += diff * Math.min(1, dt * 2);
      const speed = 1.1;
      pos.x += Math.cos(this.heading) * speed * dt;
      pos.z -= Math.sin(this.heading) * speed * dt;
      this.phase += dt * 7;
      this.legs.forEach((l, i) => { l.rotation.z = Math.sin(this.phase + (i % 3 === 0 ? 0 : Math.PI)) * 0.45; });
    } else {
      this.legs.forEach((l) => { l.rotation.z *= 0.9; });
      neckTarget = this.state === 'graze' ? -1.25 : 0.25;
    }
    this.neck.rotation.z += (neckTarget - this.neck.rotation.z) * Math.min(1, dt * 3);
    this.root.rotation.y = this.heading;
    pos.y = heightAt(pos.x, pos.z);
  }
}

export class Herd {
  group = new THREE.Group();
  private deer: Deer[] = [];
  constructor(count = 6) {
    const rand = makeRand(41);
    for (let i = 0; i < count; i++) {
      const d = new Deer(rand, -20 + rand() * 8, -18 + rand() * 8);
      this.deer.push(d);
      this.group.add(d.root);
    }
  }
  update(dt: number) {
    for (const d of this.deer) d.update(dt);
  }
}

// ---------------- fairy ring ----------------

export function buildFairyRing(center: THREE.Vector3, glowMat: THREE.MeshBasicMaterial): THREE.Group {
  const g = new THREE.Group();
  const rand = makeRand(3);
  const stemMat = lambert('#e7e0cc');
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.1;
    const r = 2.2 + (rand() - 0.5) * 0.3;
    const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    const y = heightAt(x, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 5), stemMat);
    stem.position.set(x, y + 0.11, z);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), glowMat);
    cap.position.set(x, y + 0.2, z);
    g.add(stem, cap);
  }
  return g;
}
