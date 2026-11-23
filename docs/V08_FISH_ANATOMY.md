# V0.8 Pass 090: Fish Anatomy and Surface Quality

Base: main after Pass 089. Scope: all 18 fish species in the repository, rebuilt for species
anatomy and natural skin. The asset files, root names, authored sizes and runtime rig contract are
unchanged, so instancing, AI, schooling, avoidance, the catalog, aquarium customization and
sightings are untouched.

- **Source:** `tools/art/pass090/fish.py`, which builds on the Pass 065 builder and the Pass 066
  roster painters. Blender sources are in `tools/art/pass090/*.blend`. The Pass 065/066 scripts are
  kept for rollback.
- **Galleries:** `docs/screenshots/v08-pass090/`, from the shipped GLBs through the game's loader
  (`validation/v08/fish-review.sh`). Every "before" was rendered from a clean export of main.

## 1. Audit (before)

| Problem            | Where it came from                                                                                                                      | Species affected                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared silhouettes | Four shared height profiles: one each for the oval, disc, elongate and robust families, rescaled per species                            | The robust five (humphead wrasse, giant sea bass, parrotfish, sheephead, trevally) were one body. So were the four discs, the five ovals and the four elongate fish |
| Domed heads        | The profiles dropped to the snout over the last 10% of length                                                                           | Every species: a rounded bulb, not a wedge or a species snout                                                                                                       |
| No mouth           | The mouth was a shallow groove about 0.35 of the local width, invisible at swimming distance                                            | All                                                                                                                                                                 |
| One pectoral       | A single small fan formula                                                                                                              | All                                                                                                                                                                 |
| Fabric skin        | Scale relief was a regular grid of round bumps in offset rows, ignoring the body's flow, at normal strength 2.0. It read as woven cloth | All                                                                                                                                                                 |
| Gill seam          | A 35% dark line at the gill cover's edge                                                                                                | All: the head read as a separate piece                                                                                                                              |

The fins were not affected by the fabric. Their material uses only its own base map.

## 2. Anatomy

Each species now has its own dorsal (`top`) and ventral (`bot`) outline and, where it matters,
width profile. The section's centre and half-height are derived from the two outlines, so fins,
eyes and painters stay consistent. Outlines follow reference proportions for each species:

| Family            | Species              | What distinguishes it now                                                                              |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| Damsels, basslets | Chromis              | Compact oval; small terminal mouth; fan pectoral                                                       |
|                   | Clownfish            | Stout, deep; blunt head; thick-lipped small mouth; rounded paddle pectoral                             |
|                   | Royal gramma         | Elongate oval tapering to a pointed snout; oblique mouth                                               |
|                   | Assessor             | Slimmer oval, wedge snout, slightly jutting lower jaw; large oblique mouth; long pelvic fins           |
|                   | Pajama cardinalfish  | Very deep; huge eye; big oblique gape                                                                  |
| Elongate          | Firefish             | Slender; small upturned (superior) mouth over a jutting chin                                           |
|                   | Antarctic icefish    | Long, flat duck-bill snout; huge mouth; large rounded pectorals; scaleless                             |
|                   | Notothen             | Big blunt head, broad from above; large terminal mouth; rounded pectorals                              |
|                   | Patagonian toothfish | Long robust body; wedge head; big mouth with protruding lower jaw                                      |
| Discs             | Butterflyfish        | Tall disc; short protruding pointed snout with a tiny mouth                                            |
|                   | Bannerfish           | Very tall back, steep forehead; short snout                                                            |
|                   | Moorish idol         | Extremely deep triangle; long tubular snout; falcate pectorals                                         |
|                   | Blue tang            | Oval; steep forehead; small low (inferior) mouth; very narrow peduncle; falcate pectorals; fine scales |
| Robust            | Humphead wrasse      | Pronounced forehead hump; thick fleshy lips; labriform wing pectorals                                  |
|                   | Giant sea bass       | Heavy, deepest mid-body; long straight wedge head; huge underslung oblique jaw; rounded pectorals      |
|                   | Parrotfish           | Oblong; blunt rounded head ending in a protruding pale beak; wing pectorals; coarse scales             |
|                   | California sheephead | Elongate; forehead humped well forward and falling steeply to a strong jaw; wing pectorals             |
|                   | Trevally             | Deep convex belly; steep rounded forehead; hair-thin peduncle; crescent tail; long falcate pectorals   |

**Mouths:** each species has a real gape, a cleft into the head with lips above and below.

- **Size:** set by where the gape starts; the giant sea bass's runs back to 86% of length, the idol's only to 98.5%.
- **Height:** terminal, superior (firefish) or inferior (tang).
- **Obliqueness and lip thickness:** set per species.

**Pectorals:** four shapes:

- fan (damsels);
- rounded paddle (clownfish, assessor, groupers, notothen, icefish);
- falcate sickle (trevally, tang, idol);
- labriform wing (wrasse, parrotfish, sheephead).

**Unchanged:** the eyes stay seated in carved orbits. The fins' bases sit inside the body. The
caudal fin is rooted in the peduncle. The stroke morphs deform skin and fins with one field, so no
gaps open in motion (see the mid-stroke views).

## 3. Skin and fins

**Body scales:**

- **Pattern:** imbricate (roof-tile) scales in the body's flow. Rows converge toward the narrow
  peduncle and the belly. Each scale's exposed posterior margin is a soft step over the scale
  behind, jittered in place and size, so there is no regular grid.
- **Size by species:** fine and faint on the tang and trevally, medium on most species, coarse with
  inked margins on the parrotfish and humphead wrasse, and none on the scaleless icefish.
- **Large fish:** scales are never smaller than about 8 texels, so big fish do not alias into noise.

**Head, gills and lateral line:**

- **Head:** scaleless skin with fine pores.
- **Gill cover:** a smooth plate. Its edge is a geometric step with a faint 12% line (was 35%), plus
  a faint preopercle groove.
- **Lateral line:** a line of pores runs along the upper flank and arches down to the peduncle.

**Material response:**

- **Relief:** gentler normal relief (1.2, was 2.0, under the template's 60% strength).
- **Roughness:** rises slightly at scale margins and falls slightly on the head. No metal and no
  gloss.
- **Pigment:** all of Pass 066's species painters are kept. Scale margins carry a species-specific
  ink.

**Fins:**

- **Rays:** each ray forks over its outer half.
- **Membrane:** clearer between the rays, fading toward the edge.
- **Edges:** species edge colours are kept.
- **Heroes:** the chromis, clownfish and gramma's own fin colours, which lived in the Pass 065 fin
  painter, are carried over.
- **Chromis back:** its countershading is deepened (back 0.16 0.42 0.52, was 0.28 0.58 0.66). Without
  the old bump grid's shading the school washed out against the tank water.

## 4. Performance

| Measure                         | Before → Pass 090                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Triangles per fish (near / far) | Unchanged: Body 5,760, Median_Fins 3,004, Eyes_Gills_Mouth 1,456, pectorals 548 each; far level 1,956 |
| Draw calls, materials, morphs   | Unchanged: the same meshes, four maps per fish, `Stroke_Left` / `Stroke_Right`                        |
| Download, all 18 fish           | 12.59 → **12.25 MB** (−0.34 MB). The smoother scale normal maps compress better                       |
| Download budget                 | Further from the 44 MiB limit than before                                                             |

Geometry carries the silhouettes (outlines, gape, pectoral shapes) at the same vertex counts;
textures carry the fine detail.

## 5. Validation

- **Checks:** typecheck, lint and build pass.
- **Full test suite:** 106 files, 1,074 tests pass, including:
  - the fish contract, LOD, budget and render-bounds suites (`hero-fish`, `fish-assets`,
    `fish-lod-compression`, `fish-render-bounds`);
  - schooling, behaviour and movement (`fish-schooling`, `fish-behavior`, `fish-movement`,
    `fish-avoidance`, `fish-spawning`, `fish-residents`, `fish-diver-reaction`);
  - `tank-fish`, the catalog, personalization and sightings suites, and the outer-reef, kelp,
    ice and wreck life suites;
  - the new `fish-anatomy` test: within each former family every pair of species differs in
    depth-normalised outline (the Pass 066 models score 0.000–0.006 and fail; Pass 090's closest
    pair scores 0.32), and the jack and tang peduncles are slim. It fails on the Pass 066 models.
- **Browser:**
  - **Gallery** (side, front, three-quarter, top, mid-stroke) and **per-species studio** (side,
    front, three-quarter, top, eye, flank, tail, mid-stroke): loaded every fish with 0 errors.
  - **In-water views:** the tank and outer reef at swimming distance.
- **Not run:** no full playthrough or stress tests.

## 6. Species-quality assessment

Judged from the galleries (`roster/`, `compare/`, `species/`) against reference proportions:

- **Strong:** clearly the species, at swimming distance and up close.
- **Good:** recognisably distinct, with minor simplifications.
- **Fair:** improved, but still close to a generic body.

| Species              | Verdict | Notes                                                                                                                                                                                               |
| -------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Butterflyfish        | Strong  | Tall disc, protruding pointed snout, tiny mouth                                                                                                                                                     |
| Moorish idol         | Strong  | Deep triangle, long tubular snout, falcate pectorals, banner dorsal                                                                                                                                 |
| Bannerfish           | Strong  | Tall back and steep forehead distinguish it from the butterflyfish                                                                                                                                  |
| Trevally             | Strong  | Deep belly, steep forehead, hair-thin peduncle, crescent tail, sickle pectorals                                                                                                                     |
| Giant sea bass       | Strong  | Heavy wedge head with a huge underslung jaw                                                                                                                                                         |
| Antarctic icefish    | Strong  | Flat duck-bill snout, scaleless pale skin                                                                                                                                                           |
| Parrotfish           | Good    | Blunt head and protruding pale beak, coarse inked scales; the beak is a shaped tip, not tooth plates                                                                                                |
| Humphead wrasse      | Good    | Hump and thick lips read clearly; its markings are unchanged from Pass 066                                                                                                                          |
| California sheephead | Good    | Forward hump and strong jaw; distinct from the wrasse                                                                                                                                               |
| Blue tang            | Good    | Steep forehead, small low mouth, slim peduncle, fine scales; no modelled spine                                                                                                                      |
| Patagonian toothfish | Good    | Long wedge head and protruding jaw                                                                                                                                                                  |
| Notothen             | Good    | Broad blunt head and big rounded pectorals                                                                                                                                                          |
| Pajama cardinalfish  | Good    | Very deep, huge eye, big oblique gape                                                                                                                                                               |
| Assessor             | Good    | Now slimmer than the cardinalfish, with an oblique mouth and long pelvic fins                                                                                                                       |
| Clownfish            | Good    | Stout, rounded paddle pectorals, fine scales; it was already distinct                                                                                                                               |
| Royal gramma         | Good    | Pointed elongate oval and oblique mouth; dorsal spot still missing                                                                                                                                  |
| Firefish             | Fair    | Upturned mouth now visible, but the slender body was already distinct and changed least                                                                                                             |
| Blue-green chromis   | Good    | Unchanged silhouette (the approved hero). The back's countershading is deepened, because without the old bump grid the school read washed out at swimming distance (`in-water/tank-chromis-school`) |

All 18 lose the fabric weave; their scales read as scales or fine skin up close (`species/*`, flank
and eye columns). No eye, fin or tail gaps appear at rest or mid-stroke (the tail and stroke
columns).

## 7. Known limitations

- **Stills only:** stills through SwiftShader. Fin translucency in schools and the stroke at
  speed need a look in the real game.
- **Detail in the base map:** scale ink and patterns are painted; fine features smaller than about
  8 texels on the largest fish (the wrasse and sea bass) are softened.
- **Single fin material:** each fish still has one fin map, so individual fins cannot differ in
  colour (a Pass 066 limitation).
- **Not modelled:**
  - the tang's peduncle spine and the trevally's scutes (painted only);
  - the parrotfish's beak, which is a modelled protrusion with paint, not separate tooth plates;
  - the gramma's dorsal spot.
