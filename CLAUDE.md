# Survive Story: working memory

This file is loaded at the start of every Claude session in this repo. It
holds what must not be lost when conversations are compacted. The full design
is in `DESIGN.md`, and §17 there is the live feedback backlog.

## Vision (one paragraph)
A browser community sim set in the quiet *after* civilisational collapse:
verdant, overgrown, solarpunk, spooky but hopeful. Survivors live
autonomously (Banished / Manor Lords / RimWorld). The player is a presence
the community half-senses: they draw zones, nudge councils and spend
Influence, but never command. Home is safe (no raids); danger lives on
expeditions (Wildermyth / XCOM), with permadeath and grief. A spiritual layer,
*the Veil*, runs through everything: Resonance (the land's health),
Sight (perception), Glimmer, Influence, and UAP, orb and fairy lore. Art
reference: Tiny Glade.

## Decisions the user has made (do not relitigate)
- Browser game, rotatable 3D isometric, large finite procedural map, real
  time with pause, long years (4 seasons × 12 days).
- The village layout is mostly the survivors' own design; the player paints
  zones (Home, Field, Woodlot, Sacred).
- Materials improve over time, but "eras" are rejected: progress should come
  from local materials plus know-how learned by doing (DESIGN §17).
- Assets: buildings and terrain generated in code; characters and audio may
  later be CC0-sourced.
- Tone: not combat-anxious. Hopeful and uncanny.

## Where things are
- `src/sim`: deterministic seeded simulation, no rendering imports.
- `src/render`: Three.js views; `util.ts#enhance` patches every material
  (wind, fog, zones, wear, seasons, Veil view).
- `src/ui/hud.ts` and `index.html`: HUD. `src/main.ts`: wiring and input.
  `window.__game` exposes debug hooks.
- `scripts/simulate.ts`: headless balance probe
  (`npm run sim -- <days> [--log] [--prepared]`).

## Conventions
- Check: `npx tsc --noEmit && npx vitest run && npx vite build`.
- Screenshots: `vite preview` on port 4173, plus Playwright with
  `/opt/pw-browsers` Chromium and swiftshader (about 1 fps; pause via
  `__game.setSpeed(0)` and advance with `__game.tick(minutes)`).
- Published build: the single-file build (`dist-single`) goes to the claude.ai
  artifact https://claude.ai/artifact/5PAyD8AiMBG9fQDNbCCMPc.
  **Ask before republishing** if the user may be mid-game, because a
  republish reloads their page.
- Branch: `claude/peaceful-planck-ons669`. No PRs unless asked.
- The user prefers precise, scientific, non-self-aggrandising communication.

## State (update every session)
- Built: milestones A, B, C1 (seasons, zones, winter, lanes), C2 (Veil,
  phenomena, council, Influence), look-inside (roof cutaway, x-ray
  silhouettes), building inspector.
- C2.5 in progress (user approved; they asked for bigger homes where people
  live and cook, yards like Manor Lords burgage plots, irregular shapes,
  varied structures):
  - Done: households (`src/sim/homes.ts`), petitions via council,
    self-start after 8 days, irregular plots along lanes and the green,
    procedural houses (`src/render/house.ts`), yards (`src/render/plots.ts`),
    suppers and evenings at home, crowding and comfort, the store as a
    commons hall.
  - Also done: know-how in place of eras (`src/sim/purpose.ts`),
    aspirations, leisure, the Veil's stakes and lore (see DESIGN §17
    "Round 1: what was built").
  - Also done: five starting sites (`src/sim/sites.ts`, `src/render/sites.ts`);
    the site lives on `world.site` and everything reads from it (no
    station constants outside `layout.ts`/`station.ts`). `?site=` and
    `?seed=` URL parameters.
  - Balance pass 1 done (DESIGN §17 "Balance pass 1"); `npm run balance`
    reports a food ledger, morale by season, Influence and winter hardship.
  - Fishing grounds done (`src/sim/fishing.ts`, meshes in
    `render/village.ts`; DESIGN §17 "Fishing grounds").
  - Performance pass 1 done (`src/render/merge.ts`; draw calls −73%, DESIGN §17).
  - Graphics pass 1 done: trees clear buildings (`render/clearance.ts`), canopy
    shading, contact shade, house skirts, colour grade (DESIGN §17).
  - Buildings adapt to slopes (foundations, steps, floor = f(terrain); user
    rejected terrain flattening). DESIGN §17 "Buildings on slopes".
  - Expeditions (milestone D) proposed; user said to hold off for now.
  - Trees v2 done (species silhouettes, limbs, jagged pines; DESIGN §17).
  - Soft look done (MSAA, soft shadows, smooth organic shading, calm grass; `?hard`).
  - Survivors are now OUR OWN Blender figures (`scripts/blender/survivor.py`,
    then `node scripts/characters.mjs --figures <dir>`; DESIGN §17). The user
    disliked the Quaternius people and rejected Kenney's minis. Iterate on
    these with the user. Deer are still Quaternius. NOT published.
  - Earlier: CC0 characters and animals (Quaternius; `src/render/characters.ts`,
    `scripts/characters.mjs`, `src/assets/CREDITS.md`; DESIGN §17).
    The environment now has full network access; Quaternius packs download from
    Google Drive with `pip install gdown` (`gdown --folder <url>`).
  - PIXEL ART IS NOW THE DEFAULT (user: "this is better"; `?smooth` for the
    old look). World-space surface textures, golden light, props and bunting.
    Reference: cosy isometric pixel-art town (t3ssel8r style). DESIGN §17.
  - Long-range plan from the user in DESIGN §18: modern-vernacular salvage
    houses with upgrade levels, scrap with provenance, repurposed structures,
    geodesic dome greenhouses, a bigger and denser old world (suburbs, malls,
    factories) matching the starting site. Station Eleven is the reference.
  - Old world phase 1 done: districts of ruins by site (`sim/oldworld.ts`,
    `render/ruins.ts`), salvage with provenance (`village.salvaged`), better
    cars. NOT published.
  - Old world phase 2 done: houses are modern salvage vernacular built from
    `village.salvaged` (`HouseSpec.clad`), with levels 0 shack → 1 patched →
    2 glasshouse + solar (`Building.level`, upgrade projects). NOT published.
  - Next: the user's playtest feedback; people instancing if needed;
    the C3 art pass.
  - Published: the artifact has the CC0 survivors and deer (commit c65e3cb, version 12).
