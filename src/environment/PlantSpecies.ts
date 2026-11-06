export type PlantSpeciesId =
  | 'vallisneria'
  | 'amazon-sword'
  | 'java-fern'
  | 'anubias'
  | 'dwarf-hairgrass'
  | 'meadow-grass';
export type HabitatRegionId =
  'rocky-bank' | 'background' | 'substrate-edge' | 'open-channel';
export interface PlantSpecies {
  readonly id: PlantSpeciesId;
  readonly name: string;
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
    id: 'vallisneria',
    name: 'Vallisneria',
    count: 16,
    height: [3.2, 5.0],
    leaves: [7, 10],
    width: 0.045,
    reach: 0.18,
    color: 0x689564,
    sway: 0.072,
    frequency: 0.65,
    region: 'background',
    broadLeaves: false,
  },
  {
    id: 'amazon-sword',
    name: 'Amazon Sword',
    count: 12,
    height: [1.4, 2.5],
    leaves: [7, 10],
    width: 0.28,
    reach: 0.48,
    color: 0x669563,
    sway: 0.023,
    frequency: 0.48,
    region: 'rocky-bank',
    broadLeaves: true,
  },
  {
    id: 'java-fern',
    name: 'Java Fern',
    count: 14,
    height: [1.1, 2.0],
    leaves: [8, 12],
    width: 0.14,
    reach: 0.32,
    color: 0x3e7e57,
    sway: 0.037,
    frequency: 0.57,
    region: 'rocky-bank',
    broadLeaves: true,
  },
  {
    id: 'anubias',
    name: 'Anubias',
    count: 10,
    height: [0.55, 0.95],
    leaves: [6, 9],
    width: 0.53,
    reach: 0.7,
    color: 0x3e7351,
    sway: 0.006,
    frequency: 0.38,
    region: 'rocky-bank',
    broadLeaves: true,
  },
  {
    id: 'dwarf-hairgrass',
    name: 'Dwarf Hairgrass',
    count: 13,
    height: [0.25, 0.52],
    leaves: [24, 32],
    width: 0.022,
    reach: 0.25,
    color: 0x8aa56b,
    sway: 0.039,
    frequency: 0.7,
    region: 'substrate-edge',
    broadLeaves: false,
  },
];
export const PLANT_TEMPLATES = 3;

export const MEADOW_GRASS: PlantSpecies = {
  id: 'meadow-grass',
  name: 'Freshwater meadow grass',
  count: 8,
  height: [0.2, 1.4],
  leaves: [1, 1],
  width: 0.022,
  reach: 0.2,
  color: 0x82986a,
  sway: 0.075,
  frequency: 0.65,
  region: 'substrate-edge',
  broadLeaves: false,
};
