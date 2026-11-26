# Current collection and aquarium integration

Current after Pass 108; historical `V08_*` pass reports remain snapshots of their respective passes. The [Pass 107 acceptance report](PASS_107_ACCEPTANCE_REPORT.md) and [22-species inventory](PASS_107_COLLECTION_MATRIX.md) document the collection candidate. Final acceptance and real MacBook Air testing are still pending; no release or version bump is implied.

## Registry and discovery

There is one creature collection: `src/collection/registry.ts`, rendered by `src/ui/album/Album.ts`. Field album and For your tank → Open the field album open the same owner. The separate catalog edits plants/corals, rocks and decorations; it has no second creature list or creature-action callbacks.

| Primary habitat | Album slots | Approved rare identities |
| --------------- | ----------: | -----------------------: |
| Aquarium        |          12 |                        3 |
| Outer Reef      |          30 |                        4 |
| Kelp Forest     |          17 |                        4 |
| Shipwreck       |           5 |                        4 |
| Sea Cave        |          18 |                        4 |
| Antarctic       |          33 |                        3 |
| Total           |         115 |                       22 |

Slots include the registered coral identities and the existing Weddell pup slot; they are not a count of distinct biological binomials. Secondary habitat sightings do not add primary slots. Spanish shawl, sea angel and giant isopod reuse their older IDs. Unknown journal IDs and supported older tank formats remain supported. Returning a resident, reaching capacity or failing arrival never removes its sighting. Unavailable storage cannot persist new progress beyond the visit.

## Canonical sources and intentional sharing

The registry describes model identity; wild owners continue to acquire their own assets/factories. There is no universal runtime model resolver and no registry migration in this cleanup. Fish cards use their fish asset/tint; visitor and rare cards use `acquireCollectionArt`, as does the tank; procedural art uses shared geometry factories. Corals resolve existing reef-library nodes. `AssetLoader` leases cloned hierarchy/skeleton state over reference-counted source resources; the six rare libraries stay lazy and use the same source nodes in wild/card/tank contexts.

**Cross-context consistency does not imply species-specific anatomy.** All 22 authored rare discoveries have their registered species-specific source nodes. Existing species still intentionally share the following base forms; these substitutions are documented, not rebuilt or relabeled:

| Shared source                     | Species/identities represented                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chromis` rig                     | Blue-green chromis plus garibaldi, kelp bass, blacksmith, señorita, glassy sweeper, soldierfish, flashlight fish and Antarctic silverfish; existing species tints/scales remain |
| `firefish` rig                    | Firefish goby and cleaner wrasse (blue tint)                                                                                                                                    |
| `eagleRay`                        | Spotted eagle ray and bat ray (dark tint)                                                                                                                                       |
| `hammerhead`                      | Great and scalloped hammerhead                                                                                                                                                  |
| `nurseShark`                      | Nurse shark and swell shark (smaller/tinted wild presentation)                                                                                                                  |
| `harbourSeal`                     | Harbour seal and Weddell seal pup (grey tint and life-stage scale)                                                                                                              |
| `giantSeaBass`                    | Giant sea bass and Queensland grouper                                                                                                                                           |
| `crabBody()`                      | Kelp crab and rock crab                                                                                                                                                         |
| `krillShape()`                    | Antarctic krill and smaller mysid                                                                                                                                               |
| Shared anemone/sea-star factories | Antarctic identities and existing kelp dressing                                                                                                                                 |

The five coral cards and decoration placements resolve original reef-library representatives; the default composed reef uses benchmark/habitat colonies. These are category representatives, not identical per-colony meshes across contexts. No coral model replacement is made here.

The moray collection assembly retains its existing extended-body/head positioning; source library parts are shared, but assembly/pose differs from the wild den rig. Procedural previews likewise compose a resting representation of the shared parts rather than running the full wild AI. These are existing presentation adaptations, not new species models. Historical generic Spanish shawl/sea angel/isopod geometry paths are retained; registered current animals use their authored assets. They were not removed as speculative dead code.

## Sizing, behavior and ownership

Pass 096's 28 large miniature definitions retain exactly 2× their prior display size, radius and half-height. The tank never shrinks them to resolve conflicts. Rare animals keep their authored small display sizes; card fitting is presentation only. Bottom/shelter animals use conservative local substrate movement and resting, pipefish/seadragons hover near vegetation, and sea angels drift in water. Exact roaming positions are not saved. Existing conservative collision envelopes and navigation bounds remain; this does not certify arbitrary overlapping decorations or every animated pose on every slope.

One preview renderer exists while the book is open; zero after close. Only current-spread/detail models are retained, two loads run concurrently, and at most four visible spinning cards render per frame. Late results are disposed after page changes or closure rather than attached to stale cards. In-flight shared downloads are not forcibly aborted, since other owners may need them. Closing releases lights, renderer/context, observers and leases. Card/detail resolutions remain 200×140 and 520×360 at DPR 1. The paused world background stays static.

The original reef (including fallback after composed assets fail) now swaps each available authored coral's hulls with its visuals, as it already did for rocks. Disabling/disposal restores the procedural shapes. Missing optional authored collider data retains the prior procedural fallback. The approved meshes, composed reef, fog and save data are unchanged.

## Status and follow-up

See [Pass 108 results and remaining issues](PASS_108_INTEGRATION_CLEANUP.md) and the [MacBook Air checklist](PASS_107_MACBOOK_AIR_CHECKLIST.md). Linux Chromium SwiftShader evidence is not Apple GPU, Safari, Retina, thermal or sustained frame-rate validation. Species-specific replacement art, increased preview resolution and broad code splitting require separate evidence/scope; none is part of this stabilization pass.
