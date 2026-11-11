# The hidden passage (v0.4 Pass 023)

Pass 023 connects the tank to a second water world, the outer waters, through a hidden crevice. The passage is seamless and never takes control away. Only one water world renders at a time.

## Modules

| Module                                  | Role                                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/passage.ts`                     | Shared layout: the crevice channel, its threshold frame, the outer waters' bounds, the tunnel centreline and frame, and the passage tuning (hysteresis, darkness, load/release distances).                                                                                                               |
| `player/passage.ts`                     | Pure passage logic: pose and velocity mapping between the two frames, the swap decision with hysteresis, the darkness profile, the return pose. No rendering, no allocation in per-frame paths.                                                                                                          |
| `environment/passage/Crevice.ts`        | The outcrop in the tank: seven convex boulders fitted around an open channel, five thin seal plates behind a dark liner, and the liner itself, fading to black towards the threshold. It is owned by `Aquarium` and added last, so earlier placements drawn from the shared random stream are unchanged. |
| `environment/outer/OuterEnvironment.ts` | The outer waters (placeholder): a winding tunnel with rings of collision slabs, a cliff face sealed around the tunnel mouth, a sand plain, boulders, motes and light shafts.                                                                                                                             |
| `rendering/WaterWorld.ts`               | The interface both worlds implement: bounds, collision, camera, sightings and render.                                                                                                                                                                                                                    |
| `rendering/OuterWatersScene.ts`         | Renders the outer waters with the tank's renderer; created on demand and disposed on release.                                                                                                                                                                                                            |
| `discovery/journal.ts`                  | The sightings journal: versioned local storage tolerant of failure, and a dwell-based tracker. It is the foundation of v0.5's catalog.                                                                                                                                                                   |

## How the swap stays seamless

- **Matching frames:** the crevice's threshold frame and the tunnel's start frame describe the same place. Their origins sit on the channel axis, with the forward direction pointing deeper in. The tunnel's cross-section, 1.45 m in radius, contains the channel's (2.0 × 1.9 m), so every point reachable near the threshold maps to open tunnel (tested).
- **The crossing:** once the swimmer is 5 cm past the threshold and the outer waters are ready, the position, velocity, thrust and resting depth are mapped across, and the look turns by the frames' heading difference (`SwimControls.turn`). Held keys and momentum carry on. Swimming back 5 cm out of the tunnel's start does the reverse. The 5 cm hysteresis prevents flicker.
- **Darkness:** it peaks (0.94) at the threshold and fades over 3.2 m either side, with the same profile in both worlds. The view is darkest exactly when the world changes.
- **Not ready yet:** if the outer waters aren't ready, the channel simply continues into darkness. Its far end is sealed, so nobody slips out of the rock.

## Lifecycle

- **Loading:** the outer waters are built when the swimmer comes within 15 m of the crevice mouth (11 m in Pass 023; the dressed reef of Pass 024 takes longer to prepare). Shader warm-up is asynchronous.
- **Keeping:** they stay while the swimmer is in them, during a transition, or within 22 m of the mouth.
- **Releasing:** after 4 s out of range they are disposed: geometry, materials and lights. GPU memory returns to its earlier counts (browser harness).
- **Rendering:** only the current water world is rendered and simulated. The tank pauses while you are outside it; the office miniature still shows it.
- **Return to the tank:** this pause-screen option appears while in the outer waters. It puts you 1.4 m outside the mouth, facing out, and fades in from darkness.

## Limits (Pass 023)

- **Placeholder:** the outer waters are a placeholder with sand, boulders and a cliff, but no life yet. Pass 024 builds the reef and Pass 025 the big creatures.
- **Sound:** the underwater soundscape continues unchanged in the outer waters; open-water sound comes in Pass 024.
- **Edges:** the outer waters have hard box edges for now; soft boundaries come in Pass 024.
- **Sightings:** the journal records nothing yet, because there are no candidates until creatures arrive.
