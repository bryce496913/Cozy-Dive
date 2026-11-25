import type { BabyDefinition } from '../../config/babies';
import type { AssetId } from '../../assets/AssetRegistry';
const LIBRARIES = new Set<AssetId>([
  'rareMinis',
  'reefMinis',
  'kelpMinis',
  'wreckMinis',
  'caveMinis',
  'iceMinis',
]);
export function isAuthoredSmallAnimal(d: BabyDefinition): boolean {
  return !!d.asset && LIBRARIES.has(d.asset);
}
/** The 22 authored small discoveries; large visitors retain their existing scale and routes. */
export function smallAnimalMode(
  d: BabyDefinition,
): 'bottom' | 'hover' | 'pelagic' | undefined {
  if (d.motion === 'crawl' || d.motion === 'still') return 'bottom';
  if (!isAuthoredSmallAnimal(d)) return;
  return d.id === 'sea-angel' ? 'pelagic' : 'hover';
}
export function smallAnimalShelter(d: BabyDefinition): boolean {
  return /octopus|wonderpus|crab|shrimp|fringehead|wolf-eel|frogfish/.test(
    d.id,
  );
}
