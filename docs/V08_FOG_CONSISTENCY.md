# V0.8 Pass 089: Atmospheric Fog Consistency

Base: main after Pass 088. The outer reef's dense underwater murk (an approved artistic decision)
now also fills the shipwreck and the sea cave. Each keeps its own water colour, light and mood. The
outer reef is unchanged.

Galleries: `docs/screenshots/v08-pass089/`, before on the left, Pass 089 on the right:

- **Wreck:** `wreck-overview` (distant), `wreck-deck` (medium), `wreck-hull-close` (close),
  `wreck-hold` (torch interior), `wreck-return-shaft` (toward the way home).
- **Cave:** `cave-boulders-far` (distant), `cave-cavern` (medium), `cave-wall-close` (close),
  `cave-sunbeam`, `cave-back-tunnel`, `cave-return-tunnel` (toward the way home).

The "before" set was rendered from a clean export of main on a separate dev server.

## 1. Audit

| Where                                           | What it sets                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rendering/deepFog.ts`                          | **One** water-fog shader, installed once into three's shared fog chunk and used by every world: squared-exponential density rescaled to preserve half-visibility, a linear near-haze term, per-channel absorption derived from the water colour, and a darker deep tint and veil below world y −2 |
| `config/passage.ts` `OUTER.fog` (0.13)          | Outer reef density. `OuterWatersScene` thickens it with the water dome's shade and takes the fog colour from the dome's horizon                                                                                                                                                                   |
| `config/wreck.ts` `WRECK.fog` (0.045), `water`  | Wreck density and colour. `ShipwreckScene.light()` darkens the fog colour and background toward black inside the ship, and lights the torch to match                                                                                                                                              |
| `config/passage.ts` `CAVE.fog` (0.042), `water` | Cave density and colour; a static `FogExp2` in `SeaCaveScene`                                                                                                                                                                                                                                     |
| `config/waterProfiles.ts`                       | Each world's profile reads its density from the configs above                                                                                                                                                                                                                                     |
| Fog-exempt materials                            | The cave's sunbeam, light pool and skylight; every light beam (`LightBeam`)                                                                                                                                                                                                                       |

Since the shader is already shared, the attenuation behaviour is identical in every world. Only the
density differed.

## 2. Change

- **Shared constant:** `config/waterVisibility.ts` defines `DENSE_WATER_FOG = 0.13`, the outer reef's
  approved value, and `OUTER.fog`, `WRECK.fog` and `CAVE.fog` all read it. They cannot drift apart.
- **Outer reef:** its value and its dome thickening are unchanged.
- **Not changed:** the aquarium, kelp forest and ice keep their own clearer water.
- **Colour:** each world keeps its water colour, which through the shared absorption gives its own
  tint with distance: the wreck's dark blue-green, the cave's dim teal, the outer reef's blue.
- **Light:** each keeps its light rig.
- **Wreck interior:** the darkening and the automatic torch are untouched. The torch's 18 m reach
  is longer than the distance the murk swallows (tested), so it lights everything that can be seen.
- **Close range:** surfaces within 3 m stay mostly clear (less than 30% veiled, tested). The deck,
  hull, openings and hold read clearly up close.

## 3. Navigation adjustments

At 0.13, half-visibility is about 5 m and a surface 14 m away is about 95% veiled. From mid-cavern
both cave tunnels, and from the deck the wreck's shaft in the roof, were lost. As the brief
specifies, this is solved with localized light, not less murk.

- **`PassageGlow`** (new, `environment/shared/PassageGlow.ts`): a soft additive disc of light,
  brightest at its centre and zero at its rim. The fog does not veil it (like the sunbeam), so a
  passage reads from across the water as light beyond it.
  - It fades to nothing within 4 m of the eye, so it never flashes as you swim through.
  - It does not move, so reduced motion needs nothing.
  - It uses the beams' alpha-safe additive blend.
- **Cave entrance (the way home):** kelp-forest daylight, green-white, 2.5 m inside the tunnel.
- **Cave back tunnel:** cold blue, 2.5 m inside.
- **Wreck shaft (the way home):** a glow in the hole's mouth, plus a faint column of light falling
  from it about 10 m toward the deck (the existing beam builder). From anywhere around the ship it
  points up to the exit.
- **Cost:** three discs (about 500 triangles each) and one beam (about 2,000 triangles); one draw
  each when in view. No postprocessing.
- **Unchanged:** the cave's sunbeam and light pool are untouched and remain its central landmark,
  with lit and shadowed areas still distinct.

## 4. Result

| Criterion                                                   | Status                                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Wreck and cave use the outer reef's density and attenuation | Yes: one constant, one shader                                                                                 |
| Outer reef unchanged                                        | Yes: same value, same scene code (`OUTER.fog` is the constant, pinned by tests)                               |
| Distinct colours and lighting                               | Yes: each world's own water colour, rig, wreck interior darkening and cave sunbeam                            |
| Wreck torch                                                 | Unchanged and still lighting the hold (`wreck-hold`)                                                          |
| Cave sunbeam                                                | Unfogged; now the strongest read in the cavern (`cave-cavern`, `cave-sunbeam`)                                |
| Close-range navigation                                      | Comfortable within about 5 m; exits marked by their glows from across the water                               |
| Rendering regression                                        | None. Triangles are unchanged to within the glow and beam; draw calls rise by up to 2 where a glow is in view |

**Effect on mood:**

- **Wreck:** it now emerges ghost-like from the murk as you approach (`wreck-overview`).
- **Cave:** the far walls and roof fall away into teal water, so it reads as an enclosed, uncertain
  space around a lit centre rather than a fully visible dome. The walls are only seen once you are
  near them. If that reads too open on the device, raise local light near the walls rather than
  thinning the shared murk.

**Capture note:** two views (`wreck-hull-close`, `wreck-hold`) were re-captured individually after
the glow tuning. They ran at an earlier simulation time than in the full-order run, so a fish or two
sits elsewhere (and `wreck-hull-close` shows +10 draws, from fish, not from this change).

## 5. Validation

- **Checks:** typecheck, lint and build pass.
- **Full test suite:** 105 files, 1,069 tests pass, including:
  - the new `fog-consistency` test: the shared value and its three users; the other worlds
    clearer; distinct water colours; close-range clarity; torch reach against the murk; glow
    fading and fog exemption; both cave glows and the wreck glow present; the sunbeam, pool and
    skylight unfogged;
  - `atmosphere` and `outer-draw-distance` (the outer value is still pinned at 0.13);
  - `sea-cave`, `shipwreck`, `wreck-loading` and `lifecycle-dispose`.
- **Browser:** the wreck and cave scenes rendered all 11 views before and after with 0 errors. No
  whole-world playthrough.
