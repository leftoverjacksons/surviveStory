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

94 parts, about 4,200 triangles, 68 KB packed. `shots/folk_scout.png` shows,
left to right: the concept, then front, 3/4, back and a walking frame.
