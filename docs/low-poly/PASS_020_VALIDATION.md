# Pass 020 — small marine creatures

## Scope and ownership

Pass 020 audits and migrates 34 existing small-animal identities across the outer reef, kelp
forest, shipwreck, cave, Antarctic habitat, collection and aquarium. The machine-readable roster
is [small-creature-inventory.json](small-creature-inventory.json); the runtime semantic catalog is
`src/creatures/lowPoly/smallCatalog.ts`.

Fish-shaped miniatures remain owned by Passes 017–018. Corals, sponges, anemones, sea pens and
plants remain with Passes 021–022. This prevents the same model from being independently rebuilt
under two passes.

## Model migration

- Rock and kelp crabs retain a broad faceted carapace, coherent claws, eyes, antennae and four
  naturally attached walking-leg pairs. The shell latitude grid and claw palms now use purposeful
  close-view facets rather than invisible density.
- Spiny lobsters retain the squarish carapace, cervical groove, horns, six-segment abdomen, tail
  fan, five leg pairs and separate animated antennae. Carapace and abdominal grids are reduced
  while silhouette and color-region contracts remain unchanged.
- Purple urchins retain a faceted test and readable Fibonacci radial spines in one merged draw.
  The redundant spine population is reduced from 150 to 72 without changing authored bounds.
- The Spanish shawl remains vertex-compatible with the canonical kelp miniature export; its
  purple body, rhinophores and orange cerata are not duplicated.
- Existing shrimp, stars, mollusks, octopuses, worms, gelatinous animals and rare miniature
  libraries already use the same source factories or model nodes in wild/card/tank contexts. They
  are registered as retained canonical sources rather than copied into another model system.

Controlled smooth normals remain where they describe soft bodies; broad planes and silhouette
geometry carry identity. Materials use existing palette/vertex-color or restrained translucent
treatments, with no new realistic texture dependency.

## Contact and motion

Every roster identity now has an explicit biological contact mode: substrate, shelter, perch,
hover or pelagic. Aquarium placement no longer guesses from name fragments. Size-normalized
bottom animals translate their true lowest authored point to the navigation half-height, avoiding
shells and legs floating above or clipping into sand.

The established habitat controllers remain authoritative for slow foot gliding, coordinated
stepping, crawling, antenna/appendage motion, pulsing and drifting. Existing spawn anchors,
discoveries, pause/reduced-motion behavior and save IDs are unchanged.

## Validation

`tests/pass020-small-creatures.test.ts` verifies semantic ownership, aquarium coverage, biological
contact modes, exact substrate seating, finite palette meshes and representative triangle budgets.
Existing small-life, rare-library, habitat, collection and lifecycle tests cover the shared source
contracts and unload/disposal paths.

Browser evidence is a localized Chromium/SwiftShader rendering check, not a physical MacBook Air
or real-GPU performance claim.

Evidence: [three-quarter gallery](pass020-evidence/small-three-quarter.png),
[side gallery](pass020-evidence/small-side.png), and
[render measurements](pass020-evidence/results.json).
