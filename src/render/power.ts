/**
 * Power buildings, drawn (DESIGN §24.17): a timber smock windmill with four
 * lattice sails, a rack of salvaged solar panels, and a homemade wind
 * turbine. Sails and blades are kept out of the static merge (`keep`) and
 * tagged `spin` so the village view turns them. `p` is construction
 * progress, 0..1 (sites show the frame going up).
 */
import * as THREE from 'three';
import { box, cyl, mat } from './kit';

const WOOD = '#6b5236', DARK = '#4a3a2c', CLOTH = '#e8e0cc', STEEL = '#8a8e90', PANEL = '#243a5a', FRAME = '#9a9a92';

/**
 * A smock mill: an eight-sided tapered timber tower two to three storeys high, a reefing
 * stage round it, a cap, and four big sails facing the front (+z). The tallest thing in
 * a village (DESIGN §42.4: the user found the first one far too small): the tower is
 * about 7 units, the sail tips sweep up to about 12, and each arm is ~0.6 of the tower.
 */
export function windmillMesh(p: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const H = 7.2, h = H * Math.max(0.25, p);
  const rTop = 0.85, rBot = 1.4;
  const rAt = (y: number) => rBot + (rTop - rBot) * (y / H);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(rAt(h), rBot, h, 8), mat(seed % 2 ? '#8a7258' : '#7a6448'));
  tower.position.y = h / 2; tower.castShadow = true; tower.receiveShadow = true;
  g.add(tower);
  // Weatherboard bands, a door and small windows up the front.
  for (let y = 0.6; y < h; y += 0.8) g.add(cyl(rAt(y) + 0.02, 0.06, mat(DARK), 0, y, 0, 8));
  g.add(box(0.6, 1.0, 0.1, mat(DARK), 0, 0.5, rBot - 0.04));
  for (const y of [3.6, 5.6]) if (y < h - 0.4) g.add(box(0.3, 0.42, 0.08, mat(DARK), 0, y, rAt(y) - 0.02));
  // The reefing stage: a timber gallery round the tower, where the sails are set.
  const stageY = 2.7;
  if (h > stageY + 0.3) {
    g.add(cyl(rAt(stageY) + 0.65, 0.1, mat(WOOD), 0, stageY, 0, 8));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8, r = rAt(stageY) + 0.6;
      g.add(box(0.06, 0.55, 0.06, mat(DARK), Math.cos(a) * r, stageY + 0.3, Math.sin(a) * r));
    }
    g.add(cyl(rAt(stageY) + 0.62, 0.05, mat(DARK), 0, stageY + 0.55, 0, 8));
  }
  if (p < 1) return g;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.1, 8), mat('#5a4a3a'));
  cap.position.y = H + 0.5; cap.castShadow = true;
  g.add(cap);
  // The sails: a hub on the front of the cap, four long arms with cloth on a lattice.
  const L = 4.3;
  const sails = new THREE.Group();
  sails.position.set(0, H + 0.35, 1.15);
  sails.userData.keep = true;
  sails.userData.spin = 0.6;
  sails.add(cyl(0.22, 0.4, mat(DARK), 0, 0, 0, 8).rotateX(Math.PI / 2));
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group();
    arm.rotation.z = (k / 4) * Math.PI * 2;
    arm.add(box(0.12, L, 0.1, mat(WOOD), 0, L / 2, 0));
    arm.add(box(0.72, L * 0.74, 0.02, mat(CLOTH), 0.4, L * 0.6, -0.04));
    for (let y = L * 0.24; y <= L; y += 0.42) arm.add(box(0.82, 0.04, 0.05, mat(WOOD), 0.4, y, 0));
    arm.add(box(0.04, L * 0.76, 0.05, mat(WOOD), 0.8, L * 0.6, 0));
    arm.traverse((o) => { o.castShadow = true; });
    sails.add(arm);
  }
  g.add(sails);
  return g;
}

/** Salvaged solar panels on timber racks, tilted to the sun, in two rows. */
export function solarMesh(W: number, D: number, p: number): THREE.Group {
  const g = new THREE.Group();
  const rows = 2, cols = Math.max(2, Math.round(W / 1.2));
  const built = Math.round(rows * cols * Math.max(0, Math.min(1, p)));
  let n = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = (c - (cols - 1) / 2) * 1.15, z = (r - (rows - 1) / 2) * (D / rows);
    // The rack: two legs, taller at the back.
    g.add(box(0.06, 0.5, 0.06, mat(WOOD), x, 0.25, z + 0.3), box(0.06, 0.9, 0.06, mat(WOOD), x, 0.45, z - 0.3));
    if (n++ >= built) continue;
    const panel = new THREE.Group();
    panel.position.set(x, 0.72, z);
    panel.rotation.x = -0.55;
    panel.add(box(1.05, 0.04, 0.8, mat(FRAME), 0, 0, 0), box(0.97, 0.03, 0.72, mat(PANEL), 0, 0.02, 0));
    // Cell lines.
    for (let i = -1; i <= 1; i++) panel.add(box(0.01, 0.035, 0.72, mat('#3a5a80'), i * 0.24, 0.025, 0));
    g.add(panel);
  }
  // A cable box at one end.
  g.add(box(0.3, 0.4, 0.2, mat(STEEL), (cols / 2) * 1.15 + 0.1, 0.2, 0));
  return g;
}

/** A homemade turbine: a steel mast, a nacelle, three blades. */
export function turbineMesh(p: number): THREE.Group {
  const g = new THREE.Group();
  const h = 4.6 * Math.max(0.2, p);
  g.add(cyl(0.09, h, mat(STEEL), 0, h / 2, 0, 6));
  // Guy wires' anchors.
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; g.add(box(0.15, 0.1, 0.15, mat(DARK), Math.cos(a) * 0.9, 0.05, Math.sin(a) * 0.9)); }
  if (p < 1) return g;
  g.add(box(0.26, 0.24, 0.6, mat('#b8b4a8'), 0, h, 0));
  const blades = new THREE.Group();
  blades.position.set(0, h, 0.34);
  blades.userData.keep = true;
  blades.userData.spin = 2.2;
  blades.add(cyl(0.08, 0.12, mat(DARK), 0, 0, 0, 8).rotateX(Math.PI / 2));
  for (let k = 0; k < 3; k++) {
    const b = new THREE.Group();
    b.rotation.z = (k / 3) * Math.PI * 2;
    b.add(box(0.14, 1.3, 0.03, mat('#e8e4d8'), 0.03, 0.7, 0));
    blades.add(b);
  }
  g.add(blades);
  return g;
}

/** A saw pit (DESIGN §24.19): a timber-lined trench, a trestle over it, a log on the trestle and the long two-man saw. */
export function sawpitMesh(W: number, D: number, p: number): THREE.Group {
  const g = new THREE.Group();
  const L = W - 0.4;
  // The pit's timber lining, just above the ground.
  g.add(box(L, 0.12, 0.12, mat(DARK), 0, 0.06, -0.45), box(L, 0.12, 0.12, mat(DARK), 0, 0.06, 0.45));
  g.add(box(L - 0.2, 0.02, 0.8, mat('#2e261e'), 0, 0.02, 0));
  if (p < 0.5) return g;
  // Trestles at each end, and the log across them.
  for (const x of [-L / 2 + 0.3, L / 2 - 0.3]) g.add(box(0.12, 0.8, 1.2, mat(WOOD), x, 0.4, 0));
  if (p < 1) return g;
  g.add(cyl(0.22, L, mat('#6a4a30'), 0, 0.98, 0, 8).rotateZ(Math.PI / 2));
  g.add(box(0.03, 1.5, 0.22, mat(STEEL), 0.2, 0.9, 0.05));
  // Sawn boards stacked to one side.
  for (let k = 0; k < 4; k++) g.add(box(L * 0.8, 0.06, 0.28, mat('#b89a6a'), 0, 0.03 + k * 0.07, D / 2 - 0.2));
  return g;
}

/** A hamlet's fire (DESIGN §28): a ring of stones, logs, flames, a warm glow; stones and a pile of kindling while it's being laid. */
export function hearthMesh(p: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    if (i / 9 > Math.max(0.3, p)) break;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), mat('#6f6c64'));
    s.position.set(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55);
    g.add(s);
  }
  // Split logs stacked to one side for the evening.
  for (let k = 0; k < 3; k++) g.add(cyl(0.08, 0.8, mat(WOOD), 1.0, 0.08 + k * 0.12, -0.3 + (k % 2) * 0.15, 6).rotateZ(Math.PI / 2));
  if (p < 1) return g;
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 6), mat('#3b2a1e'));
    log.rotation.set(Math.PI / 2 - 0.25, (i / 3) * Math.PI, 0);
    log.position.y = 0.15;
    g.add(log);
  }
  const flames = new THREE.Group();
  flames.userData.keep = true;
  const cols = ['#ffb347', '#ff7b2e', '#ffe08a'];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.2 - i * 0.05, 0.62 - i * 0.12, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(cols[i]).multiplyScalar(3), toneMapped: false }));
    f.position.y = 0.42;
    flames.add(f);
  }
  const light = new THREE.PointLight('#ff9448', 5, 9, 1.6);
  light.position.y = 0.9;
  flames.add(light);
  g.add(flames);
  return g;
}
