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
const tooBig = 'Grows too big for the tank.',
  cool = 'Lives in cool kelp-forest water.',
  dark = 'Needs the dark of a sea cave.',
  polar = 'Lives in freezing polar water.';
export const UNSUITED_FISH: readonly UnsuitedFish[] = [
  {
    sighting: null,
    label: 'Ocellaris clownfish',
    reason: 'The anemone already hosts its clownfish family.',
  },
  {
    sighting: 'species:parrotfish',
    label: 'Bumphead parrotfish',
    reason: tooBig,
  },
  {
    sighting: 'species:humphead-wrasse',
    label: 'Humphead wrasse',
    reason: tooBig,
  },
  {
    sighting: 'species:bigeye-trevally',
    label: 'Bigeye trevally',
    reason: tooBig,
  },
  {
    sighting: 'species:great-barracuda',
    label: 'Great barracuda',
    reason: tooBig,
  },
  { sighting: 'species:garibaldi', label: 'Garibaldi', reason: cool },
  { sighting: 'species:kelp-bass', label: 'Kelp bass', reason: cool },
  { sighting: 'species:blacksmith', label: 'Blacksmith', reason: cool },
  { sighting: 'species:senorita', label: 'Señorita', reason: cool },
  { sighting: 'species:glassy-sweeper', label: 'Glassy sweeper', reason: dark },
  { sighting: 'species:soldierfish', label: 'Soldierfish', reason: dark },
  {
    sighting: 'species:flashlight-fish',
    label: 'Flashlight fish',
    reason: dark,
  },
  { sighting: 'species:blackfin-icefish', label: 'Icefish', reason: polar },
  { sighting: 'species:bald-notothen', label: 'Bald notothen', reason: polar },
];
