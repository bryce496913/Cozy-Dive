import type { BigCreatureId } from './creatures';
import type { AssetId } from '../assets/AssetRegistry';

export interface BabyDefinition {
  readonly id: BigCreatureId;
  readonly sighting: string;
  readonly label: string;
  readonly asset: AssetId;
  readonly scale: number;
  /** Yaw-independent enclosure of both detail levels and every stroke. */
  readonly radius: number;
  readonly halfHeight: number;
  readonly speed: number;
  readonly strokeHz: number;
}
export const TANK_BABIES: readonly BabyDefinition[] = [
  {
    id: 'blacktip-reef-shark',
    sighting: 'species:blacktip-reef-shark',
    label: 'Blacktip pup',
    asset: 'reefShark',
    scale: 0.55 / 3,
    radius: 0.32,
    halfHeight: 0.16,
    speed: 0.3,
    strokeHz: 0.45,
  },
  // The tail extends much further than the 0.5 m disc. Its full sweep is protected too.
  {
    id: 'spotted-eagle-ray',
    sighting: 'species:spotted-eagle-ray',
    label: 'Baby eagle ray',
    asset: 'eagleRay',
    scale: 0.5 / 3,
    radius: 0.64,
    halfHeight: 0.14,
    speed: 0.22,
    strokeHz: 0.28,
  },
  {
    id: 'green-sea-turtle',
    sighting: 'species:green-sea-turtle',
    label: 'Turtle hatchling',
    asset: 'seaTurtle',
    scale: 0.25,
    radius: 0.25,
    halfHeight: 0.16,
    speed: 0.16,
    strokeHz: 0.32,
  },
];
export const BABY_CAP = 3;
export const babyDefinition = (id: BigCreatureId): BabyDefinition =>
  TANK_BABIES.find((b) => b.id === id)!;
