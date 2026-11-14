import { CLEFT } from '../../config/passage';
import type { ConvexCollider } from '../../player/collision';
import { Crevice } from '../passage/Crevice';

/**
 * v0.6 Pass 032: a convex collider from the tank's crevice coordinates into the outer waters: the
 * half turn about y flips x and z of every plane normal, and the shift moves each plane along it.
 */
export function cleftCollider(c: ConvexCollider): ConvexCollider {
  const o = CLEFT.offset;
  return {
    planes: c.planes.map((p) => {
      const x = -p.x,
        z = -p.z;
      return { x, y: p.y, z, offset: p.offset + x * o.x + p.y * o.y + z * o.z };
    }),
    min: { x: o.x - c.max.x, y: c.min.y + o.y, z: o.z - c.max.z },
    max: { x: o.x - c.min.x, y: c.max.y + o.y, z: o.z - c.min.z },
  };
}

/**
 * v0.6 Pass 032: the second passage, at the foot of the outer reef's cliff. It is the tank's own
 * crevice (the same boulders, rock tube and darkness veils, so it reads as kin to the crack in the
 * tank), turned so its glass side lies against the cliff and its mouth faces west, away from the
 * tunnel. Owns the crevice it builds.
 */
export class OuterCleft {
  readonly crevice = new Crevice();
  readonly colliders: readonly ConvexCollider[];
  constructor() {
    const root = this.crevice.root,
      o = CLEFT.offset;
    root.name = 'Cleft to the kelp forest';
    root.rotation.y = Math.PI;
    root.position.set(o.x, o.y, o.z);
    root.updateMatrixWorld(true);
    this.colliders = this.crevice.colliders.map(cleftCollider);
  }
  get root() {
    return this.crevice.root;
  }
  get rocks() {
    return this.crevice.rocks;
  }
  dispose(): void {
    this.crevice.dispose();
  }
}
