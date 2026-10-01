# Survive Story: Design

A living design document. It records what the game is, what has been decided,
and what is planned. Update it when decisions change.

Status markers: **[built]** exists in the game now · **[next]** the milestone
being worked on · **[planned]** agreed, not started · **[open]** undecided.

---

## 1. Vision

A community sim set in the quiet after the collapse. The world is overgrown,
verdant and strange: vines on the gas pumps, deer on the highway, wisps in the
treeline, and lights in the sky that nobody agrees about. Human consciousness
technology has partly returned, so some people carry limited psi, and a layer
of reality exists that only some can perceive.

The player invests in **people**, not units. The village grows by its own
design; the player shapes the conditions and intentions.

**Inspirations.** Town: *Banished*, *Manor Lords*. Characters and stories:
*Wildermyth*, *RimWorld*. Frontier: *XCOM* (later, and sparingly).
Look: *Tiny Glade*.

### Pillars

1. **Home is safe.** No raids or sieges. Pressure at home comes from seasons,
   scarcity, relationships and the state of the Veil.
2. **They decide; you intend.** Survivors choose their own tasks and design
   their village. You act through zones, priorities, council choices and
   subtle nudges.
3. **The frontier holds risk and wonder.** Danger, strangeness, loot and
   stories live out on expeditions. Death is rare, permanent and meaningful.
4. **A spiritually rich society is a strong society.** Care for the land and
   the people thins the Veil, and that is also how the player gains power.
5. **Quiet, curious, occasionally uncanny.** Solarpunk, eerie, hopeful. Not
   constant fear.

---

## 2. The player

**The player is a presence the community half-senses.** **[built: C2]**

- The player exists on the far side of the Veil. The community does not know
  what the player is: a spirit, the Orb, the land itself, their own better
  nature. Different survivors will have different theories.
- **Influence** is the player's currency. It grows with the community's
  collective **Sight** (see §4). A more attuned village senses the player more
  clearly, so nudges carry further.
- Nudges (spend Influence):
  - send a dream that tips a council vote
  - an omen that steers a scouting party
  - calm a grieving or frightened person
  - light a path through the mist; reveal a hidden phenomenon to a witness
- Direct tools that don't cost Influence: zones, role assignment, speed and
  camera. These are framed as the community's own planning, nudged by you.
- **Seeing through their eyes:** select a survivor to render the world
  through their perception (§4).

---

## 3. Core loop

Explore → discover (land, people, knowledge) → decide (zones, council,
expeditions) → the village grows by its own design → the season tests your
preparation → stories come out of it.

Time runs continuously (pause, 1×, 3×, 8×). **[built]**

---

## 4. The Veil (Sight, Resonance, Glimmer)

The game's signature system. **[built: C2]**

| Quantity | Scope | What it is | Rises with | Falls with |
|---|---|---|---|---|
| **Sight** | per survivor (0–100) | How much of the hidden layer they perceive | time at the Ring, living near lanterns, rituals, psi use, traits (Orb-Touched), certain experiences | trauma, exhaustion, grief (temporary) |
| **Resonance** | per map region (a field over the tiles) | How thin the Veil is here | undisturbed nature, sacred ground, replanting, tended graves, festivals, a harmonious community | heavy felling, salvage scarring, hunger, conflict, death and suffering |
| **Glimmer** | stored resource | What can be gathered and spent | gathering where Resonance is high (attuners at the Ring) **[built]** | spending: lanterns **[built]**, psi, rituals |

### The perception gradient

Every phenomenon has a **depth**. How a survivor experiences it depends on
`Sight + local Resonance − depth`:

| Reading | Experience | Typical reaction |
|---|---|---|
| Well below | Nothing, or a cold spot, dread, a sound | Low-Sight or Skittish survivors are spooked (morale hit) |
| Near | A luminous form: a wisp, a figure of light | Awe or fear, depending on traits |
| Above | A coherent entity with intent | It can communicate, ask for something, trade, teach psi |

- The same event yields different testimony from different witnesses. The log
  records it that way: "Kit saw nothing. Wren saw a woman made of moths."
- Believers and skeptics form. High-Sight people can be sought out or dismissed.
- **Low Resonance:** wisps leave, glimmer dries up, phenomena turn sorrowful or
  hostile (hauntings, not raids).
- **High Resonance:** blessings (gardens thrive, healing, visions), entities
  who help.
- **Balance guard:** the village still needs wood and scrap. Careful practice
  (woodlot rotation, replanting, a ritual of thanks) softens the damage, and
  Resonance recovers over time. The design goal is a tradeoff, not a ban.

### Rendering the Veil

- Phenomena are drawn according to the best-perceiving witness nearby.
- **Seeing through their eyes:** with a survivor selected, the spirit layer
  (teal and violet) fades in or out to match their Sight.

---

## 5. Seasons and the year **[built: C1]**

- **Long years.** 4 seasons × 12 days = 48 days per year. The player should
  get to know people across years; aging, children and mentorship depend on it.
- Spring: sowing, blossom, rain. Summer: growth, long days. Autumn: harvest,
  preserving, autumn colour. Winter: snow, no foraging, fields dormant.
- **Winter is the yearly test:** stored food, firewood and warm beds.
  Unprepared villages suffer cold, hunger, illness, and people leaving. It is
  never a raid.
- Weather: rain (slows work, fills gardens), fog (Veil thins), snow, clear
  cold nights.
- Festivals mark the calendar (council-chosen; see §8). Midwinter is when the
  Veil is thinnest.
- Visual change: grass and tree colour through the year, blossom, falling
  leaves, snow cover, shorter winter days.

Day length and speed will need tuning once seasons exist: at 8× a day is about
1.5 minutes, so a year is about 70 minutes.

---

## 6. Land: zones, paths and organic growth

### Zones (player-drawn)

| Zone | Purpose | Tradeoff | Status |
|---|---|---|---|
| **Home** | Where the village may build | — | **[built]** paint/erase |
| **Woodlot** | Sustainable felling; saplings replanted and regrow | Clearing near the Ring or sacred ground lowers Resonance (C2) | **[built]** |
| **Fields** | Sow, tend, harvest by season | Labour; soil quality varies (meadow good, forest poor) | **[built]** |
| **Sacred ground** | No cutting or building; wisps gather (C2) | Costs usable land | **[built]** (effects in C2) |
| Salvage | Mark ruins/roads to strip | Distance, scarring, unstable sites | [planned] |
| Explore target | Where scouts and parties go | — | [planned] |

Today builders fell trees nearest home automatically **[built]**. Once
woodlots exist, felling outside them will be rare and costly to Resonance.

### Desire paths → lanes → streets **[built]**

- Every footstep wears the ground a little. Frequently walked tiles become
  **desire paths** (visibly worn grass), then **lanes** (packed earth, faster
  walking).
- The site planner prefers building frontages along lanes, so the village's
  shape follows how people actually move.
- Unused paths slowly grow back.
- This is the *Manor Lords* organic-growth idea, driven by the people instead
  of drawn roads.

---

## 7. The village [built, expanding]

- Starts at the gas station. They move into the store first: clear it (4
  beds), patch the roof (6), add a lean-to (8).
- The planner chooses what the community needs next (shelter, kitchen, garden,
  workshop, lanterns, rebuilds), nudged by personality, and sites buildings in
  the home zone with doors facing the fire.
- Construction: clear site trees → salvage scrap from wrecks and junk heaps →
  carry materials → build in stages. Idle people help.
- **Know-how, not eras** (C2.5): everything starts as salvage. Timber
  building needs someone who knows joinery and a workbench. Joinery is
  learned by building and practising, fastest beside someone who knows it;
  a former carpenter arrives knowing it. If everyone who knows it dies or
  leaves, it is lost. Old shacks are rebuilt in timber once it is known.
- Newcomers arrive when morale is good and there is room.

Planned additions: storehouse and root cellar (winter stores), smokehouse,
woodshed, well, houses for families, shrine and grove (Resonance), school
(mentorship), watchtower, workshop upgrades, salvaged solar and wind.
Buildings should frame lanes and shared spaces.

---

## 8. Council proposals **[built: C2]**

- Every few days the council brings two or three proposals, each voiced by a
  named survivor who wants it: "Quill wants a smokehouse before winter." /
  "Ada wants a watchtower on the ridge." / "Wren wants a shrine at the Ring."
- The player backs one, optionally spending Influence to send a dream in its
  favour.
- Proposers who were passed over remember it; those backed gain standing.
- This keeps the design theirs and the direction the player's.
- Festivals and rituals are also chosen this way.

---

## 9. People

**[built]**
- Stats (grit, wits, aim, empathy, attunement), traits, rare psi abilities.
- Roles: builder, forager, scout, tender, attuner, resting.
- Needs: food, rest, company.
- Relationships grow or sour through shared work and fireside conversation.
- Memories. Permadeath; grief spreads along bonds; memorial stones.

**[planned]**
- **Sight** stat (§4).
- **Skills that grow by doing:** a builder who has raised ten cabins is
  better and faster.
- **Aging, couples, children, generations.** Children learn from mentors, so
  the player's investment compounds across years.
- **Personal arcs** from memories and events (*Wildermyth*-style), such as
  scars, changed traits and callings.
- **Soft failure:** people leave if morale stays low.

---

## 10. Events [planned]

Rare, meaningful dilemmas, with outcomes written into memories and
relationships. Examples:

- A stranger carrying a feverish child, while medicine is low.
- The wisps have stopped coming to the Ring since the woodlot grew.
- Lights over the north ridge three nights running.

---

## 11. Expeditions [planned: milestone D]

- Choose party, supplies, and destination.
- Travel reveals the map. Parties return when they find something notable or
  run low.
- Ruins hold **blueprints**, so discovery drives the tech progression.
- Encounters play out as story events with choices. A turn-based tactical
  layer can plug in later, where it fits a story.
- Entity encounters depend on the party's Sight.

---

## 12. Long arc [open]

The mystery of the Quiet: the Orb, the lights, glimmer, psi, the Ring.
Chapters unlock through discovery and attunement, which gives the campaign a
direction and possibly an ending. The player's own nature is part of the
mystery.

---

## 13. Art direction

**Reference: *Tiny Glade*, pushed toward solarpunk, eerie but hopeful.**

- Warm key light, soft sky fill, strong ambient occlusion, gentle mist and
  colour grading, mild tilt-shift depth of field.
- Buildings assembled from detailed, varied parts (bevelled stones, planks,
  shingles, salvaged tin) that adapt to where they stand.
- Lush grass, moss, flower edges, ivy. Salvaged solar panels and wind vanes on
  roofs.
- The spirit layer in teal and violet over a warm village.
- Seasons as a visual engine: blossom, gold, snow.

### Rendering without a global-illumination engine

*Tiny Glade* computes real bounced light. We approximate it:

| Technique | Imitates | Cost |
|---|---|---|
| Hemisphere sky light + warm ground bounce | Most of outdoor GI (sky fill) | Negligible |
| Screen-space ambient occlusion (GTAO) | Contact shadows, corners, depth | Medium |
| Baked per-vertex AO on generated buildings | Crevice darkening | Free at runtime |
| Soft shadows, a slightly warm shadow tint | The soft penumbra look | Low–medium |
| Height fog and aerial perspective | Depth and atmosphere | Low |
| Colour grading (look-up table) and bloom | Cohesive warm palette | Low |
| Emissive windows, lanterns and fires with local light | Interior glow | Low |
| Screen-space GI on the newer WebGPU renderer | Real colour bleeding | High; experimental, needs verification |

Outdoors, seen from above, most of what GI contributes is sky light plus
occlusion, so these approximations close most of the gap. The remaining gap is
colour bleeding between surfaces and interiors, which matter little from this
camera.

---

## 14. Technical architecture [built]

- TypeScript + Three.js, built with Vite, runs in the browser. Single-file
  build for sharing.
- `src/sim/` is a deterministic, seeded simulation with no rendering. It is
  unit-tested and balance-probed headlessly (`npm run sim`).
- `src/render/` draws the simulation state. `src/ui/` is the HUD.
- 256×256 tile world, fog of war as a shader texture, chunked instancing for
  trees and grass.

---

## 15. Roadmap

| Milestone | Contents | Status |
|---|---|---|
| A: Living world | Procedural region, autonomous survivors, needs, roles, fog of war | **[built]** |
| B: Village | Home zone, store-first, planner, construction, salvage → timber, newcomers | **[built]** |
| C1: The Living Year | Calendar and seasons (48-day year), weather, seasonal visuals, woodlots with replanting, fields, sacred ground, winter needs (firewood, stores, warmth), desire paths → lanes, lane-aware siting | **[built]** |
| C2: The Veil | Resonance field, Sight, phenomena on the perception gradient, see-through-their-eyes, council proposals, Influence and nudges | **[built]** |
| **C2.5: Homes and purpose** | Households, petitions for homes, burgage plots and procedural houses, yards, the old shelter becomes a hall, know-how replaces eras, aspirations and leisure, the Veil given mechanical stakes and lore, five starting sites (see §17). | **[built]** |
| C3: Art pass | Lighting (GTAO, grading, fog, depth of field), procedural building parts, flowers and moss, character-model trial | [after C2.5] |
| D: Expeditions | Parties, ruins, blueprints, entity encounters, tactical hook | [reshaped by §19: clearing haunted districts] |
| F: The Folk | A second society of the Veil: mounds, Folk paths, the Wild, Standing, working alongside (§19) | [proposed] |
| E: Generations | Skills by doing, aging, families, children, mentorship, personal arcs | [planned] |

### C2 as built

- **Resonance** is a 64×64 field (4 tiles per cell). Baseline: forest 0.72,
  water 0.66, meadow 0.6, grass 0.5, concrete 0.25, asphalt 0.22, plus a
  bonus falling off around the Ring. It drifts 5%/day toward baseline plus
  sacred ground (+0.3), shrines (+0.22, radius 3 cells) and lanterns.
  Thinned by felling (0.012 in woodlots, 0.03 elsewhere, doubled within 14
  tiles of the Ring), salvage (0.015), quarrels, cold nights, rationing and
  deaths (0.2 over the home area). Restored by planting, good company,
  festivals and offerings.
- **Sight** starts from attunement ×7, Orb-Touched +15, psi +10, plus
  chance. Grows while attuning at the Ring, dreaming, and living in rich
  places; exhaustion and grief dim it. Shown on each survivor's card.
- **Phenomena**: the Choir (Ring), the White Stag, shades (after a death),
  the Lantern Man (points toward an undiscovered place, asks for glimmer),
  the Moth Woman (asks for her grove to be kept), the Orb (rare; raises
  Sight and Influence), and Hollows when home resonance falls below 0.3.
  Reading = Sight + resonance×40 (+10 Orb-Touched) − depth: < −10 nothing,
  < 10 a chill, < 35 luminous, else coherent. Things appear at the edge of
  where people are, mostly from dusk. Up to two individual accounts per
  event; the rest become testimony.
- **Influence** grows with collective Sight. Nudges: Calm (10), Omen (12),
  Dream at council (15).
- **Council** every four days: proposals from builds (cellar, house, shrine,
  lantern, workbench), seasonal festivals, rest day, letting the Ring grow
  wild, opening/closing the gates, and entity requests. Each survivor backs
  one voice (bond + temperament). Backers gain, passed-over proposers lose
  a little morale unless you send a dream. Silence: majority decides in a day.
- **Seeing through their eyes**: selecting a survivor renders phenomena as
  that survivor perceives them, tints the view by their Sight, and fades in
  the Veil view (V toggles it fully).

Year probe with C2: no deaths or departures in either scenario, ~9 councils
a year, mean Sight ~40 by year's end, home resonance ~0.5 under normal play.

### C1 results

Headless probe (`npm run sim -- 8 48` and `--prepared`), first full year:

| | Unprepared (no zones) | Prepared (2 fields + woodlot on day 1) |
|---|---|---|
| Deaths / departures | 0 / 0 | 0 / 0 |
| Food at start of winter | ~280 | ~490 |
| Food at end of winter | ~50 (half rations, scrounging) | ~200 |
| Cold nights | 0 | 0 |

Neglect means a hungry, low-morale late winter on half rations; preparation
means a comfortable one. Firewood is handled well by the village on its own
(woodpile targets rise from late summer).

Implementation notes and deviations:
- Gardens are small kitchen plots (2–3 food/day in summer and autumn); fields
  are the staple. Berry bushes fruit spring (young greens, reduced) to autumn.
- Surplus food above cellar capacity spoils; the planner digs root cellars
  before winter and adds more when stores fill.
- When stores run low everyone forages; in winter, meals are halved and
  foragers and farmers ice-fish or scrounge. Starvation is slow (days), so
  hardship precedes death.
- Newcomers pause in winter and take the most short-handed role.

### C1 acceptance criteria

- A year has four seasons; the HUD shows season and day; visuals change with
  the season.
- Fields can be zoned, sown, tended and harvested by season; winter halts
  growth and foraging.
- Woodlots are felled and replanted; felling outside them is rare.
- Sacred ground blocks cutting and building.
- Winter consumes firewood and stores; an unprepared village visibly suffers,
  and a prepared one does not.
- Frequently walked tiles become paths, then lanes; new buildings favour lane
  frontage.
- Headless probe: typical colonies survive their first winter with effort;
  neglecting preparation causes hardship but rarely death.

---

## 16. Glossary

- **Sight:** a survivor's perception of the hidden layer.
- **Resonance:** how thin the Veil is at a place.
- **Glimmer:** the gatherable, spendable substance of the Veil.
- **Influence:** the player's power to nudge, grown from the community's Sight.
- **The Ring:** the fairy ring near the station, where wisps gather.
- **The Orb:** the silent light that relocates over the treeline.
- **The Quiet:** the collapse, and the stillness after it.

---

## 17. Playtest feedback, round 1 (Year 1, spring to early summer)

What the player saw, and what we propose in response. Items marked
**[done]** shipped in the same round.

**Readability**
- People looked translucent, with limbs ghosting through their own bodies.
  → Silhouettes show only where the *world* hides someone; bodies are drawn
  solid afterwards. **[done]**
- Zones were hard to tell apart. → Outlines always; while a zone tool is
  selected, every zone is shaded and hatched in its colour. **[done]**
- The "hidden" roof mode was useless. → Roofs: shown / cutaway only. **[done]**
- Buildings were opaque in meaning. → Click a building for a card: what it
  is, what it does, who sleeps there, build status. **[done]**

**"Eras" are the wrong idea.** Everything is salvage; what changes is what
is *around* you and what people *know*. Replace the global era with:
- *Know-how* the community learns by doing (joinery, masonry, glazing, solar
  repair), taught person to person. If the teacher dies, the skill is lost.
- *Local materials*: what can be built depends on what the region offers
  (a quarry, a mall's glass, a pylon's cable, a reservoir's pipe).

**Housing and households.**
- Sleeping in a crowd is tolerated, not wanted. There is a crowding penalty
  above about 4 per room, and privacy becomes a need once the early crisis passes.
- Close bonds pair up into *households* (couples, siblings, friends). A
  household with no home *petitions the council* for one, and the petition
  names its builders and a site.
- Homes are sized to the household (2–4 beds, never "critically small"), and
  people move in when a home suits them.
- Once most people have homes, the founding structure is *repurposed* into a
  commons hall, communal kitchen or workshop, chosen by council.

**Procedural starting sites.** The first shelter varies: gas station,
chapel, school, greenhouse, motel, barn, railway depot. Each has its own
repair path and its own later communal use.

**Summer idling: people need wants beyond needs.**
- *Aspirations* per person (build a proper home, learn a craft, map the
  river, raise a child, understand the lights) drive discretionary work.
- *Crafts and projects*: pottery, weaving, furniture, preserves, instruments,
  murals. They yield comfort, trade goods and memories.
- *Summer as the season of ambition*: expeditions, big builds, festivals.
  Winter is for survival and stories.

**The Veil needs stakes.** Currently phenomena appear and nothing follows.
Proposal:
- Resonance *modifies the world*: crop yields, healing speed, wisp-lit
  nights, fertility of groves. Low resonance brings blight, bad dreams and
  shades that linger.
- Entities *want things* and give things: a stag leads a scout to a lost
  cache; the choir teaches a song that calms grief; the lantern-man asks for
  a light left burning, and ignoring him has costs.
- Sight *grows* with exposure, and psi abilities scale with it (a Hush who
  can calm a panicked expedition, a Finder who senses salvage).
- A *lore arc*: what the Quiet was, what the orbs are, why the Veil thinned.
  It is revealed in fragments through testimony, ruins and entity encounters.

### Round 1: what was built (C2.5)

- **Households.** Pairs with a bond of 35 or more set up house together;
  people alone for 12 days set up on their own; close friends can join a
  household. Households petition the council ("A home for Mako and
  Amara") and start anyway after 8 days of waiting. At most two homes are
  under construction at once, with a site crew of 3 plus the household.
- **Plots.** Irregular quadrilaterals (frontage 7–9, depth 10–15, taper
  and skew), fronting lanes and roads (the road's direction comes from a
  principal-axis fit to nearby worn or paved tiles), the green around the
  fire, or continuing a neighbour's row with a slight bend. People living
  alone get compact plots. No room left → log asks the player for more
  Home zone. The starting Home zone is radius 26.
- **Houses.** A spec per plot: width, depth, eaves height, ridge along or
  across the street, pitch, optional wing (L-plan), porch, chimney side.
  Salvage houses: mismatched panels, tin roof with patches. Timber: frame
  and daub, braces, thatch or shingle, window boxes. Furnished interior
  (beds, table, stools, hearth, shelf, chest, rug) visible in cutaway.
- **Home life.** Suppers at home (or in the hall for sociable people),
  some evenings in or on the bench, bonding within the household. Home
  comfort +3 to +7 morale; shared rooms of more than 4 sleepers cost up
  to −4; waiting for a house −2.
- **Yards.** Planned per plot and ordered by the household's traits: veg
  beds (food in summer and autumn), woodpile, wattle fence (built a stretch
  at a time), bench, fruit tree (autumn food once grown), flowers
  (resonance), washing line, hen coop (eggs), shed.
- **Commons hall.** Council proposal once half the village is housed: the
  store gets a long table and stove; supper and bad-weather evenings there.
- **Aspirations.** Home, kin, craft (joinery), garden, explore, veil
  (meet an entity), feast. Pursued in free time; fulfilled: +12 morale and
  a memory, then a pause of 5–11 days before a new one.
- **Leisure.** Fishing at the pond, picking herbs in the meadow (a little
  medicine), cards by the fire or in the hall. Summer daytime idling went
  from about 50% to about 1%.
- **Veil stakes.** Resonance scales crop growth, berry regrowth and yard
  yields (×0.75 to ×1.25) and healing (×0.5 to ×1.5). Below 0.3: thin
  sleep and blight. Boons: the Stag heals and leads to watercress, the
  Choir eases grief, the Lantern Man's offering yields a cache, and keeping
  the Moth Woman's grove blesses growth for 24 days. Psi abilities work
  once Sight ≥ 40 (Lumen heals, Hush eases grief, Farsight reveals the map,
  Echo reads lore from ruins, Push speeds building).
- **Lore.** Twelve fragments about the Quiet, the Listeners, the orbs and
  the Relay Station, learned one at a time (at most one every 6 days) from
  entities and Echo. Shown in the Veil panel.

**Open issues after round 1:** morale (~80) and food (~470 at year end)
run high, so the game may be too easy; Influence saturates at 100;
procedural starting sites are still to do; houses are many meshes each, so
performance on weak GPUs needs watching.

### Starting sites (C2.5, round 2)

Each map starts at one found structure, chosen by the seed (`?site=` in the
URL overrides it for testing). Definitions live in `src/sim/sites.ts`; the
gas station renders from `render/station.ts`, the rest from
`render/sites.ts`.

| Site | Shelter | Repairs (beds) | Becomes | Advantage |
|---|---|---|---|---|
| Crossroads Station | the old store | clear (4), patch roof (6) | the commons hall | scrap in wrecks around it |
| Wayside Chapel | the chapel (bellcote, graveyard) | clear (4), mend roof (6) | the meeting house | graveyard is sacred ground; candles give glimmer |
| Wayfarer Motel | the motel row (office, drained pool, sign) | clear rooms (6), roof end room (8) | the motel lodge | more beds early |
| Aldermoor Farm | the barn (silo, burnt farmhouse) | muck out (4), re-roof end (6) | the barn hall | a field already marked; seed potatoes (+10 food) |
| The Glasshouses | the glasshouse (potting shed, nursery benches) | clear (4), reglaze (6) | the winter garden | old beds yield +1.5 food a day, spring to autumn; costs more firewood |

In a one-year probe (6 colonies each), all five sites finished the year with
no deaths, hunger or cold nights, and a similar number of homes (5.8–6.5).

### Balance pass 1 (after C2.5)

Measured with `npm run balance -- 8 48 [--prepared]` (a food ledger by
source, morale by season, Influence, winter hardship).

| | Before | After |
|---|---|---|
| Forage, food per colony-year | ~800 (≈ all that was eaten) | ~480 |
| No fields marked: food at winter | 420–600, never rationed | 75–400; 4–12 ration days in most; 1 hunger death in 8 |
| Two fields marked: food at winter | 430–680 | 390–590, no rationing |
| Mean morale, spring → winter | 67 → 79 (rising) | 67 → 67–72 |
| Influence hits 100 | day 26–43, every run | rarely; ends the year at 45–75 |
| Population 10 reached | day ~15, cap 14 by year end | day 17–33; ends at 8–14 |

Changes: forage yield ×0.5–0.7 and regrowth 5 → 7 days; fishing 2 → 1 food;
kitchen +3 → +2, lanterns +3 → +1.5 max, friends cap 6 → 4, needs weight
0.3 → 0.25, winter −2 → −5, home comfort 3–7 → 2–5, hall +1.5 → +1;
Influence grows with √(total Sight) instead of linearly, the Orb gives +8
instead of +15; arrivals 30% → 18% a day (40% with open gates) and need 6
days of food per person.

Bugs found by the ledger and fixed: (1) someone standing on a tile that
was later built over (or a doorstep on a wall tile) could find no path
anywhere and starved beside full stores; (2) people woken by hunger at
night went straight back to sleep (sleep was checked before food, and the
night interrupt cancelled meals). Regression test: nobody reaches zero
food while the stores hold 3+ days for everyone.

### Fishing grounds (after balance pass 1)

User asked for a fishing zone with docks and huts as a food source.

- **Fishing zone** (5th zone): painted on a pond's shore or shallows,
  anywhere explored (ponds lie 40–75 tiles out: the first outpost).
- **Fishery**, one per marked pond, built in order: plank jetty (4 tiles
  over the water, walkable decking) → fishing hut with drying racks
  (smokehouse in timber; +50 food storage because smoked fish keeps) →
  net shed → rowing boat (needs joinery).
- **Fisher role.** When the hut is finished, someone volunteers if nobody
  fishes. Fishers walk out at dawn, fish from the jetty end (or the boat,
  ×1.3), eat smoked fish by the hut, and carry the catch home at 16:30. In
  heavy rain they mend nets in the shed.
- **Catch**: 0.65 food/hour × (stock/max)^0.7 × season (spring and autumn
  1.15, summer 1, winter 0.45 through the ice) × net-mending (1.5 with a
  shed) × boat × work rate. That's about 6 food a day in season and 3–4.5 in
  winter.
- **Stocks**: max = 20 + 0.6 × pond tiles (up to 220), logistic regrowth
  12%/day. One fisher holds a pond at about 60–75%; three fishers push it
  to 20–35% (the log warns and the Veil thins there) for 1.45× the food.
- **Net-mending**: know-how, learned on the water (faster beside someone
  who knows it) and in the net shed; a former deckhand arrives knowing it.
- **Veil**: *the lights under the water* appear at night off the jetty
  (Resonance ≥ 0.4). Truly seen, they drive fish to the jetty (+25% stock)
  and may give a fragment of lore.


### Performance pass 1 (after fishing)
Measured with `__game.probeRender()` on seed 8 after 40 days, same build,
with and without `?nomerge`:

| | `?nomerge` | merged | change |
|---|---|---|---|
| Draw calls, full frame | 3,130 | 842 | −73% |
| Draw calls, no shadow pass | 1,565 | 444 | −72% |
| Triangles | ~1.8M | ~1.8M | unchanged |

- **Static merging** (`render/merge.ts`). A finished building's boxes are
  baked into one mesh per material. Plain Lambert surfaces share one
  vertex-coloured material per (enhance options, cutaway) pair. Roofs merge
  into a separate `roofGroup`, so the cutaway can still lift them. Window
  glow, cloth, hens and lantern halos stay separate (`userData.keep`), and
  `noCut` exempts tall outdoor pieces from the cutaway.
  - Applied to houses, yards, the starting site, the store interior, deer
    parts and people's heads.
  - Village buildings went from about 1,480 calls to 65, and yards from
    about 670 to 36.
- **Lights.** The campfire's point-light shadow re-renders every 6th frame,
  and candles no longer cast shadows.
- **Trees.** At most 6 fall animations run at once.
- **Largest remaining cost.** People, at about 310–360 calls across the
  x-ray, figure and shadow passes; instancing them is the next step if
  needed. Simulation takes about 0.3–0.6 ms per frame.

### Graphics pass 1 (after performance pass 1)
- **Trees no longer grow through buildings** (`render/clearance.ts`).
  - Every building, finished or planned, is an oriented box up to its
    ridge, with eaves. The boxes come from the simulation's plans, so
    canopies make room before the walls go up.
  - A leaf clump that reaches into a box is shrunk (down to 55%), slid
    outward, or dropped.
  - Builders also fell unprotected trees whose trunks stand within about
    1 tile of a planned wall.
  - Measured with `__game.clearance()` over days 10–40:

    | Map | Clumps inside buildings, before | After |
    |---|---|---|
    | seed 8 | 5–25 | 0 |
    | chapel, seed 3 | 7–45 | 0 |
    | farm, seed 5 | 13–38 | 0 |

  - `?noclear` turns clearance off for comparison.
- **Canopies**: leaf clumps are lumpy rather than spherical, flatter
  underneath, and self-shaded (darker under, lighter crown, via `enhance`'s
  `shade` option). The shading applies after the season colour, so it holds
  in autumn and snow. Bushes are shaded the same way.
- **Contact shade**: merged building, yard and site surfaces darken towards
  the ground they stand on. This is baked into vertex colours, so it costs
  nothing at runtime.
- **House skirts**: moss, long grass and seasonal flowers along the foot of
  every finished house, clear of the door and porch.
- **Colour grade**: a final display-space pass with teal shadows and warm
  highlights (less warmth at night), saturation ×1.08, a slight S-curve and
  a soft vignette. `?nograde` turns it off.
- **Cost**: draw calls are unchanged (about 520 on seed 8), because the new
  meshes merge.

### Buildings on slopes (after graphics pass 1)
The user rejected flattening terrain under buildings, so buildings adapt to
the ground instead:
- **Floor height.** A building's floor rises to within 0.2 of the highest
  ground under it, so the uphill wall is never buried. This is a pure
  function of the terrain (`houseFloor`, `footFloor`), so sim and renderer
  agree without storing it.
- **Foundation.** A stone foundation (timber cribbing for salvage houses),
  built in courses, follows the ground along every outside wall, so the
  downhill side shows a tall base and the uphill side a low one. Porch
  posts reach the ground on stone pads.
  - When the ground in front of the door falls more than 0.2, timber steps
    run down to it.
  - Bases over 1 m get a small undercroft door.
  - Huts, workshops and fishing huts stand on the same kind of foundation.
- **Indoors.** Floors are marked as deck tiles at floor height, so people
  inside stand on the floor, not the hillside beneath.
- **Site choice.** Survivors reject plots where the base would exceed 1.5 m
  (1.2 m for footprint buildings) and prefer gentler ground.
  - Over 10 seeds at day 30 (36 homes), the largest drop went from 3.05 m
    to 1.48 m; the median is 0.28 m.

### Trees v2 (after buildings on slopes)
- **Oaks**: a short trunk with a root flare, 3–4 limbs splaying out at
  30–55° from the top, each ending in a leaf clump, plus a crown clump. The
  result is a broad, spreading silhouette. 2.5% are dead snags: bare, grey,
  crooked limbs.
- **Birches**: tall and slim, with 3–4 long ovoid clumps that overlap and
  wander around the stem; the lower ones hang from short limbs.
- **Pines**: 4–5 tiers. Each tier is a 12-sided cone whose rim alternates
  drooping points and notches, so tiers read as layered boughs.
- **Winter**: leaf clumps shrink, so the new limbs give bare trees a
  branching silhouette.
- **Cost**: limbs reuse the trunk geometry and its instanced mesh, so draw
  calls are unchanged. Triangles rise by up to about 35% in forest-heavy
  views (1.8M → 2.45M), with more leaf clumps per oak. If that proves costly
  on the user's hardware, the next step is distance-based detail.
- **Clearance**: limbs whose tips would pierce a building are dropped;
  `__game.clearance()` still reports 0 overlapping clumps.

### Character and animal models (CC0)
- **Source**: Quaternius's CC0 packs, credited in `src/assets/CREDITS.md`.
  KayKit's CC0 adventurers were also available, but they are chibi fantasy
  (knights, wizards) and don't fit the tone.
- **Survivors**: 10 everyday outfits (5 men, 5 women: casual, hoodie,
  farmer, worker, punk, walker, homespun) sharing one 62-bone skeleton and
  one set of clips.
  - `scripts/characters.mjs` strips the per-file animation copies and the
    normals (the game uses flat shading), drops finger tracks, tags every
    vertex with its colour slot, and meshopt-compresses the result: about
    85–110 KB per outfit, plus 151 KB of clips.
  - At load time each outfit's parts merge into one skinned mesh (one draw
    per pass).
  - Each survivor gets their own skin tone, hair colour and muted clothing
    hues from the slots.
- **Poses**: Walk, Idle, Sword_Slash (chopping), Punch_Right (hammering) and
  Interact (foraging) come from the clips. Sitting, eating, fishing, lying
  asleep, carrying overhead or in front, and shading the eyes are made by
  aiming bones at world directions after the clip plays. Tools (axe, rod)
  follow the right forearm.
  - A hidden capsule makes people easy to click.
  - The old primitive figures remain the fallback until the models load.
- **Wild animals**: deer and stags (the first of each herd is a stag) with
  Idle, Eating (grazing), Walk and Gallop (fleeing). About 185 KB each.
- **Size**: the single-file build grows from 0.9 MB to 3.0 MB. Inlined
  models are decoded from base64 directly rather than fetched.
- **Not yet**: hens and farm animals (the Farm Animal pack has no glTF;
  converting it needs Blender), children, and ageing.

### Soft look (after the character models)
The user found the art too jagged. Causes and fixes (`?hard` restores the old
look for comparison):
- **No anti-aliasing.** The post-processing chain drew into buffers without
  multisampling, so the renderer's `antialias` never applied. The composer
  now renders into a 4× MSAA half-float target.
- **Hard shadows.** Three.js removed PCFSoftShadowMap and fell back to hard
  PCF. The sun's shadow now uses a filter radius of 3.5.
- **Faceted shading on organic shapes.** Canopies, pine tiers, trunks,
  bushes (now subdivided), rocks (subdivided), people and deer are smooth
  shaded, via welded geometry and computed normals. Box-built houses stay
  flat.
- **Grass speckle.** Each blade had its own lighting, so neighbouring blades
  alternated light and dark. Blades are now lit as if facing up (`enhance`
  `upLit`), with a darker root and lighter tip.

### Our own survivor figures (Blender, from code)
The user disliked the Quaternius people and rejected Kenney's minis, so the
survivors are now built in Blender from `scripts/blender/survivor.py`
(`pip install bpy`; Mesa's `libegl1` is needed for headless rendering).
- **Style**: soft, rounded figurines like clay toys, with a large head
  (about 1:5.3), two dark eyes and a small nose.
  - Layered, mended clothes: tunic or coat, trousers, boots, belt, cuffs,
    collar, and optional scarf, hood, brimmed hat, beanie and backpack.
  - Hair: bowl, bun, ponytail or long.
- **Build**: the body grows from a stick figure (Skin modifier plus
  subdivision), and clothing is assigned by body region. Bands (belt, cuffs,
  boot tops, collar) cover the seams between garments.
- **Rig**: one shared joint table drives both the mesh and the bones. Bone
  weights come from distance to each bone. Bone and clip names match the
  game's character code, so the figures drop in.
- **Clips**: Idle, Idle_Neutral, Walk, Run, Interact, Sword_Slash (chop),
  Punch_Right (hammer) and Wave, keyframed in the script.
- **Outfits**: six, as `man_*`/`woman_*` so the game's pools pick them up.
  The game recolours skin, hair and cloth per survivor; boots, straps,
  packs and hats keep their own colours.
- **Size**: about 80–90 KB per figure plus 94 KB of clips.
- **Rebuild**: `python scripts/blender/survivor.py <dir> [--preview]`,
  then `node scripts/characters.mjs --figures <dir>`.

### Pixel-art prototype (`?pixel`, `?pixel=4`)
Prompted by the Godot 3D pixel-art demo (pixelagegames) and the t3ssel8r
style, which the user sees as the route to a tactile, cosy but detailed look.
Off by default.
- **Resolution**: the scene is drawn at 1/PIXEL of the screen (default 3)
  and enlarged with `image-rendering: pixelated`. MSAA is off.
- **Camera snap**: `IsoCamera.snapRows` snaps the camera to whole
  low-resolution pixels along its right and up axes. The remainder shifts
  the canvas by a CSS transform, so panning stays smooth and edges don't
  crawl.
- **Outlines** (`OutlinePass` in `stage.ts`): from the depth buffer alone,
  with no extra render. Silhouettes, where a neighbour is much farther,
  are inked a deep warm violet-brown on the near side, one pixel wide.
  Convex creases, found from normals rebuilt from depth, are lightened.
  `?pixeldebug` shows edges in red and creases in blue.
- **Colour steps**: the grade quantises to 14 levels per channel, giving
  stepped light on canopies and the ground.
- **First findings**:
  - Canopies, roofs and figures read well.
  - Grass and rain turn into noise at this resolution.
  - Thin surface detail such as road cracks gets lost.
  - Flat-coloured surfaces look sparse.
  - Next if pursued: pixel-scale textures (cobbles, planks, shingles), fewer
    and chunkier grass tufts, rain drawn as pixel streaks, per-material
    outline colours, and fixed zoom steps.

### Pixel art becomes the default look (art pass C3, part 1)
The user's first reaction to the prototype was "this is better", and they
asked to push it as close as possible to their reference: warm, tactile,
detailed, a cosy isometric pixel-art town. `?smooth` brings back the soft
look; `?pixel=N` sets the pixel size (default 3).
- **Surface textures** (`enhance` option `surface`, pixel mode only):
  pixel-scale detail computed in world space by the shader, with no texture
  files.
  - Walls: wood reads as planks with seams, staggered butt joints and grain;
    grey surfaces read as coursed masonry.
  - Slopes: staggered shingles with shadowed row edges.
  - Flat tops: grit.
  - Ground: loam blotches and grit.
  - Asphalt and concrete: broken slabs with dark seams and moss.
  - Foliage: leaf clumps, lit on their upper sides. This also breaks up the
    contour banding that colour steps otherwise draw on smooth canopies.
  - Excluded: trunks, stumps, rocks, crops, berries, people.
  - Detail fades where a texel would be smaller than a screen pixel, to
    avoid moiré.
- **Light**:
  - Crisp shadows (filter radius 0).
  - A lower sun (0.7× height), giving long raking shadows.
  - Sunlight warmed 28% toward #ffc98a in the day, with warm ground bounce.
  - Exposure 1.22.
  - Split toning 2.2× stronger, and warm highlights.
- **Grass**: 45% of the density, with blades 2.3× wider and a little shorter,
  so it reads as tufts rather than noise.
- **Rain**: 500 short, faint streaks instead of 1,400 long ones.
- **Props**:
  - Houses get a rain barrel, stacked crates and a firewood pile with log
    ends against the hearth wall.
  - Bunting is strung between neighbouring houses, the hall and the kitchen,
    within 17 units, at most two strings per building.

## 18. Long-range plan from the user (after the pixel pass)
Recorded as the user described it. None of this is built yet.

### Houses: modern vernacular from salvage, not generic medieval
The procedural houses are good, but they read as generic medieval. Target:
buildings we recognise from the modern era, rebuilt by survivors. They
should mix scrap from the old world with new timber: sheet-metal and
car-hood roofing, road signs as cladding, pallet-wood walls, shipping
containers and camper shells as rooms, uPVC windows salvaged from
suburbs, satellite dishes as rain catchers, and solar panels. Reference:
the TV series *Station Eleven*.
- **Upgrade levels over time.** A house grows from a lean-to on a salvaged
  frame to a patched, insulated home, then to a well-kept one with a
  second storey, a porch, and a glasshouse on the side.
- **Specific scrap with provenance.** No new resource categories for the
  player. Instead, the generated world knows what each ruin is made of (a
  motel: vinyl siding, doors, beds; a car park: car panels, glass; a
  factory: corrugated steel, girders). Salvage is logged by source, and the
  village's buildings are visibly made from what was actually salvaged
  nearby. A house might wear the petrol station's canopy or the chapel's
  pews. The inspector could say "walls of motel doors, roof from the
  garage".
- **Repurposed structures.** Communities convert whatever exists: a
  shopping-centre atrium as a market hall, a school gym as a granary, a
  bus as a bunkhouse. Alongside new building, reuse should be as common as
  construction.
- **Geodesic domes** as greenhouses (a strong *Station Eleven* image), built
  from salvaged struts and glazing or plastic sheet.
- **Car-chassis wagons** pulled by horses. Later: needs draught animals and
  travel, which ties into expeditions.

### A bigger, denser old world
The map is small, and nearby ruins are bland. Target: survivors living in
recognisable remains of the old world, much denser with buildings and
closer in character to each starting site.
- **Old-world districts** generated around and beyond the village:
  suburban cul-de-sacs with houses and garages; a strip mall or shopping
  centre with a car park; industrial estates with large factory floors and
  loading bays; a school; a church; a petrol station; farmsteads; a rail
  line.
- **Districts match the starting site.** A motel start sits on a highway
  edge with a strip mall; a chapel start sits by an old village centre; a
  farm start sits among fields and barns; a glasshouse start sits by a
  garden centre or research station.
- **Ruins are useful**: salvage by type (see provenance above), shelter,
  structures worth reclaiming, and places for expeditions and Veil events.
- **Rendering**: needs instancing or merged chunks for ruin geometry, plus
  the pixel-art textures (brick, siding, concrete, glass) so ruins read at a
  glance.

### The old world, phase 1: districts, ruins, provenance (DESIGN §18)
- **Districts** (`sim/oldworld.ts`): three near the village, 40–60 units
  out, chosen by starting site, plus the four road-end sites (which replace
  the old wall-stub ruins).

  | Starting site | Near districts |
  |---|---|
  | station | suburb, strip, works |
  | chapel | old town, suburb, farmstead |
  | motel | strip, suburb, works |
  | farm | farmstead, suburb, works |
  | glasshouse | garden centre, suburb, strip |

  - **Suburb**: a cul-de-sac with a turning circle, 5–7 houses facing it,
    driveways, garages, and cars on the drives.
  - **Strip**: a car park with wrecks, 4–5 shop units with fascia signs, and
    a superstore with an entrance canopy.
  - **Works**: a yard, a corrugated warehouse with a loading dock, and a
    shed.
  - **Farmstead**: a barn, a silo and a brick farmhouse.
  - **Old town**: a high street of brick terraces with a chapel and spire.
  - **Garden centre**: two glasshouses and a shop.
  - Each district gets its own access road and a POI with its name
    ("Rowan Close", "Harrow Retail Park", "Kiln Works").
  - Each ruin has an address ("14 Maple Close", "Harrow Retail Park,
    unit 3"), a decay level from 0 to 1 and a material list.
  - Result: 29–38 ruins per map.
- **Provenance**: salvage heaps sit at ruin doors, each with a source ruin
  and a material:
  - **Houses**: vinyl siding, roof shingles, window glass, interior doors,
    copper pipe.
  - **Garages**: garage doors, car panels.
  - **Shops**: shop shelving, plate glass, shop signs.
  - **Works**: corrugated steel, girders, pallets.
  - **Farms**: barn boards, fence wire.
  - **Terraces**: bricks, slates.
  - **Chapels**: pews.
  - **Garden centres**: greenhouse glass, aluminium frame.

  Salvaging logs the first haul from each place ("Rue brought back car
  panels from the garage at 3 Rowan Close."), tallies `village.salvaged`
  by material and source, and the hall's card lists the top five ("vinyl
  siding (36, mostly from 5 Rowan Close)"). The player still sees one scrap
  total.
- **Rendering** (`render/ruins.ts`):
  - Walls are built from columns that crumble with decay, with breaches;
    windows are dark glass, gone, or boarded.
  - Gable roofs are built in strips that fall away to bare rafters. Flat
    roofs have panels, holes, a parapet, and rooftop plant (air handlers,
    skylights, vents) with moss.
  - Materials: vinyl siding (planks), brick (a new brick texture),
    corrugated steel (a new ribbed texture with rust streaks), and slate
    and shingle roofs.
  - Shop fascias carry faded block lettering.
  - Ivy grows on walls and scrub grows inside; protected trees grow up
    through roofless shells.
  - Each district merges into a few meshes: all seven districts cost 18
    draw calls.
  - Trees are thinned to 22% within 26 units of a district centre, so
    streets stay legible.
- **Cars**: sedan, hatchback, van or pickup, with faded paint, rust on the
  sills, glass, bumpers, lights, flat tyres with hubs, and sometimes a
  sprung bonnet or open door. Wheels, doors and bonnet go first as a car
  is stripped.
- **Salvage piles** are coloured by material.
- **Checks**: two fishing tests were made robust to a Veil event (the
  lights under the water can refill a pond); behaviour is unchanged. The
  balance probe shows no deaths and normal morale. Influence capped on 2 of
  6 seeds, both with 14 survivors; probably run-to-run variation, but worth
  watching.

### The old world, phase 2: salvage-built houses and upgrade levels
The medieval look is gone: no timber framing, limewash or thatch. Houses are
modern vernacular, built from what the village has actually salvaged.
- **Materials** (`HouseSpec.clad`, from `chooseCladding`): when a plot is
  laid out, three materials are drawn from `village.salvaged`, weighted by
  amount. Early on, the starting site fills the gaps (station: corrugated
  steel, car panels, shop signs; motel: doors, siding; farm: barn boards;
  chapel: bricks, pews, slates; glasshouse: aluminium, glass). The site's
  own junk heaps now carry that material too.
- **Looks by material** (`render/house.ts`, table `CLAD`):
  - vinyl siding: pastel boards;
  - corrugated steel, garage doors, aluminium: ribbed sheet with rust;
  - car panels: flat paint colours;
  - pallets, doors, pews: wood;
  - barn boards: red;
  - shop signs: bright panels;
  - bricks: a brick course along the base and a brick chimney;
  - slates and shingles: the roof covering (otherwise corrugated tin);
  - glass: wide windows.
- **Levels** (`Building.level` for homes):
  0. **Salvage shack**: a patchwork of the materials, uneven panels, odd
     window sizes (some just plastic sheeting), a rusty tin roof with a tarp
     patch, a stovepipe, and a satellite dish as rain catcher.
  1. **Patched up**: tidy cladding (tin and car panels get painted over),
     white corner boards and fascia, matched windows with white frames and
     mullions, window boxes, painted tin roof, round gable vent.
  2. **Well kept**: adds solar panels on the front slope and a glasshouse
     lean-to (brick base, white frame, glass, seedlings) on the side away
     from the hearth.
- **Upgrades**: an `upgrade` project targets the home.
  - Level 0 → 1 from day 12: 16 wood and 10 scrap, 1,400 work.
  - Level 1 → 2 needs joinery; the first around day 40, then one every
    8 days: 12 wood and 16 scrap, 2,600 work.
  - Wood must be on hand; the scrap demand sends people salvaging, which
    now reaches the ruins.
  - Each level adds 0.5 comfort.
  - Measured over 3 seeds: shacks patched by about day 24; the first
    glasshouse on day 36–48; 4 of 5 homes well kept by day 72.
- **Inspector**: shows the home's state and what it is built from.

### Playtest round 2 fixes (after version 13)
The user found the pixel look far better ("adds charm and texture"). They
flagged:
- **Fog of war leaked detail.** The outline pass inked edges after the
  fog, so trees and buildings showed through unexplored land.
  - Fix: the pass rebuilds each pixel's world position from depth and
    samples the exploration texture. No lines where unexplored, and they
    fade in weather fog.
  - The fog-of-war mist no longer carries the scene's brightness in pixel
    mode.
- **Weather fog was unplayable.** Foggy days pulled the fog to 45–110
  units from a camera that sits 80 away. It now runs 90–170, so fog
  softens the distance without hiding the village.
- **Nights were too dark.** In pixel mode, night sky light rises by up to
  70%, moonlight by up to 45%, and the sky light turns a moonlit blue.
- **Fields looked like terraces.** Each tile was a flat quad at its centre
  height. Fields are now one mesh draped over the terrain's own corner
  heights, split along the terrain's diagonals, with furrows in world
  space, so they run unbroken.
- **Next, proposed by the user:** fields drawn as polygons (click points
  until the shape closes) that follow the land and are eventually fenced,
  instead of painted tiles.

### Fields drawn as outlines (after playtest round 2)
The user asked for polygon fields in place of painted ones, with editing
done by deleting and redrawing for now.
- **Drawing.** With the Field tool, each click on the ground adds a corner.
  An orange line follows the cursor. The shape closes when the first corner
  is clicked again or on Enter, and Esc cancels. Clicking inside an existing
  field (with no draft open) asks whether to remove it.
- **Simulation** (`sim/fields.ts`).
  - A `FieldPlot` keeps its corners, the tiles inside, fence progress
    (0..1) and a gate edge.
  - The tiles inside become Field zone, so tilling, sowing, tending and
    harvest are unchanged. `w.fieldAt` maps each tile to its field.
  - Unexplored, built-on, road and water tiles are left out. A field
    needs at least four usable tiles.
  - Painting a zone never overwrites a field tile.
- **Look** (`render/land.ts`).
  - The soil is the outline itself: triangulated, split to edges of 0.6
    or less, and draped over the terrain.
  - Furrows run along the contour, across the mean downhill direction. On
    flat ground they run parallel to the longest side.
  - Crops stay inside the outline, and the tile grid is no longer drawn.
- **Fencing.**
  - Once half a field has been worked, a farmer fences it. This costs 0.35
    wood per unit of perimeter, and they start only while wood covers that
    plus 10.
  - The fence is built progressively along the outline: posts about every
    1.2, two rails.
  - A gate sits on the edge nearest the fire.
  - On the farm site, the starting field is fenced by about day 9.
- **Known limitation.** A corner placed on unexplored ground still draws
  soil there, but the mist covers it and it is never tilled.

## 19. The spirit layer made physical: the Folk and haunted districts (proposed)

The user's ideas, after version 14. The two gaps they name:
1. The supernatural is underbaked. The Veil gives flavour and small
   modifiers but asks for little.
2. There are few acute moments. The game plays as a city builder.

The proposal answers both with one idea: **the land is already occupied.**
- The old world's districts are held by spirits: some benign, some lost,
  some rotten. They must be *cleared* before anyone can settle there.
- The woods belong to the Folk, a people of the Veil with their own
  settlements. The village has to learn to live beside them.

Status: draft for discussion. Items marked **[open]** await the user.

### 19.1 Why the pieces fit together
- **It explains the ruins.** Ruins are not settled or repurposed because
  something still lives in them. Clearing a district is the gate to the
  repurposing in §18: the gas station becomes a smithy, the mall a market
  hall.
- **The conflict is not combat.** Home stays safe, with no raids. Danger
  lives in the districts, in keeping with the Vision ("danger lives on
  expeditions"). Clearing replaces the generic expedition of milestone D.
- **The existing Veil quantities gain teeth.**
  - Sight decides what the team can perceive.
  - Resonance decides how strong the spirits are.
  - Glimmer and objects with provenance are what you offer.
  - Influence is how the player acts.
- **Clearing feeds coexistence.** A spirit converted in a district can
  come home as a household spirit or go to the Folk and grow their society.

### 19.2 Who occupies the districts
| Kind | What it is | Can be |
|---|---|---|
| **Remnants** | The old world's dead and their habits: the woman who still waits at the bus stop, the crowd that still shops. Mostly sad, not malicious. | Laid to rest (help them finish), or converted into a household spirit |
| **Wild spirits** | Things that moved into the emptiness: hedge spirits, a heron-woman in the flooded car park, the Lantern Man's kin. Kin to the Folk. | Befriended (they may leave for the Folk's woods, or stay as wardens) |
| **Hollows** | Rot: places where suffering, poison or the Quiet itself wore the Veil through. Already in the game near an unhappy home. | Only unravelled or sealed. Never converted. |

Each district rolls a spirit roster from its type:
- a suburb: remnants and hedge spirits;
- a factory: a Hollow at its heart;
- a mall: a crowd remnant and a thing in the escalator well.

Each spirit gets a mood, a *need* and a *weakness* from folklore (iron,
running water, thresholds, salt, true names, light, music, a returned
object).

### 19.3 Clearing: a small team, turn by turn
- **The team.** Two to four survivors walk into the district. The
  simulation pauses at home (or runs slowly) while the clearing plays out
  on the real map. The camera closes in on the district's own tiles and
  ruins, and there is no separate board.
- **The player's role (proposal).** At home the player never commands. In
  the Veil the presence is strongest, so here it can steer: each turn, the
  player guides one survivor per point of Influence spent, and the others
  act on their temperaments. This keeps "never command" as a scarcity
  instead of breaking it, and it feeds the long-arc question of what the
  player is. **[open: see 19.7]**
- **Perception is the fog of war.** Each spirit is seen as the best
  perceiver sees it (the §4 gradient):
  - nothing;
  - a cold spot;
  - a luminous shape;
  - a coherent being whose need can be read.
  A low-Sight team is fighting blind.
- **Three roles fall out of Sight:**
  - **Seers** (high Sight) read spirits and speak with them, but dread
    shakes them more.
  - **Anchors** (low Sight, sceptics) barely feel dread. They hold the
    line, carry the iron and lanterns, and steady a seer who is standing
    next to them.
  - **Hands** carry the offerings and do the work: return the kettle to
    its kitchen, hang the bells, open the door.
- **Nerve, not hit points.** Spirits act on the team's composure:
  - dread (Nerve damage);
  - a lure (pulls someone toward the spirit, like the Lantern Man);
  - confusion (swaps or turns people around);
  - grief (spreads sorrow).
- **Verbs** (first cut):
  - **Listen**: read a spirit's need, gated by Sight.
  - **Offer**: glimmer, food, or an object with provenance. Salvage from
    this very district counts double: "we brought back your sign".
  - **Speak or Name**: a true name, learned from lore, grants a spirit
    conversion outright.
  - **Ward**: a lantern, iron or salt makes a safe square; thresholds and
    running water block some spirits.
  - **Lay to rest**: finish the remnant's errand.
  - **Unravel**: attack a Hollow's heart, costly to Nerve.
  - **Banish**: force any spirit out. It always works, but it scars
    Resonance, angers the Folk, and leaves the district colder.
- **Outcomes per spirit:** converted, laid to rest, befriended,
  unravelled, banished, or left alone. A district is settleable once its
  Hollow is gone and the rest are resolved or at peace. Leaving some
  spirits is allowed. The district then carries its residents, for good
  or ill.
- **Harm.** When Nerve breaks, a survivor flees. If they were lured, they
  can be **taken**: missing, in the Veil. Folklore suggests rescue (a later
  clearing, a bargain with the Folk), or a return after a year and a day,
  changed. Death is rare or absent. **[decided: 19.7]**

### 19.4 The Folk: a second society beside ours
Inspired by fairy folklore (the good neighbours, the mound people) and by
the Nunnehi of Cherokee tradition. **[decided: they are called the Folk]** Recommendation: take the
feeling and give them our own name, rather than using "Nunnehi", which
belongs to a living culture's sacred tradition.

- **Settlements.**
  - Mounds, rings, hollow oaks and stone circles, placed in deep forest
    and high-Resonance ground by worldgen.
  - Joined by **Folk paths**: lines between mounds that must not be built
    on. The survivors' desire paths and lanes must route around them,
    which bends the village layout in a way no player plans.
- **Distance.** They do not want to live on top of us. Each mound wants a
  buffer (a new zone-like field, "the Wild") free of buildings, felling
  and noise.
  - Pushing the village into it costs **Standing** with the Folk.
  - Leaving woods whole and paths open earns Standing.
- **Growth.** With Standing and Resonance high, their society grows:
  - new mounds appear;
  - converted spirits from clearings move in;
  - their lights are seen more often.
  With Standing low, mounds go quiet or sour into Hollows.
- **Visibility.** A mound reads as a grassy hump to everyone. The Folk
  themselves, their lights, and their village life beneath the trees
  are drawn as a second layer, faded in by the §4 "seeing through their
  eyes" and by the Veil view. It is almost physical: always there, not
  always seen.
- **Working alongside.** Rewards grow with Standing:
  - A brownie tradition: leave bread and milk at a doorstep, and night
    chores get done. Some haul, mend, or tend the garden.
  - Woodlot regrowth is faster where they are welcome.
  - Guides for foragers and scouts.
  - They herd fish (the lights under the water already do this).
  - Weather warnings. Help in clearings: a Folk guide raises the team's
    Sight.
- **Rules** (geasa), learned through lore and council:
  - do not cut the lone hawthorn;
  - leave the last sheaf in the field;
  - do not bring iron to the mound;
  - do not speak their name aloud.
  Breaking one brings mischief:
  - soured stores;
  - lost tools;
  - a survivor *pixie-led*, walking into the woods at night. The search
    for them is an acute moment at home without raids.
- **Council.** Their emissaries bring requests (§8 entity requests
  already exist): a festival together, a path reopened, a grove kept, a
  stolen thing returned. In return they make offers: a guide, a fosterage,
  a gift of glimmer.

### 19.5 What acute moments this creates
- Clearings: tactical and tense, with loss possible (taken, shaken).
- Pixie-led survivors and searches in the night woods.
- Breaking a rule or a promise, and making amends.
- Hollows spreading from a neglected district toward home.
- Choosing between the Folk's wishes and the village's needs, such as
  wood in a hard winter.

### 19.6 Suggested build order
1. **Occupied districts, data and look.**
   - Each district gets a spirit roster.
   - Haunted districts are visibly wrong: cold light, drifting shapes
     for seers.
   - Settlement and salvage deep inside are blocked until cleared. The
     edges can still be scavenged.
2. **Clearing slice.**
   - One district type (the suburb), four spirit kinds and the core verbs
     (Listen, Offer, Ward, Lay to rest, Banish).
   - Nerve, taken, and the outcome ladder.
   - The camera moves to the district, and a turn UI is added.
   - This is the largest single build in the plan so far.
3. **Rewards of clearing.**
   - Household spirits in homes (comfort, luck, warmth).
   - The district opens for repurposing (§18).
4. **The Folk, groundwork.**
   - Mounds, Folk paths, the Wild buffer and Standing.
   - Offerings, the first rules, and the Veil-layer rendering.
5. **The Folk, together.**
   - Working alongside, growth, pixie-led searches.
   - Emissaries at council, Folk help in clearings.
6. **More clearings.** Factory and mall Hollows, the true names found
   through lore.

The order is a recommendation. Steps 4–5 could come first if the user wants
the Folk before the conflict.

### 19.7 Decisions, round 2 (user)
- **Name.** They are **the Folk**.
- **Clearing is optional.** A district is cleared only if the player wants
  it.
- **No deaths in the Veil.** Spirits *rattle* people or *take* them.
  - **Rattled.** When Nerve breaks, the survivor flees the clearing. For
    days at home they have nightmares, work less and need company. Repeated
    breaks can leave a lasting trait.
  - **Taken.** The survivor goes missing. Time runs differently in the
    Veil, so they are gone for days, or for a season or more.
    - Their loved ones feel it: the household keeps their bed and sets a
      place for them.
    - Some feel compelled to search, walking the woods and the district's
      edge.
    - This is grief without death, and it does not close.
    - Then they come back, changed. Candidate changes:
      - higher Sight;
      - they speak with the Folk;
      - strange habits, gaps in memory, or not having aged;
      - a gift, or a debt.
- **Two societies, one map.** Both the humans and the good Folk are visible
  and planned.
  - **The first mound.** From the start there is one mound of good Folk
    near the village. The player guides it as they guide the village.
  - **Kinds of Folk.** The *good* Folk can be allies. The *bad* spirits
    are what clearings deal with.
  - **Living apart.** Humans and good Folk cannot live healthily right on
    top of each other; each needs a buffer (the Wild).
  - **Clearing together.** A team can mix survivors and Folk.
  - **Who gets it.** After a clearing, the player decides who gets the
    district: the village (repurpose the ruins, §18) or the Folk (they
    rewild it and a new mound grows).
  - **Suitability.** Districts suit one society or the other:
    - **Human:** grocery store, strip mall, garage, depot, motel. Useful
      buildings and salvage.
    - **Folk:** churchyard, park, golf course gone to meadow, flooded car
      park, quarry pond, orchard, old water works, railway cutting.
      Quiet, green, watery, or old.
    - Giving a district to the "wrong" society works, but it thrives less.
- **What clearing plays like.** Time and the seasons stop at home while
  the team is in the Veil. The clearing is a turn-based encounter on the
  district's own map, in the manner of XCOM.
  - The goal is **recruiting** (converting, befriending, laying to rest)
    as much as removing.
  - What you know depends on the team's Sight.
  - The resource at risk is Nerve.

### 19.8 Control in clearings (decided: direct, turn-based)
The user chose direct control in the manner of Baldur's Gate or XCOM:
turn-based, on a zoomed-in view of the district, with the team able to
walk through its buildings. The Folk's first mound is built before any
clearing mechanics.

In XCOM the player picks each soldier's action every turn. Everywhere else
in this game the player never commands: survivors act on their own, and
the player only nudges. The recommendation is XCOM-style control inside
clearings, justified in the fiction because the player is a Veil presence
and is strongest there. Character is kept through Nerve:
- A rattled survivor may refuse an order.
- They may act on their own temperament: freeze, run, or reach for the
  spirit.
- Low-Nerve turns show that loss of control, much like panic in XCOM.
- Folk team members may follow their own rules. For example, they will
  not touch iron.

### 19.9 The Folk's first mound: as built
Built before any clearing mechanics, at the user's request.
- **The hill** (`sim/folk.ts#layFolkLand`, placed by worldgen with its own
  random stream).
  - Placement: 31–40 units from the camp, at least 14 from the Ring and 34
    from any district. Not on water or paving; forested ground is
    preferred.
  - Shape: a barrow of radius 3.6 and height about 2.5. Its core is
    blocked, so no one walks over it.
  - Dressing: a kerb of low stones, foxgloves on the crown, and a stone
    doorway facing the village with a threshold stone for offerings.
  - A protected thorn tree stands beside it, and it is explored from the
    start.
- **The Wild** (`Zone.Wild`, a new zone and paint tool).
  - Their land: about 220 tiles within 8.5 of the hill at the start.
  - Nobody cuts there (like Sacred ground), and it lies outside Home, so
    nothing is built there.
  - It raises Resonance: +0.2 to the target on full cover.
- **Folk paths.** Two gently curved paths: one from the door to the Ring,
  one from the back of the hill 24 units into the woods.
  - Buildings and house plots never cross them; people may walk them.
  - Drawn with pale stepping stones and white flowers, and motes at night
    (stronger in the Veil view).
- **The society** (`FolkSociety` on the colony).
  - It starts with three of the Folk: an elder, a hob and a sprite.
  - The mound's first works are already there: a toadstool ring and a
    cairn.
  - **Standing** runs 0–100 in bands: soured <20, wary <45, friendly <70,
    kin. It starts at 40.
    - Each day it drifts 5% toward 40.
    - Resonance at the hill: +0.2 above 0.6, −0.3 below 0.4.
    - Land at or above what they want: +0.2 a day. Below 80% of it:
      −0.4 a day.
    - Taking their land: −0.15 per tile lost (up to −12). Giving land:
      +0.05 per tile (up to +6).
    - Each building within 14.5 of the hill: −0.6 a day.
    - Offerings: +1.2, or +0.6 once standing is 60 or more.
  - **Offerings.** Bread is left at the door (1 food) after supper, by
    whoever is most drawn to it (Sight, a hope for the Veil, attuners).
    - Every day while standing is below 50, then every third day.
    - About 20 food a colony-year.
  - **Meeting.** An offering-bearer who reads the Folk as coherent meets
    them. The first meeting brings a speech from the elder and the first
    rule; later meetings bring names and rules. Readings follow §4 with
    depth 30.
  - **Growth.** While standing is 50 or more *and* they have the land they
    want (180 + 70 per level), growth accrues at 0.025 × (0.5 + Resonance)
    a day, doubled under the "their hill" focus.
    - Each level brings one more of the Folk and a new work.
    - Without more land the hill stops growing. That is the player's
      lever.
- **The player's controls.**
  - Paint the Wild (give or take land).
  - Choose what the Folk give their nights to (on the Folk card, opened by
    clicking the hill or the Folk button in the Veil panel):
    - **The woods:** saplings in the Wild, Resonance around the hill.
    - **The village:** once standing is 45 or more, hobs and sprites come
      down between midnight and 04:00. One chore a night (more as the
      hill grows): haul loose goods to the stores, an hour's work on a
      building, or weeding twelve rows.
    - **Their hill:** works appear (toadstool rings, lanterns, bowers,
      cairns, flowers) and growth is faster.
- **Gifts and mischief.**
  - Kin sometimes leave glimmer (12% a day, +2).
  - When soured (30% a day), they sour 3–7 food or hide a building's
    tools (−25 work).
- **Seen as Sight allows** (`render/folk.ts`).
  - Out between 19:30 and 05:00, walking their paths, dancing in rings,
    tending works.
  - Readings: a chill is a small light; luminous is a small glowing
    figure (wings on sprites, a hood on the elder); coherent adds their
    name, if known.
  - The door glows warm at night, dark when soured.
- **Measured** (5 sites, one year each).
  - The hill reached level 1 at every site. Standing settles at 52–54
    (friendly) with no player action.
  - About 20 offerings a year. They were met at every site. No deaths.
  - Morale unchanged within noise.
  - Offerings were first placed at dusk. That delayed the first yard
    improvement from day 18 to day 25 in the homes test, because the
    bearer lost their yard hours. After supper it costs evening company
    instead.
- **Next** (§19.6 steps 5 and 1–2): pixie-led searches and rules that can
  be broken, emissaries at council, then occupied districts and the
  clearing slice.

### 19.10 Haunted districts and the clearing slice: as built
- **Occupants** (`sim/haunt.ts#createHaunts`, seeded from the world).
  - Rosters by district kind:
    - suburb: 2 remnants, a hedge-spirit, a lamp, a Hollow;
    - strip: remnant, lamp, hedge, Hollow;
    - works: remnant, lamp, Hollow;
    - farmstead: 2 hedges, a remnant;
    - old town: 2 remnants, hedge, Hollow;
    - garden centre: 2 hedges, a lamp.
  - Remnants live in a named ruin ("the woman who waits at 5 Heron
    Close") and need an object, company or light. Hedges want food or
    glimmer. Lamps want glimmer. A Hollow sits under the biggest building,
    with a hold of 5–7.
  - Depths: remnant 20, hedge 30, lamp 35, Hollow 5.
- **At home.**
  - Within 22 of a haunted district nothing can be zoned. The boundary is
    drawn in violet.
  - Salvage within 5 of a spirit (9 of a Hollow) is left alone. That is
    about half the map's scrap. It did not slow the first year: buildings
    and homes by day 48 were the same or higher on seeds 1–4, because the
    village salvages near home first.
  - Whoever discovers a district senses what lives there (a log line
    depending on their Sight).
  - At night, the spirits of sensed districts show as faint lights, at
    most luminous, to whoever could perceive them.
  - Click a found district for its card: what lives there, what it
    suits, and a team picker. It suggests two Seers and two Anchors, up to
    four people.
- **The clearing** (turn-based; home time frozen, the view forced to night
  and the Veil view).
  - The team enters along the road from home.
  - **Actions:** 2 a turn. A move is up to 4 steps per action. Ruins can
    be walked through; trees, wrecks and water block.
  - **Nerve:** 8, +3 brave, +2 stoic, −3 skittish, ±1 per 20 morale
    above or below 50.
  - **Anchor:** Sight below 30. **Seer:** Sight 40 or more (a label only).
  - **Perception:** each person reads each spirit within 10 paces by
    Sight + Resonance × 40 − depth (+10 Orb-Touched).
    - Nothing shows below −10; a cold spot below 10; a shape of light
      below 35; named above that.
    - Its name shows once it is known.
  - **Verbs:**
    - *Listen* (range 5; only while there is more to learn, or a remnant
      wants company): +1 knowledge, +2 when coherent. At 2 you know its
      need; at 3, how it could find peace. Listening to a Hollow costs 1
      Nerve.
    - *Offer* food (2), glimmer (1), or *give back their things*: needs
      salvage the village took from that remnant's own house, and isn't
      used up. The right offering gives +2 calm, the wrong one +1.
    - *Lay to rest*: calm 2, known 2.
    - *Ask them home*: calm 3, known 3. They become a hearth spirit,
      +0.8 comfort in a home.
    - *Befriend*: a hedge at calm 2 or a lamp at calm 3. It joins the
      Folk: one more of them, +3 standing.
    - *Ward* (two lanterns): radius 2. Lures fail inside; dread is
      halved.
    - *Steady*: +2 Nerve, +3 from an Anchor.
    - *Unravel* (2 actions): 1 damage, +1 inside a ward, +1 for an
      Anchor. Costs 2 Nerve (Anchors 1).
    - *Banish* (2 actions): always works. Resonance −0.08; Folk standing
      −6 for wild spirits, −2 for remnants.
  - **The spirits' turn:**
    - A Hollow's dread reaches 4: −2 Nerve, −1 for Anchors, +1 from turn
      7 as the night deepens.
    - A remnant not at peace weeps: −1 to non-Anchors within 2.
    - A hedge swaps two people (40%) or tugs one a step, −1 each.
    - A lamp pulls the lowest-Nerve person within 8 two steps, −1 Nerve.
      Adjacent with Nerve 3 or less, they are *taken*.
    - Nerve at 0 means they flee (rattled: −12 morale). If they were
      lured that turn, they are taken.
  - **Ending:** twelve turns until dawn.
    - The district is *quiet* when no Hollow remains and every remaining
      spirit is at peace (calm 2). Quiet spirits stay as residents.
    - Then "It's quiet: come home" clears it. Withdrawing, or dawn
      without quiet, leaves the spirits stirred for 3 days, with their
      calm halved; knowledge is kept.
- **Taken.**
  - Survivor `taken`: not alive, not dead. Households keep them; no
    mourning, no gravestone. The HUD log shows "Taken, and waited for".
  - They come back in 3–10 days, or 12–30 (a season or more) with 30%
    chance.
  - Meanwhile, each day, anyone close to them loses 1.5 morale and
    sometimes sets a place at supper or calls for them at the district's
    edge.
  - They return at dusk asking what day it is ("for them it had been one
    night").
    - Always: Sight +15.
    - One change: white hair; knows the Folk (met, a name learned); a
      gift of 5 glimmer; or a lost bond (−30 with the closest).
    - Those close to them get +12 morale.
- **After a clearing.**
  - Cleared districts go to *the village* (zoning allowed; the ruins are
    ready for §18 repurposing, not yet built) or *the Folk*.
  - Giving it to the Folk makes Wild within 14. Paving greens to grass.
    Standing +10 if Folk-suited (farmstead, garden centre), +4 otherwise.
  - Giving a Folk-suited district to the village costs −2 standing.
- **Measured.** A simple bot (`sim/clearbot.ts`) on suburbs, 16 seeds:

  | Team | Cleared | Rattled | Taken |
  |---|---|---|---|
  | 4 (2 Seers + 2 Anchors) | 15/16 | 4 | 0 |
  | 3 | 5/16 | 11 | 2 |
  | 2 | 2/16 | 12 | 2 |

  A careful player (wards, knowing needs, bringing back objects) should do
  better than the bot.
- **Known gaps and next steps.**
  - No Folk companions in teams yet.
  - Only four spirit kinds.
  - Repurposing cleared ruins (§18) is still to come.
  - The taken don't yet trigger search expeditions.
  - A full team of four costs nothing but risk, since no time passes;
    the design may want a cost (Influence, or the Veil only opening on
    some nights).

### 19.11 Playtest round 3 (version 16)
- **Lights with a source.** The user found orbs drifting around the village
  confusing. Every Veil light now belongs to a Veil place:
  - Wisps (7, smaller) drift only between the Ring, the Folk's hill and
    points on the Folk paths.
  - The great Orb shows only above the Ring or the hill, one visit in
    three, and only after dark.
  - The village's own lights are electric instead:
    - Built lanterns are a salvaged lamp on a hook, with a small solar
      panel on the post.
    - The bunting between houses carries warm string lights at night,
      run off a little solar panel at one end.
- **The Ring and the hill.**
  - The Ring is placed on any bearing, 20–23 units out (the edge of the
    starting ground), on clear ground away from roads, water, the site and
    ruins.
  - The Folk's hill is out beyond it, within ±0.6 radians of its bearing
    (wider if needed), 12–19 units further. Their path must stay at least
    17 from the camp; across 40 worlds it never came closer than 20.8.
  - The door faces the Ring. If nothing fits every wish, the hill takes
    the good ground farthest from any district.
- **Roof ivy.** Ivy on pitched site roofs was sampled on a level plane at
  the slab's centre height, so it cut through both slopes. It is now
  sampled in the slab's own frame (`station.ts#slabSurface`) and lies on
  the pitch.

## 20. Backlog from the user (after version 17)
Recorded as the user gave it, to be scheduled.

### 20.1 The Veil's price
- **Built:** entering the Veil costs 10 Influence (`haunt.ts#VEIL_COST`),
  checked before a team can go in.
- **To do:** free on full moons and at festivals. The calendar needs a moon
  phase, and the council's festivals are already dated.

### 20.2 More life in the village: motives, trades, places
The user: "we need a lot more motives for people and buildings.
Socializing, entertainment. We need people who make tools, clothes, who
process food. We need taverns, and solar panels on houses."
- **Motives.** More needs and reasons to act than food, rest and company:
  - entertainment and fun;
  - comfort and beauty;
  - purpose and pride in work;
  - faith and the Veil;
  - romance and family.
  These should drive where people spend free time, and what the village
  asks the council to build.
- **Trades** (production chains, learned by doing like joinery; §17
  know-how):
  - *Toolmaker* (smithing from salvaged steel): tools raise work rates
    and wear out.
  - *Tailor* (cloth from salvaged textiles, later flax or wool): clothes
    for warmth in winter, and for comfort.
  - *Cook / food processor:* a kitchen turns raw food into meals
    (better morale, less spoilage). Preserving (smoking, drying,
    pickling) extends winter stores.
  - Other candidates: brewer (for the tavern), herbalist (medicine),
    potter.
- **Places.**
  - A *tavern / commons* for evenings: drink, music, stories. It is the
    social heart after the fire.
  - Workshops for each trade.
  - Solar panels on more houses, not only at upgrade level 2, and a small
    village grid. Electric light already exists in lanterns and string
    lights (§19.11); this extends it to evenings indoors, and maybe power
    for a workshop.
- Open questions for scheduling:
  - How many new needs before the HUD gets noisy?
  - Do trades become roles in the role list or specialisations within
    roles?
  - How does this interact with salvage provenance (cloth from a
    specific ruin)?

### 20.3 Order of work agreed after version 17
1. Repurposing cleared ruins (§18; the payoff of clearing).
2. The Folk together (§19.6 step 5): Folk companions in clearings,
   pixie-led searches, rules that can be broken, emissaries.
3. Folk-suited districts (churchyard, park, flooded car park, quarry pond).
4. §20.2 motives, trades and places. This is large; propose a plan first.

### 20.4 Restoring cleared ruins: as built (step 1 of §20.3)
- **When.** A district that is cleared and given to the village offers its
  ruins for restoration (`sim/restore.ts`). The planner restores one at a
  time.
  - It does so for a need: beds short (+6), stores over 70% full (+5), no
    workbench (+4), no shrine (+3), fewer than two gardens (+3).
  - Otherwise it makes one quiet improvement about every eight days.
  - Each existing restoration of the same kind counts −0.8 (variety), and
    distance counts against it (−1 per 60 units).
- **What each ruin becomes.** Restored buildings reuse the home buildings'
  effects:

  | Ruin | Becomes | Cost (wood, scrap) | Work |
  |---|---|---|---|
  | House, terrace | Beds, 3 (a hut) | 8, 3 | 700 |
  | Farmhouse | Beds, 4 | 10, 3 | 800 |
  | Garage, shed | Workbench | 4, 2 | 360 |
  | Shop | Stores for 90 food | 6, 2 | 420 |
  | Superstore, warehouse | Storehouse, 220–240 | 12, 4 | 900 |
  | Barn | Store for 140 | 8, 2 | 600 |
  | Chapel | Shrine | 6, 2, plus 4 glimmer | 500 |
  | Glasshouse | Garden beds | 6, 4 | 480 |

  These cost roughly a third to a half of building new.
- **Rules.**
  - A remnant who was asked home and whose own house is restored moves
    back in (`hearths[].ruin`).
  - Restored buildings are never "upgraded" into new ones.
- **Look.**
  - The district is rebuilt with that ruin at almost no decay and less
    ivy.
  - It gets a salvaged solar panel on the roof (not glasshouses, silos or
    chapels).
  - Warm lamplight shows at front and back from dusk.
- **Measured.**
  - Seeds 5 and 8 each had a retail park given to the village on day 1.
    That run predates the variety penalty: it restored 5 stores over the
    year, paced about every 8–12 days.
  - Balance probe unchanged: no deaths, morale 66–72.
  - Restored beds far from home are used only when beds nearer are full.
- **Gaps.**
  - Clicking a restored ruin doesn't open an inspector yet.
  - Households don't move into restored houses as their home; they are
    shared beds.
  - The §20.2 trades and taverns should become restoration targets (a
    shop as a tavern, a garage as a toolmaker's).

### 20.5 Clearing, easier to read (after the user found the side panel confusing)
- **In the world.**
  - Left-click one of the team to choose them; left-click a lit tile to
    walk.
  - Click a spirit (or right-click anything) to open an action menu at the
    cursor. It shows:
    - what the spirit is, as far as the team can perceive it;
    - who is acting and their actions left;
    - the distance, its need and calm (once known);
    - a plain next step ("Listen to it to learn what it wants", "Give it
      what it wants: glimmer", "Unravel it: best done by an Anchor…");
    - every action with its cost, and why a greyed-out one can't be done
      yet;
    - "Walk beside it" or "Walk toward it" when it is out of reach.
  - Right-click a teammate to steady them (or walk beside them); right-click
    the chosen person to set a ward.
  - Hovering names what is under the cursor.
  - Right-drag still rotates the camera.
  - The camera follows the chosen person only when they are chosen or
    move, so it no longer pulls the view back while the player looks
    around.
- **The side panel** keeps a short "How it works" (five steps), the team
  with Nerve and actions, what lives here, the log, and the turn buttons.
  The per-spirit action lists moved into the menu.

### 20.6 The Folk together (step 2 of §20.3): as built
- **Folk companions in clearings.** When the Folk are met and at least
  friendly (standing 45 or more), the district card offers "Ask one of the
  Folk to come". One of their people joins the team (`FAE_UNIT` in
  `haunt.ts`):

  | Kind | Sight | Nerve | Steps per action | Gift |
  |---|---|---|---|---|
  | Elder | 90 | 10 | 3 | *Speak its true name*, once a clearing: the spirit is known at once and calm +1; a Hollow loses 2 of its hold |
  | Hob | 55 | 12 | 4 | Steadies like an Anchor (+3) |
  | Sprite | 75 | 7 | 6 | Quick, sees well |
  | Piper | 65 | 8 | 4 | *Play for it* (2 actions): every spirit within 3 paces calm +1, and the team near the piper +1 Nerve |

  - The Folk won't touch iron or salt, so they cannot ward.
  - Dread only half reaches them, and lamps can't lure them.
  - If their Nerve breaks they fade home. They are never taken.
  - Afterwards: standing +5 if the district was cleared, +2 otherwise,
    −2 if they fled.
- **Emissaries at the council.** Through whoever sees them best:

  | Proposal | When | Cost | Effect |
  |---|---|---|---|
  | A festival with the Folk | Met, standing 35+, 8 days since a festival | 12 food, 6 wood | Morale +6, bonds, standing +8, a name learned |
  | More of the woods for their hill | Met, standing 40+, land short of what they want | none | Wild widened to radius 10.5 + 1.2 per level; standing +4 |
  | Make amends | Met, standing below 25 | 8 food, 3 glimmer | Standing +12; ends the offence |

- **Rules that can be broken.**
  - Woodcutters cut in the Wild only when the woodpile is below 4 in
    autumn or winter: standing −5, the Folk offended for 5 days, and the
    first rule learned.
  - Hungry foragers (rationing, or food below 2 per person) take the
    Wild's berries: standing −1.5, offended for 2 days.
- **Led astray.**
  - At 01:00, if the Folk are offended or below 25 standing: a 18% chance
    a night (30% when soured) that someone walks out of bed into the woods
    near the hill.
  - By day, up to two searchers (those close to them, or a scout) go
    looking. The search area narrows each time.
  - An Omen cast within 16 of them shows the exact place.
  - Found: they come home with morale −4, the finder +4. Unfound after two
    days, they come home alone at dusk: morale −12, Sight +5.
  - Friends of the hill (standing 45+, met) are occasionally *borrowed for
    a dance* instead: 2% a night, about once a year. They come back
    laughing, with 3 glimmer.
- **Measured.**
  - Held soured (standing ≤18) for 20 days on 8 seeds: 46 led away, 38
    found by searchers, 5 came home alone.
  - In ordinary play (6 seeds, one year): standing stayed 40–54. No rules
    were broken and nobody was led away before the borrowing was added.
    Folk proposals reached the council 9 times.
  - Balance probe unchanged: no deaths, morale 64–72.

### 20.7 Remnants who want something of theirs (playtest note)
The user met "the woman who waits at 9 Heron Close … wants something of
theirs brought home" and could not tell what to do.
- **The problem.** "Give back their things" only worked if the village had
  already salvaged from that very house. But salvagers never go near a
  spirit, so it was nearly impossible, and the only fallback (food, the
  wrong gift, +1 calm each) was unexplained.
- **The fix.**
  - Once the need is known (two listens), a new action appears beside the
    remnant: *Search their house* (1 action). The team finds a keepsake
    fitting the building: a photograph from under the stairs, a chipped
    teacup, a name badge, a spanner worn smooth, a hymn book with a
    pressed flower.
  - *Give back their things* then counts as exactly what they wanted
    (+2 calm, at peace).
  - The menu's next step says so: "Search their house for something of
    theirs, then give it back to them."

## 21. The gameplay loop, version 2 (agreed after version 18)
The user's assessment: the city building "feels a lot less like a game when
they make all their own choices about what to place and where". Manor
Lords is the main reference for the city building, Stardew Valley's mines
for the loop's rhythm, and Wildermyth for how the village expands into new
places. Expansion so far has only meant more beds; it needs pressure
behind it.

### 21.1 Decisions
- **A build menu with player placement.** The player places buildings
  directly (a footprint preview, rotation), as in Manor Lords.
  - Homes stand on **plots** the player draws with the polyline tool,
    with a minimum area. The house is placed logically on the plot, its
    door toward the nearest path. The rest of the plot is a yard the
    household fills with sub-structures, some useful: vegetable beds, a
    coop, a well, a smokehouse, a solar array, a workshop.
  - Organic in-between detail still emerges on its own: paths, bunting,
    string lights, clutter.
- **Every building is procedural**, built from what the village actually
  salvaged (the provenance logic houses already use).
- **Any ruin on the map can be repurposed.** Ruins in haunted districts
  are locked until the district is cleared. Ruins get a roof-and-wall
  cutaway for viewing, in clearings and in normal play.
- **The council pauses the game** and asks for a choice, so decisions
  don't pass by. A chosen building goes straight into placement.
- **Needs drive expansion**, as Manor Lords' burgage levels do:
  - Tier 1: shelter, food, fuel.
  - Tier 2: food variety, clothes, tools, a tavern.
  - Tier 3: comfort, faith or the Veil, beauty.
  Meeting a tier raises the house's level. Production chains come from
  salvage and local materials: toolmaker, tailor, smokehouse or kitchen,
  brewer with a tavern, and more (§20.2).
- **Clearings as "the mines".** Some materials exist only in districts
  (for example copper wire from the works, textiles from the retail park,
  glass from the garden centre, books and lore from the old town). As
  salvage near home runs out, higher tiers require clearing. Clearing
  itself stays as it is for now, except for the cutaway.
- **The Folk: a second city builder, by night.** The player can give them
  orders at any time, and they act at night, as the villagers do by day.
  - Plans wait in the Wild as faint placeholders by day, and are built
    after dusk while the village sleeps.
  - They have their own needs and tiers, and their own materials
    (glimmer, dew, song, moonlight).
  - This gives the night a purpose; nights may need to be longer.
- **Seasons shortened and a full rebalance**, as the last step of this
  phase. Measure real minutes per year at 1× first.
- **Vision wording.** "The player never commands" becomes: the player
  shapes the land and the plans; the survivors live their own lives
  within them (who lives where, who works what, how they feel).
- **Consolidation.** No new standalone systems in this phase; it deepens
  and connects the existing ones around the player's choices.

### 21.2 Order of work
1. Cutaway for ruins, in clearings and in normal play.
2. Build menu and placement: plots with houses and yards, public
   buildings with a preview, restoring ruins from the same menu.
3. The council pauses and asks; building choices go straight to
   placement.
4. Need tiers, house levels, first production chains (tools, clothes,
   preserved food, a tavern) as procedural salvage buildings.
5. District-only materials (the pressure to clear).
6. The Folk's night building.
7. Season length and the full rebalance.

This supersedes §20.3; the rest of §20 (Folk-suited districts, the Veil's
moon and festival rule) is folded into steps 5–7.

### 21.3 Step 1: cutaway for ruins (built)
- **Ruins open up like the village.** Their roofs are built into tagged roof
  groups, and districts are merged with cut materials
  (`render/ruins.ts#registerCutaway`). So the Roofs button (R) lifts ruin
  roofs off and cuts their walls at knee height, as it does for village
  buildings.
- **In the Veil.** Entering a clearing switches the view to the cutaway;
  leaving restores the player's setting.
  - The forced hour moved from 23:24 to 20:45.
  - A lavender hemisphere light (intensity 1.6, faded in over about half a
    second) lights the district while a team is inside, so floors, walls
    and what grows in the houses read clearly.

### 21.4 Step 2: the build menu and placement (built)
- **The player plans; the survivors live in it.** In the game the village no
  longer sites buildings, homes or restorations by itself
  (`Village.autoPlan = false`, set in `main.ts`). `?auto` restores the old
  self-planning village. Tests and `npm run sim` keep `autoPlan` unset, so
  the balance probe still measures a village that plans for itself.
  - The one exception is the opening project from `createColony` (the
    first garden or workbench): it gives a new game something to watch.
  - Upgrades (patching up, glasshouses, rebuilding in timber) and yards stay
    emergent. They are improvements to what the player placed, in keeping
    with "organic in-between elements stay emergent".
- **Build menu** (the Build button or **B**; `ui/build.ts`): a plot for a
  home, the six placeable buildings (`PLACEABLE`: bunk shack, root cellar,
  workbench, garden, shrine, solar lantern) with costs, and restoring a ruin.
  Costs the village can't meet say "(they'll gather it)"; placing is never
  blocked by materials, because hauling follows demand.
- **Placing a building** (`sim/buildings.ts#footAt/canPlace/placeProject`,
  `render/placement.ts`): a ghost box follows the cursor, green where it
  fits and red where it doesn't, with a cone at the door. Right-click or
  **T** turns it; click places it, and it becomes an ordinary project.
  - The hint line gives the reason when it won't fit. Reasons come from
    `footprintFree`: water, paving, a plot, a field, the Folk's land or
    paths, a haunted district, too steep, too close to another building,
    the fire circle, unexplored ground.
  - Zones are not required for placement (`needZone = false`); they still
    guide the survivors' own choices.
- **Drawing a plot** (`sim/homes.ts#outlinePlot/claimPlot`): click corners
  with the same outline tool as fields; close on the first corner or press
  Enter.
  - The plot must be 36–260 squares on explored, dry, unpaved ground that
    overlaps no plot, field, building, Folk land or haunted district.
  - Its front is the edge (at least 3 long) whose middle is nearest a worn
    path, a road or the fire. The house is fitted near the front: several
    sizes, setbacks and offsets are tried; the door faces the street and
    the slope is limited as for auto plots.
  - The rest is yard, filled in over time by the household as before
    (`planYard`, fences along `plotFence`, which now works for any
    polygon).
  - A drawn plot waits empty (`household = 0`). The next waiting household
    takes the empty plot nearest the fire (`homeOnDrawnPlot`) and starts
    its house. With no empty plot, the log asks every other day: "Draw
    them a plot: Build → Plot for a home."
- **Restoring from the menu** (`sim/restore.ts#whyNotRestore/requestRestore`):
  hovering a ruin highlights it (green if restorable) and names what it
  becomes. It is refused, with the reason, in a district still haunted,
  in one given to the Folk, or when the ruin is already done or under way.
  Choosing a ruin in an unclaimed cleared district claims it for the
  village.
- **Also:** the "wisp lantern" is renamed the solar lantern (it has been a
  solar lamp post since round 3). The Folk "led astray" test now holds
  standing at 15; it had relied on a few dice rolls before offerings mended
  things.
- **Debug hooks:** `__game.build({kind:'place', site:'cellar', turn:0})`,
  `__game.fits(kind, x, z, turn)`, `__game.plotTry(pts)`,
  `__game.screenOf(x, z)`.
- **Tests:** `tests/build.test.ts` covers plot validation messages, a drawn
  plot getting the only home, no self-placed buildings with `autoPlan`
  false, placement and refusal (and completion), and restoring only after
  clearing.

### 21.5 Step 3: the council waits for an answer (built)
- **The day stops.** When the council convenes, the game pauses and the
  council panel opens by itself, over a dimmed view ("The day waits while
  they talk"). The speed buttons, Space and 1–3 can't restart the clock
  until it is answered (`main.ts#holdForCouncil`, a guard in `setSpeed`).
  The "Later" button is gone: the choice is forced.
- **Three ways to answer:**
  - back one voice (the others feel passed over);
  - back one and send a dream (15 Influence, nobody is hurt);
  - "Let them decide", which carries the most-backed affordable proposal
    (`council.ts#councilFavourite`). It is the same rule the council uses
    when left alone in headless runs; losers still feel it.
- **Building choices go straight to placement.**
  - Backing a building (`build`) opens the placement ghost for it, with
    "The council agreed: …" kept at the front of the hint.
  - Backing a home petition (`home`), when no empty plot exists, opens the
    plot tool ("The council said yes to a house. Draw them a plot.").
    The household is queued, so it takes the plot you draw.
  - The clock resumes at its previous speed once the thing is placed, or on
    Esc. If the game was paused before the council met, it stays paused.
- **Agreements that wait.** If placement is cancelled, the agreement stays
  (`Village.priority`, or the household in `homeQueue`). The plans panel
  shows "Agreed at council: … [Place it]" or "[Draw a plot]"
  (`hud.ts#agreedLine`). The council does not propose the same building
  again while it waits. Placing that kind of building clears it.
- Proposal cards for buildings and homes say what backing them means ("If
  backed, you choose where it goes", with the materials).
- Headless runs are unchanged: an unanswered council settles itself at the
  first morning after its day is up.
- **Tests:** `tests/council.test.ts`.

### 21.6 Step 4: need tiers and the first trades (built)
- **Goods** (`Resources`):
  - `cloth` comes back with salvage: about 0.25 per scrap, 0.45 from
    houses, motels and shops, 0.15 from cars (`trades.ts#clothFrom`).
  - `tools`, `clothes` and `preserves` are made. The start is 2 tools,
    3 clothes and 2 cloth.
- **Trade buildings** (`TradeKind`; placeable from the Build menu,
  proposed by the council, or self-planned under `autoPlan`):

  | Building (tier 0 / 1) | Makes | From | Minutes | Wanted in stock |
  |---|---|---|---|---|
  | Tool bench / Toolmaker's shop | 1 tool | 2 scrap, 1 wood | 110 | 0.8 × workers + 1 |
  | Sewing room / Tailor's shop | 1 clothes | 2 cloth | 100 | 1.3 × people |
  | Smoke shed / Smokehouse | 4 preserves | 4 food, 1 wood | 80 | 7 × people in summer and autumn, else 3 × |
  | Tap room / Tavern | evening place | — | — | — |

  - Timber (tier 1) benches make 25% more per batch.
  - Benches never burn wood when the pile is below 12 + people.
  - Food is not smoked while stores are below 6 per person.
- **Makers** (`RoleId 'maker'`) work the bench whose good is furthest
  below its target and has materials (`pickTrade`); otherwise they salvage,
  haul and build.
  - The survivors staff the trades themselves (`staffTrades`): with
    benches built and 5+ people, one person a day moves to maker, up to
    ceil(benches / 2), at most 3. Tinkerers, those hoping to craft and
    hoarders go first, drawn only from over-staffed roles.
  - Newcomers fill the role too (`neededRole`).
- **Effects:**
  - Tools make builders, farmers, foragers, fishers and makers up to 25%
    faster (`toolFactor`, in `workRate`). They wear at 0.035 per worker
    per day.
  - Clothes wear at 0.012 per person per day (0.03 in winter). Winter
    comfort drops by up to 4 for the unclothed share. Cold nights and
    sleeping out hurt less when clothed.
  - Preserves never spoil and don't count against storage. They are
    opened when food falls below 3 per person.
  - The tavern takes about half the village most evenings (social need
    +25/h, like the hall) and adds 1 to comfort. It costs up to 2 food a
    day while stores are comfortable.
- **Need tiers** (`trades.ts#needRows/needTier`, shown in the plans panel
  as "Needs · Settled · next: Thriving"):
  - Getting by: 3 days of food (with preserves), a bed for everyone,
    6+ firewood.
  - Settled: tools for 40% of workers, clothes for 60% of people, a
    cellar or preserves of 2 per person, half the households in homes.
  - Thriving: a tavern, a shrine and 2+ lanterns, a festival within 24
    days.
- **What the tier does:**
  - Mood: −2 / 0 / +1.5 / +3 by tier. From day 16, each unmet Settled
    need costs −0.75.
  - Newcomers are drawn at ×0.6 / 1 / 1.4 / 1.8 of the usual rate.
  - Glasshouses (house level 2) need Settled.
  - Reaching Settled and Thriving is news in the log.
- **Council:** proposes the tool bench, smoke shed (summer and autumn),
  sewing room and tavern, each spoken for by someone who wants it. At
  most one trade per council. The Folk's emissary proposals were raised
  (festival 1.4, land 1.3) so they aren't crowded out.
- **Autoplan** starts a trade only from a surplus of wood (its cost + 20),
  so a trade is never worth a cold night.
- **Rendering** (`render/trades.ts`):
  - Trade buildings are small procedural salvage houses (`buildHouse`)
    clad from `village.salvaged` (`Project.clad` → `Building.clad`).
  - Each has props: an open tin lean-to with anvil, stump and grindstone;
    a washing line of cut cloth; smoke racks hung with fish, and split
    wood; a tavern porch with benches, a cable-drum table, barrels, a
    hanging sign and a string of bulbs.
  - Cellars (a turfed mound with a door front) and shrines (a cairn, a
    roofed niche, candles and flowers) are drawn at last. Before, they
    had no mesh.
- **Probe** (48 colonies × 48 days, self-planning):
  - by winter: need tier 1.9 (0–3), 3.9 trades, 1.9 makers, 7.7 tools,
    14 clothes, 41 preserves;
  - no deaths or departures, morale 69;
  - homes 3.8 (4.4 before: builders now also raise the trades).
- **Tests:** `tests/trades.test.ts`.

### 21.7 Step 5: district-only materials (built)
- **Glass, copper and steel** are new cost materials (`Cost`, `Resources`,
  `MATERIALS`/`RARE` in buildings.ts). Heaps never give them. They are
  *in the old buildings*, and nobody strips a building while something
  lives in it, so they come only from districts that are cleared and the
  village's (`rare.ts#strippable`). Scrap and cloth from heaps are
  unchanged, so the early game is untouched.
- **Yields by ruin kind** (`rareTotal`: w × d / 7 × a per-kind factor ×
  (1 − decay / 2), clamped to 2–12):

  | Material | From | What |
  |---|---|---|
  | Copper | house, terrace | pipe and wire |
  | Glass | shop, farmhouse, chapel, glasshouse | plate glass, windows, leaded glass, greenhouse glass |
  | Steel | garage, bigbox, warehouse, silo | beams and car lifts, roof trusses, girders, plate |

  Suburbs and old towns give copper; retail parks glass and steel; works
  steel; garden centres glass.
- **Strip or restore:** a ruin that is restored (or being restored) can't
  be stripped; what's left in it stays. A district given to the Folk can't
  be stripped either.
- **Stripping** (`colony.ts#pickStrip`, task `strip`):
  - builders (after salvage) and makers go when a material is wanted:
    outstanding on a site, or below a stock of 6;
  - they take the nearest ruin with the most-wanted material, at most two
    people at once, not after 15:00;
  - 50 minutes of work takes up to 3, carried home;
  - the first haul of each material from each district is news: "…You
    can't get that from a junk heap."
- **What needs them:**
  - The glass dome (new, `dome`, 4×4): a geodesic greenhouse, 12 wood,
    6 scrap, 12 glass, 4 steel. Tended like a garden, it gives 3 food a
    day in every season (×0.8 in winter). It also satisfies Beauty.
  - Glasshouses on homes (level 2): now 6 glass and 2 copper as well.
  - The timber versions of the trades: toolmaker's shop 3 steel, tailor's
    shop 2 glass, smokehouse 1 steel, tavern 3 glass and 1 copper.
    `tierFor` builds the salvage version when they're lacking, so placing
    a trade never stalls on rare salvage.
  - The self-planner raises a dome only when it has the glass and steel,
    and plans glasshouses only with the rare materials in store. The
    council proposes a dome when 10+ glass and 3+ steel are in.
- **Pointing at the districts:**
  - When a site waits on a material that nothing cleared can supply, the
    log says where it is, every 6 days (`rareDaily`/`whereToFind`): "…
    There's plenty in Alder Close, if anyone dared go in (clear it first:
    click it on the map)."
  - The district card lists "In the walls: copper 24 · steel 6 (only once
    it is cleared)".
  - The Build menu marks rare costs: "glass, copper and steel come from
    cleared districts".
- **HUD:**
  - A Glass·Cu·Steel cell appears in the resource bar once any district is
    cleared (or any is held).
  - "Explored" moved from the bar to the clock line to make room.
  - Costs are shown with `costText` everywhere.
- **Probe:** unchanged in essentials (no deaths, morale 68). The need tier
  mean is 1.5: self-planned villages never clear, so they don't get
  glasshouses or domes. That is the pressure intended.
- **Tests:** `tests/rare.test.ts`.

### 21.8 Step 6: the Folk build by night (built)
- **Orders any time, built after dusk.**
  - "Ask the Folk" in the Build menu, or "Ask them to build… (by night)"
    on the Folk card, places an order in the Wild (`folk.ts#orderFolkWork`).
  - An order must be in the Wild, off their paths, clear of trees, the
    hill and other works (2.2), and the Folk must be met and not soured.
  - It waits as a faint lavender ring with six stakes, one lit for each
    third built (`render/folk.ts#order`).
- **Night building:**
  - Hobs, sprites and elders out between dusk and 04:30 go to an order
    (70%) when its materials are in hand. On arrival they spend its dew
    and song (once) and build a third (a half with focus "their hill").
  - When done it grows in over the next days like their own works, and
    the news says who finished it.
- **Their materials, gathered each night** (`gather`, capped at 40; none
  while soured; ×1.5 with focus "their hill"):
  - dew: 1 per sprite, 1 per moon garden (up to 4), plus 0.5;
  - song: 1 per piper, 0.5 per elder, 1 per ring (up to 4), plus 0.3.
  - They start with 4 dew and 3 song.

  | Work | Dew | Song | Does |
  |---|---|---|---|
  | Bower | 5 | 2 | beds for two (Rest) |
  | Dancing ring | 2 | 6 | song each night (Dance) |
  | Glow-lantern | 3 | 1 | light for their paths (Light) |
  | Moon garden | 1 | 1 | dew each night |
  | Boundary cairn | 2 | 2 | the Wild heals around it |

- **Their needs** (`folkNeeds`, on the Folk card):
  - Room: the land they want;
  - Rest: bowers × 2 ≥ beings + 1;
  - Dance: rings ≥ 1 + level / 3;
  - Light: lanterns ≥ 1 + level / 2;
  - Gifts: an offering within 3 days.

  Growth speed scales with how many are met (×0.4 to ×1). Rest, Dance and
  Light gate it: without them growth stops at 95%, and every 6 days the
  news says what they need.
- **Consolidation:** their own random building on focus "their hill" is
  gone. That focus now means more dew and song and faster building. They
  still add a work of their own when the hill grows.
- **Self-planning:** in headless runs (`autoPlan` not false) the Folk order
  what their needs call for (`selfOrder`), as the village plans for itself.
- **Debug hooks:** `__game.folkOrder(kind, x, z)`, `__game.folkWhy(x, z)`.
- **Tests:** `tests/folkbuild.test.ts`.

### 21.9 Step 7: shorter seasons, the moon, and the rebalance (built)
- **Measured first.**
  - At 1×, a game day is 12 real minutes (2 game minutes a second). With
    12-day seasons a year took 9.6 hours at 1× and 72 minutes at 8×.
  - The day length is kept (it sets how fast people move on screen);
    seasons are shortened instead.
  - **Seasons are now 8 days** (`DAYS_PER_SEASON`; a year of 32). That is
    6.4 hours at 1×, 2.1 hours at 3× and 48 minutes at 8×. Changing the
    one constant rescales everything below.
- **Everything seasonal is derived from the calendar**
  (`SEASON_SCALE = 12 / DAYS_PER_SEASON`):
  - crop growth, fruit ripening and sapling growth per day (so a crop
    still ripens within one summer);
  - the last day for sowing (half-way through summer);
  - the visual year (`seasonLook`: autumn colour, bare trees, blossom,
    snow) and daylight (`daylightHours`: midsummer and midwinter), scaled
    from a 48-day year;
  - the council's gate policies (one season), the Moth Woman's blessing
    (two seasons), the festival need (two seasons), the jar and ration
    hints, and glasshouses (from about 0.83 of a year, then two-thirds of
    a season apart).
  - Day-based thresholds (joinery from day 8, needs weigh from day 16,
    the council every 4 days) are left in days: days are the same length.
- **The moon.** A full moon once a season, two-thirds of the way through
  (`isFullMoon`, `daysToFullMoon`). It shows on the season line ("· full
  moon", "· full moon tomorrow").
- **The Veil is free on the full moon and during a festival**
  (`haunt.ts#veilCost`; the district card's button says "free tonight").
  This was a to-do from §20.
- **Probe, one year** (48 colonies; 32 days now against 48 before):
  - Holds: no deaths, departures, hungry days or cold nights; morale 67
    (68 before).
  - Less gets done in a shorter year: food at winter 122 (162), 8.3 people
    (10.8), 3.2 homes (3.8), joinery later (1.7 joiners against 3.2).
  - Need tier 1.7. The per-minute pace is unchanged.
- **Probe, 1.5 years:**
  - 10.5 people, morale 77 in the second spring;
  - no deaths or cold nights;
  - one colony of 48 had a single hungry day at the end of winter (its
    stores fell to 0.7). Watch this in play.
- **Scripts:** `npm run sim` and `npm run balance` default to one year and
  read winter from the calendar.

### 21.10 Autopilot, and trades in the back yard (built)
Two requests from the user after version 19:
- **Autopilot**, for letting the game run unattended while building and
  testing.
  - It is switched by the Autopilot button (remembered in localStorage) or
    `?auto`, and sets `village.autoPlan`.
  - The village plans and places its own buildings, home plots (along lanes
    and the green), restorations and backyard trades. The site finder faces
    doors to the busiest path alongside, else toward the fire at the
    village's centre.
  - The Folk order their own works.
  - A council that is not answered within 10 real seconds settles on its
    favourite, the best-backed affordable proposal (`main.ts#councilAutopilot`).
    The countdown shows in the council panel, and the pointer over the
    panel holds it.
  - Proposal cards say "they choose the spot themselves".
  - Pressing play while a council waits now sets the speed to resume at
    once it is answered, so an unattended game never stalls paused.
  - Switching autopilot off hands placement back to the player.
- **Trades in the back yard** (`sim/backyard.ts`), after Manor Lords'
  burgage extensions: building isn't cheap after the collapse, and not
  every business needs its own building.
  - The tool bench, sewing room and smoke shed (now 3×2) go at the back of
    a household's plot. The spot is the deepest free one behind the house
    (`backyardSite`), and the door faces the house.
  - They are named for the household ("Hollis and Jory's tool bench") and
    clad in the same salvage as the house. Yard features on that spot give
    way.
  - One trade per household, and only once its house is finished.
  - In the Build menu, pick the trade, then click a household's plot.
  - The household staffs it: one member becomes the Maker (`staffTrades`).
    That maker works only their own household's bench (`pickTrade(…,
    maker)`).
  - A trade of their own adds 0.6 to the household's home comfort.
  - The tavern and the glass dome stay standalone.
  - The council proposes backyard trades only once some household has a
    finished house. Self-planning uses `autoBackyard`, which picks the
    household with tinkerers, crafters or makers (fishers for the smoke
    shed).
- **The Folk's seat at council:** if the Folk have something to ask and
  haven't been heard for 8 days, their proposal takes the last seat
  (`council.folkDay`). This replaces relying on its score.
- **Probe, one year:**
  - no deaths or cold nights, morale 67, food at winter 154;
  - 2.1 trades and need tier 1.0 (3.5 and 1.7 before). Trades now wait for
    finished houses, one per household. Revisit if the Settled tier comes
    too late in play.
- **Tests:** `tests/backyard.test.ts`.

## 22. Unattended runs (after version 20)
The user wants to leave the game running for hours and then look at how the
systems behaved, with the least dependence on their feedback. The work, in
order: save and resume, multi-year soak testing, a chronicle of the run.

### 22.1 Save and resume (built)
- The colony is plain data (objects, arrays, Maps, Sets, typed arrays; the
  random stream is a number on the community). A save is therefore the
  colony itself, stored by structured clone in IndexedDB (`ui/storage.ts`,
  about 4 MB), which keeps shared references (`village.site ===
  world.site`).
- `sim/save.ts`: `makeSave`, `restore` (checks `SAVE_VERSION`, refuses a
  mismatch), `migrate` (defaults for fields added since saves began).
- **When it saves:** every morning, and when the page is hidden or closed;
  never mid-clearing. The camera comes back with it. A game saved on
  autopilot resumes on autopilot.
- **Loading:** the page carries on the saved game unless `?new`, `?seed` or
  `?site` asks for a fresh one; those parameters are then removed from the
  address so reloads carry on. "New game" is in Testing tools. Republishing
  no longer loses a run, since the artifact's origin keeps its IndexedDB.
- The build target is ES2022, for the top-level await in `main.ts`.
- **Tested:** a colony saved mid-task on day 10 and restored is identical to
  the original after six more days, on two seeds (`tests/save.test.ts`).
  Also tested in the browser: reload, same day, buildings, people, felled
  trees and random-stream state.

### 22.2 Multi-year soak, and what it found (built)
- **`scripts/soak.ts`** (`npx vite-node scripts/soak.ts -- [colonies] [years]`)
  runs villages on autopilot. It reports means by season (people, morale,
  stores, homes, need tier, goods, the Folk, districts cleared, rare
  salvage, reachable and total scrap, active sites, ms per simulated day),
  a tally of unmet needs, and flags: errors, sites stalled for two
  seasons, collapse.
- **What autopilot now does in full** (`sim/autopilot.ts`, with
  `village.autopilot`):
  - lays out fields (about 8 tiles a head, in spring) and woodlots;
  - paints more Home ground when households find no room;
  - about once a season, with the village well and Influence to spare,
    sends a team into the nearest haunted district, played by the test bot
    while time at home stands still. A cleared district goes to the Folk if
    it suits them and they are friendly, otherwise to the village.
- **Findings, and fixes:**
  1. *Population capped at 14 by year 3.* `MAX_POP` is now 24. Time per
     simulated day is about 300 ms at 24 people (under 0.5% of a CPU at
     8×).
  2. *Salvage in explored, unhaunted ground runs out in year 2*, and sites
     stalled for seasons over 2–3 scrap.
     - With nothing known left, salvagers go to unexplored heaps within 45
       tiles (walking there explores it). 70 was too far: people went
       hungry carrying scrap home.
     - Autopilot clearings open the districts.
  3. *Starved sites held the only two build slots.* A site waiting on a
     material nobody has (not wood) no longer counts, up to four active.
  4. *Unreachable restorations* (a ruin's door beyond water or walls) sat
     forever. Ruins must be reachable to be restored (`reachableRuin`,
     cached). As a safety net, a site with no progress for two seasons
     while its materials are in store is given up, with the materials
     returned (`colony.ts#abandonStalled`).
  5. *Too many farmers, too few builders:* 8 of 14 farmed while the rest
     played cards at noon. Newcomers now build while builders are fewer
     than a quarter of the village.
  6. *Winter wood:* a tavern and upgrades started just before winter left
     the village with no firewood. In autumn the costly extras (trades,
     tavern, dome, timber rebuilds, glasshouses) wait until wood exceeds
     their cost plus the winter reserve (`winterReserve`), council-backed
     or not.
     - The Folk test now checks that a cut in the Wild never goes
       unnoticed. A village out of firewood in the cold may still cut
       there, by design (§20.6).
- **Soak after the fixes** (8 villages × 5 years):
  - no deaths or departures, morale about 80;
  - 24 people by year 4, need tier about 2 (Settled) from year 2;
  - 6–7 districts cleared, rare salvage about 18 in store;
  - one stall, which the safety net gives up.
- **Open, for balance:** food piles up past 1,500 by year 5 (nothing uses
  surplus), and homes plateau at about 8.5 for 24 people.
- **One-year probe (plain self-planning):** unchanged in essentials. No
  deaths or hunger; morale 66.

### 22.3 The chronicle (built)
- **Record** (`sim/chronicle.ts`, `col.chronicle`, saved with the game):
  - One sample as each day ends: people, morale, food with preserves,
    wood, scrap, homes, need tier, tools, clothes, glass/copper/steel,
    standing with the Folk and their hill's level, districts cleared,
    Influence. At most 2,000 samples, which is over 60 years.
  - Notable events, picked out of the log by what it says (`classify`):
    people (arrivals, pairings, the taken and their return), hardship
    (cold nights, hunger, departures, deaths, sites given up), council,
    the Veil and the Folk, milestones (joinery, first goods, tiers,
    restorations, rare salvage), building. At most 1,500.
  - `community.logCount` counts every log line ever written (the log
    keeps 200), so each line is read once.
- **Panel** (`ui/chronicle.ts`; the Chronicle button under the clock, or
  **C**):
  - twelve small line charts, one measure each on its own axis (steps for
    counts and tiers), winters shaded;
  - a crosshair shared across all charts: hovering any chart reads every
    measure on that day;
  - the events, newest first under a heading for each season, with filters
    and counts by kind;
  - "Numbers by season": a table of means.
- The first look (seed 6, two years on autopilot) showed a village whose
  clothes wore down to nothing with no sewing room built, so it never
  reached Settled. That is the balance item from §22.2, now visible at a
  glance.
- **Tests:** `tests/chronicle.test.ts`.

### 22.4 The start menu (built)
- Shown before the world is built (`ui/startmenu.ts`, awaited in `main.ts`):
  - **Continue**, with the saved village's place, year, season, day,
    people and how long ago it was saved;
  - **Start a new village**, choosing where they first shelter (anywhere,
    or one of the five sites), an optional seed, and autopilot. It asks
    before replacing a saved village.
- If the save can't be opened (an older version), the menu says so and
  offers a new village.
- Links with `?new`, `?seed` or `?site` skip the menu and start fresh (for
  sharing and scripts).
- In game, Testing tools has **Start menu…**, which saves and goes back to
  the menu.

### 22.5 Visual quality: less grain; lights that reach every house (built)
The user found the pixel look grainy when zoomed out, and better when
zoomed in. Their reference: pixelated but soft and warm, not jagged.
- **Diagnosis.** Hiding scene layers one at a time found three sources:
  - *Sub-pixel surface patterns.* Grit, leaf specks, plank grain, shingles
    and seams are fixed world sizes. Zoomed out, several fall inside one
    render pixel, and each pixel picks one at random: grain.
  - *Grass tufts.* Pale seasonal tints (straw in early spring, gold in
    autumn) on dark turf: confetti.
  - *Ivy on roofs and walls.* Tiny leaves with deciduous seasonal tints:
    pale specks on dark red.
  - Also, the colour grade stepped each RGB channel separately into 14
    levels, so neighbouring pixels on a gradient flipped between hues.
- **Fixes:**
  - *Surface detail* (`util.ts#surfaceTex`): each pattern fades out on its
    own as it gets smaller than a pixel (`lodk(frequency)`, from
    `fwidth`), toward its mean, so the average colour holds while the
    speckle goes. Leaves no longer force texture when far off.
  - *Colour grade:* only brightness is stepped, in 20 steps; hue stays
    continuous.
  - *Grass tufts (pixel look):* density ×0.28 (was ×0.45), colour close to
    the turf, and seasonal tints ×0.44 (autumn) and ×0.46 (bare).
  - *Ivy* (`station.ts#buildVineMesh`, ruin ivy): evergreen, with no
    seasonal tint. In the pixel look it has 40% as many leaves, 1.7× the
    size, and a deeper, narrower green, so it reads as masses.
- **The string lights are the village's power** (`plots.ts#planLights`).
  Before, they linked only homes 3–17 units apart, at most two strings a
  house, chosen greedily, so a far house got nothing. Now:
  - a spanning tree reaches every home, the commons hall, the kitchen and
    the tavern, running out from the commons;
  - runs longer than 12 units are carried on salvaged poles (3.1 m, with a
    crossbar), stepped aside onto open ground;
  - extra strings between neighbours under 10 units apart, up to three a
    house, keep the web.

### 22.6 Seeing through the woods (built)
The user found the Folk's mound and works nearly impossible to see, since
the Wild is woodland. They suggested near-transparent trees wherever the
Wild is painted.
- **Tried: a stipple** (4×4 ordered dither, 30% of canopy pixels kept).
  It works, but at the pixel look's scale it reads as a grainy net, the
  artefact §22.5 removed.
- **Built: rim ghosts.** A thinned canopy keeps only the surface turned
  away from the camera (|n · view| < 0.4), so each leaf clump becomes a
  thin outline bubble. Trunks, limbs and the canopy's shadow stay, so the
  place still reads as woodland, and whatever stands beneath is plain.
  - The decision is per clump, from the zone at its position (a
    vertex-shader lookup in `uZoneTex`), so a canopy never half-fades at a
    zone edge.
  - Kept pixels mark alpha 0.5; the outline pass leaves them uninked
    (otherwise every rim pixel would be inked dark).
  - Shadows use Three's own depth material, so they are unaffected.
- **Control:** a footer button and key O cycle *Wild thinned* (default) →
  *all thinned* → *full*; the choice is remembered per browser.
  `__game.setWoods(n)`.

### 22.7 HUD tidy: collapsible panels, a shorter log (built)
The user asked to be able to collapse the crew, the village plans and the
event log, and for a smaller log with a shorter running history.
- **Collapsible panels.** Village plans, the Crew and Events each have a
  title button with a chevron; collapsed, only the title line shows (the
  Crew shrinks to its name and count). The state is remembered per browser
  (`localStorage` `fold-<id>`); on phones the Crew starts collapsed.
- **Events** (was the unlabelled log): about five lines in view, scrolling
  back through the last 30 (the chronicle keeps everything). Collapsed, the
  newest line is shown beside the title. The remembered and the taken stay
  at the foot of the list.
- **Layout fixes.** The village plans and the log overlapped, and the log's
  last line sat under the footer when the footer wrapped to two rows. Both
  now live in one left column between the place card and the footer; the
  footer's and the place card's real sizes are measured (`--foot`, `--top`).
  The key hint line is hidden below 1500 px wide (each button's tooltip
  already has it), which was the main cause of the wrap.
- **Revised after v23: ghosts, not cutaways.** The user disliked the rim
  outlines ("not just cutaways") and asked for near-total transparency,
  trees becoming ghostly. Now:
  - The solid tree meshes discard ghosted instances entirely (`thin:
    'solid'`), trunks included, and a custom shadow material
    (`util.ts#thinDepth`) drops their shadows, so the ground beneath is lit.
  - Each tree mesh has a *ghost twin* (`util.ts#ghostTwin`): the same
    geometry and the same instance buffers (shared, not copied), an
    alpha-blended material with no depth write, drawn only where the solid
    one is cut. Colour: 60% toward a pale mint, scaled by the scene's own
    light (faint at night); alpha 0.05 on faces toward the camera, up to
    0.26 at the silhouette.
  - The twins are hidden while the woods are solid (`TreeField.setGhosts`),
    so they cost nothing then. The outline pass needs no special case: the
    ghosts are not in the depth buffer.
  - Button labels: *Woods: solid / Wild ghosted / all ghosted* (key O).

### 22.8 Economy balance pass 2: stores, homes, wood, festivals (built)
Diagnosed with the soak's new per-village report
(`npx vite-node scripts/soak.ts -- 6 4 --detail`: households, buildings,
roles, food by source, stocks, unmet needs).
- **Food piled up past 1,200** because storage kept growing: the council
  proposed a root cellar at every summer and autumn meeting, and ruins were
  restored as storehouses, giving 8–11 cellars and room for 1,000–1,700.
  Fields also made twice what was eaten (autopilot laid 8 tiles a head, and
  each 20 tiles drew a newcomer into farming).
  - Storage is wanted only up to `STORE_PER_HEAD` = 25 food a head (about
    two seasons' eating; `buildings.ts#storageWanted`), for the council,
    self-planning and restorations alike. Food above capacity spoils as
    before.
  - Autopilot lays new fields only while stores are below that.
  - Work follows need (`colony.ts#rebalanceWork`, every 4 days, one person
    at most): if the stores are still above 35 a head in spring (after
    winter has drawn them down), or above 60 at any time, a farmer turns
    builder; if stores fall under 8 a head with fields untended, a builder
    goes back to farming. Not in the first year, and never someone whose
    work the player chose this season (`Survivor.roleSetDay`).
- **Homes plateaued** with 6–9 households waiting: no plot fitted.
  Plot searches started only beside neighbours, along streets and on rings
  10–15 tiles from the fire, while autopilot painted new Home ground as
  discs of radius 6 some 20–36 tiles out, too small for an 8 × 11 plot.
  Plots are now also tried from every third Home tile, four ways
  (`homes.ts#zoneCandidates`), and autopilot paints discs of radius 9,
  14–30 tiles out.
- **A village ran out of wood for a year** (and so of tools): everything
  within 45 tiles was cut and autopilot never marked a woodlot, since it
  only looked for standing trees. It now marks bare ground (planted up by
  the existing rule), and choppers look out to 70 tiles when nothing is
  nearer.
- **Festivals were the most unmet need**: support for one came mostly from
  low morale, so a happy village rarely held one. An overdue festival (1.5
  seasons since the last) now scores higher and gains support from
  everyone.
- **Soak, 6 villages × 4 years, before → after:** homes in year 4 8.7 →
  11.5; winter food 1,214 → 508; cellars 8–11 → 2–4; winter wood 77 → 114;
  need tier late 1.8–2.2 → 2.8–3.0; at the end, five of six villages meet
  every need (the sixth lacks a festival). No deaths or stalls. Unmet needs
  now fall mostly in years 1–2.
- **One-year probe** (plain self-planning, 16 villages): morale by season
  unchanged (65/67/69/63); a few more people fed. The probe measured winter
  from day 37, left over from 12-day seasons; it now uses the calendar.
- **Open:** simulation time per day rises to about 390 ms at 24 people in
  year 4.

### 22.9 Simulation performance at 24 people (built)
- **Profile** (`NODE_OPTIONS=--cpu-prof`, one village over 4 years): 47% of
  the time went to choosing tasks, mostly nearest-tile searches that found
  nothing (planting bare woodlot within 70 tiles: 13%; foraging: 9%;
  the nearest shore for leisure: 9%; the scout's rays: 6%), repeated at
  every decision. Pathfinding was 18%.
- **Fixes:**
  - A search memo on the colony (`colony.ts#quiet/hush`, `Colony.memo`):
    a search that found nothing isn't repeated for a while (trees and
    planting 60 game minutes, foraging 30, scouting 120); the nearest shore
    is found once a day. The memo is saved with the colony, so a restored
    game continues exactly as before.
  - A* heuristic weight 0.8 → 0.95 (most ground costs 1): paths stay close
    to optimal and still prefer lanes, with far fewer tiles expanded.
- **Result:** 6 villages × 4 years in 85 s (was 152 s); about 160 ms per
  simulated day at 24 people in year 4 (was about 390). Balance unchanged
  (all six villages meet every need at the end).
- **Found on the way:** a house's door step could land on blocked ground.
  Plots now require the tile outside the door to be passable.

### 22.10 Rendering cost of a grown village (built)
- **Measured** with `scripts/shots/perf.mjs` (simulates N days on autopilot,
  then reports draw calls and triangles per pass and per scene group, by
  hiding each group in turn). Seed 1, farm, 96 days, 18 people, 39
  buildings: 1,621 draw calls and 2.4 M triangles a frame, 892 of the calls
  in the sun's shadow pass.
- **Where the calls went:** field fences 429 (every post and rail its own
  mesh), trees 251, the village 216, the Folk's works 164, people 160,
  yards 102, the fairy ring 88.
- **Fixes:**
  - Field fences, the Folk's works and the fairy ring are merged into one
    mesh per material (`merge.ts#mergeStatic`, with the real ground height
    for the baked contact shade); the Folk's lit lanterns stay live.
  - Ghost trees (§22.6) are drawn only for tree chunks with a tree on the
    Wild (all chunks in "all ghosted"), rechecked when zones change.
- **Result:** 986 draw calls (−39%): fields 429 → 7, the Folk 164 → 13,
  trees 251 → 221 (1.15 M → 0.89 M triangles). Screens are unchanged.
- **Left as is, for the user to decide:** the survivor figures have
  8,300–9,800 triangles each (about 640 k a frame for 18 people across the
  main, x-ray and shadow passes). They could be simplified (for example
  with meshopt at ~40%), but the figures are still being iterated on.

### 22.11 Pacing audit (measured; nothing changed)
The user asked for a measured picture of what the player does before any
first-hour guide. Two scripts:
- `scripts/pacing.ts` (`-- [villages] [days] [--strips] [--json=…]`):
  autopilot stands in for an attentive player. Every game hour it records
  what the game asks (a council, an agreed build to place, a household
  wanting a plot, someone led astray), what first becomes possible (each
  building affordable, the timber version, a clearable district, the Folk
  met, each Folk work affordable, Influence for each nudge), notable events
  (the chronicle's classes), the need tier and unmet needs.
- `scripts/choices.ts` (`-- [villages] [days]`): the same villages under
  different council policies (the favourite; the least backed; Folk-minded;
  village-minded; homes first), compared after N days, against a control
  (the same favourite chosen at a different moment), which measures how
  far a deterministic run drifts from any change at all.

A game day lasts 12 real minutes at 1×, 4 at 3×, 1.5 at 8×.

**Findings (8 villages × 64 days, i.e. two years):**
1. *Decisions asked:* about 0.4 a game day, i.e. one every ~30 real minutes
   at 1× or ~10 at 3×. Councils come exactly every 4 days (the cadence is
   fixed in `resolveCouncil`); home petitions are 30% of all proposals.
   50–64% of days (from Y1 summer) ask nothing and offer nothing new, but no
   stretch exceeds 4 days, because the next council always comes.
2. *Everything opens in the first week:* the Folk are met on day 2 (1–6),
   all five Folk works are affordable the same day, a district is clearable
   on day 2, the nudges by day 4, and most buildings are affordable by day 6.
   Only the tool bench and tavern wait (day ~20). After day ~20 nothing new
   becomes possible, except timber versions of what exists. The build menu
   shows every building from the start.
3. *The need ladder runs out early:* median tier 3 (Thriving, the top) from
   the end of Y2 spring (day ~40, about 8 real hours at 1× or 2.7 at 3×);
   from Y2 autumn no need is unmet in any village. After that the game has
   no stated goal.
4. *A false alarm:* "Warmth" is met only with 6+ wood in store, in any
   season. In year 1 it fails on 34% of days, mostly spring and summer
   (builders use wood as it arrives), so the village reads "Struggling" in
   midsummer. Year 2: 3%.
5. *Council choices barely matter:* population, morale, homes, buildings,
   food and districts cleared move no more under any policy than under the
   control (ratios 0.6–1.7× the control's drift). The one systematic lever
   is Folk standing: Folk-minded 65.5, village-minded 51.6, least-backed
   52.0 (favourite 60.2; drift 7.3). Caveat: under autopilot the village
   also plans its own buildings, which dilutes build choices; in play the
   player places everything.
6. *Autopilot never orders Folk works,* so the Folk hill stays at level ~1
   in every soak: that part of the game is untested by the unattended runs.

**Proposals (for the user to choose):**
- A. *Staged options:* show buildings and systems as they become relevant
  (e.g. tavern with tier 2, dome after a cleared district, the Folk's works
  once met) instead of all at once in week 1.
- B. *A longer ladder, or goals beyond it:* something to strive for in
  year 2+ (a fourth tier, projects on the scale of the district, the Folk
  hill's growth as a stated aim).
- C. *Councils with consequences:* convene when there is a real question
  (not every 4 days), take home petitions out of the council (they are
  routine), and give choices lasting, visible trade-offs.
- D. *Seasonal warmth:* the firewood needed should rise toward winter
  (e.g. the winter reserve in autumn and winter, a little otherwise).
- E. *Autopilot orders Folk works,* so soaks exercise the Folk's growth.

### 22.12 Seasonal warmth; autopilot asks the Folk (built, being verified)
From the pacing audit (§22.11, proposals D and E), which the user approved.
- **Warmth** (`trades.ts#warmthWanted`): two days' firewood at the season's
  burn rate (`fireWood`): the cooking fire in spring and summer, heating as
  well in autumn and winter (at least 2). It was a flat 6 wood in any
  season, so villages read "Struggling" in midsummer on 34% of year-1 days.
- **Autopilot orders Folk works** (`autopilot.ts#autopilotFolk`): once the
  Folk are met and not soured, one order at a time for whichever of rest,
  dance or light is unmet (a bower, a ring, a lantern), on the nearest free
  spot in the Wild.
- The nearest shore (leisure and scrounging) is now found once a day for
  both (`colony.ts#nearestShore`).
- **Found while testing:** one soak village (seed 6) used up every scrap
  heap on its map by day ~40 (about 300 scrap in all) with every district
  cleared; homes, the tavern and lanterns then stalled for good, 3 people
  died around days 24–32, and simulated days slowed to 3–5 s. Salvage is
  finite on every map, with no renewable source once the heaps are gone;
  a design question for the user (e.g. dismantling ruins in cleared
  districts for scrap). The slow days are still under investigation.

## 23. Round 4: the user's direction after the pacing audit (after version 27)

### 23.1 Decisions
- **A. Staged options: agreed.** Buildings and systems appear when they
  become relevant, not all in week 1.
- **B. Goals past Thriving: agreed in principle; the user is thinking it
  over.** Their aim, in their words: town growth and the *symbiotic* growth
  of the Folk and the humans should feel symbiotic and fulfilling, and should
  press against the uncleared zones, so there is motivation to clear them.
- **C. Councils that matter: agreed.** Proposal (user asked for
  suggestions; order of work: overlay → councils):
  1. *A request tray for everyday asks:* home petitions (30% of proposals
     today) and small personal asks ("a lantern by our door") go to a
     non-pausing tray, answered whenever; answered asks lift morale and
     bonds, ignored ones fade and are remembered. The steady trickle.
  2. *The council convenes for real dilemmas only* (strangers at the gate,
     the Folk asking for land the village wants, a found district, a winter
     forecast that doesn't add up, a household quarrel), with a small hearth
     talk if nothing has come up for ~6 days. No fixed 4-day cadence.
  3. *Choices become visible commitments:* a HUD card with explicit effects
     and a timer ("Gates open, 8 days: newcomers ×2, food −1/day each").
     The passed-over remember, and may ask again.
  4. *Many dilemmas set village against Folk*, feeding B.
  5. *Measured with `scripts/choices.ts`:* success = policies move outcomes
     clearly more than the run's own drift.
- **Order agreed:** the plot keep-out overlay first, then councils (C), then
  staging (A), then B.

### 23.2 Backlog from the user (to do; sorted)
- **Plot drawing (UX, next):** "Something is in the way" with nothing
  visible. Show blocked tiles while drawing a plot (water, roads and
  paving, fields, the Wild and Folk paths, buildings and rubble, the fire,
  the stockpile, haunted ground, unexplored ground), and mark where a
  refused plot failed.
- **Cleared districts become fully usable, like the starting site (user
  insists):** today a restored ruin becomes a bunkhouse, workshop, storehouse,
  shrine or garden only; households never move into restored houses, and
  restored places get no string lights. Wanted: restored houses as homes
  with yards, households living there, the power network (lights, bunting)
  running out to them, and cleared districts as places the village grows
  into.
- **The Folk's mycelium network (feeds B):** under each mound, scaled to
  its size and health, a network spreading beyond its borders; toadstools
  pop up along the veins; a faint, pulsing, wispy underground web can be
  seen. The healthier the mound and the Wild, the healthier the network.
  Crops and buildings on the network share its fortune, according to the
  village's standing with that mound.
- **Technology from know-how:** large solar arrays, homemade wooden and
  electric windmills (solarpunk), feeding the power network: learned by
  doing and built from salvage, not eras.
- **Cars:** junk cars selectable for stripping and removal; later retrofit
  (electric carts) or rework into wagons if horses turn up. Related: salvage
  is finite (§22.12, seed 6 ran out by day ~40); dismantling cleared ruins
  for scrap is one renewable source.
- **Timber handling (Manor Lords):** felled trees lie as logs to be moved,
  cut up and processed (a chopping block or saw pit) before they are wood.

### 23.3 Plot keep-out overlay (built)
- While drawing a plot, every tile a plot may not cover is tinted within 22
  tiles of the cursor (fading at the edge): red for hard blocks (water,
  roads and paving, fields, other plots, rubble and rock, buildings, the
  fire, the stockpile), teal for the Folk's land, violet for haunted
  ground, dark for unexplored (`render/keepout.ts`).
- A refused plot marks the tile it failed on with a pulsing yellow ring
  for four seconds, and the hint names the reason.
- One rule set for both: the per-tile test moved out of `outlinePlot` into
  `homes.ts#plotTileWhy` (and `plotObstacles`), used by the overlay too.

### 23.4 Councils, step 1: the request tray (built)
- **`sim/requests.ts`, `ui/tray.ts`:** a tray in the left column ("Asks")
  that never pauses the game.
  - *Home asks:* each household waiting for a home has a standing ask:
    "Draw a plot" opens the plot tool; "First in line" puts them first for
    the next plot. Home petitions no longer come to the council.
  - *Personal asks near someone's house:* a lantern (the skittish, the low,
    the seeing), a kitchen garden (green thumbs, farmers), a shrine (high
    Sight). "Place a …" opens the build tool at their house; any such
    building within 7, 9 or 12 tiles fulfils it.
  - *Work asks:* someone whose aspiration points at other work asks to
    change ("Let them"). Not within 8 days of the player setting their work.
  - At most three personal asks open; about one new ask every two days;
    they fade after 6 days. Fulfilled: +6 morale and a memory. Declined:
    −2; faded: −3, and remembered.
  - Asks use their own dice (seeded by world and day), so they don't shift
    the rest of the simulation. Self-planning villages (tests, autopilot)
    queue a waiting household after 3 days, about the council's old pace;
    autopilot answers personal and work asks too.

### 23.5 Councils, step 2: dilemmas and commitments (built)
- **When it meets:** the council convenes when a question arises
  (`sim/dilemmas.ts#dilemmaDue`), at most every 2 days; if nothing has come
  up for 6 days (`HEARTH_GAP`), a hearth talk (the old proposal mix, minus
  home petitions and the Folk's land). No fixed 4-day cadence.
- **The questions** (most pressing first), each answer spelled out in the
  panel ("effect"):
  - *Winter won't add up* (early autumn, once a year, when wood or food is
    under 90% of the winter's need): all hands to the woodpile and hedges
    (4 days, no building), half rations now (8 days), or trust to luck.
  - *Strangers at the gate* (half of arrivals from 6 people on come as a
    group of 2–3): take them all in, take the one who can build, or send
    them on with food (8 each).
  - *Too long without a celebration* (1.5 seasons): hold a festival, dance
    at the Ring with the Folk (if friendly), or not now.
  - *The Folk ask for land* (their room need unmet, once a season): give
    the woods round the hill (standing +4), offer the far side (the Wild
    grows away from the village; +3), or refuse (−6).
  - *A quarrel* (a bond at −45 or worse): side with one, side with the
    other (the backed +6, the other −8, their friends −2), or mend it over
    a meal (10 food; bond +30).
- **Commitments:** choices that last are kept (`Council.commitments`) and
  shown as chips under the resources, with days left and the effect on
  hover, alongside the old timers (gates, rest day, festival). Half rations
  and all hands act in the simulation (`rationing`, the builder's work,
  `woodWanted`).
- **Measured** (`scripts/choices.ts`, 8 villages × 64 days, with new
  policies "first answer" and "last answer"): population now follows the
  strangers answers (first 15.0 vs last 10.3 people; drift 6.0) and Folk
  standing follows the land answers (−7 to −8 for refusing; about 3× the
  drift). Other outcomes still sit within the run's own drift.
- **Soak** (6 × 4 years, with §22.12 D and E): all 24 alive, no stalls;
  tier 3 from year 3; homes 12.7; the Folk hill reaches level 3.2 (was
  ~2.5 before autopilot asked the Folk for works); ~110 ms per day.
- **Found on the way:** fences waited forever for 20 wood to pile up, since
  building sites took every stick and nobody cut for fences. Sites now leave
  a worked field's fence timber on the pile, and it counts in the wood
  target. Chosen half rations don't open the Folk's berries (only real
  hunger does), and aren't announced as a shortage.

### 23.6 Playtest notes after version 28 (the user's; to do)
Published v28 (§22.12, §23.3–23.5). Sorted by kind; nothing here is built.

**Fixes and polish (little design needed)**
- *Benches clip into doors and steps:* the yard bench in front of a house
  overlaps the door and the entry stairs (two screenshots, day and night).
  Yard placement must keep clear of the door, its swing and the steps.
- *Pixel shimmer ("rooftops glitter"):* with the light changing
  continuously, the 1/3-resolution image, the posterised grade and the
  shadows re-sample differently every frame, so edges and roofs flicker
  when nothing is moving. Known remedies in pixel-art 3D (t3ssel8r-style):
  snap the camera to the pixel grid and apply the sub-pixel remainder when
  upscaling; snap the shadow camera to shadow-map texels; move the sun in
  small steps (or smooth its changes); optionally a softer upscale or a
  "pixel strength" setting. Measure it: frame-to-frame difference of a
  still scene (a flicker metric), before and after.
- *People walk through gardens and fences:* yard features and field fences
  don't block paths. Make them block, and where the wanted route clearly
  crosses a fence, put a gate there (opens by itself); a place for a
  decorative arch if the household likes.
- *Desire paths:* easier to form; they persist through the seasons, are
  kept clear of snow in winter, and are maintained by people who remember
  where they ran.

**Controls**
- *Every structure can be moved or taken down* (right-click: Deconstruct /
  Move). Deconstruct is a task that returns part of the materials; Move is
  a deconstruct here and a rebuild there.

**Life in the village**
- *Festivals and dances actually happen:* people gather, dance, eat
  together, visibly; generally more living in the town (not only working).
- *Relationships, codified:* courtship, marriages and weddings (an event
  people attend), children, a school.
- *Crossing into the Folk:* a human and one of the Folk falling in love;
  humans joining the Fey; Folk living with people for a time and returning
  to the hill; hybrid children with greater gifts.

**The Folk as equals (with B, §23.1)**
- *Blessing or curse:* good relations with a mound are a blessing, bad ones
  a curse (felt broadly: crops, luck, weather, health), and the mycelium
  network (§23.2) is where it reaches.
- *What a mound's growth means:* today a growth adds one of the Folk, raises
  the land they want, lets them make more works and do more nightly chores
  for the village, and asks for more rings and lanterns. Little of it is
  visible. Wanted: the mound as a Nunnehi townhouse, mostly underground,
  with an ethereal topside (ghostly buildings most humans can't see; seen
  with Sight or the Veil view), growing chamber by chamber: a second town,
  on equal terms with the village.

### 23.7 Fixes after version 28 (built; not published)
- *Bench:* `homes.ts#benchSpot` puts the yard bench on the chimney side of
  the front, clear of the door (house-local x = −chimney·0.2W) and of the
  steps, 0.55 in front of the wall. `save.ts` migration moves existing
  benches.
- *Fences, gates and beds on the walking grid* (`sim/hedges.ts`):
  `world.hedge` marks built field fences (as far as built), yard fences
  (sides and back), and beds, coops, sheds and woodpiles. `tileCost` adds
  `HEDGE_COST` = 4 on those tiles, so paths go round or through a gate.
  Nothing is impassable, so nobody is ever shut in. A field's own gate
  stays open. Where people still cross one fence tile `GATE_AFTER` = 10
  times, a gate is put in (`world.gates`, logged). It renders as posts, a
  leaf left ajar, and sometimes an arch with a climber
  (`plots.ts#gateMesh`). Fences leave a gap there. `syncHedges` runs daily.
- *Desire paths:* `PATH_WEAR` 25 → 18, so they form sooner.
  `world.pathMemory` holds max(memory·0.985, wear/LANE). Where the memory
  is at least 0.3, wear is kept at memory·LANE·0.85, so a path survives the
  seasons and is re-walked in spring. Worn ground is kept clear of snow
  (ground shader).
- *Shimmer (measured, then stopped at the user's request):*
  `scripts/shots/flicker.mjs` measures a settled camera over 48 fixed-step
  frames (`__game.flicker`, `fixedDt`). The metric is the fraction of
  pixels changed and "flips" (back and forth). At camp, dusk, 3× speed:
  changed pixels 3.98% → 1.87%, flips 0.29% → about 0.40% (within noise).
  Away from camp: 1.1% changed, unchanged. Kept changes:
  - the fire light and flames flicker in 8 Hz steps with small depth
    (`util.ts#calmFlicker`);
  - flames cast no shadow;
  - the camera arrives exactly at its zoom and yaw goal.

  Isolation showed the rest is the posterised grade (dusk) and shadows
  (morning). Options, not taken: fewer grade bands at dusk, and snapping
  the shadow camera to texels.

## 24. Proposal: the Folk as equals, and village life (for discussion)
This covers the user's notes in §23.6 ("Life in the village", "The Folk as
equals") and ties them to B (§23.1): growth that is symbiotic and presses
against the uncleared districts. Nothing here is built. The questions for
the user are in §24.7.

### 24.1 The principle: two towns, one ecology
The village and the hill each grow, and each one's growth needs something
only the other can give. Both then need room that only cleared districts
provide. The pressure toward clearing comes from both societies, not from a
quota. Each grows in its own register:

| | The village (by day) | The hill (by night) |
|---|---|---|
| Lives | on land, in the open | underground, with an ethereal topside |
| Makes | goods, food, buildings | dew, song, works |
| Grows by | homes, trades, tiers | chambers |
| Needs from the other | blessing: yields, luck, weather, health | offerings, festivals, Wild land, quiet, the living's company |
| Needs from the ruins | materials, room, ruins restored | haunts laid to rest (the dead are the Folk's business too); old places reclaimed as Wild |

### 24.2 The mound as a Nunnehi townhouse
Today `folk.level` adds a being and raises its wants, but almost nothing
visible changes. Proposed:

- **Chambers.** Each growth adds one chamber, chosen by the hill from what
  it lacks. Chambers are drawn only as a cutaway: the same interaction as
  a roof cutaway, but downward.

  | Chamber | What it does |
  |---|---|
  | Hearth-hall | Where they gather; the townhouse's council fire |
  | Sleeping bowers | Room for more of them (moves the bower underground) |
  | Dew-cellar | Stores dew |
  | Song-gallery | Pipers practise; adds song |
  | Root-archive | Their memory: lore, and the names of the village's dead |
  | Nursery | Needed for hybrid children (§24.5) |
  | Guest-room | Where a human may stay (§24.5) |

- **The topside.** On the surface stand ghostly buildings: a townhouse roof
  of light, lodges and bridges. Without Sight they are invisible: a faint
  shimmer, like the ghost-tree shader. With Sight or the Veil view they
  resolve. Survivors with high Sight comment on them.
- **Equal terms.** The hill gets its own tier ladder, as the village has
  (§21.6). Folk works (§21.8) become the hill's "build menu" at a larger
  scale. The mound shows its growth as the village shows its homes.
- **Growth wants room.** Each new chamber needs more Wild land within reach
  (`landWanted`). The nearest land is often a haunted district. A district
  laid to rest can be given to the Wild, or to the village, and that is the
  choice §24.4 makes meaningful.

### 24.3 Blessing and curse through the mycelium
Standing already runs from soured to kin. Proposed: a visible **mycelium
network** grows out from the hill under the ground, drawn in the Veil view
as faint threads, and brighter where fed. Its reach is where the hill's
mood is felt:

- **Blessed tiles** (standing friendly or kin): fields yield more, trees
  regrow faster, illness is rarer, and weather holds for festivals. Small,
  steady effects of about 5–15%.
- **Cursed tiles** (standing wary or soured): milk sours, tools go missing,
  bad dreams, crops blighted in patches. These are nuisances, not
  disasters, and they fit the "not combat-anxious" tone.
- **Growth of the network:** it grows along Folk paths, the Wild, moon
  gardens and cairns, and toward places the village honours (the shrine,
  graves). Cutting in the Wild severs it.
- **Uncleared districts block it.** A haunt is dead ground to the
  mycelium. Clearing one lets the network, and so the blessing, reach
  through. This is one concrete reason to clear.

### 24.4 Cleared districts become places (the user's insistence, §23.2)
A cleared district should be as usable as the starting site. Proposal:

- The tile grid and zones cover the district fully once it is cleared, so
  it can hold plots, fields, lanes, lights and bunting.
- When a district is cleared, a council question asks what it becomes:
  - **resettle it** (a second hamlet: ruins restored as homes, its own
    green);
  - **give it to the Wild** (the hill grows toward it, the mycelium
    spreads, and ghost buildings rise over the ruins by night);
  - **share it** (a village street with Folk works among the gardens:
    slower for both, with the strongest blessing).
- Each choice is permanent enough to matter, and each feeds a different
  growth. This is the "press against uncleared zones" loop.

### 24.5 Village life
Bonds (`Bond`, friend/close/rival) and households already exist. Additions:

- **Courtship to wedding.** A close bond between two unpartnered adults can
  become courtship: time together at evenings, walks, small gifts. After
  some days they may marry. The wedding is an event people attend: a
  gathering on the green, a meal, a dance, then the couple forms or merges
  a household. They may ask for a home (the tray, §23.4).
- **Children.** A partnered household with room and food may have a child.
  Children grow in game-years; with 32-day years, this is roughly 1 game
  year = 1 life year, adjustable. Children play, help at small tasks, and
  learn know-how from those they follow (`purpose.ts`).
- **A school.** A building from the menu once there are several children.
  Know-how spreads faster, and a teacher role appears. Children who
  attended start adult life with some know-how.
- **Festivals that happen.** People walk to the green, a fire is lit, food
  is laid out, and there is dancing in rings (reusing the Folk dance
  motion), with music and lanterns. It lasts the evening, and work stops.
  Festivals also host weddings and naming days.
- **Evenings out.** The tavern, the green, and porches with benches: more
  visible leisure (fun, beauty and purpose, §20).

### 24.6 Crossing between the peoples
Ordered from lightest to deepest, each needing more standing:

1. **Guests.** One of the Folk lodges with a household for a season (at
   friendly standing or above), bringing a small blessing to that home.
   A human may stay in the hill's guest-room and come back changed, with
   more Sight, a gift, and perhaps months lost to time dilation (as with
   "taken", §19.7).
2. **Romance.** A human and one of the Folk can form a bond: meetings at
   rings and bowers at night, noticed by the village, with Veil events
   around it. It can end in:
   - a handfasting at a festival, where the human now lives in both places;
   - the human choosing the hill (they leave the village, alive, as the
     existing `left`, and sometimes visit at full moons);
   - heartbreak, if standing sours.
3. **Hybrid children** ("changelings", in the old, fond sense). They need
   the Nursery chamber and a handfasting. They have a greater gift (Sight,
   healing, or speaking for both towns at councils). They are rare, at most
   one or two per village.

Grief, permadeath and the Veil's uncanny tone should stay intact. Crossing
has costs: time lost, a person who drifts away, and a hill that can take
offence.

### 24.7 Questions for the user
1. **Order.** The proposed order is:
   1. festivals that happen, plus the wedding/courtship chain (visible and
      cheap, built on existing bonds and households);
   2. the townhouse chambers and ghost topside;
   3. the mycelium blessing and curse;
   4. what cleared districts become;
   5. children and a school;
   6. crossing between the peoples.

   Or should the Folk side come first?
2. **Children's pace.** Should children grow quickly (adult in about 4–6
   game years), or should the village mostly grow by strangers arriving,
   with children as a slow, rare joy?
3. **Curse strength.** Only nuisances, or can a curse really hurt (a failed
   harvest, an illness)?
4. **Hybrids.** Rare and special (one or two per village), or a real
   population over time?
5. **Topside visibility.** Invisible without Sight, or always faintly
   visible so the player can admire it?

### 24.8 Festivals and weddings that happen (built; the user's first pick from §24.7)
- **Gatherings** (`sim/gatherings.ts`, `Colony.gatherings`). A festival,
  a dance with the Folk, or a wedding is held on a given evening:
  - festivals 17:30–23:30 by the fire;
  - Folk dances 18:30–23:30 at the Ring;
  - weddings 15:00–22:30 by the fire.

  Agreeing a festival at council now *schedules* it (this evening if
  there is time, else tomorrow). The HUD chip says when. Everyone who
  isn't worn out downs tools and walks there (`gather` task).
  - *Phases:* arrive, then the feast (seated on the ring, eating), then the
    dance. In the dance people go round the fire hand to hand, one or two
    play (storytellers first: fiddle, accordion, a bucket drum), and the
    worn out or old sit and watch. At a wedding, the couple stand under an
    arch of flowers for their vows, then everyone cheers. At the Ring, the
    Fae dance in the ring among the villagers.
  - *Effects* go to whoever came, at the end: morale, bonds between those
    present, the land's nurture, and the Folk's standing plus a name
    learned. A small lift comes at the agreement itself.
  - Rest drains at half rate at a gathering, and people stay until rest
    < 3, so the dance lasts into the night.
  - Seats and dancers are placed only in open sectors of the ring (not
    through buildings or the old cars).
- **Courtship** (`courtshipDaily`). The closest free pair of adults (bond
  ≥ 55, age gap ≤ 16) may start walking out: a 30% daily chance, at most
  one new pair a day. They spend fine evenings sitting by the water, and
  their bond grows by 2 a day. A bond below 30 ends it. After 5 days at
  bond ≥ 70, they decide to marry, and the wedding is held 2 days on
  (1 food per guest at the feast). At the wedding they become partners
  (`Survivor.partner`) and one household: the mover joins the partner
  whose home has room; otherwise they set up together and wait for a home.
  The person card shows "Married to", "Walking out with", or "Widowed".
  No gender rules.
- **Render** (`render/gathering.ts`). Poles with bunting and string
  lights, trestle tables with food and benches, the wedding arch, and
  foxfire jars at the Ring. They are put up 2 h before and taken down 1 h
  after. New poses: `dance` (Walk clip, arms out), `play` (seated fiddle),
  `cheer` (Wave).
- **Measured** (`scripts/life.ts`, 6 villages × 64 days): 2–3 festivals
  and 1–2 weddings per village, and 1–3 courtships. The smallest village
  (6 people) had none. Everyone present attends.
- **Debug:** `__game.gather('festival' | 'folk_festival' | 'wedding')`.
- **Next** from §24.7 (the user's order): the townhouse chambers and
  ghost topside, then the mycelium blessing and curse. Children and a
  school, and crossing between the peoples, come later. The questions on
  children's pace, curse strength, hybrids and topside visibility still
  stand.

### 24.9 The mound as a townhouse (built)
- **Chambers** (`sim/townhouse.ts`, `FolkSociety.chambers`). The hill
  starts with a hearth-hall and one sleeping chamber. Each growth adds one
  chamber, chosen by what the hill lacks (`nextChamber`), in this order:
  1. sleeping bowers while there are fewer than one place per being;
  2. a dew-cellar if dew is low;
  3. a song-gallery if song is low;
  4. a root-archive once a villager has died;
  5. a nursery from growth 3;
  6. a guest-room at standing ≥ 70;
  7. otherwise whichever of the dew-cellar or gallery is missing, else
     more bowers.

  Effects, all small:

  | Chamber | Effect |
  |---|---|
  | Sleeping bowers | +2 places toward Rest |
  | Dew-cellar | +2 dew a night, cap +20 |
  | Song-gallery | +2 song a night |
  | Root-archive | Grieving villagers mend a day sooner every other day (at standing ≥ 20) |
  | Nursery | Growth ×1.25 |
  | Guest-room | One more night chore for the village |

  A growth's news names the new chamber. Old saves get one chamber per
  past growth.
- **The ghostly topside** (`render/townhouse.ts`). Each chamber has a
  counterpart on the hill:

  | Chamber | Topside |
  |---|---|
  | Hearth-hall | A seven-sided lodge with a conical roof on the crown, fire-glow at the smoke-hole |
  | Sleeping bowers | Domed lodges on the shoulder |
  | Dew-cellar | A dew well |
  | Song-gallery | Reed pipes |
  | Root-archive | A lantern tree, one light per name of the dead |
  | Nursery | A cradle between posts |
  | Guest-room | A lodge with a lit, open door |

  All are additive "ghost" materials. Visibility answers the user's open
  question 5 with a middle path, open to change:
  - to most eyes a faint shimmer (opacity ~0.07 of full), day or night;
  - clear after dark if anyone in the village has Sight ≥ 45;
  - plain in the Veil view, or through a sighted person's eyes.
- **Under the hill.** In the Veil view the chambers glow through the
  earth (no depth test), joined by tunnels to the hall and by a passage to
  the door. The Folk card has an "Under the hill" cross-section: the hall
  with chambers left and right, a tooltip on each (what it does, and what
  stands above it), and a list with counts.
- **Debug:** `__game.dig(n)` grows the hill n times.
- **Next:** the mycelium blessing and curse (§24.3).

### 24.10 The mycelium: blessing and curse (built)
- **The network** (`sim/mycelium.ts`, `Colony.mycelium`) lives on a
  4-tile grid. Each day every cell moves toward
  min(what its ground carries, its strongest neighbour × 0.86), growing at
  most 0.12 a day and withering 0.03 a day.
  - *What ground carries:* soil 0.42, plus up to 0.45 more for Wild and
    Folk paths. Paving and water carry nothing.
  - *Folk works:* 0.9.
  - *The hill:* always a full source.
  - *Hubs:* the Ring, the shrine, Sacred ground and the memorial. Once the
    network reaches one, it grows strong again from there.
  - *Districts:* an uncleared one is dead ground. A cleared one carries
    0.4 (village) or 0.8 (given to the Folk).
  - *Cutting in the Wild* severs the cell (−0.35).
  - *Reach:* on plain ground the network gets about 9 cells (36 tiles)
    from the hill, so bringing it into the village takes the Wild, paths,
    works or hubs. Measured with `scripts/mycelium.ts` (6 villages × 64
    days): it covers 0–100% of the fields and 0–75% of the homes.
- **Mood** (`folkMood`): standing ≥ 45 is a blessing (0.4 to 1), < 30 a
  curse (up to −1), and in between neither.
  - *Blessing:* growth up to +15% where it reaches (`landFactor`: crops,
    berries, yards); +0.6 morale a day for people sleeping in blessed
    homes.
  - *Curse (nuisances only, per the proposal's default; the user's
    question on curse strength stands):*
    - growing crop rows go black in patches (at most 6 a day);
    - food turns in the stores (up to 4) if the network is under the fire;
    - bad dreams (−2 morale) in cursed homes.

    The old soured mischief (§19) still applies everywhere.
  - Chances use a hash of the day, not the random stream.
- **Seen** in the Veil view (`render/mycelium.ts`): threads from each
  cell to the neighbour it grew from (a branching network), with knots
  where it is thick. They are gold while blessing, violet while cursing,
  blue between.
- **The Folk card** says what share of fields and homes it reaches, what
  it is doing, and how it grows.
- **Next:** what cleared districts become (§24.4), then children and a
  school (§24.5), then crossing between the peoples (§24.6).

### 24.11 The user's answers to §24.7 (after version 31)
- **Children take as long as it really takes to grow up.** No accelerated
  growth: one year of age per game year (32 days), so a child born in
  year 2 comes of age around year 20. This may be sped up later. It
  needs survivors to age with the calendar; today age is fixed at
  arrival.
- **Lineage in the Crusader Kings manner:** notable families, a slow
  build, a story that emerges. Planned:
  - family names carried down;
  - a family tree per person;
  - houses that become known for something (a craft, the Sight, service
    to the council, kinship with the Folk);
  - heirs to homes and plots;
  - the chronicle telling the families' story.
- **Hybrid children:** somewhat rare, at most 5–10% of the children.
- **Topside visibility:** keep as built (§24.9).
- **Finite scrap:** not met in play yet; deferred. The user's thought:
  exhaustion could be what pushes the village to take territory, which
  fits district-only materials (§21.7) and B.
- **Survivor figures:** less lanky, more realistic, then decimated.
  Proposed timing: together with children, since children need a child
  build of the same figure (one pipeline: proportions, child variant,
  decimation).
- **Order kept:** cleared districts (§24.4) → move and deconstruct →
  figures and children with lineage → crossing between the peoples →
  staging (A) → B.

### 24.12 Cleared districts become places, step 1: depaving and sharing (built)
- **Measured first** (3 seeds, the nearest district cleared and given to
  the village):
  - 37–62% of a district's squares are paving (car parks, roads, slabs);
  - plots, fields, woodlots, the Wild and buildings all refused paving;
  - the rest is ruins (blocked) and the walkway margin around them.

  So the missing piece was ground, not rules. The village already had
  zoning, restoring ruins and stripping rare salvage there.
- **The Depave brush** (zone bar; `sim/depave.ts`). It marks explored,
  unblocked paving outside haunted ground; the marks show orange-hatched
  on the zone overlay, and Erase unmarks. Builders (after their building
  work) and farmers (when idle) break it up: 40 minutes a square, the
  `depave` task, with tile claims released if interrupted. The square
  becomes Grass, and every 4th square gives 1 scrap. It works anywhere,
  including the starting site's own car park.
- **Messages:** refusals on paving now say "(Break it up first: the
  Depave brush.)".
- **The terrain redraws** when ground changes (`world.groundVersion`;
  `terrain.ts` `userData.refreshGround`, at most every 2 s). This also
  fixes a latent bug: a district given to the Folk "greened over" in the
  simulation but not on screen.
- **Share it** is a third choice for a cleared district
  (`owner: 'shared'`):
  - the village may build, garden and restore there;
  - the Folk may make their works there outside the Wild (not on fields,
    plots or water);
  - the mycelium carries 0.8 there, as in a Folk district;
  - standing +5 (+8 where the district suits the Folk).
- **Not yet built for §24.4:**
  - a second hearth or green for a far hamlet;
  - ghost lights over ruins given to the Folk;
  - the autopilot using the brush;
  - the council asking about a district, rather than the district card.

### 24.13 Move, take down, call off (built)
- **Right-click** a building (a click, not a drag; right-drag still turns
  the camera) to open its card. The card has **Take down** and **Move**;
  an unfinished building's card has **Call it off**. Every action needs a
  second click to confirm, since browser dialogs are blocked in the
  artifact frame.
- **Take down** (`sim/dismantle.ts`, `village.takedowns`, the builders'
  `dismantle` task, at most 2 to a building). Dismantling takes 40% of the
  building's original work. When done:
  - the building is removed and anyone inside steps out;
  - its footprint is unblocked (a home frees its house tiles, and its
    plot is released);
  - half its kind's cost comes back to the stores, with the amounts
    logged.

  **Keep it standing** cancels while it's in progress.
- **Move** does the same, but returns the whole cost, and the build menu
  opens straight away to place the same kind elsewhere. The move costs
  labour, not materials.
- **Call it off** returns everything delivered to an unfinished project,
  frees its tiles, and releases its tree reservations.
- **Not yet:**
  - the found shelter and kitchen;
  - fishing works;
  - restored ruins;
  - homes someone lives in (take down only when empty; homes can't be
    moved, since they're tied to their plots);
  - calling off a home under construction;
  - moving a backyard trade.
- **Measured** (tests): a scrap workbench comes down within about 16
  game hours with one builder, and returns 5 wood and 3 scrap.

### 24.14 Figures: less lanky, a child build, decimated (built)
- **Proportions** (`scripts/blender/survivor.py`): the head goes from
  about 1:5.5 of the height to about 1:7 (`HEAD_R` 0.13/0.135/0.155 →
  0.108/0.117/0.13). The shoulders are wider (x 0.18 → 0.195), with a
  fuller chest and shoulder line and a thicker neck (0.062 → 0.072), and
  slightly sturdier upper arms. Head-attached pieces (eyes, nose, hair,
  hats) scale with the head (`HS`).
- **A child build.** The same outfits and skeleton, remapped by `BODY`
  (`remap`): the body is 0.74 of adult height and 0.8 of adult width, and
  the head is 0.9 of adult size (larger relative to the body). It is
  exported as `child_<outfit>.glb`. Bone rotations make the shared clips
  work on both builds. In the game (`characters.ts`) child outfits are
  scaled by the adults' height, so they stay child-sized, and they're
  kept out of the adult pools (`people.ts`); children in the simulation
  will draw from them.
- **Decimation.** A collapse decimation of the joined figure before
  rigging (`--ratio`, default 0.28; vertex weights survive it) takes
  9,824 triangles to 2,749 per figure, and the .glb files from about
  85 KB to 44 KB. Visually nearly identical in the preview; cloth edges
  are slightly jagged, which reads as mending.
- **For the user to judge:** the lineup preview (adults and children).
  Further realism would need tapering (waist narrower than chest), less
  of a gap between arms and body, and hands.

### 24.15 Growing up, growing old, and families (built)
- **Age follows the calendar** (`sim/lineage.ts`): `Survivor.born`, one
  year per 32-day year, as the user asked (no speed-up). Arrivals and old
  saves get a birth day consistent with their age.
- **Families:** everyone carries a family name (`Survivor.family`, from a
  list, per seed). Children are named "Given Family". The person card
  shows "Of the Finch family" and what the family is becoming known for,
  once it has three or more members:
  - the Sight (average ≥ 45);
  - skilled hands (two or more joiners or net-menders);
  - being one of the old families (five or more members).

  The card also shows parents (or those who took the child in), children
  (with † for the dead), and a child on the way.
- **Births:** a married couple in one household with a home (2+ beds),
  under 4 children, food ≥ 4 a head and average morale ≥ 45 may expect a
  child. The chance is 1.6% a day, less for each child they already have.
  The pregnancy lasts 24 days. The one who carries follows the renderer's
  convention (odd ids are drawn as women; ages 18–44).
  - Other couples (same sex under that convention, or past bearing, one
    partner under 60) may take in a **foundling** from the green, aged
    3–8, at 60% of the rate.
  - At most one new pregnancy or foundling a day in the village; none at
    30 people or more (arrivals stop at 24, so the village's own can grow
    past it).
  - A child inherits stats (the parents' mean ± 2), sometimes one parent's
    trait, and 60% of their Sight plus a little. They have a bond of 70
    with their parents and 40 with siblings.
- **Childhood:**
  - babies (0–2) stay at home, fed;
  - children (3–11) don't work: they play near home or on the green in
    short hops, with other children when there are any, and come to
    festivals and suppers;
  - at 12 they take a parent's work at half pace (`ageWork`);
  - at 16 they come of age.

  The old work at 0.7 from 68, and die of old age from about 70 (a daily
  chance of (age − 68) × 0.12%).
- **Children are kept out of adult things:** setting up house, leaving,
  work changes, clearing teams (card and autopilot), and playing at
  gatherings (under 12).
- **Drawn:**
  - the child build under 13, the adult build from 13;
  - height by age (0.75 m at 1 year to 1.6 m at 16);
  - the figure is rebuilt each year while they grow.
- **Measured** (`scripts/lineage.ts`, 4 villages × 4 years): 0–6
  children by year 4, mostly foundlings at first (the founders are
  mostly older); village-born adults will marry later. A slow build, as
  asked.
- **Next:** the family tree panel and heirs (homes passing to children),
  then crossing between the peoples (§24.6), with hybrid children at most
  5–10% of children.
- **Publishing problem (open).** With the family lines on the person
  card ("Of the X family", parents, children), the single-file build is
  refused by the claude.ai artifact publish check. It is classed as a
  "PR review page" and rejected as too large. Bisection on a scratch
  artifact:
  - v33 passes;
  - the figures commit passes;
  - the lineage commit without the card lines passes;
  - even the family-name line alone, reworded, fails;
  - "†" is not the cause.

  The rule behind the check is not visible to us. The card lines are
  held back in v35; the simulation and the data are unchanged. They will
  come back in another form (a family tree panel) once the cause is
  understood.

### 24.16 Backlog: restored houses are homes; toadstools on the mycelium (built)
- **Restored houses are homes again** (the user's insistence, §23.2).
  Restoring a house, terrace or farmhouse (`RESTORE` `as: 'home'`) now
  makes a `home`, not a shared bunkhouse. `homes.ts#plotForRuin` gives it a
  plot in the ruin's own frame: a 1.5-tile front strip, the ruin itself,
  and a yard about 7 tiles deep behind, 1.5 tiles either side, leaving out
  other plots, water and other ruins' walls. `planYard` lays out beds,
  woodpile, bench, fence, fruit tree, coop and washing line. A household
  waiting for a home moves in (the existing empty-home rule: "They kept
  the old name over the door"). The house is still drawn by the old
  world's renderer; the yard, fence and string lights come from the plot
  like any other home. Beds and seats use the ruin's real size. Restored
  homes aren't offered the glasshouse upgrade. The card says "A house of
  the old world, patched up and lived in again". The autopilot's restore
  scoring prefers houses while households wait.
- **Toadstools along the mycelium** (`render/mycelium.ts`), visible to
  everyone without the Veil view: up to 4 per 4-tile cell where the
  network is at least 0.45, on soil only (not paving, water, walls,
  fields or trunks). Caps are red under a friendly hill, violet-grey
  under a soured one, and pale in between. Two instanced meshes; rebuilt
  when the network changes (daily).
- **Debug:** `__game.restoreHome()` clears the nearest district with a
  house, restores the house and finishes it.

### 24.17 Backlog: power from know-how (built)
The user's backlog item (§23.2): "large solar arrays, homemade wooden and
electric windmills, feeding the power network: learned by doing and built
from salvage, not eras". `sim/power.ts`, `render/power.ts`.
- **Know-how.** A new craft, `wiring`, learned by doing: +0.06 per haul
  stripped from a ruin (copper, steel, glass), and a little while working
  on a solar or turbine build. The first person to know it is news. The
  windmill wants joinery (already learned at the workbench).
- **Buildings** (build menu; locked, with the reason, until someone knows
  how):

  | Building | Cost | Size | Power (spring/summer/autumn/winter) | Also |
  |---|---|---|---|---|
  | Windmill (timber smock mill, four lattice sails) | 34 wood, 6 scrap | 3×3 | 1 / 1 / 1.5 / 1.5 | Field harvests +20% while one stands (`millFactor` in `gainFood('fields')`) |
  | Solar array (salvaged panels on timber racks) | 8 wood, 8 scrap, 6 glass, 2 copper | 4×3 | 4 / 5 / 3 / 1.5 | |
  | Wind turbine (homemade: steel mast, three blades) | 10 wood, 10 scrap, 3 steel, 3 copper | 2×2 | 2.5 / 2 / 3 / 4 | |

  Sails and blades turn (`userData.spin`, kept out of the static merge).
- **The grid.** Supply is 1 (the first little panel) plus the buildings
  above. Demand: 1 per lived-in home, 2 for the hall, 2 for the tavern,
  0.5 per workshop or trade.
  - `powered` = supply ÷ demand, capped at 1.
  - With any panel or turbine, people in homes gain 0.4 × powered morale
    a day ("light to read by").
  - The string lights glow at 25% + 75% × powered.
  - The winter panel shows a Power bar once there is a grid.
  - A log line when the grid first falls short, and when it catches up.
- **Debug:** `__game.buildNow(kind)` places and finishes a building near
  the fire.

### 24.18 Backlog: strip and clear, pulling ruins down (built)
The user's backlog (§23.2): "junk cars selectable for stripping and removal
… dismantling cleared ruins for scrap is one renewable source".
`sim/salvage.ts`, the build menu's **Strip and clear** tool.
- **Wrecks and junk heaps:** a click marks one (`Heap.marked`). Builders
  strip marked heaps first, whatever the stores hold, until they're gone
  (an emptied heap is no longer drawn). Hovering shows its scrap.
- **Ruins:** a click on an unrestored ruin in a cleared district that is
  the village's (or shared) pulls it down (`village.razes`, the builders'
  `raze` task, at most 3 to a ruin).
  - Work: 200 + 6 × area minutes.
  - Yield: 0.45 × area scrap (at least 8), recorded with its provenance,
    plus any glass, copper or steel still in its walls.
  - The walls' tiles are freed; the slab and paving stay (use Depave).
  - Pulling down teaches a little wiring.
  - A pulled-down ruin is no longer drawn, restorable or strippable.

  Refused for districts of the Folk, undecided or uncleared districts,
  restored ruins, and ruins being restored.
- **Why it matters** (the user's thought in §24.11): salvage lying about
  runs out, but the walls of the old world hold a great deal more, and
  only in districts the village has cleared. The push to take territory.
- **Not yet:** electric carts from junk cars (they need wiring and a
  hauling effect); horses and wagons.

### 24.19 Backlog: timber handling (built)
The user's backlog (§23.2), after Manor Lords: "felled trees lie as logs
to be moved, cut up and processed (a chopping block or saw pit) before
they are wood".
- **Logs:** a felled tree drops one trunk (`Item.kind 'log'`, 3 + 5 ×
  size), drawn as a single long trunk. It is hauled to the woodyard and
  kept apart from wood (`resources.logs`). The Folk's night chores bring
  logs in as logs.
- **The woodyard** (`world.ts#woodyard`): open ground beside the
  stockpile, chosen away from the fire's bedrolls and outside any tree's
  canopy. Unsplit trunks lie there in a row (one per 6 logs, up to 12),
  beside a chopping block with an axe in it.
- **Splitting** (the `split` task, `colony.ts#pickSplit`): 1 minute per
  wood at the block, at most 2 at once.
  - Builders split after hauling.
  - Anyone at a loose end splits before helping on the sites.
  - When the woodpile is below two days' firewood, whoever is free splits
    first.
- **The saw pit** (build menu, needs joinery): a timber-lined trench
  with a trestle, a log and the two-man saw. With one built, splitting
  happens there, 3 at once, 0.6 minutes per unit and 1.2 wood per unit
  of log.
- Wood already on its way (lying logs, hauled logs) counts towards "enough
  wood", so woodcutters don't over-cut while the logs wait.
- **Fix found by the soak:** role requests could leave a village with no
  builders (both asked to attune; autopilot granted it). Then nobody cut
  wood: seed 3 sat at 0 wood for 18 days.
  - Autopilot no longer grants a change that leaves nobody building or
    farming.
  - `rebalanceWork` puts someone back on the sites when nobody builds.
- **Soak** (8 villages, 1 year, against the code before this change), in
  winter:

  | Measure | Before | After |
  |---|---|---|
  | Population | 7.1 | 8.9 |
  | Homes | 4.1 | 4.6 |
  | Wood | 22.4 | 19.9 |
  | Unmet warmth (snapshots) | 15 | 9 |
  | Stalled projects | 4 | 0 |

## 25. The Folk as a parallel society (the user's direction after version 36)

### 25.1 The mycelium, redrawn (built)
The user: the threads read as "electricity bolts: straight yellow lines".
Wanted instead: fluid, curved, thicker, light ghostly purple, branching
from the main mound to the sub-mounds and out, gently undulating, with
brighter pulses running from the centre to the tips.
`render/mycelium.ts`:
- **Shape:** a tree rooted at the hill. Every reached cell joins the hill
  by the cheapest path through strong ground (Dijkstra over 8 neighbours,
  with a little per-cell roughness).
  - Only strands leading to a scattering of tips are kept.
  - Width follows √(tips fed): trunks leave the hill's flank and split
    into tapering branches.
  - Hubs (the Ring, shrines, the memorial) join the tree like any cell.
    Sub-mounds (§25.3) will join it the same way.
- **Curves:** Catmull-Rom through jittered cell points, continuous along
  each strand's main line, drawn as flat ribbons on the ground.
- **Look:** additive, a soft bright core with a faint halo.
  - Lavender (`#d6b4ff`) while the Folk bless, blue-lavender between.
  - A dim grey-violet with slow, sparse pulses while they curse.
- **Motion:** a slow sideways sway that grows along each strand; gaussian
  pulses travel outward (5 units/s, every 22 units).
- **Visibility** (the user, after the first redraw: faint for those with
  high Sight, and barely visible at night by default):
  - *Veil view:* full strength, drawn through trees and roofs, since most
    of it runs under the Wild's canopy.
  - *Through the eyes of a selected survivor with Sight ≥ 45:* a faint
    glow, 0.12–0.42 of full strength by Sight, weaker by day.
  - *Anyone, at night:* 0.13 of full strength.
  - Outside the Veil view it is hidden by trees and roofs like anything on
    the ground.
  - Unexplored ground never shows it (the old lines leaked into the fog).
- Debug hook: `__game.spread(days, standing)` grows the network.

### 25.2 Four kinds of being (built, §25.5; the Strange not yet)
The user's outline, with the folklore it draws on:
- the Irish *aos sí* / Tuatha Dé Danann for the tall ones;
- the Cherokee Nunnehi (immortal, human-sized, living in townhouses under
  mounds) and the Yunwi Tsunsdi (the Little People, who are mischievous)
  for the two main kinds.

The game should be inspired by these, not name or portray the Cherokee
peoples' beings directly: they belong to a living tradition.

1. **The Gentry** (tall, human-sized). Named individuals with no normal
   life cycle: no birth, ageing or old age.
   - They hold opinions of each other and of named humans (bonds, as
     humans have).
   - They come to dances and councils, court (§24.6), and take offence.
   - Today's `elder` and `piper` become Gentry.
2. **The Wee Folk** (small). Less individual (named, shallow opinions,
   in bands), and mischievous.
   - Abroad from dusk to dawn, in the village as well as the Wild.
   - They take offerings and do night chores (today's hob chores).
   - They make mischief:
     - hide tools and tangle nets;
     - sour a pail of milk;
     - braid a sleeper's hair;
     - move the woodpile a yard;
     - lead someone astray (today's `led`).
   - Mischief grows as standing falls; at *kin* it is mostly play.
   - The user: small nuisances are fine for now, but mischief must truly
     affect the world and the relationship. Every act has a real, visible
     cost or a changed thing in the world (a missing tool slows work, a
     moved woodpile is walked to, soured milk is food lost). It is
     remembered by whoever it happened to, and colours their view of the
     Folk. Answering it (an offering, a word at the hill, a broken rule
     mended) changes standing.
   - Today's `hob` and `sprite` become Wee Folk.
3. **The Restless** (spirits of the dead): today's district spirits
   (`haunt.ts`: remnant, hedge, lamp, hollow). They are not long-lived.
   - Once laid to rest or converted in a clearing, they drift back to the
     hill at night along the Folk paths as pale lights, and are taken in.
   - Banished ones don't come.
   - Proposed mechanism: each one taken in adds to the hill's *memory*.
     Every few, a new Wee one *quickens* (the old belief that the fairy
     host is fed by the dead).
   - This gives the Folk a population source with no birth cycle, and
     ties clearing districts to the Folk's growth (B).
4. **The Strange** (rare, undetermined). A slot for singular events and
   visitants: the orbs and UAP already in the lore, a black dog on the
   road, something in the water. Not designed now.

**How they appear.** Beings are invisible or wisps most of the time, and
take full form only in interactive moments: a dance, a council, a
courtship, an offering accepted, being met on a path.
- Visible form is already chosen per viewer by Sight (`FolkView.readingOf`:
  none / chill (a halo, i.e. a wisp) / luminous / coherent). The change is
  that full form is *also* triggered by the moment, with a shimmer as the
  wisp grows into the figure and back.
- Gentry wisps: large, slow, head-height, drifting along the Folk paths.
- Wee wisps: small quick sparks in twos and threes, flitting through yards
  after dusk.
- Figures: new Gentry and Wee builds from the same Blender pipeline as the
  survivors (tall and pale; child-height with different silhouettes),
  drawn translucent and glowing.

### 25.3 The Great Hill and its knowes (built, §25.5)
The townhouse chambers (§24.9) are abandoned for a settlement:
- **The Great Hill:** the main mound at about double today's radius
  (3.6 → ~7). It holds the hearth-hall (council, dances, the Gentry's
  seat).
- **Knowes:** sub-mounds at today's mound size, raised around it as the
  society grows (each growth of the hill = a new knowe, in place of a
  chamber).
  - Each is a two-storey dwelling, one floor at mound level and one below,
    for a household of about 4–6: Gentry with their Wee band. Denser than
    the humans' two-per-house.
  - Invisible to humans: seen as ghost architecture with Sight at night or
    in the Veil view (reusing the townhouse's topside ghosts).
- **Not a copy of the human town:** no farms or trades. What they build
  stays their own: rings, lanterns, moon gardens, cairns, and now knowes.
  Bowers are replaced by knowes.
  - The chambers' small effects could become each knowe's *character*:
    the pipers' knowe (song), the dew-keepers' (dew), the archive-knowe
    that keeps the names of the dead, the guest-knowe.
- **The mycelium follows the settlement:** trunks from the Great Hill to
  each knowe, branching on from there (§25.1). Knowes are hubs.
- **Pressure on uncleared land (B):** a knowe wants Wild ground; the best
  sites lie in cleared districts given to the Folk or shared.

### 25.4 Proposed order
1. Great Hill at double size; knowes replace chambers; the mycelium roots
   at knowes. Save migration: existing chambers become knowes.
2. Gentry and Wee Folk as kinds with their own behaviour: Gentry bonds and
   opinions; Wee bands abroad dusk to dawn in the village, with offerings,
   chores and mischief.
3. Wisp-by-default presentation and full form in moments, with the
   shimmer transition.
4. The Restless return to the hill and quicken new Wee ones.
5. New Gentry and Wee figures (Blender).
6. The Strange: later.

### 25.5 What was built (steps 1–4 of §25.4)
The user (after version 37): mischief as proposed for now, but it must truly
affect the world and the relationship; placeholder figures for the Folk,
with character work in Blender saved for later.

**Step 1: the Great Hill and its knowes** (`sim/townhouse.ts`,
`render/townhouse.ts`, `folk.ts#raiseHill`):
- **The Great Hill:** radius 7.2 (was 3.6), 3.6 high.
  - It sits farther out: 17–25 beyond the Ring, at least 18 from it.
  - The Wild's radius is 14; land wanted is 420 + 80 per growth.
  - The back path is extended to keep its length.
- **Knowes:** one is raised at each growth (the chambers are gone).
  - Each is real ground: `raiseHill` only ever lifts the heights, and the
    terrain redraws on `World.heightVersion`.
  - Trees on the footprint are taken in (the `swallowed` event: no stump,
    no fall). The land round it becomes the Wild, and it is revealed.
  - Sites: round the hill, fewest trees first. They avoid the village's
    zones, plots, buildings and paving, the Folk's paths and works, the
    Ring, other knowes, ruins, and uncleared districts.
- **Housing:** the hall houses 6, each knowe 5 (`settleFolk`). The Gentry
  live in the hall; the Wee Folk live in the knowes, and walk home to
  their own at dawn.
- **Characters** (what the chambers did): dwelling, dew, pipers' (song),
  root-archive (grief), nursery (growth), guest (one more night chore).
- **Drawn:**
  - A seven-sided hall lodge on the crown.
  - On each knowe, a round lodge facing the hill, with its character
    beside it.
  - In the Veil view, lower floors glow underground, joined by faint
    root-like tunnels (curved; straight ones read as bolts).
  - The Folk card shows a plan of the hill and its knowes: who lives
    where, on hover.
- The mycelium treats knowes as hubs, so its trunks run out to them.
- Old saves: chambers become knowes.

**Step 2: the Gentry and the Wee Folk** (`sim/fae.ts`):
- The elders and pipers are Gentry; hobs and sprites are Wee Folk.
- **Opinions:**
  - The Gentry hold opinions of the village's people (`Fae.of`) and of
    each other (`Fae.kin`, fixed per pair to start).
  - Meeting one: +15. An offering: +1.5 from every one of the Gentry.
    Dancing with them: +4. A tree cut in the Wild: −10.
  - When cross, they lead astray whoever they like least (half the time);
    when friendly, they borrow a favourite. The Folk card lists who each
    is fond of or cold to.
  - Now and then the log carries a word about their own loves and
    quarrels.
- **Everyone's feeling for the Folk** (`Survivor.fae`, −100..100) is moved
  by what happens to them, and is remembered.
  - It gates offerings at the hill: none below −20, more when fond.
  - It is shown on the person card once it is strong.
  - The village's mean feeling moves the Folk's standing by 1% of it
    each day.
- **Saucers at dusk** (20:00): households whose strongest voice is fond,
  or that were hit by mischief in the last 3 days, leave milk and bread
  (0.5 food).
- **The Wee Folk's nights:** from 20:00 to 04:00 a Wee one may call at a
  house (one call each a night).
  - A saucer is repaid with a favour: an hour on a site, a row weeded,
    kindling (+2 wood), or a mended gate and a good night's sleep.
  - With no saucer, mischief may follow: 55% if soured, 30% if wary, 12%
    if friendly, 8% if kin. There is a nightly cap of 1 + level/2.
  - Real costs when the Folk are cross:
    - tools up a tree (that person works at ×0.7 all day);
    - a larder soured (2–5 food);
    - a woodpile carried off (3–6 wood, left in a ditch to be hauled
      back);
    - nets knotted (half a catch that day);
    - bad dreams (−25 rest, −3 morale).
  - Among friends it is play: hair braided with meadowsweet, boots on the
    roof.
  - The person it happened to thinks worse of the Folk (−4 to −6; the
    household half that), and remembers it.
- **Iron over the door:** when a household's strongest voice falls to −45,
  a horseshoe goes up (standing −1). No mischief and no favours there
  until they come round (feeling ≥ 0).
- The old daily soured-stores mischief is replaced by this.

**Step 3: wisps, and full form in moments** (`render/folk.ts`,
`folk.ts#showSelf`, `Fae.moment`):
- **By default** each being is a wisp, and only for those who can perceive
  them (by Sight, as before).
  - The Gentry: large, slow, at head height.
  - The Wee Folk: small, quick, low, flitting.
- **In moments** they take full form for everyone:
  - meeting someone (at the door);
  - an offering taken (one of the Wee Folk bows at the door);
  - dancing at the Ring;
  - leading someone off (the Gentry, where the person is taken).
- The figure grows out of the wisp with a flickering shimmer, and fades
  back. The clearest-sighted see a faint figure (0.45) even outside
  moments. Names show while the figure is clear.
- **Placeholder figures** (the user will make the real ones): the
  survivors' own figures, drawn as additive ghosts.
  - The Gentry: an adult build, 2.0 m tall, slimmed to 0.86.
  - The Wee Folk: the child build, 0.6–0.8 m.
  - Walk and Idle clips. A capsule stands in until the figures load.

**Step 4: the Restless** (`fae.ts#sendHome`, `restlessTick`):
- Spirits laid to rest or unravelled in a clearing become pale lights
  that drift toward the hill from 20:00 to 05:00 (0.35 units a minute,
  wandering a little), and go in at its door.
- Each one taken in adds to the hill's memory (+1 standing). Every third
  quickens a new Wee one, "with a look of" the last.
- Banished spirits never come; befriended ones join the Folk at once, as
  before. The Folk card shows those on the road and those taken in.

**Tests:** `tests/townhouse.test.ts` (rewritten), `tests/fae.test.ts`.
- Test changes from the new world:
  - `folk.test.ts` checks the reaction to taken land with the next daily
    update (a council gave land back the same day).
  - `homes.test.ts` meals ignores someone the Folk borrowed until they are
    home.
  - `lineage.test.ts` finds the baby by age (a newcomer came the same day).
  - `trades.test.ts` checks the tier reached, not the last day's tier.
- Fix found on the way: with all hands at the woodpile (a council
  commitment), idle builders no longer drift onto building sites.

**Soak** (6 villages × 2 years): nobody died, no stalls. In the second
winter: 16 people, morale 77, 9.7 homes, the Folk hill at level 1.7.

**Not yet:** the Strange; the real Folk figures (Blender, the user's);
council emissaries in full form.

### 25.6 A new village sees the Folk from day 1; you choose where knowes rise (built)
The user, playing v38: no mycelium in a new game, and no knowes. Both were
there by design but invisible for a long time: the network started as a
single cell, and the hill grew about 1.7 times in two years. Their answers:
the network should spread through the Wild and to the Ring from the start;
a small settlement from the start; knowes still come with growth, but the
player is asked where.
- **The network, grown from the start:** `createColony` runs 40 days of
  growth without effects (`mycelium.ts#growMycelium`). Across the five
  sites it covers 95–100% of the Wild and reaches the Ring.
- **The Folk's own roots** (in `capacity`): a trunk from the hill to each
  knowe, and along their path from the hill to the Ring, carries the
  network whatever the ground. These cells are hubs, so they don't thin
  out on a long path. On the station site the Ring is 50 units away.
- **A small settlement from the start** (`townhouse.ts#foundSettlement`): a
  dwelling-knowe and a dew-knowe round the Great Hill, and a Wee band (a
  hob and a sprite) living in them, 5 of the Folk in all.
  - On the motel site there is room for only the first: the hill is ringed
    by water, ruins and haunted districts. Clearing districts opens room
    later (B).
- **Where a knowe rises** (`knoweDue`, `placeKnowe`, `letFolkChoose`,
  `whyNotKnowe`):
  - In a player's game, a growth puts a knowe in waiting. The Asks tray
    shows it with **Choose where** (a placement tool round the Great Hill,
    with a reason for any bad spot) and **Let them choose**.
  - After 3 days (`KNOWE_WAIT`) the Folk choose themselves.
  - Autopilot and self-planning villages raise it at once.
  - Site rules: 1 to 24 beyond the hill's edge; also keeps clear of
    haunted districts' ruins, where the ground is dead to the mycelium.
- **The mycelium follows:** a new knowe gets a trunk from the hill at once
  (`reachKnowe`), and the root keeps it.
- **Tests:** `townhouse.test.ts` (the start, the network reaching the Ring
  and the knowes, asked placement, the Folk choosing after 3 days).
  - Existing tests adjusted:
    - the mycelium growth test starts from an empty network;
    - the Folk land test raises the level until land is short;
    - the chronicle test allows two alike lines on a day (two lanterns
      finished).

## 26. Cleared districts become places, and the Folk grow into them (after version 39)
The rest of §24.4, and the core of B. The user (after v39) asked me to
choose from the list. They are doing character work on another branch, so
the character files are left alone (`render/characters.ts`,
`render/people.ts`, `scripts/blender/`, `assets/people/`).

### 26.1 Built
- **The council asks** (`dilemmas.ts`, question `district`). The first
  council after a district is cleared asks who should have it (once per
  district, most pressing first):
  - **Resettle it: the village's.** Its salvage, roofs and ground to zone
    and build on; builders favour it.
  - **Give it to the Folk.** It becomes the Wild; high Sight and fondness
    for the Folk favour it.
  - **Share it.** Empathy favours it.

  The answer is `giveDistrict`, as the district card already did; the
  card's buttons still work. Autopilot still gives districts at once.
- **Their country** (`townhouse.ts#folkDistricts`, `inFolkCountry`,
  radius 14): districts given to the Folk or shared are their country
  beyond the hill.
  - Knowes may rise there, whatever the distance from the Great Hill (the
    placement tool allows it, with the reason given otherwise). When their
    country is freer of trees than the hill's surroundings, the Folk's own
    choice (`knoweSite`) goes there.
  - The mycelium's roots run from the hill to each such district (hubs at
    0.7), so the network reaches it and branches on.
- **They live in its old buildings** (`folkRuins`, `roomFor`). Each standing
  ruin in a district given to the Folk houses 2 of them. It counts toward
  Rest and toward what the next knowe must be.
  - Drawn (`render/townhouse.ts#ruinHome`): each such ruin as the Folk keep
    it, whole in light, with a pale roof, warm windows and a lit door. It
    follows the lodges' visibility rules (a shimmer; clear with Sight at
    night; plain in the Veil view).
- **The push toward the districts** (`lookingToward`): when a growth finds
  no room for a knowe, the news says where their lights drift at dusk:
  the nearest district still haunted.
- The Folk card has a "Their country" line: the hill, the knowes, the
  districts, the ruins they live in, and their room.
- Debug hook: `__game.give(district, 'village' | 'folk' | 'shared')` clears
  a district and gives it.
- **Tests:** `tests/country.test.ts`.

### 26.2 Next
- **Resettle, for the village:** a second hearth and green in a district
  given to the village, so households can live there with their own
  evening fire. This is its own round.

## 27. Everything can be moved (after version 40)
The user: make sure everything can be moved, including the hearth (the fire
they gather at).
- **The fire** (`sim/hearth.ts#moveFire`): right-click it for its card, then
  **Move**. A placement tool shows the fire's ring.
  - Rules: open, explored ground with room for the seats and bedrolls
    (radius 2.5 clear; nothing built within 4.6 plus the building's size;
    clear of the stockpile), reachable on foot.
  - It is carried at once, in a pot of embers. Everything that works from
    the fire reads its place live: bedrolls, the evening circle, festivals
    still to come, plot and lane layout, the Folk's night calls.
  - People sitting, eating or sleeping outdoors at the old fire get up and
    find the new one.
- **The stockpile** (`moveStockpile`), also by right-click: the same size,
  on open ground clear of the fire and buildings. The woodyard and chopping
  block are chosen again beside it. Hauling and splitting start again to
  the new place. Its stacks sit on the ground where it now is.
- **Homes:** can be moved, and taken down even while lived in.
  - The household waits first in line for a new plot.
  - Moving brings back everything, and the plot tool opens ("Draw the
    family a new plot").
  - Backyard trades on the plot come down with it.
- **Backyard trades:** can be moved to another household's plot.
- **The canopy kitchen:** can be moved. It is placed again anywhere and
  stands where it is placed (`site.kitchen` follows it, in the open).
- **The fishing works** come down together, with the fishery; the fishers
  go back to foraging. Move them by painting the Fishing zone at another
  shore.
- **Restored houses of the old world:** "Pull down" razes them for their
  salvage (`finishRaze`). Their plot is freed, and any family waits for a
  new home.
- **Only the found shelter stays**: the old building the site started in.
- Renderer (`render/camp.ts#relocate`): the fire pit, rack, chopping block
  and bedrolls move with the sim.
- Debug hooks: `__game.moveFire(x, z)`, `__game.moveStockpile(x, z)`.
- **Tests:** `tests/hearth.test.ts`, plus new cases in `dismantle.test.ts`
  (a lived-in home, the kitchen) and `restorehome.test.ts` (pulling a
  restored house down).

## 28. Resettling a district: the hamlet's fire (after version 40)
The user chose it after §27. It is the village's side of §26: a district
the village takes becomes a hamlet with its own fire.
- **The Hamlet fire** (build menu; `DEFS.hearth`: 2×2, 6 wood and 2 scrap,
  90 minutes; walked into, not blocking):
  - Only within 24 of the heart of a cleared district that is the
    village's or shared (`hearth.ts#whyNotHamletFire`).
  - At least 28 from any other fire, the old one included. One is laid at
    a time.
  - It takes its district's name when finished ("The fire at Sorrel
    Close").
  - Drawn (`render/power.ts#hearthMesh`): a ring of stones, logs, flames,
    a warm point light, and split logs stacked beside it.
- **Who gathers where** (`fireFor`): everyone gathers at the fire nearest
  their home, the old fire if they have none.
  - Evening circles, meals by the fire and fireside leisure take their
    seats round that fire (`seatOf`), and people face the fire they sit by.
  - Bedrolls for those without a roof stay at the old fire.
- **The card** lists its households and who is by it now. It can be moved
  or taken down like any building (§27).
- **Autopilot** (`autopilotHamlet`): once a family lives in a resettled
  district far from any fire, it lays a hamlet fire near their door.
- **Soak** (6 autopilot villages, 64 days): every village started at least
  one hamlet (two in two villages). 1 to 8 people gathered at hamlet fires.
- Debug hook: `__game.hamlet(x, z)`.
- **Tests:** `tests/hamlet.test.ts` (placement rules; a family in a restored
  house gathers at its own fire while the rest use the old one).
- **Not yet:**
  - festivals at a hamlet;
  - a hamlet's own green and lanes laid out from its fire;
  - hamlet-specific councils.

### §29. Full agency over the found shelter; a buffer before the Folk

The user, after v41: "can we not move the starting building? i feel like
everything should be deconstructable or moveable ... a right click menu to
give you options to repair, deconstruct, move etc. full agency" and "move
the wild territory and mounds a little further away from the starting human
area ... having a buffer zone where the player decides how to or to close
that gap at all is a choice".

- **The found shelter can come down** (`dismantle.ts`):
  - Right-click it: *Pull down* (a long job, `SHELTER_WORK` 900 minutes, up
    to four builders) or *Move (new hall)*, which pulls it down and opens
    placement for a **Commons hall** (`DEFS.hall`, 6×4, 36 wood and 14 scrap).
  - When it is down (`pullDownShelter`): `Building.gone` is set, its beds
    go to 0, 40 scrap and 12 wood come in (recorded as salvage from it),
    and every tile the site blocked is open again (the shelter and what
    stood round it: pumps, sheds, canopy). A kitchen under the station
    canopy stands in the open (and gets its own pergola). Repairs still
    queued on it are dropped, and what was brought for them goes back.
  - Its record stays as the village's stores, so planning gates keyed on
    its level still hold. Its door moves to the stockpile.
  - The site's meshes leave the scene (`main.ts#syncSiteGone`), and
    right-clicks no longer find it.
- **The hall role** moves to `hallOf(v)`: a built Commons hall if there is
  one, else the old shelter at level 3 if it still stands. Suppers,
  evenings, cards, the feast aspiration and power demand all read it. The
  built hall has a long table down its length (`seatSlot`).
- **Repair from the card** (`shelterRepair` / `repairShelter`): the
  shelter offers its next step at once (*Clear it out*, *Patch the roof*,
  *Make it the hall* for 8 wood). The council's commons proposal calls the
  same `shelterToHall`. Homes offer *Patch it up* / *Add a glasshouse*
  (`homeImprove` / `improveHome`: the same upgrade projects the planner
  makes, gated by need tier and glass and copper).
- **The buffer** (`folk.ts#layFolkLand`, `townhouse.ts`):
  - The Great Hill is placed 26–34 beyond the Ring, never within 44 of
    the map centre. A relaxed pass (any bearing, 46–62 out) runs before
    the last resort.
  - Measured over 24 seeds and all five sites: 42–60 from the village fire
    (previously about 24–44). The Ring is 14–28 from the fire, so open land
    lies between the Ring and the Wild. Every seed still has both starting
    knowes.
  - Knowes may not rise within `KNOWE_KEEP_OFF` (30) plus their radius of
    the village fire, except in Folk country.
  - Closing the gap is the player's choice: clearing, zoning, or giving
    districts to the Folk.
- **Checks:**
  - `tests/shelter.test.ts` covers repair, the hall step, pull-down effects,
    move → hall, home improvement and the knowe keep-off.
  - `tests/folk.test.ts` checks hill distance of 44–62.
  - A 3-village one-year soak raised no flags.
  - Debug hook: `__game.pullDown(x?, z?)` pulls down at once and raises a
    hall near (x, z).
- **Not yet:**
  - the hall's own interior furniture (it seats people, but the table is
    not drawn inside);
  - moving the site's wrecks.

### §30. Wrecks: a card, stripping seen, towing

The user, after §29, agreed to three pieces of the car backlog: a
right-click card for wrecks, visible stripping, and towing.
- **Card** (right-click a wrecked car or junk heap; `hud.ts#heapCard`):
  - It shows the scrap left of the total, what it is and where it came
    from, and whether it is marked, being stripped (and by how many), or
    being pushed (percent, and how many are pushing).
  - Buttons: *Strip it* / *Leave it* (the existing `markHeap`), *Tow to
    the yard*, *Tow elsewhere…* (the `tow` placement tool, with its reason
    shown on hover), and *Stop pushing*.
- **Stripping seen:**
  - Wheels, doors and bonnet go first and the cabin last. This was already
    drawn (`HeapsView.sync`).
  - New: at 0 scrap the shell goes with the last load (`salvage.ts#clearHeap`).
    The view is hidden and the tiles it blocked (a car's three along its
    length, `heapTiles`) are freed. Before this, an emptied wreck kept
    blocking and stayed drawn.
- **Towing** (`towHeap`, `whyNotTow`, `yardSpot`, `stopTow`, `finishTow`;
  the `tow` task):
  - Refused:
    - more than 60 away;
    - onto water, blocked tiles, trees, plots, fields or the Folk's land;
    - unexplored ground;
    - a wreck already being pushed.
  - Work: 60 + 5 × distance minutes for a car, 40 + 3 × distance for a
    heap.
  - Up to three push it. Whoever is free joins, not only builders, before
    new building. When the order is given, the two nearest people at
    interruptible work (foraging, company, tending, leisure, yard work,
    salvage, scrounging, gardening; not carrying) put it down and come.
  - The wreck slides along as they push (`heapPos`), and they move with it.
    When it arrives, its old ground is freed and its new ground blocked.
  - Stopped part way, it stays where it has got to, or goes back if that
    spot is taken.
  - *The yard* is the nearest open spot 4–16 from the stockpile, with a
    tile of room all round and 6 clear of the fire.
- **The station's forecourt car** is no longer baked into the station mesh.
  It is drawn with the other wrecks, so it can be stripped and towed like
  them (it looks like a generic wreck now).
- **Checked:**
  - Seed 5 (station), in the browser: ordered at 09:00, the forecourt car
    was beside the stockpile by 13:00.
  - `tests/wrecks.test.ts`: tiles, clearing at 0, a tow to the yard,
    refusals, stopping.
  - 185 tests pass, and a 3-village one-year soak raised no flags.
  - Debug hook: `__game.towNearest()`.
- **Not yet:**
  - electric carts from junk cars;
  - parts with provenance (batteries to the grid, tyres, windscreen glass);
  - the autopilot never tows.

### §31. Playtest fixes after v42

The user's notes after playing v42.
- **"When people ask me for a house and I say OK, it makes me plot it out,
  but the ask doesn't go away."**
  - Two causes:
    - asks were settled only once a day (`requestsDaily`);
    - a drawn plot waited for the next planning pass to be matched to a
      waiting household, and at most two homes were started at a time.
  - Now a plot drawn from a household's ask (*Draw a plot* in the tray;
    `main.ts#plotFor`) is theirs at once, and their house is started
    (`homes.ts#homeForAsker`).
  - Answered home asks leave the tray on the next UI refresh
    (`requests.ts#dropAnsweredHomes`), however the plot was matched.
  - A plot drawn from the build menu still goes to whoever is first in
    line.
  - Test: `tests/requests.test.ts` ("a plot drawn from a household's ask
    …").
- **"When I cut the roofs, buildings up on foundations: you see through the
  foundations, not inside their main floor."**
  - The cutaway sliced everything at one world height (y = 1.15). A
    building raised on a foundation, or standing on higher ground, was cut
    below its floor.
  - Now each village building is cut at 1.15 above its own floor (its
    group stands at its floor).
  - Materials are shared, so a building on a different floor height gets
    copies of its materials that cut at that height (`roofs.ts#cutMaterialFor`,
    shared per 5 cm of height).
  - Checked on seed 7 at day 25: the highest-floored house, on stone
    footings with steps, shows its bed, table and stove.
  - **Not yet:** old-world ruins, restored houses included. They are merged
    into one mesh per district, so they still cut at y = 1.15, and a ruin
    on high ground may cut badly. Fixing them needs a per-vertex cut height
    in the shader.

### §32. The build menu grows with the village

The user, after v42: "What about the build menu showing not currently
relevant items? Should the build menu be more like a tech tree, with things
appearing as they are relevant or unlocked by the presence of others?"

Eras stay rejected (§17). Entries appear because something happened in the
world: a craft learned, a material found, a need felt, a district cleared.
- **Three states** (`sim/unlocks.ts#unlockOf`):
  - *hidden*: nothing points to it yet;
  - *glimpsed*: one step away, shown greyed with that step in the
    villagers' words;
  - *open*: as before.
- **Rules:**

  | Entry | Glimpsed | Open |
  |---|---|---|
  | plot, bunkhouse, garden, cellar, workbench, lantern, strip and clear | | from the start |
  | shrine | from the start | someone with Sight ≥ 30, home Resonance < 0.5, or one built |
  | tool bench, sewing room, smoke shed | need tier ≥ 1 | a household has a home (they go in its yard) |
  | tavern | need tier ≥ 1 | need tier ≥ 2 |
  | saw pit, windmill | workbench built | someone knows joinery |
  | solar, turbine | glass/copper/steel seen, or a district cleared | someone knows wiring |
  | glass dome | a district cleared | glass and steel in stores |
  | hamlet fire | a district cleared | a district is the village's or shared |
  | commons hall | the shelter at level 2, and no hall yet | the shelter pulled down |
  | restore a ruin | from the start | a district cleared |
  | Ask the Folk | | the Folk met (hidden before) |

  The commons hall is hidden while any hall exists.
- **Sections:** Shelter and home, Food and stores, Crafts, Power, Common
  life, The old world, the Folk. A section appears only when it has an
  entry.
- **News** (`unlocksDaily`, run each day after the need tier):
  - The first time an entry opens, a log line says so. There is one line
    per kind of opening (the three yard trades share one), and the entry
    joins `Village.fresh`.
  - The menu marks fresh entries *new*, and the Build button has a gold
    ring while any are unseen. Closing the menu marks them seen.
  - The first check for a new or an older saved village records what is
    already open, without news (`Village.unlocked`).
- The council, the request tray, the planner and the autopilot place
  buildings directly and are not gated by the menu.
- **Checked:**
  - Seed 4, day 1: 7 buildings are shown, restore is glimpsed, and no Power
    beyond the lantern or Folk works appear.
  - Seed 7 on autopilot, day 31: the hamlet fire, smokehouse, glass dome and
    toolmaker's shop are marked *new*.
  - `tests/unlocks.test.ts`.

### §33. Clean-up after v43 (the open list)

- **Ruins in the cutaway.**
  - Each ruin now carries its own cut height: 1.15 above its floor, rounded
    to 25 cm (`ruins.ts#buildDistrict`, `userData.cutAt`).
  - `mergeStatic` gives parts with a cut height a copy of the material that
    cuts there (`roofs.ts#cutMaterialFor`, `merge.ts#cutAtOf`). So ruins
    merge only with ruins cut at the same height.
  - Checked on the highest ruin on seed 7: walls cut at knee height above
    its floor.
  - Draw calls for the old world: 12 with the change against 13 without
    (seed 1, farm, day 8).
- **"The view doesn't refresh while paused":** not a bug.
  - The scene syncs every 0.25 s of real time whatever the speed.
  - The stale frames were the screenshot harness's (about 1 fps and a fixed
    dt), where a sync takes several frames.
- **Commons hall furniture:** a long table with cups, benches both sides
  and an iron stove, seen in the cutaway (`trades.ts`, the `hall` case).
  The hall is now in the tree-clearance table, with the saw pit, windmill,
  solar array, turbine and hamlet fire (`clearance.ts#TOP`). Before this,
  trees grew through all of them.
- **Seed 6 slowness: not reproducible.**
  - On autopilot to day 200: 90–200 ms per day, rising with population (28
    at day 200), and no slow days.
  - Scrap no longer runs out (8 heaps left at day 200).
  - The earlier 3–5 s days (§22.12) were probably removed by later work;
    which change did it is not known.
- **Autopilot and wrecks** (`autopilot.ts#autopilotWrecks`):
  - Wrecks and heaps within 18 of any fire are marked to be stripped, one
    at a time, which clears the village's ground.
  - It does not tow. Towing costs 60 + 5 × distance minutes, while
    stripping in place costs two round trips for a car, so towing only
    pays when a wreck is in the way.
  - Test: `tests/wrecks.test.ts` ("autopilot and wrecks").

### §34. Playtest notes on v44 (the user's; to do)

The user, sitting down with v44 ("before anything, just sharing thoughts"):
1. **People at the fire sit in mid-air.** Likely cause: seat heights taken
   from the wrong ground (the old fire's spot after a move, or a hamlet's).
   To reproduce.
2. **Plot drawing is hard to read.** The user's idea:
   - the cursor is a yellow-shaded ground tile;
   - the border being drawn is shown as the ground tiles it will run
     through, lit up, until the shape is closed.
3. **"I can't build plots over rocks?"** Rocks and rubble are hard blocks
   for plots today. Proposal: rocks allowed in the yard, and split and
   cleared by builders where the house itself must stand.
4. **An uncleared building crossed a fairy path to the Ring.** A
   world-generation ordering bug: Folk paths are not routed around ruins
   (or ruins are placed over paths).
5. **Deer get stuck on things.** Screenshot: two deer overlapping each other
   on a rock or stump. Likely: grazing targets and movement ignore blocked
   tiles and each other.

**§34, what was done** (after the user's second round of notes: "use the
pixelated stuff for textures while selectively turning off the overall
effect? … a debug panel … to tweak graphical effects live"; "I don't even
see benches"; "plots over rocks, just no buildings over them"; "is there
some other method than tiny triangles everywhere?"):
- **Seats round every fire** (`render/camp.ts#seats`, `main.ts#fireSeats`):
  - a log round at each seat position (`sites.ts#seatSpot`), for exactly
    the ring of people who gather at that fire;
  - three rounds wait at an unused fire;
  - the old fire and hamlet fires alike.
- **Rocks in plots** (`homes.ts#plotTileWhy`, `rockAt`, `clearOfRocks`):
  - a plot may be drawn over rocks;
  - the house is fitted clear of them (`houseSite` already refused
    blocked tiles, and the fitter tries other spots);
  - yard features that would stand on a rock are left out, and the rock
    stays in the yard;
  - rubble and walls still refuse a plot. Test: `tests/plotrocks.test.ts`.
- **Plot and field drawing on the ground's grid**
  (`render/drafttiles.ts`):
  - the cursor is a yellow tile, and clicked corners snap to tile centres;
  - every tile the outline passes through is lit: corners pale, edges
    gold, the edge that would close the shape dim;
  - the thin line and dots are gone.
- **Folk paths** (`folk.ts#layFolkLand`): a path takes its random bend if
  it crosses nothing blocked. Otherwise it takes the nearest bend that is
  clear, or the one that crosses least. The user's crossing could not be
  reproduced: on 60 worlds (5 sites × 12 seeds), no path tile lies within
  a tile of a ruin, before or after. Asked the user for the seed.
- **Deer** (`render/nature.ts`):
  - targets are reached only by a clear straight line;
  - the nose is checked as well as the body, and tree trunks are solid;
  - after a blocked step the deer turns to its new target at once;
  - it repicks after 2 s without progress;
  - herd-mates keep 1.4 apart, and spawns are checked.

  Measured headless (4 worlds, 300 s):

  | | before | after |
  |---|---|---|
  | on a blocked tile or tree | 7.5% of samples | 0 |
  | overlapping another deer | 344 | 0 |
  | walking but not moving | 2.4% | 0.17% |
- **Graphics panel** (`ui/gfx.ts`; key G, or *Graphics…* under Testing
  tools; remembered per browser in `ss-gfx`):
  - Controls, all live:
    - pixel size 1–6 (1 = full resolution);
    - outlines;
    - colour steps 0–32;
    - surface-pattern strength (`worldUniforms.uSurface`);
    - bloom, exposure, shadows;
    - grass tufts on or off (the `tufts` group);
    - grass painted into the turf (`uGrassPaint`, `util.ts#grassPaint`).
  - Presets:
    - *Pixel art* (the published look);
    - *Crisp + textures* (full resolution, pixel-scale patterns kept: what
      the user asked for);
    - *Clean*.
  - Painted grass is irregular three-blade clumps drawn in the ground's
    shader, with no geometry. It is off by default, for the user to
    compare.
- **Bug found on the way:** the composer is built round a render target,
  so three.js takes that target's width as its CSS width. The old resize
  handler happened to be right, but setting only the pixel ratio shrank
  the buffers again (a blurred 1/9 image). The composer is now sized by
  `main.ts#sizeComposer`: renderer ratio, then the CSS size.
- **Bug found on the way:** people went to bed with just under 38 food and
  slept to 0 (sleep isn't interrupted by hunger), which the "nobody goes
  hungry" test caught on a changed trajectory. Now anyone below 45 eats
  before turning in (`colony.ts`, the sleep branch).

### §35. Snow that settles, footprints that fade

The user, after v45: "can we get footsteps in the snow that fade slowly?
snow falling in the winter? piling up on rooftops etc?"

Before this:
- snowflakes fell on snowy days;
- snow cover followed a fixed seasonal curve, jumping to 60% whenever it
  snowed;
- it covered the ground and every upward-facing surface, roofs included;
- worn paths stayed clear.

- **Settling and melting** (`main.ts`, the season block;
  `calendar.ts#snowCold`):
  - Snow builds up only while it falls: the ground is fully white after
    about 7 game hours, and roofs, tops of cars and canopies after about
    4.5 (they catch it first).
  - It melts when it isn't cold: over about 1.2 days in the thaw, faster
    in rain, and roofs about 30% faster than the ground (a heated roof
    sheds it). It does not melt in deep winter.
  - Ground and tufts use `uSnow`; everything else uses `uRoofSnow`.
  - A loaded game starts from the season's usual look.
  - The snowfall thickens as the snow settles (45% of the flakes drawn at
    first, all of them on deep snow).
- **Footprints** (`render/footprints.ts`, `worldUniforms.uFootTex`):
  - They are pressed into a texture of 4 texels a tile.
  - People step every 0.42 units, alternating left and right, heel and
    toe. Deer step shorter and leave fore and hind hoofprints.
  - Nobody leaves prints indoors, afloat, or on snow thinner than 25%.
  - A print fades over 1.5 game days, or in about 8 hours while fresh snow
    falls. The fade accrues on a clock that runs faster in snowfall, so
    old prints are filled in too.
  - In the ground's shader a print is shaded blue-grey (85% at a fresh
    print). It needs snow at least 12–40% thick there, so prints don't
    show on bare, worn paths.
  - Only the trodden region is recomputed and uploaded, four times a
    second.
- **Checked:**
  - Seed 4, day 25: bare at 08:00, and white ground and roofs after 7
    hours of snowfall.
  - On a snowy dawn, trails of prints run from the bedrolls round the fire
    to the kitchen and the yard. A debug pass drew them red to confirm
    placement.
  - Debug hooks: `__game.snow(v)` (set the depth), `__game.footprints()`.
- **Harness note:** footprints are sampled per rendered frame. In the
  screenshot harness (about 1 fps) the game must advance about a game
  minute per frame, or walkers jump and leave no prints. In play, frames
  are frequent at any speed.
- **Not yet:**
  - snow drifts or depth geometry on roofs (the cover is a colour, not
    thickness);
  - icicles;
  - breath in the cold.

### §36. Playtest notes on v46 (the user's; to do)

The user said these don't all need doing now, but every one must be
captured here.

1. **Desire paths look blurry "at any resolution or pixel size."**
   - Cause: the wear texture (`terrain.ts#WearTexture`) has one texel a
     tile with linear filtering, so every path edge is a tile-wide smear.
   - Fix options:
     - (a) nearest filtering plus a sharp threshold in the ground shader
       (`util.ts`, where `uWearTex` is read), so a path is either worn or
       not, with a stepped pixel edge;
     - (b) a higher-resolution wear texture (like the footprints' 4 a
       tile) written along walked lines;
     - (c) (a) plus a 1–2 texel dithered edge in the pixel look.
   - Recommended: (a), then (c) if it looks too blocky.
2. **A Folk being who joins people on a clearing should be bonded to
   them.** Today a Folk companion in a clearing (§20.6, `FAE_UNIT`) leaves
   no lasting tie.
   - Wanted: everyone who went in with that being keeps an ongoing
     relationship with it, as they have with each other.
   - Ties already exist: opinions (`sim/fae.ts`, `Fae.of`, `Survivor.fae`)
     and bonds between people (`community.ts`, `bondValue`).
   - Proposal:
     - a clearing shared with a Folk being raises that being's opinion of
       each teammate, and records a named tie on both sides ("walked the
       Veil together at Sorrel Close");
     - the being then visits them (saucers, a night call that is always a
       favour, not mischief);
     - it may ask for them by name in a council;
     - they grieve or rejoice at its fortunes;
     - shown on the person card and the being's card.
   - This feeds crossing (§24.6): a bonded pair is where Folk romance can
     start.
3. **"I just cleared some houses, but I don't see any ability to fix them
   up and move in."**
   - It is built (§20.4, §24.16): Build → The old world → *Restore a
     ruin*, then click the building. A restored house becomes a household's
     home with a plot and yard.
   - It is hard to find: right-clicking a ruin does nothing, and the
     district card after clearing doesn't mention it.
   - To do:
     - right-click a ruin → a card: what it is, what it would become, cost
       and work, and *Restore* / *Pull down for salvage* buttons, with the
       reason shown when a button is disabled (district not cleared, given
       to the Folk, no way to its door);
     - after clearing, the district card and the log line say "its houses
       can now be restored (right-click one)";
     - an ask in the tray when a household is waiting for a home and a
       restorable house stands empty.

### §37. Restored houses are ordinary homes (in progress; not published)

The user, after restoring a cleared house: "I don't see its plot around it,
I can't see who lives there … all I get is its old neighbourhood
designation … right-clicking it should bring that up, to restore, and then
it becomes just like any other house."

Built (commit a86dcad):
- right-click (or click) a ruin → a ruin card (`hud.ts#ruinCard`) with
  *Restore* / *Pull down*, and the reason when a button is disabled;
- a restored ruin opens its building card, not the district card
  (`main.ts#inspectRuinAt`);
- a restored house is named after the family that moves in (`homes.ts#moveIn`,
  with a daily migration for older saves); before that it is "An empty house";
- the restorers fell the trees standing on its plot (`homes.ts#treesOnRuinPlot`,
  `restore.ts#requestRestore`).

Open:
- in screenshots the plot still looks overgrown although the sim reports no
  tree on it (overhanging trees just outside the plot, or felled trees not
  redrawn: not yet found);
- the plot's stakes are faint until its fence is built.

## 38. The centre moves: short missions, a small cast, lives that remember (the user's direction after v46; design only, not started)

### 38.1 What the user said

Asked to zoom out (spirit, hook, what works, what doesn't), the user
restated the original vision:

> "My original vision was something more like XCOM and Wildermyth, where
> short tactical missions played out, and there was base building in
> between. I think if I want it to be character driven, things need to stay
> low and intimate a lot, and those encounters where I have direct control
> over the inhabitants have the most chance for bonding with the characters
> and creating experiences. This would also be a good source of relationship
> building. I'm thinking of Crusader Kings also a bit with regard to how
> those relationships affect life back at home."

### 38.2 Diagnosis (what the assessment found)

- The project's effort has gone mostly into a Banished-scale village
  (up to `MAX_POP` 24 autonomous workers, chained resources, logistics).
  The part the user cares about most, direct control in short missions, is
  a proof of concept: about 1,400 lines (`sim/haunt.ts`, `ui/clearing.ts`,
  `render/clearing.ts`), one mission type, four spirit kinds, and little
  that follows the characters home.
- Measured weaknesses (§22.11 and later soaks):
  - about 0.4 decisions a day;
  - council choices barely change outcomes (except Folk standing);
  - the need ladder is done by about day 40 and nothing is striven for
    after (no second act);
  - many parallel systems in their smallest working form (fishing, power,
    timber, trades, towing, hamlets), so the game is wide and shallow, and
    features that exist are hard to find (§36.3).
- Relationships exist in the simulation but are nearly invisible and
  carry no history:
  - one number a pair (`community.ts#Bond`, −100..100);
  - a personal memory list (`Survivor` `Memory`);
  - courtship, partners, lineage (§24.8, §24.15);
  - Folk opinions (`sim/fae.ts`).

  None of these says *why* two people feel as they do, and little of it
  changes what anyone does.
- Strongest assets to keep:
  - the look and the sense of place;
  - the Folk as a second society;
  - salvage with provenance;
  - clearing by relationship rather than combat (Nerve not HP; lay to rest,
    convert, banish);
  - full agency over plans.

### 38.3 The spirit, restated

A small band of survivors in an overgrown, haunted, hopeful land. You know
every one of them by name. You lead a few of them at a time into the
places between (haunted districts, the Folk's country, far ruins) in
short turn-based missions. What happens out there follows them home: bonds,
feuds, scars, marriages, grief, gifts from the Folk. At home, the village
is where those lives play out and where the next venture is prepared.

- **Home:** Wildermyth's between-chapters, XCOM's base and Crusader Kings'
  court. Autonomous, readable, about people.
- **Missions:** XCOM's and Wildermyth's tactical maps. Direct control,
  short, intimate. Most characters' stories are made here.
- **The Folk:** neither enemy nor backdrop. They give missions, join them,
  contest the land, and make lasting ties with individuals.

The tone stays: not combat-anxious; loss is real but uncanny (the taken,
the Restless), not gore.

### 38.4 Pillars

1. **Missions are the heart.**
   - A mission is 10–20 minutes, a team of 2–4 (plus at most one Folk
     companion), on a small map.
   - Every turn should offer several decent options (the XCOM test).
2. **A small cast; everyone is a character.**
   - The village holds about 8–14 people (proposal; replaces `MAX_POP` 24).
   - Each has traits, a history, a face you recognise, and relationships
     that remember their causes.
   - Growth is by events, not head count: an arrival with a story, a birth,
     someone returned from being taken, a stranger found on a mission.
3. **Relationships remember why** (the Crusader Kings principle).
   - A tie between two people (or a person and a Folk being) is a set of
     remembered *reasons*, each with a weight and a slow decay, not a bare
     number. Examples:
     - "held the line while I was taken" +30;
     - "left me in the Veil" −40;
     - "talked the Hollow down together" +15;
     - "married" +40;
     - "took my place on the council" −10.
   - The number shown is their sum; the reasons are shown on the card.
   - Missions are the richest source; home adds slower ones (neighbours,
     work, suppers, weddings, quarrels).
4. **Missions change people** (the Wildermyth principle).
   - Scars and marks (a grey streak after meeting a Hollow, a Folk-gift
     that glows at night).
   - Traits gained or lost; Sight opened.
   - Folk bonds (§36.2).
   - The taken come back different.
   - Shown on the figure where possible (the character work on the other
     branch should plan for marks and scars as attachments or tints).
5. **Home is where consequences land.** Ties decide:
   - who lives with whom, and who works beside whom;
   - who speaks for or against whom in council;
   - who courts, marries, feuds, mourns;
   - who refuses to go out again with whom;
   - who asks to go on the next mission, and who begs someone not to.
6. **Buildings serve people and missions** (the XCOM base principle).
   - Building remains, but its purpose is legible: "what do we need for the
     next venture, and to live well between them".
   - Examples:
     - a hearth or infirmary restores Nerve and heals the shaken;
     - a workshop turns salvage into kit (lanterns, wards, offerings,
       charms);
     - a watchtower or shrine gives a team's Sight a head start;
     - a council hall allows larger teams or two missions a season;
     - a garden or tavern hastens recovery and bonding.
7. **Logistics is background.**
   - Chores (wood, storage, towing, splitting, fields) run themselves.
     Autopilot-style planning for chores becomes the default; the player
     can still draw plots and place buildings.
   - The many resource chains stay only where they feed a person's life or
     a mission.

### 38.5 The loop

```
Home (a few days at a time, real time with pause)
  ├─ see what the last mission did: debrief, marks, ties, grief, news
  ├─ life happens: suppers, quarrels, courtship, council (people argue
  │    from their ties), the Folk visit their bonded
  ├─ prepare: build and equip, rest the shaken, choose the next venture
  └─ ventures on offer (a board, like XCOM's scan / Wildermyth's map)
        │
Mission (turn-based, direct control, 10–20 min)
  ├─ choose the team (their ties matter: pairs steady each other,
  │    rivals don't; a bonded Folk being may come)
  ├─ play it
  └─ outcome ladder: cleared / withdrew / someone taken / someone lost
        │
Debrief → back to Home
```

Pacing target (proposal): a mission offered every 2–4 days; the player
chooses which, and when. Not every offer must be taken; offers expire, and
leaving some undone has consequences (a Restless grows restless, a Folk
request sours, a salvage cache is lost to the weather).

### 38.6 Mission types (in order of building)

1. **Clearing a haunted district** (exists, §19.10). To be deepened first
   (§38.8).
2. **Search for the led-astray or the taken** (the Folk have someone; the
   team follows their trail into the Wild; exists only as a hook, §20.6).
3. **Laying a particular Restless to rest** (a named spirit with a history
   drawn from the old world's provenance: whose house, whose car).
4. **Salvage run to far ruins** (off the home map; fixes the finite scrap
   problem, §22.12 seed 6).
5. **A Folk errand** (a Gentry asks for something fetched, returned or
   witnessed; payment in favour or gifts).
6. **Escort or meeting** (strangers, a neighbouring band; a source of
   recruits and news).

### 38.7 What each current system becomes

| System | Becomes |
| --- | --- |
| Clearing (`haunt.ts`) | the heart; deepened first |
| Bonds (`community.ts#Bond`) | ties with remembered reasons (38.4.3) |
| Memories, lineage, gatherings | inputs and outputs of ties; shown on cards |
| Council, dilemmas, request tray | people argue from their ties; fewer abstract choices |
| Folk (hill, knowes, mycelium, Gentry/Wee) | mission givers, companions, contested land; bonds with individuals |
| Nerve, Sight | per-person stats, used mostly on missions (partly already) |
| Influence, Glimmer, Resonance | to be reduced: mission resources, or dropped (decide after step 1) |
| Buildings and build menu | equip and restore people; the growing menu (§32) stays |
| Logistics (wood, storage, towing, trades, power, timber) | background, autopiloted; kept where it feeds people or missions |
| Population (`MAX_POP` 24) | a small cast, about 8–14 |

Nothing is deleted before step 1 proves out; later steps are mostly
retuning and presentation.

### 38.8 Build order (proposal)

1. **Make one mission good** (a clearing, about 15 minutes), then have the
   user play it and iterate until it is worth replaying:
   - map variety (a few hand-shaped templates per district kind, varied
     by seed);
   - spirits with distinct behaviour and tells that Sight reveals;
   - verbs with real trade-offs (cost, risk, what each outcome gives
     back to the village);
   - a threat curve, with Nerve as the cost;
   - pairs who steady each other;
   - a debrief that says what happened to whom.
2. **Ties that remember why:**
   - reason records on each tie (people and Folk beings);
   - produced mainly by missions;
   - shown on the person card;
   - `bondValue` becomes their sum, so existing behaviour keeps working.
3. **Consequences at home:**
   - marks, scars and traits from missions;
   - the empty seat at supper, grief with names;
   - courtship and feuds that follow ties;
   - council voices that follow ties;
   - the Folk visiting their bonded (§36.2).
4. **Resize the village:**
   - a small cast (about 8–14);
   - buildings that equip and restore;
   - chores on autopilot by default;
   - a venture board.
5. **More mission types**, in the order of §38.6.

### 38.9 Open questions for the user

1. **Death.** The vision (CLAUDE.md) says permadeath; clearings today only
   *take* people (they return changed, §19.7). Options:
   - (a) the taken as the heavy outcome, with death only from old age and
     rare home events;
   - (b) real death on missions as well, rare and signposted;
   - (c) the taken can be lost for good if no one goes after them in time.
   
   (c) keeps the tone and makes rescue missions matter.
2. **Direct control at home.** Wildermyth has none; XCOM only through menus.
   Keep home autonomous (the player sets plans, councils and missions), or
   allow some say over individuals there (assign a pair to live or work
   together, ask someone to apologise)?
3. **Cast size.** Is 8–14 right, or smaller still (Wildermyth's 5–10)?
4. **Time between missions.** Real time with pause as now, or should home
   advance in chunks between missions (Wildermyth's chapter breaks)?
5. **The Veil's cost** (10 Influence, §21.9): keep, or replace with
   preparation (kit, rest) as the gate?

### 38.10 Movement: free, with two rings (agreed)

The user: "I'd rather just see a radius around where the character is and
have them walk to that." They are content with the grid for building but
dislike its blocky roads, and would like straight lines where wanted and
fluid shapes elsewhere. They agreed to the two rings.

**The principle:** the tile grid stays underneath as an invisible index
(passability, cost, occupancy, ownership). What the player sees and
controls becomes continuous.

**In missions (built with step 1):**
- Positions are world coordinates, not `tx/tz` integers.
- Two rings round the selected person, drawn as soft contours (not lit
  squares), shrunk round walls, ruins and brambles:
  - **inner ring:** move and still act this turn;
  - **outer ring:** dash; no action after.
- Reach is a distance flood over a fine hidden grid (about 4 cells a tile)
  with taut paths, then drawn as a contour. The Chebyshev range `cheb`
  goes: every range becomes a circle (sight, listen, offer, ward reach).
- Line of sight is a ray test against walls and heaps. A doorway, a car
  or a hedge conceals.
- Previews before committing:
  - a ghost of the figure where it would stop;
  - the path it would walk;
  - which known spirits would notice it there;
  - rings showing what its lantern would light and what its actions would
    reach.
- **Concealment, not cover.** Nothing shoots, so the tactical position is
  about being *unseen* (dark, behind things, shuttered), *steadied* (near
  a teammate or inside a ward) and *lit* (in your own light, or another's).

**In the village (later, cheapest first):**
1. Taut walking paths: A* then straight lines wherever clear, so people
   walk diagonals and curves, and desire paths follow.
2. Drawn roads: lanes stored as lines or curves (straight with angle
   snapping, or curved), drawn as ribbons of ground and written into the
   grid only as movement cost. A finer wear texture traced along walked
   lines also fixes §36.1.
3. Free plot and field corners: outlines no longer snap to tiles; the grid
   keeps only which tiles belong to a plot.
4. Buildings at any angle: large (footprints, cutaway, clearance, slopes,
   merged meshes all assume axis alignment). Deferred; only if 1–3 still
   look rigid.

### 38.11 The dark: the murk over uncleared land

The user: "by default the tactical missions start with less visibility …
maybe even on the default map there's a dark cloudiness to the uncleared
areas so we can't really see them in advance."

**On the home map:**
- A haunted district lies under a **murk**: a slow, dark, low cloud, darker
  than the ordinary fog of the unexplored (`world.explored`). From home you
  see only its outline, an occasional light moving in it, and whatever has
  been learned (§38.14).
- Soundings from the village's edge (a watchtower, a seer at the boundary)
  thin the murk in patches and leave echoes. Missions push it back.
- When the district is settled, the murk lifts for good. Given to the Folk,
  it becomes their gentler glamour (§26), not murk.

**In the mission:**
- It is night in the Veil. The ground is visible only where **light**
  falls, or faintly where it has been seen before (remembered, greyed).
- Spirits are not visible by light alone. They are perceived by **Sight**
  and **sounding** (§38.14). Light shows the physical world and the
  *signs* spirits leave, and it changes how spirits behave (§38.12).
- So there are two kinds of knowledge on the map: *what the lanterns show*
  (ground, doors, objects, signs) and *what the seers sense* (spirits).

### 38.12 Light: the lantern as the team's instrument

Not a weapon: light is how the team sees, moves, reassures, lures and
holds ground. Everyone carries a lantern. The lantern is personal: made at
home, improved, named, carried in the debrief, lost if its bearer is taken,
and inheritable.

**Handling (free, part of moving):**
- **Raised:** full radius; spirits notice the bearer sooner.
- **Shuttered:** almost dark; the bearer moves unnoticed, sees only by
  Sight, and their Nerve drains slowly (the dark is frightening).
- **Set down:** leaves a pool of light where it stands (the simplest ward,
  §38.13); the bearer goes on in the dark or shares a friend's light.

**Fuel:** every light has fuel counted in turns. It comes from home:
- candles and tallow from the smoke shed;
- lamp oil (a later trade);
- batteries charged from the power grid (§24.17).

This is the first direct line from the village economy to the mission.

**Going out:** a lantern gutters when its fuel runs out or a Hollow drinks
it. In the dark, a person loses Nerve each turn and sees nothing physical.
Relighting costs an action. Walking to a friend and sharing their light is
free, and it is recorded as a tie reason (§38.4.3): "shared her light with
me".

**Kinds of light** (made at the workshop from salvage with provenance, and
from know-how):

| Light | How it lights | Good for | Cost / catch |
| --- | --- | --- | --- |
| Tin lantern (default) | warm pool, radius about 4 | comfort (Nerve holds in it); remnants drift toward warmth | small; lamps are drawn to it |
| Electric torch | long narrow cone, aimed | seeing far down a street; pushes hedges back; breaks a lamp's lure while on it | batteries; harsh: a remnant in the beam loses calm |
| Foxfire jar (Folk-made, from the mycelium) | cold, dim green, radius about 2 | unseen by spirits; shows traces and Veil-depth nearby | needs Folk standing or a bonded Folk being |
| Magnesium flare (rare, one use) | floods a wide area for one turn | reveals everything lit; stuns hedges; blinds lamps for 2 turns; a Hollow draws back | remnants scatter and lose calm; wakes every spirit near |
| Mirror lantern (glass, §21.7) | throws a pool of light at a distance, or a beam round a corner | lighting a place without walking into it | glass; heavy (takes a carrying slot) |

**Tailoring (the upgrade path):** a lantern is assembled from parts, each
chosen at the workshop:
- **body:** tin → brass → glass dome (radius, and whether wind or a Hollow
  can snuff it);
- **fuel:** tallow → oil → battery (how long it lasts);
- **lens or filter:** clear, red (dim and unnoticed), blue (Veil-leaning:
  shows depth);
- **a charm** (a Folk gift, a keepsake from a laid remnant: a small unique
  effect).

Parts carry provenance ("the lens from the lighthouse on the point"), so a
lantern has a history, like the houses.

**Spirits and light (first pass):**

| | Warm lantern | Torch beam | Foxfire | Flare |
| --- | --- | --- | --- | --- |
| Remnant | drawn gently; calms faster in it (its need *light* already exists) | flinches; loses calm | indifferent | scatters; loses calm |
| Hedge-spirit | plays in it | pushed out of the beam | indifferent | stunned a turn |
| Lamp | drawn to it; lures its bearer harder the brighter it is | its lure breaks while lit | cannot see it | blinded 2 turns |
| Hollow | drinks it (fuel drains in its reach) | shown in full, unharmed | indifferent | draws back a turn |

### 38.13 Wards, rethought

Today (`haunt.ts`): 2 wards a clearing, a square of radius 2 that halves a
Hollow's dread and shields from hedges and lamps. The user: wards "are a
cool idea they just need to be thought through more and improved."

**Wards become the team's way of shaping the ground**: they are placed
things, each with a shape, a rule and a limit, and carried from home, so
choosing them is part of the loadout.

| Ward | Shape | Rule | Limit |
| --- | --- | --- | --- |
| Set-down lantern | circle (the light's radius) | light as §38.12; Nerve holds inside | uses that lantern's fuel; bearer is dark |
| Salt or iron line | a line between two points (free geometry makes this possible) | hedges and lamps cannot cross it; lures stop at it | iron offends the Folk: a Folk companion loses heart, and in Folk country standing drops |
| Rowan or hawthorn ring | small circle | Nerve cannot fall below 2 inside; resting there restores 1 a turn | wood from the woodlot or a Folk gift; a Hollow withers it over 3 turns |
| Bell or wind chime | circle | a spirit entering it rings: it is revealed (an echo, §38.14) wherever the team is | tells, does not stop |
| Hearthstone (from the home fire) | large circle | the team's rally point: nothing takes a person inside it; withdrawal starts here | one a mission; placed on arrival, cannot move |

Rules common to all:
- a ward is visible as a shape on the ground and previewed before placing;
- strong spirits wear wards down (a Hollow erodes any ward in its reach
  each turn);
- wards left behind after a clearing stay in the district as small works
  (a salt line becomes a low wall of stones), so the land keeps a record.

**Carrying:** each person carries their lantern and 2 slots (wards,
offerings, tools, spare fuel). A strong or practical person might carry 3.
Packing is decided at home before setting out.

### 38.14 Finding spirits: signs, Sight and sounding

The user: "finding the entities on the map needs to be more nuanced …
maybe some kind of almost sonar system for the seers."

Today a spirit's reading is a fixed function of Sight against the spirit's
depth within 10 tiles (none / chill / luminous / coherent), and spirits are
effectively shown when read. Proposed: **spirits are never shown as plain
markers until perceived, and perception comes in layers.**

1. **Signs** (anyone, in light):
   - physical traces: frost on a window, a door that won't stay shut,
     a toy set upright, the smell of bread in an empty kitchen, cold spots;
   - they hint at kind and need, and point toward the spirit;
   - they are found by walking the lit ground.
2. **Sight** (passive, each person): within a small radius (about 3, more
   with high Sight), a person senses spirits at their reading level each
   turn, without acting.
3. **Sounding** (the seers' sonar; an action):
   - a person with Sight above a threshold *sounds the Veil*;
   - a ring visibly expands from them across the map;
   - where it meets a spirit it returns an **echo**, as good as their
     reading of it:
     - *coherent*: an exact position and kind;
     - *luminous*: a circle it is somewhere inside;
     - *chill*: a direction and rough distance only (an arc);
   - echoes stay on the map as fading ghosts of *last known position*; they
     age each turn and become less certain;
   - **triangulation:** two seers sounding from different places narrow
     arcs to a point, so pairs and positioning matter;
   - **the catch:** a sounding is heard. Spirits within its reach notice
     the seer: lamps come toward it, Hollows turn, remnants may hide
     deeper (raising their depth).
   - Two strengths:
     - *listen*: short range, silent;
     - *call out*: long range, loud.
   - A Folk elder's sounding is always coherent.
4. **Tools for those without Sight** (salvage, the old world's
   instruments):
   - a **radio** hissing louder near spirits (a Geiger counter for the
     Veil);
   - a **compass** whose needle drifts toward the nearest;
   - a **dowsing rod** (Folk-taught).

   Each takes a carrying slot.

**From home:** a seer at the district's edge, or a watchtower, can sound
into the murk before a mission. Echoes are left on the home map, and the
mission offer shows what is known and what is not ("two echoes, one deep;
something large near the old school").

**This makes Sight the seers' identity.** Anchors (low Sight) are sturdy
and steady others. Seers find, but are found. That is a natural tension
inside a small team.

### 38.15 Updated step 1 (what "make one mission good" now includes)

1. Free movement with two rings and previews (§38.10).
2. The dark: light radius, remembered ground, the murk on the home map
   (§38.11).
3. Lanterns: raised / shuttered / set down, fuel, the tin lantern and
   torch first; foxfire, flare and mirror after (§38.12).
4. Wards: set-down lantern, salt/iron line, rowan ring and bell first;
   hearthstone after (§38.13).
5. Signs, passive Sight and sounding with echoes and triangulation; the
   radio as the first tool (§38.14).
6. Carrying slots and a packing screen before setting out.
7. The spirit × light table implemented and tuned, then played by the user.

Open questions for §38.10–38.14:
- How dark? Should remembered ground stay visible (greyed) or be lost
  again when the light moves on?
- Should echoes on the home map be enough to choose missions, or should
  some districts show nothing until someone walks in?
- Is iron offending the Folk a good tension, or too punishing while the
  Folk are also companions?
- Carrying: 2 slots each plus the lantern, or a shared team pack?

### 38.16 The user's answers (after §38.15)

1. **The dark returns.** Until a district is cleared, ground goes back to
   murk soon after the light leaves it (within about a turn). Nothing is
   remembered as visible; the team knows only what their lights show now,
   plus echoes (§38.14), which also fade. Once a district is cleared, it
   stays visible.
2. **Two carrying slots per person** (plus the lantern). Agreed for now.
3. **Echoes from home** (explained; the user's answer pending). The
   question is how much the player knows before choosing a mission:
   - (a) *scouted*: a seer or watchtower can sound into the murk from the
     village edge, and the mission offer shows what that found ("two
     echoes, one deep, near the old school"); XCOM-style briefing, so
     choosing a mission and packing for it are informed decisions;
   - (b) *blind*: nothing is known until the team walks in;
   - (c) *mixed*: soundings from home give only vague echoes (direction and
     count, never kind), so a mission is chosen with partial knowledge.
4. **Iron and the Folk** (explained; the user's answer pending). In
   folklore, cold iron repels the fair folk. The game already uses this at
   home: iron over a door keeps the Wee Folk's mischief out (§25.5,
   `sim/fae.ts`). In missions, an iron line would be the strongest barrier
   against hedges and lamps, but:
   - a Folk companion near it loses heart (their Nerve drops);
   - laid in Folk country, it lowers standing;
   - a salt line does the same job without offence but is weaker and washes
     away in rain.

   Choosing iron would be choosing effectiveness over the relationship.
5. **Characters need much more work.** The user: "we're definitely going to
   have to do a lot of work on character graphics and animation. We could
   get away with lower fidelity when it was the town building." Missions put
   the camera close and the player's attention on a few people. Needed
   (to be coordinated with the user's character branch; this branch does not
   touch `render/characters.ts`, `render/people.ts`, `scripts/blender/` or
   `assets/people/`):
   - **a closer mission camera**, and a figure readable at that distance:
     a face or clear head shape, distinct silhouettes per person (hair,
     coat, hat, build), and clothing colours that are theirs;
   - **held props:** the lantern in hand (with its light attached to the
     hand bone), a torch, a bell, a satchel showing the two slots;
   - **animations:**
     - idle, walk, dash;
     - move shuttered (hunched, lantern closed under a coat);
     - raise lantern;
     - kneel and set something down (a ward, an offering);
     - draw a line (salt or iron);
     - listen (head bowed) and sound the Veil (arm out, a visible ring);
     - offer with both hands;
     - steady someone (a hand on a shoulder);
     - flinch, shaken, and breaking (sinking down);
     - being lured (walking slack toward a light);
     - being taken (fading into light);
     - a greeting, and grief, for debriefs and home;
   - **marks** as attachments or tints (a grey streak, a scar, a Folk gift
     that glows), so change shows on the figure (§38.4.4);
   - **spirit figures** of the same fidelity: remnants as the people they
     were, hedges, lamps, the Hollow.

### 38.17 Settled (the user agreed to the proposals in §38.16)

1. **Knowledge before a mission: mixed, improvable.**
   - By default, soundings from home give vague echoes: how many, and
     roughly where, never what kind. A mission is chosen and packed for with
     partial knowledge, and the rest is found inside.
   - A better watchtower, or a strong seer sounding from the district's
     edge, moves a district toward a full briefing (kind and position of
     what was sounded). This gives buildings and seers a use before a
     mission.
   - Echoes seen from home fade over days, as they fade over turns inside.
2. **Iron offends the Folk,** as proposed:
   - an iron line is the strongest barrier against hedges and lamps;
   - a Folk companion near it loses Nerve;
   - laid in Folk country, it lowers standing;
   - a salt line is the gentler alternative: weaker, and washes away in rain.

   If playtests show it makes iron useless whenever a Folk companion comes,
   fall back to the milder rule: iron offends only in Folk country or when a
   companion sees it laid.
3. **Characters:** mission mechanics start with the existing figures and a
   camera no closer than now. The close camera, held props, the animation
   set and marks (§38.16.5) follow as the user's character branch provides
   them. This branch still does not touch `render/characters.ts`,
   `render/people.ts`, `scripts/blender/` or `assets/people/`.

Still open from §38.9: death (taken vs. real death vs. taken-lost-for-good),
direct control at home, cast size, time between missions, the Veil's
Influence cost.

### 38.18 Step 1 built: free movement with two rings (not published)

**The sim** (`sim/veilmove.ts`, `sim/haunt.ts`):
- Team members stand at world coordinates (`Unit.x/z`); spirits still keep to
  their tiles (`spiritAt`).
- **The ground:** a `VeilGrid` of the district (built once per clearing)
  says where people can walk and what blocks sight:
  - walls, wrecks and trees block sight;
  - trees are round obstacles, not whole tiles.
- **Reach** (`reachField`): a distance flood over a fine grid (4 cells a
  tile, 16 neighbours, no corner cutting), clear of other people (0.6) and
  spirits (0.75). About 1 ms, and remembered per state (`reachOf`).
- **Two rings:** one action walks up to `MOVE_PER_AP` 4.5 (scaled by a Folk
  companion's stride); two actions (a dash, nothing after) twice that.
  `walkCost` gives the cost of a walk and `moveUnit(x, z)` makes it.
- **Paths** are pulled taut (`pathTo`) and kept on the unit as `trail`, so
  they can be drawn walking it.
- **Ranges are circles:**
  - "beside" is `BESIDE` 1.6;
  - every old "within n tiles" is now n + 0.6.
- **`reaches(spirit, who)`** holds the end-of-turn rules in one place. Its
  one new rule is concealment: **a lamp must see you to lure you** (line of
  sight). `threatsAt` uses the same rules for the walk preview.
- **The test bot** walks with `approachPoint`. Its suburb results are
  unchanged: 6 of 6 cleared, 1 rattled, 0 taken.

**The view** (`render/clearing.ts`):
- The rings are drawn as soft contours from the reach field: a two-channel
  texture (distance and reachability) under a shader. The inner area is
  filled teal with an edge; the outer edge is amber and follows walls, trees
  and wrecks.
- Hovering the ground shows:
  - the way, as dots (white for one action, amber for a dash);
  - a ghost of the person standing there;
  - orange rings on every perceived spirit that would reach them there.
- The tip says "Walk here: 1 action" or "Dash here: the whole turn", and
  which spirits reach that spot (with what: dread, grief, tricks or lure).
- People walk their trail corner by corner. Clicks land anywhere, not on
  tiles.

**Step 1b, village paths** (`path.ts#tautPath`): after A*, a path is pulled
straight wherever the line crosses only open ground no dearer than the
chosen way (a body's width either side). People walk diagonals, but still
go round fences, beds and trunks.
- Soak, 4 villages for 1 year: no deaths and no flags.

**Debug:** `__game.veilHoverAt(d, bearing)` points the cursor at a
reachable spot about `d` away.

**Not yet:** a closer camera; drawn roads and free plot corners in the
village; smoothing the pixel look of the ring edges.

## 39. The Home brush goes; outlines by kind of thing (after §38.18)

### 39.1 The Home zone brush is removed

The user asked what the Home tool did; the answer was "almost nothing" in
the default game:
- placement and drawn plots ignore it (`canPlace` passes `needZone = false`);
- only the autopilot plans by it (`findSite`, `findPlot`, `autopilot.ts`
  painting more).

The user agreed it can go.

- **The button is gone** from the zone toolbar (`index.html`).
- **The Home tint and outline are hidden** unless the village plans itself
  (`ZoneTexture.showHome`, set from `village.autoPlan`).
- **The autopilot still paints and uses Home internally.**
- **"The land around home"** (`veil.ts#homeResonance`) is no longer the
  painted zone. It is the resonance cells within 12 of the fire, each hamlet
  fire and each home.
  - It drives thin sleep, phenomena near the village, the council's shrine
    proposal, the shrine unlocking, and the hourly mood from the land.

### 39.2 Outlines for some kinds of thing, not others

The user: outlines make things feel cluttered, and not everything needs
them; perhaps outlines on built things but not plants, and not glass.

**How it works** (`render/outlinecats.ts`):
- Outlines come from the depth buffer alone, so every draw in the main pass
  also writes a category into the stencil buffer. A hook on
  `Object3D.prototype.onBeforeRender` sets the material's stencil reference.
- **The category** comes from:
  - the material, if it says: glass panes, dome glass and shop windows are
    tagged `glass` (`tagOutline`); foliage materials (enhance seasons
    broadleaf, conifer and grass, including ivy) and crops are `plants`;
  - otherwise the nearest named scene group: terrain (ground); trees,
    bushes and tufts (plants); village, site, plots, camp, fields and
    gatherings (built); ruins, oldworld and heaps (old world); people and
    herds; folk, townhouse, mycelium and clearing (the Folk and spirits);
  - anything else is "other".
- **See-through materials** keep the category of what is behind them,
  except glass.
- **The mask:** the outline pass draws one full-screen quad per category
  that is switched on, stencil-tested against the frame's depth-stencil
  texture (borrowed by a small target, never sampled there). The result is
  a mask texture: red where lines are allowed, green where the pixel is
  ground.
- **Who owns a line:** a line lands on the nearer surface, so a tree in front
  of a house is the tree's to outline. The ground hands its line at an
  object's foot to that object, so a house keeps its whole outline with the
  ground's lines off.
- **Cost:** with everything ticked the mask isn't drawn at all. The composer's
  depth textures are now depth-and-stencil.

**The panel** (key G):
- Under Outlines, "Outlines on…" lists the eight kinds, each with a tick.
- Presets: "Built only" (lines on built things, the old world, people and
  the Folk; none on ground, plants or glass) and "All".
- Remembered as `GfxSettings.outlineOff`.

**Debug:**
- `__game.outlineShares()` gives each category's share of the screen (seed
  3, the camp: ground 62%, plants 20%, built 13%, old world 4.5%).
- `shot.mjs` now prints an `eval` step's value.

## 40. Steps 2–5 of the first mission: the dark, lanterns, finding, wards (built overnight; not published)

Built from §38.11–38.17 (`sim/veilkit.ts`, with the rules in `sim/haunt.ts`).
The user asked for "a decent chunk of backend work" while away; the rules,
the test bot, the tests and enough of the interface to play it are done.
Numbers are first guesses to tune with the user.

### 40.1 The kit (§38.13)

- **Lanterns:**
  - everyone carries a tin lantern (radius 4, warm, 14 turns of fuel);
  - if the village has any power, the first person with low Sight carries an
    electric torch instead (a cone 8 long, cold, 10 turns);
  - each tin lantern's candles cost 1 food from the stores; without the food,
    it goes in half full.
- **Two slots each** (`Unit.slots`), packed by `defaultKit` (seers: a bell
  and spare fuel; anchors: rowan and salt; others: a radio if there is power,
  otherwise salt, plus fuel). `startClearing(..., kit)` takes a chosen kit.
  The stores pay for what is packed:

  | Item | Cost |
  | --- | --- |
  | iron | 2 scrap |
  | bell | 1 scrap |
  | rowan | 1 wood |
  | spare fuel | 1 food |
  | radio | 1 scrap, and needs power |
  | salt | free |

  What can't be paid for stays at home.
- **The hearthstone** is set down where the team came in: a small warm
  light (radius 2.5), and nobody beside it is taken (they flee instead).

### 40.2 The dark (§38.11, §38.16)

- **Ground is seen** where a light reaches it now (radius, a torch's cone,
  line of sight), plus last turn's lit tiles (`Clearing.dusk`). Everything
  else sinks into a violet dark with faint shapes:
  - the clearing writes what is seen into the fog texture's green channel;
  - every material reads it under `uVeilDark` (`util.ts`);
  - outlines stop at the dark too.
- **Perception:** spirits are sensed, not lit. Passive Sight now reaches only
  `senseRange` = 3 + Sight/25 paces (it was 10).

### 40.3 Lanterns (§38.12)

- **Handling:** raise / shutter / set down / pick up are free; relight and
  refuel (spare fuel) take an action.
  - A set-down lantern is a **pool** (a ward): radius 3.5. Inside it lures
    fail and a Hollow's dread is halved; the bearer goes on in the dark.
- **Fuel** burns 1 a turn (0.5 shuttered).
  - A Hollow drinks lights within its reach: 1 more fuel, and a 35% chance
    the light goes out.
  - At 0 the lantern gutters out.
- **The dark frightens:**
  - no light on someone at the turn's end: −1 Nerve;
  - alone with a shuttered lantern: −1 every other turn.
- **Noticed or not:** shuttered or unlit, hedge-folk and lamps don't notice
  someone beyond arm's length (2.6). A raised tin lantern draws a lamp from
  2 paces further.
- **Spirit by light** (built so far):
  - warm light on a remnant that wants light: calm +1 a turn (replaces the
    old "ward beside them");
  - a torch beam (aimed at a spirit, free): a lamp's lure and a hedge's
    tricks fail that turn, and a remnant loses 1 calm;
  - light on a Hollow helps unravel it (+1, as the old ward did).
- **Not yet:** foxfire, flares, the mirror lantern, tailored parts.

### 40.4 Finding spirits (§38.14)

- **Signs** (`makeSigns`): two near each spirit, three near a Hollow, one of
  a remnant's hinting at what it wants ("two cups set out on a garden table,
  one untouched"). A sign is found when light falls on it; it is logged, and
  leaves an echo circle (radius 3) near what left it.
- **Sounding** (seers, Sight 35+, and the Folk), one action:
  - *sound* reaches 9 paces, unheard; *call* reaches 18 and is heard;
  - quality = Sight + land − depth − 2 × distance (+5 for a call): exact,
    a circle (radius 2), or a bearing only (an arc);
  - two bearings from places at least 4 apart, within a turn, make a circle
    (radius 1.4) where they cross;
  - **heard** (a call): a lamp reaches 4 further for the caller, the Hollow
    presses the caller 1 harder, and remnants go 8 deeper.
- **Echoes fade:** exact → a circle radius 1, then +1 radius a turn, and
  gone after 3 turns.
- **Other ways to know:**
  - **bells** give exact echoes within 4.5 each turn's end;
  - a **radio** gives a ring: how far, not which way (12 at most);
  - **being lured** gives the lamp's exact place; a hedge's tug gives a
    circle.

### 40.5 Wards (§38.13)

- **Salt / iron:** a line from where you stand toward a point, up to 5
  long. Hedge-folk and lamps can't reach across it, and a lure's pull stops
  at it.
  - Salt has 4 hp, iron 8.
  - Hedge-folk wear salt down; a Hollow wears everything near it.
  - **Iron:** a Folk companion within 3 loses 1 Nerve a turn, and laying it
    at all costs standing at the end (−3 in Folk-suited districts, −1
    elsewhere).
- **Rowan:** a ring of radius 2, 3 hp. Inside it, Nerve never falls below 2
  and gains 1 a turn; a Hollow withers it.
- **Bell:** see above (4 hp).

### 40.6 Ruins and sight (a fix)

A ruin's walls no longer block light or sight into the ruin itself (a
doorway sees in and out). Before, a lantern could never light a remnant in
its own house.

### 40.7 The test bot and balance

- `sim/clearbot.ts` now plays only on what the team knows (perceived spirits,
  echoes, signs):
  - seers sound every turn while anything is unaccounted for (quiet on odd
    turns, a call on even);
  - the blind explore outward;
  - lanterns are tended; torches are aimed at lamps and hedges;
  - beside the Hollow it lays rowan and sets a lantern down.
- Nights are 14 turns now (were 12).
- `scripts/clearprobe.ts -- [kind] [seeds] [--log] [--poor]` plays one kind
  of district on many seeds.
  - Suburbs, 12 seeds: 6 cleared, 6 withdrew; 9 people fled and 1 was taken
    across the runs.
  - Most failures end with the Hollow nearly unravelled (hold 1–2) or never
    reached; that is the bot's weakness, and a player should do better.
- `tests/veilkit.test.ts` (13 tests). The clearing tests still pass.

### 40.8 The interface (minimal)

- **Right-click one of the team:** their lantern's actions, *Sound the Veil*
  and *Call out into the dark* (seers), and *Lay salt / iron / rowan / bell*
  (then click where; right-click or Escape cancels; a preview line or ring
  follows the cursor).
- **Clicking a spirit** (with a torch): *Shine the torch on it*.
- **The team panel** shows each person's lantern, fuel and kit.
- **"What lives here"** lists echoes of what isn't yet perceived (clear /
  about here / a bearing only, and how old).
- **On the ground:** echoes as violet rings and arcs fading with age; wards
  as lines and rings; found signs as small pale marks; the hearthstone in
  orange.

**Not yet:**
- a packing screen before setting out (the kit is the default);
- light itself drawn (glow pools);
- a debrief;
- map layouts per district kind;
- the remaining kinds of light.
