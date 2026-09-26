# Survive Story

A post-collapse community sim with tactical expeditions. The world after the
Quiet is verdant and strange: vines on the gas pumps, deer on the highway,
wisps in the treeline, and lights in the sky that nobody agrees about.

Browser game: TypeScript + Three.js, rotatable isometric (orthographic) 3D.

## Run

```sh
npm install
npm run dev        # local dev server
npm test           # simulation unit tests
npm run sim        # headless balance probe: npm run sim -- 20 10  (colonies, days)
npm run build      # production build to dist/
npm run build:single  # one self-contained HTML file in dist-single/
```

## Controls

- Click a survivor or their card: select · F: follow selected · Esc: deselect
- Drag: pan · Right-drag / Ctrl-drag / Q,E: rotate · Wheel / pinch: zoom
- WASD / arrows: pan · Space: pause · 1/2/3: speed · L: toggle names
- Zones (bottom bar): Home, Field, Woodlot, Sacred, Erase. Click and drag to paint; Esc to stop
- R: look inside (roofs shown → hidden → walls cut away); hidden people show as silhouettes
- V: Veil view (Resonance on the land) · Calm and Omen in the Veil panel · the council banner opens proposals

## How the colony works

Time runs continuously (pause, 1×, 3×, 8×). Each survivor has needs (food,
rest, company), a role you assign, and decides their own tasks:

- **Builder** fells trees nearest home and hauls logs to the stockpile.
- **Forager** picks berry bushes and carries food home.
- **Scout** walks to the edge of the explored map, pushing back the fog.
- **Tender** keeps the fire and keeps people company.
- **Attuner** sits with the wisps at the Ring and gathers glimmer.
- Evenings pull everyone to the fire to talk (bonds form); nights, to bed.

## The village

The home zone starts as the clearing around the fire; paint it bigger or
smaller and the survivors plan inside it. They decide what to build, where,
and in what order (by need and by personality), then fell trees on the site,
salvage scrap from wrecks and junk heaps, carry materials over, and build in
stages.

- They move into the old store first: clear it out (4 beds), patch the
  roof (6 beds), add a lean-to (8 beds).
- Then a canopy kitchen, gardens (tended by foragers, yield food daily), a
  workbench, shacks as newcomers arrive, and wisp lanterns (glimmer).
- Salvage era → timber era: once they have a workshop, enough finished
  projects and a week or so of practice, new buildings are timber and the
  old shacks get rebuilt.
- Newcomers arrive when morale is good and there is (or soon will be) room.

## The year

Four seasons of twelve days. Spring: till and sow the fields you mark.
Summer: tend, long days. Autumn: harvest, colour, stock the woodpile and the
cellars. Winter: snow, no foraging, firewood for heat, and whatever you
stored. The Village panel shows winter readiness (food, firewood, beds).
Paths wear into the grass where people walk and become lanes; new buildings
face them. Woodlots are cut and replanted; sacred ground is never touched.

## The Veil

A layer of reality only some can perceive. **Resonance** (how thin the Veil
is) lives in the land: nature raises it, felling and suffering lower it.
**Sight** lives in each survivor. Phenomena (the White Stag, the Lantern Man,
the Moth Woman, the Orb, shades, Hollows) are read differently by each
witness: a chill, a figure of light, or an entity that speaks. You are a
presence they half-sense; your **Influence** grows with their Sight and pays
for nudges. Every few days **the council** meets; back one voice.

See `DESIGN.md` for the full design and roadmap.

## Layout

- `src/sim/` — deterministic simulation, no rendering.
  - `worldgen.ts` 256×256 procedural region: biomes, roads, ruins, ponds,
    trees, berry bushes, the fairy ring. `world.ts` grid + fog of war.
  - `colony.ts` agents, needs, task selection and execution, hourly and
    daily rhythms. `path.ts` A* pathfinding.
  - `community.ts` survivors, traits, psi, bonds, morale, permadeath grief.
  - `buildings.ts` buildings, projects, the planner and site selection.
  - `calendar.ts` seasons, daylight, weather, seasonal look.
  - `veil.ts` Resonance, Sight, phenomena, Influence. `council.ts` proposals and nudges.
- `src/render/` — Three.js: terrain + fog-of-war shader, chunked trees and
  grass, station and vines, ruins, deer, wisps, the Orb, animated people,
  camp/stockpile/memorials, buildings in stages and salvage heaps
  (`village.ts`), sky and day cycle.
- `src/ui/` — HUD overlay.
- `tests/` — Vitest suites (world generation, pathing, colony, community).
- `scripts/simulate.ts` — runs whole colonies headlessly for balancing.
