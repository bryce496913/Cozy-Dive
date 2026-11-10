# Cozy Diver — provisional roadmap

These milestones describe direction, not commitments or a fixed release schedule. Each pass should remain small, playable, and easy to review. Revisit priorities after testing swimming feel and browser performance.

| Milestone                           | Focus                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **v0.1 — First Dive**               | Project foundation, procedural aquarium, calm first-person swimming, boundaries, settings, tests, and desktop prototype. |
| **v0.2 — Living Aquarium**          | Tropical marine reef life and lightweight fish behavior; improve scenery and measure performance.                        |
| **v0.3 — Office & Dive Transition** | Office environment and a seamless entry into the aquarium.                                                               |
| **v0.4 — Personalization**          | Adding fish, decorations and plants, with persistent saves.                                                              |
| **v0.5 — Beyond the Glass**         | The first passage into a larger tropical reef.                                                                           |
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
