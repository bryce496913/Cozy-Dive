import type { BabyDefinition } from '../../config/babies';
import type { AssetId } from '../../assets/AssetRegistry';
import { smallCreatureRecord } from '../lowPoly/smallCatalog';
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
  const contact = smallCreatureRecord(d.id)?.contact;
  if (contact === 'pelagic') return 'pelagic';
  if (contact === 'hover') return 'hover';
  if (contact) return 'bottom';
  if (d.motion === 'crawl' || d.motion === 'still') return 'bottom';
  if (!isAuthoredSmallAnimal(d)) return;
  return d.id === 'sea-angel' ? 'pelagic' : 'hover';
}
export function smallAnimalShelter(d: BabyDefinition): boolean {
  const contact = smallCreatureRecord(d.id)?.contact;
  if (contact) return contact === 'shelter' || contact === 'perch';
  return /fringehead|wolf-eel|frogfish/.test(d.id);
}
/** Local pre-scale Y translation that seats a bottom animal at its navigation envelope. */
export function smallAnimalSeatY(
  d: BabyDefinition,
  authoredMinY: number,
  scale: number,
): number | undefined {
  if (
    smallAnimalMode(d) !== 'bottom' ||
    !Number.isFinite(authoredMinY) ||
    !Number.isFinite(scale) ||
    scale <= 0
  )
    return;
  return -d.halfHeight / scale - authoredMinY;
}
