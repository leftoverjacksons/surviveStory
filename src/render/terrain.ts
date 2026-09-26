import * as THREE from 'three';
import { addWind, fbm, makeRand, shadowed, smoothstep } from './util';

export const WORLD_SIZE = 96;

/** Paved areas: the station apron and the old highway. */
export const APRON = { x0: -10, x1: 10, z0: -6, z1: 8 };
export const ROAD = { z: 13, halfWidth: 3.2 };

export function isPaved(x: number, z: number) {
  const onApron = x > APRON.x0 && x < APRON.x1 && z > APRON.z0 && z < APRON.z1;
  const onRoad = Math.abs(z - ROAD.z) < ROAD.halfWidth;
  return onApron || onRoad;
}

/** Terrain height: flat around the station and road, rolling hills beyond. */
export function heightAt(x: number, z: number): number {
  const dStation = Math.hypot(x * 0.8, (z - 1) * 0.9);
  const flatStation = 1 - smoothstep(14, 26, dStation);
  const flatRoad = 1 - smoothstep(ROAD.halfWidth + 1, ROAD.halfWidth + 7, Math.abs(z - ROAD.z));
  const flat = Math.max(flatStation, flatRoad);
  const hills = (fbm(x * 0.035 + 10, z * 0.035 - 4, 4) - 0.45) * 9;
  return hills * (1 - flat);
}

function asphaltTexture(): THREE.Texture {
  const size = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const rand = makeRand(99);
  g.fillStyle = '#3d3f3c';
  g.fillRect(0, 0, size, size);
  // Speckle and sun-bleach.
  for (let i = 0; i < 9000; i++) {
    const v = 45 + rand() * 40;
    g.fillStyle = `rgba(${v},${v + 2},${v},${0.25 + rand() * 0.3})`;
    g.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }
  // Moss blooms.
  for (let i = 0; i < 40; i++) {
    const x = rand() * size, y = rand() * size, r = 8 + rand() * 40;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(70,96,48,0.55)');
    grd.addColorStop(1, 'rgba(70,96,48,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Cracks: random walks.
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    let x = rand() * size, y = rand() * size, a = rand() * Math.PI * 2;
    g.strokeStyle = 'rgba(18,20,16,0.85)';
    g.lineWidth = 1 + rand() * 1.5;
    g.beginPath();
    g.moveTo(x, y);
    const steps = 10 + rand() * 30;
    for (let s = 0; s < steps; s++) {
      a += (rand() - 0.5) * 0.9;
      x += Math.cos(a) * 6;
      y += Math.sin(a) * 6;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Faded parking stripes.
  g.fillStyle = 'rgba(200,196,170,0.18)';
  for (let i = 0; i < 6; i++) g.fillRect(40 + i * 75, 30, 5, 120);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function buildTerrain(): THREE.Group {
  const group = new THREE.Group();
  const rand = makeRand(7);

  // --- ground ---
  const seg = 128;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cA = new THREE.Color('#3e5a2a'), cB = new THREE.Color('#6b7f3a'), cC = new THREE.Color('#2c4424');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    const n = fbm(x * 0.12, z * 0.12, 3);
    tmp.copy(cA).lerp(cB, smoothstep(0.35, 0.7, n)).lerp(cC, smoothstep(0.2, -2.5, y) * 0.6);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.receiveShadow = true;
  group.add(ground);

  // --- asphalt ---
  const tex = asphaltTexture();
  const asphaltMat = new THREE.MeshLambertMaterial({ map: tex });
  const apronW = APRON.x1 - APRON.x0, apronD = APRON.z1 - APRON.z0;
  const apronTex = tex.clone();
  apronTex.repeat.set(apronW / 12, apronD / 12);
  apronTex.needsUpdate = true;
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(apronW, apronD), new THREE.MeshLambertMaterial({ map: apronTex }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set((APRON.x0 + APRON.x1) / 2, 0.03, (APRON.z0 + APRON.z1) / 2);
  apron.receiveShadow = true;
  group.add(apron);

  const roadTex = tex.clone();
  roadTex.repeat.set(WORLD_SIZE / 10, 0.6);
  roadTex.needsUpdate = true;
  asphaltMat.map = roadTex;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, ROAD.halfWidth * 2), asphaltMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.035, ROAD.z);
  road.receiveShadow = true;
  group.add(road);

  // Faded centre line, broken up.
  const lineMat = new THREE.MeshLambertMaterial({ color: '#b5a152', transparent: true, opacity: 0.45 });
  for (let x = -WORLD_SIZE / 2; x < WORLD_SIZE / 2; x += 4) {
    if (rand() < 0.35) continue;
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.14), lineMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.04, ROAD.z);
    group.add(dash);
  }

  // --- grass ---
  group.add(buildGrass());
  group.add(buildRocks());
  return group;
}

function bladeGeometry(): THREE.BufferGeometry {
  // A tapered, slightly bent blade: 5 vertices.
  const g = new THREE.BufferGeometry();
  const w = 0.07, h = 0.55;
  const v = new Float32Array([
    -w, 0, 0, w, 0, 0,
    -w * 0.6, h * 0.5, 0.03, w * 0.6, h * 0.5, 0.03,
    0, h, 0.1,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  g.computeVertexNormals();
  return g;
}

function buildGrass(): THREE.InstancedMesh {
  const rand = makeRand(21);
  const count = 38000;
  const mat = addWind(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), 0.35);
  const mesh = new THREE.InstancedMesh(bladeGeometry(), mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const e = new THREE.Euler();
  const col = new THREE.Color();
  const half = WORLD_SIZE / 2 - 1;
  let n = 0;
  for (let tries = 0; n < count && tries < count * 3; tries++) {
    const x = (rand() * 2 - 1) * half, z = (rand() * 2 - 1) * half;
    // Paved ground only has grass pushing through the cracks.
    if (isPaved(x, z) && rand() > 0.07) continue;
    const lush = fbm(x * 0.08 + 3, z * 0.08, 3);
    if (rand() > 0.35 + lush) continue;
    p.set(x, heightAt(x, z), z);
    e.set((rand() - 0.5) * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.3);
    q.setFromEuler(e);
    const hScale = (0.6 + rand() * 1.1) * (0.6 + lush);
    s.set(1, hScale, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    col.setHSL(0.2 + rand() * 0.08, 0.45 + rand() * 0.2, 0.22 + rand() * 0.16 + (lush - 0.5) * 0.1);
    mesh.setColorAt(n, col);
    n++;
  }
  mesh.count = n;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

function buildRocks(): THREE.Group {
  const rand = makeRand(33);
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: '#7d7b70', flatShading: true });
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2, r = 16 + rand() * 28;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (isPaved(x, z)) continue;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + rand() * 0.8, 0), mat);
    rock.position.set(x, heightAt(x, z) + 0.1, z);
    rock.scale.set(1, 0.5 + rand() * 0.5, 1);
    rock.rotation.set(rand(), rand() * 6, rand());
    g.add(rock);
  }
  return shadowed(g);
}
