# Pass 021 — rare and secret creature audit (in progress)

Base: Pass 020 (`08771f8`). This audit does not certify completion of the rare-creature rebuild.

The original seahorse and frogfish use `src/fish/lowPoly/anchored.ts`, shared by the original
habitat and collection. Their existing controller pivots, anchoring and discovery rules must remain
intact. The seahorse's tail is a continuous tapered curve. The frogfish has a shaped body, jaw,
lure and paired pectoral supports. These are candidates for reuse after direct visual and motion
inspection.

The six named rare miniature libraries (`rareMinis`, `reefMinis`, `kelpMinis`, `wreckMinis`,
`caveMinis`, `iceMinis`) are shared by habitat, album and aquarium. Sharing establishes model
identity, but does not establish that their meshes meet the current low-poly art direction. Each
animal still requires visual, anatomy, animation, habitat-fit and material review before it can be
marked migrated. Pass 020's catalog similarly records ownership; it does not prove all 34 animals
were rebuilt.

Rare large visitors and fish already assigned to Passes 017–019 should use their existing canonical
models, subject to inspection against this pass's acceptance criteria. The collection rarity map
in `src/collection/registry.ts`, habitat sightings in `src/discovery/sights.ts`, and miniature
definitions in `src/config/babies.ts` are starting points; hidden and uncommon encounters also
need semantic review beyond the album's `rare` label.

Outstanding: complete the per-species inventory, rebuild or reuse each animal with evidence, add a
development inspection path where needed, validate natural encounter paths and habitat clearance,
run the required tests and build, and capture visual evidence. No gameplay behavior changes in this
audit.
