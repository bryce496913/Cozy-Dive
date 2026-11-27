# Creature style rebuild — completion summary

This focused rebuild applies the official faceted low-poly stylized realism guide to the five
approved creature groups. It changes creature geometry, palette placement and the geometry that
existing animation controllers deform. It does not add species, habitats, discovery rules or
gameplay systems.

## Completed groups

### Core fish

- Added authored shoulder, cheek, peduncle and muzzle sections to every canonical fish body.
- Increased deliberate cross-section faceting and placed hard markings on matching body rings.
- Added beaked, heavy-lipped, elongated-jaw and fuller-cheek face profiles where appropriate.
- Thickened fin roots and rebuilt tail-to-peduncle transitions without changing morph names.

### Special and showcase fish

- Clownfish bands wrap the body geometry with narrow dark borders.
- Long-fin streamers retain rooted outlines and their existing trailing deformation.
- Rounded, forked, swept, notched and truncate tails retain species-specific silhouettes.
- Feature fish use the new parrotfish, wrasse, grouper, bass and barracuda face profiles.

### Large marine creatures

- Replaced the shared six-section torso with family and species-specific body sections.
- Added readable faceted eye plates and broad intentional color regions.
- Rebuilt rays as continuous bilateral mantles; manta rays receive cephalic lobes.
- Added long humpback pectorals and recognizable penguin feet.
- Preserved the existing lateral or dorsoventral stroke axes and aquarium scaling contracts.

### Small marine creatures

- Removed pseudo-random palette speckles from shared crustacean materials.
- Rebuilt cleaner shrimp with a continuous tapered abdomen and attached dorsal stripe.
- Replaced crab noise with broad designed carapace regions.
- Replaced the octopus sphere mantle with an authored faceted body and eye ridges.
- Preserved the octopus's eight-arm deformation and existing benthic movement controllers.

### Rare and secret creatures

- Added a coronet, chest keel and stronger continuous neck facets to the canonical seahorse.
- Strengthened frogfish body and jaw facets while preserving its lure and articulated behaviors.
- Retained one canonical source for every rare miniature across wild, album and aquarium contexts.

## Animation compatibility

Existing controller timing, behavior, pause handling, morph names, sighting IDs, habitat anchors and
save keys are unchanged. Fish keep `Stroke_Left`, `Stroke_Right`, `Fin_Left` and `Fin_Right`.
Large animals keep their existing stroke poses. Seahorse grip/hover, frogfish jaw/lure/walk,
crustacean gait and octopus arm motion continue to drive the rebuilt geometry.

Automated tests and in-game screenshots were not run at the user's request. Final visual acceptance
is reserved for the user's full playthrough.
