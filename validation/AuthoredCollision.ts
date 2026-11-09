import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import inventory from '../tools/art/pass013/collisions.json';
import type { Aquarium } from '../src/environment/Aquarium';
import { assetColliders } from '../src/assets/AssetCollision';
export function installAuthoredHulls(q: Aquarium): void {
  const names = {
    log: 'Log',
    shipwreck: 'Shipwreck',
    arch: 'Arch',
    filter: 'Filter',
    chest: 'Chest',
    statue: 'Statue',
  } as const;
  for (const model of q.ornaments.models) {
    const root = new THREE.Group();
    model.root.add(root);
    for (const row of inventory[names[model.kind]]) {
      const geometry = new ConvexGeometry(
        row.points.map(
          (p) => new THREE.Vector3(...(p as [number, number, number])),
        ),
      );
      if (row.name.startsWith('DYNAMIC_')) {
        q.ornaments.setLidCollisionGeometry(geometry);
        geometry.dispose();
      } else {
        const mesh = new THREE.Mesh(geometry);
        mesh.name = row.name;
        root.add(mesh);
      }
    }
    const hulls = assetColliders(root);
    q.replacePresentationColliders(
      q.ornaments.surfaceGroups.find((g) => g.id === model.kind)!.colliders,
      hulls,
    );
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    root.removeFromParent();
  }
}
