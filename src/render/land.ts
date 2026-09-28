import * as THREE from 'three';
import { Crop, Zone, heightAt, type World } from '../sim/world';
import { fieldOfTile, perimeter, pointInPolygon, type FieldPlot } from '../sim/fields';
import { box, cyl, mat } from './kit';
import { PIXEL, enhance, makeRand } from './util';
import { mergeStatic } from './merge';

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
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (PIXEL) tex.magFilter = THREE.NearestFilter;
  return tex;
}

/**
 * Field tiles: marked-but-untilled ground, tilled furrows, and crops that
 * grow from green shoots to gold.
 */
export class FieldsView {
  group = new THREE.Group();
  private soil: THREE.Group | null = null;
  private fences: THREE.Group | null = null;
  private crops: THREE.InstancedMesh | null = null;
  private soilMat = enhance(new THREE.MeshLambertMaterial({ map: furrowTexture(), transparent: true, vertexColors: true }), { season: 'solid', zone: true, surface: 'soil' });
  private cropMat = enhance(new THREE.MeshLambertMaterial({ flatShading: true }), { wind: 0.25, season: 'solid', surface: 'none' });
  private cropGeo = new THREE.ConeGeometry(0.17, 0.7, 5).translate(0, 0.35, 0);
  private key = '';
  private tiles: number[] = [];
  private tilesVersion = -1;
  private lastBuild = -Infinity;

  constructor(private world: World) {}

  /** Rebuild when fields change, at most about once a second. */
  sync(now = Infinity) {
    const w = this.world;
    const key = `${w.zoneVersion}:${w.cropVersion}:${w.fields.map((f) => Math.floor(f.fence * 24)).join(',')}`;
    if (key === this.key) return;
    if (now - this.lastBuild < 1 && w.zoneVersion === this.tilesVersion) return;
    this.lastBuild = now;
    this.key = key;
    for (const o of [this.soil, this.crops, this.fences]) if (o) { this.group.remove(o); o.traverse((x) => (x as THREE.Mesh).geometry?.dispose()); }
    this.soil = this.crops = this.fences = null;
    if (this.tilesVersion !== w.zoneVersion) {
      this.tilesVersion = w.zoneVersion;
      this.tiles = [];
      for (let i = 0; i < w.zone.length; i++) if (w.zone[i] === Zone.Field) this.tiles.push(i);
    }
    const tiles = this.tiles;
    if (!tiles.length && !w.fields.length) return;

    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    // Soil: each field's own outline, triangulated, subdivided and draped
    // over the terrain; furrows run along the contour (across the slope).
    const soil = new THREE.Group();
    for (const f of w.fields) soil.add(this.fieldMesh(f));
    this.soil = soil;
    const growing = tiles.filter((i) => w.cropState[i] >= Crop.Growing);
    this.crops = new THREE.InstancedMesh(this.cropGeo, this.cropMat, Math.max(1, growing.length * 4));
    let c = 0;
    for (const i of growing) {
      const x = (i % w.w) - w.w / 2 + 0.5, z = Math.floor(i / w.w) - w.h / 2 + 0.5;
      const g = w.cropGrowth[i];
      const ripe = w.cropState[i] === Crop.Ripe;
      const f = fieldOfTile(w, i);
      for (let j = 0; j < 4; j++) {
        const ox = ((j % 2) - 0.5) * 0.45, oz = (Math.floor(j / 2) - 0.5) * 0.45;
        if (f && !pointInPolygon({ x: x + ox, z: z + oz }, f.pts)) continue; // keep inside the outline
        const h = ripe ? 1.15 : 0.2 + g * 0.95;
        m.compose(p.set(x + ox, heightAt(w, x + ox, z + oz) + 0.04, z + oz), q.identity(), s.set(0.6 + g * 0.7, h, 0.6 + g * 0.7));
        this.crops.setMatrixAt(c, m);
        col.set(ripe ? '#d2ae45' : '#5f8a3a').lerp(new THREE.Color('#a8a24a'), ripe ? 0 : Math.max(0, g - 0.6));
        this.crops.setColorAt(c, col);
        c++;
      }
    }
    this.crops.count = c;
    this.crops.receiveShadow = this.crops.castShadow = true;
    this.crops.computeBoundingSphere();
    this.fences = new THREE.Group();
    for (const f of w.fields) if (f.fence > 0) this.fences.add(fieldFence(w, f));
    // Posts and rails by the hundred: one draw per material, not one per piece.
    mergeStatic(this.fences, undefined, false, (x, z) => heightAt(w, x, z));
    this.group.add(this.soil, this.crops, this.fences);
  }

  private fieldMesh(f: FieldPlot): THREE.Mesh {
    const w = this.world;
    // Triangulate the outline (a shape in x, -z), then split long edges so the soil can follow the ground.
    const shape = new THREE.Shape(f.pts.map((p) => new THREE.Vector2(p.x, -p.z)));
    const flat = new THREE.ShapeGeometry(shape).toNonIndexed();
    const src = flat.attributes.position;
    let tris: number[][] = [];
    for (let i = 0; i < src.count; i += 3) tris.push([0, 1, 2].map((k) => [src.getX(i + k), -src.getY(i + k)]).flat());
    for (let pass = 0; pass < 8; pass++) {
      const next: number[][] = [];
      let split = false;
      for (const t of tris) {
        const P = [[t[0], t[1]], [t[2], t[3]], [t[4], t[5]]];
        const L = [0, 1, 2].map((k) => Math.hypot(P[(k + 1) % 3][0] - P[k][0], P[(k + 1) % 3][1] - P[k][1]));
        const k = L.indexOf(Math.max(...L));
        if (L[k] <= 0.6) { next.push(t); continue; }
        split = true;
        const a = P[k], b = P[(k + 1) % 3], o = P[(k + 2) % 3];
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        next.push([...a, ...mid, ...o], [...mid, ...b, ...o]);
      }
      tris = next;
      if (!split) break;
    }
    // Furrows along the contour: stripes vary with the downhill direction.
    let gx = 0, gz = 0;
    for (const i of f.tiles) {
      const x = (i % w.w) - w.w / 2 + 0.5, z = Math.floor(i / w.w) - w.h / 2 + 0.5;
      gx += heightAt(w, x + 0.5, z) - heightAt(w, x - 0.5, z);
      gz += heightAt(w, x, z + 0.5) - heightAt(w, x, z - 0.5);
    }
    let dir = Math.hypot(gx, gz) / Math.max(1, f.tiles.length) > 0.03 ? { x: gx, z: gz } : null;
    if (!dir) {
      // Flat ground: plough parallel to the longest side.
      let best = 0;
      for (let i = 0; i < f.pts.length; i++) {
        const a = f.pts[i], b = f.pts[(i + 1) % f.pts.length];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len > best) { best = len; dir = { x: -(b.z - a.z), z: b.x - a.x }; }
      }
    }
    const dl = Math.hypot(dir!.x, dir!.z) || 1;
    const across = { x: dir!.x / dl, z: dir!.z / dl }, along = { x: -across.z, z: across.x };
    const pos: number[] = [], uv: number[] = [], cols: number[] = [];
    const col = new THREE.Color();
    for (const t of tris) {
      // Wind so the face points up.
      const cross = (t[2] - t[0]) * (t[5] - t[1]) - (t[3] - t[1]) * (t[4] - t[0]);
      const order = cross > 0 ? [0, 2, 1] : [0, 1, 2];
      for (const k of order) {
        const x = t[k * 2], z = t[k * 2 + 1];
        pos.push(x, heightAt(w, x, z) + 0.05, z);
        uv.push(x * along.x + z * along.z, x * across.x + z * across.z);
        const ti = (Math.floor(z + w.h / 2)) * w.w + Math.floor(x + w.w / 2);
        col.set(w.cropState[ti] === Crop.Untilled ? '#c9c08a' : '#ffffff');
        cols.push(col.r, col.g, col.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.soilMat);
    mesh.receiveShadow = true;
    return mesh;
  }
}

/** Rain streaks or snowflakes in a box that follows the camera. */
export class Precipitation {
  group = new THREE.Group();
  private rain: THREE.LineSegments;
  private snow: THREE.Points;
  private rainPos: Float32Array;
  private snowPos: Float32Array;
  private readonly N = PIXEL ? 500 : 1400;
  private readonly box = { w: 70, h: 30 };
  private rand = makeRand(99);
  /** Streak length: short pixel dashes in pixel art. */
  private readonly len = PIXEL ? 0.45 : 0.9;

  constructor() {
    this.rainPos = new Float32Array(this.N * 6);
    this.snowPos = new Float32Array(this.N * 3);
    for (let i = 0; i < this.N; i++) {
      const x = (this.rand() - 0.5) * this.box.w, y = this.rand() * this.box.h, z = (this.rand() - 0.5) * this.box.w;
      this.rainPos.set([x, y, z, x - 0.08, y - this.len, z], i * 6);
      this.snowPos.set([x, y, z], i * 3);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#b8c8d8', transparent: true, opacity: PIXEL ? 0.28 : 0.35, depthWrite: false }));
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
        p[i * 6 + 4] = y - this.len;
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

/**
 * A field's fence: split-rail posts along its outline, going up as far as
 * the farmers have got, with a gate on the edge facing the village.
 */
function fieldFence(w: World, f: FieldPlot): THREE.Group {
  const g = new THREE.Group();
  const rand = makeRand(f.id * 13 + 1);
  const post = mat('#6b4f33'), rail = mat('#8a6a44'), gateM = mat('#7a5a3a');
  const total = perimeter(f.pts);
  let done = f.fence * total;
  for (let i = 0; i < f.pts.length && done > 0; i++) {
    const a = f.pts[i], b = f.pts[(i + 1) % f.pts.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const run = Math.min(len, done);
    done -= len;
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    const yaw = Math.atan2(dx, dz);
    const gateAt = i === f.gate ? len / 2 : -99;
    const n = Math.max(1, Math.round(run / 1.2));
    for (let k = 0; k <= n; k++) {
      const d = (run * k) / n;
      if (Math.abs(d - gateAt) < 0.7) continue;
      const x = a.x + dx * d, z = a.z + dz * d, y = heightAt(w, x, z);
      g.add(cyl(0.06, 0.95, post, x, y + 0.45, z, 5));
      if (k < n) {
        const d2 = (run * (k + 1)) / n;
        if (Math.abs((d + d2) / 2 - gateAt) < 0.7 + (d2 - d) / 2) continue;
        const mx = a.x + dx * (d + d2) / 2, mz = a.z + dz * (d + d2) / 2;
        const my = heightAt(w, mx, mz);
        for (const h of [0.45, 0.8]) {
          const r = box(0.05, 0.06, d2 - d, rail, mx, my + h + (rand() - 0.5) * 0.04, mz);
          r.rotation.y = yaw;
          g.add(r);
        }
      }
    }
    if (i === f.gate && run >= len) {
      // The gate itself, a little open.
      const gx = a.x + dx * gateAt, gz = a.z + dz * gateAt, gy = heightAt(w, gx, gz);
      for (const s of [-1, 1]) g.add(cyl(0.08, 1.1, post, gx + dx * s * 0.7, gy + 0.55, gz + dz * s * 0.7, 6));
      const gate = new THREE.Group();
      for (const h of [0.35, 0.7, 1.0]) gate.add(box(0.05, 0.07, 1.3, gateM, 0, h, 0.65));
      gate.add(box(0.05, 0.9, 0.07, gateM, 0, 0.6, 1.2));
      gate.position.set(gx - dx * 0.7, gy, gz - dz * 0.7);
      gate.rotation.y = yaw + 0.5;
      g.add(gate);
    }
  }
  return g;
}
