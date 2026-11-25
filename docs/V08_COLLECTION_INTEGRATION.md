# V0.8 Pass 106 — Collection and Aquarium Integration

Base: latest main after Pass 105, `87afc39` (PR #159).

The collection remains one field album. A wild sighting unlocks its existing habitat card; that card uses the same source art to preview and place the animal in the home aquarium. This pass fixes interface continuity, preview lifecycle and small-animal placement/controller gaps. It introduces no replacement models, new species, save format, decoration-layout migration, or changes to the large visitors' Pass 096 scale.

## Confirmed gaps and changes

- Closing the album forgot the selected card. It now retains the selected card and spread for this visit, while each opening receives the current aquarium context. Returning to the page or explicitly choosing another habitat still navigates normally. Opening an already open album does not create another animation loop.
- Closing an album opened from the hidden decoration editor tried to focus its hidden link. The editor supplies its visible “For your tank” button as the return target.
- The main aquarium/office renderer continued redrawing a paused background behind the modal album. The application now keeps that background static while the album renders its own visible models; ordinary world rendering resumes on close.
- A repeated preview `show` while a slot was loading could enqueue that same slot again. In-flight slots are now tracked, concurrency stays at two, stale/late models release their leases, and close disconnects the visibility observer and disposes lights/renderer/context. An intersection observer limits animation to card canvases actually visible within the browser's clipping/scroll viewport.
- Rare bottom animals inherited full 3D visitor routing and an elevated spawn. The 22 authored small discoveries now use local substrate, shelter, vegetation-hover or pelagic modes. Ground residents seat on the actual collision floor; their existing model's neutral foot/legs are aligned within the lower edge of the unchanged collision envelope. Geometry, material, markings and display scale are retained. They take conservative short steps, stop at blocked terrain and stay near their selected microhabitat. Octopuses pause locally between explorations, skeleton shrimp cling in place, and bottom-associated stationary animals keep their shared rig's own idle animation.
- Failed arrivals previously stayed in the saved tank list without a direct retry action. The album now shows pending/failed arrival state and offers “Try adding again” for a failed resident. Retry uses the same saved identity, does not consume another slot and never modifies the discovery journal. Returning the failed resident also leaves its card unlocked. An open detail card refreshes asynchronous arrival state without rebuilding an unchanged action panel.

## One interface and complete registry

“Field album” is the current label of the former “Seen on the outer waters” entry point. It and “For your tank” → “Open the field album” use the same `Album` instance. The editor still offers plants/corals, rocks/decorations and undo; it renders no parallel fish or creature roster. Unseen cards reveal only a mystery slot. Discovery is read from the journal independently of aquarium capacity, asset loading or placement success.

| Primary habitat | Slots | Authored rare roster                                                           |
| --------------- | ----: | ------------------------------------------------------------------------------ |
| Aquarium        |    12 | Pikachu nudibranch, leaf sheep, candy crab                                     |
| Outer Reef      |    30 | Harlequin shrimp, ornate ghost pipefish, hairy frogfish, mimic octopus         |
| Kelp Forest     |    17 | Weedy seadragon, Spanish shawl, sarcastic fringehead, East Pacific red octopus |
| Shipwreck       |     5 | Skeleton shrimp, juvenile wolf eel, decorator crab, painted greenling          |
| Sea Cave        |    18 | Stargazer, psychedelic frogfish, banded coral shrimp, wonderpus                |
| Antarctic       |    33 | Antarctic sea angel, Tritoniella belli, giant Antarctic isopod                 |

There are **115 primary slots**, with every entry appearing once. Shared sightings in secondary habitats do not create additional primary slots. The 22 rare animals occupy **six** shared GLB libraries, rather than 22 separately loaded files. Spanish shawl, sea angel and giant isopod retain their older IDs. The aquarium's existing rare residents require `rare-minis.glb`; other habitat miniature libraries load when their card or placed animal is requested, not at startup.

All eligible legacy animal entries still use their configured model source, tint and save key. Existing fish that already shared another fish's rig keep that established appearance; this pass makes no visual substitutions or downgrades. The per-habitat miniature tests compare wild/card/tank geometry; the new integration test checks all 22 decoded canonical geometry and colour buffers through the card/tank builders. Source GLBs, materials, markings and asset inventory checksums are unchanged.

## Size, movement and placement

The existing Pass 096 tests retain the exact large-animal roster and verify 2× displayed scale, collision radius, half-height, wall clearance and eagle-ray rest/takeoff behavior. No definition scale, target size or radius changes in this pass. The only half-height correction is the upright skeleton shrimp: 0.096 → 0.12 m, because a decoded-model pose test proved its head extended beyond the old envelope. Its 0.24 m displayed size is retained; all large-animal envelopes remain unchanged. Large whales, sharks, rays, turtles, mammals, penguins, polar bear and other large visitors keep their existing navigation controller.

Small substrate animals seek available existing growth or hardscape margins; shelter-associated species prefer the aquarium's existing shelter/rock/hardscape interest points. Seadragons and ghost pipefish select vegetation interest points and make short hovering movements. The sea angel drifts locally in water. If no suitable interest exists, placement falls back to safe space near the requested location. A conservative blocked surface step leaves the animal at its safe position rather than sending it through a rock or into open-water routing. Decorative edits retain existing collision protection and replan contracts.

The bottom controller also covers existing crawling/stationary residents, including the original octopus, kelp crab and sea stars.

This does not introduce new physical dens, rebuild the aquarium or promise that every individual will visibly crawl across every sloping decoration. Existing substrate and sheltered margins remain the safe surfaces. Widely spaced neutral collision envelopes are deliberately preserved instead of shrinking animals to fit.

## Persistence and failure behavior

No migration is needed. The journal and tank saves retain their existing formats and stable keys. Existing tests cover old journal entries, version 1/2/3 tank saves, decoration layouts, fish counts, older miniature placements, unknown/kept entries, corruption, unavailable storage and newer-version safeguards. Added integration coverage follows all 22 new-roster sightings into cards and tank saves, removes a resident without relocking it, retries failed placement, and confirms native source models remain shared.

Unavailable storage still means new progress can last only for the current visit; the existing storage notice is retained. A missing model or full/blocked placement cannot erase an already recorded sighting. Saved but temporarily unavailable tank content remains subject to the existing kept-entry protections. The existing save stores miniature identities rather than their exact roaming positions; this pass preserves that contract and does not migrate them into a new position-save format.

## Validation and demonstration

Exact commands, regression results, localized screenshots and resource measurements are recorded here after the checks complete. The browser harness stabilizes the local observation camera to cancel idle buoyancy; the discovery still uses the ordinary in-game dwell and journal path. It uses a fresh isolated browser profile, representative older saves and one locally observed leaf sheep. It performs a short aquarium placement walkthrough and album navigation check, with no passage travel or full-game playthrough. Local camera repositioning is used for inspection; it is not presented as a test of navigation between habitats or hardware frame rates.

Commands from the repository root:

```bash
npm run format
npm run build
npm run typecheck
npm run lint
npm run test -- tests/collection-integration.test.ts tests/album-previews-lifecycle.test.ts tests/tank-save-safety.test.ts tests/tank-fish.test.ts tests/tank-collection.test.ts tests/collection-registry.test.ts tests/collection-audit.test.ts tests/album-pages.test.ts tests/tank-babies.test.ts tests/tank-babies-lifecycle.test.ts tests/shared-models-scale.test.ts tests/asset-lifecycle.test.ts tests/journal.test.ts tests/rare-minis.test.ts tests/reef-minis.test.ts tests/kelp-minis.test.ts tests/wreck-minis.test.ts tests/cave-minis.test.ts tests/ice-minis.test.ts --maxWorkers=1 --testTimeout=30000 --hookTimeout=30000
COZY_URL=http://127.0.0.1:5177 COZY_PLAYWRIGHT=/tmp/cozy-browser/node_modules/playwright/index.mjs COZY_CHROMIUM=/usr/bin/chromium COZY_OUTPUT=/tmp/cozy-pass106-final node validation/v08/collection-integration.mjs
```

The 19 focused suites passed **149/149 tests** in **87.36 seconds**. Production build and standalone typecheck passed. ESLint and Prettier passed. The build retains the existing warning about chunks larger than 500 kB. No full-game suite or traversal was run.

After the skeleton-shrimp envelope correction and the bottom-controller follow-up, the same 19-suite command passed **150/150 tests** in **155.47 seconds** while the software-rendered browser check also ran. A narrower nine-suite follow-up passed **64/64**. The final build, standalone typecheck, ESLint and Prettier also passed.

The actual-app browser walkthrough passed:

- Observed an initially unseen leaf sheep at its real aquarium home through the application's normal dwell/journal path, unlocked its card and confirmed rendered 3D pixels in the preview.
- Added it through the card; checked both entry points, preserved selection, return focus and continued access to the decoration editor.
- Browsed all six habitat sections twice. Maximum loaded card models stayed **12** in both rounds; peak preview geometries were **66 → 64**, textures **49 → 49**, and total creature-loader leases **61 → 61**. Closing released the preview owner and returned the loader to its existing-world baseline of **49** leases.
- Verified the main renderer's frame counter stayed unchanged while the album's own preview rendered: the paused background did not redraw.
- Returned/re-added the leaf sheep without changing its first discovery; placed an ornate ghost pipefish, banded coral shrimp and sea angel alongside the older blacktip resident.
- Injected a blocked-floor placement failure for the shrimp, verified its failed state, restored the floor and used the actual “Try adding again” card action. The same saved identity arrived, with no duplicate slot or lost discovery. Failed-arrival card labels say “Waiting to arrive” rather than claiming the animal is already present.
- Reloaded the saved tank: all **five residents** arrived, the **two added royal grammas** remained, and the original stone layout and journal were unchanged.
- Took a clear local rendering of the reloaded leaf sheep using the real aquarium renderer and normal owner updates for its arrival fade. This is controlled close inspection, not a navigation playthrough.
- After complete disposal: **0 creature leases, 0 reef leases, 0 geometries, 0 textures**, and **0 browser errors**.

The reusable harness includes the stable camera and final local rendering steps. An initial harness setup used the wrong constructor argument; that was corrected and was not a production initialization defect. Headless Chromium/SwiftShader warm-up was slow, so these results do not establish hardware frame rates or cross-browser performance.

Collection-to-tank demonstration:

1. [Wild aquarium observation](screenshots/v08-pass106/01-observed-leaf-sheep.png).
2. [Unlocked 3D card using the same model](screenshots/v08-pass106/02-leaf-sheep-card.png).
3. [Habitat navigation and mystery cards](screenshots/v08-pass106/03-album-antarctic.png).
4. [Aquarium action on another canonical species](screenshots/v08-pass106/04-added-sea-angel.png).
5. [Reloaded leaf sheep in the actual aquarium](screenshots/v08-pass106/05-placed-leaf-sheep.png).

Raw evidence: [walkthrough/resource report](screenshots/v08-pass106/report.json) and [reloaded placement inspection](screenshots/v08-pass106/inspection.json). Ground residents retain a small conservative substrate clearance; they do not climb vertical scenery or acquire newly modeled dens. Exact roaming positions remain outside the existing save format. No full-game playthrough or hardware performance benchmark was run.

The finalized self-contained harness reproduced the complete walkthrough successfully in a second isolated browser run, including its stable observation view, 3D-pixel assertion, blocked-placement retry, reload inspection and zero-resource cleanup. The checked-in report and images are from that reproduction. A final copy-only refinement makes failed-arrival badges and detail notes explicit; its TypeScript/lint checks passed.
