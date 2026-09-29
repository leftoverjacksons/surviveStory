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

/** A smock mill: an eight-sided tapered timber tower, a cap, four sails facing the front (+z). */
export function windmillMesh(p: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const h = 3.4 * Math.max(0.25, p);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.15, h, 8), mat(seed % 2 ? '#8a7258' : '#7a6448'));
  tower.position.y = h / 2; tower.castShadow = true; tower.receiveShadow = true;
  g.add(tower);
  // Weatherboard bands.
  for (let y = 0.5; y < h; y += 0.7) g.add(cyl(1.15 - (y / 3.4) * 0.4 + 0.02, 0.05, mat(DARK), 0, y, 0, 8));
  g.add(box(0.5, 0.8, 0.1, mat(DARK), 0, 0.4, 1.12)); // the door
  if (p < 1) return g;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.8, 8), mat('#5a4a3a'));
  cap.position.y = h + 0.35; cap.castShadow = true;
  g.add(cap);
  // The sails: a hub on the front of the cap, four arms with cloth.
  const sails = new THREE.Group();
  sails.position.set(0, h + 0.2, 0.95);
  sails.userData.keep = true;
  sails.userData.spin = 0.9;
  sails.add(cyl(0.12, 0.25, mat(DARK), 0, 0, 0, 8).rotateX(Math.PI / 2));
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group();
    arm.rotation.z = (k / 4) * Math.PI * 2;
    arm.add(box(0.07, 2.2, 0.06, mat(WOOD), 0, 1.15, 0));
    arm.add(box(0.36, 1.5, 0.02, mat(CLOTH), 0.2, 1.35, -0.02));
    for (let y = 0.7; y < 2.2; y += 0.35) arm.add(box(0.42, 0.03, 0.04, mat(WOOD), 0.2, y, 0));
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
