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
