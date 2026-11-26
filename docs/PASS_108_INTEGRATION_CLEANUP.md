# Pass 108 — Post-collection integration cleanup

Base: merged Pass 107 main `7e66ea6`. Scope is stabilization only. No species, environment, UI feature, model asset, fog, creature behavior, save schema or version changes. Not accepted, released, deployed or merged by this pass.

## Confirmed defect and cleanup

- **Original-reef coral collision:** `AuthoredReef.buildCorals()` hid procedural coral meshes but left their hulls installed. The shipped first two plate colonies reach 0.69094 m and 1.09806 m above their base, while the procedural collision towers reached 1.945 m. A point 1.5 m above either base was therefore blocked in empty space. The third plate also had a height mismatch (visible 1.15919 m, procedural 1.045 m). The original authored presentation now installs its existing exported coral hulls with the visuals. The default composed reef already replaces these formations and remains unchanged. This also corrects the original-art fallback when composed assets fail. Disable/disposal restores the exact original hulls. Missing optional coral hull data retains the supported procedural fallback. Approved meshes and materials are untouched.
- **Unused creature-panel adapters:** `TankCatalogPanel` only renders the shared album link plus decorations. Its `baby` and `fish` callbacks were never invoked. Removed those interface members, closures, two private handlers and their now-unused type imports. Album actions, model methods, fish population rebuilding and save compatibility remain. These handlers had no other references; no supported save or asset fallback was removed.
- **Stale comments:** the decoration-panel description no longer claims it contains a fish/visitor roster. Shared appearance comments now describe the current album; the transient cache ownership comment is attached to `evictUnused` instead of the lease counter.
- **Validation mirror:** the CPU `installReefHulls` helper now installs the same original coral hulls as production, preventing future placement/scale tests from silently using obsolete procedural obstacles.

## Architecture review

Reviewed registry/pages/descriptions, album lifecycle, decoration editor, visitor art/navigation/local habitats, six rare owners, source registry/loader, journal and tank persistence. One creature album remains; the decoration editor links to it. Discovery comes from the existing journal and is independent of placement. Preview late-result disposal, concurrency bounds, shared leases, visibility observation and close ownership remain intact. No universal resolver, new collection store, migration or architectural rewrite was introduced.

[Current-facing collection documentation](COLLECTION_CURRENT.md) records **115 slots across six habitats**, **22 approved rare identities**, lazy canonical sources, aquarium scaling and remaining deliberate substitutions. A species consistently using the same source across wild/card/tank is distinct from multiple species sharing one source. The documented chromis recolors, ray/shark/seal/grouper substitutions and shared procedural forms remain unchanged. The five coral cards/placements use original-library representatives while the default composed wild reef uses different authored colony assemblies; this category-level presentation difference is now explicit. Historical pass reports are preserved.

## Regression evidence

**25 suites / 177 tests passed in 177.40 seconds.** Production build, typecheck and final lint passed. The targeted run covers collection counts/canonical mapping, six rare habitats, saves/journal compatibility, stale/failed loads and preview release, large miniature scale/animated clearance, local animal behavior, shark propulsion, original coral hulls and composed habitat collision. The initial focused collision run also passed (2 suites / 5 tests). The requested scope is focused tests plus one local album/aquarium browser flow, not exhaustive traversal or multi-hour stress. The existing shark-tail suite checks the corrected propulsion; Pass 107's native four-cycle whitetip/nurse browser evidence remains the prior visual checkpoint. No shark code/model was modified here.

The single localized browser flow **passed with zero browser errors**. It covered actual leaf-sheep observation, page keys, rotation, idle/reduced motion, fish return/add, large miniature add/return, editor context/focus, two rounds of habitat browsing, three rapid-switch/close/reopen cycles, failed shrimp arrival/retry, rare placements and reload. Each rapid close returned to **49** live-world leases; full disposal left **zero creature/reef leases, geometries and textures**. Five visitors, two royal grammas, the stone decoration and the exact journal/tank save survived reload. The humpback retained 2× display scale/radius/half-height (1.10 m inspected model length).

[Browser report](screenshots/pass108/report.json), [reloaded tank inspection](screenshots/pass108/inspection.json), [card screenshot](screenshots/pass108/02-leaf-sheep-card.png) and [reloaded animal screenshot](screenshots/pass108/05-placed-leaf-sheep.png) are included. The final controlled view used 94 draw calls / 897,845 triangles plus 210 points and 12 lines; this is one close-up, not a worst-case frame. Cold readiness was 238,912 ms under software rendering with concurrent tooling. Preview counters in the raw report are last individual draws, sometimes from a previous spread, not whole-book frame totals. Resource timing is post-reload only, not a complete cold-download ledger. GPU object counts are not byte measurements. No real-GPU frame-time or MacBook performance claim is made.

No critical defect remains known within this tested integration scope. This does not certify every environment or grant milestone acceptance.

### Commands

```bash
npm run format
npm run build -- --sourcemap
npm run typecheck
npm run lint
npm run test -- tests/reef-collision-audit.test.ts tests/reef-lifecycle.test.ts tests/reef-habitat.test.ts tests/collection-acceptance.test.ts tests/collection-integration.test.ts tests/album-previews-lifecycle.test.ts tests/tank-save-safety.test.ts tests/tank-fish.test.ts tests/tank-collection.test.ts tests/collection-registry.test.ts tests/collection-audit.test.ts tests/album-pages.test.ts tests/tank-babies.test.ts tests/tank-babies-lifecycle.test.ts tests/shared-models-scale.test.ts tests/asset-lifecycle.test.ts tests/journal.test.ts tests/save-compatibility.test.ts tests/shark-tail.test.ts tests/rare-minis.test.ts tests/reef-minis.test.ts tests/kelp-minis.test.ts tests/wreck-minis.test.ts tests/cave-minis.test.ts tests/ice-minis.test.ts --maxWorkers=1 --testTimeout=30000 --hookTimeout=30000
npm run dev -- --port 5177 # Vite selected 5178 because 5177 was already in use
COZY_CLEANUP=1 COZY_ACCEPTANCE=1 COZY_URL=http://127.0.0.1:5178 COZY_PLAYWRIGHT=/tmp/cozy-browser/node_modules/playwright/index.mjs COZY_CHROMIUM=/usr/bin/chromium COZY_OUTPUT=/tmp/cozy-pass108-album node validation/v08/collection-integration.mjs
```

[Raw regression logs and source-map inventory](acceptance/pass108/targeted-tests.txt) are retained alongside this report. Source maps were requested for this diagnostic build only. A concurrent lint run saw the new current-document table before it was formatted; final formatting/lint results below supersede that intermediate warning.

## Bundle and resource review

A production build with diagnostic source maps reports **1,635.98 kB** for the entry JavaScript (**497.58 kB gzip**), compared with Pass 107's 1,636.36 / 497.67 kB. The existing >500 kB warning remains. This tiny change is not a performance improvement claim. Diagnostic maps are in ignored `dist/` only and do not change the shipping build configuration.

The map contains 2,469,156 bytes of Three.js/addon **source text** and 2,287,267 bytes of application source text. Largest sources are `three.core.js` (1,474,799), `three.module.js` (658,900), `GLTFLoader.js` (119,861), then office, wreck and application orchestration. These are original source sizes, not attributable minified bytes or CPU timings. Environment factories remain statically imported; GLBs are external/lazy assets, not embedded in this entry. Decoder/transcoder artifacts are separate existing build outputs. All six rare GLBs remain 2,636,264 bytes total; no model downloads were added.

No ownership defect was found in the reviewed loader: shared resources remain leased until their last owner releases them; rejected/late asset and preview paths are covered by focused tests. In-flight shared downloads settle and release rather than being forcibly canceled. One album renderer is bounded to the current spread/detail and disposed on close. Card resolution and load/render budgets are unchanged.

## Remaining issues and recommendations

- Actual MacBook Air / Apple GPU / Safari / Retina / thermal and sustained frame-time checks remain **unperformed**. Use the [existing player checklist](PASS_107_MACBOOK_AIR_CHECKLIST.md). SwiftShader results cannot establish hardware performance or final visual acceptance.
- The production bundle warning remains. Measure actual Air network, parse/evaluate, first scene readiness and album interactions before proposing lazy habitat boundaries. A follow-up would need to prove a benefit and preserve passage readiness/ownership; no speculative split or higher card resolution was introduced.
- Existing species substitutions need a separate art decision if species-specific silhouettes are desired. No model rebuilding is authorized by this pass.
- Existing conservative animated collision envelopes and surface placement remain. The reef correction fixes the reproduced hull mismatch; it is not a full-world collision certification. Rare tank residents do not climb arbitrary vertical scenery and exact roaming positions are not saved.
- The existing shark animation uses amplified side bending/counter-sway, not a new traveling-wave rig. The corrected propulsion tests remain relevant; visual comfort needs the user's playthrough.
- Unknown/older supported saves and asset fallback paths remain. Unavailable storage cannot persist beyond the visit. A failed arrival retains discovery/saved intent and offers retry/return; returning never clears the sighting.

## Changed files

- Runtime: `AuthoredReef.ts` (coral hull swap), `TankCatalogPanel.ts` / `TankEditor.ts` (unused adapters), `AssetLoader.ts` / `creatureLooks.ts` (comments only).
- Validation: real-asset plate-height regression, reef lifecycle fallback/rollback regression, corrected CPU reef mirror, optional rapid-page/close checks in the existing local browser driver.
- Documentation: README links, current collection reference, this pass report and raw regression evidence. Historical reports/models remain unchanged.
