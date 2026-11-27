# Pass 019 — large marine creatures

## Migrated roster

Pass 019 gives the 22 standalone large-animal assets one canonical crafted geometry source. Wild
encounters, collection previews and aquarium miniatures continue to request the same asset ID, so
their existing routes, sightings, controllers, collision clearance and saved placements are
unchanged.

| Family    | Canonical assets                                                                   | Deliberate identity cues                                                                              |
| --------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Sharks    | blacktip reef, whitetip reef, great white, hammerhead, leopard, nurse, whale shark | independent torso stations, snouts, fins, caudal proportions and countershade/tip/spot/saddle regions |
| Rays      | spotted eagle ray, manta ray                                                       | different disc proportions, head projection, tails and dorsal/ventral palettes                        |
| Reptile   | green sea turtle                                                                   | vaulted shell, projecting head and four broad swimming flippers                                       |
| Cetaceans | humpback, Antarctic minke, killer whale                                            | distinct head/chest/flipper proportions; dorsoventral fluke strokes; species color blocks             |
| Pinnipeds | California sea lion, harbour seal, Weddell seal, leopard seal                      | independent neck, torso, head, foreflipper and hind-flipper proportions                               |
| Penguins  | emperor, Adelie                                                                    | upright tapered bodies, beaks, wing-like flippers and separate facial/ventral markings                |
| Other     | ocean sunfish, sea otter, polar bear                                               | family-specific disc, tail, limb and paddle silhouettes                                               |

The great barracuda and other showcase fishes remain owned by Pass 018's fish pipeline. The moray
retains its continuous UV-driven body plus the existing sculpted hinged head and jaw: it is already
canonical across the reef, album and aquarium, and replacing its mixed library would also replace
the unrelated anemone in the same asset. Its traveling body wave and jaw behavior were therefore
audited, not duplicated.

## Runtime and ownership

- `AssetLoader` resolves these asset IDs to generated faceted geometry before a GLB request.
- The established loader validation, cloning, reference counting, retirement and disposal paths
  still own every resource.
- Each asset keeps `Body`, `Body_LOD1`, its historical root name and `Stroke_Left` /
  `Stroke_Right`; habitat controllers require no adapter.
- Body and appendages share a palette-colored mesh. There are no texture downloads or old-style
  runtime fallbacks for the migrated roster.
- Large aquarium miniature scale remains controller-owned and is not reduced by this pass.

## Motion

Sharks drive lateral tail deformation; cetaceans drive vertical flukes; rays undulate their wing
edges; turtles, pinnipeds, penguins, otters and the swimming bear use paired appendage strokes.
Reduced-motion, pause, glide, route banking and encounter timing remain in the existing controllers.

## Validation

`tests/pass019-large-creatures.test.ts` checks roster completeness, unique anatomical design
signatures, finite faceted geometry, palette regions, production loader validation, morph contracts
and the whale-versus-shark propulsion axes. Existing habitat, collection, aquarium, loader and
lifecycle suites provide the integration coverage.

Visual inspection uses the existing creature close-up gallery and representative habitat views.
It is a browser rendering check, not a claim of physical MacBook Air or real-GPU performance.
