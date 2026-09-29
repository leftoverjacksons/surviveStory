# Figure Studio (lab)

A local tool, kept apart from the game, for turning character images into
figures on the survivors' skeleton: image → 3D mesh → the game's skeleton and
clips → compared beside the current figures at the game's camera and pixel
scale → a library → optionally into the game. Nothing in `src/` imports this
folder, and the game's `vite build` doesn't include it.

## Setup (once, on the machine that will generate)

Needs: Python 3.11 (3.10–3.12 work, but only 3.11 installs Blender's module;
otherwise an installed Blender 4.2+ is used), git, Node (the repo's
`npm install`).

```
python lab/figures/setup.py        # add --cpu to ignore an NVIDIA GPU
npm run figures                    # then open http://localhost:5181/
```

`setup.py` creates `lab/figures/.venv-gen` (PyTorch with CUDA 12.4 when
`nvidia-smi` is present), `.venv-bpy` (Blender's module), `.hy3d` (the
Hunyuan3D-2 code) and `config.json` (the paths; edit it to point elsewhere).
All of these are git-ignored. Model weights (2–7 GB) download on the first
figure. For the Hugging Face Space backend, set `HF_TOKEN` before
`npm run figures` (a free account's token raises the GPU quota).

### Which machine

| Machine | Expected |
|---|---|
| NVIDIA with 8 GB or more (e.g. RTX 2070) | Runs fully on the GPU, fp16; tens of seconds a figure (estimate) |
| NVIDIA with 4–6 GB (e.g. RTX 3050 Ti laptop) | Whole-model CPU offload, switched on automatically below 7 GB; slower, **untested** |
| CPU only | Works: about 2.5–4.5 min a figure (measured below) |
| Hugging Face Space | No local GPU needed; free quota is a few figures a day |

## Using it

1. **Drop a front view** (and, if you have one, a back view) into the left
   panel. Paste works too. The name fills in from the file name.
   - Best input: one character, full body, A-pose (arms 30–45° out), plain
     background, front view, drawn to the game's proportions (head about 1:7).
2. Pick the **body** (man, woman or child; it sets the game's pool) and
   **Make figure**. The job runs generate → rig → pack. The log is in the
   right panel.
3. The figure appears in the view beside three current figures, playing the
   game's clips. **Pixel (game)** shows it as in the game (zoom 0.6–3.2 is the
   game's range). **Own colours** keeps its clothing colours; off shows how the
   game re-colours it per survivor.
4. **Colour slots**: each colour region gets a role. The game re-colours
   `skin`, `hair` and `cloth` per survivor and keeps `boot`, `hat`, `pack` and
   `strap`. Fix any wrong ones and choose **Apply slot names** (re-rigs, about
   35 s).
5. **Generate again** with another seed or quality, or **Rig again** with
   other triangle and slot counts.
6. **Add to library** copies it to `lab/figures/library/` (committed, with
   `library.json`: source, generator, licence). **Send to game** (two clicks)
   copies it into `src/assets/people/` as `man_*`, `woman_*` or `child_*`, where
   the game's figure pools pick it up. Nothing reaches the game without that
   step.

## Pieces

- **`server.py`**: the backend, standard library only. Holds figures in
  `work/<id>/` (git-ignored) and runs one job at a time.
- **`gen.py`**: image(s) → mesh.
  - Backend `local`: Hunyuan3D-2mini (one view) or 2mv (front + back), shape
    only; `turbo` (5 steps) or `full` (30); FlashVDM decoding; CUDA fp16 with
    offload below 7 GB, or CPU fp32.
  - Backend `space`: a Hugging Face Space through gradio_client.
  - Saves cut-outs (background removed) for the colour step.
- **`rig.py`**: Blender. Normalises and remeshes to about 3k triangles, fits
  the game's skeleton, applies heat weights, and colours from the front (and
  back) view, clustered into named slots (`--names` overrides them; `--slots`
  writes them out for the UI).
- **`pack.mjs`**: the game's slot and meshopt packing (as in
  `scripts/characters.mjs`).
- **`app.ts`, `stage.ts`, `index.html`, `vite.config.ts`**: the page. It uses
  the game's `makeCharacter` and `anims.glb` under the game's camera
  (orthographic, 30 units at zoom 1; pixel mode at 1/3 resolution).
- **`start.mjs`**: starts the server and the page (`npm run figures`).
- **`studio-test.mjs`**: drives the studio end to end with Playwright:
  upload, wait for the pipeline, add to the library, and take screenshots.

## Measurements (4-core CPU container, no GPU; 2026-09-29)

| Step | Time |
|---|---|
| Model load (weights cached, 7.2 GB download once) | about 1 min |
| Diffusion, 30 steps | 259 s (about 8.5 s per step) |
| Volume decode, octree 256, plain | about 15 min (849 chunks at 1.1 s) |
| Volume decode, octree 192, FlashVDM | 8 s |
| Turbo model (5 steps) + FlashVDM, whole generation | 154 s |
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
