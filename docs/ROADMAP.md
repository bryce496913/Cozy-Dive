# Cozy Diver — roadmap

This is the canonical roadmap. It was reconciled with the code in Pass 049; the evidence (feature matrix, tests and gaps) is in [DEVELOPMENT_AUDIT.md](DEVELOPMENT_AUDIT.md). Milestones describe direction, not a fixed release schedule. Each pass stays small, playable and easy to review. A milestone closes only on the user's explicit acceptance after a macOS play-through. Passing automated checks never closes one.

## Vision

Cozy Diver is a calm, browser-based scuba exploration experience. The player begins in a cozy office, approaches a small aquarium, dives inside, and becomes tiny in a large, customizable underwater world. Hidden passages lead to larger marine environments. The experience prioritizes natural creature behaviour, polished geometry, comforting sound, smooth swimming, freedom of exploration and zero gameplay pressure.

## Milestone status

"Implemented" means merged and reachable in the app. "Accepted" means the user played it on the MacBook Air and said so. Nothing has been released: there are no git tags or releases.

| Milestone                           | Focus                                                                                     | Last candidate | Implemented | Automated tests | Accepted                    | Released |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | -------------- | ----------- | --------------- | --------------------------- | -------- |
| **v0.1 — First Dive**               | Foundation, procedural aquarium, calm first-person swimming, boundaries, settings, tests. | Pass 003       | Yes         | Yes             | Not explicitly recorded     | No       |
| **v0.2 — Living Aquarium**          | Tropical reef life, fish behaviour, plants, ornaments, audio, authored art.               | `0.2.0-rc.15`  | Yes         | Yes             | **Yes**                     | No       |
| **v0.3 — Office & Dive Transition** | The office and a seamless dive into the aquarium.                                         | `0.3.0-rc.1`   | Yes         | Yes             | **Yes**                     | No       |
| **v0.4 — First Passage**            | A hidden opening in the tank to a larger tropical reef, with big animals and sightings.   | `0.4.0-rc.3`   | Yes         | Yes             | Open: awaiting play-through | No       |
| **v0.5 — Personalization**          | Seen items and baby animals added to the tank, with local saves.                          | `0.5.0-rc.1`   | Yes         | Yes             | Open: awaiting play-through | No       |
| **v0.6 — Expanding Oceans**         | Kelp forest, sea cave and under the ice, with wildlife and rare encounters.               | `0.6.0-rc.10`  | Yes         | Partly¹         | Open: content still growing | No       |
| **v0.7 — Polish** (proposed)        | See below.                                                                                | —              | —           | —               | —                           | —        |
| **v0.8 — Beta** (proposed)          | See below.                                                                                | —              | —           | —               | —                           | —        |

¹ v0.6 has unit tests throughout. The full browser regression was last run at `0.6.0-rc.1` (Pass 040). The under-ice harnesses and the long-session memory harness have not been run yet.

## Original plan versus the actual order

The original plan was:

1. V0.1 First Swim
2. V0.2 Living Aquarium
3. V0.3 Office and Dive Transition
4. V0.4 Personalization
5. V0.5 Beyond the Glass
6. V0.6 Expanding Oceans

After v0.3 was accepted, the user swapped v0.4 and v0.5 so that exploring fills the catalog: First Passage (Beyond the Glass) became v0.4 and Personalization v0.5. v0.6 has grown from "new environments" into three new worlds with wildlife and rare encounters. The history below is preserved as it happened; it is not reversed.

## Unresolved product decisions

These need the user's decision. Nothing is removed until then (details in the audit, §8):

1. **Geography:**
   - **The worlds:** the aquarium and outer reef are tropical, while the kelp forest and sea cave are temperate and under the ice is Antarctic. Is the game a tour of many oceans through one tropical tank?
   - **The polar bear:** it is Arctic. Keep it as whimsy, relabel the world as polar, or replace it?
2. **Temperate and polar unlocks:** whether their animals unlock for the tropical tank.
3. **v0.6 content freeze:** freeze v0.6 content now, or add one more world first?
4. **v0.1 acceptance:** whether v0.1 counts as accepted through the v0.2 acceptance.

## Proposed next milestones

These are proposals, not commitments; they start only when agreed.

**v0.7 — Polish (proposed).** No new worlds; make what exists feel finished.

- **Loading:** smooth the world-entry hitch (about 140–190 ms worst frame on SwiftShader), measured on the MacBook Air first.
- **Sound:** give each world a gentle sound of its own (kelp surge, cave drip, ice creak), within the existing audio budget.
- **Comfort:**
  - a reduced-motion and comfort review across all worlds;
  - text size and contrast in the journal and editor;
  - a full keyboard-only pass.
- **Personalization:** a decision on unlocks from the newer worlds (see the decisions above).
- **Regression:** every browser harness green, plus the long-session memory budget, on one revision.

**v0.8 — Beta (proposed).** Ready for people other than the developer.

- **Browsers and hardware:**
  - Safari and Firefox checks;
  - a lower-end laptop GPU tier, with a quality setting if measurements need one.
- **First run:** a short, skippable first-run hint flow, plus recovery from failed loads (retry rather than reload).
- **Production:** a production build and hosting checklist, a size budget and a version tag (the first actual release).
- **Feedback:** a short known-limitations list and a way for testers to report issues offline (no accounts or backend).

## History

The first pass intentionally excludes office scenes, fish AI, customization, hidden passages, large oceans, multiplayer, authentication, inventory, quests, complex physics, backend services, and mobile touch controls. Do not interpret roadmap entries as authorization to build them now.

Pass 011 prepares `0.2.0-rc.6` for manual MacBook Air acceptance; it does not declare v0.2 complete. Potential v0.3 follow-ups include hardware-driven transparency/performance work, longer real-time browser soak coverage, and small optional interactions after their scope is agreed. No such feature is included in this candidate.

Pass 007 intentionally replaces the freshwater biological identity with a 38-fish tropical reef. Pass 009 adds the first host-associated pair and sheltered moray.

Pass 008 adds six procedural home-aquarium ornaments, bounded chest/filter effects and named safe creature anchors. Those six props remain in Pass 009; swimming and the audio mix stay in place.

Pass 009 adds one animated anemone, two local ocellaris clownfish (40 ordinary fish total), one sheltered moray, and scene-free creature-home metadata. Those animals remain in Pass 010, with no aggression or feeding mechanics.

Pass 010 adds seven small hidden marine animals with stable habitat homes and safe observation routes, quiet local behavior and surface crawling. No gamified discovery layer is introduced. Pass 011 consolidates the technical validation; its request authorizes that review. Final macOS acceptance remains pending.

Pass 011 is the final technical integration review for the tropical v0.2 candidate. It strengthens whole-scene invariants, physically checks discovery/ornament routes and exercises explicit browser failure handling. Historical validation remains intact. Await final user acceptance before closing v0.2 or starting v0.3; target hardware performance and subjective comfort are not established by cloud software rendering.

Pass 012 responds to rejection of the placeholder-like visuals with an opt-in GLB/Blender benchmark and a reusable asset pipeline. It does not turn the whole aquarium into a new art release or supersede pending user acceptance. Pass 013 — Marine Creature Model Overhaul must wait for acceptance of this benchmark, its remaining art limitations and target-device budgets. No v0.3 work or release/tag is authorized by successful technical checks.

Pass 019 applies the fixes from the user's Pass 018 MacBook playtest (seahorse and clownfish scale, a clownfish juvenile, the filter mounted at the top corner, the moray resting in its log, 20% slower swimming, and texture pop-in) and records the agreed v0.3–v0.6 sequence above. No v0.3 office work is included.

v0.2 was accepted at `0.2.0-rc.15`. Pass 020 (`0.3.0-alpha.1`) starts v0.3 with the office: a walkable, procedurally built home office with a live miniature of the aquarium on its stand and its own ambience. Pass 021 adds the seamless dive from office to tank, and Pass 022 polishes and accepts v0.3.

Pass 021 (`0.3.0-alpha.2` to `alpha.6`) added the dive and surfacing. After review and playtests, interruptions became safe and the aquarium kept one clock. The eye height was lowered, swimming now holds one steady speed, and a released glide comes to rest. Pass 022 (`0.3.0-rc.1`) is the v0.3 release candidate:

- **Transitions:** pause-screen switches fade, and surfacing exits through the glass nearest you.
- **Feel:** soft contact shadows in the office, a crossfaded soundscape through every transition, and a one-time hint pointing at the tank.
- **Measurement:** an optional frame-time readout, so performance can be checked on the target MacBook Air.
- **Validation:** a full browser regression run.

v0.3 closes on the user's macOS acceptance of this candidate. v0.4 (Personalization) is not started by it.

**v0.3 accepted at `0.3.0-rc.1`. Order swapped after acceptance:** First Passage is now v0.4 and Personalization v0.5, so exploring fills the catalog.

**v0.4 First Passage passes**

- **Pass 023, The opening:**
  - a hidden crevice in the tank and a dark tunnel to the outer waters;
  - an environment system that loads, renders and cleans up one water world at a time;
  - the local sightings journal;
  - a placeholder open-water area beyond the tunnel.
- **Pass 024, The outer reef:** the larger tropical reef, with sand channels, coral heads, a drop-off, soft boundaries, new reef-fish schools, open-water sound and performance budgets.
- **Pass 025, Big creatures (`0.4.0-alpha.3`):** reef sharks, eagle rays and a sea turtle with calm behaviour, plus "seen" detection, a quiet "New sighting" note and a "Seen" page. New reef-fish species were not added; the reef's fish are still the tank's species.
- **Pass 026, The wall and the blue (`0.4.0-alpha.4`; agreed after Pass 025):** the outer reef reshaped as a wall dive.
  - **The reef top:** compact, dense and breathtaking, with coral and rock, little bare sand and big schools of fish. Its edge is close to the tunnel.
  - **The blue:** distance and depth fade from blue to dark, forward and out past the edge.
  - **Edges:** swimming slows to almost nothing near the edges. You can drift a little way out over the blue and down the wall, then hover.
  - **Big creatures:** they pass by out in the blue, so you want to stop and watch.
  - **The tunnel:** it acts as the loading screen; the reef prepares while you swim through it.
- **Pass 027, The glass office (`0.4.0-alpha.6`; agreed after Pass 026):** the office remodelled as a small glass-walled private office with generic details.
  - **The room:** the glass front and its closed door look out over an open-plan office.
  - **From inside the tank:** the office is seen blurred through the aquarium glass.
- **Pass 028, Polish and acceptance (`0.4.0-rc.1`; playtest round `0.4.0-rc.2`):** the v0.4 release candidate.
  - **Regression:** a full browser regression across every area of the app.
  - **Tests:** unit tests made reliable under machine load.
  - **Acceptance:** a macOS checklist for the whole of v0.4.

v0.4 closes on the user's macOS acceptance of this candidate, after a full play-through. v0.5 (Personalization) is not started by it.

**v0.5 Personalization.** The catalog is built from what you have seen in the outer waters. Big animals are added to the tank as babies or mini versions, so they suit its size.

**Agreed scope change: gentle discovery unlocks.** Seeing creatures and features in the outer waters unlocks them for the tank. It is deliberately pressure-free:

- no counters to complete, currency, timers or scores;
- nothing to lose or miss.

**Outer reef life (`0.4.0-rc.3`, requested after Pass 028):** add smaller shoals along the entrance and reef wall, more cruising animals and larger adults. Reuse existing local assets and species, retain calm behaviour and scale physical clearance with each animal. This candidate still awaits the user’s macOS play-through; v0.5 remains Personalization.

**v0.5 starts alongside v0.4 by user request (Pass 029).** v0.4 remains open at `0.4.0-rc.3`, awaiting the macOS play-through.

- **Pass 029 — The tank catalog (`0.5.0-alpha.1`):** discovered corals and seagrass, quiet tank-only placement, movement/removal, local saving and confirmed reset.
- **Pass 030 — Baby animals (`0.5.0-alpha.2`):** discovered shark, ray and turtle in tank-sized miniature forms; shared models, independent one-of-each saving, calm body-aware routes and the office miniature. Cloud validation is recorded in `VALIDATION_V05_PASS_030.md`; macOS play-through remains pending.
- **Pass 031 — Polish and acceptance (`0.5.0-rc.1`):** the v0.5 release candidate.
  - **Review:** a code review of Passes 029–030. Baby route planning is spread over frames, removing a periodic stutter, and give-way steering is fixed.
  - **Regression:** a full browser regression.
  - **Acceptance:** a macOS checklist for v0.5.

v0.5 closes on the user's macOS acceptance of this candidate; v0.4 (`0.4.0-rc.3`) can be accepted in the same play-through.

**v0.6 Expanding Oceans starts (Pass 032, by user request).** v0.4 (`0.4.0-rc.3`) and v0.5 (`0.5.0-rc.1`) remain open, awaiting the macOS play-through. The first new environment, chosen by the user, is a kelp forest.

- **Pass 032 — The kelp forest (`0.6.0-alpha.1`):** a third water world beyond the outer reef.
  - **The way in:** a second hidden crevice at the cliff's foot leads through a dark tunnel into a giant kelp forest.
  - **The forest:** swaying golden kelp, dark boulders and a sandy lane.
  - **Life:** garibaldi around the rocks and bat rays gliding along the lane.
  - **Passages:** they become links between worlds, and Return to the tank works from either.
  - **Discovery:** new sightings, and the kelp unlocks a kelp stand for the tank. See [the kelp forest](KELP_FOREST.md).
- **Pass 033 — Wall visitors (`0.6.0-alpha.2`, by user request):** bigger creatures along the outer reef's wall.
  - **Who:** a reef manta, a whale shark, schooling scalloped hammerheads, a great hammerhead and a humpback whale, newly authored.
  - **How:** they loop back and forth beyond the lip, and one more kind comes the longer the swimmer waits at the edge.
  - **Surprise:** each visit to the outer reef opens with a different animal.
- **Pass 034 — The sea cave (`0.6.0-alpha.3`, chosen by the user):** a fourth water world beyond the kelp forest.
  - **The way in:** a hidden grotto in the kelp forest's wall leads into a limestone cavern lit by a sunbeam through its roof.
  - **Life:** resting and circling whitetip reef sharks, glassy sweepers and spiny lobsters.
  - **Discovery:** new sightings, and the cave unlocks a limestone arch for the tank.
- **Pass 035 — Detail for the kelp forest and sea cave (`0.6.0-alpha.4`, by user request):** richer kelp, small life on the rocks, sunbeams and drifting particles. Cave formations, sun corals and caustics. Lobsters that hide, and sharks that stir.
- **Pass 036 — Every area is a tank (`0.6.0-alpha.5`, by user request):** a glass back wall and sides for the outer reef, rock-and-kelp walls for the kelp forest, and a tank-sized, roofed sea cave.
- **Pass 037 — Passing close, passing far (`0.6.0-alpha.6`, by user request):** the outer reef's big animals pass either close by the glass (where they count as seen) or far out at the edge of view, chosen pass by pass.
- **Pass 038 — Fish inside the glass (`0.6.0-alpha.7`, by user request):** the outer reef's own fish live inside its tank, bounded by the back and side glass; the big animals stay outside. A follow-up fixed tank placement (`0.6.0-alpha.8`).
- **Pass 039 — A playful sea lion (`0.6.0-alpha.9`, by user request):** a California sea lion in the kelp forest that comes over to circle the swimmer, then darts off.
- **Pass 040 — Release candidate (`0.6.0-rc.1`):** unit tests brought up to date (565 passing), a full 21-harness browser regression (all pass), and one bug fixed (giant kelp sightings near the tunnel exit). v0.6 closes on the user's macOS play-through.
- **Pass 041 — Play-test fixes (`0.6.0-rc.2`, by user request):** the outer reef's corals load in the tunnel (no pop-in); a smaller kelp forest with blacksmith and señorita schools; resting whitetips that bolt when approached and settle elsewhere; lobster dens; fluted stalactite clusters, stalagmites, more boulders, soldierfish and rock crabs in the cave.
- **Pass 042 — Barracuda in the blue (`0.6.0-rc.3`, by user request):** a school of great barracuda now and then drifts in from the deep blue beyond the outer reef's glass and circles there before leaving; the big animals' far passes come a little closer (6.5 m beyond the glass, was 9 m).
- **Pass 043 — Outer reef life (`0.6.0-rc.4`, by user request):**
  - **Fish:** parrotfish grazing coral with sand puffs, blue tang clouds, butterflyfish and Moorish idols in pairs, and a curious humphead wrasse.
  - **Octopus:** creeps between rocks, changes colour, and hides in its den.
  - **Rare sights:** a bigeye trevally ball; very rarely, a sunfish cleaned by bannerfish (they gather first); a great white passing close to the glass.
  - **Depth:** every big animal now passes within sight of the swimmer.
- **Pass 044 — Kelp forest life (`0.6.0-rc.5`, by user request):**
  - **Everyday:** a sea otter floating on its back at the surface (diving for urchins), leopard sharks low over the sand, sheephead at the urchins, Spanish shawl nudibranchs and kelp crabs, and a shy harbour seal that watches from a distance.
  - **Now and then:** a giant sea bass cruising past, and a gull diving in to peck at the sand.
- **Pass 045 — Sea cave life (`0.6.0-rc.6`, by user request):** a moray in a crack in the wall, flashlight fish blinking in the dark corner, a turtle asleep that rises to breathe at the roof's hole, a nurse shark asleep under a ledge, a cleaner shrimp station, the octopus, and lionfish that fan out when approached.
- **Pass 046 — Under the ice (`0.6.0-rc.7`, by user request):** a new area, an Antarctic dive reached through a tunnel in the sea cave's back wall. It is a tank the size of the kelp forest: walled by icebergs, roofed by sea ice with breathing holes and light shafts, over a garden of glass sponges, soft corals, anemones, sea stars and feather stars.
- **Pass 046 review fixes (`0.6.0-rc.8`, from code review):** scenes no longer change after being let go mid-load; explicit world preparation states; worlds built a piece per frame (measured), with rock shapes reused; a long-session browser harness with memory budgets (to run with the full regression).
- **Pass 047 — Antarctic everyday wildlife (`0.6.0-rc.9`, by user request):** emperor penguins diving through the breathing holes, a group of Adélie penguins, a Weddell seal that breathes at its hole and calls, icefish, bald notothens, a krill swarm, sea butterflies, comb jellies, giant sea spiders and ribbon worms.
- **Pass 048 — Antarctic rare encounters (`0.6.0-rc.10`, by user request):** one at a time, never at once on arrival, never the same twice running. A leopard seal comes to look; a minke whale and three killer whales come in and leave through the breathing holes; a toothfish rises from the dark; a colossal squid's eyes glow far off; a polar bear paddles at a hole and dives for a look (by request, though polar bears are Arctic).
- **Provisional, to agree after the user plays Pass 032 (superseded; kept for history):** the sea lion and light shafts were built in Passes 035 and 039, and v0.6 polish and acceptance is now part of the proposed v0.7. The kelp-life-for-the-tank idea is still open (see decision 2).
  - the kelp forest's life for the tank (garibaldi, a bat ray pup);
  - more kelp-forest character (light shafts, a sea lion);
  - then polish and acceptance for v0.6.
- **Pass 049 — Roadmap reconciliation (documentation only):** this canonical roadmap, the milestone status table and [the development audit](DEVELOPMENT_AUDIT.md). Passes 047–048 had been merged into stacked branches rather than `main`; #79 lands them.
