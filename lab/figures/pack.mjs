// Lab: pack rigged figures (lab/figures/rig.py output) the way
// scripts/characters.mjs packs the game's figures: materials become per-vertex
// recolour slots (_SLOT, names and colours in the scene's extras), welded,
// joints quantised, meshopt-compressed. Writes to lab/figures/out/, which only
// the lab viewer reads.
//
//   node lab/figures/pack.mjs <rigged .glb>...
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'lab/figures/out';
fs.mkdirSync(OUT, { recursive: true });
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

/** Same as scripts/characters.mjs#slotify. */
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

for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  slotify(doc);
  await doc.transform(weld(), dedup(), prune(), quantize({ pattern: /^(JOINTS|WEIGHTS)/ }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const out = path.join(OUT, path.basename(f));
  await io.write(out, doc);
  console.log(out, (fs.statSync(out).size / 1024).toFixed(0), 'KB');
}
