/**
 * Starting sites other than the gas station (which lives in station.ts):
 * the wayside chapel, the motel, the farmstead's barn, and the glasshouse.
 *
 * Each is built hollow, so its interior shows in cutaway, with the part of
 * the roof that fell in left open and the fallen section lying inside (it
 * disappears when the survivors patch the roof). Everything is placed from
 * the site's definition in the simulation.
 */
import * as THREE from 'three';
import type { Site } from '../sim/sites';
import { boxSurface, buildStation, type StationBuild, type VineEdge, type VineSurface } from './station';
import { enhance, enhanced, lambert, makeRand, shadowed } from './util';

interface Kit {
  g: THREE.Group;
  surfaces: VineSurface[];
  edges: VineEdge[];
  roofs: THREE.Object3D[];
  cut: THREE.Material[];
  glow: THREE.Mesh[];
  rand: () => number;
}

const GLOW_MAT = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc27a').multiplyScalar(1.6), toneMapped: false });

function mesh(k: Kit, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, cut = true): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  k.g.add(o);
  if (cut && !k.cut.includes(m)) k.cut.push(m);
  return o;
}
const boxAt = (k: Kit, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, cut = true) =>
  mesh(k, new THREE.BoxGeometry(w, h, d), m, x, y, z, cut);

/** Four walls of the shelter, hollow, with a door gap in the front (+z) wall. */
function shell(k: Kit, site: Site, wall: THREE.Material, h = site.shelter.h, T = 0.26, doorW = 1.2) {
  const S = site.shelter;
  const x0 = S.x - S.w / 2, x1 = S.x + S.w / 2, z0 = S.z - S.d / 2, z1 = S.z + S.d / 2;
  const dx = site.door.x;
  boxAt(k, S.w, h, T, wall, S.x, h / 2, z0 + T / 2);
  boxAt(k, T, h, S.d, wall, x0 + T / 2, h / 2, S.z);
  boxAt(k, T, h, S.d, wall, x1 - T / 2, h / 2, S.z);
  boxAt(k, dx - doorW / 2 - x0, h, T, wall, (x0 + dx - doorW / 2) / 2, h / 2, z1 - T / 2);
  boxAt(k, x1 - dx - doorW / 2, h, T, wall, (x1 + dx + doorW / 2) / 2, h / 2, z1 - T / 2);
  boxAt(k, doorW, Math.max(0.1, h - 2.3), T, wall, dx, 2.3 + (h - 2.3) / 2, z1 - T / 2);
  k.surfaces.push(boxSurface(new THREE.Vector3(S.x, h / 2, S.z), new THREE.Vector3(S.w, h, S.d), ['px', 'nx', 'pz', 'nz'], 3));
}

function floor(k: Kit, site: Site, color: string) {
  const S = site.shelter;
  boxAt(k, S.w - 0.5, 0.08, S.d - 0.5, lambert(color), S.x, 0.04, S.z);
}

/** A window on a wall face, with lamplight behind it for when people live inside. */
function windowAt(k: Kit, x: number, y: number, z: number, w: number, h: number, normal: 'x' | 'z', sign: number, frame: THREE.Material, glass: THREE.Material) {
  const gw = normal === 'z' ? w : 0.08, gd = normal === 'z' ? 0.08 : w;
  const off = 0.02 * sign;
  boxAt(k, gw + (normal === 'z' ? 0.16 : 0.02), h + 0.16, gd + (normal === 'x' ? 0.16 : 0.02), frame, x + (normal === 'x' ? off : 0), y, z + (normal === 'z' ? off : 0));
  boxAt(k, gw, h, gd, glass, x + (normal === 'x' ? off * 2 : 0), y, z + (normal === 'z' ? off * 2 : 0));
  const lamp = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.9), GLOW_MAT);
  lamp.position.set(x + (normal === 'x' ? off * 4 : 0), y, z + (normal === 'z' ? off * 4 : 0));
  if (normal === 'x') lamp.rotation.y = sign * Math.PI / 2;
  else if (sign < 0) lamp.rotation.y = Math.PI;
  lamp.visible = false;
  k.g.add(lamp);
  k.glow.push(lamp);
  if (!k.cut.includes(GLOW_MAT)) k.cut.push(GLOW_MAT);
}

/**
 * A gable roof over the shelter, ridge along `site.ridge`, with the collapsed
 * section left open. Returns the fallen piece (lying inside the shelter).
 */
function gableRoof(k: Kit, site: Site, roofM: THREE.Material, gableM: THREE.Material, eaves: number, thick = 0.14, over = 0.35): THREE.Mesh {
  const S = site.shelter, C = site.collapse;
  const alongX = site.ridge === 'x';
  const len = alongX ? S.w : S.d, span = alongX ? S.d : S.w;
  const pitch = site.pitch;
  const rise = (span / 2) * Math.tan(pitch);
  const half = span / 2 + over;
  const slopeLen = half / Math.cos(pitch);
  // Along-ridge coordinate of the collapse.
  const c0 = (alongX ? C.x - C.w / 2 - S.x : C.z - C.d / 2 - S.z), c1 = c0 + (alongX ? C.w : C.d);
  const a0 = -len / 2 - over, a1 = len / 2 + over;
  const segs: [number, number][] = [];
  if (c0 > a0) segs.push([a0, Math.max(a0, c0)]);
  if (c1 < a1) segs.push([Math.min(a1, c1), a1]);
  const place = (o: THREE.Object3D, along: number, across: number, y: number) => {
    if (alongX) o.position.set(S.x + along, y, S.z + across);
    else { o.position.set(S.x + across, y, S.z + along); }
  };
  for (const [s0, s1] of segs) {
    for (const s of [-1, 1]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0, thick, slopeLen), roofM);
      place(slab, (s0 + s1) / 2, s * half / 2, eaves + rise / 2 - over * Math.tan(pitch) / 2 + thick / 2);
      if (alongX) slab.rotation.x = s * pitch;
      else { slab.rotation.order = 'YXZ'; slab.rotation.y = Math.PI / 2; slab.rotation.x = s * pitch; }
      k.g.add(slab);
      k.roofs.push(slab);
      k.surfaces.push({ ...boxSurface(slab.position.clone(), alongX ? new THREE.Vector3(s1 - s0, 0.2, slopeLen * 0.8) : new THREE.Vector3(slopeLen * 0.8, 0.2, s1 - s0), ['py'], 0.9), roof: true });
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(s1 - s0, 0.16, 0.3), lambert('#3f3a36'));
    place(ridge, (s0 + s1) / 2, 0, eaves + rise + 0.08);
    if (!alongX) ridge.rotation.y = Math.PI / 2;
    k.g.add(ridge);
    k.roofs.push(ridge);
    k.edges.push(alongX
      ? { a: new THREE.Vector3(S.x + s0, eaves - 0.2, S.z + half - 0.1), b: new THREE.Vector3(S.x + s1, eaves - 0.2, S.z + half - 0.1) }
      : { a: new THREE.Vector3(S.x + half - 0.1, eaves - 0.2, S.z + s0), b: new THREE.Vector3(S.x + half - 0.1, eaves - 0.2, S.z + s1) });
  }
  // Gable ends (part of the walls above the eaves, so they lift off with the roof).
  const shape = new THREE.Shape([new THREE.Vector2(-span / 2, 0), new THREE.Vector2(span / 2, 0), new THREE.Vector2(0, rise)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.26, bevelEnabled: false }).translate(0, 0, -0.13);
  for (const s of [-1, 1]) {
    const tri = new THREE.Mesh(geo, gableM);
    if (alongX) { tri.rotation.y = Math.PI / 2; tri.position.set(S.x + s * (len / 2 - 0.13), eaves, S.z); } else tri.position.set(S.x, eaves, S.z + s * (len / 2 - 0.13));
    k.g.add(tri);
    k.roofs.push(tri);
  }
  // The section that fell in, lying across the floor at a slant.
  const fw = alongX ? C.w : span * 0.9, fd = alongX ? span * 0.9 : C.d;
  const fallen = new THREE.Mesh(new THREE.BoxGeometry(fw, thick, fd), roofM);
  fallen.position.set(C.x, eaves * 0.45, C.z);
  if (alongX) fallen.rotation.x = 0.45; else fallen.rotation.z = 0.45;
  k.g.add(fallen);
  return fallen;
}

/** A flat roof slab over the shelter, open over the collapse; returns the fallen slab. */
function flatRoof(k: Kit, site: Site, m: THREE.Material, y: number, overFront = 0.3): THREE.Mesh {
  const S = site.shelter, C = site.collapse;
  const x0 = S.x - S.w / 2 - 0.3, x1 = S.x + S.w / 2 + 0.3;
  const c0 = C.x - C.w / 2, c1 = C.x + C.w / 2;
  const d = S.d + 0.3 + overFront, zc = S.z + overFront / 2;
  for (const [a, b] of [[x0, Math.max(x0, c0)], [Math.min(x1, c1), x1]]) {
    if (b - a < 0.05) continue;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.28, d), m);
    slab.position.set((a + b) / 2, y + 0.14, zc);
    k.g.add(slab);
    k.roofs.push(slab);
    k.surfaces.push({ ...boxSurface(slab.position.clone(), new THREE.Vector3(b - a, 0.28, d), ['py'], 2), roof: true });
    k.edges.push({ a: new THREE.Vector3(a, y - 0.05, zc + d / 2), b: new THREE.Vector3(b, y - 0.05, zc + d / 2) });
  }
  const fallen = new THREE.Mesh(new THREE.BoxGeometry(C.w * 0.95, 0.28, S.d), m);
  fallen.position.set(C.x, y - 1.1, C.z + 0.2);
  fallen.rotation.z = -0.42;
  k.g.add(fallen);
  return fallen;
}

function doorMesh(k: Kit, site: Site, w = 1.1, h = 2.2, color = '#141816'): THREE.Mesh {
  const m = lambert(color);
  return boxAt(k, w, h, 0.08, m, site.door.x, h / 2, site.shelter.z + site.shelter.d / 2 + 0.01);
}

// ---------- the chapel ----------

function chapel(site: Site, k: Kit) {
  const S = site.shelter;
  const stone = lambert('#aaa394');
  const slate = lambert('#59606a');
  const trim = lambert('#6d665a');
  const glass = new THREE.MeshLambertMaterial({ color: '#2a3440', transparent: true, opacity: 0.85 });
  shell(k, site, stone);
  floor(k, site, '#77705f');
  // Buttresses along the sides.
  for (const z of [-3.5, -6, -8.5, -11]) for (const s of [-1, 1]) boxAt(k, 0.5, 2.2, 0.6, stone, S.x + s * (S.w / 2 + 0.2), 1.1, z);
  // Tall lancet windows.
  for (const z of [-4.8, -7.2, -9.6]) for (const s of [-1, 1]) windowAt(k, S.x + s * S.w / 2, 1.9, z, 0.55, 1.7, 'x', s, trim, glass);
  // What's left of the pews, pushed to the front (the rest went for firewood long ago).
  const wood = lambert('#6b4f33');
  for (let i = 0; i < 2; i++) {
    const pew = boxAt(k, 1.9, 0.45, 0.45, wood, S.x - 1.9, 0.3, -3.2 - i * 0.9);
    pew.rotation.y = (k.rand() - 0.5) * 0.3;
  }
  boxAt(k, 1.6, 0.9, 0.7, stone, S.x, 0.45, S.z - S.d / 2 + 0.8); // altar
  const fallen = gableRoof(k, site, slate, stone, S.h);
  // A bellcote on the front gable, with its bell still in it.
  const apex = S.h + (S.w / 2) * Math.tan(site.pitch);
  const bell = new THREE.Group();
  for (const s of [-1, 1]) bell.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 0.3), stone).translateX(s * 0.35).translateY(0.55));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.55, 4), slate);
  cap.position.y = 1.35; cap.rotation.y = Math.PI / 4;
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.3, 8), lambert('#8a6a3a'));
  b.position.y = 0.72;
  bell.add(cap, b);
  bell.position.set(S.x, apex - 0.1, S.z + S.d / 2 - 0.1);
  k.g.add(bell);
  k.roofs.push(bell);
  // Round window over the door.
  windowAt(k, S.x, 2.9, S.z + S.d / 2, 0.8, 0.8, 'z', 1, trim, glass);
  // The graveyard: headstones, a low wall, a gap for the path.
  const gy0 = -12.5, gy1 = -2.5, gx0 = 3.5, gx1 = 11.5;
  const rand = makeRand(17);
  for (let i = 0; i < 16; i++) {
    const x = gx0 + 1 + rand() * (gx1 - gx0 - 2), z = gy0 + 1 + rand() * (gy1 - gy0 - 2);
    if (Math.hypot(x - site.memorial.x - 1, z - site.memorial.z - 0.5) < 2.2) continue;
    const hs = new THREE.Group();
    const h = 0.45 + rand() * 0.35;
    hs.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, h, 0.14), lambert(rand() < 0.5 ? '#8f8b80' : '#a39e90')).translateY(h / 2));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.14, 8, 1, false, 0, Math.PI), lambert('#8f8b80'));
    top.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    top.position.y = h;
    hs.add(top);
    hs.position.set(x, 0, z);
    hs.rotation.set(0, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.25);
    k.g.add(hs);
    k.surfaces.push(boxSurface(new THREE.Vector3(x, h / 2, z), new THREE.Vector3(0.45, h, 0.14), ['pz', 'nz'], 0.12));
  }
  const wallM = lambert('#8f887a');
  const low = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const w = boxAt(k, len, 0.45, 0.3, wallM, (x0 + x1) / 2, 0.22, (z0 + z1) / 2, false);
    w.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    k.surfaces.push(boxSurface(w.position.clone(), new THREE.Vector3(Math.abs(x1 - x0) + 0.3, 0.45, Math.abs(z1 - z0) + 0.3), ['py', 'pz'], 0.5));
  };
  low(gx0, gy0, gx1, gy0); low(gx1, gy0, gx1, gy1); low(gx0 + 2.2, gy1, gx1, gy1);
  return { fallen, door: doorMesh(k, site, 1.1, 2.4) };
}

// ---------- the motel ----------

function motel(site: Site, k: Kit) {
  const S = site.shelter;
  const stucco = lambert('#dacdb2');
  const roofM = lambert('#6f6b62');
  const trim = lambert('#4f7f7a');
  const glass = new THREE.MeshLambertMaterial({ color: '#1a2226', transparent: true, opacity: 0.85 });
  shell(k, site, stucco);
  floor(k, site, '#6a655a');
  // Room dividers at the back (the front is a knocked-through corridor now).
  const rooms = [-8, -4, 0, 4];
  for (const x of [-6, -2, 2]) boxAt(k, 0.16, S.h, 2.2, stucco, x, S.h / 2, S.z - S.d / 2 + 1.1);
  const doorCols = ['#8a4a3a', '#4f7f7a', '#c8a050', '#5a6b8a'];
  rooms.forEach((rx, i) => {
    if (Math.abs(rx - site.door.x) > 0.1) boxAt(k, 0.9, 2.1, 0.08, lambert(doorCols[i]), rx, 1.05, S.z + S.d / 2 + 0.02);
    windowAt(k, rx + 1.2, 1.5, S.z + S.d / 2, 1.1, 0.9, 'z', 1, trim, glass);
  });
  const fallen = flatRoof(k, site, roofM, S.h, 1.6);
  // Walkway posts under the front overhang.
  for (let x = S.x - S.w / 2 + 0.3; x <= S.x + S.w / 2; x += 3.2) {
    if (x > site.collapse.x - site.collapse.w / 2 && x < site.collapse.x + site.collapse.w / 2) continue;
    const post = boxAt(k, 0.16, S.h, 0.16, trim, x, S.h / 2, S.z + S.d / 2 + 1.35);
    k.surfaces.push(boxSurface(post.position.clone(), new THREE.Vector3(0.16, S.h, 0.16), ['px', 'nx', 'pz'], 0.25));
  }
  // The office at the west end of the lot.
  const office = new THREE.Group();
  office.add(new THREE.Mesh(new THREE.BoxGeometry(3.5, 3, 3.5), stucco).translateY(1.5));
  office.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.08), glass).translateY(1.6).translateZ(1.76));
  const oroof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.25, 4), roofM);
  oroof.position.y = 3.1;
  office.add(oroof);
  office.position.set(-12.75, 0, 1.25);
  k.g.add(office);
  k.surfaces.push(boxSurface(new THREE.Vector3(-12.75, 1.5, 1.25), new THREE.Vector3(3.5, 3, 3.5), ['px', 'nx', 'pz', 'nz'], 1));
  k.surfaces.push({ ...boxSurface(new THREE.Vector3(-12.75, 3.1, 1.25), new THREE.Vector3(4, 0.25, 4), ['py'], 0.8), roof: true });
  // A drained pool, gone to moss.
  const px = -7, pz = 6;
  const rim = lambert('#c8c2b0');
  boxAt(k, 4.2, 0.12, 0.3, rim, px, 0.06, pz - 1.5, false); boxAt(k, 4.2, 0.12, 0.3, rim, px, 0.06, pz + 1.5, false);
  boxAt(k, 0.3, 0.12, 3.3, rim, px - 2.1, 0.06, pz, false); boxAt(k, 0.3, 0.12, 3.3, rim, px + 2.1, 0.06, pz, false);
  boxAt(k, 3.9, 0.04, 2.7, lambert('#4f7a6a'), px, -0.02, pz, false);
  // The sign: a tall board on a pole, faded to nothing.
  const sign = new THREE.Group();
  sign.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.5, 6), lambert('#8a4b2a')).translateY(3.25));
  sign.add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.3, 0.25), lambert('#d6cfb5')).translateY(6.6));
  sign.add(new THREE.Mesh(new THREE.BoxGeometry(3.22, 0.3, 0.27), lambert('#8a4a3a')).translateY(6.1));
  sign.add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.2), lambert('#4f7f7a')).translateY(5.2).translateX(0.4));
  sign.position.set(10.5, 0, 8.5);
  sign.rotation.set(0.04, -0.5, 0.06);
  k.g.add(sign);
  k.surfaces.push(boxSurface(new THREE.Vector3(10.5, 2.2, 8.5), new THREE.Vector3(0.3, 4.4, 0.3), ['px', 'nx', 'pz', 'nz'], 0.5));
  // Faded parking stripes.
  const stripe = lambert('#b9b3a3');
  for (let x = -9; x <= 8; x += 2.6) boxAt(k, 0.1, 0.02, 2.2, stripe, x, 0.01, 7.6, false);
  return { fallen, door: doorMesh(k, site, 0.95, 2.1) };
}

// ---------- the farmstead ----------

function farm(site: Site, k: Kit) {
  const S = site.shelter;
  const boards = lambert('#8a3a2e');
  const white = lambert('#e2dccb');
  const roofM = lambert('#5a4f4a');
  const glass = new THREE.MeshLambertMaterial({ color: '#1a2226', transparent: true, opacity: 0.85 });
  shell(k, site, boards, S.h, 0.22, 2.6);
  floor(k, site, '#6b5236');
  // White trim at the corners and round the big doorway.
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) boxAt(k, 0.24, S.h, 0.24, white, S.x + x * S.w / 2, S.h / 2, S.z + z * S.d / 2);
  boxAt(k, 3, 0.2, 0.28, white, site.door.x, 2.4, S.z + S.d / 2);
  // The sliding doors, pushed open.
  const doorM = lambert('#7a3328');
  for (const s of [-1, 1]) {
    const d = boxAt(k, 1.4, 2.3, 0.1, doorM, site.door.x + s * 2.1, 1.15, S.z + S.d / 2 + 0.16);
    d.rotation.y = s * 0.04;
    boxAt(k, 1.3, 0.1, 0.12, white, site.door.x + s * 2.1, 1.15, S.z + S.d / 2 + 0.22).rotation.z = s * 0.95;
  }
  for (const x of [-3.6, 2.4]) windowAt(k, S.x + x, 1.8, S.z - S.d / 2, 0.8, 0.7, 'z', -1, white, glass);
  // Hay: a loft floor at the back, bales stacked and spilling.
  const hay = lambert('#c8a85a');
  boxAt(k, S.w - 0.6, 0.12, 2.2, lambert('#6b5236'), S.x, 2.2, S.z - S.d / 2 + 1.2);
  const rand = makeRand(23);
  for (let i = 0; i < 9; i++) {
    const b = boxAt(k, 0.9, 0.45, 0.5, hay, S.x - 3 + (i % 5) * 1.3 + rand() * 0.2, 2.5 + Math.floor(i / 5) * 0.45, S.z - S.d / 2 + 0.8 + rand() * 0.6);
    b.rotation.y = (rand() - 0.5) * 0.3;
  }
  for (let i = 0; i < 5; i++) boxAt(k, 0.9, 0.45, 0.5, hay, 9 - i * 0.2, 0.22 + (i > 2 ? 0.45 : 0), 2.5 + (i % 3) * 0.55, false);
  const fallen = gableRoof(k, site, roofM, boards, S.h);
  // The silo.
  const silo = new THREE.Group();
  silo.add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 7, 14), lambert('#9a948a')).translateY(3.5));
  for (let y = 1; y < 7; y += 1.2) silo.add(new THREE.Mesh(new THREE.CylinderGeometry(1.53, 1.53, 0.08, 14), lambert('#7a5a44')).translateY(y));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.52, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), lambert('#8a4b2a'));
  dome.position.y = 7;
  silo.add(dome);
  silo.position.set(6, 0, -9);
  k.g.add(silo);
  k.surfaces.push(boxSurface(new THREE.Vector3(6, 2.5, -9), new THREE.Vector3(2.6, 5, 2.6), ['px', 'nx', 'pz', 'nz'], 1.2));
  // A stone water trough.
  boxAt(k, 1.8, 0.5, 0.6, lambert('#8f887a'), 2.5, 0.25, -1, false);
  boxAt(k, 1.6, 0.05, 0.4, lambert('#3f5a5a'), 2.5, 0.46, -1, false);
  return { fallen, door: boxAt(k, 0.02, 0.02, 0.02, lambert('#141816'), site.door.x, 0.01, S.z + S.d / 2) };
}

// ---------- the glasshouse ----------

function glasshouse(site: Site, k: Kit) {
  const S = site.shelter;
  const brick = lambert('#8a5a44');
  const frame = lambert('#d6d9cf');
  const glass = new THREE.MeshLambertMaterial({ color: '#cfe8e4', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const x0 = S.x - S.w / 2, x1 = S.x + S.w / 2, z0 = S.z - S.d / 2, z1 = S.z + S.d / 2;
  // Low brick base, then glass and a white frame.
  const base = 0.6;
  const baseKit = { ...site, shelter: { ...S } };
  shell(k, baseKit, brick, base, 0.3);
  floor(k, site, '#6b6456');
  const glassH = S.h - base;
  const pane = (w: number, d: number, x: number, z: number) => boxAt(k, w, glassH, d, glass, x, base + glassH / 2, z);
  pane(S.w, 0.04, S.x, z0);
  pane(0.04, S.d, x0, S.z); pane(0.04, S.d, x1, S.z);
  const dx = site.door.x;
  pane(dx - 0.6 - x0, 0.04, (x0 + dx - 0.6) / 2, z1);
  pane(x1 - dx - 0.6, 0.04, (x1 + dx + 0.6) / 2, z1);
  for (let x = x0; x <= x1 + 0.01; x += 1.1) for (const z of [z0, z1]) boxAt(k, 0.07, S.h, 0.07, frame, x, S.h / 2, z);
  for (let z = z0; z <= z1 + 0.01; z += 1.2) for (const x of [x0, x1]) boxAt(k, 0.07, S.h, 0.07, frame, x, S.h / 2, z);
  for (const z of [z0, z1]) boxAt(k, S.w, 0.07, 0.07, frame, S.x, S.h, z);
  const fallen = gableRoof(k, site, glass, glass, S.h, 0.05, 0.15);
  // Roof ribs, left standing over the collapse too (the glass went, the iron didn't).
  const rise = (S.d / 2) * Math.tan(site.pitch);
  for (let x = x0; x <= x1 + 0.01; x += 1.1) for (const s of [-1, 1]) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, (S.d / 2) / Math.cos(site.pitch)), frame);
    rib.position.set(x, S.h + rise / 2, S.z + s * S.d / 4);
    rib.rotation.x = s * site.pitch;
    k.g.add(rib);
    k.roofs.push(rib);
  }
  // Old raised beds inside, still sprawling with something green.
  const soil = lambert('#4a3423'), leaf = lambert('#5f8a3a'), leaf2 = lambert('#7aa04a');
  const rand = makeRand(41);
  for (const z of [S.z + 0.9, S.z + 2.1]) {
    boxAt(k, S.w - 1.6, 0.5, 0.8, brick, S.x, 0.25, z);
    boxAt(k, S.w - 1.7, 0.05, 0.7, soil, S.x, 0.51, z);
    for (let x = x0 + 1.2; x < x1 - 1; x += 0.45) {
      const p = mesh(k, new THREE.IcosahedronGeometry(0.22 + rand() * 0.15, 0), rand() < 0.5 ? leaf : leaf2, x, 0.72, z + (rand() - 0.5) * 0.3);
      p.scale.y = 0.8 + rand() * 0.8;
    }
  }
  // Lamps hung from the ridge, for when people sleep in here.
  for (const x of [-4, -1, 2]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), GLOW_MAT);
    lamp.position.set(S.x + x, S.h - 0.2, S.z - 1);
    lamp.visible = false;
    k.g.add(lamp);
    k.glow.push(lamp);
  }
  if (!k.cut.includes(GLOW_MAT)) k.cut.push(GLOW_MAT);
  // The potting shed.
  const shed = new THREE.Group();
  shed.add(new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 3), lambert('#7a5a38')).translateY(1.1));
  const sroof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 3.5), lambert('#5f6a6a'));
  sroof.position.y = 2.35; sroof.rotation.x = -0.15;
  shed.add(sroof);
  shed.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.05), lambert('#4f7a5a')).translateY(0.9).translateZ(1.52));
  shed.position.set(8, 0, -8);
  k.g.add(shed);
  k.surfaces.push(boxSurface(new THREE.Vector3(8, 1.1, -8), new THREE.Vector3(3, 2.2, 3), ['px', 'nx', 'pz', 'nz'], 1));
  // Nursery benches in the yard, with pots.
  const bench = lambert('#8a7a5a'), pot = lambert('#b0603a');
  for (const [bx, bz] of [[-4, 1.5], [-4, 4], [2, 1.5], [2, 4]]) {
    boxAt(k, 3.4, 0.08, 0.9, bench, bx, 0.75, bz, false);
    for (const dx2 of [-1.5, 1.5]) boxAt(k, 0.08, 0.75, 0.8, bench, bx + dx2, 0.37, bz, false);
    for (let i = 0; i < 6; i++) {
      boxAt(k, 0.24, 0.22, 0.24, pot, bx - 1.3 + i * 0.52, 0.9, bz + (rand() - 0.5) * 0.4, false);
      if (rand() < 0.6) mesh(k, new THREE.IcosahedronGeometry(0.16, 0), leaf, bx - 1.3 + i * 0.52, 1.1, bz, false);
    }
  }
  return { fallen, door: doorMesh(k, site, 1.0, 2.1, '#3a4a44') };
}

/** Build the starting site's structure. */
export function buildSite(site: Site): StationBuild {
  if (site.kind === 'station') return buildStation();
  const k: Kit = { g: new THREE.Group(), surfaces: [], edges: [], roofs: [], cut: [], glow: [], rand: makeRand(site.kind.length * 97) };
  const parts = site.kind === 'chapel' ? chapel(site, k) : site.kind === 'motel' ? motel(site, k) : site.kind === 'farm' ? farm(site, k) : glasshouse(site, k);
  // Snow settles on roofs and ledges in winter.
  k.g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && (m as THREE.MeshLambertMaterial).isMeshLambertMaterial && !enhanced.has(m) && !(m as THREE.MeshLambertMaterial).transparent) enhance(m, { fog: false });
  });
  return {
    group: shadowed(k.g), surfaces: k.surfaces, edges: k.edges,
    store: { fallen: parts.fallen, door: parts.door, glow: k.glow },
    roofs: k.roofs, cutMaterials: k.cut,
  };
}
