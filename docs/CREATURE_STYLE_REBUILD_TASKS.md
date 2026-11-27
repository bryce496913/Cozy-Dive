# Creature style rebuild — task list

The official style target is faceted low-poly stylized realism: deliberately sculpted silhouettes,
continuous anatomy where appropriate, readable color regions and natural species-specific motion.
Scope is creature design and its existing animation integration only.

## 1. Core fish

- Audit every core aquarium species against its canonical mesh, body stations, face, fins, tail and markings.
- Improve body continuity and species-specific silhouettes; ensure stripe/band patterns wrap the body.
- Keep school batching, morph targets, current scales, controllers and locomotion timing intact.

## 2. Special fish and showcase species

- Review habitat-associated fish, long-finned fish, clownfish and feature species.
- Give each a distinct outline and anatomically attached fins; preserve their existing habitat behavior.
- Tune tail and fin strokes to the species without adding scripted performances.

## 3. Large marine creatures

- Review sharks, rays, turtles, whales, dolphins, seals, sea lions, penguins and other large visitors.
- Replace generic family silhouettes with species-specific body profiles, faces, appendage shapes and markings.
- Preserve existing morph names, swimming direction, animation phase, collision envelope, and 2× aquarium miniatures.

## 4. Small marine creatures

- Review small fish and invertebrates for coherent anatomy and readable proportions at gameplay scale.
- Improve continuous body forms, limb placement and attached appendages; retain safe substrate/perch/shelter contact.
- Preserve crawl, hover, swim and drift controllers.

## 5. Rare and secret creatures

- Review seahorses, frogfish, rare eels, hidden reef/cave/wreck/ice creatures and rare visitors.
- Reuse matching canonical models; improve defining anatomy and species-specific idle/locomotion while keeping camouflage.
- Preserve stable sighting IDs, habitats, discovery timing and the shared wild/card/tank model source.

## Progress

- [x] Read the official style guide and current model pipeline.
- [x] Resolve the art-direction conflict in the current style notes.
- [x] Inventory the core-fish geometry and movement pipeline.
- [x] Add refined body cross-sections to core fish silhouettes while retaining each species' authored profile.
- [x] Seat hard markings on body rings and add beaked, heavy-lipped and elongated-jaw face profiles.
- [x] Finish core fish fin-root thickness and tail-to-peduncle silhouette refinement.
- [x] Core fish
- [x] Special and showcase fish: clown bands, rounded fins, long-fin streamers, darting tails and feature-species faces use the rebuilt canonical surface.
- [x] Replace the shared large-animal torso with family and species-specific body sections and readable faceted eye plates.
- [x] Replace noisy large-animal mottling with deliberate color regions while preserving existing stroke morphs.
- [x] Rebuild rays with a continuous bilateral mantle and manta cephalic lobes.
- [x] Add long humpback pectorals and recognizable penguin feet while retaining family stroke axes.
- [x] Large marine creatures
- [x] Remove procedural color noise from shared crustacean materials and replace it with matte facet lighting.
- [x] Rebuild cleaner shrimp with one continuous tapered abdomen and an attached dorsal stripe.
- [x] Replace crab blotch noise with deliberate broad carapace regions while retaining its gait.
- [x] Replace the octopus's wrinkled sphere with a continuous authored mantle and faceted eye ridges.
- [x] Preserve eight independently deforming arms while replacing random arm color noise with anatomical underside regions.
- [x] Small marine creatures
- [x] Add a faceted coronet, chest keel and higher-resolution continuous neck to the canonical seahorse.
- [x] Strengthen frogfish body and jaw facets while retaining its lure, breathing, yawn and rare walking cycle.
- [x] Verify rare miniature libraries remain the single canonical wild/card/tank source after the small and large rebuilds.
- [x] Rare and secret creatures
- [x] Prepare the focused creature-only delivery.

Tests and in-game screenshot capture are intentionally left to the user as requested.
