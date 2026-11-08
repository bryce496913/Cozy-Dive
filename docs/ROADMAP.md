# Cozy Diver — provisional roadmap

These milestones describe direction, not commitments or a fixed release schedule. Each pass should remain small, playable, and easy to review. Revisit priorities after testing swimming feel and browser performance.

| Milestone                        | Proposed focus                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **v0.1 — First Dive**            | Project foundation, procedural aquarium, calm first-person swimming, boundaries, settings, tests, and desktop prototype. |
| **v0.2 — Living Aquarium**       | Tropical marine reef life and lightweight fish behavior; improve scenery and measure performance.                        |
| **v0.3 — Cozy Interactions**     | A few gentle, optional interactions without pressure or progression demands.                                             |
| **v0.4 — Make It Yours**         | Aquarium customization and a considered local persistence model.                                                         |
| **v0.5 — Beyond the Glass**      | Office-to-tank framing and hidden connections to larger environments, introduced gradually.                              |
| **v0.6 — Ocean Life**            | Broader ocean spaces, varied habitats, and richer marine behavior within browser budgets.                                |
| **v0.7 — Polish and Relaxation** | Accessibility, performance, audio, visual refinement, and swimming-feel iteration.                                       |
| **v0.8 — Public Beta**           | Broader device/browser testing, onboarding polish, feedback, and stability.                                              |

The first pass intentionally excludes office scenes, fish AI, customization, hidden passages, large oceans, multiplayer, authentication, inventory, quests, complex physics, backend services, and mobile touch controls. Do not interpret roadmap entries as authorization to build them now.

Pass 011 prepares `0.2.0-rc.6` for manual MacBook Air acceptance; it does not declare v0.2 complete. Potential v0.3 follow-ups include hardware-driven transparency/performance work, longer real-time browser soak coverage, and small optional interactions after their scope is agreed. No such feature is included in this candidate.

Pass 007 intentionally replaces the freshwater biological identity with a 38-fish tropical reef. Pass 009 adds the first host-associated pair and sheltered moray.

Pass 008 adds six procedural home-aquarium ornaments, bounded chest/filter effects and named safe creature anchors. Those six props remain in Pass 009; swimming and the audio mix stay in place.

Pass 009 adds one animated anemone, two local ocellaris clownfish (40 ordinary fish total), one sheltered moray, and scene-free creature-home metadata. Those animals remain in Pass 010, with no aggression or feeding mechanics.

Pass 010 adds seven small hidden marine animals with stable habitat homes and safe observation routes, quiet local behavior and surface crawling. No gamified discovery layer is introduced. Pass 011 consolidates the technical validation; its request authorizes that review. Final macOS acceptance remains pending.

Pass 011 is the final technical integration review for the tropical v0.2 candidate. It strengthens whole-scene invariants, physically checks discovery/ornament routes and exercises explicit browser failure handling. Historical validation remains intact. Await final user acceptance before closing v0.2 or starting v0.3; target hardware performance and subjective comfort are not established by cloud software rendering.

Pass 012 responds to rejection of the placeholder-like visuals with an opt-in GLB/Blender benchmark and a reusable asset pipeline. It does not turn the whole aquarium into a new art release or supersede pending user acceptance. Pass 013 — Marine Creature Model Overhaul must wait for acceptance of this benchmark, its remaining art limitations and target-device budgets. No v0.3 work or release/tag is authorized by successful technical checks.
