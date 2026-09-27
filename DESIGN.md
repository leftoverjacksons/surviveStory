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
