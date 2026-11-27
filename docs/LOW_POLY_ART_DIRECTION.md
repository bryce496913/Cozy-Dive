# Cozy Diver — permanent low-poly art direction

Low-poly migration Pass 015 supersedes the previous stylized-realism direction. Historical numbered passes remain records, not current art requirements. The migration numbering below is a new sequence and does not rename historical Passes 015–028.

## Geometry and shading

Build crafted, intentionally faceted forms with recognizable anatomy. Use deliberately positioned vertices, cross-sectional profiles, tapered continuous forms and purposeful topology. Large polygonal planes should explain anatomy and silhouette. Preserve continuous bodies wherever anatomy calls for them; attach fins, limbs and facial structures at believable roots with enough volume to read from multiple angles. Primitives are construction tools, not finished organic models: no disconnected sphere/capsule/cylinder bodies. Neither indiscriminate decimation nor random vertex displacement substitutes for design. Add geometry only when it improves silhouette, articulation or recognizable anatomy. Do not use a single generic body plan with recolored fins for species whose silhouettes differ.

Use flat shading or controlled flat/smooth normal combinations. Avoid photorealistic skin/scales/fur/rock/coral maps, noisy normal maps, excessive specularity, metallic effects and realistic imperfections. Preserve coherent silhouettes at near and far distances. LODs must preserve species identity and animation attachment points.

## Color

Use clear base, secondary and restrained accent regions following anatomical or structural boundaries. Markings must wrap the body volume and remain stable through movement; add geometry stations at hard marking boundaries when needed. Preserve species coloration through material groups, vertex colors or simple palette textures. Avoid random triangle colors. Each habitat may retain its atmosphere and palette while using the same modeling language. Materials should be matte or lightly satin with visible facet lighting, never wireframe outlines or noisy photographic texture.

## Motion

Biological movement remains realistic: fish propel through coordinated body/tail motion; rays use coordinated pectoral fins; whales and dolphins use dorsoventral tail strokes; sharks and eels use lateral waves; seals and sea lions use species-appropriate fore/hind flippers; penguins use flipper strokes; octopus arms flow independently; seahorses hover upright with small fins. Keep joints and deformations inside the authored mesh envelope, and do not stretch or detach markings. Preserve existing behavior, pause/reduced-motion support and stable observation positions. Low geometry counts do not justify rigid or robotic motion. Every revised model must keep its existing controller, morph targets, pivot names, LOD and contact bounds unless a geometry fit requires a matching controller correction.

## Provisional per-model triangle targets

| Class                     | Initial target                           |
| ------------------------- | ---------------------------------------- |
| Background schooling fish | 80–250                                   |
| Common close-view fish    | 150–600                                  |
| Special fish              | 250–900                                  |
| Small creatures           | 100–500                                  |
| Rare creatures            | 250–1,200                                |
| Large creatures           | 600–2,500                                |
| Major hero creatures      | Approximately 4,000 when justified       |
| Individual coral          | 100–1,000                                |
| Plant clusters            | 50–500                                   |
| Individual rocks          | 20–250                                   |
| Environmental props       | Based on size, visibility and repetition |

These are starting ranges, not caps. Measure visible instances, draw calls, transparent overdraw, materials, textures and animation CPU cost in the existing renderer before final budgets. Recognizable silhouettes take priority. Do not change card resolution, renderer, fog or gameplay to hide poor assets.

## Migration ownership

017: canonical common/schooling/individual fish foundation. 018: special, habitat-linked and showcase fish refinement (the user’s new Pass 018 brief supersedes the provisional invertebrate assignment). 019: large marine creatures. 020: small marine creatures and invertebrates. 021: rare, hidden and secret creatures (the user's Pass 021 brief supersedes the provisional coral assignment). 022: coral, anemone and sponge library. 023: rocks/terrain/ice/background and passages. 024: wreck, natural/artificial underwater props and aquarium decorations. 025: office/exterior and interactive objects. A shared asset has one owner; references in other habitats are integration tasks, not duplicate replacements. Pass 026 integrates all habitats, Pass 027 completes anatomical animation, Pass 028 verifies the full result. Assignments in the generated census are provisional until semantic review resolves mixed libraries/helpers.

Every replacement must preserve species/sighting/save IDs, wild/card/tank canonical identity, 2× large miniature scaling, collision clearance, den/perch/surface anchors, passage geometry and interaction contracts. Keep supported fallback geometry until its replacement and rollback are validated. Existing gameplay and assets remain unchanged in this documentation pass.

The official visual references establish deliberate facets, clean color blocking and recognizable anatomy. Species-specific anatomy takes precedence over matching one generic template.

See [inventory and baseline status](low-poly/BASELINE.md).

Pass 019's current roster, canonical ownership decisions and validation are recorded in
[the large-creature migration report](low-poly/PASS_019_VALIDATION.md).

Pass 020's semantic roster, contact contracts and validation are recorded in
[the small-creature migration report](low-poly/PASS_020_VALIDATION.md).

Pass 021's complete 31-identity roster, canonical reuse decisions and validation are recorded in
[the rare-creature migration report](low-poly/PASS_021_VALIDATION.md).
