import { CLEFT } from '../../config/passage';
import type { ConvexCollider } from '../../player/collision';
import { TurnedCrevice, turnedCollider } from '../passage/TurnedCrevice';

/**
 * v0.6 Pass 032: a convex collider from the tank's crevice coordinates into the outer waters: the
 * half turn about y flips x and z of every plane normal, and the shift moves each plane along it.
 */
export function cleftCollider(c: ConvexCollider): ConvexCollider {
  return turnedCollider(c, CLEFT.offset);
}

/**
 * v0.6 Pass 032: the second passage, at the foot of the outer reef's cliff. It is the tank's own
 * crevice (the same boulders, rock tube and darkness veils, so it reads as kin to the crack in the
 * tank), turned so its glass side lies against the cliff and its mouth faces west, away from the
 * tunnel. Owns the crevice it builds.
 */
export class OuterCleft extends TurnedCrevice {
  constructor() {
    super(CLEFT.offset, 'Cleft to the kelp forest');
  }
}
