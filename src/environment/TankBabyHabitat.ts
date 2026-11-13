import * as THREE from 'three';
import type { Aquarium } from './Aquarium';
import type { PlacementContext } from '../catalog/catalog';
import type { BabyHabitat } from '../creatures/babies/BabyNavigation';
import type { ConvexCollider } from '../player/collision';
import { boxCollider } from './passage/Crevice';

/** Includes the actual sand mesh, presentation hulls, small pebbles, homes and return alley. */
export class TankBabyHabitat implements BabyHabitat {
  readonly solids: ConvexCollider[] = [];
  readonly floor: BabyHabitat['floor'];
  private readonly protected: ConvexCollider[];
  constructor(
    private readonly q: Aquarium,
    context: PlacementContext,
  ) {
    this.protected = context.keepOut
      .filter((k) => !k.name.startsWith('structure-'))
      .map((k) =>
        boxCollider([k.min.x, k.min.y, k.min.z], [k.max.x, k.max.y, k.max.z]),
      );
    // The lid moves during ordinary simulation. Protect its whole hinge sweep so the
    // navigation grid never relies on the closed lid's cached cells or free nodes.
    const chest = q.ornaments.models.find((m) => m.kind === 'chest');
    if (chest?.hinge) {
      const hinge = chest.hinge.getWorldPosition(new THREE.Vector3());
      const scale = chest.root.getWorldScale(new THREE.Vector3());
      const r = 1.55 * Math.max(scale.x, scale.y, scale.z);
      this.protected.push(
        boxCollider(
          [hinge.x - r, hinge.y - r, hinge.z - r],
          [hinge.x + r, hinge.y + r, hinge.z + r],
        ),
      );
    }
    const geometry = q.sand.geometry;
    if (!(geometry instanceof THREE.PlaneGeometry))
      throw Error('Tank sand must be a regular grid');
    const nx = geometry.parameters.widthSegments,
      nz = geometry.parameters.heightSegments,
      positions = geometry.attributes.position;
    const width = geometry.parameters.width,
      depth = geometry.parameters.height;
    this.floor = (x, z, radius) => {
      const i0 = Math.max(
          0,
          Math.floor(((x - radius + width / 2) / width) * nx),
        ),
        i1 = Math.min(nx, Math.ceil(((x + radius + width / 2) / width) * nx));
      const k0 = Math.max(
          0,
          Math.floor(((z - radius + depth / 2) / depth) * nz),
        ),
        k1 = Math.min(nz, Math.ceil(((z + radius + depth / 2) / depth) * nz));
      let top = -Infinity;
      for (let k = k0; k <= k1; k++)
        for (let i = i0; i <= i1; i++)
          top = Math.max(top, positions.getY(k * (nx + 1) + i));
      return Number.isFinite(top) ? top : 0;
    };
    this.refresh();
  }
  refresh() {
    this.solids.length = 0;
    this.solids.push(...this.q.collision.colliders, ...this.protected);
    for (const rock of this.q.rocks)
      if (!rock.solid) {
        const b = new THREE.Box3().setFromObject(rock.mesh);
        this.solids.push(
          boxCollider([b.min.x, b.min.y, b.min.z], [b.max.x, b.max.y, b.max.z]),
        );
      }
  }
}
