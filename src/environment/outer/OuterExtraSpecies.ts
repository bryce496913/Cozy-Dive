import { FISH_SPECIES, type FishSpecies } from '../../fish/FishSpecies';

/**
 * v0.6 Pass 043: outer-reef species simulated with the reef's schools, on their own authored rigs
 * (the chromis rig reshaped). Built from the chromis entry; never in the tank's population.
 *   - blue tang: big, loose, moving clouds over the reef top;
 *   - threadfin butterflyfish and Moorish idols: always in twos, close together.
 */
const chromis = FISH_SPECIES.find((f) => f.id === 'blue-green-chromis')!;
const pair = (spacing: number): FishSpecies['schooling'] => ({
  ...chromis.schooling,
  enabled: true,
  spacing,
  cohesionRadius: 3,
  cohesionWeight: chromis.schooling.cohesionWeight * 2.2,
  alignmentRadius: 3,
  reconnectRadius: 6,
  maxNeighbors: 1,
});

export const OUTER_EXTRA_SPECIES: readonly FishSpecies[] = [
  {
    ...chromis,
    id: 'blue-tang',
    name: 'Blue tang',
    length: 0.62,
    height: 0.3,
    width: 0.1,
    color: 0x1f55d8,
    backColor: 0x0b1a40,
    finColor: 0xf2d21a,
    accentColor: 0x0b1a40,
    authoredLength: undefined,
    speed: chromis.speed * 0.9,
    schooling: {
      ...chromis.schooling,
      enabled: true,
      spacing: chromis.schooling.spacing * 1.5,
      cohesionWeight: chromis.schooling.cohesionWeight * 1.2,
    },
  },
  {
    ...chromis,
    id: 'threadfin-butterflyfish',
    name: 'Threadfin butterflyfish',
    length: 0.5,
    height: 0.36,
    width: 0.08,
    color: 0xf1efe2,
    backColor: 0xf6c51a,
    finColor: 0xf6c51a,
    accentColor: 0x111111,
    authoredLength: undefined,
    speed: chromis.speed * 0.55,
    schooling: pair(0.55),
  },
  {
    ...chromis,
    id: 'moorish-idol',
    name: 'Moorish idol',
    length: 0.5,
    height: 0.4,
    width: 0.08,
    color: 0xf7f2e0,
    backColor: 0x111111,
    finColor: 0xf9dc33,
    accentColor: 0x111111,
    authoredLength: undefined,
    speed: chromis.speed * 0.55,
    schooling: pair(0.6),
  },
];
