# Cozy Diver — Pass 107: Discovery & Collection Acceptance

**Candidate for the user's MacBook Air playthrough. Not marked accepted, released or deployed. Version unchanged.**

Base: main `6bcf574`, merged Pass 106 (PR #160). The final Pass 106 evidence/arrival-label follow-up missed that merge; it is carried here as `3d3e94b`. Its only runtime change is truthful failed-arrival labels, not a new UI feature. Pass 107 adds acceptance inventory, validation coverage and documentation; no species, environment or model assets are added.

## Audit

- **22 approved rare identities**, drawn from the six wild owners and joined to their existing sightings, primary album slots and aquarium definitions. The inventory test verifies unique IDs, correct source nodes, eligibility and the six libraries' current checksums.
- **115 primary album slots:** Aquarium 12; Outer Reef 30; Kelp Forest 17; Shipwreck 5; Sea Cave 18; Antarctic 33. Secondary habitat sightings do not create duplicate primary cards.
- Spanish shawl, sea angel and giant isopod retain their existing IDs. The approved weedy-seadragon Australian temperate exception and the cave's intentional geographic mixture remain documented; none is substituted.
- Canonical wild/card/tank geometry and markings remain shared. Existing fish/visitor models, tints and save keys are unchanged; the six habitat suites and collection integration cover the source mapping. The approved generic stargazer and decorator crab are not assigned invented species names.
- Pass 096's doubled large-miniature roster remains intact, with collision/clearance and eagle-ray rest/takeoff regression coverage. The small skeleton shrimp retains Pass 106's larger collision height without a model-size reduction.
- Existing journal/tank formats are unchanged. Targeted coverage includes older journals and tank versions, fish counts, kept/unknown entries, additions/returns, corruption and unavailable storage. Already recorded discoveries remain independent of capacity or placement failure.

The full [collection matrix and manual discovery hints](PASS_107_COLLECTION_MATRIX.md) are acceptance spoilers only. They are not imported into or displayed by gameplay. Machine-readable inventory is under [acceptance/pass107](acceptance/pass107/collection-inventory.json).

## Validation scope

Targeted unit/integration suites, one combined local aquarium/album walkthrough, and the existing Pass 097 cave-only shark probe. Shark simulation is stepped without drawing thousands of frames; only localized checkpoints are rendered. No exhaustive traversal, full-game playthrough or multi-hour suite is run.

The focused unit run passed **22 suites / 161 tests in 141.72 seconds**. The inventory export was rerun independently after a documentation wording correction (1 suite / 1 test passed). Browser checks use Linux Chromium with forced SwiftShader. **These are not MacBook Air, Apple GPU, Safari or real-GPU results.**

**Production build, typecheck and lint passed.** The build retained its existing >500 kB chunk warning (main chunk 1,636.36 kB, gzip 497.67 kB). [Raw command logs](acceptance/pass107/targeted-tests.txt) and adjacent build/typecheck/lint logs are included. The user-requested targeted suite replaces a full-game test run for this pass.

The targeted run covers collection registration/counts, canonical asset mapping, old journals/tanks and corrupt/unavailable storage, album pagination and preview lifecycle, loading failure/late-result cleanup, placement clearance/capacity, miniature scale, six rare habitats and shark deformation. It does not prove every wild encounter or visual identity on the actual device; those remain player checks.

## Reproducible commands

Run from the repository root. Browser runs require a local Vite server (`npm run dev -- --port 5177`), Chromium, and Playwright. The smoke harness exposes application owners for inspection and seeds only its isolated browser profile; it does not alter the player's save. One real leaf-sheep observation unlocks through the ordinary sighting tracker. Other discoveries are seeded to keep this acceptance check local.

```bash
npm run format
npm run build
npm run typecheck
npm run lint
COZY_ACCEPTANCE_OUTPUT=/tmp/cozy-pass107-inventory npm run test -- tests/collection-acceptance.test.ts tests/collection-integration.test.ts tests/album-previews-lifecycle.test.ts tests/tank-save-safety.test.ts tests/tank-fish.test.ts tests/tank-collection.test.ts tests/collection-registry.test.ts tests/collection-audit.test.ts tests/album-pages.test.ts tests/tank-babies.test.ts tests/tank-babies-lifecycle.test.ts tests/shared-models-scale.test.ts tests/asset-lifecycle.test.ts tests/journal.test.ts tests/save-compatibility.test.ts tests/shark-tail.test.ts tests/rare-minis.test.ts tests/reef-minis.test.ts tests/kelp-minis.test.ts tests/wreck-minis.test.ts tests/cave-minis.test.ts tests/ice-minis.test.ts --maxWorkers=1 --testTimeout=30000 --hookTimeout=30000
COZY_ACCEPTANCE_OUTPUT=/tmp/cozy-pass107-inventory npm run test -- tests/collection-acceptance.test.ts --maxWorkers=1
COZY_ACCEPTANCE=1 COZY_URL=http://127.0.0.1:5177 COZY_PLAYWRIGHT=/tmp/cozy-browser/node_modules/playwright/index.mjs COZY_CHROMIUM=/usr/bin/chromium COZY_OUTPUT=/tmp/cozy-pass107-album node validation/v08/collection-integration.mjs
COZY_URL=http://127.0.0.1:5177 COZY_PLAYWRIGHT=/tmp/cozy-browser/node_modules/playwright/index.mjs COZY_CHROMIUM=/usr/bin/chromium COZY_OUTPUT=/tmp/cozy-pass107-sharks node validation/v08/shark-acceptance.mjs
```

The existing Pass 097 cave probe passed **four departures and resettles per native shark model**. Both reached tail effort 2.274; actual tail-tip geometry moved 0.329 m (whitetip) and 0.527 m (nurse) in the local probe. Pause held the pose; reduced motion retained propulsion without counter-sway. Final pitch/bank/sway returned to zero after each resettle. Full probe disposal left **zero leases, geometries and textures**, with no browser errors. These sparse software renders validate animation state and deformation; they do not establish natural-looking motion on the user's display.

## Performance interpretation

The six rare model libraries total **2,636,264 bytes (2.51 MiB)**. The aquarium already needs `rare-minis.glb` (620,980 bytes) for its wild residents; the other five total **2,015,284 bytes (1.92 MiB)** and load on demand for their habitat/card/placed resident. Pass 107 adds **zero runtime model bytes** and no model download requirement. Actual requested libraries and post-reload resource timing are retained in the browser report; cache behavior is distinct from a cold payload budget.

| Library                  | Encoded GLB bytes |
| ------------------------ | ----------------: |
| Aquarium rare miniatures |           620,980 |
| Outer reef miniatures    |           299,404 |
| Kelp miniatures          |           429,256 |
| Wreck miniatures         |           291,600 |
| Cave miniatures          |           721,620 |
| Antarctic miniatures     |           273,404 |

The album owns one preview renderer while open and zero after close; it is not one context per card. It loads only the current spread/detail, with two concurrent loads, and draws at most four visible spinning cards per frame (one detail view). The paused main scene is not continuously redrawn behind the book. GPU object counts and lease behavior are measured by the smoke checks. Three.js memory figures are **counts, not VRAM/RAM bytes**; download/resource timing and draw-call/triangle counts are not hardware frame-rate measurements.

## Album and aquarium results

The combined local walkthrough passed with **no browser errors**: actual observation/unlock, all six habitat sections, page keys, anonymous mysteries, preview pixels, idle animation, manual rotation, reduced motion, detail Escape/focus, editor link, reopening selected card, ordinary fish return/add, large visitor add/return, rare add/return, failed-arrival retry and exact saved journal/tank equality after reload. The stone decoration and two royal grammas survived; all five saved visitors arrived after reload. The humpback's display scale, radius and half-height were exactly **2×** the pre-096 definition; its inspected model length was **1.10 m**.

[Browser report](screenshots/pass107/album/report.json) and [final aquarium inspection](screenshots/pass107/album/inspection.json) retain raw results. Two complete rounds of habitat-tab browsing used one preview renderer. Loaded models peaked at 12, as expected for one spread; texture counts stayed 49–50 and geometry counts 64–66, including lazy creation. Closing the album removed its owner and returned creature leases to the live-world baseline **49**. Full application disposal returned creature/reef leases, geometries and textures to **zero**.

Representative last-preview-render samples were **1–14 draw calls / 3,304–85,772 triangles**. These counters describe the latest individual card draw; some snapshots precede the new spread's first render, so they are not per-habitat totals, whole-book frame totals or synchronized benchmarks. The controlled final aquarium view with five visitors and two catalog fish used **94 calls / 897,845 triangles**, plus 210 points and 12 lines. This is one close-up camera, not worst-case populated-tank cost. No hardware GPU time, VRAM bytes, sustained frame rate or meaningful Mac frame-spike measurement was obtained.

Cold app readiness in this run was **193,188 ms** under SwiftShader and concurrent local tooling. Cave-only readiness was **29,708 ms**. These wall times include loading/preparation/software rendering and are not pure network or hardware baselines. Only the aquarium rare library was requested at startup; other rare libraries were requested on demand during browsing/placement. The resource-timing array is from the **post-reload navigation only** (one uncached reef-props entry, 1,264,560 encoded bytes; 1,264,860 transfer bytes). It is not a complete cold-download ledger and does not measure the entire first browse. Use the manifest payload budget above for all six rare libraries.

## Localized rendering evidence

- [Observed leaf sheep](screenshots/pass107/album/01-observed-leaf-sheep.png), unlocked through the ordinary dwell/sighting path.
- [Animated canonical detail card](screenshots/pass107/album/02-leaf-sheep-card.png) and [reduced-motion detail](screenshots/pass107/album/06-reduced-motion.png).
- [Antarctic album page](screenshots/pass107/album/03-album-antarctic.png), including discovered and mystery cards.
- [Reloaded leaf sheep in the aquarium](screenshots/pass107/album/05-placed-leaf-sheep.png), using the same canonical geometry as its wild/card appearance.
- [Large-miniature card after placement](screenshots/pass107/album/07-large-miniature.png); native tank dimensions were inspected separately from presentation scale.
- Cave-only native [whitetip](screenshots/pass107/sharks/whitetip-departure.png) and [nurse](screenshots/pass107/sharks/nurse-departure.png) departure checkpoints; [four-cycle measurements](screenshots/pass107/sharks/report.json).

Screenshots are controlled local inspections of the existing models and scenery, not whole-environment traversal evidence or device-performance proof.

## Remaining concerns and device limits

- The MacBook Air playthrough, Apple GPU behavior, Retina performance, thermal/power effects and other desktop browsers remain unperformed. Use the [player checklist](PASS_107_MACBOOK_AIR_CHECKLIST.md) to make the acceptance decision.
- Full detail caps world rendering at DPR 1.75, Lighter at DPR 1. These settings do not replace models. The test viewport uses DPR 1, so it does not reproduce an Air's Retina workload.
- Album canvases use bounded resolutions (200×140 cards, 520×360 detail). They may look softer on Retina; verify readability and comfort on the actual Air. Underlying canonical assets remain unchanged.
- Ground residents retain conservative substrate clearance and local movement; they do not climb arbitrary vertical scenery or receive new physical dens. Exact roaming positions are not part of the existing save format.
- The shark fix amplifies the shared sideways bend and adds counter-sway. It is not a newly authored traveling wave. Native repeated departures/resettling and manual visual comfort are both relevant.
- Missing assets or blocked placement retain the discovery and saved intent; retry/return remains available. Unavailable local storage can preserve new changes only for the current visit.
- Touch-only mobile play is not supported by the existing mouse/trackpad and pointer-lock design. No mobile device/browser testing is claimed.
- The existing production bundle-size warning remains a limitation, not a new regression introduced by this pass.

## Harness corrections

An initial album run tried to add a third royal gramma despite its existing two-fish species cap. The disabled button was correct; the check now returns one and restores the count. An initial cave-probe run logged a missing test-page favicon; the probe now embeds an empty favicon and still treats other HTTP failures as errors. A browser attempt before the local server was running failed to connect and was rerun after server startup. These were harness/setup corrections, not gameplay defects.

## Acceptance decision

Automated results establish scoped readiness, not final visual/comfort approval. The user must complete the MacBook Air checklist and explicitly approve acceptance. No release, deployment, version bump or milestone-acceptance action is authorized by this report.
