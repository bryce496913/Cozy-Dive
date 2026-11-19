import type { Vec3 } from '../../config/world';
import type { ConvexCollider } from '../../player/collision';
import { Crevice } from './Crevice';

/**
 * v0.6 Pass 034: a convex collider from the tank's crevice coordinates into another world, turned
 * half round about y and shifted by `offset`: the half turn flips x and z of every plane normal,
 * and the shift moves each plane along it. (Pass 032's cleft is one of these.)
 */
export function turnedCollider(
  c: ConvexCollider,
  o: Readonly<Vec3>,
): ConvexCollider {
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
 * The tank's own crevice (the same boulders, rock tube and darkness veils), turned half round and
 * moved by `offset`, so the side that lies on the tank's glass lies against a rock face. Owns the
 * crevice it builds.
 */
export class TurnedCrevice {
  readonly crevice = new Crevice();
  readonly colliders: readonly ConvexCollider[];
  constructor(offset: Readonly<Vec3>, name: string) {
    const root = this.crevice.root;
    root.name = name;
    root.rotation.y = Math.PI;
    root.position.set(offset.x, offset.y, offset.z);
    root.updateMatrixWorld(true);
    this.colliders = this.crevice.colliders.map((c) =>
      turnedCollider(c, offset),
    );
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
