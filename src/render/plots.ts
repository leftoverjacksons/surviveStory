/**
 * Plots and yards: boundary stakes, wattle fences that go up a stretch at a
 * time, and the things households make behind their houses.
 */
import * as THREE from 'three';
import { plotPoint, type Plot, type YardItem } from '../sim/homes';
import type { Village } from '../sim/buildings';
import { heightAt, type World } from '../sim/world';
import { box, cyl, mat } from './kit';
import { makeRand } from './util';

const CLOTH = ['#e8e0cc', '#8aa0b8', '#c07a5a', '#d8c060', '#9ab08a'];
const FLOWERS = ['#d8607a', '#e8c050', '#f0f0e0', '#b070c0', '#e08040', '#7090e0'];

/** Plot-local frame: +x along the frontage (t), +z back from the street (n). */
function place(world: World, plot: Plot, o: THREE.Object3D, u: number, v: number) {
  const p = plotPoint(plot, u, v);
  o.position.set(p.x, heightAt(world, p.x, p.z), p.z);
  // Local +z maps onto n: yaw = atan2(n.x, n.z).
  o.rotation.y = Math.atan2(plot.n.x, plot.n.z);
}

function fence(world: World, plot: Plot, progress: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const rand = makeRand(seed);
  const wood = mat('#7a5a38'), dark = mat('#5f4630'), weave = mat('#8f7048');
  // Sides and back: front-right → back-right → back-left → front-left.
  const path = [plot.corners[1], plot.corners[2], plot.corners[3], plot.corners[0]];
  const lens = [0, 1, 2].map((k) => Math.hypot(path[k + 1].x - path[k].x, path[k + 1].z - path[k].z));
  const total = lens.reduce((a, b) => a + b, 0);
  let budget = progress * total;
  for (let k = 0; k < 3 && budget > 0; k++) {
    const a = path[k], b = path[k + 1];
    const len = Math.min(lens[k], budget);
    budget -= lens[k];
    const dx = (b.x - a.x) / lens[k], dz = (b.z - a.z) / lens[k];
    const yaw = Math.atan2(dx, dz);
    const n = Math.max(1, Math.round(len / 1.1));
    for (let i = 0; i <= n; i++) {
      const x = a.x + dx * (len * i) / n, z = a.z + dz * (len * i) / n;
      const y = heightAt(world, x, z);
      g.add(cyl(0.05, 0.85 + rand() * 0.1, i % 2 ? wood : dark, x, y + 0.43, z, 5));
      if (i < n) {
        // A woven panel between posts.
        const mx = a.x + dx * (len * (i + 0.5)) / n, mz = a.z + dz * (len * (i + 0.5)) / n;
        const panel = box(0.06, 0.5, len / n - 0.08, weave, mx, heightAt(world, mx, mz) + 0.4, mz);
        panel.rotation.y = yaw;
        panel.rotation.z = (rand() - 0.5) * 0.06;
        g.add(panel);
      }
    }
  }
  return g;
}

function stakes(world: World, plot: Plot): THREE.Group {
  const g = new THREE.Group();
  for (const c of plot.corners) g.add(box(0.07, 0.55, 0.07, mat('#c8b890'), c.x, heightAt(world, c.x, c.z) + 0.27, c.z));
  return g;
}

function item(y: YardItem, seed: number, season: number): THREE.Group {
  const g = new THREE.Group();
  const rand = makeRand(seed);
  const k = y.progress;
  switch (y.kind) {
    case 'beds': {
      const rows = 3;
      for (let r = 0; r < rows; r++) {
        if (r / rows > k) continue;
        const z = -y.d / 2 + (y.d * (r + 0.5)) / rows;
        g.add(box(y.w, 0.16, y.d / rows - 0.25, mat('#6b4f33'), 0, 0.08, z));
        g.add(box(y.w - 0.1, 0.06, y.d / rows - 0.35, mat('#3e2c1e'), 0, 0.17, z));
        if (k >= 1 && y.growth > 0.05 && season !== 3) {
          for (let x = -y.w / 2 + 0.3; x < y.w / 2 - 0.2; x += 0.38) {
            const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(rand() < 0.5 ? '#5f8a3a' : '#7a9a44'));
            pl.position.set(x, 0.22 + 0.1 * y.growth, z + (rand() - 0.5) * 0.15);
            pl.scale.setScalar(0.4 + y.growth * 0.8);
            pl.castShadow = true;
            g.add(pl);
          }
        }
      }
      break;
    }
    case 'woodpile': {
      const n = Math.ceil(12 * k);
      for (let i = 0; i < n; i++) {
        const l = cyl(0.11, 0.7, mat(i % 3 ? '#7a5634' : '#8a6a44'), 0, 0.11 + Math.floor(i / 4) * 0.2, -y.d / 2 + 0.3 + (i % 4) * (y.d - 0.6) / 3);
        l.rotation.z = Math.PI / 2;
        g.add(l);
      }
      if (k >= 1) {
        const roof = box(0.9, 0.05, y.d + 0.2, mat('#6e4f3a'), 0, 0.95, 0);
        roof.rotation.z = 0.25;
        g.add(roof);
        for (const z of [-y.d / 2, y.d / 2]) g.add(box(0.06, 0.95, 0.06, mat('#5b4330'), 0.35, 0.47, z));
      }
      break;
    }
    case 'bench': {
      if (k < 0.3) break;
      g.add(box(y.w, 0.07, 0.35, mat('#8a6a44'), 0, 0.42, 0));
      for (const x of [-y.w / 2 + 0.12, y.w / 2 - 0.12]) g.add(box(0.08, 0.4, 0.3, mat('#5b4330'), x, 0.2, 0));
      if (k >= 1) g.add(box(y.w, 0.3, 0.05, mat('#8a6a44'), 0, 0.65, -0.16));
      break;
    }
    case 'fruit': {
      const s = 0.25 + y.growth * 0.75;
      g.add(cyl(0.06 * s + 0.02, 1.2 * s, mat('#5a4330'), 0, 0.6 * s, 0, 6));
      if (season !== 3) {
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), mat(season === 0 && y.growth > 0.5 ? '#e8c8d0' : '#5f8a44'));
        crown.position.y = 1.35 * s;
        crown.scale.setScalar(s);
        crown.castShadow = true;
        g.add(crown);
        if (y.growth >= 1 && (season === 1 || season === 2)) {
          for (let i = 0; i < 7; i++) {
            const a = rand() * Math.PI * 2;
            g.add(box(0.1, 0.1, 0.1, mat('#c0402a'), Math.cos(a) * 0.6, 1.1 + rand() * 0.5, Math.sin(a) * 0.6));
          }
        }
      }
      break;
    }
    case 'flowers': {
      const n = Math.ceil(16 * k);
      for (let i = 0; i < n; i++) {
        const x = -y.w / 2 + rand() * y.w, z = (rand() - 0.5) * y.d;
        g.add(cyl(0.02, 0.25, mat('#4f7a3a'), x, 0.12, z, 4));
        if (season !== 3) {
          const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(FLOWERS[Math.floor(rand() * FLOWERS.length)]));
          f.position.set(x, 0.27, z);
          g.add(f);
        }
      }
      break;
    }
    case 'washing': {
      if (k < 0.3) break;
      for (const x of [-y.w / 2, y.w / 2]) g.add(cyl(0.04, 1.7, mat('#5b4330'), x, 0.85, 0, 5));
      if (k >= 1) {
        g.add(box(y.w, 0.015, 0.015, mat('#d8d0c0'), 0, 1.62, 0));
        for (let i = 0; i < 3; i++) {
          const cl = box(0.4 + rand() * 0.25, 0.5 + rand() * 0.3, 0.02, mat(CLOTH[Math.floor(rand() * CLOTH.length)]), -y.w / 3 + (i * y.w) / 3 + 0.2, 1.3, 0);
          cl.userData.cloth = true;
          g.add(cl);
        }
      }
      break;
    }
    case 'coop': {
      const h = 0.9 * Math.min(1, k * 1.4);
      if (h > 0.05) g.add(box(y.w, h, y.d, mat('#8a6a44'), 0, h / 2 + 0.25, 0));
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.06, 0.3, 0.06, mat('#5b4330'), x * (y.w / 2 - 0.05), 0.15, z * (y.d / 2 - 0.05)));
      if (k >= 1) {
        const roof = box(y.w + 0.3, 0.05, y.d + 0.3, mat('#6e4f3a'), 0, 1.25, 0);
        roof.rotation.x = 0.3;
        g.add(roof);
        const ramp = box(0.25, 0.03, 0.7, mat('#7a5a3a'), 0.2, 0.2, y.d / 2 + 0.25);
        ramp.rotation.x = -0.4;
        g.add(ramp);
        for (let i = 0; i < 3; i++) {
          const hen = new THREE.Group();
          hen.add(box(0.18, 0.16, 0.26, mat(i === 1 ? '#8a5a3a' : '#e8e0d0'), 0, 0.14, 0));
          hen.add(box(0.1, 0.1, 0.1, mat(i === 1 ? '#8a5a3a' : '#e8e0d0'), 0, 0.26, 0.13));
          hen.add(box(0.04, 0.05, 0.04, mat('#c0402a'), 0, 0.33, 0.14));
          hen.position.set(-0.6 + i * 0.55 + rand() * 0.2, 0, y.d / 2 + 0.6 + rand() * 0.5);
          hen.rotation.y = rand() * Math.PI * 2;
          hen.userData.hen = true;
          g.add(hen);
        }
      }
      break;
    }
    case 'shed': {
      const h = 1.8 * Math.min(1, k * 1.3);
      if (h > 0.05) {
        g.add(box(y.w, h, 0.08, mat('#7a5a38'), 0, h / 2, -y.d / 2));
        for (const x of [-y.w / 2, y.w / 2]) g.add(box(0.08, h, y.d, mat('#7a5a38'), x, h / 2, 0));
        g.add(box(y.w * 0.35, h, 0.08, mat('#6b4f33'), -y.w * 0.32, h / 2, y.d / 2));
      }
      if (k >= 1) {
        const roof = box(y.w + 0.3, 0.06, y.d + 0.35, mat('#5f6a6a'), 0, 1.95, 0);
        roof.rotation.x = -0.18;
        g.add(roof);
        g.add(box(0.5, 0.9, 0.05, mat('#4f6f8a'), y.w * 0.15, 0.6, y.d / 2 + 0.02));
      }
      break;
    }
    case 'fence': break;
  }
  return g;
}

interface Entry { key: string; group: THREE.Group }

export class PlotsView {
  group = new THREE.Group();
  private entries = new Map<string, Entry>();

  constructor(private world: World, private village: Village) {}

  private upsert(id: string, key: string, build: () => THREE.Group) {
    const e = this.entries.get(id);
    if (e && e.key === key) return;
    if (e) this.drop(e);
    const group = build();
    this.group.add(group);
    this.entries.set(id, { key, group });
  }

  private drop(e: Entry) {
    this.group.remove(e.group);
    e.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }

  /** Reconcile with the village. `season` 0..3 (spring..winter). */
  sync(season: number) {
    const live = new Set<string>();
    for (const plot of this.village.plots) {
      const fenceItem = plot.yard.find((y) => y.kind === 'fence');
      const fp = fenceItem?.progress ?? 0;
      const fid = `f${plot.id}`;
      live.add(fid);
      this.upsert(fid, `${Math.floor(fp * 20)}`, () => {
        const g = new THREE.Group();
        g.userData.plotId = plot.id;
        if (fp < 1) g.add(stakes(this.world, plot));
        if (fp > 0) g.add(fence(this.world, plot, fp, plot.id * 7));
        return g;
      });
      plot.yard.forEach((y, i) => {
        if (y.kind === 'fence' || y.progress <= 0) return;
        const id = `y${plot.id}:${i}`;
        live.add(id);
        const key = `${Math.floor(y.progress * 5)}:${Math.round(y.growth * 5)}:${season}`;
        this.upsert(id, key, () => {
          const g = new THREE.Group();
          g.userData.plotId = plot.id;
          const m = item(y, plot.id * 31 + i, season);
          g.add(m);
          place(this.world, plot, g, y.u, y.v);
          return g;
        });
      });
    }
    for (const [id, e] of this.entries) if (!live.has(id)) { this.drop(e); this.entries.delete(id); }
  }

  /** Washing stirs in the wind; hens peck about. */
  update(t: number) {
    for (const e of this.entries.values()) {
      e.group.traverse((o) => {
        if (o.userData.cloth) o.rotation.x = Math.sin(t * 2.2 + o.position.x * 3) * 0.18;
        else if (o.userData.hen) o.rotation.x = Math.max(0, Math.sin(t * 3 + o.position.x * 5)) * 0.5;
      });
    }
  }
}
