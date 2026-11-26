# Shared low-poly pipeline — migration Pass 016

Base: `f3c05f6` (Pass 015). This is the new migration sequence, not historical v0.2 Pass 016. [Art direction](../LOW_POLY_ART_DIRECTION.md) remains authoritative. No production creature, scenery, registry identity, gameplay, save, fog, caustic or quality setting is replaced here.

## Audit and integration choices

| Existing system                                                  | Decision                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `environment/shared/organicGeometry.ts`                          | Keep existing smooth/crease-normal and organic builders for current assets. New designed profile/outline tools live in `geometry/lowPoly/geometry.ts`; do not globally change smoothing.                         |
| `assets/AssetLoader.ts`, `AssetRegistry.ts`, `TankCollectionArt` | Keep canonical GLB sources, clones, leases and retirement. The new resource scope caches only **generated** geometry/materials; it does not load files, maintain species identities or replace the asset loader. |
| Existing creature factories and six rare libraries               | Unchanged. Later migration passes must retain their identities, canonical wild/card/tank source, rigs, sightings and fallback contracts.                                                                         |
| `creatureStroke.ts`                                              | Reused by the inspection prototypes for bounded named left/right morph poses.                                                                                                                                    |
| `PlantAnimation.ts`, existing plant shaders and instancing       | Keep current/clock/shader controllers. New geometry is ordinary BufferGeometry and accepts instancing; the prototype uses anchored morph sway, not a replacement current simulation.                             |
| PBR/triplanar and `Gelatinous.ts` materials                      | Preserve existing assets/effects. New flat MeshStandardMaterial presets use colors, not new image maps or custom shader injection. Special jelly transparency remains available.                                 |
| Geometry/material ownership                                      | Reference-counted generated resources are disposed on their final lease release. Existing GLB lease disposal remains independent.                                                                                |
| `graphicsDetail.ts`                                              | Reuse DPR policy. Full/lighter retain the same geometry, silhouette, color and animation. No new model LOD policy.                                                                                               |
| Underwater lighting/fog/caustics                                 | Built-in lit/fog-compatible materials; no production atmosphere code changes. Scene-specific effects still need visual review when each production asset migrates.                                               |

The [Pass 015 census](BASELINE.md) remains provisional: 1,573 technical records are not certified semantic assets. This pass audits shared infrastructure, not all of those records. Complete caller/dependency mapping before replacing each asset family.

## Geometry contracts

`src/geometry/lowPoly/geometry.ts` returns caller-owned BufferGeometry:

- `profileBody(sections, sides)`: +X longitudinal axis, +Y height, +Z width. Increasing X, positive width/height, optional separate lower height and Y/Z offsets. Design head, belly and tail using meaningful cross-sections. Closed ends have planar caps, not collapsed zero-area triangles. UVs provide longitudinal palette coordinates; they are **not** a seam-unwrapped texture atlas.
- `fin(outline, thickness, subdivisions)`: explicit simple X/Z outline, thickness along Y. Supports concavity, per-outline taper and shared midpoint subdivision. Rotate into dorsal/pectoral/tail orientation. Outlines must not self-intersect; subdivision is bounded to four levels.
- `mirrored(geometry, axis)`: indexed rest geometry, reverses triangle winding after reflection. Apply before palette splitting and poses.
- `taperedCurve(points, radii, sides)`: continuous indexed rings with transported frames. No disconnected cylinders. Centres must advance without repetitions or reversing cusps; authors must avoid self-intersection and excessive radii at tight bends.
- `forkedBranch({height,width,spread})`: deliberately limited Y junction. A six-vertex trunk divides into two four-vertex ports sharing the central edge; no overlapping closed tubes or internal caps. Dimensions scale a coherent designed junction. It is not a general Boolean union/tree generator.
- `polyhedron(points, seed, variation)`: convex hull of deliberately chosen support points. Seeded variation is a bounded global anisotropic stretch (maximum 25%), not random displacement or color noise. Supply a nondegenerate 3D support set.
- `colorRegions(source, palette, region)`: owned copy with complete-face vertex colors and contiguous material groups. The callback classifies anatomical regions by face centre. The source stays owned by its caller. Single vertex-colored material renders in one call; passing a material array uses the groups and adds calls. No automatic random facets.
- `addPose(geometry, name, deform)`: relative position morph targets generated at construction time. A position-only mapping keeps split color/facet vertices coincident. Install poses before uploading/sharing geometry. Flat-shaded materials derive face normals from deformed positions; for smooth-shaded animated assets supply corresponding morph normals separately. Static smooth shading is available through the material preset.

`surface` and `ringSurface` are lower-level construction tools: callers supply properly oriented, non-self-intersecting geometry. Constructors check finite inputs, dimensions and index ranges, not arbitrary mesh intersections. Bounds are refreshed after geometry creation, palette copying and poses.

Pose bounds cover rest and each target independently. Use mutually exclusive left/right weights in [0,1], as the prototypes do. Simultaneously combining arbitrary targets, custom vertex shaders or weights outside that range requires conservative application-specific bounds. GPU morphing changes each instance's weights, never shared rest geometry. No animation callback allocates vectors or rebuilds meshes per frame.

## Shared materials and ownership

`LowPolyResources` provides cached `geometry(key, factory)` and `material(spec)` leases. Roles: body, fin, coral, plant, rock, wood, stone, metal, artificial, translucent. All support clean color, vertex colors, built-in fog and flat shading by default. Ordinary roles use roughness 0.85/metalness 0; metal is restrained at 0.55/0.25. Only the explicit translucent role permits opacity below one and disables depth writes. No physical transmission, texture dependence or double-sided default.

```ts
const resources = new LowPolyResources();
const geometry = resources.geometry(
  'chromis:shape-v1:palette-v1',
  buildChromis,
);
const material = resources.material({ role: 'body', vertexColors: true });
const mesh = new THREE.Mesh(geometry.value, material.value);
// Retain both leases for as long as this mesh (or an InstancedMesh) uses them.
scene.add(mesh);
// On teardown:
mesh.removeFromParent();
geometry.release();
material.release();
resources.dispose();
```

Keys must include every geometry/palette/pose parameter and factory version. Leased values are immutable: do not recolor, deform arrays or call `dispose()` directly. Instance morph weights/transforms are independent. Clone and own geometry if CPU deformation is necessary. Releases are idempotent. A retired scope rejects new acquisitions but allows live owners to finish before disposing their resources; `dispose()` is not a force-free for leaked leases. Zero-ref entries are immediately removed, so repeated environment transitions cannot grow an idle cache.

Ordinary InstancedMesh can reuse these buffers/materials. For independent instanced morph animation use Three's per-instance morph texture API and dispose the InstancedMesh itself; merely sharing geometry does not animate every instance independently. Existing production instancing shaders are unchanged.

## Inspection prototypes

Run `npm run dev -- --port 5180`, open `/validation/low-poly/`. Select side/front/top/three-quarter, pause/resume or reduced motion, then release/restore. The five specimens are inspection IDs only: common-fish/chromis-like, ray-like, branching-coral, rock and aquatic-plant equivalents. They do not claim species-ready accuracy and do not register duplicate game identities. Fish has a continuous asymmetric body with outlined fins and eyes; ray has broad continuous wing sections; coral has a joined fork; rock uses broad support planes; plant combines a curved stem with tapered leaf outlines.

The page uses one renderer, five meshes and shared body material. Model controllers allocate nothing per update; development-only metrics are sampled four times per second. Event listeners, frame loop, meshes and renderer are released on harness disposal. It is not included in the production build. No external art or modelling software is required.

[Validation, screenshots and limitations](PASS_016_VALIDATION.md) cover the measured results. These are pipeline prototypes, not approval to migrate the complete library.
