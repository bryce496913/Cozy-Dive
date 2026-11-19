import type { AssetId } from '../assets/AssetRegistry';
import type { SpeciesId } from '../fish/FishSpecies';

/**
 * v0.6 Pass 051: fish collected in the home tank at aquarium size.
 *
 * - **Schooling** fish join the tank's own school of their kind (or form a small new group when
 *   the tank has none), so several can be added.
 * - **Individual** aquarium fish keep to a territory of their own: only a few, and pairs where
 *   the species lives in pairs.
 *
 * The tank's own species are offered from the start (they already live there); the outer reef's
 * are offered once seen. There is no currency or cost: only room in the tank.
 */
export type TankFishGroup = 'schooling' | 'individual';
export interface TankFishDefinition {
  readonly species: SpeciesId;
  readonly label: string;
  readonly group: TankFishGroup;
  /** Journal id that unlocks it, or `null` for the tank's own species (always offered). */
  readonly sighting: string | null;
  /** Most of this kind that can be added (on top of the tank's own). */
  readonly max: number;
  /** The authored rig it swims as (shared with the tank or the outer reef). */
  readonly asset: AssetId;
  /** A short, calm line shown in the catalog. */
  readonly note: string;
  /**
   * Playtest: its body length in the tank (m), so the big and the cool-water fish are added at a
   * size that suits the tank; omitted keeps the species' own length.
   */
  readonly length?: number;
  /** Body length its model was built at (m), when the species has no swimming entry of its own. */
  readonly modelLength?: number;
  /** One colour on a shared rig (the kelp and cave fish swim as recoloured chromis). */
  readonly tint?: number;
}
export const TANK_FISH: readonly TankFishDefinition[] = [
  {
    species: 'blue-green-chromis',
    label: 'Blue-green chromis',
    group: 'schooling',
    sighting: null,
    max: 12,
    asset: 'chromis',
    note: 'Joins the chromis school.',
  },
  {
    species: 'pajama-cardinalfish',
    label: 'Pajama cardinalfish',
    group: 'schooling',
    sighting: null,
    max: 6,
    asset: 'cardinalfish',
    note: 'Joins the cardinalfish in the shade of the rocks.',
  },
  {
    species: 'blue-tang',
    label: 'Blue tang',
    group: 'schooling',
    sighting: 'species:blue-tang',
    max: 3,
    asset: 'blueTang',
    note: 'A small group that roams the open water.',
  },
  {
    species: 'firefish-goby',
    label: 'Firefish',
    group: 'individual',
    sighting: null,
    max: 4,
    asset: 'firefish',
    note: 'Hovers near a home of its own on the sand.',
  },
  {
    species: 'yellow-assessor',
    label: 'Yellow assessor',
    group: 'individual',
    sighting: null,
    max: 2,
    asset: 'assessor',
    note: 'Keeps to a ledge of its own.',
  },
  {
    species: 'royal-gramma',
    label: 'Royal gramma',
    group: 'individual',
    sighting: null,
    max: 2,
    asset: 'gramma',
    note: 'Keeps to a cave of its own.',
  },
  {
    species: 'threadfin-butterflyfish',
    label: 'Threadfin butterflyfish',
    group: 'individual',
    sighting: 'species:threadfin-butterflyfish',
    max: 2,
    asset: 'butterflyfish',
    note: 'Lives in a pair.',
  },
  {
    species: 'moorish-idol',
    label: 'Moorish idol',
    group: 'individual',
    sighting: 'species:moorish-idol',
    max: 2,
    asset: 'moorishIdol',
    note: 'Lives in a pair.',
  },
  // Playtest: everything seen out there can come home, at a size that suits the tank.
  {
    species: 'ocellaris-clownfish',
    label: 'Ocellaris clownfish',
    group: 'individual',
    sighting: null,
    max: 2,
    asset: 'clownfish',
    note: 'A pair that roams the tank, beyond the anemone family.',
  },
  {
    species: 'parrotfish',
    label: 'Bumphead parrotfish',
    group: 'individual',
    sighting: 'species:parrotfish',
    max: 1,
    asset: 'parrotfish',
    note: 'A small one, grazing slowly over the rocks.',
    length: 0.5,
    modelLength: 1.1,
  },
  {
    species: 'humphead-wrasse',
    label: 'Humphead wrasse',
    group: 'individual',
    sighting: 'species:humphead-wrasse',
    max: 1,
    asset: 'humpheadWrasse',
    note: 'A young one, curious and unhurried.',
    length: 0.55,
    modelLength: 2.4,
  },
  {
    species: 'bigeye-trevally',
    label: 'Bigeye trevally',
    group: 'schooling',
    sighting: 'species:bigeye-trevally',
    max: 4,
    asset: 'trevally',
    note: 'A small silver group circling the open water.',
    length: 0.45,
    modelLength: 0.9,
  },
  {
    species: 'great-barracuda',
    label: 'Great barracuda',
    group: 'individual',
    sighting: 'species:great-barracuda',
    max: 1,
    asset: 'barracuda',
    note: 'A young one, hanging still in the open water.',
    length: 0.6,
    modelLength: 1.5,
  },
  {
    species: 'garibaldi',
    label: 'Garibaldi',
    group: 'individual',
    sighting: 'species:garibaldi',
    max: 2,
    asset: 'chromis',
    note: 'Keeps a patch of its own, bright orange.',
    length: 0.5,
    tint: 0xff6a12,
  },
  {
    species: 'kelp-bass',
    label: 'Kelp bass',
    group: 'individual',
    sighting: 'species:kelp-bass',
    max: 2,
    asset: 'chromis',
    note: 'Hangs in mid-water, olive-brown.',
    length: 0.6,
    tint: 0x7a6a45,
  },
  {
    species: 'blacksmith',
    label: 'Blacksmith',
    group: 'schooling',
    sighting: 'species:blacksmith',
    max: 6,
    asset: 'chromis',
    note: 'A loose dark-blue school.',
    length: 0.45,
    tint: 0x3f4d5e,
  },
  {
    species: 'senorita',
    label: 'Señorita',
    group: 'schooling',
    sighting: 'species:senorita',
    max: 4,
    asset: 'chromis',
    note: 'Slim and golden, busy near the sand.',
    length: 0.45,
    tint: 0xe0b23a,
  },
  {
    species: 'glassy-sweeper',
    label: 'Glassy sweeper',
    group: 'schooling',
    sighting: 'species:glassy-sweeper',
    max: 8,
    asset: 'chromis',
    note: 'A coppery school that keeps to the shade.',
    length: 0.35,
    tint: 0xc98a4e,
  },
  {
    species: 'soldierfish',
    label: 'Soldierfish',
    group: 'schooling',
    sighting: 'species:soldierfish',
    max: 4,
    asset: 'chromis',
    note: 'Red and big-eyed, lingering by the rocks.',
    length: 0.45,
    tint: 0xc23a22,
  },
  {
    species: 'flashlight-fish',
    label: 'Flashlight fish',
    group: 'schooling',
    sighting: 'species:flashlight-fish',
    max: 4,
    asset: 'chromis',
    note: 'A little reminder of your discovery.',
    length: 0.3,
    tint: 3293266,
  },
  {
    species: 'blackfin-icefish',
    label: 'Icefish',
    group: 'schooling',
    sighting: 'species:blackfin-icefish',
    max: 4,
    asset: 'icefish',
    note: 'A little reminder of your discovery.',
    length: 0.45,
    modelLength: 0.75,
  },
  {
    species: 'bald-notothen',
    label: 'Bald notothen',
    group: 'schooling',
    sighting: 'species:bald-notothen',
    max: 4,
    asset: 'notothen',
    note: 'A little reminder of your discovery.',
    length: 0.35,
    modelLength: 0.42,
  },
  {
    species: 'antarctic-silverfish',
    label: 'Antarctic silverfish',
    group: 'schooling',
    sighting: 'species:antarctic-silverfish',
    max: 4,
    asset: 'chromis',
    note: 'A little reminder of your discovery.',
    length: 0.3,
    tint: 12113119,
  },
  {
    species: 'antarctic-toothfish',
    label: 'Antarctic toothfish',
    group: 'schooling',
    sighting: 'species:antarctic-toothfish',
    max: 4,
    asset: 'toothfish',
    note: 'A little reminder of your discovery.',
    length: 0.6,
    modelLength: 1.7,
  },
  {
    species: 'giant-sea-bass',
    label: 'Giant sea bass',
    group: 'schooling',
    sighting: 'species:giant-sea-bass',
    max: 4,
    asset: 'giantSeaBass',
    note: 'A little reminder of your discovery.',
    length: 0.6,
    modelLength: 2.2,
  },
  {
    species: 'california-sheephead',
    label: 'California sheephead',
    group: 'schooling',
    sighting: 'species:california-sheephead',
    max: 4,
    asset: 'sheephead',
    note: 'A little reminder of your discovery.',
    length: 0.5,
    modelLength: 0.95,
  },
  {
    species: 'longfin-bannerfish',
    label: 'Longfin bannerfish',
    group: 'schooling',
    sighting: 'species:longfin-bannerfish',
    max: 4,
    asset: 'bannerfish',
    note: 'A little reminder of your discovery.',
    length: 0.5,
    modelLength: 0.7,
  },
  {
    species: 'cleaner-wrasse',
    label: 'Cleaner wrasse',
    group: 'individual',
    sighting: 'species:cleaner-wrasse',
    max: 3,
    asset: 'chromis',
    note: 'A tiny blue cleaner from the reef.',
    length: 0.22,
    tint: 0x65aad9,
  },
];
/** Room for added fish in all (simulation and rendering budget). */
export const TANK_FISH_CAP = TANK_FISH.reduce((sum, fish) => sum + fish.max, 0);
