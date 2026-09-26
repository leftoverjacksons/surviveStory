import * as THREE from 'three';
import { Crop, Zone, heightAt, type World } from '../sim/world';
import { enhance, makeRand } from './util';

function furrowTexture(): THREE.Texture {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#5a4330';
  g.fillRect(0, 0, size, size);
  const rand = makeRand(3);
  for (let y = 0; y < size; y += 8) {
    g.fillStyle = '#3f2e20';
    g.fillRect(0, y, size, 3);
    g.fillStyle = '#6e5540';
    g.fillRect(0, y + 4, size, 2);
  }
  for (let i = 0; i < 300; i++) {
    const v = 60 + rand() * 50;
    g.fillStyle = `rgba(${v},${v * 0.75},${v * 0.5},0.5)`;
    g.fillRect(rand() * size, rand() * size, 1, 1);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Field tiles: marked-but-untilled ground, tilled furrows, and crops that
 * grow from green shoots to gold.
 */
export class FieldsView {
  group = new THREE.Group();
  private soil: THREE.InstancedMesh | null = null;
  private crops: THREE.InstancedMesh | null = null;
  private soilMat = enhance(new THREE.MeshLambertMaterial({ map: furrowTexture(), transparent: true }), { season: 'solid', zone: true });
  private cropMat = enhance(new THREE.MeshLambertMaterial({ flatShading: true }), { wind: 0.25, season: 'solid' });
  private cropGeo = new THREE.ConeGeometry(0.17, 0.7, 5).translate(0, 0.35, 0);
  private soilGeo = new THREE.PlaneGeometry(0.98, 0.98).rotateX(-Math.PI / 2);
  private key = '';
  private tiles: number[] = [];
  private tilesVersion = -1;
  private lastBuild = -Infinity;

  constructor(private world: World) {}

  /** Rebuild when fields change, at most about once a second. */
  sync(now = Infinity) {
    const w = this.world;
    const key = `${w.zoneVersion}:${w.cropVersion}`;
    if (key === this.key) return;
    if (now - this.lastBuild < 1 && w.zoneVersion === this.tilesVersion) return;
    this.lastBuild = now;
    this.key = key;
    if (this.soil) { this.group.remove(this.soil); this.soil.dispose(); }
    if (this.crops) { this.group.remove(this.crops); this.crops.dispose(); }
    if (this.tilesVersion !== w.zoneVersion) {
      this.tilesVersion = w.zoneVersion;
      this.tiles = [];
      for (let i = 0; i < w.zone.length; i++) if (w.zone[i] === Zone.Field) this.tiles.push(i);
    }
    const tiles = this.tiles;
    if (!tiles.length) { this.soil = this.crops = null; return; }

    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    this.soil = new THREE.InstancedMesh(this.soilGeo, this.soilMat, tiles.length);
    const growing = tiles.filter((i) => w.cropState[i] >= Crop.Growing);
    this.crops = new THREE.InstancedMesh(this.cropGeo, this.cropMat, Math.max(1, growing.length * 4));
    let c = 0;
    tiles.forEach((i, k) => {
      const x = (i % w.w) - w.w / 2 + 0.5, z = Math.floor(i / w.w) - w.h / 2 + 0.5;
      const y = heightAt(w, x, z) + 0.045;
      m.compose(p.set(x, y, z), q.identity(), s.set(1, 1, 1));
      this.soil!.setMatrixAt(k, m);
      // Untilled field ground reads as pale, staked-out grass; tilled as dark furrows.
      const st = w.cropState[i];
      this.soil!.setColorAt(k, col.set(st === Crop.Untilled ? '#c9c08a' : '#ffffff'));
      if (st < Crop.Growing) return;
      const g = w.cropGrowth[i];
      const ripe = st === Crop.Ripe;
      for (let j = 0; j < 4; j++) {
        const ox = ((j % 2) - 0.5) * 0.45, oz = (Math.floor(j / 2) - 0.5) * 0.45;
        const h = ripe ? 1.15 : 0.2 + g * 0.95;
        m.compose(p.set(x + ox, y, z + oz), q.identity(), s.set(0.6 + g * 0.7, h, 0.6 + g * 0.7));
        this.crops!.setMatrixAt(c, m);
        col.set(ripe ? '#d2ae45' : '#5f8a3a').lerp(new THREE.Color('#a8a24a'), ripe ? 0 : Math.max(0, g - 0.6));
        this.crops!.setColorAt(c, col);
        c++;
      }
    });
    this.crops.count = c;
    // Untilled tiles are drawn lighter and translucent via colour; tilled ones fully.
    this.soilMat.opacity = 0.9;
    for (const im of [this.soil, this.crops]) {
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.group.add(im);
    }
    this.crops.castShadow = true;
  }
}

/** Rain streaks or snowflakes in a box that follows the camera. */
export class Precipitation {
  group = new THREE.Group();
  private rain: THREE.LineSegments;
  private snow: THREE.Points;
  private rainPos: Float32Array;
  private snowPos: Float32Array;
  private readonly N = 1400;
  private readonly box = { w: 70, h: 30 };
  private rand = makeRand(99);

  constructor() {
    this.rainPos = new Float32Array(this.N * 6);
    this.snowPos = new Float32Array(this.N * 3);
    for (let i = 0; i < this.N; i++) {
      const x = (this.rand() - 0.5) * this.box.w, y = this.rand() * this.box.h, z = (this.rand() - 0.5) * this.box.w;
      this.rainPos.set([x, y, z, x - 0.08, y - 0.9, z], i * 6);
      this.snowPos.set([x, y, z], i * 3);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#b8c8d8', transparent: true, opacity: 0.35, depthWrite: false }));
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.16, transparent: true, opacity: 0.9, depthWrite: false }));
    for (const o of [this.rain, this.snow]) { o.frustumCulled = false; o.visible = false; this.group.add(o); }
  }

  update(dt: number, t: number, center: THREE.Vector3, kind: 'rain' | 'snow' | null) {
    this.group.position.set(center.x, center.y, center.z);
    this.rain.visible = kind === 'rain';
    this.snow.visible = kind === 'snow';
    if (kind === 'rain') {
      const p = this.rainPos;
      for (let i = 0; i < this.N; i++) {
        let y = p[i * 6 + 1] - dt * 26;
        if (y < 0) y += this.box.h;
        p[i * 6 + 1] = y;
        p[i * 6 + 4] = y - 0.9;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    } else if (kind === 'snow') {
      const p = this.snowPos;
      for (let i = 0; i < this.N; i++) {
        let y = p[i * 3 + 1] - dt * 1.6;
        if (y < 0) y += this.box.h;
        p[i * 3 + 1] = y;
        p[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.4;
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
  }
}
