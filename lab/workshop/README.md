# Character workshop (lab)

Characters authored in code in Blender, one file each, on the game's survivor
skeleton. It is the counterpart of the figure studio's image-to-3D path
(`lab/figures/`), and it files its results in the same library. The
difference is that nothing is inferred:

- **Rig:** every part is placed on the game's joint table, and its bones are
  chosen when it's built.
- **Colour slots:** every part's material *is* its colour slot, so the game's
  per-survivor re-colouring works exactly.
- **Licence:** the result is our own work, with no generator licence attached.

## Files

- `kit.py`: the skeleton (copied from `scripts/blender/survivor.py`), faceted
  building blocks (`tube`, `ico`, `uvs`, `box`, `ring`, `spike`, `sheet`,
  `mirrored`, `jitter`), weighting (rigid to a bone, or blended among chosen
  bones) and export.
- `characters/<name>.py`: one character. It defines `NAME`, `BODY` (`man`,
  `woman` or `child`: the game's pool), a palette, and
  `build(kit) → [(object, bones)]`.
- `concepts/`: the concept art each character is built from.
- `build.py <name>`: builds the character, rigs it, exports it, packs it with
  `lab/figures/pack.mjs`, and files it in `lab/figures/library/` (with
  `library.json`, marked "own work").
- `shots.mjs <library file> <dir>`: with `npm run figures` running, takes a
  turnaround (front, 3/4, side, back), walking frames, and game-zoom pixel
  views beside the current figures, plus the library thumbnail.

- `silhouette.mjs <library file> <out.png>` and `compare.py <concept> <silhouette> <overlay>`:
  - the model's front silhouette, straight on, arms raised to the concept's T-pose;
  - overlaid on the concept at the same height, with the overlap (IoU) and each
    band's width in both.
  - Overlay colours: red is shape the model lacks, blue is shape it has too much of.
  - Arm and cloak bands are distorted by the T-pose (the cloak follows the
    arms), so read those by eye. Head, trousers and boots compare directly.

```
python lab/workshop/build.py folk_scout        # Python with bpy (lab/figures/.venv-bpy)
npm run figures                                 # the studio: Show → Whole library
node lab/workshop/shots.mjs man_folk_scout.glb <dir>
```

## Conventions

- **Axes:** Blender Z-up; the figure faces -Y, so its right hand is at -X.
  Adult height is 1.69 m to the top of the head.
- **Proportions** follow the game's figures: head about 1:7 (DESIGN §24.14),
  the same joint table for everyone.
- **Slots by material name:**
  - `skin*` and `hair*` are re-coloured per survivor;
  - `eye*`, `boot*`, `strap*`, `pack*`, `roll*` and `hat*` keep their colour;
  - any other name is clothing, re-hued per survivor at the same lightness
    (near-greys stay).
  - Note that each clothing slot gets its own hue offset in the game.
- **Budget:** the game's figures are about 2,750 triangles. The Folk Scout
  is about 4,200.
- **Silhouette first:** a survivor is about 30 px tall at the game's default
  zoom. Hem shapes, bedrolls, hair mass and hats read at that size; eyes and
  buckles only show close up.

## Folk Scout (first character)

`characters/folk_scout.py`, from `concepts/folk_scout.webp`:

- tunic, baggy patched trousers, leg wraps with bands, boots with soles;
- sleeves, wrist wraps, fingerless gloves;
- a head with ears, eyes, brows and nose; curls and a short fringe;
- a scarf with a tail, a belt and buckle, chest straps, a satchel and sack;
- a bedroll;
- a two-tier jagged cloak open at the front, and a hood.

95 parts, about 4,300 triangles.

- `shots/folk_scout.png` shows, left to right: the concept, then front, 3/4,
  back, a walking frame, head close-ups, and the figure at the game's maximum
  zoom.
- `shots/folk_scout_silhouette.png` is the silhouette comparison.

### Changes after v1 (measured with `compare.py`)

IoU went from 0.719 to 0.747.

- **Head: 1.12× larger** (the user's request). Measured, the v1 head was
  already the concept's height (17% against 18%), so the "small head" came from
  the face. The face now has bigger, flatter eyes with large irises, thicker
  brows, a mouth, a small round nose and warmer skin. The head mesh is
  subdivided and collapse-decimated, giving small irregular facets rather than
  big flat cheeks.
- **Trousers:** baggier. At the thighs the width was 0.24 of the height
  against the concept's 0.34.
- **Boots:** bigger. The boot band was 0.205 against 0.277; the rest of that
  gap is the concept's wider stance.
- **Cloak:** hangs longer at the sides, with a sun-bleached hem band (its own
  slot, `cloth_cloak_edge`).

### Open

- **Hue offsets in the game:** it re-hues each clothing slot with its own hue
  offset, so `cloth_cloak` and `cloth_cloak_edge` would drift apart per
  survivor. That needs a small game-side change: group slots by name prefix.
