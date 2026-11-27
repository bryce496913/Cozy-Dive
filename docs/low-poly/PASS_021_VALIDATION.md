# Pass 021 — rare and secret creature rebuild

Base: Pass 020 (`08771f8`). The machine-readable semantic inventory is
`src/creatures/lowPoly/rareCatalog.ts`.

## Result

Pass 021 accounts for 31 rare or hidden identities without adding a species or changing a stable
sighting id. It rebuilds the original seahorse and frogfish through the shared authored low-poly
geometry in `src/fish/lowPoly/anchored.ts`, and deliberately retains 29 canonical models already
migrated by Passes 017–020 or by the approved rare-discovery passes. No encounter copy was created.

The seahorse has a continuous tapered horse-like head, curved neck and prehensile coil rather than
ring primitives. Its upright controller alternates anchored and gentle hovering phases while the
dorsal and paired pectoral fins flutter independently. The frogfish has an irregular faceted body,
broad head, hinged jaw, lure and paired planted pectoral supports. It remains still for long periods,
breathes, occasionally yawns, and only walks during the final eight seconds of its 112-second perch
cycle. The existing moray remains the one canonical aquarium/cave animal.

## Canonical libraries

| Habitat     |                                                                                            Identities | Canonical owner                |
| ----------- | ----------------------------------------------------------------------------------------------------: | ------------------------------ |
| Aquarium    |                                 Seahorse, frogfish, moray, Pikachu nudibranch, leaf sheep, candy crab | `anchored`, `rareMinis`        |
| Outer reef  |                                Harlequin shrimp, ornate ghost pipefish, hairy frogfish, mimic octopus | `reefMinis`                    |
| Kelp forest |                        Spanish shawl, weedy seadragon, sarcastic fringehead, East Pacific red octopus | `kelpMinis`                    |
| Shipwreck   |                                 Skeleton shrimp, juvenile wolf eel, decorator crab, painted greenling | `wreckMinis`                   |
| Sea cave    |                                       Stargazer, psychedelic frogfish, banded coral shrimp, wonderpus | `caveMinis`                    |
| Antarctic   | Sea angel, Tritoniella, Glyptonotus, leopard seal, minke, orca, toothfish, colossal squid, polar bear | `iceMinis` and Pass 019 owners |

The six miniature GLB libraries are the same source used by their wild encounter, album card and
aquarium placement. Large Antarctic visitors retain the canonical Pass 019 models. This is
intentional reuse, not an unreviewed substitution.

## Discovery and habitat integrity

- The 31 ids are checked against the album and every non-home id against `SIGHTS`.
- Existing spawn probability, location, observation radius, journal persistence, den/perch and
  contact rules are unchanged.
- No markers, glow, objective text, collection prompts or forced encounter logic were added.
- Aquarium placement continues to use each album entry's exact model source and stable save key.
- Hidden animals remain inspectable in development without mutating a save: run
  `validation/v08/rare-creatures.mjs` for all 22 miniature libraries and
  `validation/v07/small.mjs` with `COZY_ONLY=Seahorse,Frogfish,Moray` for the anchored trio.

## Validation

`tests/pass021-rare-creatures.test.ts` verifies inventory completeness, unique stable ids, album
sections, sighting coverage, aquarium source identity, continuous seahorse geometry, articulated
fins, frogfish breathing/yawn motion and its rare planted step cycle. Existing habitat suites cover
load failure, attachment, animation, discovery, aquarium reuse and resource release for each rare
miniature library.

Results on 2026-11-27:

- Focused rare/model suites: 8 files, 146 tests passed.
- `npm test`: 131 files, 1,395 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: ESLint and Prettier passed.
- `npm run build`: passed; Vite retained the existing large-chunk advisory for the 1,657.56 kB
  main bundle (504.86 kB gzip).
- Localized Chromium gallery: all 22 rare miniature identities rendered, zero page errors. This was
  a SwiftShader inspection and is not claimed as real-GPU evidence.
