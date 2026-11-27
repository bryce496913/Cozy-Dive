export type RareHabitat =
  | 'aquarium'
  | 'outer-reef'
  | 'kelp-forest'
  | 'shipwreck'
  | 'sea-cave'
  | 'antarctic';

export type RareMotion =
  | 'grip-hover'
  | 'perch-walk'
  | 'den-undulate'
  | 'crawl'
  | 'hover'
  | 'rest-burst'
  | 'drift'
  | 'swim'
  | 'walk'
  | 'surface-patrol';

export interface RareCreatureRecord {
  readonly id: `species:${string}`;
  readonly name: string;
  readonly habitat: RareHabitat;
  /** The canonical geometry owner shared by every context that presents this species. */
  readonly source: string;
  readonly motion: RareMotion;
  /** Whether Pass 021 rebuilt the model or verified and retained an earlier canonical rebuild. */
  readonly disposition: 'rebuilt' | 'reused';
}

/**
 * Pass 021's complete semantic inventory. Earlier passes already rebuilt several canonical
 * libraries; this pass deliberately reuses those exact species models instead of creating rare
 * encounter copies. Stable sighting ids are part of the save contract and must never be renamed.
 */
export const RARE_CREATURES = [
  {
    id: 'species:seahorse',
    name: 'Seahorse',
    habitat: 'aquarium',
    source: 'anchored/HorseBody+HorseTail',
    motion: 'grip-hover',
    disposition: 'rebuilt',
  },
  {
    id: 'species:frogfish',
    name: 'Frogfish',
    habitat: 'aquarium',
    source: 'anchored/FrogBody+FrogFoot+FrogJaw+FrogLure',
    motion: 'perch-walk',
    disposition: 'rebuilt',
  },
  {
    id: 'species:moray-eel',
    name: 'Moray eel',
    habitat: 'aquarium',
    source: 'anchored/MorayBody+MorayDorsal+MorayHead+MorayJaw',
    motion: 'den-undulate',
    disposition: 'reused',
  },
  {
    id: 'species:pikachu-nudibranch',
    name: 'Pikachu nudibranch',
    habitat: 'aquarium',
    source: 'rareMinis/Pikachu_Nudibranch',
    motion: 'crawl',
    disposition: 'reused',
  },
  {
    id: 'species:leaf-sheep',
    name: 'Leaf sheep',
    habitat: 'aquarium',
    source: 'rareMinis/Leaf_Sheep',
    motion: 'crawl',
    disposition: 'reused',
  },
  {
    id: 'species:candy-crab',
    name: 'Candy crab',
    habitat: 'aquarium',
    source: 'rareMinis/Candy_Crab',
    motion: 'walk',
    disposition: 'reused',
  },
  {
    id: 'species:harlequin-shrimp',
    name: 'Harlequin shrimp',
    habitat: 'outer-reef',
    source: 'reefMinis/Harlequin_Shrimp',
    motion: 'crawl',
    disposition: 'reused',
  },
  {
    id: 'species:ornate-ghost-pipefish',
    name: 'Ornate ghost pipefish',
    habitat: 'outer-reef',
    source: 'reefMinis/Ghost_Pipefish',
    motion: 'hover',
    disposition: 'reused',
  },
  {
    id: 'species:hairy-frogfish',
    name: 'Hairy frogfish',
    habitat: 'outer-reef',
    source: 'reefMinis/Hairy_Frogfish',
    motion: 'perch-walk',
    disposition: 'reused',
  },
  {
    id: 'species:mimic-octopus',
    name: 'Mimic octopus',
    habitat: 'outer-reef',
    source: 'reefMinis/Mimic_Octopus',
    motion: 'crawl',
    disposition: 'reused',
  },
  {
    id: 'species:spanish-shawl',
    name: 'Spanish shawl nudibranch',
    habitat: 'kelp-forest',
    source: 'kelpMinis/Spanish_Shawl',
    motion: 'crawl',
    disposition: 'reused',
  },
  {
    id: 'species:weedy-seadragon',
    name: 'Weedy seadragon',
    habitat: 'kelp-forest',
    source: 'kelpMinis/Weedy_Seadragon',
    motion: 'hover',
    disposition: 'reused',
  },
  {
    id: 'species:sarcastic-fringehead',
    name: 'Sarcastic fringehead',
    habitat: 'kelp-forest',
    source: 'kelpMinis/Sarcastic_Fringehead',
    motion: 'rest-burst',
    disposition: 'reused',
  },
  {
    id: 'species:east-pacific-red-octopus',
    name: 'East Pacific red octopus',
    habitat: 'kelp-forest',
    source: 'kelpMinis/Red_Octopus',
    motion: 'crawl',
    disposition: 'reused',
  },
  {
    id: 'species:skeleton-shrimp',
    name: 'Skeleton shrimp',
    habitat: 'shipwreck',
    source: 'wreckMinis/Skeleton_Shrimp',
    motion: 'crawl',
    disposition: 'reused',
  },
  {
    id: 'species:juvenile-wolf-eel',
    name: 'Juvenile wolf eel',
    habitat: 'shipwreck',
    source: 'wreckMinis/Juvenile_Wolf_Eel',
    motion: 'den-undulate',
    disposition: 'reused',
  },
  {
    id: 'species:decorator-crab',
    name: 'Decorator crab',
    habitat: 'shipwreck',
    source: 'wreckMinis/Decorator_Crab',
    motion: 'walk',
    disposition: 'reused',
  },
  {
    id: 'species:painted-greenling',
    name: 'Painted greenling',
    habitat: 'shipwreck',
    source: 'wreckMinis/Painted_Greenling',
    motion: 'rest-burst',
    disposition: 'reused',
  },
  {
    id: 'species:stargazer',
    name: 'Stargazer fish',
    habitat: 'sea-cave',
    source: 'caveMinis/Stargazer',
    motion: 'rest-burst',
    disposition: 'reused',
  },
  {
    id: 'species:psychedelic-frogfish',
    name: 'Psychedelic frogfish',
    habitat: 'sea-cave',
    source: 'caveMinis/Psychedelic_Frogfish',
    motion: 'perch-walk',
    disposition: 'reused',
  },
  {
    id: 'species:banded-coral-shrimp',
    name: 'Banded coral shrimp',
    habitat: 'sea-cave',
    source: 'caveMinis/Banded_Coral_Shrimp',
    motion: 'crawl',
    disposition: 'reused',
  },
  {
    id: 'species:wonderpus',
    name: 'Wonderpus octopus',
    habitat: 'sea-cave',
    source: 'caveMinis/Wonderpus',
    motion: 'crawl',
    disposition: 'reused',
  },
  {
    id: 'species:sea-angel',
    name: 'Antarctic sea angel',
    habitat: 'antarctic',
    source: 'iceMinis/Clione_Antarctica',
    motion: 'drift',
    disposition: 'reused',
  },
  {
    id: 'species:tritoniella-belli',
    name: 'Antarctic nudibranch',
    habitat: 'antarctic',
    source: 'iceMinis/Tritoniella_Belli',
    motion: 'crawl',
    disposition: 'reused',
  },
  {
    id: 'species:giant-isopod',
    name: 'Giant Antarctic isopod',
    habitat: 'antarctic',
    source: 'iceMinis/Glyptonotus_Antarcticus',
    motion: 'walk',
    disposition: 'reused',
  },
  {
    id: 'species:leopard-seal',
    name: 'Leopard seal',
    habitat: 'antarctic',
    source: 'leopardSeal',
    motion: 'swim',
    disposition: 'reused',
  },
  {
    id: 'species:minke-whale',
    name: 'Minke whale',
    habitat: 'antarctic',
    source: 'minkeWhale',
    motion: 'swim',
    disposition: 'reused',
  },
  {
    id: 'species:killer-whale',
    name: 'Killer whale',
    habitat: 'antarctic',
    source: 'killerWhale',
    motion: 'swim',
    disposition: 'reused',
  },
  {
    id: 'species:antarctic-toothfish',
    name: 'Antarctic toothfish',
    habitat: 'antarctic',
    source: 'toothfish',
    motion: 'swim',
    disposition: 'reused',
  },
  {
    id: 'species:colossal-squid',
    name: 'Colossal squid',
    habitat: 'antarctic',
    source: 'IceRareLife/colossalSquidGeometry',
    motion: 'swim',
    disposition: 'reused',
  },
  {
    id: 'species:polar-bear',
    name: 'Polar bear',
    habitat: 'antarctic',
    source: 'polarBear',
    motion: 'surface-patrol',
    disposition: 'reused',
  },
] as const satisfies readonly RareCreatureRecord[];

export const RARE_CREATURE_IDS = RARE_CREATURES.map(({ id }) => id);
