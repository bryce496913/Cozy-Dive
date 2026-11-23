# V0.8 Pass 098: Collection Manifest

The unified marine-life album's data layer is `src/collection/registry.ts`. It implements the
registry designed in the collection audit (`docs/V08_COLLECTION_ARCHITECTURE.md`). There is no UI
yet.

## Rules

- **Identity.** An entry's ID is its existing journal sighting ID, verbatim. Existing journals
  populate the album as they stand: no migration, no save written. Aquarium residents, which were
  never sighted, use `species:` IDs and are **home** entries, discovered from the start.
- **Discovery** is read from `cozy-diver.journal.v1` alone. It is independent of where the swimmer
  is and of what the tank holds.
- **Mystery slots** (`albumPage`) carry only their position: no ID, name, model or rarity.
- **Tank.** `canAddToTank` is exactly the existing catalog's unlock rule (tested against it), so a
  mystery slot never adds anything. Tank saves are untouched; each entry names its existing tank
  save key.
- **One identity per animal.** Animals met in several habitats are listed once, on their
  **primary** page, with `alsoIn`:
  - the moray: Aquarium, also in the Sea Cave;
  - the octopus: Outer Reef, also in the Sea Cave;
  - the turtle, blacktip, eagle ray and manta: Outer Reef, also at the Shipwreck;
  - the glassy sweeper and whitetip: Sea Cave, also at the Shipwreck.
- **Order** is explicit in the registry (`PAGES`) and pinned by tests. A new species is appended,
  so existing slot positions never move.
- **Not album entries:**
  - places (`place:*`) and plants (`plant:*`), which stay in the journal and the tank catalog;
  - the aquarium's generic, unnamed nudibranchs and anemone, which are scenery, not a species
    identity.

## Duplicate review

| Species          | Finding                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Spanish shawl    | One entry, `species:spanish-shawl` (_Flabellina iodinea_, kelp forest). Reused                                                                               |
| Sea angel        | One entry, `species:sea-angel` (_Clione_, Antarctic). Reused                                                                                                 |
| Giant isopod     | One entry, `species:giant-isopod`: the **Antarctic** isopod (about 18 cm). A deep-sea _Bathynomus_, if approved, gets a new ID; this one is never repurposed |
| Frogfish         | One entry, `species:frogfish` (aquarium resident)                                                                                                            |
| Seahorse         | One entry, `species:seahorse` (aquarium resident)                                                                                                            |
| Octopus          | One entry, `species:octopus` (day octopus): Outer Reef, also in the Sea Cave                                                                                 |
| Nudibranchs      | The Spanish shawl is the only named species. The tank's five are generic and unnamed, so there is no entry, to avoid an unverified identity                  |
| Moray            | The tank's resident and the cave's moray are one animal (the same model): `species:moray-eel`                                                                |
| Weddell seal pup | Kept as its own entry, as in the journal. Whether it should be a stage of the Weddell seal is still open                                                     |

## Current slots (96)

| Section     | Slots | Discovered from the start |
| ----------- | ----- | ------------------------- |
| Aquarium    | 9     | 9 (the residents)         |
| Outer Reef  | 26    | 0                         |
| Kelp Forest | 14    | 0                         |
| Shipwreck   | 1     | 0                         |
| Sea Cave    | 14    | 0                         |
| Antarctic   | 32    | 0                         |

The Shipwreck page is thin. Most of its animals have their primary page elsewhere.

### Aquarium (9)

| #   | ID                            | Name                | Discovered by | Rarity | Also in  | Model                     | Tank                |
| --- | ----------------------------- | ------------------- | ------------- | ------ | -------- | ------------------------- | ------------------- |
| 1   | `species:blue-green-chromis`  | Blue-green chromis  | home          | common | —        | fish: `chromis`           | resident            |
| 2   | `species:ocellaris-clownfish` | Ocellaris clownfish | home          | common | —        | fish: `clownfish`         | resident            |
| 3   | `species:royal-gramma`        | Royal gramma        | home          | common | —        | fish: `gramma`            | resident            |
| 4   | `species:yellow-assessor`     | Yellow assessor     | home          | common | —        | fish: `assessor`          | resident            |
| 5   | `species:firefish-goby`       | Firefish            | home          | common | —        | fish: `firefish`          | resident            |
| 6   | `species:pajama-cardinalfish` | Pajama cardinalfish | home          | common | —        | fish: `cardinalfish`      | resident            |
| 7   | `species:seahorse`            | Seahorse            | home          | common | —        | asset: `anchored` (nodes) | resident            |
| 8   | `species:frogfish`            | Frogfish            | home          | common | —        | asset: `anchored` (nodes) | resident            |
| 9   | `species:moray-eel`           | Moray eel           | home          | common | Sea Cave | asset: `anchored` (nodes) | animal: `moray-eel` |

### Outer Reef (26)

| #   | ID                                | Name                    | Discovered by | Rarity   | Also in   | Model                             | Tank                                  |
| --- | --------------------------------- | ----------------------- | ------------- | -------- | --------- | --------------------------------- | ------------------------------------- |
| 1   | `coral:branching`                 | Branching coral         | sighting      | common   | —         | reef: `Coral_Branching_0`         | decoration: branching, branching-tall |
| 2   | `coral:boulder`                   | Boulder coral           | sighting      | common   | —         | reef: `Coral_Massive_0`           | decoration: boulder                   |
| 3   | `coral:plate`                     | Plate coral             | sighting      | common   | —         | reef: `Coral_Plate_0`             | decoration: plate, plate-tiered       |
| 4   | `coral:soft`                      | Soft coral              | sighting      | common   | —         | reef: `Soft_Coral_0`              | decoration: soft                      |
| 5   | `coral:sea-fan`                   | Sea fan                 | sighting      | common   | —         | reef: `Sea_Fan_0`                 | decoration: sea-fan                   |
| 6   | `species:christmas-tree-worm`     | Christmas tree worms    | sighting      | common   | —         | procedural: `christmas-tree-worm` | animal: `christmas-tree-worm`         |
| 7   | `species:blue-tang`               | Blue tang               | sighting      | common   | —         | fish: `blueTang`                  | fish: `blue-tang`                     |
| 8   | `species:threadfin-butterflyfish` | Threadfin butterflyfish | sighting      | common   | —         | fish: `butterflyfish`             | fish: `threadfin-butterflyfish`       |
| 9   | `species:moorish-idol`            | Moorish idol            | sighting      | common   | —         | fish: `moorishIdol`               | fish: `moorish-idol`                  |
| 10  | `species:longfin-bannerfish`      | Longfin bannerfish      | sighting      | common   | —         | fish: `bannerfish`                | fish: `longfin-bannerfish`            |
| 11  | `species:cleaner-wrasse`          | Cleaner wrasse          | sighting      | common   | —         | fish: `firefish` tinted           | fish: `cleaner-wrasse`                |
| 12  | `species:parrotfish`              | Bumphead parrotfish     | sighting      | common   | —         | fish: `parrotfish`                | fish: `parrotfish`                    |
| 13  | `species:humphead-wrasse`         | Humphead wrasse         | sighting      | common   | —         | fish: `humpheadWrasse`            | fish: `humphead-wrasse`               |
| 14  | `species:bigeye-trevally`         | Bigeye trevally         | sighting      | common   | —         | fish: `trevally`                  | fish: `bigeye-trevally`               |
| 15  | `species:great-barracuda`         | Great barracuda         | sighting      | common   | —         | fish: `barracuda`                 | fish: `great-barracuda`               |
| 16  | `species:octopus`                 | Day octopus             | sighting      | common   | Sea Cave  | procedural: `octopus`             | animal: `octopus`                     |
| 17  | `species:green-sea-turtle`        | Green sea turtle        | sighting      | common   | Shipwreck | asset: `seaTurtle`                | animal: `green-sea-turtle`            |
| 18  | `species:blacktip-reef-shark`     | Blacktip reef shark     | sighting      | common   | Shipwreck | asset: `reefShark`                | animal: `blacktip-reef-shark`         |
| 19  | `species:spotted-eagle-ray`       | Spotted eagle ray       | sighting      | common   | Shipwreck | asset: `eagleRay`                 | animal: `spotted-eagle-ray`           |
| 20  | `species:manta-ray`               | Reef manta ray          | sighting      | uncommon | Shipwreck | asset: `mantaRay`                 | animal: `manta-ray`                   |
| 21  | `species:great-hammerhead`        | Great hammerhead        | sighting      | uncommon | —         | asset: `hammerhead`               | animal: `great-hammerhead`            |
| 22  | `species:scalloped-hammerhead`    | Scalloped hammerhead    | sighting      | uncommon | —         | asset: `hammerhead`               | animal: `scalloped-hammerhead`        |
| 23  | `species:whale-shark`             | Whale shark             | sighting      | uncommon | —         | asset: `whaleShark`               | animal: `whale-shark`                 |
| 24  | `species:humpback-whale`          | Humpback whale          | sighting      | uncommon | —         | asset: `humpbackWhale`            | animal: `humpback-whale`              |
| 25  | `species:ocean-sunfish`           | Ocean sunfish           | sighting      | uncommon | —         | asset: `sunfish`                  | animal: `ocean-sunfish`               |
| 26  | `species:great-white-shark`       | Great white shark       | sighting      | uncommon | —         | asset: `greatWhite`               | animal: `great-white-shark`           |

### Kelp Forest (14)

| #   | ID                             | Name                     | Discovered by | Rarity | Also in | Model                       | Tank                          |
| --- | ------------------------------ | ------------------------ | ------------- | ------ | ------- | --------------------------- | ----------------------------- |
| 1   | `species:garibaldi`            | Garibaldi                | sighting      | common | —       | fish: `chromis` tinted      | fish: `garibaldi`             |
| 2   | `species:blacksmith`           | Blacksmith               | sighting      | common | —       | fish: `chromis` tinted      | fish: `blacksmith`            |
| 3   | `species:senorita`             | Señorita                 | sighting      | common | —       | fish: `chromis` tinted      | fish: `senorita`              |
| 4   | `species:kelp-bass`            | Kelp bass                | sighting      | common | —       | fish: `chromis` tinted      | fish: `kelp-bass`             |
| 5   | `species:california-sheephead` | California sheephead     | sighting      | common | —       | fish: `sheephead`           | fish: `california-sheephead`  |
| 6   | `species:giant-sea-bass`       | Giant sea bass           | sighting      | common | —       | fish: `giantSeaBass`        | fish: `giant-sea-bass`        |
| 7   | `species:spanish-shawl`        | Spanish shawl nudibranch | sighting      | common | —       | procedural: `spanish-shawl` | animal: `spanish-shawl`       |
| 8   | `species:kelp-crab`            | Kelp crab                | sighting      | common | —       | procedural: `kelp-crab`     | animal: `kelp-crab`           |
| 9   | `species:leopard-shark`        | Leopard shark            | sighting      | common | —       | asset: `leopardShark`       | animal: `leopard-shark`       |
| 10  | `species:bat-ray`              | Bat ray                  | sighting      | common | —       | asset: `eagleRay` tinted    | animal: `bat-ray`             |
| 11  | `species:sea-otter`            | Sea otter                | sighting      | common | —       | asset: `seaOtter`           | animal: `sea-otter`           |
| 12  | `species:harbour-seal`         | Harbour seal             | sighting      | common | —       | asset: `harbourSeal`        | animal: `harbour-seal`        |
| 13  | `species:california-sea-lion`  | California sea lion      | sighting      | common | —       | asset: `seaLion`            | animal: `california-sea-lion` |
| 14  | `species:western-gull`         | Western gull             | sighting      | common | —       | asset: `westernGull`        | animal: `western-gull`        |

### Shipwreck (1)

| #   | ID                           | Name               | Discovered by | Rarity | Also in | Model                | Tank                       |
| --- | ---------------------------- | ------------------ | ------------- | ------ | ------- | -------------------- | -------------------------- |
| 1   | `species:queensland-grouper` | Queensland grouper | sighting      | common | —       | fish: `giantSeaBass` | fish: `queensland-grouper` |

### Sea Cave (14)

| #   | ID                            | Name                | Discovered by | Rarity | Also in   | Model                           | Tank                          |
| --- | ----------------------------- | ------------------- | ------------- | ------ | --------- | ------------------------------- | ----------------------------- |
| 1   | `species:encrusting-sponge`   | Encrusting sponges  | sighting      | common | —         | procedural: `encrusting-sponge` | animal: `encrusting-sponge`   |
| 2   | `species:tube-sponge`         | Tube sponges        | sighting      | common | —         | procedural: `tube-sponge`       | animal: `tube-sponge`         |
| 3   | `species:sea-squirt`          | Sea squirts         | sighting      | common | —         | procedural: `sea-squirt`        | animal: `sea-squirt`          |
| 4   | `species:mysid`               | Mysids              | sighting      | common | —         | procedural: `mysid`             | animal: `mysid`               |
| 5   | `species:cleaner-shrimp`      | Cleaner shrimp      | sighting      | common | —         | procedural: `cleaner-shrimp`    | animal: `cleaner-shrimp`      |
| 6   | `species:spiny-lobster`       | Spiny lobster       | sighting      | common | —         | procedural: `spiny-lobster`     | animal: `spiny-lobster`       |
| 7   | `species:rock-crab`           | Rock crab           | sighting      | common | —         | procedural: `rock-crab`         | animal: `rock-crab`           |
| 8   | `species:glassy-sweeper`      | Glassy sweeper      | sighting      | common | Shipwreck | fish: `chromis` tinted          | fish: `glassy-sweeper`        |
| 9   | `species:soldierfish`         | Soldierfish         | sighting      | common | —         | fish: `chromis` tinted          | fish: `soldierfish`           |
| 10  | `species:flashlight-fish`     | Flashlight fish     | sighting      | common | —         | fish: `chromis` tinted          | fish: `flashlight-fish`       |
| 11  | `species:lionfish`            | Lionfish            | sighting      | common | —         | procedural: `lionfish`          | animal: `lionfish`            |
| 12  | `species:whitetip-reef-shark` | Whitetip reef shark | sighting      | common | Shipwreck | asset: `whitetipShark`          | animal: `whitetip-reef-shark` |
| 13  | `species:swell-shark`         | Swell shark         | sighting      | common | —         | asset: `nurseShark` tinted      | animal: `swell-shark`         |
| 14  | `species:nurse-shark`         | Nurse shark         | sighting      | common | —         | asset: `nurseShark`             | animal: `nurse-shark`         |

### Antarctic (32)

| #   | ID                             | Name                 | Discovered by | Rarity | Also in | Model                              | Tank                           |
| --- | ------------------------------ | -------------------- | ------------- | ------ | ------- | ---------------------------------- | ------------------------------ |
| 1   | `species:sea-angel`            | Sea angels           | sighting      | common | —       | procedural: `sea-angel`            | animal: `sea-angel`            |
| 2   | `species:sea-butterfly`        | Sea butterfly        | sighting      | common | —       | procedural: `sea-butterfly`        | animal: `sea-butterfly`        |
| 3   | `species:comb-jelly`           | Comb jelly           | sighting      | common | —       | procedural: `comb-jelly`           | animal: `comb-jelly`           |
| 4   | `species:antarctic-jellyfish`  | Antarctic jellyfish  | sighting      | common | —       | procedural: `antarctic-jellyfish`  | animal: `antarctic-jellyfish`  |
| 5   | `species:salp`                 | Salp chain           | sighting      | common | —       | procedural: `salp`                 | animal: `salp`                 |
| 6   | `species:antarctic-krill`      | Antarctic krill      | sighting      | common | —       | procedural: `antarctic-krill`      | animal: `antarctic-krill`      |
| 7   | `species:glass-sponge`         | Glass sponge         | sighting      | common | —       | procedural: `glass-sponge`         | animal: `glass-sponge`         |
| 8   | `species:antarctic-soft-coral` | Antarctic soft coral | sighting      | common | —       | procedural: `antarctic-soft-coral` | animal: `antarctic-soft-coral` |
| 9   | `species:antarctic-anemone`    | Antarctic anemone    | sighting      | common | —       | procedural: `antarctic-anemone`    | animal: `antarctic-anemone`    |
| 10  | `species:sea-pen`              | Sea pen              | sighting      | common | —       | procedural: `sea-pen`              | animal: `sea-pen`              |
| 11  | `species:feather-star`         | Feather star         | sighting      | common | —       | procedural: `feather-star`         | animal: `feather-star`         |
| 12  | `species:antarctic-sea-star`   | Antarctic sea star   | sighting      | common | —       | procedural: `antarctic-sea-star`   | animal: `antarctic-sea-star`   |
| 13  | `species:brittle-star`         | Brittle star         | sighting      | common | —       | procedural: `brittle-star`         | animal: `brittle-star`         |
| 14  | `species:antarctic-sea-urchin` | Antarctic sea urchin | sighting      | common | —       | procedural: `antarctic-sea-urchin` | animal: `antarctic-sea-urchin` |
| 15  | `species:sea-cucumber`         | Sea cucumber         | sighting      | common | —       | procedural: `sea-cucumber`         | animal: `sea-cucumber`         |
| 16  | `species:antarctic-scallop`    | Antarctic scallop    | sighting      | common | —       | procedural: `antarctic-scallop`    | animal: `antarctic-scallop`    |
| 17  | `species:giant-isopod`         | Giant isopod         | sighting      | common | —       | procedural: `giant-isopod`         | animal: `giant-isopod`         |
| 18  | `species:giant-sea-spider`     | Giant sea spider     | sighting      | common | —       | procedural: `giant-sea-spider`     | animal: `giant-sea-spider`     |
| 19  | `species:ribbon-worm`          | Ribbon worm          | sighting      | common | —       | procedural: `ribbon-worm`          | animal: `ribbon-worm`          |
| 20  | `species:antarctic-silverfish` | Antarctic silverfish | sighting      | common | —       | fish: `chromis` tinted             | fish: `antarctic-silverfish`   |
| 21  | `species:blackfin-icefish`     | Icefish              | sighting      | common | —       | fish: `icefish`                    | fish: `blackfin-icefish`       |
| 22  | `species:bald-notothen`        | Bald notothen        | sighting      | common | —       | fish: `notothen`                   | fish: `bald-notothen`          |
| 23  | `species:antarctic-toothfish`  | Antarctic toothfish  | sighting      | rare   | —       | fish: `toothfish`                  | fish: `antarctic-toothfish`    |
| 24  | `species:colossal-squid`       | Colossal squid       | sighting      | rare   | —       | procedural: `colossal-squid`       | animal: `colossal-squid`       |
| 25  | `species:emperor-penguin`      | Emperor penguin      | sighting      | common | —       | asset: `emperorPenguin`            | animal: `emperor-penguin`      |
| 26  | `species:adelie-penguin`       | Adélie penguin       | sighting      | common | —       | asset: `adeliePenguin`             | animal: `adelie-penguin`       |
| 27  | `species:weddell-seal`         | Weddell seal         | sighting      | common | —       | asset: `weddellSeal`               | animal: `weddell-seal`         |
| 28  | `species:weddell-seal-pup`     | Weddell seal pup     | sighting      | common | —       | asset: `harbourSeal` tinted        | animal: `weddell-seal-pup`     |
| 29  | `species:leopard-seal`         | Leopard seal         | sighting      | rare   | —       | asset: `leopardSeal`               | animal: `leopard-seal`         |
| 30  | `species:killer-whale`         | Killer whale         | sighting      | rare   | —       | asset: `killerWhale`               | animal: `killer-whale`         |
| 31  | `species:minke-whale`          | Minke whale          | sighting      | rare   | —       | asset: `minkeWhale`                | animal: `minke-whale`          |
| 32  | `species:polar-bear`           | Polar bear           | sighting      | rare   | —       | asset: `polarBear`                 | animal: `polar-bear`           |

## Planned slots

- **The 22 approved rare species.** The list has not been provided, so none is registered. Each will
  get a new `species:` ID (unless it is the same binomial as an existing entry) and is appended to
  its habitat's page.
- **Tank save version 4.** This is needed before any new animal kind can be placed in the tank (the
  collection audit, section 6). New rare species that are album-only need none.
