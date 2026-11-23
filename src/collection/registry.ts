import type { AssetId } from '../assets/AssetRegistry';
import { TANK_BABIES, type BabyDefinition } from '../config/babies';
import { TANK_FISH } from '../config/tankFish';
import { TANK_ITEMS, type TankKind } from '../catalog/catalog';
import type { Sighting } from '../discovery/journal';
import { sightLabel } from '../discovery/sights';
import type { SpeciesId } from '../fish/FishSpecies';

/**
 * V0.8 Pass 098: the unified marine-life album's data layer (designed in the collection audit,
 * docs/V08_COLLECTION_ARCHITECTURE.md). One canonical entry per distinct animal, grouped by the
 * habitat it is first found in, in a stable slot order.
 *
 * - **Identity.** An entry's `id` is its existing journal sighting id, verbatim, so every saved
 *   journal populates the album as it stands (no migration). The aquarium's own residents have
 *   never needed a sighting: they are `home` entries, discovered from the start.
 * - **Discovery** is read from the journal alone, independent of where the swimmer is or what the
 *   tank holds. Nothing here writes saves.
 * - **Mystery slots.** An unseen entry's page slot carries only its position: no id, name, model
 *   or rarity, so nothing unearned reaches the UI.
 * - **Tank.** An entry names its existing tank save key; only a discovered entry may be added.
 *
 * Not album entries: places (`place:*`) and plants (`plant:*`), which stay in the journal and the
 * tank catalog as they are; the aquarium's generic, unnamed nudibranchs and anemone (scenery, not a
 * species identity).
 */

/** The album's sections, in page order: the six water environments. */
export const ALBUM_SECTIONS = [
  'aquarium',
  'outer-reef',
  'kelp-forest',
  'shipwreck',
  'sea-cave',
  'antarctic',
] as const;
export type AlbumSection = (typeof ALBUM_SECTIONS)[number];
export const SECTION_NAMES: Readonly<Record<AlbumSection, string>> = {
  aquarium: 'Aquarium',
  'outer-reef': 'Outer Reef',
  'kelp-forest': 'Kelp Forest',
  shipwreck: 'Shipwreck',
  'sea-cave': 'Sea Cave',
  antarctic: 'Antarctic',
};

export type Rarity = 'common' | 'uncommon' | 'rare';
export type Motion = 'swim' | 'school' | 'glide' | 'crawl' | 'drift' | 'still';

/** Where the one model for this animal comes from (wild, card and tank all use it). */
export type ModelSource =
  | {
      readonly type: 'asset';
      readonly asset: AssetId;
      readonly nodes?: readonly string[];
      readonly tint?: number;
    }
  | { readonly type: 'fish'; readonly asset: AssetId; readonly tint?: number }
  | { readonly type: 'procedural'; readonly shape: string }
  | { readonly type: 'reef'; readonly node: string };

/** The tank save key an entry places under (unchanged from the existing tank catalog). */
export type TankReference =
  | { readonly slot: 'animal'; readonly key: BabyDefinition['id'] }
  | { readonly slot: 'fish'; readonly key: SpeciesId }
  | { readonly slot: 'decoration'; readonly kinds: readonly TankKind[] };

export interface CollectionEntry {
  /** Canonical and stable: the journal sighting id (or a `species:` id for home residents). */
  readonly id: string;
  readonly name: string;
  /** Primary habitat (its album page) and any others it is also met in. */
  readonly section: AlbumSection;
  readonly alsoIn: readonly AlbumSection[];
  /** Position on its page (0-based, stable). */
  readonly order: number;
  /** `home`: lives in the aquarium from the start; `sighting`: discovered when this id is seen. */
  readonly discovery: 'home' | 'sighting';
  readonly rarity: Rarity;
  readonly model: ModelSource;
  readonly motion: Motion;
  /** How it joins the tank, if it can (home residents are already there). */
  readonly tank?: TankReference;
}

/** Each page's slots, in their stable order: [id, also met in]. */
const PAGES: Readonly<
  Record<AlbumSection, readonly (readonly [string, AlbumSection[]?])[]>
> = {
  aquarium: [
    ['species:blue-green-chromis'],
    ['species:ocellaris-clownfish'],
    ['species:royal-gramma'],
    ['species:yellow-assessor'],
    ['species:firefish-goby'],
    ['species:pajama-cardinalfish'],
    ['species:seahorse'],
    ['species:frogfish'],
    // The tank's moray and the cave's are one animal (the same model and species).
    ['species:moray-eel', ['sea-cave']],
  ],
  'outer-reef': [
    ['coral:branching'],
    ['coral:boulder'],
    ['coral:plate'],
    ['coral:soft'],
    ['coral:sea-fan'],
    ['species:christmas-tree-worm'],
    ['species:blue-tang'],
    ['species:threadfin-butterflyfish'],
    ['species:moorish-idol'],
    ['species:longfin-bannerfish'],
    ['species:cleaner-wrasse'],
    ['species:parrotfish'],
    ['species:humphead-wrasse'],
    ['species:bigeye-trevally'],
    ['species:great-barracuda'],
    ['species:octopus', ['sea-cave']],
    ['species:green-sea-turtle', ['shipwreck']],
    ['species:blacktip-reef-shark', ['shipwreck']],
    ['species:spotted-eagle-ray', ['shipwreck']],
    ['species:manta-ray', ['shipwreck']],
    ['species:great-hammerhead'],
    ['species:scalloped-hammerhead'],
    ['species:whale-shark'],
    ['species:humpback-whale'],
    ['species:ocean-sunfish'],
    ['species:great-white-shark'],
  ],
  'kelp-forest': [
    ['species:garibaldi'],
    ['species:blacksmith'],
    ['species:senorita'],
    ['species:kelp-bass'],
    ['species:california-sheephead'],
    ['species:giant-sea-bass'],
    ['species:spanish-shawl'],
    ['species:kelp-crab'],
    ['species:leopard-shark'],
    ['species:bat-ray'],
    ['species:sea-otter'],
    ['species:harbour-seal'],
    ['species:california-sea-lion'],
    ['species:western-gull'],
  ],
  shipwreck: [['species:queensland-grouper']],
  'sea-cave': [
    ['species:encrusting-sponge'],
    ['species:tube-sponge'],
    ['species:sea-squirt'],
    ['species:mysid'],
    ['species:cleaner-shrimp'],
    ['species:spiny-lobster'],
    ['species:rock-crab'],
    ['species:glassy-sweeper', ['shipwreck']],
    ['species:soldierfish'],
    ['species:flashlight-fish'],
    ['species:lionfish'],
    ['species:whitetip-reef-shark', ['shipwreck']],
    ['species:swell-shark'],
    ['species:nurse-shark'],
  ],
  antarctic: [
    ['species:sea-angel'],
    ['species:sea-butterfly'],
    ['species:comb-jelly'],
    ['species:antarctic-jellyfish'],
    ['species:salp'],
    ['species:antarctic-krill'],
    ['species:glass-sponge'],
    ['species:antarctic-soft-coral'],
    ['species:antarctic-anemone'],
    ['species:sea-pen'],
    ['species:feather-star'],
    ['species:antarctic-sea-star'],
    ['species:brittle-star'],
    ['species:antarctic-sea-urchin'],
    ['species:sea-cucumber'],
    ['species:antarctic-scallop'],
    ['species:giant-isopod'],
    ['species:giant-sea-spider'],
    ['species:ribbon-worm'],
    ['species:antarctic-silverfish'],
    ['species:blackfin-icefish'],
    ['species:bald-notothen'],
    ['species:antarctic-toothfish'],
    ['species:colossal-squid'],
    ['species:emperor-penguin'],
    ['species:adelie-penguin'],
    ['species:weddell-seal'],
    ['species:weddell-seal-pup'],
    ['species:leopard-seal'],
    ['species:killer-whale'],
    ['species:minke-whale'],
    ['species:polar-bear'],
  ],
};

/** The aquarium's own residents: not sighted, discovered from the start. */
const HOME: Readonly<
  Record<
    string,
    {
      readonly name: string;
      readonly model: ModelSource;
      readonly motion: Motion;
    }
  >
> = {
  'species:seahorse': {
    name: 'Seahorse',
    model: {
      type: 'asset',
      asset: 'anchored',
      nodes: ['Seahorse', 'HorseBody', 'HorseTail'],
    },
    motion: 'still',
  },
  'species:frogfish': {
    name: 'Frogfish',
    model: {
      type: 'asset',
      asset: 'anchored',
      nodes: ['FrogBody', 'FrogJaw', 'FrogLure', 'FrogFoot'],
    },
    motion: 'still',
  },
};

/** Occasional visitors (now and then, out in the blue or along the wall) and the rare ones. */
const RARITY: Readonly<Record<string, Rarity>> = {
  'species:manta-ray': 'uncommon',
  'species:great-hammerhead': 'uncommon',
  'species:scalloped-hammerhead': 'uncommon',
  'species:whale-shark': 'uncommon',
  'species:humpback-whale': 'uncommon',
  'species:ocean-sunfish': 'uncommon',
  'species:great-white-shark': 'uncommon',
  // v0.6 Pass 048: the Antarctic's rare encounters.
  'species:leopard-seal': 'rare',
  'species:minke-whale': 'rare',
  'species:killer-whale': 'rare',
  'species:antarctic-toothfish': 'rare',
  'species:colossal-squid': 'rare',
  'species:polar-bear': 'rare',
};

function build(
  id: string,
  section: AlbumSection,
  alsoIn: readonly AlbumSection[],
  order: number,
): CollectionEntry {
  const suffix = id.slice(id.indexOf(':') + 1),
    baby = TANK_BABIES.find((b) => b.sighting === id),
    fish = TANK_FISH.find(
      (f) => f.sighting === id || (f.sighting === null && f.species === suffix),
    ),
    items = TANK_ITEMS.filter((i) => i.sighting === id),
    home = HOME[id],
    rarity = RARITY[id] ?? 'common',
    base = { id, section, alsoIn, order, rarity };
  if (home)
    return {
      ...base,
      discovery: 'home',
      name: home.name,
      model: home.model,
      motion: home.motion,
    };
  if (fish)
    return {
      ...base,
      name: sightLabel(id) ?? fish.label,
      discovery: fish.sighting === null ? 'home' : 'sighting',
      model: {
        type: 'fish',
        asset: fish.asset,
        ...(fish.tint !== undefined ? { tint: fish.tint } : {}),
      },
      motion: fish.group === 'schooling' ? 'school' : 'swim',
      // Home fish may be added from the start (more of the tank's own), as in the catalog.
      tank: { slot: 'fish', key: fish.species },
    };
  if (baby)
    return {
      ...base,
      // The animal's own name, from the journal (the tank labels its juvenile, e.g. "pup").
      name: sightLabel(id) ?? baby.label,
      discovery: id === 'species:moray-eel' ? 'home' : 'sighting',
      model: baby.asset
        ? {
            type: 'asset',
            asset: baby.asset,
            ...(baby.nodes ? { nodes: baby.nodes } : {}),
            ...(baby.tint !== undefined ? { tint: baby.tint } : {}),
          }
        : { type: 'procedural', shape: baby.shape ?? baby.id },
      motion: baby.motion ?? (baby.asset ? 'swim' : 'still'),
      tank: { slot: 'animal', key: baby.id },
    };
  if (items.length)
    return {
      ...base,
      name: sightLabel(id) ?? items[0].label,
      discovery: 'sighting',
      model: { type: 'reef', node: items[0].node },
      motion: 'still',
      tank: { slot: 'decoration', kinds: items.map((i) => i.kind) },
    };
  throw Error(`Collection entry ${id} has no model source`);
}

/** Every album entry: section by section, slot by slot. */
export const COLLECTION: readonly CollectionEntry[] = ALBUM_SECTIONS.flatMap(
  (section) =>
    PAGES[section].map(([id, alsoIn], order) =>
      build(id, section, alsoIn ?? [], order),
    ),
);
export const collectionEntry = (id: string): CollectionEntry | undefined =>
  COLLECTION.find((e) => e.id === id);

/** Whether an entry is discovered: a home resident, or its sighting is in the journal. */
export function isDiscovered(
  entry: CollectionEntry,
  seen: readonly Sighting[],
): boolean {
  return entry.discovery === 'home' || seen.some((s) => s.id === entry.id);
}

/** A page's slot: a discovered entry (with its first sighting), or a mystery with nothing told. */
export type AlbumSlot =
  | {
      readonly kind: 'discovered';
      readonly order: number;
      readonly entry: CollectionEntry;
      /** ISO date first seen; absent for home residents. */
      readonly first?: string;
    }
  | { readonly kind: 'mystery'; readonly order: number };

/** One page of the album, in its stable slot order. */
export function albumPage(
  section: AlbumSection,
  seen: readonly Sighting[],
): readonly AlbumSlot[] {
  return COLLECTION.filter((e) => e.section === section).map((entry) => {
    if (!isDiscovered(entry, seen))
      return { kind: 'mystery', order: entry.order };
    const first = seen.find((s) => s.id === entry.id)?.first;
    return {
      kind: 'discovered',
      order: entry.order,
      entry,
      ...(first ? { first } : {}),
    };
  });
}

/** Discovered and total slots on a page. */
export function sectionProgress(
  section: AlbumSection,
  seen: readonly Sighting[],
): { readonly discovered: number; readonly total: number } {
  const page = COLLECTION.filter((e) => e.section === section);
  return {
    discovered: page.filter((e) => isDiscovered(e, seen)).length,
    total: page.length,
  };
}

/**
 * Whether an album entry may be added to the tank: something that can join it, once its sighting
 * is in the journal (exactly the existing tank catalog's rule; a mystery slot never can). The
 * moray lives in the tank from the start, and a little one may join once seen in the cave.
 */
export function canAddToTank(
  entry: CollectionEntry,
  seen: readonly Sighting[],
): boolean {
  return (
    !!entry.tank &&
    ((entry.tank.slot === 'fish' && entry.discovery === 'home') ||
      seen.some((s) => s.id === entry.id))
  );
}
