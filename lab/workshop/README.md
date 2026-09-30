# Character workshop (lab)

Characters built in code in Blender, from **parts** on the game's survivor
skeleton, and dressed by **recipes**. The parts are also exported as a
**parts library**, so survivors can be composed at run time: the game decides
what a survivor wears and carries (role, clothes, equipment), merges those
parts into one mesh, and re-composes it when anything changes. The figure
studio (`lab/figures/`, `npm run figures`) shows all of this; Show →
"Compose (parts)" is the run-time composition. Nothing here touches the game
yet.

## Proportions: the "hero" build

- **Source:** measured from the user's in-game references
  (`concepts/*_ingame.png`).
- **The numbers:** head with hair about 0.24 of the height (about 1:4.2),
  skull 0.19; shoulders at 0.67 of the height; crotch to sole 0.34; hands
  about 0.09; boots 0.13–0.16 tall. This replaces the 1:7 of DESIGN §24.14.
- **How the build works:** `kit.BUILDS['hero']`. Every bone keeps the game
  skeleton's direction and only its length changes: joint = parent + adult
  offset × a factor per segment.
  - The factors: upper leg 0.71, lower leg 0.61, spine 1.09, neck 0.67,
    arms 0.9; head ×1.35, hands ×1.6, feet ×1.3; limbs 1.3× thicker.
  - Because the bones' rest rotations don't change, the game's shared clips
    (`anims.glb`, keyed as rotations) play unchanged.
- **Other builds:** `kit.BUILDS['adult']` reproduces the game's current
  joint table exactly. A child build is one more entry.

## Files

- `kit.py`: builds and the joint derivation, faceted building blocks (`tube`,
  `ico` with facet decimation, `uvs`, `box`, `ring`, `spike`, `sheet` with
  materials per row, `mirrored`), weighting (rigid, or blended among chosen
  bones), `skin_to`, export.
- `parts.py`: the catalogue, one part per slot. Every position is relative to
  the build's joints and head, so each part fits any build.
  - body: `body.base` (neck, arms, shins, mitten hands)
  - head: `head.face`
  - hair: `curly`, `bun`
  - top: `tunic`, `shirt_rolled`
  - bottom: `baggy`, `overalls`
  - legs: `wraps`
  - feet: `boots`
  - hands: `gloves_fingerless`
  - neck: `scarf`, `bandana`
  - waist: `belt`
  - straps: `chest`
  - bag: `satchel`, `plant_sack`
  - back: `bedroll`
  - outer: `cloak`
  - held: `lantern`, `trowel`
- `recipes.py`: characters as data: build, pool (man, woman or child), one part
  per slot, colours by colour slot. So far `folk_scout` and `gardener`.
- `build.py`:
  - `build.py <recipe>...`: whole characters into the studio library
    (`lab/figures/library/<pool>_<recipe>.glb`).
  - `build.py --parts [--build hero]`: every part as its own skinned mesh on
    one skeleton, as `parts_<build>.glb` (133 KB for 21 parts) plus
    `parts_<build>.json` (the manifest: categories, colour slots, triangle
    counts, recipes).
- Checking the result, with `npm run figures` running:
  - `shots.mjs`: turnaround and game-zoom views;
  - `sheet.py`: lays those out beside the concept;
  - `silhouette.mjs` and `compare.py`: silhouette overlap (IoU) against the
    concept, band by band.
- `concepts/`: the reference art.

## Run-time composition (studio: `lab/figures/compose.ts`, `stage.ts`)

1. Load `parts_<build>.glb` once.
2. For a survivor, clone it, keep the chosen parts, and merge them into one
   skinned mesh. The game's `mergeOutfit` already merges an outfit's parts
   this way, so the result is one draw call.
3. Apply colours: the recipe's palette, or the game's per-survivor variety
   (`makeCharacter`).
4. When a survivor's clothes or equipment change, compose again.

The crowd view dresses random survivors by **role rules** (`ROLES` in
`compose.ts`: gardener, scout, salvager, villager), a sketch of the rule the
game would apply from its own data.

## Colour slots (material names, as the game reads them)

- `skin*`, `hair*`: re-coloured per survivor.
- `eye*`, `boot*`, `strap*`, `pack*`, `roll*`, `hat*`: colours kept.
- Anything else is clothing, re-hued per survivor at the same lightness
  (near-greys stay).
- Held items use `pack_*`, so they keep their colours.

## For the game (not done yet: needs the user's go-ahead)

- **`characters.ts`:** load `parts_hero.glb`, and compose each survivor from
  sim data. The mapping: role → top, bottom and tool; season → outerwear;
  equipment → held item and bag; family and age → hair and build.
- **Children:** a child build.
- **Hue grouping:** re-hue related slots together (`cloth_cloak` with
  `cloth_cloak_edge`), grouped by name prefix.
- **Triangle budget:** a full scout is about 5,100 triangles (the cloak alone
  is 1,160); the gardener is about 3,000. The game's figures are about 2,750.

## History

- **v1–v2 of the Folk Scout** were a single file at the game's 1:7
  proportions. They're superseded by parts, recipes and the hero build.
  Silhouette IoU went from 0.719 to 0.747 across those versions.
- **Shots:**
  - `shots/folk_scout.png`, `shots/gardener.png`: each reference, then front,
    3/4, back, walking, and game zoom;
  - `shots/compose.png`: gardener from parts, the gardener re-dressed,
    a village crowd, and the crowd in pixel mode.
