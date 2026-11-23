# V0.8 Collection Architecture and Shared Model Audit

Base: main after #148. This pass is audit and specification only. It makes no visual changes,
adds no species, writes no save migration and adds no UI. Its tests
(`tests/collection-audit.test.ts`) pin the facts below so later passes cannot drift from them
unnoticed.

> **Numbering.** "Pass 095" was already used by the playtest fixes (#148, merged). This document
> is the collection-architecture pass under the same number. Its branch is
> `codex/v0.8-pass-095-collection-architecture`.

## 1. Summary

- **Journal:** 96 sighting IDs (`src/discovery/sights.ts`), with no duplicates. The reef keys
  `grass` and `blade` share `plant:seagrass` by design.

  | Prefix     | IDs | Notes                                                         |
  | ---------- | --- | ------------------------------------------------------------- |
  | `species:` | 83  | 11 of them are the large cruising animals in `CRUISE_SPECIES` |
  | `coral:`   | 5   |                                                               |
  | `plant:`   | 3   | Seagrass, giant kelp, ice algae                               |
  | `place:`   | 5   | Sea cave, under the ice, shipwreck, its hold, its bridge      |

- **Tank coverage:** every `species:`, `coral:` and `plant:` sighting already unlocks something in
  the tank:
  - 61 animals in `TANK_BABIES`;
  - 23 sighted fish in `TANK_FISH` (29 in all; 6 are the tank's own species);
  - 10 sighted decorations in `TANK_ITEMS`.

  Of the place sightings, only `place:sea-cave` unlocks anything (the limestone arch).

- **One-model rule:**
  - 19 identities draw another species' model or a substitute (type A, §3);
  - 4 more use a different or simplified build in the tank than in the wild (type B, §3).
- **Saves:** the collection needs no migration. It can be derived from
  `cozy-diver.journal.v1` as it stands (§6).
- **Open:**
  - the 22 approved rare species were not supplied, so §4 checks only the three the brief names;
  - one identity collision risk (the giant isopod) needs your decision before any rare-species
    pass.

## 2. Inventory

These are every sightable thing in the game, generated from the live registries. Habitats come
from the scenes and environments that emit each sighting.

The motion column reads:

- **rig:** an authored GLB with stroke morphs;
- **fish rig:** the fish system;
- **proc:** code-built geometry.

The audit column reads:

- **ok:** one model in every context;
- **A / B:** see §3.

| Sight ID                          | Name                     | Habitat(s)  | Wild model                | Tank entry                       | Tank model                 | Motion   | Audit                                                                  |
| --------------------------------- | ------------------------ | ----------- | ------------------------- | -------------------------------- | -------------------------- | -------- | ---------------------------------------------------------------------- |
| `species:blacktip-reef-shark`     | Blacktip reef shark      | outer,wreck | reefShark                 | animal: blacktip-reef-shark      | reefShark                  | rig      | ok                                                                     |
| `species:spotted-eagle-ray`       | Spotted eagle ray        | outer,wreck | eagleRay                  | animal: spotted-eagle-ray        | eagleRay                   | rig      | ok                                                                     |
| `species:leopard-shark`           | Leopard shark            | kelp        | leopardShark              | animal: leopard-shark            | leopardShark               | rig      | ok                                                                     |
| `species:bat-ray`                 | Bat ray                  | kelp        | eagleRay                  | animal: bat-ray                  | eagleRay tint              | rig      | A: eagle-ray mesh, tinted dark                                         |
| `species:green-sea-turtle`        | Green sea turtle         | outer,wreck | seaTurtle                 | animal: green-sea-turtle         | seaTurtle                  | rig      | ok                                                                     |
| `species:manta-ray`               | Reef manta ray           | outer,wreck | mantaRay                  | animal: manta-ray                | mantaRay                   | rig      | ok                                                                     |
| `species:whale-shark`             | Whale shark              | outer       | whaleShark                | animal: whale-shark              | whaleShark                 | rig      | ok                                                                     |
| `species:humpback-whale`          | Humpback whale           | outer       | humpbackWhale             | animal: humpback-whale           | humpbackWhale              | rig      | ok                                                                     |
| `species:great-hammerhead`        | Great hammerhead         | outer       | hammerhead                | animal: great-hammerhead         | hammerhead                 | rig      | A: one hammerhead mesh for two species (scale only)                    |
| `species:scalloped-hammerhead`    | Scalloped hammerhead     | outer       | hammerhead                | animal: scalloped-hammerhead     | hammerhead                 | rig      | A: one hammerhead mesh for two species (scale only)                    |
| `species:whitetip-reef-shark`     | Whitetip reef shark      | cave,wreck  | whitetipShark             | animal: whitetip-reef-shark      | whitetipShark              | rig      | ok                                                                     |
| `coral:branching`                 | Branching coral          | outer       | reef library / code       | decor: branching, branching-tall | reef library / code        | static   | ok                                                                     |
| `coral:boulder`                   | Boulder coral            | outer       | reef library / code       | decor: boulder                   | reef library / code        | static   | ok                                                                     |
| `coral:plate`                     | Plate coral              | outer       | reef library / code       | decor: plate, plate-tiered       | reef library / code        | static   | ok                                                                     |
| `coral:soft`                      | Soft coral               | outer       | reef library / code       | decor: soft                      | reef library / code        | static   | ok                                                                     |
| `coral:sea-fan`                   | Sea fan                  | outer       | reef library / code       | decor: sea-fan                   | reef library / code        | static   | ok                                                                     |
| `plant:seagrass`                  | Seagrass                 | outer       | reef library / code       | decor: seagrass                  | reef library / code        | static   | ok                                                                     |
| `plant:giant-kelp`                | Giant kelp               | kelp        | reef library / code       | decor: kelp                      | reef library / code        | static   | ok                                                                     |
| `species:garibaldi`               | Garibaldi                | kelp        | chromis rig, tinted       | fish: garibaldi                  | chromis tint               | fish rig | A: chromis rig, tinted (wild and tank)                                 |
| `species:kelp-bass`               | Kelp bass                | kelp        | chromis rig, tinted       | fish: kelp-bass                  | chromis tint               | fish rig | A: chromis rig, tinted (wild and tank)                                 |
| `species:blacksmith`              | Blacksmith               | kelp        | chromis rig, tinted       | fish: blacksmith                 | chromis tint               | fish rig | A: chromis rig, tinted (wild and tank)                                 |
| `species:senorita`                | Señorita                 | kelp        | chromis rig, tinted       | fish: senorita                   | chromis tint               | fish rig | A: chromis rig, tinted (wild and tank)                                 |
| `species:sea-otter`               | Sea otter                | kelp        | seaOtter                  | animal: sea-otter                | seaOtter                   | rig      | ok                                                                     |
| `species:giant-sea-bass`          | Giant sea bass           | kelp        | giantSeaBass              | fish: giant-sea-bass             | giantSeaBass               | fish rig | ok                                                                     |
| `species:california-sheephead`    | California sheephead     | kelp        | sheephead                 | fish: california-sheephead       | sheephead                  | fish rig | ok                                                                     |
| `species:spanish-shawl`           | Spanish shawl nudibranch | kelp        | same procedural fn        | animal: spanish-shawl            | shape:spanish-shawl        | proc     | ok                                                                     |
| `species:kelp-crab`               | Kelp crab                | kelp        | same procedural fn        | animal: kelp-crab                | shape:kelp-crab            | proc     | A: shares the rock crab body                                           |
| `species:harbour-seal`            | Harbour seal             | kelp        | harbourSeal               | animal: harbour-seal             | harbourSeal                | rig      | ok                                                                     |
| `species:western-gull`            | Western gull             | kelp        | westernGull               | animal: western-gull             | westernGull                | rig      | ok                                                                     |
| `species:california-sea-lion`     | California sea lion      | kelp        | seaLion                   | animal: california-sea-lion      | seaLion                    | rig      | ok                                                                     |
| `place:sea-cave`                  | Sea cave                 | cave        | reef library / code       | decor: arch                      | reef library / code        | static   | ok                                                                     |
| `species:spiny-lobster`           | Spiny lobster            | cave        | same procedural fn        | animal: spiny-lobster            | shape:spiny-lobster        | proc     | ok                                                                     |
| `species:glassy-sweeper`          | Glassy sweeper           | cave,wreck  | chromis rig, tinted       | fish: glassy-sweeper             | chromis tint               | fish rig | A: chromis rig, tinted (wild and tank)                                 |
| `species:soldierfish`             | Soldierfish              | cave        | chromis rig, tinted       | fish: soldierfish                | chromis tint               | fish rig | A: chromis rig, tinted (wild and tank)                                 |
| `species:rock-crab`               | Rock crab                | cave        | same procedural fn        | animal: rock-crab                | shape:rock-crab            | proc     | A: shares the kelp crab body                                           |
| `species:moray-eel`               | Moray eel                | cave        | anchored                  | animal: moray-eel                | anchored nodes             | rig      | ok                                                                     |
| `species:flashlight-fish`         | Flashlight fish          | cave        | chromis rig, tinted       | fish: flashlight-fish            | chromis tint               | fish rig | A: chromis rig, tinted (wild and tank)                                 |
| `species:nurse-shark`             | Nurse shark              | cave        | nurseShark                | animal: nurse-shark              | nurseShark                 | rig      | ok                                                                     |
| `species:swell-shark`             | Swell shark              | cave        | nurseShark                | animal: swell-shark              | nurseShark tint            | rig      | A: nurse-shark mesh, small and tinted                                  |
| `species:encrusting-sponge`       | Encrusting sponges       | cave        | same procedural fn        | animal: encrusting-sponge        | shape:encrusting-sponge    | proc     | ok                                                                     |
| `species:tube-sponge`             | Tube sponges             | cave        | same procedural fn        | animal: tube-sponge              | shape:tube-sponge          | proc     | ok                                                                     |
| `species:sea-squirt`              | Sea squirts              | cave        | same procedural fn        | animal: sea-squirt               | shape:sea-squirt           | proc     | ok                                                                     |
| `species:mysid`                   | Mysids                   | cave        | same procedural fn        | animal: mysid                    | shape:mysid                | proc     | A: krill shape, scaled                                                 |
| `species:cleaner-shrimp`          | Cleaner shrimp           | cave        | same procedural fn        | animal: cleaner-shrimp           | shape:cleaner-shrimp       | proc     | ok                                                                     |
| `species:lionfish`                | Lionfish                 | cave        | same procedural fn        | animal: lionfish                 | shape:lionfish             | proc     | ok                                                                     |
| `species:great-barracuda`         | Great barracuda          | outer,wreck | barracuda                 | fish: great-barracuda            | barracuda                  | fish rig | ok                                                                     |
| `species:blue-tang`               | Blue tang                | outer,wreck | blueTang                  | fish: blue-tang                  | blueTang                   | fish rig | ok                                                                     |
| `species:threadfin-butterflyfish` | Threadfin butterflyfish  | outer,wreck | butterflyfish             | fish: threadfin-butterflyfish    | butterflyfish              | fish rig | ok                                                                     |
| `species:moorish-idol`            | Moorish idol             | outer,wreck | moorishIdol               | fish: moorish-idol               | moorishIdol                | fish rig | ok                                                                     |
| `species:parrotfish`              | Bumphead parrotfish      | outer       | parrotfish                | fish: parrotfish                 | parrotfish                 | fish rig | ok                                                                     |
| `species:octopus`                 | Day octopus              | outer,cave  | same procedural fn        | animal: octopus                  | shape:octopus              | proc     | B: wild Octopus rig vs simplified tank octopus()                       |
| `species:humphead-wrasse`         | Humphead wrasse          | outer,wreck | humpheadWrasse            | fish: humphead-wrasse            | humpheadWrasse             | fish rig | ok                                                                     |
| `species:bigeye-trevally`         | Bigeye trevally          | outer,wreck | trevally                  | fish: bigeye-trevally            | trevally                   | fish rig | ok                                                                     |
| `species:longfin-bannerfish`      | Longfin bannerfish       | outer       | bannerfish                | fish: longfin-bannerfish         | bannerfish                 | fish rig | ok                                                                     |
| `species:ocean-sunfish`           | Ocean sunfish            | outer       | sunfish                   | animal: ocean-sunfish            | sunfish                    | rig      | ok                                                                     |
| `species:great-white-shark`       | Great white shark        | outer       | greatWhite                | animal: great-white-shark        | greatWhite                 | rig      | ok                                                                     |
| `species:cleaner-wrasse`          | Cleaner wrasse           | outer       | firefish rig, tinted blue | fish: cleaner-wrasse             | chromis tint               | fish rig | B: wild firefish rig vs tank chromis rig                               |
| `species:christmas-tree-worm`     | Christmas tree worms     | outer       | same procedural fn        | animal: christmas-tree-worm      | shape:christmas-tree-worm  | proc     | ok                                                                     |
| `place:under-ice`                 | Under the ice            | ice         | —                         | —                                | —                          | —        | ok                                                                     |
| `plant:ice-algae`                 | Ice algae                | ice         | same procedural fn        | animal: ice-algae                | shape:ice-algae            | proc     | ok                                                                     |
| `species:sea-angel`               | Sea angels               | ice         | same procedural fn        | animal: sea-angel                | shape:sea-angel            | proc     | ok                                                                     |
| `species:glass-sponge`            | Glass sponge             | ice         | same procedural fn        | animal: glass-sponge             | shape:glass-sponge         | proc     | ok                                                                     |
| `species:antarctic-soft-coral`    | Antarctic soft coral     | ice         | same procedural fn        | animal: antarctic-soft-coral     | shape:antarctic-soft-coral | proc     | ok                                                                     |
| `species:antarctic-anemone`       | Antarctic anemone        | ice         | same procedural fn        | animal: antarctic-anemone        | shape:antarctic-anemone    | proc     | A: kelp anemone geometry                                               |
| `species:antarctic-sea-star`      | Antarctic sea star       | ice         | same procedural fn        | animal: antarctic-sea-star       | shape:antarctic-sea-star   | proc     | A: kelp sea-star geometry                                              |
| `species:feather-star`            | Feather star             | ice         | same procedural fn        | animal: feather-star             | shape:feather-star         | proc     | ok                                                                     |
| `species:emperor-penguin`         | Emperor penguin          | ice         | emperorPenguin            | animal: emperor-penguin          | emperorPenguin             | rig      | ok                                                                     |
| `species:adelie-penguin`          | Adélie penguin           | ice         | adeliePenguin             | animal: adelie-penguin           | adeliePenguin              | rig      | ok                                                                     |
| `species:weddell-seal`            | Weddell seal             | ice         | weddellSeal               | animal: weddell-seal             | weddellSeal                | rig      | ok                                                                     |
| `species:weddell-seal-pup`        | Weddell seal pup         | ice         | harbourSeal               | animal: weddell-seal-pup         | harbourSeal tint           | rig      | A: harbour-seal mesh, tinted (should be the Weddell seal at pup scale) |
| `species:antarctic-krill`         | Antarctic krill          | ice         | same procedural fn        | animal: antarctic-krill          | shape:antarctic-krill      | proc     | ok                                                                     |
| `species:blackfin-icefish`        | Icefish                  | ice         | icefish                   | fish: blackfin-icefish           | icefish                    | fish rig | ok                                                                     |
| `species:bald-notothen`           | Bald notothen            | ice         | notothen                  | fish: bald-notothen              | notothen                   | fish rig | ok                                                                     |
| `species:giant-sea-spider`        | Giant sea spider         | ice         | same procedural fn        | animal: giant-sea-spider         | shape:giant-sea-spider     | proc     | B: wild instanced body+rod legs vs tank tube legs                      |
| `species:ribbon-worm`             | Ribbon worm              | ice         | same procedural fn        | animal: ribbon-worm              | shape:ribbon-worm          | proc     | B: wild IceCritters geometry vs tank tube                              |
| `species:sea-butterfly`           | Sea butterfly            | ice         | same procedural fn        | animal: sea-butterfly            | shape:sea-butterfly        | proc     | ok                                                                     |
| `species:comb-jelly`              | Comb jelly               | ice         | same procedural fn        | animal: comb-jelly               | shape:comb-jelly           | proc     | ok                                                                     |
| `species:leopard-seal`            | Leopard seal             | ice         | leopardSeal               | animal: leopard-seal             | leopardSeal                | rig      | ok                                                                     |
| `species:minke-whale`             | Minke whale              | ice         | minkeWhale                | animal: minke-whale              | minkeWhale                 | rig      | ok                                                                     |
| `species:killer-whale`            | Killer whale             | ice         | killerWhale               | animal: killer-whale             | killerWhale                | rig      | ok                                                                     |
| `species:antarctic-toothfish`     | Antarctic toothfish      | ice         | toothfish                 | fish: antarctic-toothfish        | toothfish                  | fish rig | ok                                                                     |
| `species:colossal-squid`          | Colossal squid           | ice         | same procedural fn        | animal: colossal-squid           | shape:colossal-squid       | proc     | ok                                                                     |
| `species:polar-bear`              | Polar bear               | ice         | polarBear                 | animal: polar-bear               | polarBear                  | rig      | ok                                                                     |
| `species:antarctic-jellyfish`     | Antarctic jellyfish      | ice         | same procedural fn        | animal: antarctic-jellyfish      | shape:antarctic-jellyfish  | proc     | ok                                                                     |
| `species:salp`                    | Salp chain               | ice         | same procedural fn        | animal: salp                     | shape:salp                 | proc     | ok                                                                     |
| `species:antarctic-sea-urchin`    | Antarctic sea urchin     | ice         | same procedural fn        | animal: antarctic-sea-urchin     | shape:antarctic-sea-urchin | proc     | ok                                                                     |
| `species:brittle-star`            | Brittle star             | ice         | same procedural fn        | animal: brittle-star             | shape:brittle-star         | proc     | ok                                                                     |
| `species:sea-cucumber`            | Sea cucumber             | ice         | same procedural fn        | animal: sea-cucumber             | shape:sea-cucumber         | proc     | ok                                                                     |
| `species:antarctic-scallop`       | Antarctic scallop        | ice         | same procedural fn        | animal: antarctic-scallop        | shape:antarctic-scallop    | proc     | ok                                                                     |
| `species:sea-pen`                 | Sea pen                  | ice         | same procedural fn        | animal: sea-pen                  | shape:sea-pen              | proc     | ok                                                                     |
| `species:giant-isopod`            | Giant isopod             | ice         | same procedural fn        | animal: giant-isopod             | shape:giant-isopod         | proc     | ok                                                                     |
| `species:antarctic-silverfish`    | Antarctic silverfish     | ice         | chromis rig, tinted       | fish: antarctic-silverfish       | chromis tint               | fish rig | A: chromis rig, tinted (wild and tank)                                 |
| `place:shipwreck`                 | Shipwreck                | wreck       | —                         | —                                | —                          | —        | ok                                                                     |
| `place:shipwreck-hold`            | The wreck's cargo hold   | wreck       | —                         | —                                | —                          | —        | ok                                                                     |
| `place:shipwreck-bridge`          | The wreck's bridge       | wreck       | —                         | —                                | —                          | —        | ok                                                                     |
| `species:queensland-grouper`      | Queensland grouper       | wreck       | giantSeaBass              | fish: queensland-grouper         | giantSeaBass               | fish rig | A: giant-sea-bass mesh                                                 |

The tank's large animals are presented as juveniles: "Blacktip pup", "Little manta ray" and so
on. Each is the same mesh as the wild animal at a smaller scale (`TANK_BABIES[].scale` and
`size`), so identity is already shared. Only the labels differ.

## 3. Discrepancies (the exact duplicate and overlap report)

### Type A: one model stands in for another species (in the wild and the tank alike)

| Identities                                                                                                                     | Shared source                                                                      | Must be preserved or authored per species                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bat-ray`                                                                                                                      | `eagleRay` (`eagle-ray.glb`) tinted `0x484b51`                                     | A bat ray has a blunt, raised head, a plain dark back with no white spots, and a shorter tail. The eagle ray's baked spot map now shows through the tint                                                             |
| `great-hammerhead`, `scalloped-hammerhead`                                                                                     | `hammerhead` at scale 1.5 / 0.9                                                    | The great has a straight-edged cephalofoil and a very tall falcate dorsal. The scalloped has a notched, scalloped head front, is greyer and smaller                                                                  |
| `swell-shark`                                                                                                                  | `nurseShark`, small, tinted `0xb08a5c`                                             | A catshark: a broad flat head, a stout body, a pale skin with dark saddles and spots. The nurse shark's barbels and body plan are wrong for it                                                                       |
| `weddell-seal-pup`                                                                                                             | `harbourSeal` tinted `0xabb6bd`                                                    | It should be the Weddell seal's own mesh at pup scale (§5: it is a life stage, not a species)                                                                                                                        |
| `queensland-grouper`                                                                                                           | `giantSeaBass`                                                                     | A giant grouper: a huge mouth, rounded fins, a mottled yellow-brown pattern with dark blotches                                                                                                                       |
| `garibaldi`, `kelp-bass`, `blacksmith`, `senorita`, `glassy-sweeper`, `soldierfish`, `flashlight-fish`, `antarctic-silverfish` | the `chromis` rig, tinted (`OuterSchools` `LIBRARY`/`RECOLOR`; `TANK_FISH[].tint`) | Each needs its own silhouette. The sweeper is deep-bodied; the señorita is a cigar-shaped wrasse; the flashlight fish needs its light organ; the silverfish is slender and silvery; the kelp bass has a bass profile |
| `mysid`                                                                                                                        | `krillShape()` scaled 0.7                                                          | A smaller, slenderer shrimp with stalked eyes and a statocyst tail                                                                                                                                                   |
| `kelp-crab`, `rock-crab`                                                                                                       | `crabBody()`                                                                       | The kelp crab is a long-legged spider crab with a pointed carapace; the rock crab is a broad cancrid                                                                                                                 |
| `antarctic-anemone`, `antarctic-sea-star`                                                                                      | the kelp forest's `anemoneColumn`/`anemoneCrown` and `seaStarShape`                | Acceptable as a shared form, but they currently share the kelp forest's unsighted dressing too                                                                                                                       |

### Type B: the tank does not use the wild model

| Identity           | Wild                                                | Tank                                               |
| ------------------ | --------------------------------------------------- | -------------------------------------------------- |
| `cleaner-wrasse`   | the firefish rig, tinted electric blue (`ReefLife`) | the `chromis` rig, tinted (`TANK_FISH`)            |
| `giant-sea-spider` | an instanced body and rod legs (`IceCritters`)      | its own tube-legged `spider()`                     |
| `octopus`          | the `Octopus` rig with arms (`shared/Octopus`)      | a simplified `octopus()` in `TankCollectionShapes` |
| `ribbon-worm`      | `IceCritters` geometry                              | a plain `tube()`                                   |

These are already shared, and are the model to follow:

- the lionfish (`lionBody` and `lionRayPose`, since #148);
- the Spanish shawl;
- the moray (the `anchored` nodes);
- every Antarctic invertebrate built by `IceExtras` and `IceGarden`;
- Christmas tree worms;
- sea angels.

## 4. The 22 approved rare species

The list was not included with the brief, so no new species can be audited against the roster
yet. For the three the brief names:

| Approved name | Existing entry                                                                                                             | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spanish shawl | `species:spanish-shawl`: _Flabellina iodinea_, kelp forest, Pass 053 sculpt (code)                                         | Same species. Reuse the ID; it is not a new species                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Sea angel     | `species:sea-angel`: _Clione_ (Antarctic), under the ice                                                                   | Same, if the approved animal is _Clione antarctica_ or _limacina_. Reuse the ID                                                                                                                                                                                                                                                                                                                                                                                                  |
| Giant isopod  | `species:giant-isopod`: an Antarctic isopod about 18 cm long (_Glyptonotus antarcticus_ by its description), under the ice | **Ambiguous.** If the approved species is the deep-sea _Bathynomus giganteus_ (up to about 40 cm), it is a different animal. It needs a new ID, for example `species:deep-sea-giant-isopod`, and the existing entry should be relabelled "Antarctic giant isopod" (label only; the ID is kept). **Never repurpose `species:giant-isopod`**: players who saw the Antarctic animal would silently "own" the new one, and the tank animal saved under that ID would change identity |

**Rule for the rest:** a new species gets a new `species:` ID unless it is the same binomial as an
existing entry. Labels may change; IDs never do.

## 5. Canonical species registry (specification)

One entry per distinct animal (`src/collection/registry.ts`, in the next pass). Each field links
to an existing system, so nothing is duplicated:

```ts
type HabitatId = 'aquarium' | 'outer' | 'kelp' | 'cave' | 'wreck' | 'ice';
interface SpeciesEntry {
  /** Canonical: the existing sighting ID, verbatim (e.g. 'species:bat-ray'). Never changes. */
  readonly id: string;
  /** Older or extra sighting IDs that also mark it discovered (aliases; read-only). */
  readonly alsoSeenAs?: readonly string[];
  readonly name: string; // common name; may be edited
  readonly scientific?: string;
  readonly kind:
    | 'fish'
    | 'shark-ray'
    | 'mammal'
    | 'bird'
    | 'reptile'
    | 'invertebrate'
    | 'coral'
    | 'plant';
  /** The page it is listed on (where it is first findable), then anywhere else it appears. */
  readonly habitat: HabitatId;
  readonly alsoIn?: readonly HabitatId[];
  readonly rare?: boolean; // one of the 22
  readonly clue?: string; // the habitat hint shown on its undisclosed slot
  readonly model: ModelSource; // the one source for wild, card and tank
  readonly presentation: Presentation;
  readonly tank?: TankPlacement; // absent: card only
}
type ModelSource =
  | {
      readonly type: 'asset';
      readonly asset: AssetId;
      readonly nodes?: readonly string[];
    }
  | { readonly type: 'fish'; readonly species: SpeciesId } // a fish rig via FishSpecies
  | { readonly type: 'procedural'; readonly build: () => THREE.BufferGeometry }; // shared factory
interface Presentation {
  /** Real adult length (m): the wild animal's scale. */
  readonly length: number;
  /** Card framing: camera distance and yaw, in body lengths (size-independent). */
  readonly card: {
    readonly yaw: number;
    readonly pitch: number;
    readonly fill: number;
  };
  /** Motion metadata: stroke morph rate, or a procedural motion name. */
  readonly motion: 'swim' | 'glide' | 'crawl' | 'drift' | 'still';
  readonly strokeHz?: number;
}
interface TankPlacement {
  /** The existing tank save key: a TankCreatureId, SpeciesId or TankKind (unchanged). */
  readonly saveKey: string;
  readonly slot: 'animal' | 'fish' | 'decoration';
  /** Display length in the tank (m); the mesh is the canonical one, scaled. */
  readonly length: number;
  readonly label?: string; // e.g. "Blacktip pup"
}
```

- **Rules:**
  - `id` is the sighting ID, so existing journals need no migration.
  - `model` is the only place a model is chosen. The wild scene, the card and the tank all
    resolve it through one `resolveModel(entry, context, loader)`, which returns the same
    geometry or asset lease, scaled for the context.
  - Tints are not allowed as a species identity. A tint may only vary individuals.
  - Shared factories already exist for the procedural animals: the `IceExtras` and `IceGarden`
    builders, `lionBody`, `spanishShawlGeometry` and so on.
- **Life stages:**
  - `species:weddell-seal-pup` stays a journal ID. Its registry entry should be an alias on the
    Weddell seal's entry (`alsoSeenAs`), with the tank keeping its pup placement.
  - Merging it would hide one collection slot, but removes nothing: both journal IDs remain.
  - **Your decision is needed:** one slot ("Weddell seal", with the pup as a presentation) or two
    slots.
- **Places:** `place:*` IDs are not species. They stay in the journal and could be shown as habitat
  milestones, not cards.
- **Habitat assignment:**
  - **Multi-habitat animals:** octopus (outer reef, cave), glassy sweeper (cave, wreck), whitetip
    (cave, wreck), blacktip, eagle ray, manta and turtle (outer reef, wreck).
  - **Rule:** each is listed once, on the page of the habitat where it is first reachable, and
    noted as also seen elsewhere.

## 6. Save compatibility

| Store                                                     | Today                                                                                                                                                                                                      | Plan                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cozy-diver.journal.v1` `{version:1, seen:[{id, first}]}` | Unknown IDs are kept (they are just not listed), entries are deduplicated, and corrupt entries are skipped                                                                                                 | **Unchanged.** The collection is derived from it: an entry is discovered when its `id` or any `alsoSeenAs` is in `seen`. New species write new IDs into the same list. No version bump and no rewrite, so nothing can be lost. A failed model load never touches the journal (discovery is recorded by the sighting tracker, before any model is needed) |
| `cozy-diver.tank.v1` `{version:3, items, babies, fish}`   | Entries this version cannot place are carried through in `keptEntries` (up to 40 items) and rewritten on save. Babies are kept if they are a known `TankCreatureId`. Fish are kept by `readFish(...).kept` | **Unchanged keys.** `TankPlacement.saveKey` is the existing `TankCreatureId`, `SpeciesId` or `TankKind`, so every saved animal, fish and decoration resolves to the same registry entry. A new rare species placed in the tank appends to `babies` or `fish` under its new key                                                                           |
| Settings v1 to v3, onboarding, visits                     | Unrelated                                                                                                                                                                                                  | Untouched                                                                                                                                                                                                                                                                                                                                                |

**Two risks found in today's code (not changed in this pass):**

1. **Unknown animals are dropped.** `keptEntries` keeps an unknown **baby** only if it is a
   currently known `TankCreatureId` (`TANK_BABIES.some(...)`). If a later version wrote a new
   rare-species baby and the player then ran an older build, that build would drop it on its next
   save.
   - **Recommended fix:** when the tank save gains new animal kinds, bump it to version 4 and have
     builds that read an older version refuse to overwrite a newer save. The `newer` guard already
     does this for `version > TANK_SAVE_VERSION`.
   - That is sufficient as long as every new kind ships together with a version bump.
2. **Animals are capped by the roster size.** `BABY_CAP = TANK_BABIES.length` means the number of
   animals a tank may hold grows with the roster. Adding 22 species raises it silently. It should
   become a named constant before the roster grows.

## 7. Model loading for 3D cards

- **Grid of slots:** a habitat page shows its slots as flat silhouettes or snapshots, not live 3D.
- **One live preview:** one shared offscreen view (the existing renderer, scissored) renders the
  focused card only.
- **Leases:** the preview acquires its model through `AssetLoader.acquire(id)`. The lease is
  reference-counted, so a model already loaded by the current world or the tank is shared and not
  downloaded twice. It is released on blur, and `evictUnused` runs on page close.
- **Snapshots:**
  - Each discovered card is rendered once, lazily, into a 256 px `ImageBitmap`, and cached in
    memory with an LRU of about 48. The registry entry's `card` framing is used.
  - Snapshots are queued with a concurrency of 2 and cancelled when the page changes.
  - They are never pre-fetched for undiscovered slots, which show a silhouette from a shared
    placeholder and the habitat clue.
- **Procedural species:** these build their geometry once per page open and dispose it on close.
  It is the same factory as the wild version.
- **Budget:** opening a page never downloads more than the focused model plus snapshots on demand.
  A failed load shows the name and a placeholder; the entry stays discovered.

## 8. Migration plan for the remaining passes

1. **Registry (code, no visuals):**
   - add `src/collection/registry.ts` generated from today's sources, with
     `resolveModel(entry, context)`;
   - point `TANK_BABIES`, `TANK_FISH` and the scenes at it with no behaviour change;
   - tests: every sighting resolves, every tank save key resolves, no ID changes.
2. **Shared-model fixes (type B):** the tank uses the wild model for the cleaner wrasse, sea
   spider, octopus and ribbon worm.
3. **Species models (type A):**
   - author bat ray, scalloped hammerhead, swell shark, Queensland grouper and the eight
     chromis-rig fish in Blender;
   - split the kelp and rock crabs and the mysid;
   - the Weddell pup becomes the Weddell seal's mesh.

   Each species keeps its ID.

4. **Collection UI:** habitat pages, undisclosed slots with clues, and the 3D card per §7.
5. **Rare species (22):** new IDs, models, habitat clues and repeatable encounter spots, once the
   list is confirmed. Tank save version 4 is needed if they can be placed (§6, risk 1).
6. **Tank scale:** juvenile labels and scale come from `TankPlacement.length`. A miniature scale
   audit follows.

## 9. Decisions needed from you

1. **The list of 22 approved rare species.** Binomials, ideally.
2. **Giant isopod:** is the approved animal the Antarctic one that already exists, or the deep-sea
   _Bathynomus_?
3. **Weddell seal pup:** one collection slot or two?
4. **Coral and plant entries:** should seagrass, kelp, ice algae and the five reef corals appear in
   the collection? They are sightable and unlock tank items.
