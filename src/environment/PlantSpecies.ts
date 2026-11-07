export type PlantSpeciesId =
  | 'turtle-grass'
  | 'caulerpa'
  | 'halimeda'
  | 'red-macroalgae'
  | 'soft-coral'
  | 'sea-fan'
  | 'turtle-grass-meadow';
export type HabitatRegionId =
  'rocky-bank' | 'background' | 'substrate-edge' | 'open-channel';
export interface PlantSpecies {
  readonly id: PlantSpeciesId;
  readonly name: string;
  readonly category: 'seagrass' | 'macroalgae' | 'coral';
  readonly count: number;
  readonly height: readonly [number, number];
  readonly leaves: readonly [number, number];
  readonly width: number;
  readonly reach: number;
  readonly color: number;
  readonly sway: number;
  readonly frequency: number;
  readonly region: HabitatRegionId;
  readonly broadLeaves: boolean;
}
export const PLANT_SPECIES: readonly PlantSpecies[] = [
  {
    id: 'turtle-grass',
    name: 'Turtle grass',
    category: 'seagrass',
    count: 16,
    height: [1.6, 2.8],
    leaves: [7, 11],
    width: 0.07,
    reach: 0.2,
    color: 0x638d64,
    sway: 0.072,
    frequency: 0.65,
    region: 'background',
    broadLeaves: false,
  },
  {
    id: 'caulerpa',
    name: 'Feather Caulerpa',
    category: 'macroalgae',
    count: 12,
    height: [0.8, 1.5],
    leaves: [4, 7],
    width: 0.22,
    reach: 0.28,
    color: 0x74a56b,
    sway: 0.023,
    frequency: 0.48,
    region: 'rocky-bank',
    broadLeaves: false,
  },
  {
    id: 'red-macroalgae',
    name: 'Red branching macroalgae',
    category: 'macroalgae',
    count: 12,
    height: [0.7, 1.5],
    leaves: [4, 7],
    width: 0.08,
    reach: 0.3,
    color: 0x9a6264,
    sway: 0.037,
    frequency: 0.57,
    region: 'rocky-bank',
    broadLeaves: false,
  },
  {
    id: 'halimeda',
    name: 'Halimeda segmented algae',
    category: 'macroalgae',
    count: 10,
    height: [0.5, 1],
    leaves: [4, 6],
    width: 0.3,
    reach: 0.3,
    color: 0x78976c,
    sway: 0.006,
    frequency: 0.38,
    region: 'rocky-bank',
    broadLeaves: true,
  },
  {
    id: 'soft-coral',
    name: 'Finger leather coral',
    category: 'coral',
    count: 8,
    height: [0.6, 1.1],
    leaves: [5, 8],
    width: 0.2,
    reach: 0.42,
    color: 0xb78e8a,
    sway: 0.022,
    frequency: 0.5,
    region: 'rocky-bank',
    broadLeaves: false,
  },
  {
    id: 'sea-fan',
    name: 'Sea fan gorgonian',
    category: 'coral',
    count: 7,
    height: [1.0, 1.7],
    leaves: [5, 7],
    width: 0.035,
    reach: 0.42,
    color: 0xaa819d,
    sway: 0.025,
    frequency: 0.43,
    region: 'rocky-bank',
    broadLeaves: false,
  },
];
export const PLANT_TEMPLATES = 3;
export const MEADOW_GRASS: PlantSpecies = {
  id: 'turtle-grass-meadow',
  name: 'Tropical seagrass meadow',
  category: 'seagrass',
  count: 8,
  height: [0.2, 1.4],
  leaves: [1, 1],
  width: 0.036,
  reach: 0.2,
  color: 0x789366,
  sway: 0.075,
  frequency: 0.65,
  region: 'substrate-edge',
  broadLeaves: false,
};
