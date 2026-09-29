import * as THREE from 'three';
import { mergeDirect } from './merge';
import type { Agent } from '../sim/colony';
import type { Survivor } from '../sim/community';
import { WATER_Y, heightAt, standHeight, type World } from '../sim/world';
import { SOFT, enhance, lambert } from './util';
import { makeCharacter, type Character, type CharacterKit } from './characters';

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
  sheet: THREE.Object3D;
  rod: THREE.Object3D;
  ring: THREE.Mesh;
  phase: number;
  fade: number;           // >0 while fading out after death
  /** Set when drawn with a character model instead of the primitive figure. */
  model?: ModelParts;
}

interface ModelParts {
  ch: Character;
  actions: Map<string, THREE.AnimationAction>;
  clip: string;
  /** Hand-held props, placed at the right wrist each frame. */
  held: THREE.Object3D[];
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

/**
 * Point `bone` (towards its child `tip`) along a world direction, whatever
 * the animation had it doing. Used for poses the clips don't have: sitting,
 * lying down, carrying overhead, holding a rod out.
 */
function aim(bone: THREE.Object3D | undefined, tip: THREE.Object3D | undefined, dir: THREE.Vector3) {
  if (!bone || !tip || !bone.parent) return;
  bone.updateWorldMatrix(true, true);
  bone.getWorldPosition(_a);
  tip.getWorldPosition(_b);
  _d.subVectors(_b, _a).normalize();
  _q1.setFromUnitVectors(_d, dir);
  bone.getWorldQuaternion(_q2);
  bone.parent.getWorldQuaternion(_q3).invert();
  bone.quaternion.copy(_q3.multiply(_q1.multiply(_q2)));
  bone.updateWorldMatrix(false, true);
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

  private kit: CharacterKit | null = null;
  private survivors = new Map<number, Survivor>();
  private modelMat = enhance(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: !SOFT }), { season: 'none' });

  constructor(private world: World) {}

  /** Character models arrived: redraw everyone with them. */
  setKit(kit: CharacterKit) {
    if (!kit.outfits.length) return;
    this.kit = kit;
    for (const [id, r] of this.rigs) {
      if (r.fade > 0) continue;
      const s = this.survivors.get(id);
      if (!s) continue;
      const n = this.build(s);
      n.root.position.copy(r.root.position);
      n.root.rotation.copy(r.root.rotation);
      this.group.remove(r.root);
      this.group.add(n.root);
      this.rigs.set(id, n);
    }
  }

  private build(s: Survivor): Rig {
    const rig = this.buildFigure(s);
    if (this.kit) this.fitModel(rig, s, this.kit);
    return rig;
  }

  /** Swap the primitive figure's body for a character model (props stay). */
  private fitModel(r: Rig, s: Survivor, kit: CharacterKit) {
    // Outfit by the survivor's id; within an outfit, colours by their own seed.
    const female = s.id % 2 === 1;
    const grown = kit.outfits.filter((o) => !o.child);
    const pool = grown.filter((o) => o.female === female);
    const outfit = (pool.length ? pool : grown)[Math.floor(s.id / 2) % (pool.length || grown.length)];
    const ch = makeCharacter(outfit, { skin: s.id * 7 + 3, hair: s.id * 5 + 1, hue: (s.hue * 0.137) % 1, tall: 0.94 + ((s.id * 37) % 11) / 100 }, this.modelMat);
    ch.mesh.castShadow = true;
    ch.mesh.receiveShadow = true;
    ch.mesh.layers.set(1);
    ch.root.userData.survivorId = s.id;
    // Hide the primitive body; keep its props (log, basket, sheet) on the body group.
    for (const o of [r.hipL, r.hipR, r.torso, r.head, r.armL, r.armR]) o.visible = false;
    r.body.add(ch.root);
    // Hand-held tools move from the primitive arm to the root; placed at the wrist each frame.
    r.armR.remove(r.axe); r.armR.remove(r.rod);
    r.root.add(r.axe, r.rod);
    r.axe.traverse((o) => o.layers.set(1));
    r.rod.traverse((o) => o.layers.set(1));
    // An invisible capsule for clicking on (skinned meshes are awkward to pick).
    const pick = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.y = 0.9;
    pick.userData.survivorId = s.id;
    r.root.add(pick);
    const actions = new Map<string, THREE.AnimationAction>();
    for (const [name, clip] of kit.clips) actions.set(name, ch.mixer.clipAction(clip));
    r.model = { ch, actions, clip: '', held: [r.axe, r.rod] };
    this.play(r.model, 'Idle', 0);
  }

  private play(m: ModelParts, name: string, fade = 0.25) {
    if (m.clip === name) return;
    const next = m.actions.get(name) ?? m.actions.get('Idle');
    if (!next) return;
    const prev = m.actions.get(m.clip);
    next.reset().setEffectiveWeight(1).play();
    if (prev && fade > 0) prev.crossFadeTo(next, fade, false);
    else if (prev) prev.stop();
    m.clip = name;
  }

  private buildFigure(s: Survivor): Rig {
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
    mergeDirect(head);
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

    // A sheet of salvaged tin carried on the shoulder.
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.6), lambert('#7d8a8c'));
    sheet.position.set(0.1, 1.55, -0.05);
    sheet.rotation.set(0.3, 0, 0.5);
    body.add(sheet);

    // A fishing rod, held out over the water, with a line hanging from its tip.
    const rod = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 2.2, 5), lambert('#6a5a3a'));
    pole.position.y = -1.1;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.4, 3), lambert('#d8d0c0'));
    line.position.set(0, -2.2, 0.0);
    line.rotation.x = 0;
    rod.add(pole, line);
    rod.position.set(0, -0.55, 0.05);
    rod.rotation.x = Math.PI / 2 + 0.5;
    rod.visible = false;
    armR.add(rod);

    body.add(hipL, hipR, torso, head, armL, armR);
    body.traverse((o) => { o.castShadow = true; o.receiveShadow = true; o.layers.set(1); });

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.52, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#9ff2e0', transparent: true, opacity: 0.85, depthWrite: false }),
    );
    ring.position.y = 0.05;
    ring.visible = false;
    root.add(ring);
    root.userData.survivorId = s.id;
    body.userData.survivorId = s.id;
    return { root, body, torso, head, hipL, hipR, armL, armR, axe, log, basket, sheet, rod, ring, phase: s.id * 1.7, fade: 0 };
  }

  sync(survivors: Survivor[], agents: Agent[]) {
    for (const s of survivors) this.survivors.set(s.id, s);
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
    if (!r || r.fade > 0 || !r.root.visible) return false;
    const head = r.model?.ch.bone('Head');
    if (head) { head.getWorldPosition(out); out.y += 0.15; return true; }
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

  /**
   * `bed` gives the bed an indoor agent sleeps in; when `showIndoors` is set
   * (roofs off), sleepers are drawn lying there instead of hidden.
   */
  update(t: number, dt: number, agents: Agent[], bed?: (a: Agent) => { x: number; z: number; yaw: number; y?: number } | null, showIndoors = false) {
    for (const a of agents) {
      const r = this.rigs.get(a.id);
      if (!r) continue;
      const root = r.root;
      if (a.indoors) {
        const slot = showIndoors && bed ? bed(a) : null;
        root.visible = !!slot;
        if (slot) {
          root.position.set(slot.x, heightAt(this.world, slot.x, slot.z) + (slot.y ?? 0.1), slot.z);
          root.rotation.y = slot.yaw;
          r.ring.visible = a.id === this.selected;
          this.pose(r, a, t, dt);
        } else root.position.set(a.x, heightAt(this.world, a.x, a.z), a.z);
        continue;
      }
      root.visible = true;
      // Snap after long jumps (e.g. stepping out of a doorway).
      if (Math.hypot(a.x - root.position.x, a.z - root.position.z) > 3) root.position.set(a.x, 0, a.z);
      // Smooth toward the simulated position so fast-forward still reads as motion.
      const k = 1 - Math.exp(-dt * 14);
      root.position.x += (a.x - root.position.x) * k;
      root.position.z += (a.z - root.position.z) * k;
      root.position.y = a.afloat ? WATER_Y + 0.12 : standHeight(this.world, root.position.x, root.position.z);
      let dYaw = (a.anim === 'sleep' ? 0 : a.facing) - root.rotation.y;
      dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
      root.rotation.y += dYaw * Math.min(1, dt * 10);
      r.ring.visible = a.id === this.selected;
      this.pose(r, a, t, dt);
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

  private pose(r: Rig, a: Agent, t: number, dt: number) {
    if (r.model) { this.poseModel(r, r.model, a, t, dt); return; }
    const ph = t + r.phase;
    // Reset.
    r.body.position.set(0, 0, 0);
    r.body.rotation.set(0, 0, 0);
    r.hipL.rotation.set(0, 0, 0); r.hipR.rotation.set(0, 0, 0);
    r.armL.rotation.set(0, 0, 0.08); r.armR.rotation.set(0, 0, -0.08);
    r.head.rotation.set(0, 0, 0);
    r.torso.scale.y = 1 + Math.sin(ph * 1.6) * 0.02;
    r.axe.visible = false;
    r.rod.visible = a.anim === 'fish';
    r.log.visible = a.carry?.kind === 'wood';
    r.basket.visible = a.carry?.kind === 'food' || a.carry?.kind === 'glimmer' || a.anim === 'forage';
    r.sheet.visible = a.carry?.kind === 'scrap' || a.carry?.kind === 'glass' || a.carry?.kind === 'copper' || a.carry?.kind === 'steel';

    const moving = a.pathI < a.path.length;
    switch (a.anim) {
      case 'walk':
      case 'carry': {
        if (!moving) break;
        const s = Math.sin(ph * 9);
        r.hipL.rotation.x = s * 0.55; r.hipR.rotation.x = -s * 0.55;
        r.body.position.y = Math.abs(Math.cos(ph * 9)) * 0.05;
        if (a.carry?.kind === 'wood' || a.carry?.kind === 'scrap') {
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
      case 'build': {
        // Hammering: quick, short strokes.
        r.axe.visible = true;
        const cyc = (ph * 2.6) % 1;
        r.armR.rotation.x = cyc < 0.5 ? -1.9 * (cyc / 0.5) - 0.3 : -2.2 + 2.0 * ((cyc - 0.5) / 0.5);
        r.armL.rotation.x = -0.9;
        r.body.rotation.x = 0.12;
        r.hipL.rotation.x = 0.1; r.hipR.rotation.x = -0.15;
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
      case 'fish': {
        // Sitting on the jetty's edge (or in the boat), rod out, the odd twitch.
        r.body.position.y = -0.42;
        r.hipL.rotation.x = -1.45; r.hipR.rotation.x = -1.45;
        r.armR.rotation.x = -1.25 + Math.sin(ph * 0.7) * 0.05 + (Math.sin(ph * 0.23) > 0.97 ? -0.3 : 0);
        r.armL.rotation.x = -1.0;
        r.head.rotation.x = 0.15;
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
        r.body.position.set(0, 0.3, 0.85);
        r.torso.scale.y = 1 + Math.sin(ph * 0.8) * 0.03;
        break;
      }
      case 'look': {
        r.head.rotation.y = Math.sin(ph * 0.5) * 1.0;
        r.armR.rotation.set(-2.2, 0, 0.4); // hand shading the eyes
        break;
      }
      case 'dance': {
        // A skipping step, arms out to the neighbours on either side.
        const s = Math.sin(ph * 7);
        r.hipL.rotation.x = s * 0.6; r.hipR.rotation.x = -s * 0.6;
        r.body.position.y = Math.abs(Math.cos(ph * 7)) * 0.1;
        r.armL.rotation.set(-0.3, 0, 1.1 + s * 0.15); r.armR.rotation.set(-0.3, 0, -1.1 + s * 0.15);
        break;
      }
      case 'play': {
        // Seated, bowing a fiddle (or squeezing a box): the arms saw across.
        r.body.position.y = -0.42;
        r.hipL.rotation.x = -1.45; r.hipR.rotation.x = -1.45;
        r.armL.rotation.set(-1.4, 0, 0.5);
        r.armR.rotation.set(-1.1, 0, -0.3 + Math.sin(ph * 5) * 0.35);
        r.head.rotation.z = 0.25;
        break;
      }
      case 'cheer': {
        r.armL.rotation.set(-2.8 + Math.sin(ph * 6) * 0.2, 0, 0.3);
        r.armR.rotation.set(-2.8 - Math.sin(ph * 6) * 0.2, 0, -0.3);
        r.body.position.y = Math.max(0, Math.sin(ph * 6)) * 0.06;
        break;
      }
      default:
        r.head.rotation.y = Math.sin(ph * 0.3) * 0.5;
    }
  }

  /** Clips for what the clips cover; bones aimed by hand for the rest. */
  private poseModel(r: Rig, m: ModelParts, a: Agent, t: number, dt: number) {
    const ph = t + r.phase;
    const ch = m.ch, B = ch.bone;
    r.body.position.set(0, 0, 0);
    r.body.rotation.set(0, 0, 0);
    r.axe.visible = false;
    r.rod.visible = a.anim === 'fish';
    r.log.visible = a.carry?.kind === 'wood';
    r.basket.visible = a.carry?.kind === 'food' || a.carry?.kind === 'glimmer' || a.anim === 'forage';
    r.sheet.visible = a.carry?.kind === 'scrap' || a.carry?.kind === 'glass' || a.carry?.kind === 'copper' || a.carry?.kind === 'steel';
    const moving = a.pathI < a.path.length;
    const seated = a.anim === 'sit' || a.anim === 'eat' || a.anim === 'fish' || a.anim === 'play';
    let clip = 'Idle';
    switch (a.anim) {
      case 'walk': case 'carry': clip = moving ? 'Walk' : 'Idle'; break;
      case 'dance': clip = 'Walk'; break;
      case 'cheer': clip = 'Wave'; break;
      case 'play': clip = 'Idle_Neutral'; break;
      case 'chop': clip = 'Sword_Slash'; r.axe.visible = true; break;
      case 'build': clip = 'Punch_Right'; r.axe.visible = true; break;
      case 'forage': clip = 'Interact'; break;
      case 'sleep': case 'sit': case 'eat': case 'fish': clip = 'Idle_Neutral'; break;
    }
    this.play(m, clip);
    ch.mixer.update(dt);
    r.root.updateMatrixWorld(true);

    // World directions in the survivor's own frame.
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(r.root.quaternion);
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(r.root.quaternion);
    const down = new THREE.Vector3(0, -1, 0);
    const dir = (x: number, y: number, z: number) => new THREE.Vector3().addScaledVector(right, x).addScaledVector(Y, y).addScaledVector(fwd, z).normalize();

    if (a.anim === 'sleep') {
      r.body.rotation.x = -Math.PI / 2;
      r.body.position.set(0, 0.25, 0.85);
    } else if (seated) {
      // Sit: hips down to seat height, thighs forward, shins down.
      r.body.position.y = -0.42;
      r.body.updateMatrixWorld(true);
      for (const side of ['L', 'R']) {
        aim(B(`UpperLeg.${side}`), B(`LowerLeg.${side}`), dir(side === 'L' ? -0.05 : 0.05, -0.1, 1));
        aim(B(`LowerLeg.${side}`), B(`Foot.${side}`), down);
      }
      if (a.anim === 'fish') {
        aim(B('UpperArm.R'), B('LowerArm.R'), dir(0.1, -0.2, 1));
        aim(B('LowerArm.R'), B('Wrist.R'), dir(0, 0.35 + Math.sin(ph * 0.7) * 0.05, 1));
        aim(B('UpperArm.L'), B('LowerArm.L'), dir(-0.2, -0.5, 1));
      } else if (a.anim === 'eat') {
        aim(B('UpperArm.R'), B('LowerArm.R'), dir(0.2, -0.6, 0.6));
        aim(B('LowerArm.R'), B('Wrist.R'), dir(-0.2, 0.2 + Math.max(0, Math.sin(ph * 2)) * 0.9, 0.5));
      } else if (a.anim === 'play') {
        // A fiddle under the chin: left arm out and up, the bow arm sawing across.
        aim(B('UpperArm.L'), B('LowerArm.L'), dir(-0.5, 0.1, 0.8));
        aim(B('LowerArm.L'), B('Wrist.L'), dir(0.4, 0.5, 0.6));
        aim(B('UpperArm.R'), B('LowerArm.R'), dir(0.6, -0.3, 0.5));
        aim(B('LowerArm.R'), B('Wrist.R'), dir(-0.9 + Math.sin(ph * 5) * 0.5, 0.25, 0.4));
        const h = B('Head');
        if (h) h.rotateZ(0.3);
      } else {
        const h = B('Head');
        if (h) h.rotateY(Math.sin(ph * 0.35) * 0.5);
      }
    } else if (a.carry && (a.carry.kind === 'wood' || a.carry.kind === 'scrap')) {
      // Load on the shoulders, steadied with both hands.
      for (const [side, x] of [['L', -1], ['R', 1]] as const) {
        aim(B(`UpperArm.${side}`), B(`LowerArm.${side}`), dir(x * 0.55, 0.8, -0.1));
        aim(B(`LowerArm.${side}`), B(`Wrist.${side}`), dir(-x * 0.5, 0.75, -0.2));
      }
    } else if (a.carry?.kind === 'food' || a.carry?.kind === 'glimmer') {
      for (const [side, x] of [['L', -1], ['R', 1]] as const) {
        aim(B(`UpperArm.${side}`), B(`LowerArm.${side}`), dir(x * 0.15, -0.9, 0.3));
        aim(B(`LowerArm.${side}`), B(`Wrist.${side}`), dir(-x * 0.3, 0.1, 1));
      }
    } else if (a.anim === 'dance') {
      // Arms out to either side, hands at shoulder height, swinging with the step.
      const s = Math.sin(ph * 7);
      for (const [side, x] of [['L', -1], ['R', 1]] as const) {
        aim(B(`UpperArm.${side}`), B(`LowerArm.${side}`), dir(x, 0.05 + s * x * 0.15, 0.25));
        aim(B(`LowerArm.${side}`), B(`Wrist.${side}`), dir(x, 0.3, 0.3));
      }
      r.body.position.y = Math.abs(Math.cos(ph * 7)) * 0.07;
    } else if (a.anim === 'look') {
      const h = B('Head');
      if (h) h.rotateY(Math.sin(ph * 0.5) * 0.8);
      aim(B('UpperArm.R'), B('LowerArm.R'), dir(0.3, 0.3, 0.9));
      aim(B('LowerArm.R'), B('Wrist.R'), dir(-0.9, 0.4, 0.1));
    }

    // Tools in the right hand, along the forearm.
    const wrist = B('Wrist.R'), elbow = B('LowerArm.R');
    if (wrist && elbow) {
      wrist.getWorldPosition(_a);
      elbow.getWorldPosition(_b);
      _d.subVectors(_a, _b).normalize();
      r.root.getWorldQuaternion(_q3).invert();
      for (const p of m.held) {
        if (!p.visible) continue;
        p.position.copy(r.root.worldToLocal(_a.clone()));
        if (p === r.rod) {
          // The rod's pole runs down its local -y: point that out past the fist.
          _q1.setFromUnitVectors(Y, _d.clone().negate());
          p.quaternion.copy(_q3).multiply(_q1);
        } else {
          _q1.setFromUnitVectors(Y, _d);
          p.quaternion.copy(_q3).multiply(_q1);
          p.rotateX(Math.PI / 2); // the haft across the fist
        }
      }
    }
  }
}
