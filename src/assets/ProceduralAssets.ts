import type * as THREE from 'three';
import type { AssetId } from './AssetRegistry';
import { ICE_ANIMALS } from '../environment/ice/IceAnimals';

/**
 * Playtest: assets built in code rather than loaded from a file (the big animals under the ice,
 * rebuilt to replace their early simple models). The asset cache builds one of these once, as it
 * would decode a file, and every lease clones it (sharing its geometry and material), so callers
 * cannot tell the difference.
 */
export const PROCEDURAL_ASSETS: Readonly<
  Partial<Record<AssetId, () => THREE.Group>>
> = ICE_ANIMALS;
