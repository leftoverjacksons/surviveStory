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
- **Salvage era → timber era** after a workshop, practice (6 projects) and
  time (day 8+). Old shacks are rebuilt in timber.
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
| **C3: Art pass** | Lighting (GTAO, grading, fog, depth of field), procedural building parts, flowers and moss, character-model trial | **[next]** |
| D: Expeditions | Parties, ruins, blueprints, entity encounters, tactical hook | [planned] |
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
