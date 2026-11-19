import type { AssetId } from '../assets/AssetRegistry';
import type { SpeciesId } from '../fish/FishSpecies';

/**
 * v0.6 Pass 051: fish that can be added to the home tank, and fish that cannot.
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
    length: 0.9,
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
    length: 1,
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
    length: 0.7,
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
    length: 1,
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
];
/** Room for added fish in all (simulation and rendering budget). */
export const TANK_FISH_CAP = 24;

/**
 * Fish the swimmer may have seen that do not suit the home tank, with a gentle reason. Shown
 * (once seen) so that the catalog explains rather than silently omits.
 */
export interface UnsuitedFish {
  /** Journal id, or `null` for one of the tank's own species. */
  readonly sighting: string | null;
  readonly label: string;
  readonly reason: string;
}
const dark = 'Needs the dark of a sea cave.',
  polar = 'Lives in freezing polar water.';
export const UNSUITED_FISH: readonly UnsuitedFish[] = [
  {
    sighting: 'species:flashlight-fish',
    label: 'Flashlight fish',
    reason: dark,
  },
  { sighting: 'species:blackfin-icefish', label: 'Icefish', reason: polar },
  { sighting: 'species:bald-notothen', label: 'Bald notothen', reason: polar },
];
