# Complete home-tank collection — 0.6.0-rc.24

The home tank collects discoveries from every habitat, including the swell shark, seal pup and cleaner wrasse added by PRs #99–100. Size, temperature, cave darkness and the anemone's existing family no longer disqualify a species. Discovery still unlocks it; adding it has no currency or cost.

## Changes

- The eleven fish reported in the playtest were already offered on current main. This pass removes the remaining exclusion API and the entire **Not for this tank** section, then closes the gaps across the whole discovery journal rather than maintaining another exception list.
- All 28 fish entries can be collected, including flashlight fish, icefish, notothens, silverfish, toothfish, sea bass, sheephead and bannerfish. The larger reef fish use smaller juvenile lengths.
- The creature collection expands from three babies to 54 entries. Sharks, rays, whales, seals, penguins, the bear, cave animals and polar invertebrates can all come home. Large authored models are normalized to a maximum dimension of 0.55 tank units, including their LOD/morph bounds. Compact procedural creatures use 0.4 units. The original three babies retain their accepted sizes and behaviour.
- The creature allowance now accommodates one of every entry. The fish allowance accommodates every species' full configured number of copies, so collecting one kind never excludes another. Duplicate-copy limits remain; ecological compatibility is not a condition.
- Swimming creatures use the existing fixed-step navigation. Crawlers choose low routes; sponges, corals and other sessile life stay planted. Drift creatures pulse gently. Existing local models/geometry are reused where available; the moray uses its authored body/head/jaw parts, and compact octopus/spider bodies are generated locally. No remote assets are introduced.
- Save version 3 and existing journal IDs remain compatible. The full collection round-trips through storage; old three-baby saves continue to load. Unknown entries remain preserved by the existing save logic.
- Each creature owns its copied fade materials and generated geometry, while authored meshes retain asset leases. Returns, reset, interrupted loading and disposal release their resources. Per-frame animation reuses prepared arrays/objects.
- Build version rc.24 makes the updated build easy to identify and refreshes model URLs.

## Validation

- `npm run build`, `npm run typecheck`, `npm run test` (760 passing tests), `npm run lint`.
- A journal-coverage regression requires every discovered species to have an addable fish, creature or decoration entry. Another test collects every fish and creature simultaneously and saves/restores the complete collection.
- Procedural-art tests build every procedural entry, check miniature bounds and idempotent disposal. Sessile-creature tests check planted positions and return fading. Existing navigation, save migration, resource lifecycle and original-baby long-run tests remain in place.
- `validation/tank-collection.mjs` clicks the actual catalog controls for every entry, then loads all 28 fish and 54 creature models into an isolated tank-sized rendering habitat. It verifies the complete save, no exclusion messages, no console/page errors and zero remaining leases after disposal.
- The newly merged peaceful-visitor test fixtures now include the required player velocity for strict type checking.
- Chromium used SwiftShader, an 1100 × 650 viewport and renderer pixel ratio 0.7. This is a focused catalog/rendering review, not a full player journey, cross-browser certification or a measurement of laptop performance.

Reproduce with a local dev server:

```bash
COZY_URL=http://127.0.0.1:5174 \
COZY_PLAYWRIGHT=/path/to/playwright/index.mjs \
COZY_CHROMIUM=/usr/bin/chromium \
node validation/tank-collection.mjs
```

## Player check

Open **For your tank** after discovering an animal. Add the fish or creature, including a whale calf or a creature from the cave or ice. Return it, add it again, and reload to check the saved collection. The **Creature collection** group includes the larger animals at miniature size; the schooling and aquarium fish groups retain their existing controls.
