# Cozy Diver — provisional roadmap

These milestones describe direction, not commitments or a fixed release schedule. Each pass should remain small, playable, and easy to review. Revisit priorities after testing swimming feel and browser performance.

| Milestone                           | Focus                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **v0.1 — First Dive**               | Project foundation, procedural aquarium, calm first-person swimming, boundaries, settings, tests, and desktop prototype. |
| **v0.2 — Living Aquarium**          | Tropical marine reef life and lightweight fish behavior; improve scenery and measure performance.                        |
| **v0.3 — Office & Dive Transition** | Office environment and a seamless entry into the aquarium.                                                               |
| **v0.4 — First Passage**            | Swim through a hidden opening in the tank into a larger tropical reef, with new environments, creatures and big animals. |
| **v0.5 — Personalization**          | Add fish, decorations and plants you have seen in the outer waters, with persistent saves.                               |
| **v0.6 — Expanding Oceans**         | New environments, species and discoveries.                                                                               |

**Vision (agreed after the Pass 018 playtest).** An office fish-tank escape is the entry point: a memorable start, a strong visual identity and a natural home. It is also a metaphor for escaping the everyday into something peaceful. A tiny aquarium in the real world becomes an enormous underwater playground, with hidden passages into expansive oceans; the aquarium is a portal into an ocean world. Later milestones (polish, accessibility, broader device testing and a public beta) follow once these are in place.

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
- **Pass 027, Polish and acceptance:** the v0.4 release candidate.

**v0.5 Personalization.** The catalog is built from what you have seen in the outer waters. Big animals are added to the tank as babies or mini versions, so they suit its size.

**Agreed scope change: gentle discovery unlocks.** Seeing creatures and features in the outer waters unlocks them for the tank. It is deliberately pressure-free:

- no counters to complete, currency, timers or scores;
- nothing to lose or miss.
