import * as THREE from 'three';
import type { Item } from '../sim/colony';
import type { Community } from '../sim/community';
import { bedSpot } from '../sim/sites';
import { heightAt, woodyard, type World } from '../sim/world';
import { CLOTH } from './people';
import { glowTexture, lambert, calmFlicker } from './util';

/**
 * The camp around the fire: flames, bedrolls, the stockpile (logs and food
 * that visibly grow with the colony's stores), wood lying where trees fell,
 * and memorial stones for the dead.
 */
export class Camp {
  group = new THREE.Group();
  private fireLight: THREE.PointLight;
  private shadowTick = 0;
  private flames: THREE.Mesh[] = [];
  private flameHalo: THREE.Sprite;
  private stones = new Map<number, THREE.PointLight>();
  private beds = new Map<number, THREE.Group>();
  private pileLogs: THREE.InstancedMesh;
  private pileFood: THREE.InstancedMesh;
  private groundLogs = new Map<number, THREE.Group>();
  private logGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 7).rotateZ(Math.PI / 2);
  private logMat = lambert('#6a4a30');
  /** A whole trunk, felled and not yet split (DESIGN §24.19). */
  private trunkGeo = new THREE.CylinderGeometry(0.2, 0.26, 3.2, 8).rotateZ(Math.PI / 2);
  private unsplit!: THREE.InstancedMesh;
  private yard: ReturnType<typeof woodyard>;
  /** The fire pit, the stockpile's rack and the chopping block: moved when the fire or the stockpile moves (DESIGN §27). */
  private pit!: THREE.Group;
  private rack!: THREE.Group;
  private block!: THREE.Group;
  private rack0: { x: number; z: number };
  private placed = '';

  constructor(private world: World) {
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
    this.fireLight = new THREE.PointLight('#ff9448', 8, 12, 1.5);
    this.fireLight.position.y = 1.0;
    this.fireLight.castShadow = true;
    this.fireLight.shadow.mapSize.set(512, 512);
    this.fireLight.shadow.bias = -0.002;
    // Six shadow passes (a cube) per update: refresh a few times a second, not every frame.
    this.fireLight.shadow.autoUpdate = false;
    this.fireLight.shadow.needsUpdate = true;
    pit.add(this.fireLight);
    this.pit = pit;
    pit.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    // Not the flames: inside the fire's own light, their changing shapes threw shimmering shadows on everything near.
    for (const f of this.flames) f.castShadow = false;
    this.group.add(pit);

    // Stockpile: logs stacked in a rack, food in crates.
    const sp = world.stockpile;
    this.rack0 = { x: sp.x0, z: sp.z0 };
    const rack = new THREE.Group();
    this.rack = rack;
    for (const x of [sp.x0 + 0.3, sp.x0 + 1.5]) {
      for (const z of [sp.z0 + 0.4, sp.z1 - 0.4]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), lambert('#4a3a2a'));
        post.position.set(x + 0.6, 0.6, z);
        rack.add(post);
      }
    }
    this.group.add(rack);
    // The chopping block, beside the rack, where logs are split; and the unsplit trunks lying by it.
    const block = new THREE.Group();
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.5, 9), lambert('#7a5a3a'));
    stump.position.y = 0.25;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.02, 9), lambert('#c8a878'));
    top.position.y = 0.51;
    const haft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), lambert('#8a6a48'));
    haft.position.set(0.08, 0.72, 0); haft.rotation.z = 0.5;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), lambert('#6a6e70'));
    head.position.set(-0.04, 0.53, 0);
    block.add(stump, top, haft, head);
    const yard = woodyard(world);
    this.block = block;
    block.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true; });
    this.group.add(block);
    this.yard = yard;
    this.unsplit = new THREE.InstancedMesh(this.trunkGeo, lambert('#5e4630'), 12);
    this.unsplit.count = 0;
    this.unsplit.castShadow = this.unsplit.receiveShadow = true;
    this.unsplit.frustumCulled = false;
    this.group.add(this.unsplit);
    this.pileLogs = new THREE.InstancedMesh(this.logGeo, this.logMat, 90);
    this.pileLogs.count = 0;
    this.pileFood = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.45, 0.6).translate(0, 0.225, 0), lambert('#7b6243'), 40);
    this.pileFood.count = 0;
    for (const im of [this.pileLogs, this.pileFood]) {
      im.castShadow = im.receiveShadow = true;
      im.frustumCulled = false;
      this.group.add(im);
    }
    this.relocate();
  }

  /** Put the fire, the rack and the chopping block where the world says they are (they can be moved). */
  private relocate() {
    const w = this.world, f = w.campfire, sp = w.stockpile;
    const key = `${f.x},${f.z}|${sp.x0},${sp.z0}`;
    if (key === this.placed) return;
    this.placed = key;
    this.pit.position.set(f.x, heightAt(w, f.x, f.z), f.z);
    this.fireLight.shadow.needsUpdate = true;
    const base = heightAt(w, (sp.x0 + sp.x1) / 2, (sp.z0 + sp.z1) / 2);
    this.rack.position.set(sp.x0 - this.rack0.x, base, sp.z0 - this.rack0.z);
    this.yard = woodyard(w);
    this.block.position.set(this.yard.block.x, heightAt(w, this.yard.block.x, this.yard.block.z), this.yard.block.z);
    // Bedrolls are laid out again round the fire.
    for (const g of this.beds.values()) this.group.remove(g);
    this.beds.clear();
  }

  sync(c: Community, items: Item[], indoorBeds: Map<number, number>) {
    this.relocate();
    // Bedrolls by the fire for anyone without a bed indoors.
    for (const s of c.survivors) {
      const outdoors = s.alive && !indoorBeds.has(s.id);
      if (outdoors && !this.beds.has(s.id)) {
        const g = new THREE.Group();
        const roll = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 1.8), lambert(CLOTH[s.hue % CLOTH.length]));
        roll.position.y = 0.04;
        const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.3), lambert('#cfc6a8'));
        pillow.position.set(0, 0.09, -0.75);
        g.add(roll, pillow);
        const p = bedSpot(this.world.campfire, s.id);
        g.position.set(p.x, heightAt(this.world, p.x, p.z), p.z);
        g.traverse((o) => { o.receiveShadow = true; });
        this.beds.set(s.id, g);
        this.group.add(g);
      }
      if (!outdoors && this.beds.has(s.id)) {
        this.group.remove(this.beds.get(s.id)!);
        this.beds.delete(s.id);
      }
      if (!s.alive && !s.taken && !s.departed && !this.stones.has(s.id)) this.addStone(s.id);
    }

    // Stockpile size follows the stores.
    const sp = this.world.stockpile;
    const m = new THREE.Matrix4();
    // On whatever ground the stockpile stands on (it can be moved).
    const base = heightAt(this.world, (sp.x0 + sp.x1) / 2, (sp.z0 + sp.z1) / 2);
    const logs = Math.min(90, Math.floor(c.resources.wood / 1.5));
    for (let i = 0; i < logs; i++) {
      const row = Math.floor(i / 6), col = i % 6;
      const layer = Math.floor(row / 3);
      m.makeTranslation(sp.x0 + 0.9, base + 0.13 + layer * 0.24, sp.z0 + 0.5 + col * 0.26 + (row % 3) * 0.02);
      if (layer >= 5) m.makeTranslation(sp.x0 + 2.4, base + 0.13 + (layer - 5) * 0.24, sp.z0 + 0.5 + col * 0.26);
      this.pileLogs.setMatrixAt(i, m);
    }
    this.pileLogs.count = logs;
    this.pileLogs.instanceMatrix.needsUpdate = true;
    const crates = Math.min(40, Math.ceil(c.resources.food / 8));
    for (let i = 0; i < crates; i++) {
      const layer = Math.floor(i / 8), k = i % 8;
      m.makeTranslation(sp.x0 + 2.9 + (k % 4) * 0.66, base + layer * 0.46, sp.z0 + 0.5 + Math.floor(k / 4) * 0.66);
      this.pileFood.setMatrixAt(i, m);
    }
    this.pileFood.count = crates;
    this.pileFood.instanceMatrix.needsUpdate = true;

    // Logs waiting to be split: trunks laid side by side behind the chopping block, a few stacked.
    const trunks = Math.min(12, Math.ceil((c.resources.logs ?? 0) / 6));
    for (let i = 0; i < trunks; i++) {
      const layer = i < 6 ? 0 : 1, k = i % 6, y = this.yard;
      const x = y.pile.x + y.step.x * (k + layer * 0.5), z = y.pile.z + y.step.z * (k + layer * 0.5);
      m.makeRotationY(-Math.atan2(y.along.z, y.along.x) + ((i * 0.37) % 0.12));
      m.setPosition(x, heightAt(this.world, x, z) + 0.24 + layer * 0.38, z);
      this.unsplit.setMatrixAt(i, m);
    }
    this.unsplit.count = trunks;
    this.unsplit.instanceMatrix.needsUpdate = true;

    // Timber lying on the ground where trees fell: a whole trunk (log), or split wood.
    const live = new Set(items.map((i) => i.id));
    for (const [id, g] of this.groundLogs) if (!live.has(id)) { this.group.remove(g); this.groundLogs.delete(id); }
    for (const it of items) {
      if (it.kind !== 'wood' && it.kind !== 'log') continue;
      let g = this.groundLogs.get(it.id);
      if (!g) {
        g = new THREE.Group();
        if (it.kind === 'log') {
          const l = new THREE.Mesh(this.trunkGeo, this.logMat);
          l.position.y = 0.24;
          l.castShadow = true;
          g.add(l);
        } else for (let k = 0; k < 3; k++) {
          const l = new THREE.Mesh(this.logGeo, this.logMat);
          l.position.set(0, 0.12 + (k === 2 ? 0.2 : 0), (k === 2 ? 0 : k === 0 ? -0.13 : 0.13));
          l.castShadow = true;
          g.add(l);
        }
        g.rotation.y = (it.id * 1.37) % Math.PI;
        g.position.set(it.x, heightAt(this.world, it.x, it.z), it.z);
        this.groundLogs.set(it.id, g);
        this.group.add(g);
      }
      if (g.children[2]) g.children[2].visible = it.amount > 6;
    }
  }

  private addStone(id: number) {
    const i = this.stones.size;
    const g = new THREE.Group();
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
    const M = this.world.site.memorial;
    g.position.set(M.x + (i % 4) * 0.75, heightAt(this.world, M.x, M.z), M.z + Math.floor(i / 4) * 0.7);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; }); // not the candle's light: a shadow cube per stone
    this.stones.set(id, light);
    this.group.add(g);
  }

  update(t: number, fireLit: boolean) {
    // The flames dance; the light they cast barely wavers (a flickering light makes lit ground and roofs glitter).
    const flick = calmFlicker(t, 0, 0.025);
    const lit = fireLit ? 1 : 0.25;
    this.fireLight.intensity = 9 * flick * lit;
    if (++this.shadowTick % 6 === 0) this.fireLight.shadow.needsUpdate = true;
    this.flames.forEach((f, i) => {
      f.scale.set(lit, lit * calmFlicker(t, i + 1, 0.2), lit);
      f.rotation.y = t * (1 + i);
    });
    this.flameHalo.scale.setScalar(2.2 * flick * lit);
    for (const l of this.stones.values()) l.intensity = 1.1 * calmFlicker(t, l.id, 0.02);
  }
}
