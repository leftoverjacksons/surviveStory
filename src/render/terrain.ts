import * as THREE from 'three';
import { fbm } from '../sim/noise';
import { Ground, LANE_WEAR, Zone, heightAt, idx, type World } from '../sim/world';
import { SOFT, enhance, makeRand, soften } from './util';

/**
 * Map-sized RGBA texture shared by fog-aware materials:
 * R = explored (fog of war), G = home zone, B = woodlot, A = sacred ground.
 */
export class FogTexture {
  texture: THREE.DataTexture;
  private data: Uint8Array;
  private version = -1;
  private zoneVersion = -1;
  constructor(private world: World) {
    this.data = new Uint8Array(world.w * world.h * 4);
    this.texture = new THREE.DataTexture(this.data, world.w, world.h, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.sync();
  }
  sync() {
    const w = this.world;
    if (this.version === w.fogVersion && this.zoneVersion === w.zoneVersion) return;
    this.version = w.fogVersion;
    this.zoneVersion = w.zoneVersion;
    const d = this.data;
    for (let i = 0, n = w.explored.length; i < n; i++) {
      const z = w.zone[i];
      d[i * 4] = w.explored[i];
      d[i * 4 + 1] = z === Zone.Home ? 255 : 0;
      d[i * 4 + 2] = z === Zone.Woodlot ? 255 : 0;
      d[i * 4 + 3] = z === Zone.Sacred ? 255 : 0;
    }
    this.texture.needsUpdate = true;
  }
}

/** Zone colours per tile (crisp, tile-aligned). Alpha 1 where zoned. */
export const ZONE_COLORS: Record<number, [number, number, number]> = {
  [Zone.Home]: [255, 232, 140],
  [Zone.Field]: [240, 150, 50],
  [Zone.Woodlot]: [110, 215, 90],
  [Zone.Sacred]: [195, 130, 255],
  [Zone.Fishing]: [90, 190, 230],
};

export class ZoneTexture {
  texture: THREE.DataTexture;
  private data: Uint8Array;
  private version = -1;
  constructor(private world: World) {
    this.data = new Uint8Array(world.w * world.h * 4);
    this.texture = new THREE.DataTexture(this.data, world.w, world.h, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.sync();
  }
  sync() {
    const w = this.world;
    if (this.version === w.zoneVersion) return;
    this.version = w.zoneVersion;
    const d = this.data;
    for (let i = 0; i < w.zone.length; i++) {
      const c = ZONE_COLORS[w.zone[i]];
      if (c) { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
      else d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = d[i * 4 + 3] = 0;
    }
    this.texture.needsUpdate = true;
  }
}

/** Footfall per tile, normalised so a lane reads as 1. Drives worn paths and flattened grass. */
export class WearTexture {
  texture: THREE.DataTexture;
  private data: Uint8Array;
  private version = -1;
  private lastSync = -Infinity;
  constructor(private world: World) {
    this.data = new Uint8Array(world.w * world.h);
    this.texture = new THREE.DataTexture(this.data, world.w, world.h, THREE.RedFormat, THREE.UnsignedByteType);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.sync(0, true);
  }
  /** Re-upload at most every couple of seconds; wear changes slowly. */
  sync(now: number, force = false) {
    const w = this.world;
    if (!force && (now - this.lastSync < 2 || this.version === w.wearVersion)) return;
    this.lastSync = now;
    this.version = w.wearVersion;
    const d = this.data;
    for (let i = 0; i < d.length; i++) d[i] = Math.min(255, (w.wear[i] / LANE_WEAR) * 255);
    this.texture.needsUpdate = true;
  }
}

function asphaltTexture(seed: number, base: string, crackAlpha: number): THREE.Texture {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const rand = makeRand(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 3000; i++) {
    const v = 45 + rand() * 50;
    g.fillStyle = `rgba(${v},${v + 3},${v},${0.2 + rand() * 0.3})`;
    g.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }
  for (let i = 0; i < 18; i++) {
    const x = rand() * size, y = rand() * size, r = 6 + rand() * 26;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(70,96,48,0.55)');
    grd.addColorStop(1, 'rgba(70,96,48,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    let x = rand() * size, y = rand() * size, a = rand() * Math.PI * 2;
    g.strokeStyle = `rgba(18,20,16,${crackAlpha})`;
    g.lineWidth = 1 + rand() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0, n = 10 + rand() * 20; s < n; s++) {
      a += (rand() - 0.5) * 0.9;
      x += Math.cos(a) * 5; y += Math.sin(a) * 5;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Merged quads for every tile of a ground type, draped over the terrain. */
function tileOverlay(w: World, ground: number, lift: number, mat: THREE.Material): THREE.Mesh {
  const pos: number[] = [], uv: number[] = [], index: number[] = [];
  const S = w.w + 1;
  for (let tz = 0; tz < w.h; tz++) for (let tx = 0; tx < w.w; tx++) {
    if (w.ground[idx(w, tx, tz)] !== ground) continue;
    const base = pos.length / 3;
    for (const [dx, dz] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const vx = tx + dx, vz = tz + dz;
      const x = vx - w.w / 2, z = vz - w.h / 2;
      pos.push(x, w.heights[vz * S + vx] + lift, z);
      uv.push(x / 9, z / 9);
    }
    index.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

export function buildTerrain(w: World): THREE.Group {
  const group = new THREE.Group();

  // --- ground: one vertex per tile corner, coloured by surrounding tiles ---
  const geo = new THREE.PlaneGeometry(w.w, w.h, w.w, w.h);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const palette: Record<number, THREE.Color> = {
    [Ground.Grass]: new THREE.Color('#4a6630'),
    [Ground.Meadow]: new THREE.Color('#7a8a3e'),
    [Ground.Forest]: new THREE.Color('#2f4424'),
    [Ground.Asphalt]: new THREE.Color('#3d403b'),
    [Ground.Concrete]: new THREE.Color('#6b6a60'),
    [Ground.Water]: new THREE.Color('#3a4a3a'),
  };
  const c = new THREE.Color(), acc = new THREE.Color();
  const S = w.w + 1;
  for (let i = 0; i < pos.count; i++) {
    // PlaneGeometry rows run from -z to +z after rotation, matching our corner grid.
    const vx = i % S, vz = Math.floor(i / S);
    pos.setY(i, w.heights[vz * S + vx]);
    acc.setRGB(0, 0, 0);
    let n = 0;
    for (const [dx, dz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
      const tx = vx + dx, tz = vz + dz;
      if (tx < 0 || tz < 0 || tx >= w.w || tz >= w.h) continue;
      acc.add(palette[w.ground[idx(w, tx, tz)]]);
      n++;
    }
    acc.multiplyScalar(1 / Math.max(n, 1));
    const x = vx - w.w / 2, z = vz - w.h / 2;
    const var1 = fbm(x * 0.15, z * 0.15, 3, 3) - 0.5;
    c.copy(acc).offsetHSL(var1 * 0.03, var1 * 0.1, var1 * 0.08);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, enhance(new THREE.MeshLambertMaterial({ vertexColors: true }), { zone: true, season: 'ground' }));
  ground.receiveShadow = true;
  group.add(ground);

  // --- paved overlays ---
  const asphalt = enhance(new THREE.MeshLambertMaterial({ map: asphaltTexture(99, '#3b3e3a', 0.85) }), { zone: true, season: 'ground' });
  const concrete = enhance(new THREE.MeshLambertMaterial({ map: asphaltTexture(42, '#77756b', 0.6) }), { zone: true, season: 'ground' });
  group.add(tileOverlay(w, Ground.Asphalt, 0.03, asphalt));
  group.add(tileOverlay(w, Ground.Concrete, 0.04, concrete));

  // --- water ---
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(w.w, w.h),
    enhance(new THREE.MeshLambertMaterial({ color: '#2f5552', emissive: '#0c1c1e', transparent: true, opacity: 0.88 }), { season: 'none' }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.32;
  group.add(water);

  group.add(buildGrass(w));
  group.add(buildRocks(w));
  return group;
}

function bladeGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const bw = 0.07, h = 0.55;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -bw, 0, 0, bw, 0, 0, -bw * 0.6, h * 0.5, 0.03, bw * 0.6, h * 0.5, 0.03, 0, h, 0.1,
  ]), 3));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  g.computeVertexNormals();
  if (SOFT) {
    // Lit like the ground it grows from (normals up), darker at the root and
    // lighter at the tip: a meadow reads as soft turf, not a field of spikes.
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array([0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 1.06, 1.06, 1.0]), 3));
  }
  return g;
}

/** Grass in 32×32-tile chunks so off-screen chunks are culled. */
function buildGrass(w: World): THREE.Group {
  const group = new THREE.Group();
  const rand = makeRand(21);
  const geo = bladeGeometry();
  const mat = enhance(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, vertexColors: SOFT }), { wind: 0.35, season: 'grass', upLit: SOFT });
  const CH = 32;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const e = new THREE.Euler(), col = new THREE.Color();
  const density: Record<number, number> = {
    [Ground.Grass]: 2.4, [Ground.Meadow]: 3.2, [Ground.Forest]: 0.7,
    [Ground.Asphalt]: 0.12, [Ground.Concrete]: 0.35, [Ground.Water]: 0,
  };
  for (let cz = 0; cz < w.h; cz += CH) for (let cx = 0; cx < w.w; cx += CH) {
    const max = CH * CH * 3;
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    let n = 0;
    for (let tz = cz; tz < cz + CH; tz++) for (let tx = cx; tx < cx + CH; tx++) {
      const i = idx(w, tx, tz);
      if (w.blocked[i]) continue;
      const g = w.ground[i];
      let k = density[g];
      const x0 = tx - w.w / 2, z0 = tz - w.h / 2;
      k *= 0.5 + fbm(x0 * 0.08, z0 * 0.08, 5, 2);
      const count = Math.floor(k) + (rand() < k % 1 ? 1 : 0);
      for (let b = 0; b < count && n < max; b++) {
        const x = x0 + rand(), z = z0 + rand();
        p.set(x, heightAt(w, x, z), z);
        e.set((rand() - 0.5) * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.3);
        q.setFromEuler(e);
        const tall = g === Ground.Meadow ? 1.3 : g === Ground.Forest ? 0.8 : 1;
        s.set(1, (0.6 + rand() * 1.0) * tall, 1);
        m.compose(p, q, s);
        mesh.setMatrixAt(n, m);
        const hue = g === Ground.Meadow ? 0.17 + rand() * 0.07 : 0.22 + rand() * 0.07;
        col.setHSL(hue, 0.45 + rand() * 0.2, SOFT ? 0.25 + rand() * 0.07 : 0.22 + rand() * 0.15);
        mesh.setColorAt(n, col);
        n++;
      }
    }
    if (n === 0) continue;
    mesh.count = n;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}

function buildRocks(w: World): THREE.InstancedMesh {
  const rand = makeRand(33);
  const mesh = new THREE.InstancedMesh(
    soften(new THREE.DodecahedronGeometry(1, SOFT ? 1 : 0)),
    enhance(new THREE.MeshLambertMaterial({ color: '#7d7b70', flatShading: !SOFT })),
    Math.max(1, w.rocks.length),
  );
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  w.rocks.forEach((r, i) => {
    const x = r.tx - w.w / 2 + 0.5, z = r.tz - w.h / 2 + 0.5;
    p.set(x, heightAt(w, x, z) + 0.1, z);
    q.setFromEuler(new THREE.Euler(rand(), rand() * 6, rand()));
    s.set(r.size, r.size * (0.5 + rand() * 0.5), r.size);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.count = w.rocks.length;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
