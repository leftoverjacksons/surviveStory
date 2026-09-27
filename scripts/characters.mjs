// Build the survivors' character models from Quaternius's CC0 "Ultimate
// Modular Men / Women" packs, and the wild animals from his "Ultimate
// Animated Animal Pack" (https://quaternius.com).
//
//   node scripts/characters.mjs <path to unpacked packs>
//
// expects <path>/men/Individual Characters/glTF/*.gltf and the same for
// women, and <path>/animals/glTF/*.gltf. Writes src/assets/people/<outfit>.glb
// (meshes only), anims.glb (the shared skeleton's clips, once) and
// src/assets/animals/<animal>.glb, welded, quantised and meshopt-compressed.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, resample, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

/** Remove an animation with its samplers and channels (disposing it alone leaves them behind). */
function dropAnimation(a) {
  for (const s of a.listSamplers()) s.dispose(); // their data goes in prune(), unless shared
  for (const c of a.listChannels()) c.dispose();
  a.dispose();
}

const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/characters.mjs <packs dir>');
const OUT = 'src/assets/people';
fs.mkdirSync(OUT, { recursive: true });

// Everyday clothes only: these are survivors, not knights or astronauts.
const OUTFITS = [
  ['men', 'Casual_2', 'man_casual'], ['men', 'Casual_Hoodie', 'man_hoodie'], ['men', 'Farmer', 'man_farmer'],
  ['men', 'Worker', 'man_worker'], ['men', 'Punk', 'man_punk'],
  ['women', 'Casual', 'woman_casual'], ['women', 'Worker', 'woman_worker'], ['women', 'Adventurer', 'woman_walker'],
  ['women', 'Punk', 'woman_punk'], ['women', 'Medieval', 'woman_homespun'],
];
const CLIPS = ['Idle', 'Idle_Neutral', 'Walk', 'Run', 'Interact', 'Sword_Slash', 'Punch_Right', 'Wave', 'Death', 'HitRecieve'];

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

/**
 * Flat-shaded in game: normals come from the faces, so don't ship them.
 * Each part's flat colour becomes a per-vertex slot (_SLOT), with the
 * colours listed in the scene's extras, so the game can merge the parts
 * into one skinned mesh (one draw per pass) and recolour survivors.
 */
function slotify(doc) {
  const mats = doc.getRoot().listMaterials();
  const one = doc.createMaterial('Flat');
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    p.setAttribute('NORMAL', null);
    p.setAttribute('TEXCOORD_0', null);
    const n = p.getAttribute('POSITION').getCount();
    p.setAttribute('_SLOT', doc.createAccessor().setType('SCALAR').setArray(new Uint8Array(n).fill(Math.max(0, mats.indexOf(p.getMaterial())))));
    p.setMaterial(one);
  }
  const extras = { slots: mats.map((m) => m.getName()), colors: mats.map((m) => m.getBaseColorFactor().slice(0, 3)) };
  doc.getRoot().listScenes()[0].setExtras(extras);
}

async function write(doc, file) {
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(file, doc);
  console.log(file, (fs.statSync(file).size / 1024).toFixed(0), 'KB');
}

for (const [pack, name, out] of OUTFITS) {
  const doc = await io.read(path.join(src, pack, 'Individual Characters', 'glTF', `${name}.gltf`));
  for (const a of doc.getRoot().listAnimations()) dropAnimation(a);
  slotify(doc);
  // Positions stay float: quantising them bakes a per-part scale into each
  // skin, and the game merges the parts into one mesh on one skeleton.
  await doc.transform(weld(), dedup(), prune(), quantize({ pattern: /^(JOINTS|WEIGHTS)/ }));
  await write(doc, path.join(OUT, `${out}.glb`));
}

// Wild animals (Quaternius "Ultimate Animated Animal Pack", CC0): each keeps
// its own skeleton and a few clips.
const ANIMALS = ['Deer', 'Stag'];
const ANIMAL_CLIPS = ['Idle', 'Eating', 'Walk', 'Gallop'];
const AOUT = 'src/assets/animals';
fs.mkdirSync(AOUT, { recursive: true });
for (const name of ANIMALS) {
  const doc = await io.read(path.join(src, 'animals', 'glTF', `${name}.gltf`));
  for (const a of doc.getRoot().listAnimations()) if (!ANIMAL_CLIPS.includes(a.getName())) dropAnimation(a);
  slotify(doc);
  await doc.transform(weld(), resample(), dedup(), prune(), quantize({ pattern: /^(JOINTS|WEIGHTS)/ }));
  await write(doc, path.join(AOUT, `${name.toLowerCase()}.glb`));
}

// One copy of the clips (every outfit shares the skeleton): no meshes.
{
  const doc = await io.read(path.join(src, 'men', 'Individual Characters', 'glTF', 'Worker.gltf'));
  for (const a of doc.getRoot().listAnimations()) if (!CLIPS.includes(a.getName())) dropAnimation(a);
  for (const n of doc.getRoot().listNodes()) if (n.getMesh()) { n.getMesh().dispose(); n.setMesh(null); n.setSkin(null); }
  for (const s of doc.getRoot().listSkins()) s.dispose();
  // Fingers are too small to see from the game's camera: drop their tracks.
  const FINGER = /^(Index|Middle|Ring|Pinky|Thumb)\d/;
  for (const a of doc.getRoot().listAnimations()) for (const c of a.listChannels()) {
    if (FINGER.test(c.getTargetNode()?.getName() ?? '')) { const s = c.getSampler(); c.dispose(); s?.dispose(); }
  }
  await doc.transform(resample(), dedup(), prune({ keepLeaves: true }), quantize());
  await write(doc, path.join(OUT, 'anims.glb'));
}
