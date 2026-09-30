import * as THREE from 'three';
import { mergeDirect, mergeStatic } from './merge';
import type { Agent } from '../sim/colony';
import { Ground, heightAt, idx, isExplored, passable, toTileX, toTileZ, type World } from '../sim/world';
import { SOFT, enhance, lambert, makeRand, shadowed, soften } from './util';
import { makeAnimal, playAnimal, type AnimalBody, type AnimalKind } from './characters';

// ---------------- berry bushes ----------------

export class Bushes {
  group = new THREE.Group();
  private berries: THREE.InstancedMesh;
  private shown: boolean[];
  private berryMats: THREE.Matrix4[][] = [];
  private timer = 0;

  constructor(private world: World) {
    const rand = makeRand(61);
    const n = Math.max(1, world.bushes.length);
    const body = new THREE.InstancedMesh(
      soften(new THREE.IcosahedronGeometry(0.5, SOFT ? 1 : 0)),
      enhance(new THREE.MeshLambertMaterial({ flatShading: !SOFT }), { wind: 0.08, season: 'broadleaf', shade: 2 }),
      n,
    );
    this.berries = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.07, 5, 4),
      enhance(new THREE.MeshLambertMaterial({ color: '#b3304a', emissive: '#3a0812' }), { surface: 'none' }),
      n * 5,
    );
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    world.bushes.forEach((b, i) => {
      const x = b.tx - world.w / 2 + 0.5, z = b.tz - world.h / 2 + 0.5;
      const y = heightAt(world, x, z);
      const r = 0.7 + rand() * 0.4;
      q.setFromEuler(new THREE.Euler(0, rand() * 6, 0));
      m.compose(p.set(x, y + r * 0.3, z), q, s.set(r, r * 0.75, r));
      body.setMatrixAt(i, m);
      col.setHSL(0.26 + rand() * 0.06, 0.45, 0.2 + rand() * 0.08);
      body.setColorAt(i, col);
      const mats: THREE.Matrix4[] = [];
      for (let k = 0; k < 5; k++) {
        const a = rand() * Math.PI * 2, rr = r * 0.45;
        mats.push(new THREE.Matrix4().makeTranslation(x + Math.cos(a) * rr, y + r * 0.35 + rand() * r * 0.3, z + Math.sin(a) * rr));
      }
      this.berryMats.push(mats);
    });
    body.count = world.bushes.length;
    body.castShadow = body.receiveShadow = true;
    this.shown = world.bushes.map(() => false);
    this.berries.count = world.bushes.length * 5;
    this.berries.frustumCulled = false;
    this.group.add(body, this.berries);
    this.sync(true);
  }

  sync(force = false) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    let dirty = false;
    this.world.bushes.forEach((b, i) => {
      const show = b.berries > 0;
      if (!force && show === this.shown[i]) return;
      this.shown[i] = show;
      dirty = true;
      for (let k = 0; k < 5; k++) this.berries.setMatrixAt(i * 5 + k, show ? this.berryMats[i][k] : zero);
    });
    if (dirty) this.berries.instanceMatrix.needsUpdate = true;
  }

  update(dt: number) {
    this.timer += dt;
    if (this.timer > 0.25) { this.timer = 0; this.sync(); }
  }
}

// ---------------- ruins ----------------

export function buildRuins(world: World): THREE.Group {
  const g = new THREE.Group();
  const rand = makeRand(9);
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    enhance(new THREE.MeshLambertMaterial({ flatShading: true })),
    Math.max(1, world.walls.length),
  );
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  world.walls.forEach((wb, i) => {
    const x = wb.tx - world.w / 2 + 0.5, z = wb.tz - world.h / 2 + 0.5;
    p.set(x, heightAt(world, x, z), z);
    s.set(1, wb.h, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    const brick = rand() < 0.4;
    col.set(brick ? '#7a5446' : '#8e8a7e').offsetHSL(0, 0, (rand() - 0.5) * 0.08);
    mesh.setColorAt(i, col);
  });
  mesh.count = world.walls.length;
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  g.add(mesh);

  // Ivy on the ruins: leaves on wall tops and faces.
  const leaf = new THREE.BufferGeometry();
  leaf.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.09, 0.1, 0, 0, 0.24, 0, -0.09, 0.1, 0]), 3));
  leaf.setIndex([0, 1, 2, 0, 2, 3]);
  leaf.computeVertexNormals();
  const perWall = 22;
  const leaves = new THREE.InstancedMesh(
    leaf, enhance(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), { wind: 0.25, season: 'conifer' }), // ivy: evergreen
    Math.max(1, world.walls.length * perWall),
  );
  const up = new THREE.Vector3(0, 0, 1);
  const nrm = new THREE.Vector3();
  let n = 0;
  for (const wb of world.walls) {
    const x = wb.tx - world.w / 2 + 0.5, z = wb.tz - world.h / 2 + 0.5;
    const y0 = heightAt(world, x, z);
    for (let k = 0; k < perWall; k++) {
      if (rand() < 0.35) continue;
      const face = Math.floor(rand() * 5);
      const u = rand() - 0.5, v = Math.pow(rand(), 1.4) * wb.h;
      if (face === 0) { p.set(x + u, y0 + wb.h + 0.02, z + rand() - 0.5); nrm.set(0, 1, 0); }
      else if (face === 1) { p.set(x + 0.52, y0 + v, z + u); nrm.set(1, 0, 0); }
      else if (face === 2) { p.set(x - 0.52, y0 + v, z + u); nrm.set(-1, 0, 0); }
      else if (face === 3) { p.set(x + u, y0 + v, z + 0.52); nrm.set(0, 0, 1); }
      else { p.set(x + u, y0 + v, z - 0.52); nrm.set(0, 0, -1); }
      nrm.add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.8)).normalize();
      q.setFromUnitVectors(up, nrm);
      m.compose(p, q, s.setScalar(0.8 + rand() * 0.8));
      leaves.setMatrixAt(n, m);
      col.setHSL(0.24 + rand() * 0.1, 0.5 + rand() * 0.25, 0.18 + rand() * 0.16);
      leaves.setColorAt(n, col);
      n++;
    }
  }
  leaves.count = n;
  leaves.frustumCulled = false;
  leaves.castShadow = true;
  g.add(leaves);
  return g;
}

// ---------------- deer ----------------

class Deer {
  root = new THREE.Group();
  /** A proper animated model, once loaded (the box deer until then). */
  body: AnimalBody | null = null;
  private legs: THREE.Object3D[] = [];
  private neck = new THREE.Group();
  private target = new THREE.Vector3();
  private state: 'walk' | 'graze' | 'alert' | 'flee' = 'graze';
  private timer = 0;
  private phase = 0;
  private heading = 0;

  constructor(private world: World, private rand: () => number, readonly home: THREE.Vector3) {
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
    // Each rigid part becomes one mesh: body, each leg, the neck and head.
    mergeDirect(this.root);
    for (const hip of this.legs) mergeDirect(hip);
    mergeDirect(this.neck);
    this.root.position.copy(home);
    for (let i = 0; i < 12; i++) {
      const x = home.x + (rand() - 0.5) * 8, z = home.z + (rand() - 0.5) * 8;
      if (this.walkable(x, z)) { this.root.position.set(x, 0, z); break; }
    }
    this.phase = rand() * 10;
    this.pickTarget();
    this.timer = rand() * 5;
  }

  private walkable(x: number, z: number) {
    const w = this.world;
    const tx = toTileX(w, x), tz = toTileZ(w, z);
    if (!passable(w, tx, tz)) return false;
    const i = idx(w, tx, tz);
    // Tree trunks are solid to a deer (people squeeze past them; a deer's body won't).
    if (w.treeAt[i] >= 0) return false;
    return w.ground[i] !== Ground.Asphalt || this.rand() < 0.2;
  }

  /** Can it walk straight from a to b? (Sampled every half unit: no trees, rocks, walls or water.) */
  private clearLine(ax: number, az: number, bx: number, bz: number) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 0.5);
    for (let k = 1; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
      const w = this.world, tx = toTileX(w, x), tz = toTileZ(w, z);
      if (!passable(w, tx, tz) || w.treeAt[idx(w, tx, tz)] >= 0) return false;
    }
    return true;
  }

  /** A grazing spot it can walk straight to (DESIGN §34: deer used to walk into things and stick). */
  private pickTarget(away?: { x: number; z: number }) {
    const pos = this.root.position;
    for (let i = 0; i < 24; i++) {
      let x = this.home.x + (this.rand() - 0.5) * 26, z = this.home.z + (this.rand() - 0.5) * 26;
      if (away) { const a = Math.atan2(pos.z - away.z, pos.x - away.x) + (this.rand() - 0.5) * 1.6, r = 6 + this.rand() * 8; x = pos.x + Math.cos(a) * r; z = pos.z + Math.sin(a) * r; }
      if (this.walkable(x, z) && this.clearLine(pos.x, pos.z, x, z)) { this.target.set(x, 0, z); this.faceTarget(); return true; }
    }
    this.target.copy(pos);
    return false;
  }

  private faceTarget() {
    const pos = this.root.position;
    if (Math.hypot(this.target.x - pos.x, this.target.z - pos.z) > 0.3) this.heading = Math.atan2(-(this.target.z - pos.z), this.target.x - pos.x);
  }

  private stuck = 0;
  private last = new THREE.Vector3();

  update(dt: number, agents: Agent[], herd: Deer[]) {
    this.timer -= dt;
    const pos = this.root.position;
    // Keep a wary distance from people.
    let near: Agent | null = null;
    for (const a of agents) if (Math.hypot(a.x - pos.x, a.z - pos.z) < 7) near = a;
    if (near && this.state !== 'flee') {
      this.state = 'flee';
      this.timer = 3;
      this.pickTarget({ x: near.x, z: near.z });
    }
    if (this.timer <= 0) {
      const roll = this.rand();
      this.state = roll < 0.45 ? 'walk' : roll < 0.85 ? 'graze' : 'alert';
      this.timer = this.state === 'walk' ? 4 + this.rand() * 6 : 3 + this.rand() * 5;
      if (this.state === 'walk') this.pickTarget();
    }
    // Herd-mates keep a body's length apart instead of standing in each other.
    for (const o of herd) {
      if (o === this) continue;
      const q = o.root.position, dx = pos.x - q.x, dz = pos.z - q.z, d = Math.hypot(dx, dz);
      if (d < 1.4 && d > 1e-3) {
        const push = (1.4 - d) * Math.min(1, dt * 2);
        const nx = pos.x + (dx / d) * push, nz = pos.z + (dz / d) * push;
        if (this.walkable(nx, nz)) { pos.x = nx; pos.z = nz; }
      }
    }
    let neckTarget = 0;
    if (this.state === 'walk' || this.state === 'flee') {
      const dx = this.target.x - pos.x, dz = this.target.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) this.state = 'graze';
      const want = Math.atan2(-dz, dx);
      let diff = want - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.heading += diff * Math.min(1, dt * 3);
      const speed = this.state === 'flee' ? 3.2 : 1.1;
      const nx = pos.x + Math.cos(this.heading) * speed * dt, nz = pos.z - Math.sin(this.heading) * speed * dt;
      // Check where the nose will be, not just the middle of the body.
      const hx = nx + Math.cos(this.heading) * 0.7, hz = nz - Math.sin(this.heading) * 0.7;
      if (this.walkable(nx, nz) && this.walkable(hx, hz)) { pos.x = nx; pos.z = nz; }
      else if (!this.pickTarget()) this.state = 'graze';
      // Not getting anywhere for a couple of seconds: give up on that spot.
      this.stuck = pos.distanceTo(this.last) < speed * dt * 0.2 ? this.stuck + dt : 0;
      if (this.stuck > 2) { this.stuck = 0; if (!this.pickTarget()) this.state = 'graze'; }
      this.phase += dt * (this.state === 'flee' ? 12 : 7);
      this.legs.forEach((l, i) => { l.rotation.z = Math.sin(this.phase + (i % 3 === 0 ? 0 : Math.PI)) * 0.45; });
    } else {
      this.legs.forEach((l) => { l.rotation.z *= 0.9; });
      neckTarget = this.state === 'graze' ? -1.25 : 0.25;
    }
    this.neck.rotation.z += (neckTarget - this.neck.rotation.z) * Math.min(1, dt * 3);
    this.root.rotation.y = this.heading;
    this.last.copy(pos);
    pos.y = heightAt(this.world, pos.x, pos.z);
    this.root.visible = isExplored(this.world, toTileX(this.world, pos.x), toTileZ(this.world, pos.z));
    if (this.body && this.root.visible) {
      playAnimal(this.body, this.state === 'flee' ? 'Gallop' : this.state === 'walk' ? 'Walk' : this.state === 'graze' ? 'Eating' : 'Idle');
      this.body.mixer.update(dt);
    }
  }

  /** Swap the box deer for an animated model. */
  wear(body: AnimalBody) {
    for (const c of this.root.children) c.visible = false;
    this.body = body;
    this.root.add(body.root);
  }
}

/** Several small herds grazing in meadows around the region. */
export class Herds {
  group = new THREE.Group();
  private deer: Deer[] = [];
  private herdOf = new Map<Deer, Deer[]>();
  constructor(world: World) {
    const rand = makeRand(41);
    const homes: THREE.Vector3[] = [];
    for (let tries = 0; tries < 400 && homes.length < 6; tries++) {
      const a = rand() * Math.PI * 2, r = 16 + rand() * 70;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const tx = toTileX(world, x), tz = toTileZ(world, z);
      if (!passable(world, tx, tz)) continue;
      const g = world.ground[idx(world, tx, tz)];
      if (g !== Ground.Meadow && g !== Ground.Grass) continue;
      if (homes.some((h) => h.distanceTo(new THREE.Vector3(x, 0, z)) < 25)) continue;
      homes.push(new THREE.Vector3(x, 0, z));
    }
    for (const h of homes) {
      const n = 2 + Math.floor(rand() * 3);
      const herd: Deer[] = [];
      for (let i = 0; i < n; i++) {
        const d = new Deer(world, rand, h);
        this.deer.push(d);
        herd.push(d);
        this.herdOf.set(d, herd);
        this.group.add(d.root);
      }
    }
  }
  /** Where each deer is standing (for footprints in the snow). */
  positions(): { id: string; x: number; z: number; hoofed: boolean }[] {
    return this.deer.filter((d) => d.root.visible).map((d, i) => ({ id: `d${i}`, x: d.root.position.x, z: d.root.position.z, hoofed: true }));
  }
  update(dt: number, agents: Agent[]) {
    for (const d of this.deer) d.update(dt, agents, this.herdOf.get(d)!);
  }

  /** Models arrived: the first of each herd is a stag, the rest does and young. */
  setKinds(kinds: Map<string, AnimalKind>) {
    const deer = kinds.get('deer'), stag = kinds.get('stag');
    if (!deer) return;
    const mat = enhance(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: !SOFT }), { season: 'none' });
    let prevHome: THREE.Vector3 | null = null;
    for (const d of this.deer) {
      const first = d.home !== prevHome;
      prevHome = d.home;
      const kind = first && stag ? stag : deer;
      d.wear(makeAnimal(kind, kind === stag ? 1.9 : 1.45, mat)); // the deer's own scale applies on top
    }
  }
}

// ---------------- fairy ring ----------------

export function buildFairyRing(world: World, glowMat: THREE.MeshBasicMaterial): THREE.Group {
  const g = new THREE.Group();
  const rand = makeRand(3);
  const stemMat = lambert('#e7e0cc');
  const c = world.fairyRing;
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.1;
    const r = 2.2 + (rand() - 0.5) * 0.3;
    const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
    const y = heightAt(world, x, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 5), stemMat);
    stem.position.set(x, y + 0.11, z);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), glowMat);
    cap.position.set(x, y + 0.2, z);
    g.add(stem, cap);
  }
  shadowed(g, true, false);
  // 44 little meshes → two draws (the glowing caps keep their own material).
  mergeStatic(g, undefined, false, (x, z) => heightAt(world, x, z));
  return g;
}
