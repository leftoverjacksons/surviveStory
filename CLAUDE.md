# Survive Story: working memory

This file is loaded at the start of every Claude session in this repo. It
holds what must not be lost when conversations are compacted. The full design
is in `DESIGN.md`, and §17 there is the live feedback backlog.

## Vision (one paragraph)
A browser community sim set in the quiet *after* civilisational collapse:
verdant, overgrown, solarpunk, spooky but hopeful. Survivors live
autonomously (Banished / Manor Lords / RimWorld). The player shapes the land
and the plans (a build menu, plots, placement, council decisions); the
survivors live their own lives within them (who lives where, who works what,
how they feel). Home is safe (no raids); danger lives on
expeditions (Wildermyth / XCOM), with permadeath and grief. A spiritual layer,
*the Veil*, runs through everything: Resonance (the land's health),
Sight (perception), Glimmer, Influence, and UAP, orb and fairy lore. Art
reference: Tiny Glade.

## Decisions the user has made (do not relitigate)
- Browser game, rotatable 3D isometric, large finite procedural map, real
  time with pause, 4 seasons × 8 days (shortened from 12 at the user's request,
  DESIGN §21.9; `DAYS_PER_SEASON` rescales everything).
- The village layout is mostly the survivors' own design; the player paints
  zones (Home, Field, Woodlot, Sacred).
- Materials improve over time, but "eras" are rejected: progress should come
  from local materials plus know-how learned by doing (DESIGN §17).
- Assets: buildings and terrain generated in code; characters and audio may
  later be CC0-sourced.
- Tone: not combat-anxious. Hopeful and uncanny.
- Gameplay loop v2 (DESIGN §21), agreed after version 18:
  - a build menu with player placement (Manor Lords style); homes on
    polyline plots with yards and sub-structures;
  - every building procedural from salvaged materials;
  - any ruin repurposeable, with a cutaway;
  - the council pauses the game and asks; builds go straight to placement;
  - need tiers drive expansion; district-only materials drive clearing
    (Stardew's mines);
  - the Folk are a second city builder by night (orders any time, built
    after dusk);
  - shorter seasons and a rebalance last.

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
- Screenshots: `scripts/shots/` (README there): `vite preview` on port 4173,
  Playwright with swiftshader (about 1 fps). `shot.mjs` takes JSON steps;
  `compare.mjs` does before/after; `layers.mjs` finds which layer causes an
  artefact.
- Balance: `npx vite-node scripts/soak.ts -- [colonies] [years]` (multi-year,
  autopilot), `npm run balance`, `npm run sim -- <days>`; in game, the
  chronicle (key C).
- Published build: `npx vite build --mode single && node scripts/single.mjs
  <out.html>`, smoke-test with `scripts/shots/smoke.mjs`, then publish to the
  claude.ai artifact https://claude.ai/artifact/5PAyD8AiMBG9fQDNbCCMPc.
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
    these with the user. Deer are still Quaternius.
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
    cars.
  - Old world phase 2 done: houses are modern salvage vernacular built from
    `village.salvaged` (`HouseSpec.clad`), with levels 0 shack → 1 patched →
    2 glasshouse + solar (`Building.level`, upgrade projects).
  - Playtest round 2 fixes done (fog, nights, fog-of-war leak, fields). Fields
    are now drawn as outlines and fenced (`sim/fields.ts`; DESIGN §17). NOT published.
  - Next: the user's playtest feedback; people instancing if needed;
    the C3 art pass.
  - Entering the Veil costs 10 Influence (free on full moons and festivals, §21.9).
  - Restoring cleared ruins BUILT (§20.4, `sim/restore.ts`, `restore` projects,
    `Building.ruin`, `Ruin.restored`, `render/ruins.ts#syncRuins`).
  - Clearing controls in the world (§20.5): click a spirit for an action menu.
  - The Folk together BUILT (§20.6): Folk companions in clearings (FAE_UNIT, name/play
    verbs), council emissaries (folk_festival/land/amends), rules broken in the Wild,
    led astray + searches (folk.led; Omen shows the place), borrowed for a dance. NOT published.
  - CURRENT PLAN: DESIGN §21.2 (loop v2). Step 1 (cutaway for ruins) DONE §21.3;
    step 2 (build menu, placement, drawn plots, restore from the menu) DONE §21.4:
    the game runs with `village.autoPlan = false` (`?auto` for the old self-planning).
    Step 3 (the council pauses and asks; builds go straight to placement) DONE §21.5.
    Step 4 (need tiers; tool bench, sewing room, smoke shed, tavern; maker role;
    goods tools/cloth/clothes/preserves; `sim/trades.ts`, `render/trades.ts`) DONE §21.6.
    Step 5 (glass/copper/steel stripped from ruins in cleared districts; glass dome;
    `sim/rare.ts`) DONE §21.7. Step 6 (Folk orders built at night from dew and song;
    Folk needs gate the hill's growth) DONE §21.8. Step 7 (8-day seasons, full moon,
    Veil free on full moons/festivals, rebalance) DONE §21.9. Loop v2 complete.
    Then (§21.10): AUTOPILOT button/`?auto` (self-planning + council settles itself after
    10 s) and BACKYARD TRADES (tool bench/sewing room/smoke shed at the back of a household's
    plot, `sim/backyard.ts`).
  - UNATTENDED RUNS (DESIGN §22): save/resume DONE (§22.1, `sim/save.ts`, IndexedDB,
    autosave each morning); soak + fixes DONE (§22.2, `scripts/soak.ts`, `sim/autopilot.ts`:
    fields/woodlots/clearings, MAX_POP 24, abandonStalled, winter wood reserve); chronicle
    panel DONE (§22.3, `sim/chronicle.ts`, `ui/chronicle.ts`, key C); start menu DONE
    (§22.4, `ui/startmenu.ts`: Continue / new village by site, seed, autopilot). Published in v21.
    Smoke-testing the single-file build now needs `?new` (or click Begin), since the menu waits.
  - SEE-THROUGH WOODS §22.6: trees on the Folk's Wild become translucent ghosts (solid meshes
    discard them, `ghostTwin` alpha twins share instance buffers, no shadows; `enhance` `thin`,
    `worldUniforms.uThin`); button/key O cycles Wild ghosted → all ghosted → solid. The v23 rim
    outlines were rejected by the user. Ghost version published in v25.
  - HUD TIDY §22.7: village plans, Crew and Events collapse (`.fold-btn`, remembered); Events is a
    short running log (5 in view, 30 back); left column sized by measured `--top`/`--foot`. Published in v24.
  - ECONOMY BALANCE PASS 2 §22.8 DONE: storage capped at `STORE_PER_HEAD` (25/head), `rebalanceWork`
    (farmers follow need; `Survivor.roleSetDay` protects player choices), plots on any Home tile
    (`zoneCandidates`), autopilot woodlot on bare ground, chop radius 70, overdue festivals wanted.
    `soak.ts --detail` gives per-village diagnosis. NOT published.
  - SIM PERFORMANCE §22.9 DONE: search memo (`quiet`/`hush`, `Colony.memo`, saved), A* weight 0.95;
    ~160 ms sim/day at 24 people (was ~390). NOT published.
  - RENDER COST §22.10 DONE: `scripts/shots/perf.mjs` (calls/triangles per group); fences, Folk works,
    fairy ring merged; ghost chunks only near the Wild. 1,621 → 986 draw calls. NOT published.
    Open: survivor figures ~9k triangles each (simplify? ask the user).
  - PACING AUDIT §22.11 DONE (measured only): `scripts/pacing.ts`, `scripts/choices.ts`. Findings: ~0.4
    decisions/day, councils every 4 days, everything opens in week 1, tier ladder done by ~day 40,
    council choices barely matter except Folk standing, warmth false alarm in summer, autopilot never
    orders Folk works. User agreed to all of A–E; §22.8–22.10 published in v26.
  - D + E BUILT §22.12 (seasonal warmth `warmthWanted`; `autopilotFolk`), verified by soak (§23.5). Open: seed 6 exhausts all scrap by day ~40 (finite salvage; ask the user) and its late days
    are slow (3–5 s/day, cause not found yet). NOT published. Next after that: A–C with the user.
  - v27 = v26 + a fix: browser dialogs (confirm/alert/prompt) are BLOCKED in the claude.ai artifact
    frame, so "Start a new village" did nothing. Never use them: confirm with a second click instead
    (start menu button, field removal). v27 was built from d9607cb + that fix (D + E not in it).
  - ROUND 4 (DESIGN §23): user agreed A (staging) and C (councils: request tray, dilemma-driven
    councils, visible commitments); B pending their thoughts (symbiotic Folk/human growth pressing on
    uncleared zones). Backlog §23.2 (cleared districts fully usable like the start — user insists;
    mycelium network; solar/windmills; cars; timber handling). Order: overlay (DONE §23.3) → councils
    (C: request tray §23.4 `sim/requests.ts` `ui/tray.ts`; dilemmas + commitments §23.5
    `sim/dilemmas.ts`; DONE) → staging (A) → B. Published in v28 (built on HEAD).
  - PLAYTEST NOTES after v28 in DESIGN §23.6 (bench clipping, pixel shimmer, pathing through
    gardens/fences + auto gates, desire paths, move/deconstruct, living festivals, relationships and
    Folk romance/hybrids, blessing/curse, the mound as an underground Nunnehi townhouse). Next steps
    being agreed with the user.
  - FIXES AFTER v28 §23.7 BUILT (bench clear of door; `sim/hedges.ts`: fences/beds cost to cross, desire
    gates and arches; remembered snow-free desire paths; calm fire flicker; `scripts/shots/flicker.mjs`).
    Shimmer chase stopped at the user's request. NOT published. Next: design proposal §24 (Folk as equals +
    village life), then move/deconstruct, staging (A), B.
  - DESIGN §24 PROPOSAL (Folk as equals + village life) written; user chose festivals + weddings first.
    GATHERINGS BUILT §24.8 (`sim/gatherings.ts`, `render/gathering.ts`, `scripts/life.ts`, `__game.gather`):
    festivals/Folk dances/weddings actually held (arrive → feast → dance; vows under an arch), courtship →
    wedding → partners + one household. Published v30.
    TOWNHOUSE BUILT §24.9 (`sim/townhouse.ts`, `render/townhouse.ts`, Folk card cross-section, `__game.dig`):
    chambers per growth with small effects, ghostly topside (shimmer / Sight ≥ 45 at night / Veil view),
    chambers glow underground in the Veil view. MYCELIUM BUILT §24.10 (`sim/mycelium.ts`, `render/mycelium.ts`,
    `scripts/mycelium.ts`): network from the hill, blessing (growth +15%) / curse (nuisances) where it reaches, dead
    ground in uncleared districts. Published v31. Next: cleared districts' fate (§24.4), children/school, crossing.
  - VISUALS §22.5: grain fix (per-pattern sub-pixel fade `lodk`, luminance-only 20-step grade,
    fewer/closer-toned tufts, evergreen chunkier ivy) and string lights as a power network
    (spanning tree + poles, `plots.ts#planLights`). Published in v22.
  - User backlog in DESIGN §20: more motives (fun, beauty, purpose), trades
    (toolmaker, tailor, cook/preserver), taverns, solar on houses. Agreed order
    in §20.3: repurpose cleared ruins → Folk together → Folk districts → §20.2.
  - Published: version 22 (everything through §22.5: loop v2, autopilot, backyard trades,
    save/resume, soak fixes, chronicle, start menu, grain fix, light network).
  - NEW PLAN, under discussion: DESIGN §19. Haunted districts are cleared by a small
    turn-based team (Sight = fog of war, Nerve not HP, convert/lay to rest/banish),
    and the Folk are a second society (mounds, Folk paths, the Wild, Standing).
    Decisions in §19.7–19.8: taken (time-dilated, return changed), never killed;
    the Folk are a second planned society; clearing is optional, direct turn-based
    control on a zoomed district. The Folk's first mound is BUILT (§19.9:
    `sim/folk.ts`, `render/folk.ts`, `Zone.Wild`, Folk card). Published in version 15.
  - Haunted districts + clearing slice BUILT (§19.10): `sim/haunt.ts` (rosters,
    encounter engine, taken), `sim/clearbot.ts` (test bot), `render/clearing.ts`,
    `ui/clearing.ts`, district card in hud.ts, veil mode in main.ts
    (`__game.veilStart('suburb')`, `__game.veilTurns(n)`).
  - Playtest round 3 done (§19.11): Veil lights only at the Ring/hill/paths,
    electric lanterns and string lights, Ring on any bearing at the edge, hill
    beyond it, roof ivy on the pitch.
