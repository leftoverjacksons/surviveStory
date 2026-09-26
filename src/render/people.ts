import * as THREE from 'three';
import type { Agent } from '../sim/colony';
import type { Survivor } from '../sim/community';
import { heightAt, type World } from '../sim/world';
import { lambert } from './util';

export const CLOTH = ['#6f7d5c', '#8a6a4a', '#5a6b7a', '#7a4f45', '#9a8a60', '#4f6a5a', '#6b5a7a', '#8a7a6a'];
const SKIN = ['#e0b896', '#c99a74', '#a8764f', '#7d5537', '#f0cfb0'];
const HAIR = ['#2a1d14', '#5a3b22', '#8a8070', '#1a1a1a', '#a0522d'];

interface Rig {
  root: THREE.Group;      // world position + facing
  body: THREE.Group;      // pose offsets (sitting, lying)
  torso: THREE.Mesh;
  head: THREE.Group;
  hipL: THREE.Group; hipR: THREE.Group;
  armL: THREE.Group; armR: THREE.Group;
  axe: THREE.Object3D;
  log: THREE.Object3D;
  basket: THREE.Object3D;
  ring: THREE.Mesh;
  phase: number;
  fade: number;           // >0 while fading out after death
}

function limb(len: number, radius: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.9, len, 6), mat);
  m.position.y = -len / 2;
  g.add(m);
  return g;
}

export class People {
  group = new THREE.Group();
  private rigs = new Map<number, Rig>();
  selected = 0;

  constructor(private world: World) {}

  private build(s: Survivor): Rig {
    const cloth = lambert(CLOTH[s.hue % CLOTH.length]);
    const pants = lambert('#3a3a34');
    const skin = lambert(SKIN[s.id % SKIN.length]);
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const hipL = limb(0.72, 0.075, pants); hipL.position.set(-0.1, 0.74, 0);
    const hipR = limb(0.72, 0.075, pants); hipR.position.set(0.1, 0.74, 0);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.42, 3, 8), cloth);
    torso.position.y = 1.08;
    const head = new THREE.Group();
    head.position.y = 1.58;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), skin);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.1), lambert(HAIR[s.id % HAIR.length]));
    hair.position.set(0, 0.03, -0.015);
    head.add(skull, hair);
    const armL = limb(0.6, 0.06, cloth); armL.position.set(-0.29, 1.36, 0);
    const armR = limb(0.6, 0.06, cloth); armR.position.set(0.29, 1.36, 0);

    // Axe in the right hand.
    const axe = new THREE.Group();
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 5), lambert('#6b4f33'));
    haft.position.y = -0.1;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.2), lambert('#9aa0a2'));
    blade.position.set(0, 0.2, 0.09);
    axe.add(haft, blade);
    axe.position.set(0, -0.6, 0.05);
    axe.rotation.x = Math.PI / 2;
    armR.add(axe);

    // A log carried across the shoulders.
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 7), lambert('#6a4a30'));
    log.rotation.z = Math.PI / 2;
    log.position.set(0, 1.5, -0.12);
    body.add(log);

    // A basket of berries held in front.
    const basket = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.16, 8), lambert('#9a7a4a'));
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), lambert('#8a1f33'));
    fruit.position.y = 0.05;
    basket.add(bowl, fruit);
    basket.position.set(0, 0.98, 0.3);
    body.add(basket);

    body.add(hipL, hipR, torso, head, armL, armR);
    body.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.52, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#9ff2e0', transparent: true, opacity: 0.85, depthWrite: false }),
    );
    ring.position.y = 0.05;
    ring.visible = false;
    root.add(ring);
    root.userData.survivorId = s.id;
    body.userData.survivorId = s.id;
    return { root, body, torso, head, hipL, hipR, armL, armR, axe, log, basket, ring, phase: s.id * 1.7, fade: 0 };
  }

  sync(survivors: Survivor[], agents: Agent[]) {
    const living = new Set(agents.map((a) => a.id));
    for (const s of survivors) {
      if (living.has(s.id) && !this.rigs.has(s.id)) {
        const r = this.build(s);
        this.rigs.set(s.id, r);
        this.group.add(r.root);
      }
    }
    for (const [id, r] of this.rigs) if (!living.has(id) && r.fade === 0) r.fade = 0.0001;
  }

  pickables(): THREE.Object3D[] {
    return [...this.rigs.values()].filter((r) => r.fade === 0).map((r) => r.root);
  }

  headPosition(id: number, out: THREE.Vector3): boolean {
    const r = this.rigs.get(id);
    if (!r || r.fade > 0) return false;
    r.head.getWorldPosition(out);
    out.y += 0.35;
    return true;
  }

  worldPosition(id: number, out: THREE.Vector3): boolean {
    const r = this.rigs.get(id);
    if (!r) return false;
    out.copy(r.root.position);
    return true;
  }

  update(t: number, dt: number, agents: Agent[]) {
    for (const a of agents) {
      const r = this.rigs.get(a.id);
      if (!r) continue;
      const root = r.root;
      // Smooth toward the simulated position so fast-forward still reads as motion.
      const k = 1 - Math.exp(-dt * 14);
      root.position.x += (a.x - root.position.x) * k;
      root.position.z += (a.z - root.position.z) * k;
      root.position.y = heightAt(this.world, root.position.x, root.position.z);
      let dYaw = (a.anim === 'sleep' ? 0 : a.facing) - root.rotation.y;
      dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
      root.rotation.y += dYaw * Math.min(1, dt * 10);
      r.ring.visible = a.id === this.selected;
      this.pose(r, a, t);
    }
    for (const [id, r] of this.rigs) {
      if (r.fade <= 0) continue;
      r.fade += dt * 0.5;
      r.root.scale.setScalar(Math.max(0.001, 1 - r.fade));
      if (r.fade >= 1) {
        this.group.remove(r.root);
        this.rigs.delete(id);
      }
    }
  }

  private pose(r: Rig, a: Agent, t: number) {
    const ph = t + r.phase;
    // Reset.
    r.body.position.set(0, 0, 0);
    r.body.rotation.set(0, 0, 0);
    r.hipL.rotation.set(0, 0, 0); r.hipR.rotation.set(0, 0, 0);
    r.armL.rotation.set(0, 0, 0.08); r.armR.rotation.set(0, 0, -0.08);
    r.head.rotation.set(0, 0, 0);
    r.torso.scale.y = 1 + Math.sin(ph * 1.6) * 0.02;
    r.axe.visible = false;
    r.log.visible = a.carry?.kind === 'wood';
    r.basket.visible = a.carry?.kind === 'food' || a.anim === 'forage';

    const moving = a.pathI < a.path.length;
    switch (a.anim) {
      case 'walk':
      case 'carry': {
        if (!moving) break;
        const s = Math.sin(ph * 9);
        r.hipL.rotation.x = s * 0.55; r.hipR.rotation.x = -s * 0.55;
        r.body.position.y = Math.abs(Math.cos(ph * 9)) * 0.05;
        if (a.carry?.kind === 'wood') {
          r.armL.rotation.set(-2.6, 0, 0.3); r.armR.rotation.set(-2.6, 0, -0.3);
        } else if (a.carry?.kind === 'food') {
          r.armL.rotation.x = -1.1; r.armR.rotation.x = -1.1;
        } else {
          r.armL.rotation.x = -s * 0.5; r.armR.rotation.x = s * 0.5;
        }
        break;
      }
      case 'chop': {
        r.axe.visible = true;
        const cyc = (ph * 1.4) % 1;
        const swing = cyc < 0.6 ? -2.6 * (cyc / 0.6) : -2.6 + 3.0 * ((cyc - 0.6) / 0.4);
        r.armR.rotation.x = swing;
        r.armL.rotation.x = swing * 0.8;
        r.body.rotation.x = cyc > 0.6 ? 0.15 : -0.05;
        r.hipL.rotation.x = 0.15; r.hipR.rotation.x = -0.2;
        break;
      }
      case 'forage': {
        r.body.position.y = -0.3;
        r.body.rotation.x = 0.45;
        r.hipL.rotation.x = -1.1; r.hipR.rotation.x = -0.6;
        r.armR.rotation.x = -1.2 + Math.sin(ph * 4) * 0.3;
        r.armL.rotation.x = -0.9;
        break;
      }
      case 'sit':
      case 'eat': {
        r.body.position.y = -0.42;
        r.hipL.rotation.x = -1.45; r.hipR.rotation.x = -1.45;
        r.armL.rotation.x = -0.5; r.armR.rotation.x = -0.5;
        if (a.anim === 'eat') r.armR.rotation.x = -1.6 + Math.max(0, Math.sin(ph * 2)) * 0.9;
        else r.head.rotation.y = Math.sin(ph * 0.35) * 0.6;
        break;
      }
      case 'sleep': {
        r.body.rotation.x = -Math.PI / 2;
        r.body.position.set(0, 0.18, 0.85);
        r.torso.scale.y = 1 + Math.sin(ph * 0.8) * 0.03;
        break;
      }
      case 'look': {
        r.head.rotation.y = Math.sin(ph * 0.5) * 1.0;
        r.armR.rotation.set(-2.2, 0, 0.4); // hand shading the eyes
        break;
      }
      default:
        r.head.rotation.y = Math.sin(ph * 0.3) * 0.5;
    }
  }
}
