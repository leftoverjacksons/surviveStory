# Figure lab

An experiment, kept apart from the game: image → 3D mesh → the game's skeleton
and clips → compared beside the current figures at the game's camera and
pixel scale. Nothing in `src/` imports this folder, and `vite build` doesn't
include it.

## Pipeline

1. **Generate** a mesh from one image (`gen_cpu.py`): Hunyuan3D-2mini
   shape model, on CPU. No texture model; colour comes from the image in step 2.
2. **Rig** (`rig.py`, Blender's Python module `bpy`):
   - normalise to the survivors' height;
   - voxel-remesh, then decimate to about 3k triangles;
   - build the game's bone table, fitted to the mesh's hip and shoulder width;
   - apply Blender's automatic (heat) weights;
   - project the image's colours onto the mesh from the front, smooth them,
     and cluster them into 5 named slots (`skin`, `hair`, `boot`, `cloth_N`).
3. **Pack** (`pack.mjs`): the same slot/meshopt packing as
   `scripts/characters.mjs`, written to `lab/figures/out/` (git-ignored).
4. **View** (`index.html`, `viewer.ts`): `npx vite`, then open `/lab/figures/`.
   - Every figure goes through the game's own `makeCharacter` and `anims.glb`.
   - The camera is the game's: orthographic, 30 units at zoom 1; pixel mode at
     1/3 resolution.
   - `?raw` keeps a candidate's own clothing colours.
   - `node lab/figures/shot.mjs <dir> [clip] [query]` saves screenshots
     (game default zoom, game max zoom, lineup, and 4 poses of the newest figure).

```
S=<scratch dir with venvs and a clone of Tencent-Hunyuan/Hunyuan3D-2>
HY3D_REPO=$S/hy2 $S/hyenv/bin/python lab/figures/gen_cpu.py image.png mesh.glb 30 192 --flash
$S/bpyenv/bin/python lab/figures/rig.py mesh.glb image.png work/lab_x.glb
node lab/figures/pack.mjs work/lab_x.glb
```

`gen_cpu.py` is the Hunyuan3D-2 repo's `minimal_demo.py` reduced to shape only:
`Hunyuan3DDiTFlowMatchingPipeline.from_pretrained('tencent/Hunyuan3D-2mini',
subfolder='hunyuan3d-dit-v2-mini', device='cpu', dtype=float32)`, then
`enable_flashvdm()` with the VAE cast to float32. The environment is CPU
PyTorch, `diffusers transformers einops omegaconf trimesh pymeshlab
opencv-python-headless accelerate rembg onnxruntime`.

## Measurements (4-core CPU container, no GPU; 2026-09-29)

| Step | Time |
|---|---|
| Model load (weights cached, 7.2 GB download once) | about 1 min |
| Diffusion, 30 steps | 259 s (about 8.5 s per step) |
| Volume decode, octree 256, plain | about 15 min (849 chunks at 1.1 s) |
| Volume decode, octree 192, FlashVDM | 8 s |
| Rig, weights, colour, export (`rig.py`) | about 35 s |

- **Output:** 117k faces, decimated to 3,000; the packed `.glb` is 57 KB (the
  game's figures are about 44 KB).
- **Weights:** heat weighting succeeded on 1,498 of 1,498 vertices.

## Findings from the first test

The test input was the Hunyuan repo's example `1310.png`, a chibi boy in a
white shirt.

- **Works:** the chain runs end to end. The generated figure plays the game's
  clips on the game's skeleton, and the legs stride correctly in Walk.
- **Proportions follow the input image.** A chibi input gives a chibi figure,
  so source images must match the game's proportions (head about 1:7, stocky).
- **Arms hanging against the body fuse to it**, so the arm swing barely reads.
  Use A-pose inputs (arms 30–45° out).
- **Colour is single-view projection.** The back of the body copies the
  front, and the back of the head takes the colour at the top of the head.
  A back view (the multi-view model, Hunyuan3D-2mv) would fix this.
- **At game zoom** (about 30 px tall at default zoom) the figure reads mainly
  as silhouette plus 3–4 colour masses. That is what to judge on.

## Licence (matters before anything ships)

- **Hunyuan3D-2 / 2.1 is not safe for shipped assets.** It is under the
  Tencent Hunyuan 3D Community License, whose clause 5(c) forbids using,
  distributing or *displaying* its **Outputs** outside the "Territory", which
  excludes the EU, UK and South Korea. Figures made with it shouldn't ship in a
  public web game; use it for prototyping only.
- **TRELLIS / TRELLIS.2 (Microsoft) is MIT-licensed**, so it is the candidate
  for real assets. It needs an NVIDIA GPU (CUDA-only kernels; about 12–16 GB
  VRAM for TRELLIS.2 at 512³), so it can't run in this CPU container.
- **Rigging stays in Blender either way,** so `rig.py`, `pack.mjs` and the
  viewer are unchanged whichever generator makes the mesh.
