# Asset credits

All third-party assets here are CC0 1.0 (public domain dedication). Credit
is not required, but given gladly.

- `people/*.glb`: survivors, from **Ultimate Modular Men** and **Ultimate
  Modular Women** by Quaternius (https://quaternius.com). Everyday outfits
  only; animations are merged into `anims.glb`.
- `animals/*.glb`: deer and stag, from the **Ultimate Animated Animal Pack**
  by Quaternius (https://quaternius.com).

They were converted by `scripts/characters.mjs`, which strips unused
animations and normals, merges shared data, tags each vertex with its
colour slot, and applies meshopt compression. To rebuild, download the packs,
unpack them as `men/`, `women/` and `animals/` in one folder, and run
`node scripts/characters.mjs <folder>`.
