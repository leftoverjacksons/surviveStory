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
- Clearings: `npx vite-node scripts/clearprobe.ts -- [kind] [seeds] [--log] [--poor]` (the test bot on many seeds).
- Balance: `npx vite-node scripts/soak.ts -- [colonies] [years]` (multi-year,
  autopilot), `npm run balance`, `npm run sim -- <days>`; in game, the
  chronicle (key C).
- Published build: `npx vite build --mode single && node scripts/single.mjs
  <out.html>`, smoke-test with `scripts/shots/smoke.mjs`, then publish to the
  claude.ai artifact https://claude.ai/artifact/5PAyD8AiMBG9fQDNbCCMPc.
  **Ask before republishing** if the user may be mid-game, because a
  republish reloads their page.
- Branch: `claude/peaceful-planck-ons669`. No PRs unless asked. PR https://github.com/leftoverjacksons/surviveStory/pull/1 was MERGED into main (up to 236fbd3); later work on this branch needs a new PR to reach main.
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
    ground in uncleared districts. Published v31. USER ANSWERS §24.11: children age in real game years
    (no speed-up, for now), Crusader Kings-style lineage/notable families, hybrids ≤5–10% of children, scrap
    exhaustion deferred (may push territory), figures: less lanky + decimate, together with children.
    DEPAVE + SHARE BUILT §24.12 (`sim/depave.ts`, Depave brush, `depave` task, terrain redraws on `groundVersion`,
    district owner 'shared'). Published v32.
    MOVE / TAKE DOWN / CALL OFF BUILT §24.13 (`sim/dismantle.ts`, right-click → card, second-click confirm). Published v33.
    FIGURES §24.14: head 1:7, broader, child build (`child_*.glb`, `Outfit.child`), decimated to ~2.7k tris (`--ratio`).
    Needs `pip install bpy`.
    CHILDREN + FAMILIES §24.15 (`sim/lineage.ts`, `scripts/lineage.ts`): age follows the calendar, family names,
    births/foundlings, play, apprentices at 12, of age at 16, old age. Published v35 WITHOUT the card's family lines
    (they make the artifact publish check refuse the page as a "PR review page"; see §24.15). Next: family tree + heirs,
    then crossing (§24.6).
    BACKLOG ROUND (§24.16–24.18): restored houses are homes with plots/yards (`plotForRuin`); toadstools on the
    mycelium; POWER (`sim/power.ts`, `render/power.ts`: wiring know-how, windmill/solar/turbine, grid, lights by power);
    STRIP AND CLEAR (`sim/salvage.ts`: marked wrecks, pulling ruins down); TIMBER (§24.19, published v36: logs → woodyard
    → `split` task at the chopping block or saw pit; `world.ts#woodyard`). Next: electric carts.
    ORDER: cleared districts (§24.4) → move/deconstruct → figures + children + lineage → crossing → A → B.
    THE FOLK REDESIGN (DESIGN §25, user's direction after v36): MYCELIUM REDRAWN §25.1 (built: tree from the hill,
    curved tapered lavender ribbons, sway + outward pulses, explored ground only; full in the Veil view, faint for
    a selected high-Sight survivor, barely at night; `__game.spread`). Published v37.
    FOLK STEPS 1–4 BUILT §25.5: Great Hill r 7.2 + KNOWES raised in the terrain per growth (`sim/townhouse.ts`, `raiseHill`,
    `heightVersion`, `swallowed` event), GENTRY/WEE (`sim/fae.ts`: opinions `Fae.of/kin`, `Survivor.fae`, saucers at dusk,
    Wee night calls → favour or mischief with real costs, iron over doors), WISPS by default + FULL FORM in moments
    (`showSelf`, `Fae.moment`; placeholder figures = ghosted survivor figures; Blender figures saved for the user),
    the RESTLESS (laid-to-rest spirits drift to the hill; every 3rd quickens a Wee one). Not yet: the Strange. Published v38.
    §25.6 (published v39): new villages start with the mycelium grown through the Wild to the Ring (`growMycelium`, Folk roots
    as hubs) and a settlement (dwelling + dew knowe, Wee band); a growth asks WHERE the knowe rises (Asks tray → knowe tool,
    `placeKnowe`; the Folk choose after 3 days; autopilot at once); new knowes get a trunk at once (`reachKnowe`).
    DESIGN §26 (after v39; user doing CHARACTER WORK ON ANOTHER BRANCH: don't touch render/characters.ts, render/people.ts,
    scripts/blender/, assets/people/): the council asks who a cleared district belongs to (dilemma `district`); Folk/shared
    districts are THEIR COUNTRY (`folkDistricts`, knowes may rise there, mycelium roots to them), they live in its ruins
    (`folkRuins`, `roomFor`, ghost homes drawn), no room → lights drift toward the nearest haunted district. NOT published yet.
    Published v40. EVERYTHING MOVABLE §27: fire + stockpile (`sim/hearth.ts`, right-click card → Move; `camp.ts#relocate`),
    homes (even lived in; family first in line, plot tool opens), backyard trades, kitchen (`site.kitchen` follows), fishing
    works come down together, restored ruins pulled down; only the found shelter stays.
    RESETTLING §28: HAMLET FIRE (`DEFS.hearth`, build menu; only in a village/shared cleared district, ≥28 from other fires;
    `hearth.ts#fires/fireFor/whyNotHamletFire`); people gather at the fire nearest their home (`seatOf`); autopilot lays one
    (`autopilotHamlet`). §27 + §28 published v41.
    §29 BUILT (published v42): the found shelter can be repaired from its card, pulled down (`Building.gone`,
    `pullDownShelter`) or "moved" (a Commons hall, `DEFS.hall`, `hallOf`); homes offer Improve. The Great Hill
    sits 42–60 from the fire (buffer), knowes keep `KNOWE_KEEP_OFF` from it.
    §30 BUILT (published v42): WRECKS right-click card (strip/leave/tow to yard/tow elsewhere/stop), emptied wrecks
    vanish and free their tiles (`clearHeap`, `heapTiles`), TOWING (`towHeap`, `tow` task, `Heap.tow`, `yardSpot`;
    the nearest free people come). The station car is now a normal wreck. Next: electric carts, parts with provenance.
    §31 FIXES (not published): a plot drawn from a home ask goes to that household at once and the ask clears
    (`homeForAsker`, `dropAnsweredHomes`); cutaway cuts each village building at its own floor (`cutMaterialFor`).
    §31 + §32 published v43 (§32 BUILD MENU GROWS: `sim/unlocks.ts`, hidden / glimpsed / open by world facts,
    sections, `Village.unlocked/fresh`, *new* marks, gold ring on Build).
    §33 (published v44): ruins cut at their own floor (`userData.cutAt` through `mergeStatic`), hall furniture,
    clearance for hall/power/sawpit/hearth, autopilot strips wrecks near fires. Seed-6 slowness not reproducible
    (≤200 ms/day to day 200); "paused view" was a harness artefact.
    §34 (playtest v44, published v45): seats round fires (`camp.ts#seats`), plots over rocks (not houses/yard items),
    plot drawing on lit tiles (`render/drafttiles.ts`), Folk paths bend round blocked tiles (crossing not reproduced;
    seed asked), deer unstuck, GRAPHICS PANEL (`ui/gfx.ts`, key G: pixel size incl. off, outlines, colour steps,
    surface strength `uSurface`, bloom, exposure, shadows, tufts, painted grass `uGrassPaint`; presets). Composer is
    sized by `sizeComposer` (never setPixelRatio alone). Eat before bed if food < 45.
    §35 SNOW (published v46): snow settles while falling and melts when not cold (`snowCold`, `uSnow` ground /
    `uRoofSnow` tops, main.ts season block), FOOTPRINTS (`render/footprints.ts`, `uFootTex`; people and deer; fade
    1.5 days, faster in snowfall), snowfall thickens with depth. `__game.snow(v)`.
    §36 PLAYTEST NOTES v46 (to do, captured): crisp desire paths (wear texture is 1 texel/tile, linear), Folk
    companions in a clearing leave a lasting bond with the team, RESTORE IS HARD TO FIND (only Build → The old
    world → Restore a ruin; add a right-click ruin card with Restore / Pull down, and say so after clearing).
    §37 RESTORED HOUSES AS ORDINARY HOMES (a86dcad, in progress, not published): ruin card, family names,
    plot trees felled; open: plot still looks overgrown in shots, stakes faint.
    §38 THE CENTRE MOVES (user's direction after v46; DESIGN ONLY, NOT STARTED — wait for the user):
    XCOM/Wildermyth short tactical missions are the heart, a small cast (~8–14) of real characters,
    Crusader Kings-style ties that remember WHY (reason records) and shape home life; buildings equip
    missions; logistics goes to the background. Build order §38.8: make one clearing mission good →
    ties with reasons → consequences at home → resize the village → more mission types.
    Open questions for the user in §38.9 (death, control at home, cast size, time between missions).
    §38.10–38.15 (user's mission mechanics, agreed: two rings, free movement): grid stays as an invisible index;
    the MURK over haunted districts; LANTERNS (raised/shuttered/set down, fuel from home, kinds + tailored parts
    with provenance, spirit × light table); WARDS as placed shapes (lantern pool, salt/iron line, rowan ring,
    bell, hearthstone) with carrying slots; FINDING: signs, passive Sight, SOUNDING (seers' sonar: echoes,
    triangulation, heard by spirits), radio/compass/rod for non-seers. Still design only.
    §38.16 USER ANSWERS: murk returns about a turn after the light leaves (until cleared); 2 slots each; missions
    need far better CHARACTER graphics + animation (list in §38.16, coordinate with the user's character branch).
    §38.17 SETTLED: echoes from home are MIXED (count + rough place; a watchtower/strong seer upgrades to a full
    briefing); IRON offends the Folk (companion Nerve, standing in Folk country; salt the gentler option; milder
    fallback noted); mission mechanics start with existing figures, camera no closer. Still open: §38.9.
    §38.18 STEP 1 BUILT (not published): FREE MOVEMENT in clearings (`sim/veilmove.ts`: VeilGrid, reachField, pathTo,
    lineOfSight; `Unit.x/z` world coords, `reachOf/walkCost/moveUnit(x,z)/approachPoint/reaches/threatsAt` in haunt.ts;
    ranges are circles, BESIDE 1.6; lamps need line of sight to lure); two-ring soft overlay + path dots + ghost + threat
    rings (`render/clearing.ts` ReachOverlay); village paths pulled taut (`path.ts#tautPath`). `__game.veilHoverAt(d)`.
    Next: step 2 (the dark) per §38.15.
    §39 (not published): HOME BRUSH REMOVED (button gone; tint only under autopilot `ZoneTexture.showHome`; homeResonance
    = cells within 12 of fires and homes). OUTLINES BY KIND (`render/outlinecats.ts`: stencil category per draw via
    Object3D.onBeforeRender, mask pass in OutlinePass; `tagOutline(mat, 'glass'|'plants')`; ground yields foot lines to
    objects; graphics panel "Outlines on…" + Built only / All presets; `GfxSettings.outlineOff`; `__game.outlineShares()`).
    §39.3 OUTLINE PIXEL slider (`GfxSettings.outlinePx`, 0 = same as Pixel size): outline pass works in blocks (`uBlock`).
    §40 MISSION STEPS 2–5 BUILT (not published; `sim/veilkit.ts`): kit (tin lantern/torch with fuel, 2 slots from
    the stores, hearthstone), the dark (seen = lit now + last turn's `dusk`; unseen goes violet-dark via fog tex G +
    `uVeilDark`; senseRange 3+Sight/25), lanterns (raise/shutter/set down=pool/relight/refuel/aim; Hollow drinks; dark
    costs Nerve), signs, sounding (sound 9 / call 18, exact/circle/arc, triangulation, heard), bells, radio, salt/iron
    lines, rowan, iron vs Folk. Ruins no longer block sight into themselves. Bot plays on knowledge only;
    `scripts/clearprobe.ts` (suburbs ~50% cleared). Menus: right-click a team member. Next: packing screen, debrief,
    light pools drawn, map layouts, then §38.8 step 2 (ties with reasons).
    PUBLISHED v48 (§39 + §40) from a TEMPORARY LOCAL MERGE of origin/claude/lucid-ride-z7pvg6 (the user's character
    branch, which published v47 with workshop-dressed survivors) + this branch; the merge was NOT pushed. Any future
    publish must include the character branch the same way (or the user merges it), or it would drop their figures.
    §41 LEAF CARDS (prototype, published v49 via the same temporary merge with the character branch): broadleaf crowns as camera-facing alpha cut-out cards
    (`render/leafcards.ts`, `TreeField.setCards`, graphics panel checkbox, off by default); measured
    ~11% fewer tree triangles, +1 draw call (`scripts/shots/cardsperf.mjs`). §41.1 (published v50, temporary merge with character branch 354f921): PINES as hybrid tiers
    (slimmer solid cone + bough cards, `needleCardGeometry`), GRASS CARDS (upright, `setGrassCards`, own checkbox), SHADOW FIX
    (cards need `shadowSide = DoubleSide`; v49 leaf cards cast almost no shadow) + shadow-pass push (`PUSH`). `cardlook.mjs`.
    §41.2 FIX (published v51, temporary merge with character branch 84584c2): see-through woods work with cards (card materials keep `thin`, card shadows discard).
    §42 CARDS EVERYWHERE + LEAFY AUTUMN (user's direction after v51; plan in §42.1: crops/bunting/hedges/ivy/reeds/flowers as
    cards, grass placement, autumn piles/raking/roads). BUILT §42.2 (published v52, temporary merge with character branch b3a7cbf): leaf cards DEFAULT (`GfxSettings.v`
    migration), NO GRASS ON FIELDS (fog tex B = 128 on field tiles, grass vertex collapses), stronger autumn yellow, FALLING
    LEAVES (`render/leaffall.ts`, `seasonLook().leafFall`), LEAF LITTER (`LitterTexture`, `uLitter`, `seasonLook().litter`).
    §42.3 CROPS AS CARDS (not published): `render/land.ts` shoot/stalk/ear upright cards (kinds in `leafcards.ts`), 6/tile.
    §42.4 WINDMILL ENLARGED (user: tallest in town, 2–3 storeys, big sails): tower 7.2, arms 4.3, reefing stage.
    `__game.finishProjects()`; `cardlook.mjs` KIND=field SIM=days.
    §42.5 FIXES (not published): litter brown at the thaw (`litterAge`/`uLitterAge`), gone in ~2 spring days; fields refuse plots/
    buildings (`fieldBlock`, `fieldKeepOut`), soil only on field tiles, bushes grubbed up by fields. §42.6 CLEAR ZONE (`Zone.Clear`=7,
    brush "Clear"; `pickClearGround` fells unprotected trees there regardless of wood need; not on the Wild). `tests/ground.test.ts`.
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
