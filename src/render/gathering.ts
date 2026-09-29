/**
 * What a gathering looks like (DESIGN §24.8): poles and bunting around the
 * ring, trestle tables with the food on them, and at a wedding an arch of
 * flowers. Put up a couple of hours before, taken down an hour after.
 */
import * as THREE from 'three';
import type { Colony } from '../sim/colony';
import { archSpot, nextGathering, slotAngle, type Gathering } from '../sim/gatherings';
import { heightAt, type World } from '../sim/world';
import { box, cyl, mat, GLOW } from './kit';
import { bunting, type Pole } from './plots';

const FOXFIRE = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9ff2c8').multiplyScalar(2), toneMapped: false });
const FLOWERS = ['#f0e6cc', '#e8a0b0', '#e0b050', '#c8a0e0', '#ffffff'];

export class GatheringView {
  readonly group = new THREE.Group();
  private shown = -1;
  constructor(private world: World) { this.group.name = 'gathering'; }

  /** Call each frame: cheap unless the gathering to show changes. */
  sync(col: Colony) {
    const g = nextGathering(col);
    const up = g && col.minute >= g.start - 120 && col.minute < g.end + 60 ? g : undefined;
    const id = up?.id ?? -1;
    if (id === this.shown) return;
    this.shown = id;
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      c.traverse((o) => { if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.LineSegments) o.geometry.dispose(); });
    }
    if (up) this.group.add(this.build(up, col));
  }

  update(t: number, night: number) {
    this.group.traverse((o) => {
      if (o.userData.bulbs) ((o as THREE.Points).material as THREE.PointsMaterial).opacity = night > 0.25 ? night * (0.9 + Math.sin(t * 1.7) * 0.05) : 0;
    });
  }

  private build(g: Gathering, col: Colony): THREE.Group {
    const w = this.world, out = new THREE.Group();
    const y = (x: number, z: number) => heightAt(w, x, z);
    const wood = mat('#6a5038'), cloth = mat('#e8e0cc'), bread = mat('#c89a5a'), fruit = mat('#b8453a'), greens = mat('#6f9a5a');
    // Poles round the outside, strung with bunting and lights.
    const n = 8, R = g.r + 1.7;
    const poles: Pole[] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.2;
      const x = g.at.x + Math.cos(a) * R, z = g.at.z + Math.sin(a) * R;
      poles.push({ base: new THREE.Vector3(x, y(x, z), z), top: new THREE.Vector3(x, y(x, z) + 2.4, z) });
    }
    const pairs: [THREE.Vector3, THREE.Vector3][] = poles.map((p, k) => [p.top, poles[(k + 1) % n].top]);
    out.add(bunting(pairs, poles));
    if (g.kind === 'folk_festival') {
      // Foxfire jars on the poles: the Folk's light.
      for (const p of poles) out.add(cyl(0.09, 0.2, FOXFIRE, p.top.x, p.top.y + 0.12, p.top.z, 6));
    } else {
      for (const p of poles) out.add(cyl(0.07, 0.16, GLOW, p.top.x, p.top.y + 0.1, p.top.z, 6));
    }
    // Trestle tables just inside where people sit to eat (they sit on the ring, facing in).
    const people = Math.max(4, col.agents.length);
    const tables = Math.min(6, Math.max(2, Math.round(people / 4)));
    for (let k = 0; k < tables; k++) {
      const a = slotAngle(g, (k + 0.5) * (people / tables) - 0.5, people);
      const r = g.r - 0.75;
      const x = g.at.x + Math.cos(a) * r, z = g.at.z + Math.sin(a) * r;
      const t = new THREE.Group();
      t.position.set(x, y(x, z), z);
      t.rotation.y = -a; // long side along the ring
      // A plank top with a cloth runner down the middle, on two trestles, and a bench on the ring side.
      t.add(box(0.62, 0.08, 1.7, wood, 0, 0.5, 0), box(0.3, 0.02, 1.72, cloth, 0, 0.55, 0));
      for (const dz of [-0.65, 0.65]) t.add(box(0.5, 0.46, 0.08, wood, 0, 0.23, dz));
      t.add(box(0.26, 0.06, 1.5, wood, 0.62, 0.3, 0), box(0.2, 0.27, 0.06, wood, 0.62, 0.14, -0.6), box(0.2, 0.27, 0.06, wood, 0.62, 0.14, 0.6));
      // The food: loaves, a bowl of fruit, greens.
      t.add(box(0.2, 0.1, 0.12, bread, 0.02, 0.58, -0.45), box(0.18, 0.09, 0.11, bread, -0.05, 0.575, 0.5));
      t.add(cyl(0.12, 0.06, wood, 0, 0.56, 0.05, 8), cyl(0.05, 0.05, fruit, 0.03, 0.61, 0.02, 5), cyl(0.05, 0.05, greens, -0.04, 0.61, 0.09, 5));
      out.add(t);
    }
    if (g.kind === 'wedding') out.add(arch(w, archSpot(g)));
    return out;
  }
}

/** A hazel arch wound with flowers. */
function arch(w: World, at: { x: number; z: number; yaw: number }): THREE.Group {
  const g = new THREE.Group();
  g.position.set(at.x, heightAt(w, at.x, at.z), at.z);
  // The arch spans along the ring's tangent (the couple stand under it, facing each other).
  g.rotation.y = -at.yaw;
  const hazel = mat('#7a5a3a');
  const span = 1.2, hgt = 1.9;
  for (const s of [-1, 1]) g.add(cyl(0.05, hgt, hazel, 0, hgt / 2, (s * span) / 2, 5));
  const bend = new THREE.Mesh(new THREE.TorusGeometry(span / 2, 0.05, 5, 12, Math.PI), hazel);
  bend.position.set(0, hgt, 0);
  bend.rotation.y = Math.PI / 2;
  bend.castShadow = true;
  g.add(bend);
  // Flowers along the posts and over the top.
  for (let k = 0; k < 26; k++) {
    const u = k / 25;
    let px: number, py: number, pz: number;
    if (u < 0.3) { pz = -span / 2; py = (u / 0.3) * hgt; px = 0; }
    else if (u > 0.7) { pz = span / 2; py = ((1 - u) / 0.3) * hgt; px = 0; }
    else { const a = ((u - 0.3) / 0.4) * Math.PI; pz = -Math.cos(a) * span / 2; py = hgt + Math.sin(a) * span / 2; px = 0; }
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(FLOWERS[k % FLOWERS.length]));
    f.position.set(px + ((k * 37) % 5 - 2) * 0.02, py, pz);
    g.add(f);
  }
  return g;
}
