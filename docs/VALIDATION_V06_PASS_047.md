# v0.6 Pass 047 — Antarctic everyday wildlife (`0.6.0-rc.9`)

Date: November 17, 2026. By user request. It builds on the Pass 046 review fixes (stacked: its PR is based on that branch). No merge or release is authorized by this note.

## Species (all Antarctic, from the agreed plan)

| Species | Model | Where and how |
| --- | --- | --- |
| Emperor penguin (2) | New: authored 1.15 m, flippers' stroke in morphs | Every 35–80 s one drops in through a breathing hole and streaks down in a swoop over the seabed, trailing bubbles. It then shoots back up and out. It veers round a close swimmer. |
| Adélie penguin (4) | New: authored 0.7 m | A group zipping round a figure-of-eight course 1.6–3.2 m under the ice, followers close behind the leader. They swerve from a swimmer in their path. |
| Weddell seal | The harbour seal's model, 1.75× and darker | Hangs about 3 m under the ice by the first breathing hole, drifting round it. Every 60–110 s it rises head-first into the hole to breathe for 9 s, then sinks back. It calls every 18–40 s with a synthesised descending trill, heard where it is, and eases away from a swimmer closer than 3 m. |
| Blackfin icefish (6) | New: the chromis rig with a long, flat snout; pale, near-translucent | Rest propped on the seabed by the stones. Every 20–45 s one hops 2–4 m to a new spot; a swimmer within 2 m makes it hop away. |
| Bald notothen (14) | New: chromis rig, small and mottled | In loose clusters 0.7–1.3 m under the ice, hovering and darting. They press up against the ice and edge away when a swimmer comes within 2.2 m. |
| Antarctic krill (520) | Built in code | A dense pink cloud turning slowly in the light below a breathing hole. It parts round a swimmer who swims into it. |
| Sea butterfly (40) | Built in code | Tiny shells rowing with two lobes, drifting round the holes. |
| Comb jelly (14) | Built in code | Clear ovals drifting and turning, their comb rows running with rainbow colours. |
| Giant sea spider (6) | Built in code | Walk slowly over the seabed on eight long, jointed legs in a stepping wave, turning away from stones and walls. |
| Ribbon worm (2) | Built in code | Long, bright orange worms gliding over the gravel in slow waves, turning away from stones and walls. |

**Every species is a sighting.** Moving animals use a tolerance: penguins 1.2–1.5 m, the seal 2.5 m, the krill swarm 3 m.

## Containment and collisions

- **Limits:** every swimming animal stays inside the tank (`IceLimits`): above the seabed and its stones, below the ice, and 2.5 m short of the icebergs and the rock wall.
- **Exceptions:** the emperors pass up through the holes' chimneys, and the seal puts its head up into its hole.
- **Seabed walkers:** sea spiders and worms walk round the stones.
- **The swimmer:** penguins, the seal, icefish, notothens and krill each give the swimmer room.

## Modules

- **Models:**
  - `tools/art/pass047/penguins.py`: emperor and Adélie, with Pass 025/033 helpers;
  - `tools/art/pass047/antarctic_fish.py`: icefish (with a new snout option) and notothen, using Pass 043's reshape.
- **Logic (pure):** `src/creatures/iceLife.ts`.
- **Small life, built in code:** `src/environment/ice/IceCritters.ts`.
- **Runtime:** `src/environment/ice/IceLife.ts`. It reuses `SoloCreature` (now with an optional tint) and `PosedFish`.
- **Under the ice:** `UnderIceScene` sets up its life a frame after building, tracks it as the `wildlife` part, and updates it once warmed up.
- **Seal calls:** `AudioGraph.trill` and `AudioSystem.call`. The application plays the call when the seal calls while the swimmer is under the ice.
- **Sights:** ten new ones in `ICE_SIGHTS`.

## Costs

- **Models:** four new, about 1.9 MB compressed. All models together are now 30.0 MB, within the 30 MiB (31.5 MB) budget, and these load only under the ice.
- **Draws:** about 16 new:
  - 7 penguin and seal bodies;
  - icefish and notothen parts;
  - one each for krill, butterflies, jellies, spider bodies and legs, two worms, and bubbles.
- **Per-frame CPU:** about 520 krill matrices, 96 leg segments and two worm tubes (528 vertices). Nothing is allocated per frame.
- **Not measured:** real-GPU frame time is **unverified** until measured on hardware.

## Reduced motion and pause

- **Pause:** everything updates on simulation time only, so it holds still while paused.
- **Reduced motion:** the small life moves at half speed, and the bubble trails are off. The animals' behaviour is otherwise unchanged.

## Checks

- typecheck, lint and build pass; `npm run test`: 645 passing.
- **New tests** (`tests/ice-life.test.ts`):
  - an emperor's dive (down, swoop, up, away) stays inside the tank while under the ice, and trails bubbles;
  - the Adélies stay under the ice and in the tank, and keep moving;
  - the seal breathes inside its hole, calls, and eases from a swimmer;
  - icefish rest still, stay on the seabed, and hop from a close swimmer;
  - notothens stay in the hollows;
  - the krill cloud is compact, and parts round a swimmer inside it;
  - every new sight is named once.
- **Disposal mid-load:** `IceLife` is in the lifecycle suite (disposed while its models are still loading).
- **Not run here:** browser runs, by request (no long checks). `validation/ice-life.mjs` photographs each animal, with the emperor's dive and the seal's breath on cue. It joins tonight's full regression.

## Visual inspection checklist (for the screenshots and a play-through)

- [ ] Emperor: long and slender, blue-black back, white belly, orange-yellow ear patch; flippers beat and the bubble trail rises.
- [ ] Adélie: compact and round-headed, with a white eye ring; the group stays together, close under the ice.
- [ ] Weddell seal: large and dark grey; it rises head-up into the hole, and its trill is heard (sound on) from where it is.
- [ ] Icefish: pale, with a long flat snout; it rests on the gravel and doesn't sink into it.
- [ ] Notothens: small and mottled; they tuck up under the ice.
- [ ] Krill: a pink cloud in a light shaft that parts as you swim in.
- [ ] Sea spiders: legs reach the seabed and step; no leg floats or sinks.
- [ ] Ribbon worm: bright orange and undulating, on the gravel, not through stones.
- [ ] Comb jellies show rainbow rows; sea butterflies flap.
- [ ] Nothing passes through the ice, icebergs, seabed or stones; nothing crowds the tunnel's mouth.

## Manual playtest

1. Swim tank → outer reef → kelp forest → sea cave, then through the back tunnel under the ice.
2. Wait near the first breathing hole, just left of the tunnel's way in, ahead and up: the seal is there, and calls within a minute. Watch for an emperor dropping in (within about a minute or two).
3. Swim into the krill below the same hole.
4. Look on the seabed by the dark stones for icefish, sea spiders and the ribbon worms. Look under the ice for notothens.

## Known limitations

- The Weddell seal reuses the harbour seal's shape (both are true seals), larger and darker, rather than a model of its own.
- The sea spiders' and worms' feet follow the seabed's height map. They avoid the stones rather than climbing them.
- The seal's call is synthesised, not a recording.
