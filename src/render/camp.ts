import * as THREE from 'three';
import type { Survivor } from '../sim/community';
import { CAMP, MEMORIAL } from './station';
import { glowTexture, lambert } from './util';

export const CLOTH = ['#6f7d5c', '#8a6a4a', '#5a6b7a', '#7a4f45', '#9a8a60', '#4f6a5a', '#6b5a7a', '#8a7a6a'];
const SKIN = ['#e0b896', '#c99a74', '#a8764f', '#7d5537', '#f0cfb0'];

interface Figure { group: THREE.Group; torso: THREE.Mesh; head: THREE.Mesh; id: number; fading: number; seated: boolean; phase: number }

export class Camp {
  group = new THREE.Group();
  private fireLight: THREE.PointLight;
  private flames: THREE.Mesh[] = [];
  private flameHalo: THREE.Sprite;
  private figures = new Map<number, Figure>();
  private stones = new Map<number, { group: THREE.Group; light: THREE.PointLight }>();
  private stoneCount = 0;

  constructor() {
    // Fire pit: ring of stones, crossed logs, flame cones.
    const pit = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), lambert('#6f6c64'));
      s.position.set(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55);
      pit.add(s);
    }
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 6), lambert('#3b2a1e'));
      log.rotation.set(Math.PI / 2 - 0.25, (i / 3) * Math.PI, 0);
      log.position.y = 0.15;
      pit.add(log);
    }
    const flameCols = ['#ffb347', '#ff7b2e', '#ffe08a'];
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(
        new THREE.ConeGeometry(0.22 - i * 0.05, 0.7 - i * 0.12, 6),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(flameCols[i]).multiplyScalar(3), toneMapped: false }),
      );
      f.position.y = 0.45;
      this.flames.push(f);
      pit.add(f);
    }
    this.flameHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: '#ff9a4a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7,
    }));
    this.flameHalo.position.y = 0.6;
    this.flameHalo.scale.setScalar(2.4);
    pit.add(this.flameHalo);
    this.fireLight = new THREE.PointLight('#ff9448', 8, 11, 1.5);
    this.fireLight.position.y = 1.0;
    this.fireLight.castShadow = true;
    this.fireLight.shadow.mapSize.set(512, 512);
    this.fireLight.shadow.bias = -0.002;
    pit.add(this.fireLight);
    pit.position.copy(CAMP);
    this.group.add(pit);
  }

  /** Reconcile figures and memorial stones with the simulation roster. */
  sync(roster: Survivor[]) {
    const living = roster.filter((s) => s.alive);
    living.forEach((s, i) => {
      let f = this.figures.get(s.id);
      if (!f) {
        f = this.makeFigure(s);
        this.figures.set(s.id, f);
        this.group.add(f.group);
      }
      const a = (i / Math.max(living.length, 1)) * Math.PI * 2 + 0.4;
      const r = f.seated ? 1.45 : 1.9;
      f.group.position.set(CAMP.x + Math.cos(a) * r, 0, CAMP.z + Math.sin(a) * r);
      f.group.lookAt(CAMP.x, 0, CAMP.z);
    });
    for (const s of roster) {
      if (s.alive) continue;
      const f = this.figures.get(s.id);
      if (f && f.fading === 0) f.fading = 0.0001;
      if (!this.stones.has(s.id)) this.addStone(s.id);
    }
  }

  private makeFigure(s: Survivor): Figure {
    const g = new THREE.Group();
    const seated = s.id % 3 !== 0;
    const cloth = lambert(CLOTH[s.hue % CLOTH.length]);
    const pants = lambert('#3a3a34');
    const skin = lambert(SKIN[s.id % SKIN.length]);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 3, 8), cloth);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skin);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.2), lambert(['#2a1d14', '#5a3b22', '#8a8070', '#1a1a1a'][s.id % 4]));
    if (seated) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), lambert('#5b4632'));
      seat.position.y = 0.17;
      torso.position.y = 0.72;
      head.position.y = 1.23;
      const thighs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.45), pants);
      thighs.position.set(0, 0.42, 0.2);
      const shins = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.14), pants);
      shins.position.set(0, 0.2, 0.42);
      g.add(seat, thighs, shins);
    } else {
      for (const lx of [-0.1, 0.1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.75, 6), pants);
        leg.position.set(lx, 0.38, 0);
        g.add(leg);
      }
      torso.position.y = 1.05;
      head.position.y = 1.56;
    }
    hair.position.copy(head.position).add(new THREE.Vector3(0, 0.03, -0.01));
    g.add(torso, head, hair);
    g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    g.userData.survivorId = s.id;
    return { group: g, torso, head, id: s.id, fading: 0, seated, phase: s.id * 1.7 };
  }

  private addStone(id: number) {
    const g = new THREE.Group();
    const i = this.stoneCount++;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.18), lambert('#8d8a80'));
    stone.position.y = 0.35;
    stone.rotation.z = (i % 2 ? 1 : -1) * 0.06;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 6), lambert('#efe6cf'));
    candle.position.set(0.12, 0.07, 0.28);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(4), toneMapped: false }));
    flame.position.set(0.12, 0.18, 0.28);
    const light = new THREE.PointLight('#ffc070', 1.2, 2.5, 2);
    light.position.set(0.12, 0.3, 0.28);
    g.add(stone, candle, flame, light);
    g.position.set(MEMORIAL.x + (i % 4) * 0.75, 0, MEMORIAL.z + Math.floor(i / 4) * 0.7);
    g.traverse((o) => { o.castShadow = true; });
    this.stones.set(id, { group: g, light });
    this.group.add(g);
  }

  figureObjects(): THREE.Object3D[] {
    return [...this.figures.values()].map((f) => f.group);
  }

  headPosition(id: number, out: THREE.Vector3): boolean {
    const f = this.figures.get(id);
    if (!f || f.fading >= 1) return false;
    f.head.getWorldPosition(out);
    out.y += 0.4;
    return true;
  }

  update(t: number, dt: number) {
    const flick = 1 + Math.sin(t * 13) * 0.12 + Math.sin(t * 29) * 0.08 + Math.sin(t * 5.3) * 0.1;
    this.fireLight.intensity = 9 * flick;
    this.flames.forEach((f, i) => {
      f.scale.set(1, flick * (1 + Math.sin(t * (9 + i * 3)) * 0.15), 1);
      f.rotation.y = t * (1 + i);
    });
    this.flameHalo.scale.setScalar(2.2 * flick);
    for (const s of this.stones.values()) s.light.intensity = 1.1 + Math.sin(t * 11 + s.group.position.x) * 0.2;

    for (const [id, f] of this.figures) {
      f.torso.scale.y = 1 + Math.sin(t * 1.6 + f.phase) * 0.025;
      f.head.rotation.y = Math.sin(t * 0.3 + f.phase) * 0.5;
      if (f.fading > 0) {
        f.fading += dt * 0.5;
        const k = Math.max(0, 1 - f.fading);
        f.group.scale.setScalar(Math.max(0.001, k));
        if (f.fading >= 1) {
          this.group.remove(f.group);
          this.figures.delete(id);
        }
      }
    }
  }
}
