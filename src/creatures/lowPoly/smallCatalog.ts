import type { TankCreatureId } from '../../config/babies';

export type SmallFamily =
  | 'nudibranch'
  | 'crab'
  | 'shrimp'
  | 'lobster'
  | 'octopus'
  | 'echinoderm'
  | 'mollusk'
  | 'crustacean'
  | 'worm'
  | 'gelatinous';
export type SmallContact =
  'substrate' | 'shelter' | 'perch' | 'hover' | 'pelagic';
export interface SmallCreatureRecord {
  readonly family: SmallFamily;
  readonly habitat: readonly string[];
  /** The one geometry owner reused by wild, card and aquarium contexts. */
  readonly source: string;
  readonly contact: SmallContact;
  readonly motion: 'glide' | 'step' | 'crawl' | 'pulse' | 'drift' | 'sway';
}

/** Pass 020's semantic migration inventory. Fish-shaped miniatures stay with Passes 017–018;
 * sessile coral/sponge/plant identities stay with Passes 021–022. */
export const SMALL_CREATURES: Partial<
  Record<TankCreatureId, SmallCreatureRecord>
> = {
  'spanish-shawl': {
    family: 'nudibranch',
    habitat: ['kelp'],
    source: 'kelpMinis/Spanish_Shawl + SpanishShawl.ts',
    contact: 'substrate',
    motion: 'glide',
  },
  'tritoniella-belli': {
    family: 'nudibranch',
    habitat: ['antarctic'],
    source: 'iceMinis/Tritoniella_Belli',
    contact: 'substrate',
    motion: 'glide',
  },
  'pikachu-nudibranch': {
    family: 'nudibranch',
    habitat: ['outer'],
    source: 'rareMinis/Pikachu_Nudibranch',
    contact: 'substrate',
    motion: 'glide',
  },
  'leaf-sheep': {
    family: 'nudibranch',
    habitat: ['outer'],
    source: 'rareMinis/Leaf_Sheep',
    contact: 'perch',
    motion: 'glide',
  },
  'kelp-crab': {
    family: 'crab',
    habitat: ['kelp'],
    source: 'CaveCrabs.crabBody',
    contact: 'perch',
    motion: 'step',
  },
  'rock-crab': {
    family: 'crab',
    habitat: ['cave'],
    source: 'CaveCrabs.crabBody',
    contact: 'shelter',
    motion: 'step',
  },
  'candy-crab': {
    family: 'crab',
    habitat: ['outer'],
    source: 'rareMinis/Candy_Crab',
    contact: 'perch',
    motion: 'step',
  },
  'decorator-crab': {
    family: 'crab',
    habitat: ['wreck'],
    source: 'wreckMinis/Decorator_Crab',
    contact: 'shelter',
    motion: 'step',
  },
  'cleaner-shrimp': {
    family: 'shrimp',
    habitat: ['cave'],
    source: 'CaveVisitors.shrimpGeometry',
    contact: 'perch',
    motion: 'crawl',
  },
  'harlequin-shrimp': {
    family: 'shrimp',
    habitat: ['outer'],
    source: 'reefMinis/Harlequin_Shrimp',
    contact: 'shelter',
    motion: 'crawl',
  },
  'banded-coral-shrimp': {
    family: 'shrimp',
    habitat: ['cave'],
    source: 'caveMinis/Banded_Coral_Shrimp',
    contact: 'shelter',
    motion: 'sway',
  },
  'skeleton-shrimp': {
    family: 'shrimp',
    habitat: ['wreck'],
    source: 'wreckMinis/Skeleton_Shrimp',
    contact: 'perch',
    motion: 'sway',
  },
  mysid: {
    family: 'shrimp',
    habitat: ['cave'],
    source: 'IceCritterShapes.krillShape',
    contact: 'hover',
    motion: 'drift',
  },
  'antarctic-krill': {
    family: 'shrimp',
    habitat: ['antarctic'],
    source: 'IceCritterShapes.krillShape',
    contact: 'pelagic',
    motion: 'drift',
  },
  'spiny-lobster': {
    family: 'lobster',
    habitat: ['cave'],
    source: 'SpinyLobster.spinyLobsterBody + CaveLobsters.lobsterAntennae',
    contact: 'shelter',
    motion: 'step',
  },
  octopus: {
    family: 'octopus',
    habitat: ['outer', 'cave'],
    source: 'shared/Octopus.octopusRestGeometry',
    contact: 'shelter',
    motion: 'crawl',
  },
  'mimic-octopus': {
    family: 'octopus',
    habitat: ['outer'],
    source: 'reefMinis/Mimic_Octopus',
    contact: 'substrate',
    motion: 'crawl',
  },
  'east-pacific-red-octopus': {
    family: 'octopus',
    habitat: ['kelp'],
    source: 'kelpMinis/Red_Octopus',
    contact: 'shelter',
    motion: 'crawl',
  },
  wonderpus: {
    family: 'octopus',
    habitat: ['cave'],
    source: 'caveMinis/Wonderpus',
    contact: 'shelter',
    motion: 'crawl',
  },
  'antarctic-sea-star': {
    family: 'echinoderm',
    habitat: ['antarctic'],
    source: 'KelpShapes.seaStarShape',
    contact: 'substrate',
    motion: 'crawl',
  },
  'brittle-star': {
    family: 'echinoderm',
    habitat: ['antarctic'],
    source: 'IceExtras.brittleStarGeometry',
    contact: 'substrate',
    motion: 'crawl',
  },
  'antarctic-sea-urchin': {
    family: 'echinoderm',
    habitat: ['antarctic'],
    source: 'IceExtras.urchinGeometry',
    contact: 'substrate',
    motion: 'crawl',
  },
  'sea-cucumber': {
    family: 'echinoderm',
    habitat: ['antarctic'],
    source: 'IceExtras.cucumberGeometry',
    contact: 'substrate',
    motion: 'crawl',
  },
  'feather-star': {
    family: 'echinoderm',
    habitat: ['antarctic'],
    source: 'IceGarden.featherStarGeometry',
    contact: 'perch',
    motion: 'sway',
  },
  'sea-butterfly': {
    family: 'mollusk',
    habitat: ['antarctic'],
    source: 'IceCritterShapes.seaButterflyShape',
    contact: 'pelagic',
    motion: 'drift',
  },
  'antarctic-scallop': {
    family: 'mollusk',
    habitat: ['antarctic'],
    source: 'IceExtras.scallopGeometry',
    contact: 'substrate',
    motion: 'pulse',
  },
  'sea-angel': {
    family: 'mollusk',
    habitat: ['antarctic'],
    source: 'iceMinis/Clione_Antarctica',
    contact: 'pelagic',
    motion: 'pulse',
  },
  'giant-isopod': {
    family: 'crustacean',
    habitat: ['antarctic'],
    source: 'iceMinis/Glyptonotus_Antarcticus + IceExtras.isopodGeometry',
    contact: 'substrate',
    motion: 'step',
  },
  'giant-sea-spider': {
    family: 'crustacean',
    habitat: ['antarctic'],
    source: 'IceCritters.seaSpiderRestGeometry',
    contact: 'substrate',
    motion: 'step',
  },
  'ribbon-worm': {
    family: 'worm',
    habitat: ['antarctic'],
    source: 'IceCritters.ribbonWormRestGeometry',
    contact: 'substrate',
    motion: 'crawl',
  },
  'christmas-tree-worm': {
    family: 'worm',
    habitat: ['outer'],
    source: 'ChristmasTreeWorms.wormPlumes',
    contact: 'perch',
    motion: 'sway',
  },
  'comb-jelly': {
    family: 'gelatinous',
    habitat: ['antarctic'],
    source: 'IceCritterShapes.combJellyShape',
    contact: 'pelagic',
    motion: 'drift',
  },
  'antarctic-jellyfish': {
    family: 'gelatinous',
    habitat: ['antarctic'],
    source: 'IceExtras.jellyBellGeometry + jellyArmsGeometry',
    contact: 'pelagic',
    motion: 'pulse',
  },
  salp: {
    family: 'gelatinous',
    habitat: ['antarctic'],
    source: 'IceExtras.salpGeometry',
    contact: 'pelagic',
    motion: 'drift',
  },
};

export const SMALL_CREATURE_IDS = Object.keys(
  SMALL_CREATURES,
) as TankCreatureId[];
export const smallCreatureRecord = (id: TankCreatureId) => SMALL_CREATURES[id];
