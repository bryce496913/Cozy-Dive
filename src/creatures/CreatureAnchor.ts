import type { Vec3 } from '../config/world';
import type { HabitatKind } from '../fish/FishHabitat';
/** Scene-free home metadata shared by normal swimmers and localized creatures. */
export interface CreatureAnchor {
  readonly id: string;
  readonly sourceId?: string;
  readonly position: Readonly<Vec3>;
  readonly orientation: Readonly<Vec3>;
  readonly homeRadius: number;
  readonly habitatKind: HabitatKind;
}
export const homeDistance = (p: Readonly<Vec3>, a: CreatureAnchor): number =>
  Math.hypot(p.x - a.position.x, p.y - a.position.y, p.z - a.position.z);
