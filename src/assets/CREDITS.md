# Asset credits

The third-party assets here are CC0 1.0 (public domain dedication). Credit
is not required, but given gladly.

- `people/*.glb`: survivors. These are our own figures, modelled, rigged and
  animated in code by `scripts/blender/survivor.py` (Blender's Python module)
  and compressed by `scripts/characters.mjs --figures <dir>`. An earlier
  build used Quaternius's Ultimate Modular Men/Women (CC0), and
  `scripts/characters.mjs <packs dir>` can still rebuild from them.
- `animals/*.glb`: deer and stag, from the **Ultimate Animated Animal Pack**
  by Quaternius (https://quaternius.com).

They were converted by `scripts/characters.mjs`, which strips unused
animations and normals, merges shared data, tags each vertex with its
colour slot, and applies meshopt compression. To rebuild, download the packs,
unpack them as `men/`, `women/` and `animals/` in one folder, and run
`node scripts/characters.mjs <folder>`.
