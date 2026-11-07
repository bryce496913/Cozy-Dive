/** Keep the original 16-fish regression scenarios explicit while production uses the marine registry. */
import { REGRESSION_FISH_SPECIES as ORIGINAL_FISH_SPECIES } from './regressionSpecies';
import {
  spawnFish as spawnPopulation,
  populationCount as countPopulation,
} from '../../src/fish/FishSpawner';
import { FishSystem as PopulationSystem } from '../../src/fish/FishSystem';
import type { FishHabitat } from '../../src/fish/FishHabitat';
import type { Vec3 } from '../../src/config/world';
export function spawnFish(
  habitat: FishHabitat,
  species = ORIGINAL_FISH_SPECIES,
  seed?: number,
  player?: Vec3,
) {
  return spawnPopulation(habitat, species, seed, player);
}
export function populationCount(species = ORIGINAL_FISH_SPECIES) {
  return countPopulation(species);
}
export class FishSystem extends PopulationSystem {
  constructor(
    habitat: FishHabitat,
    species = ORIGINAL_FISH_SPECIES,
    seed?: number,
  ) {
    super(habitat, species, seed);
  }
}
